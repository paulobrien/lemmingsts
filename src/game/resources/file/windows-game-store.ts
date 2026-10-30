import { unzipSync } from 'fflate';
import { WINDOWS_GAME_FILES, WINDOWS_GROUND_FILES, WINDOWS_LEVEL_FILES } from './windows-game-names';
import { readWindowsGameIso } from './windows-iso';
import { parseWindowsLevelDatabase } from '../windows-level-database';

const DATABASE = 'lemmings-windows-game';
const STORE = 'files';
const REMOVED = '__automatic_game_import_disabled__';
const allowed = new Set(WINDOWS_GAME_FILES);
const MAX_ARCHIVE = 16 * 1024 * 1024;
const MAX_TOTAL = 8 * 1024 * 1024;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Local storage is unavailable.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
    request.onerror = () => reject(new Error('Could not open Windows game storage.'));
    request.onblocked = () => { blocked = true; reject(new Error('Windows game storage is in use by another tab.')); };
  });
}
function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not save Windows game data.'));
    transaction.onerror = () => {};
  });
}

async function readSelection(input: FileList | readonly File[]): Promise<{ name: string; data: ArrayBuffer }[]> {
  let files = Array.from(input);
  const iso = files.filter(file => file.name.toLowerCase().endsWith('.iso'));
  if (iso.length) {
    if (files.length !== 1) throw new Error('Select one Windows ISO or the extracted game files.');
    files = await readWindowsGameIso(iso[0]);
  }
  const zip = files.filter(file => file.name.toLowerCase().endsWith('.zip'));
  if (zip.length) {
    if (files.length !== 1 || zip[0].size > MAX_ARCHIVE) throw new Error('Select one Windows ZIP within the size limit.');
    const seen = new Set<string>();
    let total = 0;
    let validationError: Error | undefined;
    try {
      const entries = unzipSync(new Uint8Array(await zip[0].arrayBuffer()), { filter: entry => {
        const name = entry.name.split(/[\\/]/).pop()?.toUpperCase() ?? '';
        if (!allowed.has(name)) return false;
        if (seen.has(name)) { validationError = new Error(`Duplicate Windows game files: ${name}`); throw validationError; }
        seen.add(name);
        total += entry.originalSize;
        if (total > MAX_TOTAL) { validationError = new Error('The Windows game files are too large.'); throw validationError; }
        return true;
      } });
      files = Object.entries(entries).map(([path, data]) => new File([Uint8Array.from(data)], path.split(/[\\/]/).pop() || path));
    } catch { throw validationError ?? new Error('Could not read the Windows game ZIP archive.'); }
  }
  const selected = new Map<string, File>();
  for (const file of files) {
    const name = file.name.toUpperCase();
    if (!allowed.has(name)) continue;
    if (selected.has(name)) throw new Error(`Duplicate Windows game files: ${name}`);
    selected.set(name, file);
  }
  const missing = WINDOWS_GAME_FILES.filter(name => !selected.has(name));
  if (missing.length) throw new Error(`Missing Windows game files: ${missing.join(', ')}`);
  let total = 0;
  const result: { name: string; data: ArrayBuffer }[] = [];
  for (const [name, file] of selected) {
    if (!file.size || file.size > 1024 * 1024 || (total += file.size) > MAX_TOTAL) throw new Error('The Windows game files exceed the size limit.');
    const data = await file.arrayBuffer();
    if ((WINDOWS_LEVEL_FILES.includes(name) && data.byteLength !== 2048) ||
        (WINDOWS_GROUND_FILES.includes(name) && data.byteLength !== 1056) ||
        (name === 'LEMMINGS.DB' && (data.byteLength < 145 || (data.byteLength - 8) % 137 !== 0))) {
      throw new Error(`${name} is not a supported Windows Lemmings game file.`);
    }
    if (name === 'LEMMINGS.DB') {
      try { parseWindowsLevelDatabase(data); }
      catch { throw new Error('LEMMINGS.DB is not a supported Windows Lemmings level database.'); }
    }
    result.push({ name, data });
  }
  return result;
}

/** Validate the complete selection before atomically replacing locally stored game data. */
export async function importWindowsGame(files: FileList | readonly File[]): Promise<void> { await importFiles(files, false); }
export async function importWindowsGameIfMissing(files: FileList | readonly File[]): Promise<boolean> { return importFiles(files, true); }
async function importFiles(files: FileList | readonly File[], onlyIfMissing: boolean): Promise<boolean> {
  const selected = await readSelection(files);
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const done = transactionDone(tx);
    const store = tx.objectStore(STORE);
    let imported = false;
    const write = () => { store.clear(); for (const file of selected) store.put(file.data, file.name); imported = true; };
    if (onlyIfMissing) { const count = store.count(); count.onsuccess = () => { if (count.result === 0) write(); }; }
    else write();
    await done;
    return imported;
  } finally { db.close(); }
}
async function keys(): Promise<Set<IDBValidKey>> {
  const db = await openDatabase();
  try {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
    return await new Promise((resolve, reject) => { request.onsuccess = () => resolve(new Set(request.result)); request.onerror = () => reject(new Error('Could not check Windows game data.')); });
  } finally { db.close(); }
}
export async function hasWindowsGame(): Promise<boolean> { const saved = await keys(); return WINDOWS_GAME_FILES.every(name => saved.has(name)); }
export async function canAutoImportWindowsGame(): Promise<boolean> { return (await keys()).size === 0; }
export async function clearWindowsGame(): Promise<void> {
  const db = await openDatabase();
  try { const tx = db.transaction(STORE, 'readwrite'); const done = transactionDone(tx); const store = tx.objectStore(STORE); store.clear(); store.put(true, REMOVED); await done; }
  finally { db.close(); }
}
export async function getWindowsGameFile(filename: string): Promise<ArrayBuffer | undefined> {
  const name = filename.toUpperCase();
  if (!allowed.has(name)) return undefined;
  const db = await openDatabase();
  try {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(name);
    return await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result as ArrayBuffer | undefined); request.onerror = () => reject(new Error(`Could not read ${name} from local Windows game storage.`)); });
  } finally { db.close(); }
}

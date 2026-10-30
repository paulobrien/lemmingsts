import { openGameDatabase as openDatabase, transactionDone, WINDOWS_GRAPHICS_STORE } from './game-file-database';
import { unzipSync } from 'fflate';
import { decodeWindowsPalette, decodeWindowsSprites } from '../windows-graphics';
import { decodeWindowsBmp } from '../windows-bmp';
import { createWindowsMaskProvider } from '../windows-mask-provider';
import { WINDOWS_GRAPHICS_ALL_FILES, WINDOWS_GRAPHICS_FILES, WINDOWS_OPTIONAL_GRAPHICS_FILES, WINDOWS_STANDALONE_GRAPHICS_FILES } from './windows-graphics-names';
import { readWindowsGraphicsIso } from './windows-iso';

const STORE = WINDOWS_GRAPHICS_STORE;
export const REMOVED = '__automatic_graphics_import_disabled__';
const allowed = new Set(WINDOWS_GRAPHICS_ALL_FILES);
const MAX_ARCHIVE = 16 * 1024 * 1024;
const MAX_FILE = 1024 * 1024;
const MAX_TOTAL = 8 * 1024 * 1024;

export async function prepareWindowsGraphics(input: FileList | readonly File[]): Promise<{ name: string; data: ArrayBuffer }[]> {
  let files = Array.from(input);
  const iso = files.filter(file => file.name.toLowerCase().endsWith('.iso'));
  if (iso.length) {
    if (files.length !== 1) throw new Error('Select one ISO disc image or the graphics files together.');
    files = await readWindowsGraphicsIso(iso[0]);
  }
  const archives = files.filter(file => file.name.toLowerCase().endsWith('.zip'));
  if (archives.length) {
    if (files.length !== 1) throw new Error('Select one ZIP archive or the graphics files together.');
    if (archives[0].size > MAX_ARCHIVE) throw new Error('The graphics archive is too large.');
    let total = 0;
    const seen = new Set<string>();
    let validationError: Error | undefined;
    try {
      const entries = unzipSync(new Uint8Array(await archives[0].arrayBuffer()), { filter: entry => {
        const name = entry.name.split(/[\\/]/).pop()?.toUpperCase() ?? '';
        if (!allowed.has(name)) return false;
        if (name === 'WLEMLOGO.BMP' && entry.originalSize > MAX_FILE) return false;
        if (seen.has(name)) { validationError = new Error(`Duplicate graphics files: ${name}`); throw validationError; }
        seen.add(name);
        total += entry.originalSize;
        if (total > MAX_TOTAL) { validationError = new Error('The graphics archive is too large.'); throw validationError; }
        return true;
      } });
      files = Object.entries(entries).map(([path, data]) => new File([Uint8Array.from(data)], path.split(/[\\/]/).pop() || path));
    } catch {
      if (validationError) throw validationError;
      throw new Error('Could not read the graphics ZIP archive.');
    }
  }
  const selected = new Map<string, File>();
  for (const file of files) {
    const name = file.name.toUpperCase();
    if (!allowed.has(name)) continue;
    if (name === 'WLEMLOGO.BMP' && file.size > MAX_FILE) continue;
    if (selected.has(name)) throw new Error(`Duplicate graphics files: ${name}`);
    selected.set(name, file);
  }
  const missing = WINDOWS_GRAPHICS_FILES.filter(name => !selected.has(name));
  if (missing.length) throw new Error(`Missing graphics files: ${missing.join(', ')}`);
  if ([...selected.values()].reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL) throw new Error('The graphics files are too large.');
  const result: { name: string; data: ArrayBuffer }[] = [];
  // Decode one file at a time to bound peak memory before opening the transaction.
  for (const name of selected.keys()) {
    const file = selected.get(name)!;
    if (file.size > MAX_FILE) throw new Error(`${name} is too large.`);
    let data: ArrayBuffer;
    try {
      data = await file.arrayBuffer();
      if (name.endsWith('.PAL')) decodeWindowsPalette(new Uint8Array(data));
      else if (name.endsWith('.BMP')) decodeWindowsBmp(new Uint8Array(data));
      else decodeWindowsSprites(new Uint8Array(data));
    } catch {
      if (name === 'WLEMLOGO.BMP') continue;
      throw new Error(`${name} is not a supported Windows Lemmings graphics file.`);
    }
    result.push({ name, data });
  }
  return result;
}

/** Save the user's graphics as a complete, separately removable optional set. */
export async function importWindowsGraphics(files: FileList | readonly File[]): Promise<void> {
  await importFiles(files, false);
}
export async function importWindowsGraphicsIfMissing(files: FileList | readonly File[]): Promise<boolean> {
  return importFiles(files, true);
}
async function importFiles(files: FileList | readonly File[], onlyIfMissing: boolean): Promise<boolean> {
  const selection = await prepareWindowsGraphics(files);
  const db = await openDatabase();
  try {
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE);
    let imported = false;
    const write = () => {
      store.clear();
      for (const file of selection) store.put(file.data, file.name);
      imported = true;
    };
    if (onlyIfMissing) {
      const count = store.count();
      count.onsuccess = () => {
        if (count.result === 0) { write(); return; }
        // Existing installs may acquire optional assets only from a bundle
        // with the same palette, never from a different edition or after removal.
        const keys = store.getAllKeys();
        keys.onsuccess = () => {
          const saved = new Set(keys.result);
          if (saved.has(REMOVED) || !WINDOWS_GRAPHICS_FILES.every(name => saved.has(name))) return;
          const palette = store.get('FE.PAL');
          palette.onsuccess = () => {
            const existing = palette.result as ArrayBuffer | undefined;
            const supplied = selection.find(file => file.name === 'FE.PAL')?.data;
            if (!existing || !supplied || existing.byteLength !== supplied.byteLength) return;
            const suppliedBytes = new Uint8Array(supplied);
            if (!new Uint8Array(existing).every((value, index) => value === suppliedBytes[index])) return;
            for (const file of selection) {
              if (WINDOWS_OPTIONAL_GRAPHICS_FILES.includes(file.name) && !saved.has(file.name)) {
                store.put(file.data, file.name);
                imported = true;
              }
            }
          };
        };
      };
    } else write();
    await done;
    return imported;
  } finally { db.close(); }
}

async function keys(): Promise<Set<IDBValidKey>> {
  const db = await openDatabase();
  try {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
    return await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(new Set(request.result));
      request.onerror = () => reject(new Error('Could not check local graphics files.'));
    });
  } finally { db.close(); }
}
export async function hasWindowsGraphics(): Promise<boolean> {
  const saved = await keys();
  return WINDOWS_GRAPHICS_FILES.every(name => saved.has(name));
}
/** Standalone needs the low-resolution simulation sprites and complete controls. */
export async function hasStandaloneWindowsGraphics(): Promise<boolean> {
  const saved = await keys();
  if (!WINDOWS_STANDALONE_GRAPHICS_FILES.every(name => saved.has(name))) return false;
  try {
    const lemmings = await getWindowsGraphicsFile('LEMMSMA.SPR');
    if (!lemmings) return false;
    createWindowsMaskProvider(new Uint8Array(lemmings));
    return true;
  } catch { return false; }
}
export async function canAutoImportWindowsGraphics(): Promise<boolean> {
  return (await keys()).size === 0;
}
/** Existing installations can acquire new, matching optional files without replacing their art. */
export async function canAutoImportWindowsUiGraphics(): Promise<boolean> {
  const saved = await keys();
  return !saved.has(REMOVED) && WINDOWS_GRAPHICS_FILES.every(name => saved.has(name)) &&
    WINDOWS_OPTIONAL_GRAPHICS_FILES.some(name => !saved.has(name));
}
export async function clearWindowsGraphics(): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE);
    store.clear();
    store.put(true, REMOVED);
    await done;
  } finally { db.close(); }
}
export async function getWindowsGraphicsFile(filename: string): Promise<ArrayBuffer | undefined> {
  const name = filename.toUpperCase();
  if (!allowed.has(name)) return undefined;
  const db = await openDatabase();
  try {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(name);
    return await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as ArrayBuffer | undefined);
      request.onerror = () => reject(new Error(`Could not read ${name} from local graphics storage.`));
    });
  } finally { db.close(); }
}

import { unzipSync } from 'fflate';
import { validateDosFiles } from './validate-dos-files';

/** Original DOS Lemmings resources required by the current game configuration. */
export const REQUIRED_LEMMINGS_FILES: readonly string[] = [
  'ADLIB.DAT', 'MAIN.DAT', 'ODDTABLE.DAT',
  ...Array.from({ length: 10 }, (_, index) => `LEVEL${String(index).padStart(3, '0')}.DAT`),
  ...Array.from({ length: 5 }, (_, index) => `GROUND${index}O.DAT`),
  ...Array.from({ length: 5 }, (_, index) => `VGAGR${index}.DAT`),
  ...Array.from({ length: 4 }, (_, index) => `VGASPEC${index}.DAT`),
];

const DATABASE_NAME = 'lemmings-game-files';
const STORE_NAME = 'original-lemmings';
const requiredNames = new Set(REQUIRED_LEMMINGS_FILES);
const MAX_ARCHIVE_BYTES = 16 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 8 * 1024 * 1024;

export interface FileValidation {
  missing: string[];
  empty: string[];
  duplicates: string[];
}

/** Check names without reading or persisting the selected files. */
export function validateLemmingsFiles(files: FileList | readonly File[]): FileValidation {
  const selected = new Map<string, File>();
  const duplicates = new Set<string>();

  for (const file of Array.from(files)) {
    const name = file.name.toUpperCase();
    if (!requiredNames.has(name)) continue;
    if (selected.has(name)) duplicates.add(name);
    selected.set(name, file);
  }

  return {
    missing: REQUIRED_LEMMINGS_FILES.filter((name) => !selected.has(name)),
    empty: REQUIRED_LEMMINGS_FILES.filter((name) => selected.has(name) && selected.get(name)!.size === 0),
    duplicates: Array.from(duplicates).sort(),
  };
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Local storage is unavailable in this browser. Enable site storage and try again.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => reject(new Error('Could not open local game storage. Check your browser storage settings.'));
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Local game storage is in use by another tab. Close it and try again.'));
    };
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('Could not save game files locally. Check available storage and try again.'));
    transaction.onerror = () => { /* onabort reports failure once the transaction has rolled back */ };
  });
}

/** Validate and atomically replace the imported files with the selected original DOS files. */
export async function importLemmingsFiles(files: FileList | readonly File[]): Promise<void> {
  let selected = Array.from(files);
  const archives = selected.filter(file => file.name.toLowerCase().endsWith('.zip'));
  if (archives.length) {
    if (selected.length !== 1) throw new Error('Select one ZIP archive, or select the game files together.');
    const archive = archives[0];
    if (archive.size > MAX_ARCHIVE_BYTES) throw new Error('The ZIP archive is too large. Please select the original game files.');
    let extractedSize = 0;
    try {
      const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()), {
        filter: entry => {
          const name = entry.name.split(/[\\/]/).pop()?.toUpperCase() || '';
          if (!requiredNames.has(name)) return false;
          extractedSize += entry.originalSize;
          if (extractedSize > MAX_EXTRACTED_BYTES) throw new Error('The game files in this ZIP archive are too large.');
          return true;
        },
      });
      selected = Object.entries(entries).map(([path, data]) =>
        new File([Uint8Array.from(data)], path.split(/[\\/]/).pop() || path));
    } catch (error) {
      if (error instanceof Error && error.message === 'The game files in this ZIP archive are too large.') throw error;
      throw new Error('Could not read this ZIP archive. Please use an unencrypted ZIP or select the game files directly.');
    }
  }
  const validation = validateLemmingsFiles(selected);
  const problems: string[] = [];
  if (validation.missing.length) problems.push(`Missing files: ${validation.missing.join(', ')}`);
  if (validation.empty.length) problems.push(`Empty files: ${validation.empty.join(', ')}`);
  if (validation.duplicates.length) problems.push(`Duplicate files: ${validation.duplicates.join(', ')}`);
  if (problems.length) throw new Error(problems.join('. '));
  const requiredFiles = selected.filter(file => requiredNames.has(file.name.toUpperCase()));
  if (requiredFiles.reduce((total, file) => total + file.size, 0) > MAX_EXTRACTED_BYTES) {
    throw new Error('The selected game files are too large. Your existing game files were not changed.');
  }

  // Read everything before opening the transaction: IndexedDB transactions can
  // auto-close while awaiting file reads. A failed read leaves an existing import intact.
  const buffers = await Promise.all(requiredFiles
    .map(async (file) => ({ name: file.name.toUpperCase(), data: await file.arrayBuffer() })));
  validateDosFiles(buffers);
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    for (const file of buffers) store.put(file.data, file.name);
    await done;
  } finally {
    database.close();
  }
}

/** Whether a complete set of game files is stored on this device. */
export async function hasLemmingsFiles(): Promise<boolean> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAllKeys();
    return await new Promise<boolean>((resolve, reject) => {
      request.onsuccess = () => {
        const keys = new Set(request.result);
        resolve(REQUIRED_LEMMINGS_FILES.every((name) => keys.has(name)));
      };
      request.onerror = () => reject(new Error('Could not check local game files.'));
    });
  } finally {
    database.close();
  }
}

/** Remove the imported game data from this device. */
export async function clearLemmingsFiles(): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE_NAME).clear();
    await done;
  } finally {
    database.close();
  }
}

/** Read a locally imported file, independent of the original filename casing. */
export async function getLemmingsFile(filename: string): Promise<ArrayBuffer | undefined> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(filename.toUpperCase());
    return await new Promise<ArrayBuffer | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as ArrayBuffer | undefined);
      request.onerror = () => reject(new Error(`Could not read ${filename} from local game storage.`));
    });
  } finally {
    database.close();
  }
}

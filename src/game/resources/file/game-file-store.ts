import { unzipSync } from 'fflate';
import { REQUIRED_LEMMINGS_FILES } from './dos-file-names';
import { validateDosFiles } from './validate-dos-files';
import { WINDOWS_AUDIO_FILES, WINDOWS_VOICE_FILES, validateWindowsMusicFile, validateWindowsVoiceFile, type WindowsVoiceFile } from './windows-voice-files';
import { readWindowsAudioIso } from './windows-iso';
export { REQUIRED_LEMMINGS_FILES } from './dos-file-names';
export { WINDOWS_AUDIO_FILES, WINDOWS_MUSIC_FILES, WINDOWS_SOUND_FILES, WINDOWS_VOICE_FILES } from './windows-voice-files';

const DATABASE_NAME = 'lemmings-game-files';
const STORE_NAME = 'original-lemmings';
// A deliberate removal must not be undone by automatic deployment imports.
const AUTO_IMPORT_DISABLED = '__automatic_import_disabled__';
const VOICE_AUTO_IMPORT_DISABLED = '__automatic_voice_import_disabled__';
const requiredNames = new Set(REQUIRED_LEMMINGS_FILES);
const voiceNames = new Set<string>(WINDOWS_AUDIO_FILES);
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
  await importFiles(files, false);
}

/** Import only if no data or explicit-removal marker exists, atomically across tabs. */
export async function importLemmingsFilesIfEmpty(files: FileList | readonly File[]): Promise<boolean> {
  return importFiles(files, true);
}

async function importFiles(files: FileList | readonly File[], onlyIfEmpty: boolean): Promise<boolean> {
  let selected = Array.from(files);
  const archives = selected.filter(file => file.name.toLowerCase().endsWith('.zip'));
  if (archives.length) {
    if (selected.length !== 1) throw new Error('Select one ZIP archive, or select the game files together.');
    const archive = archives[0];
    if (archive.size > MAX_ARCHIVE_BYTES) throw new Error('The ZIP archive is too large. Please select the original game files.');
    let extractedSize = 0;
    let validationError: Error | undefined;
    const archiveNames = new Set<string>();
    try {
      const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()), {
        filter: entry => {
          const name = entry.name.split(/[\\/]/).pop()?.toUpperCase() || '';
          if (!requiredNames.has(name)) return false;
          // ZIPs may contain the exact same path more than once. unzipSync's
          // result object keeps only the final entry, hiding that ambiguity
          // from the normal filename validation performed after extraction.
          if (archiveNames.has(name)) {
            validationError = new Error(`Duplicate files: ${name}`);
            throw validationError;
          }
          archiveNames.add(name);
          extractedSize += entry.originalSize;
          if (extractedSize > MAX_EXTRACTED_BYTES) {
            validationError = new Error('The game files in this ZIP archive are too large.');
            throw validationError;
          }
          return true;
        },
      });
      selected = Object.entries(entries).map(([path, data]) =>
        new File([Uint8Array.from(data)], path.split(/[\\/]/).pop() || path));
    } catch {
      if (validationError) throw validationError;
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
    let imported = !onlyIfEmpty;
    const write = () => {
      // Replacing the DOS set must not remove separately imported voice files.
      for (const name of REQUIRED_LEMMINGS_FILES) store.delete(name);
      store.delete(AUTO_IMPORT_DISABLED);
      for (const file of buffers) store.put(file.data, file.name);
      imported = true;
    };
    if (onlyIfEmpty) {
      // The count and writes run in one readwrite transaction, preventing a
      // delayed network fetch from overwriting a concurrent manual import.
      const count = store.count();
      count.onsuccess = () => { if (count.result === 0) write(); };
    } else write();
    await done;
    return imported;
  } finally {
    database.close();
  }
}

/** Whether an automatic import may begin; the final write checks again atomically. */
export async function canAutoImportLemmingsFiles(): Promise<boolean> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).count();
    return await new Promise<boolean>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result === 0);
      request.onerror = () => reject(new Error('Could not check local game files.'));
    });
  } finally { database.close(); }
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
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    store.put(true, AUTO_IMPORT_DISABLED);
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

/** Import the optional three Windows speech samples without replacing DOS data. */
export async function importWindowsVoiceFiles(files: FileList | readonly File[]): Promise<void> {
  await importVoiceFiles(files, false);
}

/** Add bundled speech to existing game files only if none was saved or deliberately removed. */
export async function importWindowsVoiceFilesIfMissing(files: FileList | readonly File[]): Promise<boolean> {
  return importVoiceFiles(files, true);
}

async function importVoiceFiles(files: FileList | readonly File[], onlyIfMissing: boolean): Promise<boolean> {
  let selected = Array.from(files);
  const discs = selected.filter(file => file.name.toLowerCase().endsWith('.iso'));
  if (discs.length) {
    if (selected.length !== 1) throw new Error('Select one ISO disc image, or select the audio files together.');
    selected = await readWindowsAudioIso(discs[0]);
  }
  const archives = selected.filter(file => file.name.toLowerCase().endsWith('.zip'));
  if (archives.length) {
    if (selected.length !== 1) throw new Error('Select one ZIP archive, or select the three voice files together.');
    if (archives[0].size > MAX_ARCHIVE_BYTES) throw new Error('The ZIP archive is too large.');
    let total = 0;
    let validationError: Error | undefined;
    const names = new Set<string>();
    try {
      const entries = unzipSync(new Uint8Array(await archives[0].arrayBuffer()), {
        filter: entry => {
          const name = entry.name.split(/[\\/]/).pop()?.toUpperCase() || '';
          if (!voiceNames.has(name)) return false;
          if (names.has(name)) {
            validationError = new Error(`Duplicate voice files: ${name}`);
            throw validationError;
          }
          names.add(name);
          total += entry.originalSize;
          if (total > MAX_EXTRACTED_BYTES) {
            validationError = new Error('The voice files in this ZIP archive are too large.');
            throw validationError;
          }
          return true;
        },
      });
      selected = Object.entries(entries).map(([path, data]) =>
        new File([Uint8Array.from(data)], path.split(/[\\/]/).pop() || path));
    } catch {
      if (validationError) throw validationError;
      throw new Error('Could not read this ZIP archive. Please use an unencrypted ZIP or select the voice files directly.');
    }
  }
  const selectedByName = new Map<string, File>();
  for (const file of selected) {
    const name = file.name.toUpperCase();
    if (!voiceNames.has(name)) continue;
    if (selectedByName.has(name)) throw new Error(`Duplicate voice files: ${name}`);
    selectedByName.set(name, file);
  }
  const missing = WINDOWS_VOICE_FILES.filter(name => !selectedByName.has(name));
  if (missing.length) throw new Error(`Missing voice files: ${missing.join(', ')}`);
  if (Array.from(selectedByName.values()).reduce((total, file) => total + file.size, 0) > MAX_EXTRACTED_BYTES) {
    throw new Error('The selected audio files are too large.');
  }
  const buffers = await Promise.all(Array.from(selectedByName, async ([name, file]) => {
    if (file.size > 1024 * 1024) throw new Error(`${name} is too large.`);
    const data = await file.arrayBuffer();
    if (name.endsWith('.MID')) validateWindowsMusicFile(name, data);
    else validateWindowsVoiceFile(name, data);
    return { name, data };
  }));
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE_NAME);
    let imported = false;
    let missingGame = false;
    const keys = store.getAllKeys();
    keys.onsuccess = () => {
      const saved = new Set(keys.result);
      if (!REQUIRED_LEMMINGS_FILES.every(name => saved.has(name))) {
        missingGame = true;
        return;
      }
      if (onlyIfMissing && (saved.has(VOICE_AUTO_IMPORT_DISABLED) || WINDOWS_AUDIO_FILES.some(name => saved.has(name)))) return;
      store.delete(VOICE_AUTO_IMPORT_DISABLED);
      for (const name of WINDOWS_AUDIO_FILES) store.delete(name);
      for (const file of buffers) store.put(file.data, file.name);
      imported = true;
    };
    await done;
    if (missingGame && !onlyIfMissing) throw new Error('Add the original DOS game files before adding voices.');
    return imported;
  } finally { database.close(); }
}

async function voiceKeys(): Promise<Set<IDBValidKey>> {
  const database = await openDatabase();
  try {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAllKeys();
    return await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(new Set(request.result));
      request.onerror = () => reject(new Error('Could not check local voice files.'));
    });
  } finally { database.close(); }
}

export async function hasWindowsVoiceFiles(): Promise<boolean> {
  const keys = await voiceKeys();
  return WINDOWS_VOICE_FILES.every(name => keys.has(name));
}

/** True only when the full Windows sound and MIDI set is available locally. */
export async function hasWindowsAudioFiles(): Promise<boolean> {
  const keys = await voiceKeys();
  return WINDOWS_AUDIO_FILES.every(name => keys.has(name));
}

/** Check before fetching a deployment bundle; the final write rechecks atomically. */
export async function canAutoImportWindowsVoiceFiles(): Promise<boolean> {
  const keys = await voiceKeys();
  return REQUIRED_LEMMINGS_FILES.every(name => keys.has(name)) && !keys.has(VOICE_AUTO_IMPORT_DISABLED) &&
    !WINDOWS_AUDIO_FILES.some(name => keys.has(name));
}

export async function clearWindowsVoiceFiles(): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE_NAME);
    for (const name of WINDOWS_AUDIO_FILES) store.delete(name);
    store.put(true, VOICE_AUTO_IMPORT_DISABLED);
    await done;
  } finally { database.close(); }
}

export async function getWindowsVoiceFile(filename: WindowsVoiceFile): Promise<ArrayBuffer | undefined> {
  return getWindowsAudioFile(filename);
}

/** Read an optional recognized Windows WAV or MIDI file from local storage. */
export async function getWindowsAudioFile(filename: string): Promise<ArrayBuffer | undefined> {
  const name = filename.toUpperCase();
  if (!voiceNames.has(name)) return undefined;
  return getLemmingsFile(name);
}

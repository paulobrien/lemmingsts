import { unzipSync } from 'fflate';
import { openGameDatabase, ORIGINAL_STORE, WINDOWS_GAME_STORE, WINDOWS_GRAPHICS_STORE, transactionDone } from './game-file-database';
import { prepareWindowsAudio, VOICE_AUTO_IMPORT_DISABLED } from './game-file-store';
import { prepareWindowsGame, REMOVED as GAME_REMOVED } from './windows-game-store';
import { prepareWindowsGraphics, REMOVED as GRAPHICS_REMOVED } from './windows-graphics-store';
import { WINDOWS_AUDIO_FILES } from './windows-voice-files';
import { WINDOWS_GAME_FILES } from './windows-game-names';
import { WINDOWS_GRAPHICS_ALL_FILES } from './windows-graphics-names';
import { readWindowsFilesIso } from './windows-iso';

const recognized = new Set([...WINDOWS_AUDIO_FILES, ...WINDOWS_GAME_FILES, ...WINDOWS_GRAPHICS_ALL_FILES]);
const MAX_ARCHIVE = 16 * 1024 * 1024;
const MAX_EXTRACTED = 8 * 1024 * 1024;
export interface WindowsImportResult { audio: boolean; graphics: boolean; game: boolean }

async function expandSelection(input: FileList | readonly File[]): Promise<{ files: File[]; disc: boolean }> {
  const files = Array.from(input);
  const archives = files.filter(file => /\.(iso|zip)$/i.test(file.name));
  if (!archives.length) return { files, disc: false };
  if (files.length !== 1) throw new Error('Select one Windows ISO or ZIP, or select the extracted files together.');
  const archive = archives[0];
  if (/\.iso$/i.test(archive.name)) return { files: await readWindowsFilesIso(archive), disc: true };
  if (archive.size > MAX_ARCHIVE) throw new Error('The Windows ZIP archive is too large.');
  const names = new Set<string>();
  let total = 0;
  let validationError: Error | undefined;
  try {
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()), { filter: entry => {
      const name = entry.name.split(/[\\/]/).pop()?.toUpperCase() ?? '';
      if (!recognized.has(name)) return false;
      if (names.has(name)) { validationError = new Error(`Duplicate Windows files: ${name}`); throw validationError; }
      names.add(name);
      total += entry.originalSize;
      if (total > MAX_EXTRACTED || entry.originalSize > 1024 * 1024) {
        validationError = new Error('The Windows files in this ZIP archive are too large.'); throw validationError;
      }
      return true;
    } });
    return { files: Object.entries(entries).map(([path, data]) => new File([Uint8Array.from(data)], path.split(/[\\/]/).pop()!)), disc: false };
  } catch { throw validationError ?? new Error('Could not read this Windows ZIP archive. Use an unencrypted ZIP or select the files directly.'); }
}

/** Read and validate every selected component before replacing any saved files. */
export async function importWindowsFiles(input: FileList | readonly File[]): Promise<WindowsImportResult> {
  const { files, disc } = await expandSelection(input);
  const names = new Set(files.map(file => file.name.toUpperCase()));
  const result = {
    audio: disc || WINDOWS_AUDIO_FILES.some(name => names.has(name)),
    graphics: disc || WINDOWS_GRAPHICS_ALL_FILES.some(name => names.has(name)),
    game: disc || WINDOWS_GAME_FILES.some(name => names.has(name)),
  };
  if (!result.audio && !result.graphics && !result.game) throw new Error('No supported Windows Lemmings files were found.');
  // Sequential validation bounds peak decode memory and cannot mutate storage.
  const audio = result.audio ? await prepareWindowsAudio(files) : undefined;
  const graphics = result.graphics ? await prepareWindowsGraphics(files) : undefined;
  const game = result.game ? await prepareWindowsGame(files) : undefined;
  const database = await openGameDatabase();
  try {
    const stores = [audio && ORIGINAL_STORE, graphics && WINDOWS_GRAPHICS_STORE, game && WINDOWS_GAME_STORE].filter((name): name is string => Boolean(name));
    const transaction = database.transaction(stores, 'readwrite');
    const done = transactionDone(transaction);
    try {
      if (audio) {
        const store = transaction.objectStore(ORIGINAL_STORE);
        for (const name of WINDOWS_AUDIO_FILES) store.delete(name);
        store.delete(VOICE_AUTO_IMPORT_DISABLED);
        for (const file of audio) store.put(file.data, file.name);
      }
      for (const [name, selection] of [[WINDOWS_GRAPHICS_STORE, graphics], [WINDOWS_GAME_STORE, game]] as const) {
        if (!selection) continue;
        const store = transaction.objectStore(name);
        store.clear();
        for (const file of selection) store.put(file.data, file.name);
      }
    } catch (error) {
      try { transaction.abort(); } catch { /* It may already have aborted. */ }
      await done.catch(() => undefined);
      throw error;
    }
    await done;
    return result;
  } finally { database.close(); }
}

/** Deliberate removal is atomic too and leaves DOS game data in place. */
export async function clearWindowsFiles(): Promise<void> {
  const database = await openGameDatabase();
  try {
    const transaction = database.transaction([ORIGINAL_STORE, WINDOWS_GRAPHICS_STORE, WINDOWS_GAME_STORE], 'readwrite');
    const done = transactionDone(transaction);
    const audio = transaction.objectStore(ORIGINAL_STORE);
    for (const name of WINDOWS_AUDIO_FILES) audio.delete(name);
    audio.put(true, VOICE_AUTO_IMPORT_DISABLED);
    const graphics = transaction.objectStore(WINDOWS_GRAPHICS_STORE); graphics.clear(); graphics.put(true, GRAPHICS_REMOVED);
    const game = transaction.objectStore(WINDOWS_GAME_STORE); game.clear(); game.put(true, GAME_REMOVED);
    await done;
  } finally { database.close(); }
}

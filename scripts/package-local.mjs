import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REQUIRED_LEMMINGS_FILES } from '../src/game/resources/file/dos-file-names.ts';
import { validateDosFiles } from '../src/game/resources/file/validate-dos-files.ts';

const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

/** Explicitly package the owner's validated game data into an existing build. */
export function packageLocalGame(sourceDirectory, buildDirectory) {
  if (!existsSync(sourceDirectory) || !lstatSync(sourceDirectory).isDirectory()) {
    throw new Error(`Game files directory not found or not a real directory: ${sourceDirectory}`);
  }
  if (!existsSync(buildDirectory) || !lstatSync(buildDirectory).isDirectory()) {
    throw new Error('Build directory is missing. Run the normal build first.');
  }
  const required = new Set(REQUIRED_LEMMINGS_FILES);
  const selected = new Map();
  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    const name = entry.name.toUpperCase();
    if (!required.has(name)) continue;
    if (!entry.isFile()) throw new Error(`${name} must be a regular file, not a symlink or directory.`);
    if (selected.has(name)) throw new Error(`Duplicate game file: ${name}`);
    selected.set(name, join(sourceDirectory, entry.name));
  }
  const missing = REQUIRED_LEMMINGS_FILES.filter(name => !selected.has(name));
  if (missing.length) throw new Error(`Missing game files: ${missing.join(', ')}`);
  let total = 0;
  for (const name of REQUIRED_LEMMINGS_FILES) {
    const size = lstatSync(selected.get(name)).size;
    if (!size) throw new Error(`Empty game file: ${name}`);
    total += size;
    if (total > MAX_TOTAL_BYTES) throw new Error('The game files exceed the 8 MiB import limit.');
  }
  // Validate everything in memory before creating any destination files.
  const files = REQUIRED_LEMMINGS_FILES.map(name => ({
    name, data: Uint8Array.from(readFileSync(selected.get(name))).buffer,
  }));
  validateDosFiles(files);
  const dataDirectory = join(buildDirectory, 'data');
  if (existsSync(dataDirectory) && !lstatSync(dataDirectory).isDirectory()) {
    throw new Error('The build data path must be a real directory.');
  }
  mkdirSync(dataDirectory, { recursive: true });
  const destination = join(dataDirectory, 'local-game');
  if (existsSync(destination)) throw new Error('A local game package already exists. Run the normal build first.');
  const temporary = mkdtempSync(join(dataDirectory, '.local-game-'));
  try {
    for (const file of files) writeFileSync(join(temporary, file.name.toLowerCase()), new Uint8Array(file.data));
    writeFileSync(join(temporary, 'manifest.json'), JSON.stringify({
      version: 1, files: REQUIRED_LEMMINGS_FILES.map(name => name.toLowerCase()),
    }, null, 2) + '\n');
    renameSync(temporary, destination);
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
  return destination;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const destination = packageLocalGame(resolve(process.env.LEMMINGS_DOS_DIR || 'dos/lemmings'), resolve('dist'));
    console.warn(`Game files were added to ${destination}. Anyone with access to this deployment can download them. Use an authenticated host if the files must remain private.`);
    const audioDirectory = resolve(process.env.LEMMINGS_WINDOWS_AUDIO_DIR || 'dos/windows-audio');
    if (process.env.LEMMINGS_WINDOWS_AUDIO_DIR || existsSync(audioDirectory)) {
      const { packageWindowsAudio } = await import('./package-windows-audio.mjs');
      const audio = packageWindowsAudio(audioDirectory, resolve('dist'));
      console.warn(`Windows audio was added to ${audio}. Anyone with access to this deployment can download it.`);
    }
    const windowsGameDirectory = resolve(process.env.LEMMINGS_WINDOWS_GAME_DIR || 'dos/windows-game');
    if (process.env.LEMMINGS_WINDOWS_GAME_DIR || existsSync(windowsGameDirectory)) {
      const { packageWindowsGame } = await import('./package-windows-game.mjs');
      const game = packageWindowsGame(windowsGameDirectory, resolve('dist'));
      console.warn(`Windows game data was added to ${game}. Anyone with access to this deployment can download it.`);
    }
    const graphicsDirectory = resolve(process.env.LEMMINGS_WINDOWS_GRAPHICS_DIR || 'dos/windows-graphics');
    if (process.env.LEMMINGS_WINDOWS_GRAPHICS_DIR || existsSync(graphicsDirectory)) {
      const { packageWindowsGraphics } = await import('./package-windows-graphics.mjs');
      const graphics = packageWindowsGraphics(graphicsDirectory, resolve('dist'));
      console.warn(`Windows graphics were added to ${graphics}. Anyone with access to this deployment can download them.`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

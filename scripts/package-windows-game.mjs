import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWindowsLevelDatabase } from '../src/game/resources/windows-level-database.ts';
import { WINDOWS_GAME_FILES, WINDOWS_GROUND_FILES, WINDOWS_LEVEL_FILES } from '../src/game/resources/file/windows-game-names.ts';

/** Explicitly package only the player's Windows level data. */
export function packageWindowsGame(source, build) {
  if (!existsSync(source) || !lstatSync(source).isDirectory() || !existsSync(build) || !lstatSync(build).isDirectory()) throw new Error('Windows game source and build must be real directories.');
  const entries = new Map();
  for (const folderName of ['LEVEL/ORIG', 'STYLES', 'USERS']) {
    const folder = join(source, folderName);
    if (!existsSync(folder)) continue;
    if (!lstatSync(folder).isDirectory()) throw new Error(`${folderName} must be a real directory.`);
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const name = entry.name.toUpperCase();
      if (!WINDOWS_GAME_FILES.includes(name)) continue;
      if (!entry.isFile() || entries.has(name)) throw new Error(`Invalid or duplicate Windows game file: ${name}`);
      entries.set(name, join(folder, entry.name));
    }
  }
  const missing = WINDOWS_GAME_FILES.filter(name => !entries.has(name));
  if (missing.length) throw new Error(`Missing Windows game files: ${missing.join(', ')}`);
  let total = 0;
  const files = WINDOWS_GAME_FILES.map(name => {
    const data = readFileSync(entries.get(name));
    if (!data.length || data.length > 1024 * 1024 || (total += data.length) > 8 * 1024 * 1024 ||
      (WINDOWS_LEVEL_FILES.includes(name) && data.length !== 2048) ||
      (WINDOWS_GROUND_FILES.includes(name) && data.length !== 1056) ||
      (name === 'LEMMINGS.DB' && (data.length < 145 || (data.length - 8) % 137))) throw new Error(`Invalid Windows game file: ${name}`);
    if (name === 'LEMMINGS.DB') parseWindowsLevelDatabase(data);
    return { name: name.toLowerCase(), data };
  });
  const dir = join(build, 'data');
  if (existsSync(dir) && !lstatSync(dir).isDirectory()) throw new Error('Build data must be a real directory.');
  mkdirSync(dir, { recursive: true });
  const destination = join(dir, 'local-windows-game');
  if (existsSync(destination)) throw new Error('A Windows game package already exists.');
  const temporary = mkdtempSync(join(dir, '.windows-game-'));
  try {
    for (const file of files) writeFileSync(join(temporary, file.name), file.data);
    writeFileSync(join(temporary, 'manifest.json'), JSON.stringify({ version: 1, files: files.map(file => file.name) }, null, 2) + '\n');
    renameSync(temporary, destination);
  } catch (error) { rmSync(temporary, { recursive: true, force: true }); throw error; }
  return destination;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { console.warn(`Windows game data was added to ${packageWindowsGame(resolve(process.env.LEMMINGS_WINDOWS_GAME_DIR || 'dos/windows-game'), resolve('dist'))}. Anyone with access to this deployment can download it.`); }
  catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}

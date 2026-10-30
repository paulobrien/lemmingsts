import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WINDOWS_GAME_FILES, WINDOWS_GROUND_FILES, WINDOWS_LEVEL_FILES } from '../src/game/resources/file/windows-game-names.ts';

/** Reject unsupported catalogue structures before packaging, without requiring a browser runtime. */
function validateDatabase(data) {
  const fail = () => { throw new Error('Invalid Windows level database.'); };
  if (data.length < 8 || (data.length - 8) % 137 !== 0) return fail();
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = view.getUint32(4, true);
  if (view.getUint32(0, true) !== 2 || count !== (data.length - 8) / 137 || count > 4096) return fail();
  const str = (start, length) => Buffer.from(data.subarray(start, start + length)).toString('latin1').split('\0')[0].trim();
  const names = ['Fun', 'Tricky', 'Taxing', 'Mayhem'];
  let original = false, groups = 0, levels = 0;
  for (let i = 0; i < count; i++) {
    const p = 8 + i * 137, depth = data[p + 2], folder = data[p + 3], name = str(p + 10, 32);
    if (folder === 1 && depth === 1) {
      if (original) break;
      if (str(p + 50, 32).toLowerCase() === 'orig') original = true;
      continue;
    }
    if (!original) continue;
    if (folder === 1 && depth === 2) {
      if ((groups && !levels) || name.replace(/\.+$/, '') !== names[groups++]) return fail();
      levels = 0; continue;
    }
    if (folder !== 0 || depth !== 3 || !groups || !name || !/^LVL00[0-9][0-7]\.LVL$/i.test(str(p + 50, 32)) || ++levels > 30) return fail();
    if (data[p + 124] && (data[p + 136] < 1 || data[p + 136] > 99 || !data[p + 135] || data[p + 134] > data[p + 135] || !data[p + 133] || data.subarray(p + 125, p + 133).some(value => value > 99))) return fail();
  }
  if (groups !== 4 || !levels) return fail();
}

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
    if (name === 'LEMMINGS.DB') validateDatabase(data);
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

import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WINDOWS_GRAPHICS_FILES } from '../src/game/resources/file/windows-graphics-names.ts';
import { decodeWindowsPalette, decodeWindowsSprites } from '../src/game/resources/windows-graphics.ts';

/** Package only the separately supplied, validated Windows graphics. */
export function packageWindowsGraphics(source, build) {
  if (!existsSync(source) || !lstatSync(source).isDirectory() || !existsSync(build) || !lstatSync(build).isDirectory()) throw new Error('Graphics source and build must be real directories.');
  const selected = new Map(), allowed = new Set(WINDOWS_GRAPHICS_FILES);
  for (const subdir of ['GFX', 'STYLES']) {
    const folder = join(source, subdir);
    if (!existsSync(folder)) continue;
    if (!lstatSync(folder).isDirectory()) throw new Error(`${subdir} must be a real directory.`);
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const name = entry.name.toUpperCase();
      if (!allowed.has(name)) continue;
      if (!entry.isFile() || selected.has(name)) throw new Error(`Invalid or duplicate graphics file: ${name}`);
      selected.set(name, join(folder, entry.name));
    }
  }
  const missing = WINDOWS_GRAPHICS_FILES.filter(name => !selected.has(name));
  if (missing.length) throw new Error(`Missing graphics files: ${missing.join(', ')}`);
  let total = 0;
  const files = [];
  for (const [name, path] of selected) {
    const size = lstatSync(path).size;
    if (!size || size > 1024 * 1024 || (total += size) > 8 * 1024 * 1024) throw new Error('Windows graphics exceed the size limit.');
    const data = Uint8Array.from(readFileSync(path));
    if (name.endsWith('.PAL')) decodeWindowsPalette(data); else decodeWindowsSprites(data);
    files.push({ name: name.toLowerCase(), data });
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  const directory = join(build, 'data');
  if (existsSync(directory) && !lstatSync(directory).isDirectory()) throw new Error('Build data must be a real directory.');
  mkdirSync(directory, { recursive: true });
  const destination = join(directory, 'local-windows-graphics');
  if (existsSync(destination)) throw new Error('A Windows graphics package already exists.');
  const temporary = mkdtempSync(join(directory, '.windows-graphics-'));
  try {
    for (const file of files) writeFileSync(join(temporary, file.name), file.data);
    writeFileSync(join(temporary, 'manifest.json'), JSON.stringify({ version: 1, files: files.map(file => file.name) }, null, 2) + '\n');
    renameSync(temporary, destination);
  } catch (error) { rmSync(temporary, { recursive: true, force: true }); throw error; }
  return destination;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const destination = packageWindowsGraphics(resolve(process.env.LEMMINGS_WINDOWS_GRAPHICS_DIR || 'dos/windows-graphics'), resolve('dist'));
    console.warn(`Windows graphics were added to ${destination}. Anyone with access to this deployment can download them.`);
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}

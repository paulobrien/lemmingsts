import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WINDOWS_AUDIO_FILES, WINDOWS_VOICE_FILES, validateWindowsMusicFile, validateWindowsVoiceFile } from '../src/game/resources/file/windows-voice-files.ts';

/** Package a separately supplied Windows audio directory; never include it in source. */
export function packageWindowsAudio(source, build) {
  if (!existsSync(source) || !lstatSync(source).isDirectory() || !existsSync(build) || !lstatSync(build).isDirectory()) throw new Error('Audio source and build must be real directories.');
  const selected = new Map();
  const allowed = new Set(WINDOWS_AUDIO_FILES);
  for (const subdir of ['SOUND', 'MUSIC']) {
    const folder = join(source, subdir);
    if (!existsSync(folder)) continue;
    if (!lstatSync(folder).isDirectory()) throw new Error(`${subdir} must be a real directory.`);
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const name = entry.name.toUpperCase();
      if (!allowed.has(name)) continue;
      if (!entry.isFile() || selected.has(name)) throw new Error(`Invalid or duplicate audio file: ${name}`);
      selected.set(name, join(folder, entry.name));
    }
  }
  const missing = WINDOWS_VOICE_FILES.filter(name => !selected.has(name));
  if (missing.length) throw new Error(`Missing voice files: ${missing.join(', ')}`);
  let total = 0;
  const files = [];
  for (const [name, path] of selected) {
    const size = lstatSync(path).size;
    if (!size || size > 1024 * 1024 || (total += size) > 8 * 1024 * 1024) throw new Error('Windows audio exceeds the size limit.');
    const data = Uint8Array.from(readFileSync(path));
    if (name.endsWith('.MID')) validateWindowsMusicFile(name, data.buffer);
    else validateWindowsVoiceFile(name, data.buffer);
    files.push({ name: name.toLowerCase(), data });
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  const directory = join(build, 'data');
  if (existsSync(directory) && !lstatSync(directory).isDirectory()) throw new Error('Build data must be a real directory.');
  mkdirSync(directory, { recursive: true });
  const destination = join(directory, 'local-windows-audio');
  if (existsSync(destination)) throw new Error('A Windows audio package already exists.');
  const temporary = mkdtempSync(join(directory, '.windows-audio-'));
  try {
    for (const file of files) writeFileSync(join(temporary, file.name), file.data);
    writeFileSync(join(temporary, 'manifest.json'), JSON.stringify({ version: 1, files: files.map(file => file.name) }, null, 2) + '\n');
    renameSync(temporary, destination);
  } catch (error) { rmSync(temporary, { recursive: true, force: true }); throw error; }
  return destination;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const destination = packageWindowsAudio(resolve(process.env.LEMMINGS_WINDOWS_AUDIO_DIR || 'dos/windows-audio'), resolve('dist'));
    console.warn(`Windows audio was added to ${destination}. Anyone with access to this deployment can download it.`);
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}

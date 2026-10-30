import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WINDOWS_AUDIO_FILES } from '../src/game/resources/file/windows-voice-files.ts';
import { WINDOWS_STANDALONE_GRAPHICS_FILES } from '../src/game/resources/file/windows-graphics-names.ts';
import { decodeWindowsSprites } from '../src/game/resources/windows-graphics.ts';
import { packageWindowsAudio } from './package-windows-audio.mjs';
import { packageWindowsGame } from './package-windows-game.mjs';
import { packageWindowsGraphics } from './package-windows-graphics.mjs';

/** Build all three independently supplied Windows bundles, without DOS files. */
export function packageStandaloneWindows({ gameDirectory, audioDirectory, graphicsDirectory, buildDirectory }) {
  if (!existsSync(buildDirectory) || !lstatSync(buildDirectory).isDirectory()) throw new Error('Build directory is missing. Run the normal build first.');
  const data = join(buildDirectory, 'data');
  if (existsSync(data) && !lstatSync(data).isDirectory()) throw new Error('Build data must be a real directory.');
  const names = ['local-windows-game', 'local-windows-audio', 'local-windows-graphics'];
  for (const name of names) if (existsSync(join(data, name))) throw new Error(`A ${name} package already exists. Run the normal build first.`);
  const temp = mkdtempSync(join(buildDirectory, '.windows-standalone-'));
  const published = [];
  try {
    const game = packageWindowsGame(gameDirectory, temp);
    const audio = packageWindowsAudio(audioDirectory, temp);
    const graphics = packageWindowsGraphics(graphicsDirectory, temp);
    const requireFiles = (dir, required, label) => {
      const files = new Set(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).files);
      const missing = required.filter(name => !files.has(name.toLowerCase()));
      if (missing.length) throw new Error(`Missing standalone Windows ${label}: ${missing.join(', ')}`);
    };
    requireFiles(audio, WINDOWS_AUDIO_FILES, 'audio files');
    requireFiles(graphics, WINDOWS_STANDALONE_GRAPHICS_FILES, 'graphics files');
    const frames = decodeWindowsSprites(readFileSync(join(graphics, 'lemmsma.spr')));
    for (const [start, end, width, height] of [[335, 335, 16, 22], [336, 347, 16, 16], [349, 353, 16, 8]]) {
      for (let i = start; i <= end; i++) {
        const sprite = frames[i];
        if (!sprite || sprite.width !== width || sprite.height !== height || !sprite.mask.some(Boolean)) throw new Error('Incomplete Windows gameplay masks.');
      }
    }
    mkdirSync(data, { recursive: true });
    for (const [source, name] of [[game, names[0]], [audio, names[1]], [graphics, names[2]]]) {
      const target = join(data, name);
      renameSync(source, target);
      published.push(target);
    }
    return published;
  } catch (error) {
    for (const path of published) rmSync(path, { recursive: true, force: true });
    throw error;
  } finally { rmSync(temp, { recursive: true, force: true }); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const result = packageStandaloneWindows({
      gameDirectory: resolve(process.env.LEMMINGS_WINDOWS_GAME_DIR || 'dos/windows-game'),
      audioDirectory: resolve(process.env.LEMMINGS_WINDOWS_AUDIO_DIR || 'dos/windows-audio'),
      graphicsDirectory: resolve(process.env.LEMMINGS_WINDOWS_GRAPHICS_DIR || 'dos/windows-graphics'),
      buildDirectory: resolve('dist'),
    });
    console.warn(`Windows game files were added to ${result.join(', ')}. Anyone with access to this deployment can download them.`);
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}

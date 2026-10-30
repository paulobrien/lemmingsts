// @vitest-environment node
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { WINDOWS_AUDIO_FILES } from '../../src/game/resources/file/windows-voice-files';
import { WINDOWS_GRAPHICS_ALL_FILES } from '../../src/game/resources/file/windows-graphics-names';

const options = vi.hoisted(() => ({ missingAudio: false, missingGraphics: false, badMasks: false, failGame: false }));
const makePackage = (build: string, name: string, files: readonly string[]) => {
  const dir = join(build, 'data', name); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ version: 1, files: files.map(file => file.toLowerCase()) }));
  return dir;
};
function sprites(): Uint8Array {
  // One opaque pixel in each synthetic frame; no original pixels are used.
  const count = 354, data = new Uint8Array(6 + count * 4 + count * 15), view = new DataView(data.buffer);
  data.set([0x53, 0x52, 0x4c, 0x45]); view.setUint16(4, count, true);
  for (let i = 0; i < count; i++) {
    const p = 6 + count * 4 + i * 15;
    view.setUint32(6 + i * 4, p, true); view.setUint16(p + 4, 1, true); view.setUint16(p + 6, 1, true);
    view.setUint16(p + 8, 16, true); view.setUint16(p + 10, i === 335 ? 22 : i >= 349 ? 8 : 16, true);
    data.set([0x81, 1, 0x80], p + 12);
  }
  return data;
}
vi.mock('../../scripts/package-windows-game.mjs', () => ({ packageWindowsGame: (_source: string, build: string) => {
  if (options.failGame) throw new Error('Bad game data');
  return makePackage(build, 'local-windows-game', ['LEMMINGS.DB']);
} }));
vi.mock('../../scripts/package-windows-audio.mjs', () => ({ packageWindowsAudio: (_source: string, build: string) =>
  makePackage(build, 'local-windows-audio', options.missingAudio ? WINDOWS_AUDIO_FILES.slice(1) : WINDOWS_AUDIO_FILES) }));
vi.mock('../../scripts/package-windows-graphics.mjs', () => ({ packageWindowsGraphics: (_source: string, build: string) => {
  const dir = makePackage(build, 'local-windows-graphics', options.missingGraphics ? WINDOWS_GRAPHICS_ALL_FILES.slice(1) : WINDOWS_GRAPHICS_ALL_FILES);
  writeFileSync(join(dir, 'lemmsma.spr'), options.badMasks ? new Uint8Array(4) : sprites());
  return dir;
} }));
// @ts-expect-error Build-only helper has no declaration file.
import { packageStandaloneWindows } from '../../scripts/package-windows-local.mjs';

let root = '';
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = ''; Object.assign(options, { missingAudio: false, missingGraphics: false, badMasks: false, failGame: false }); });
function context() {
  root = mkdtempSync(join(tmpdir(), 'lemmings-standalone-'));
  const buildDirectory = join(root, 'dist'); mkdirSync(buildDirectory);
  return { buildDirectory, gameDirectory: '/no-dos/game', audioDirectory: '/no-dos/audio', graphicsDirectory: '/no-dos/graphics' };
}
it('publishes all three complete Windows bundles without a DOS directory', () => {
  const input = context(); const result: string[] = packageStandaloneWindows(input);
  expect(result.map(dir => dir.split('/').pop())).toEqual(['local-windows-game', 'local-windows-audio', 'local-windows-graphics']);
  expect(existsSync(join(input.buildDirectory, 'data', 'local-game'))).toBe(false);
  expect(JSON.parse(readFileSync(join(result[1], 'manifest.json'), 'utf8')).files).toHaveLength(WINDOWS_AUDIO_FILES.length);
  expect(readdirSync(input.buildDirectory)).toEqual(['data']);
  expect(() => packageStandaloneWindows(input)).toThrow('already exists');
});
it.each(['missingAudio', 'missingGraphics', 'badMasks', 'failGame'] as const)('rejects %s without leaving partial game bundles', error => {
  const input = context(); options[error] = true;
  expect(() => packageStandaloneWindows(input)).toThrow();
  expect(readdirSync(input.buildDirectory)).toEqual([]);
});

// @vitest-environment node
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { WINDOWS_GAME_FILES, WINDOWS_GROUND_FILES, WINDOWS_LEVEL_FILES } from '../../src/game/resources/file/windows-game-names';
// @ts-expect-error Build-only helper has no declaration file.
import { packageWindowsGame } from '../../scripts/package-windows-game.mjs';

function makeSource(root: string) {
  const source = join(root, 'source'), build = join(root, 'dist');
  mkdirSync(join(source, 'LEVEL/ORIG'), { recursive: true });
  mkdirSync(join(source, 'STYLES')); mkdirSync(join(source, 'USERS')); mkdirSync(build);
  for (const name of WINDOWS_GAME_FILES) {
    const folder = WINDOWS_LEVEL_FILES.includes(name) ? 'LEVEL/ORIG' : WINDOWS_GROUND_FILES.includes(name) ? 'STYLES' : 'USERS';
    const size = WINDOWS_LEVEL_FILES.includes(name) ? 2048 : WINDOWS_GROUND_FILES.includes(name) ? 1056 : 145;
    writeFileSync(join(source, folder, name), new Uint8Array(size));
  }
  return { source, build };
}

it('packages only the complete set of Windows level files in a manifest', () => {
  const root = mkdtempSync(join(tmpdir(), 'lemmings-windows-game-'));
  try {
    const { source, build } = makeSource(root);
    writeFileSync(join(source, 'USERS', 'unrelated.txt'), 'not packaged');
    const dest = packageWindowsGame(source, build);
    expect(readdirSync(dest).sort()).toEqual([...WINDOWS_GAME_FILES.map(name => name.toLowerCase()), 'manifest.json'].sort());
    expect(JSON.parse(readFileSync(join(dest, 'manifest.json'), 'utf8'))).toEqual({ version: 1, files: WINDOWS_GAME_FILES.map(name => name.toLowerCase()) });
    expect(() => packageWindowsGame(source, build)).toThrow('already exists');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
it('rejects duplicate, missing and malformed input before publishing any bundle', () => {
  const root = mkdtempSync(join(tmpdir(), 'lemmings-windows-game-'));
  try {
    const { source, build } = makeSource(root);
    const first = WINDOWS_LEVEL_FILES[0];
    writeFileSync(join(source, 'USERS', first.toLowerCase()), new Uint8Array(2048));
    expect(() => packageWindowsGame(source, build)).toThrow('duplicate');
    rmSync(join(source, 'USERS', first.toLowerCase()));
    writeFileSync(join(source, 'LEVEL/ORIG', first), new Uint8Array(5));
    expect(() => packageWindowsGame(source, build)).toThrow('Invalid Windows game file');
    rmSync(join(source, 'LEVEL/ORIG', first));
    expect(() => packageWindowsGame(source, build)).toThrow('Missing Windows game files');
    expect(readdirSync(build)).toEqual([]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

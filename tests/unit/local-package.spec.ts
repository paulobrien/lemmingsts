// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REQUIRED_LEMMINGS_FILES } from '../../src/game/resources/file/dos-file-names';
import { syntheticDosData } from '../helpers/synthetic-dos';
// @ts-expect-error Build-only ESM helper has no declaration file.
import { packageLocalGame } from '../../scripts/package-local.mjs';

describe('private game package', () => {
  let root: string;
  let source: string;
  let build: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'lemmings-local-package-'));
    source = join(root, 'private');
    build = join(root, 'dist');
    mkdirSync(source); mkdirSync(build);
    REQUIRED_LEMMINGS_FILES.forEach((name, index) => writeFileSync(join(source, name.toLowerCase()), syntheticDosData(name, index + 1)));
    writeFileSync(join(source, 'not-a-game-file.txt'), 'excluded');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('packages only validated, canonical files and the fixed manifest', () => {
    const path = packageLocalGame(source, build);
    const expected = REQUIRED_LEMMINGS_FILES.map(name => name.toLowerCase());
    expect(JSON.parse(readFileSync(join(path, 'manifest.json'), 'utf8'))).toEqual({ version: 1, files: expected });
    expect(readdirSync(path).sort()).toEqual([...expected, 'manifest.json'].sort());
    expect(readFileSync(join(path, 'main.dat'))).toEqual(Buffer.from(syntheticDosData('MAIN.DAT', 2)));
  });

  it('fails closed for missing, duplicate, corrupt and symlinked inputs', () => {
    const output = join(build, 'data', 'local-game');
    rmSync(join(source, 'main.dat'));
    expect(() => packageLocalGame(source, build)).toThrow('Missing game files: MAIN.DAT');
    expect(existsSync(output)).toBe(false);
    writeFileSync(join(source, 'main.dat'), syntheticDosData('MAIN.DAT', 2));
    writeFileSync(join(source, 'MAIN.DAT'), syntheticDosData('MAIN.DAT', 2));
    expect(() => packageLocalGame(source, build)).toThrow('Duplicate game file: MAIN.DAT');
    rmSync(join(source, 'MAIN.DAT'));
    writeFileSync(join(source, 'main.dat'), 'broken');
    expect(() => packageLocalGame(source, build)).toThrow('MAIN.DAT is damaged or incompatible');
    expect(existsSync(output)).toBe(false);
    rmSync(join(source, 'main.dat'));
    symlinkSync(join(source, 'adlib.dat'), join(source, 'main.dat'));
    expect(() => packageLocalGame(source, build)).toThrow('must be a regular file');
    expect(existsSync(output)).toBe(false);
  });

  it('leaves an existing package untouched when a second package is requested', () => {
    const path = packageLocalGame(source, build);
    const before = readFileSync(join(path, 'main.dat'));
    expect(() => packageLocalGame(source, build)).toThrow('already exists');
    expect(readFileSync(join(path, 'main.dat'))).toEqual(before);
    expect(readdirSync(join(build, 'data'))).toEqual(['local-game']);
  });
});

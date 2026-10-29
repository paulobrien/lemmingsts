// @vitest-environment node
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import { REQUIRED_LEMMINGS_FILES } from '../../src/game/resources/file/dos-file-names';
import { syntheticDosData } from '../helpers/synthetic-dos';

function copyProject(project: string) {
  for (const path of ['src', 'scripts', 'tests', 'public', 'docu', '.gitignore', 'LICENSE', 'README.md', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'playwright.config.ts']) {
    cpSync(resolve(path), join(project, path), { recursive: true });
  }
  symlinkSync(resolve('node_modules'), join(project, 'node_modules'), 'dir');
}

it('only bundles data for the opt-in build and a normal build removes it', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'lemmings-local-build-'));
  const project = join(temporary, 'project');
  const privateFiles = join(temporary, 'private');
  mkdirSync(project); mkdirSync(privateFiles);
  try {
    copyProject(project);
    REQUIRED_LEMMINGS_FILES.forEach((name, index) => writeFileSync(join(privateFiles, name.toLowerCase()), syntheticDosData(name, index + 1)));
    const run = (script: string, directory = privateFiles) => spawnSync('npm', ['run', script], {
      cwd: project, env: { ...process.env, LEMMINGS_DOS_DIR: directory }, encoding: 'utf8', timeout: 60_000,
    });
    const local = run('build:local');
    expect(local.status, local.stderr).toBe(0);
    const packagePath = join(project, 'dist/data/local-game');
    expect(readdirSync(packagePath)).toHaveLength(REQUIRED_LEMMINGS_FILES.length + 1);
    const source = unzipSync(readFileSync(join(project, 'dist/source-code.zip')));
    expect(source['scripts/package-local.mjs']).toBeDefined();
    expect(Object.keys(source).some(name => /\.dat$/i.test(name) || name.startsWith('dos/') || name.startsWith('dist/'))).toBe(false);
    const normal = run('build');
    expect(normal.status, normal.stderr).toBe(0);
    expect(existsSync(packagePath)).toBe(false);
    const invalid = run('build:local', join(temporary, 'missing'));
    expect(invalid.status).not.toBe(0);
    expect(existsSync(packagePath)).toBe(false);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}, 60_000);

it.skipIf(process.env.RUN_PRIVATE_GAME_TESTS !== '1')('builds with the supplied DOS files, then clears them in a normal build', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'lemmings-private-build-'));
  const project = join(temporary, 'project');
  mkdirSync(project);
  try {
    copyProject(project);
    const run = (script: string) => spawnSync('npm', ['run', script], {
      cwd: project, env: { ...process.env, LEMMINGS_DOS_DIR: resolve('dos/lemmings') }, encoding: 'utf8', timeout: 60_000,
    });
    const local = run('build:local');
    expect(local.status, local.stderr).toBe(0);
    const packagePath = join(project, 'dist/data/local-game');
    expect(readdirSync(packagePath)).toHaveLength(REQUIRED_LEMMINGS_FILES.length + 1);
    const source = unzipSync(readFileSync(join(project, 'dist/source-code.zip')));
    expect(Object.keys(source).some(name => /\.dat$/i.test(name) || name.startsWith('dos/') || name.startsWith('dist/'))).toBe(false);
    const normal = run('build');
    expect(normal.status, normal.stderr).toBe(0);
    expect(existsSync(packagePath)).toBe(false);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}, 60_000);

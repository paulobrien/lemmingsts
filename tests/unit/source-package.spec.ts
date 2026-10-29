// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { unzipSync } from 'fflate';
import { expect, it } from 'vitest';
// The build helper is plain JavaScript so Node can run it without a loader.
// @ts-expect-error No separate declaration is needed for this build-only helper.
import { packageSource } from '../../scripts/package-source.mjs';

it('packages application source and notices without private game files', () => {
  const root = mkdtempSync(join(tmpdir(), 'lemmings-source-'));
  const files = [
    'LICENSE', 'README.md', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts',
    'scripts/verify-public-data.ts', 'scripts/package-source.mjs', 'docu/LICENCE_REVIEW.md',
    'public/sw.js', 'public/manifest.webmanifest', 'public/favicon.ico', 'public/data/config.json',
    'public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/third-party.html',
    'public/licenses/GPL-2.0.txt', 'public/licenses/LGPL-2.1.txt', 'src/main.ts', 'src/private.dat',
    'public/data/private.dat', 'dos/lemmings/LEVEL000.DAT',
    ...['vue', 'vue-router', 'fflate', '@vue/shared', '@vue/reactivity', '@vue/runtime-core', '@vue/runtime-dom']
      .map(name => `node_modules/${name}/LICENSE`),
  ];
  try {
    for (const file of files) {
      const path = join(root, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file);
    }
    packageSource(root, 'dist/source-code.zip');
    const archive = unzipSync(readFileSync(join(root, 'dist/source-code.zip')));
    expect(archive['src/main.ts']).toBeDefined();
    expect(archive['public/licenses/GPL-2.0.txt']).toBeDefined();
    expect(Object.keys(archive).some(name => /\.dat$/i.test(name) || name.startsWith('dos/'))).toBe(false);
    expect(readFileSync(join(root, 'dist/licenses/project-notice.txt'), 'utf8')).toBe('LICENSE');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

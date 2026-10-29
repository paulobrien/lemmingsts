import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

// Bundle the application's build inputs, never the owner's DOS files. Include
// only source-like files in src and the explicit public app-shell assets.
export function packageSource(root, output) {
  const entries = {};
  const add = path => { entries[path.split(sep).join('/')] = new Uint8Array(readFileSync(join(root, path))); };
  const visitSource = dir => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name.endsWith('.tmp.spec.ts')) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visitSource(path);
      else if (entry.isFile() && ['.ts', '.vue', '.css', '.svg', '.png', '.md'].includes(extname(entry.name))) add(path);
    }
  };
  visitSource('src');
  visitSource('tests');
  for (const path of [
    'LICENSE', 'README.md', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'playwright.config.ts',
    'scripts/verify-public-data.ts', 'scripts/package-source.mjs', 'docu/LICENCE_REVIEW.md', 'docu/ANDROID_DEVICE_CHECK.md',
    'public/sw.js', 'public/manifest.webmanifest', 'public/favicon.ico', 'public/data/config.json',
    'public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/third-party.html',
    'public/licenses/GPL-2.0.txt', 'public/licenses/LGPL-2.1.txt',
  ]) add(path);
  mkdirSync(join(root, 'dist/licenses'), { recursive: true });
  writeFileSync(join(root, output), zipSync(entries, { level: 9 }));
  const notices = ['vue', 'vue-router', 'fflate', '@vue/shared', '@vue/reactivity', '@vue/runtime-core', '@vue/runtime-dom']
    .map(name => `--- ${name} ---\n${readFileSync(join(root, 'node_modules', name, 'LICENSE'), 'utf8')}`)
    .join('\n\n');
  writeFileSync(join(root, 'dist/licenses/project-notice.txt'), readFileSync(join(root, 'LICENSE')));
  writeFileSync(join(root, 'dist/licenses/dependency-notices.txt'), notices);
  console.log(`Packaged ${Object.keys(entries).length} application source files in ${relative(root, join(root, output))}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  packageSource(process.cwd(), 'dist/source-code.zip');
}

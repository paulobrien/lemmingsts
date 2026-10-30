// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { importBundledWindowsGame } from '../../src/game/resources/file/bundled-windows-game-import';
import { clearWindowsGame, getWindowsGameFile, hasWindowsGame, importWindowsGame } from '../../src/game/resources/file/windows-game-store';
import { WINDOWS_GAME_FILES, WINDOWS_GROUND_FILES, WINDOWS_LEVEL_FILES } from '../../src/game/resources/file/windows-game-names';

const names = WINDOWS_GAME_FILES.map(name => name.toLowerCase());
const manifest = (files: unknown = names, version = 1) => new Response(JSON.stringify({ version, files }), { headers: { 'content-type': 'application/json' } });
function content(name: string, value = 1): Uint8Array<ArrayBuffer> {
  const upper = name.toUpperCase();
  if (upper === 'LEMMINGS.DB') {
    const bytes = new Uint8Array(8 + 9 * 137), view = new DataView(bytes.buffer);
    view.setUint32(0, 2, true); view.setUint32(4, 9, true);
    const record = (index: number, depth: number, folder: number, title: string, file = '') => {
      const pos = 8 + index * 137; bytes[pos + 2] = depth; bytes[pos + 3] = folder;
      bytes.set(new TextEncoder().encode(title), pos + 10); bytes.set(new TextEncoder().encode(file), pos + 50);
    };
    record(0, 1, 1, 'Original', 'orig');
    for (const [index, title] of ['Fun', 'Tricky', 'Taxing', 'Mayhem'].entries()) {
      record(index * 2 + 1, 2, 1, title); record(index * 2 + 2, 3, 0, `Test ${index}`, `LVL000${index}.LVL`);
    }
    return bytes;
  }
  const size = WINDOWS_LEVEL_FILES.includes(upper) ? 2048 : WINDOWS_GROUND_FILES.includes(upper) ? 1056 : 145;
  return new Uint8Array(size).fill(value);
}
const manualFiles = (value: number) => names.map(name => new File([content(name, value)], name));
const reset = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase('lemmings-game-files'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
});
beforeEach(async () => {
  await reset(); vi.unstubAllGlobals(); vi.stubGlobal('indexedDB', indexedDB);
  vi.stubGlobal('window', { location: new URL('https://example.test/app/') });
});

it('imports a fixed same-origin bundle into local storage', async () => {
  const fetcher = vi.fn(async (url: URL) => url.pathname.endsWith('/manifest.json') ? manifest() : new Response(content(url.pathname.split('/').pop()!)));
  vi.stubGlobal('fetch', fetcher);
  expect(await importBundledWindowsGame('/app/')).toBe('imported');
  expect(await hasWindowsGame()).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(names.length + 1);
  for (const [url, options] of fetcher.mock.calls as unknown as [URL, RequestInit][]) {
    expect(url.origin).toBe('https://example.test');
    expect(url.pathname).toMatch(/^\/app\/data\/local-windows-game\/(manifest\.json|[a-z0-9]+\.(lvl|dat|db))$/);
    expect(options).toMatchObject({ redirect: 'error', cache: 'no-store' });
  }
});
it('does not probe or overwrite manually imported data, or restore data after removal', async () => {
  await importWindowsGame(manualFiles(2));
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  expect(await importBundledWindowsGame('/app/')).toBe('existing');
  expect(new Uint8Array((await getWindowsGameFile(WINDOWS_LEVEL_FILES[0]))!)[0]).toBe(2);
  await clearWindowsGame();
  expect(await importBundledWindowsGame('/app/')).toBe('existing');
  expect(await hasWindowsGame()).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
});
it('preserves manual import or removal that occurs during a bundle download', async () => {
  for (const action of ['import', 'remove'] as const) {
    await reset(); let first = true;
    vi.stubGlobal('fetch', vi.fn(async (url: URL) => {
      if (url.pathname.endsWith('/manifest.json')) return manifest();
      if (first) { first = false; if (action === 'import') await importWindowsGame(manualFiles(3)); else await clearWindowsGame(); }
      return new Response(content(url.pathname.split('/').pop()!));
    }));
    expect(await importBundledWindowsGame('/app/')).toBe('existing');
    expect(await hasWindowsGame()).toBe(action === 'import');
    if (action === 'import') expect(new Uint8Array((await getWindowsGameFile(WINDOWS_LEVEL_FILES[0]))!)[0]).toBe(3);
  }
});
it('rejects duplicate, incomplete, malformed and unsafe manifests before fetching files', async () => {
  for (const files of [[...names, names[0]], names.slice(1), [...names.slice(1), '../private'], 'not an array']) {
    const fetcher = vi.fn(async () => manifest(files)); vi.stubGlobal('fetch', fetcher);
    await expect(importBundledWindowsGame('/app/')).rejects.toThrow('Invalid game data manifest');
    expect(fetcher).toHaveBeenCalledTimes(1); expect(await hasWindowsGame()).toBe(false);
  }
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{', { headers: { 'content-type': 'application/json' } })));
  await expect(importBundledWindowsGame('/app/')).rejects.toThrow();
  await expect(importBundledWindowsGame('https://outside.test/')).rejects.toThrow('Invalid game data bundle location');
});
it('rejects malformed files without leaving a partial game set', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: URL) => url.pathname.endsWith('/manifest.json') ? manifest() : new Response(Uint8Array.of(1))));
  await expect(importBundledWindowsGame('/app/')).rejects.toThrow('not a supported Windows Lemmings game file');
  expect(await hasWindowsGame()).toBe(false);
});
it('treats missing and HTML fallback manifests as absent', async () => {
  for (const reply of [() => new Response(null, { status: 404 }), () => new Response('<html>', { headers: { 'content-type': 'text/html' } })]) {
    vi.stubGlobal('fetch', vi.fn(reply)); expect(await importBundledWindowsGame('/app/')).toBe('absent');
  }
});

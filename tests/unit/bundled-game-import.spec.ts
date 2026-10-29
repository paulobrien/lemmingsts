// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { importBundledLemmingsFiles } from '../../src/game/resources/file/bundled-game-import';
import {
  clearLemmingsFiles, getLemmingsFile, hasLemmingsFiles, importLemmingsFiles, REQUIRED_LEMMINGS_FILES,
} from '../../src/game/resources/file/game-file-store';

// Store tests exercise the actual DOS parser with synthetic containers. Here,
// isolate the network/atomic-import contract and simulate corrupt input.
vi.mock('../../src/game/resources/file/validate-dos-files', () => ({
  validateDosFiles: (files: { data: ArrayBuffer }[]) => {
    if (files.some(file => new Uint8Array(file.data)[0] === 255)) throw new Error('Corrupt file');
  },
}));
vi.stubGlobal('indexedDB', indexedDB);
vi.stubGlobal('window', { location: new URL('https://example.test/app/') });

const names = REQUIRED_LEMMINGS_FILES.map(name => name.toLowerCase());
const manifest = () => new Response(JSON.stringify({ version: 1, files: names }), { headers: { 'content-type': 'application/json' } });
const data = (value = 1) => new Response(Uint8Array.of(value), { headers: { 'content-type': 'application/octet-stream' } });
const manualFiles = (value = 2) => names.map(name => new File([Uint8Array.of(value)], name));
const reset = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase('lemmings-game-files');
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

beforeEach(async () => { await reset(); vi.unstubAllGlobals(); vi.stubGlobal('indexedDB', indexedDB); vi.stubGlobal('window', { location: new URL('https://example.test/app/') }); });

describe('optional local deployment files', () => {
  it('fetches only fixed same-origin files and imports them atomically', async () => {
    const fetcher = vi.fn(async (url: URL) => url.pathname.endsWith('/manifest.json') ? manifest() : data());
    vi.stubGlobal('fetch', fetcher);
    expect(await importBundledLemmingsFiles('/app/')).toBe('imported');
    expect(await hasLemmingsFiles()).toBe(true);
    expect(new Uint8Array((await getLemmingsFile('MAIN.DAT'))!)).toEqual(Uint8Array.of(1));
    expect(fetcher).toHaveBeenCalledTimes(names.length + 1);
    for (const [url, options] of fetcher.mock.calls as unknown as [URL, RequestInit][]) {
      expect(url.origin).toBe('https://example.test');
      expect(url.pathname).toMatch(/^\/app\/data\/local-game\/(?:manifest\.json|[a-z0-9]+\.dat)$/);
      expect(options).toMatchObject({ mode: 'same-origin', redirect: 'error', cache: 'no-store' });
    }
  });

  it('does not probe or overwrite a manually imported set', async () => {
    await importLemmingsFiles(manualFiles());
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect(await importBundledLemmingsFiles('/app/')).toBe('existing');
    expect(fetcher).not.toHaveBeenCalled();
    expect(new Uint8Array((await getLemmingsFile('main.dat'))!)).toEqual(Uint8Array.of(2));
  });

  it('does not restore files that the player explicitly removed', async () => {
    await clearLemmingsFiles();
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect(await importBundledLemmingsFiles('/app/')).toBe('existing');
    expect(fetcher).not.toHaveBeenCalled();
    expect(await hasLemmingsFiles()).toBe(false);
  });

  it('does not overwrite a manual import completed during the download', async () => {
    let first = true;
    vi.stubGlobal('fetch', vi.fn(async (url: URL) => {
      if (url.pathname.endsWith('/manifest.json')) return manifest();
      if (first) { first = false; await importLemmingsFiles(manualFiles(3)); }
      return data();
    }));
    expect(await importBundledLemmingsFiles('/app/')).toBe('existing');
    expect(new Uint8Array((await getLemmingsFile('main.dat'))!)).toEqual(Uint8Array.of(3));
  });

  it('respects removal requested while a bundle download is in progress', async () => {
    let first = true;
    vi.stubGlobal('fetch', vi.fn(async (url: URL) => {
      if (url.pathname.endsWith('/manifest.json')) return manifest();
      if (first) { first = false; await clearLemmingsFiles(); }
      return data();
    }));
    expect(await importBundledLemmingsFiles('/app/')).toBe('existing');
    expect(await hasLemmingsFiles()).toBe(false);
    expect(await getLemmingsFile('main.dat')).toBeUndefined();
  });

  it('leaves the store empty on an invalid or damaged package', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: URL) => url.pathname.endsWith('/manifest.json') ? manifest() : data(url.pathname.endsWith('/main.dat') ? 255 : 1)));
    await expect(importBundledLemmingsFiles('/app/')).rejects.toThrow('could not be validated or saved');
    expect(await hasLemmingsFiles()).toBe(false);
  });

  it('ignores unavailable manifests and SPA HTML fallbacks', async () => {
    for (const reply of [() => new Response(null, { status: 404 }), () => new Response('<html>', { headers: { 'content-type': 'text/html' } }), () => { throw new Error('offline'); }]) {
      vi.stubGlobal('fetch', vi.fn(reply));
      expect(await importBundledLemmingsFiles('/app/')).toBe('absent');
    }
  });

  it('abandons a stalled manifest request so setup can fall back to manual import', async () => {
    let expire: (() => void) | undefined;
    const timer = vi.spyOn(globalThis, 'setTimeout').mockImplementation((handler) => {
      expire = handler as () => void;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    });
    const fetcher = vi.fn((_url: URL, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    vi.stubGlobal('fetch', fetcher);
    const result = importBundledLemmingsFiles('/app/');
    // Allow the IndexedDB eligibility check to finish before expiring the fetch.
    while (!expire) await new Promise(resolve => setImmediate(resolve));
    expire();
    expect(await result).toBe('absent');
    expect(await hasLemmingsFiles()).toBe(false);
    timer.mockRestore();
  });

  it('rejects malformed manifests and cross-origin bases without following their paths', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ version: 1, files: ['https://outside.test/private'] }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(importBundledLemmingsFiles('/app/')).rejects.toThrow('could not be validated or saved');
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(importBundledLemmingsFiles('https://outside.test/')).rejects.toThrow('Please add your original game files manually');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized and SPA-fallback file responses without saving anything', async () => {
    for (const bad of [() => new Response('html', { headers: { 'content-type': 'text/html' } }), () => new Response('x', { headers: { 'content-length': '9000000' } })]) {
      vi.stubGlobal('fetch', vi.fn(async (url: URL) => url.pathname.endsWith('/manifest.json') ? manifest() : bad()));
      await expect(importBundledLemmingsFiles('/app/')).rejects.toThrow('could not be validated or saved');
      expect(await hasLemmingsFiles()).toBe(false);
    }
  });
});

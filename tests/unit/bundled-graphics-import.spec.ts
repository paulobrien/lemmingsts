// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ can: vi.fn(async () => true), save: vi.fn(async (_files: File[]) => true) }));
vi.mock('../../src/game/resources/file/windows-graphics-store', () => ({
  canAutoImportWindowsGraphics: mocks.can, canAutoImportWindowsUiGraphics: vi.fn(async () => false), importWindowsGraphicsIfMissing: mocks.save,
}));
vi.mock('../../src/game/resources/file/windows-graphics-names', () => ({ WINDOWS_GRAPHICS_FILES: ['LEMMBIG.SPR', 'FE.PAL'], WINDOWS_GRAPHICS_ALL_FILES: ['LEMMBIG.SPR', 'FE.PAL', 'ICO_CLIM.SPR'] }));
import { importBundledWindowsGraphics } from '../../src/game/resources/file/bundled-graphics-import';
const names = ['lemmbig.spr', 'fe.pal'];
const manifest = (files: unknown[] = names) => new Response(JSON.stringify({version: 1, files}), {headers: {'content-type': 'application/json'}});
beforeEach(() => { mocks.can.mockReset().mockResolvedValue(true); mocks.save.mockReset().mockResolvedValue(true); vi.stubGlobal('window', {location: new URL('https://example.test/app/')}); });
it('imports a fixed same-origin bundle and passes only its audio to the atomic store', async () => {
 const fetcher = vi.fn(async (url: URL) => url.pathname.endsWith('manifest.json') ? manifest() : new Response(Uint8Array.of(1)));
 vi.stubGlobal('fetch', fetcher);
 expect(await importBundledWindowsGraphics('/app/')).toBe('imported');
 expect(mocks.save.mock.calls[0][0].map(f => f.name)).toEqual(names);
 for (const [url, options] of fetcher.mock.calls as unknown as [URL, RequestInit][]) {
  expect(url.origin).toBe('https://example.test');
  expect(url.pathname).toMatch(/^\/app\/data\/local-windows-graphics\/(manifest\.json|[a-z0-9]+\.(spr|pal))$/);
  expect(options).toMatchObject({redirect: 'error', cache: 'no-store'});
 }
});
it('does not fetch when existing audio was saved or removed deliberately', async () => {
 mocks.can.mockResolvedValue(false); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
 expect(await importBundledWindowsGraphics('/app/')).toBe('existing'); expect(fetcher).not.toHaveBeenCalled();
});
it('rejects untrusted manifest filenames and missing graphics', async () => {
 for (const files of [[...names, '../secret'], names.slice(1), [...names, 'lemmbig.spr']]) {
  vi.stubGlobal('fetch', vi.fn(async () => manifest(files)));
  await expect(importBundledWindowsGraphics('/app/')).rejects.toThrow('Invalid graphics manifest');
 }
 expect(mocks.save).not.toHaveBeenCalled();
});
it('treats missing or HTML SPA fallback as no optional bundle', async () => {
 vi.stubGlobal('fetch', vi.fn(async () => new Response('<html/>', {headers: {'content-type': 'text/html'}})));
 expect(await importBundledWindowsGraphics('/app/')).toBe('absent');
});

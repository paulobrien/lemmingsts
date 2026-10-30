// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { downloadWindowsBundleFiles } from '../../src/game/resources/file/bundled-windows-download';

afterEach(() => vi.unstubAllGlobals());
it('enforces the total download limit across concurrent files', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(3))));
  await expect(downloadWindowsBundleFiles(['a', 'b'], new URL('https://example.test/'), {}, 5)).rejects.toThrow('too large');
});

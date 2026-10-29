import { canAutoImportLemmingsFiles, importLemmingsFilesIfEmpty, REQUIRED_LEMMINGS_FILES } from './game-file-store';

const MAX_MANIFEST_BYTES = 16 * 1024;
const MAX_FILES_BYTES = 8 * 1024 * 1024;

/** Read a bounded response, even when the server supplies no Content-Length. */
async function readBounded(response: Response, limit: number): Promise<Uint8Array> {
  const size = response.headers.get('content-length');
  if (size && (!/^\d+$/.test(size) || Number(size) > limit)) throw new Error('Bundled game files are too large.');
  if (!response.body) throw new Error('Bundled game file response is empty.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) throw new Error('Bundled game files are too large.');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

/**
 * Optionally import the deployment's supplied DOS files into an empty local store.
 * Fixed filenames and same-origin, redirect-free requests prevent a manifest from
 * causing cross-origin requests. Failure never replaces any stored files.
 */
export async function importBundledLemmingsFiles(baseUrl = import.meta.env.BASE_URL): Promise<'imported' | 'existing' | 'absent'> {
  if (!await canAutoImportLemmingsFiles()) return 'existing';
  const base = new URL(baseUrl, window.location.href);
  if (base.origin !== window.location.origin || base.username || base.password || base.search || base.hash || !base.pathname.endsWith('/')) {
    throw new Error('Could not check bundled game files. Please add your original game files manually.');
  }
  const directory = new URL('data/local-game/', base);
  const controller = new AbortController();
  // A stalled host must not leave the home screen indefinitely in setup.
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const options: RequestInit = { mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal };
  try {
    let manifestResponse: Response;
    try { manifestResponse = await fetch(new URL('manifest.json', directory), options); }
    catch { return 'absent'; }
    const manifestType = (manifestResponse.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    // Missing paths on SPA hosts commonly return the HTML shell with status 200.
    if (manifestResponse.status === 404 || manifestType === 'text/html') return 'absent';
    if (!manifestResponse.ok || manifestType !== 'application/json') throw new Error('Bundled game file manifest is unavailable or invalid. Please add your game files manually.');
    try {
      const manifest = JSON.parse(new TextDecoder().decode(await readBounded(manifestResponse, MAX_MANIFEST_BYTES)));
      const expected = REQUIRED_LEMMINGS_FILES.map(name => name.toLowerCase());
      if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.files) ||
          manifest.files.length !== expected.length || new Set(manifest.files).size !== expected.length ||
          manifest.files.some((name: unknown) => typeof name !== 'string' || !expected.includes(name))) {
        throw new Error('Invalid manifest');
      }
      let remaining = MAX_FILES_BYTES;
      const files: File[] = [];
      // Construct paths ourselves, never use arbitrary manifest URLs or paths.
      for (const name of expected) {
        const response = await fetch(new URL(name, directory), options);
        const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (!response.ok || contentType === 'text/html' || contentType === 'application/json') throw new Error('Invalid file response');
        const bytes = await readBounded(response, remaining);
        remaining -= bytes.length;
        files.push(new File([Uint8Array.from(bytes)], name));
      }
      return await importLemmingsFilesIfEmpty(files) ? 'imported' : 'existing';
    } catch {
      throw new Error('Bundled game files could not be validated or saved. Your existing files were not changed; please add your game files manually.');
    }
  } finally { clearTimeout(timeout); }
}

import { downloadWindowsBundleFiles } from './bundled-windows-download';
import { canAutoImportWindowsVoiceFiles, importWindowsVoiceFilesIfMissing, WINDOWS_AUDIO_FILES, WINDOWS_VOICE_FILES } from './game-file-store';

const MAX_TOTAL = 8 * 1024 * 1024;

async function readBounded(response: Response, limit: number): Promise<Uint8Array> {
  const length = response.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) throw new Error('Audio bundle is too large.');
  if (!response.body) throw new Error('Audio bundle response is empty.');
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error('Audio bundle is too large.');
      parts.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

/** Discover optional deployment-supplied audio without replacing the player's files. */
export async function importBundledWindowsVoices(baseUrl = import.meta.env.BASE_URL): Promise<'imported' | 'existing' | 'absent'> {
  if (!await canAutoImportWindowsVoiceFiles()) return 'existing';
  const base = new URL(baseUrl, window.location.href);
  if (base.origin !== window.location.origin || base.username || base.password || base.search || base.hash || !base.pathname.endsWith('/')) throw new Error('Invalid audio bundle location.');
  const directory = new URL('data/local-windows-audio/', base);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  const options: RequestInit = { mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal };
  try {
    let response: Response;
    response = await fetch(new URL('manifest.json', directory), options);
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (response.status === 404 || contentType === 'text/html') return 'absent';
    if (!response.ok || contentType !== 'application/json') throw new Error('Invalid audio manifest.');
    const manifest = JSON.parse(new TextDecoder().decode(await readBounded(response, 16 * 1024)));
    const allowed = new Set(WINDOWS_AUDIO_FILES.map(name => name.toLowerCase()));
    if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.files) || manifest.files.length > allowed.size ||
        new Set(manifest.files).size !== manifest.files.length || manifest.files.some((name: unknown) => typeof name !== 'string' || !allowed.has(name)) ||
        WINDOWS_VOICE_FILES.some(name => !manifest.files.includes(name.toLowerCase()))) throw new Error('Invalid audio manifest.');
    const files = await downloadWindowsBundleFiles(manifest.files as string[], directory, options, MAX_TOTAL);
    return await importWindowsVoiceFilesIfMissing(files) ? 'imported' : 'existing';
  } finally { clearTimeout(timeout); controller.abort(); }
}

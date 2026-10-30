import { canAutoImportWindowsGraphics, canAutoImportWindowsUiGraphics, importWindowsGraphicsIfMissing } from './windows-graphics-store';
import { WINDOWS_GRAPHICS_ALL_FILES, WINDOWS_GRAPHICS_FILES } from './windows-graphics-names';

const MAX_TOTAL = 8 * 1024 * 1024;

async function readBounded(response: Response, limit: number): Promise<Uint8Array> {
  const length = response.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) throw new Error('Graphics bundle is too large.');
  if (!response.body) throw new Error('Graphics bundle response is empty.');
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error('Graphics bundle is too large.');
      parts.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

/** Discover optional deployment-supplied graphics without replacing the player's files. */
export async function importBundledWindowsGraphics(baseUrl = import.meta.env.BASE_URL): Promise<'imported' | 'existing' | 'absent'> {
  if (!await canAutoImportWindowsGraphics() && !await canAutoImportWindowsUiGraphics()) return 'existing';
  const base = new URL(baseUrl, window.location.href);
  if (base.origin !== window.location.origin || base.username || base.password || base.search || base.hash || !base.pathname.endsWith('/')) throw new Error('Invalid graphics bundle location.');
  const directory = new URL('data/local-windows-graphics/', base);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const options: RequestInit = { mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal };
  try {
    let response: Response;
    try { response = await fetch(new URL('manifest.json', directory), options); } catch { return 'absent'; }
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (response.status === 404 || contentType === 'text/html') return 'absent';
    if (!response.ok || contentType !== 'application/json') throw new Error('Invalid graphics manifest.');
    const manifest = JSON.parse(new TextDecoder().decode(await readBounded(response, 16 * 1024)));
    const allowed = new Set(WINDOWS_GRAPHICS_ALL_FILES.map(name => name.toLowerCase()));
    if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.files) || manifest.files.length > allowed.size ||
        new Set(manifest.files).size !== manifest.files.length || manifest.files.some((name: unknown) => typeof name !== 'string' || !allowed.has(name)) ||
        WINDOWS_GRAPHICS_FILES.some(name => !manifest.files.includes(name.toLowerCase()))) throw new Error('Invalid graphics manifest.');
    const files: File[] = [];
    let remaining = MAX_TOTAL;
    for (const name of manifest.files as string[]) {
      const data = await fetch(new URL(name, directory), options);
      const type = (data.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!data.ok || type === 'text/html' || type === 'application/json') throw new Error('Invalid graphics file response.');
      const bytes = await readBounded(data, Math.min(remaining, 1024 * 1024));
      remaining -= bytes.length;
      files.push(new File([Uint8Array.from(bytes)], name));
    }
    return await importWindowsGraphicsIfMissing(files) ? 'imported' : 'existing';
  } finally { clearTimeout(timeout); }
}

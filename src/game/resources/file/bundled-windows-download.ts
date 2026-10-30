/** Fetch a small, fixed list of bundle files with bounded concurrency and size. */
export async function downloadWindowsBundleFiles(
  names: readonly string[], directory: URL, options: RequestInit, maxTotal: number,
): Promise<File[]> {
  const result = new Array<File>(names.length);
  let next = 0;
  let total = 0;
  const worker = async () => {
    while (true) {
      const index = next++;
      if (index >= names.length) return;
      const name = names[index];
      const response = await fetch(new URL(name, directory), options);
      const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!response.ok || type === 'text/html' || type === 'application/json' || !response.body) throw new Error('Invalid Windows bundle file response.');
      const length = response.headers.get('content-length');
      if (length && (!/^\d+$/.test(length) || Number(length) > 1024 * 1024)) throw new Error('Windows bundle file is too large.');
      const reader = response.body.getReader();
      const parts: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          total += value.length;
          if (size > 1024 * 1024 || total > maxTotal) throw new Error('Windows bundle is too large.');
          parts.push(value);
        }
      } catch (error) { await reader.cancel().catch(() => {}); throw error; }
      finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const part of parts) { bytes.set(part, offset); offset += part.length; }
      result[index] = new File([bytes], name);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, names.length) }, worker));
  return result;
}

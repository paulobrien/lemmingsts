import { getLemmingsFile } from '../resources/file/game-file-store';

/** Files that affect the authored DOS levels, graphics and physics masks. */
export const HINT_DATA_FILES = [
  'MAIN.DAT', 'ODDTABLE.DAT',
  ...Array.from({ length: 10 }, (_, i) => `LEVEL${String(i).padStart(3, '0')}.DAT`),
  ...Array.from({ length: 5 }, (_, i) => `GROUND${i}O.DAT`),
  ...Array.from({ length: 5 }, (_, i) => `VGAGR${i}.DAT`),
  ...Array.from({ length: 4 }, (_, i) => `VGASPEC${i}.DAT`),
].sort();

// Digest of the local DOS data used to verify the authored solutions. This is
// a one-way fingerprint, not a copy of the original game files or graphics.
const TESTED_DATA_SHA256 = 'c7f870a3a7877d8ef7676ecf9949293729d7894f4905f6482e6670162b08808f';
export type HintCompatibility = 'verified' | 'different' | 'unavailable';

/** Compare only on this device; no file contents or digest are sent anywhere. */
export async function verifyHintData(
  readFile: (name: string) => Promise<ArrayBuffer | undefined> = getLemmingsFile,
  subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle,
): Promise<HintCompatibility> {
  if (!subtle) return 'unavailable';
  try {
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];
    let total = 0;
    for (const name of HINT_DATA_FILES) {
      const file = await readFile(name);
      if (!file) return 'unavailable';
      const nameBytes = encoder.encode(`${name}\0`);
      const length = new Uint8Array(4);
      new DataView(length.buffer).setUint32(0, file.byteLength, false);
      const bytes = new Uint8Array(file);
      parts.push(nameBytes, length, bytes);
      total += nameBytes.length + length.length + bytes.length;
    }
    const input = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) { input.set(part, offset); offset += part.length; }
    const hash = new Uint8Array(await subtle.digest('SHA-256', input));
    const fingerprint = Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('');
    return fingerprint === TESTED_DATA_SHA256 ? 'verified' : 'different';
  } catch {
    return 'unavailable';
  }
}

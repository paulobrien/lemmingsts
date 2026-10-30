import { getLemmingsFile } from '../resources/file/game-file-store';
import { getWindowsGameFile } from '../resources/file/windows-game-store';
import { getWindowsGraphicsFile } from '../resources/file/windows-graphics-store';
import { WINDOWS_GAME_FILES } from '../resources/file/windows-game-names';
import { WINDOWS_GAME_GRAPHICS_FILES, WINDOWS_GRAPHICS_FILES } from '../resources/file/windows-graphics-names';

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

/** Windows files consumed by level loading, simulation and the visible examples.
 * High-resolution art is included because hints describe what the player sees,
 * even though low-resolution art and masks determine gameplay physics. Audio
 * and toolbar icons are intentionally excluded as they do not affect solutions.
 */
export const WINDOWS_HINT_GAME_FILES = [...WINDOWS_GAME_FILES].sort();
export const WINDOWS_HINT_GRAPHICS_FILES = [...WINDOWS_GRAPHICS_FILES, ...WINDOWS_GAME_GRAPHICS_FILES].sort();
const TESTED_WINDOWS_DATA_SHA256 = '90c8947dcd8a1c1732aab6e9ec43d62e81e4d0f8f635d5ab480ca6060b1d9cde';

/** Check the verified Windows-disc resources locally; files and hashes never leave the browser. */
export async function verifyWindowsHintData(
  readGame: (name: string) => Promise<ArrayBuffer | undefined> = getWindowsGameFile,
  readGraphics: (name: string) => Promise<ArrayBuffer | undefined> = getWindowsGraphicsFile,
  subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle,
): Promise<HintCompatibility> {
  if (!subtle) return 'unavailable';
  try {
    const encoder = new TextEncoder();
    const entries = [
      ...WINDOWS_HINT_GAME_FILES.map(name => ({ key: `GAME/${name}`, name, read: readGame })),
      ...WINDOWS_HINT_GRAPHICS_FILES.map(name => ({ key: `GRAPHICS/${name}`, name, read: readGraphics })),
    ].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    const parts: Uint8Array[] = [];
    let total = 0;
    for (const entry of entries) {
      const file = await entry.read(entry.name);
      if (!file || file.byteLength > 0xffffffff) return 'unavailable';
      const name = encoder.encode(`${entry.key}\0`);
      const length = new Uint8Array(4);
      new DataView(length.buffer).setUint32(0, file.byteLength, false);
      const bytes = new Uint8Array(file);
      parts.push(name, length, bytes);
      total += name.length + length.length + bytes.length;
    }
    const input = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) { input.set(part, offset); offset += part.length; }
    const digest = new Uint8Array(await subtle.digest('SHA-256', input));
    const fingerprint = Array.from(digest, value => value.toString(16).padStart(2, '0')).join('');
    return fingerprint === TESTED_WINDOWS_DATA_SHA256 ? 'verified' : 'different';
  } catch {
    return 'unavailable';
  }
}

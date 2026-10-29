// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { zipSync } from 'fflate';
import {
  clearLemmingsFiles,
  getLemmingsFile,
  hasLemmingsFiles,
  importLemmingsFiles,
  REQUIRED_LEMMINGS_FILES,
  validateLemmingsFiles,
} from '../../src/game/resources/file/game-file-store';
import { FileProvider } from '../../src/game/resources/file/file-provider';

vi.stubGlobal('indexedDB', indexedDB);

// Invented, non-game data with a valid DOS chunk structure and compressed
// stream. This protects validation without bundling proprietary assets.
function chunk(length: number, value: number): Uint8Array {
  const bits: number[] = [];
  const push = (number: number, width: number) => {
    for (let bit = width - 1; bit >= 0; bit--) bits.push((number >> bit) & 1);
  };
  push(0, 2); push(0, 3); push(value, 8); // one literal
  for (let left = length - 1; left > 0;) {
    const count = Math.min(left, 256);
    push(0b110, 3); push(count - 1, 8); push(0, 12); // repeat preceding byte
    left -= count;
  }
  const first = bits.length % 8 || 8;
  const groups: number[] = [];
  for (let index = 0, width = first; index < bits.length; width = 8) {
    let byte = 0;
    for (let bit = 0; bit < width; bit++) byte |= bits[index++] << bit;
    groups.push(byte);
  }
  const payload = Uint8Array.from(groups.reverse());
  const size = payload.length + 10;
  const checksum = payload.reduce((a, b) => a ^ b, 0);
  return Uint8Array.from([first, checksum, 0, 0, length >> 8, length & 255, 0, 0, size >> 8, size & 255, ...payload]);
}

function sampleData(name: string, value: number): Uint8Array {
  if (name.startsWith('GROUND')) return new Uint8Array(1056);
  if (name === 'ODDTABLE.DAT') return new Uint8Array(80 * 56);
  const lengths = name === 'MAIN.DAT' ? [21104, 388, 6560, 38024, 1, 1, 8224]
    : name === 'ADLIB.DAT' ? [22025]
    : name.startsWith('LEVEL') ? Array(8).fill(2048)
    : name.startsWith('VGAGR') ? [1, 1] : [40];
  const parts = lengths.map(length => chunk(length, value));
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function sampleFiles(): File[] {
  return REQUIRED_LEMMINGS_FILES.map((name, index) => new File([Uint8Array.from(sampleData(name, index + 1))], name.toLowerCase()));
}

describe('original game file import', () => {
  beforeEach(async () => {
    await clearLemmingsFiles();
  });

  it('accepts case-insensitive DOS names and stores only the required files', async () => {
    const files = [...sampleFiles(), new File(['extra'], 'readme.txt')];
    expect(validateLemmingsFiles(files)).toEqual({ missing: [], empty: [], duplicates: [] });
    await importLemmingsFiles(files);
    expect(await hasLemmingsFiles()).toBe(true);
    expect(new Uint8Array((await getLemmingsFile('main.dat'))!)).toEqual(sampleData('MAIN.DAT', 2));
    expect(await getLemmingsFile('readme.txt')).toBeUndefined();
    const binary = await new FileProvider('/data').loadBinary('lemmings', 'MAIN.DAT');
    expect(binary.readByte()).toBe(sampleData('MAIN.DAT', 2)[0]);
  });

  it('rejects missing, empty and duplicate files without replacing an existing import', async () => {
    await importLemmingsFiles(sampleFiles());
    const files = sampleFiles().filter((file) => file.name !== 'main.dat');
    files.push(new File([], 'adlib.dat'));
    const validation = validateLemmingsFiles(files);
    expect(validation.missing).toContain('MAIN.DAT');
    expect(validation.empty).toContain('ADLIB.DAT');
    expect(validation.duplicates).toContain('ADLIB.DAT');
    await expect(importLemmingsFiles(files)).rejects.toThrow('Missing files: MAIN.DAT');
    expect(await hasLemmingsFiles()).toBe(true);
    expect(new Uint8Array((await getLemmingsFile('MAIN.DAT'))!)).toEqual(sampleData('MAIN.DAT', 2));
  });

  it('removes the data and reports a useful error when a game file is missing', async () => {
    await importLemmingsFiles(sampleFiles());
    await clearLemmingsFiles();
    expect(await hasLemmingsFiles()).toBe(false);
    await expect(new FileProvider('/data').loadBinary('lemmings', 'MAIN.DAT')).rejects.toThrow('Import the original DOS Lemmings files');
  });

  it('rejects other editions rather than fetching their assets over the network', async () => {
    await expect(new FileProvider('/data').loadBinary('lemmings_ohNo', 'MAIN.DAT')).rejects.toThrow('Only original DOS Lemmings');
  });

  it('imports the required files from a ZIP containing a nested DOS folder', async () => {
    const archive = zipSync(Object.fromEntries(REQUIRED_LEMMINGS_FILES.map((name, index) =>
      [`lemmings/${name.toLowerCase()}`, sampleData(name, index + 1)])));
    await importLemmingsFiles([new File([archive], 'Lemmings.ZIP')]);
    expect(await hasLemmingsFiles()).toBe(true);
    expect(new Uint8Array((await getLemmingsFile('main.dat'))!)).toEqual(sampleData('MAIN.DAT', 2));
  });

  it('rejects corrupt and incomplete ZIPs without replacing a valid import', async () => {
    await importLemmingsFiles(sampleFiles());
    await expect(importLemmingsFiles([new File(['not a zip'], 'game.zip')])).rejects.toThrow('Could not read this ZIP');
    const incomplete = zipSync({ 'folder/main.dat': new Uint8Array([9]) });
    await expect(importLemmingsFiles([new File([incomplete], 'game.zip')])).rejects.toThrow('Missing files:');
    expect(new Uint8Array((await getLemmingsFile('main.dat'))!)).toEqual(sampleData('MAIN.DAT', 2));
  });

  it('rejects incompatible or corrupt files before replacing an existing import', async () => {
    await importLemmingsFiles(sampleFiles());
    const replace = (name: string, data: Uint8Array) => sampleFiles().map(file =>
      file.name === name.toLowerCase() ? new File([Uint8Array.from(data)], file.name) : file);
    await expect(importLemmingsFiles(replace('GROUND0O.DAT', new Uint8Array(1)))).rejects.toThrow('GROUND0O.DAT is damaged or incompatible');
    await expect(importLemmingsFiles(replace('ODDTABLE.DAT', new Uint8Array(56)))).rejects.toThrow('ODDTABLE.DAT is damaged or incompatible');
    const damaged = sampleData('LEVEL000.DAT', 9);
    damaged[10] ^= 1;
    await expect(importLemmingsFiles(replace('LEVEL000.DAT', damaged))).rejects.toThrow('LEVEL000.DAT is damaged or incompatible');
    const brokenStream = sampleData('MAIN.DAT', 2);
    const firstChunkSize = (brokenStream[8] << 8) | brokenStream[9];
    brokenStream.fill(0, 10, firstChunkSize);
    brokenStream[1] = 0; // valid checksum, but an incomplete compressed stream
    await expect(importLemmingsFiles(replace('MAIN.DAT', brokenStream))).rejects.toThrow('MAIN.DAT is damaged or incompatible');
    await expect(importLemmingsFiles(replace('MAIN.DAT', new Uint8Array(8 * 1024 * 1024 + 1)))).rejects.toThrow('selected game files are too large');
    expect(new Uint8Array((await getLemmingsFile('MAIN.DAT'))!)).toEqual(sampleData('MAIN.DAT', 2));
  });

  it('rejects ambiguous duplicate filenames in an archive', async () => {
    const entries = Object.fromEntries(REQUIRED_LEMMINGS_FILES.map(name => [`game/${name}`, new Uint8Array([1])]));
    entries['other/main.dat'] = new Uint8Array([2]);
    await expect(importLemmingsFiles([new File([zipSync(entries)], 'game.zip')])).rejects.toThrow('Duplicate files: MAIN.DAT');
  });
});

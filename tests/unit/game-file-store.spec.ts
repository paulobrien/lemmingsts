// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
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

function sampleFiles(): File[] {
  return REQUIRED_LEMMINGS_FILES.map((name, index) =>
    new File([new Uint8Array([index + 1])], name.toLowerCase()),
  );
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
    expect(Array.from(new Uint8Array((await getLemmingsFile('main.dat'))!))).toEqual([2]);
    expect(await getLemmingsFile('readme.txt')).toBeUndefined();
    const binary = await new FileProvider('/data').loadBinary('lemmings', 'MAIN.DAT');
    expect(binary.readByte()).toBe(2);
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
    expect(Array.from(new Uint8Array((await getLemmingsFile('MAIN.DAT'))!))).toEqual([2]);
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
});

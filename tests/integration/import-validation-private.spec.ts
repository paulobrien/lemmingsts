// @vitest-environment node
// Uses the owner's ignored files locally; no game data is included in Git.
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { indexedDB } from 'fake-indexeddb';
import { expect, it, vi } from 'vitest';
import { clearLemmingsFiles, getLemmingsFile, importLemmingsFiles } from '../../src/game/resources/file/game-file-store';

it.skipIf(process.env.RUN_PRIVATE_GAME_TESTS !== '1')('preserves a real import when a replacement is corrupt', async () => {
  vi.stubGlobal('indexedDB', indexedDB);
  const directory = resolve('dos/lemmings');
  const names = await readdir(directory);
  const files = await Promise.all(names.map(async name => new File([Uint8Array.from(await readFile(resolve(directory, name)))], name)));
  try {
    await importLemmingsFiles(files);
    const original = Buffer.from((await getLemmingsFile('MAIN.DAT'))!);
    const damaged = Uint8Array.from(original);
    damaged[10] ^= 1;
    const replacement = files.map(file => file.name.toUpperCase() === 'MAIN.DAT' ? new File([damaged], file.name) : file);
    await expect(importLemmingsFiles(replacement)).rejects.toThrow('MAIN.DAT is damaged or incompatible');
    const retained = Buffer.from((await getLemmingsFile('MAIN.DAT'))!);
    // Compare privately without printing proprietary bytes if the test fails.
    expect(Buffer.compare(retained, original)).toBe(0);
  } finally {
    await clearLemmingsFiles();
    vi.unstubAllGlobals();
  }
});

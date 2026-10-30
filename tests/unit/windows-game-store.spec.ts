// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { WINDOWS_GAME_FILES, WINDOWS_GROUND_FILES, WINDOWS_LEVEL_FILES } from '../../src/game/resources/file/windows-game-names';
import { canAutoImportWindowsGame, clearWindowsGame, getWindowsGameFile, hasWindowsGame, importWindowsGame, importWindowsGameIfMissing } from '../../src/game/resources/file/windows-game-store';

const database = () => {
  const data = new Uint8Array(8 + 9 * 137);
  const view = new DataView(data.buffer); view.setUint32(0, 2, true); view.setUint32(4, 9, true);
  const record = (i: number, depth: number, folder: number, name: string, file = '') => {
    const start = 8 + i * 137; data[start + 2] = depth; data[start + 3] = folder;
    data.set(new TextEncoder().encode(name), start + 10); data.set(new TextEncoder().encode(file), start + 50);
  };
  record(0, 1, 1, 'Original', 'orig');
  ['Fun', 'Tricky', 'Taxing', 'Mayhem'].forEach((name, i) => {
    record(1 + 2 * i, 2, 1, name); record(2 + 2 * i, 3, 0, name, `LVL000${i}.LVL`);
  });
  return data;
};
const files = (marker = 1) => WINDOWS_GAME_FILES.map(name => {
  const size = WINDOWS_LEVEL_FILES.includes(name) ? 2048 : WINDOWS_GROUND_FILES.includes(name) ? 1056 : 145;
  return new File([name === 'LEMMINGS.DB' ? database() : new Uint8Array(size).fill(marker)], name);
});

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('lemmings-windows-game');
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
});

describe('Windows game storage', () => {
  it('stores a complete Windows game independently of DOS', async () => {
    await importWindowsGame(files());
    expect(await hasWindowsGame()).toBe(true);
    expect(new Uint8Array((await getWindowsGameFile('lvl0000.lvl'))!)[0]).toBe(1);
    expect(await getWindowsGameFile('MAIN.DAT')).toBeUndefined();
  });
  it('preserves existing data after a missing or malformed replacement', async () => {
    await importWindowsGame(files());
    await expect(importWindowsGame(files(2).slice(1))).rejects.toThrow('Missing Windows game files');
    const malformed = files(2); malformed[0] = new File(['bad'], WINDOWS_LEVEL_FILES[0]);
    await expect(importWindowsGame(malformed)).rejects.toThrow('not a supported');
    expect(new Uint8Array((await getWindowsGameFile(WINDOWS_LEVEL_FILES[0]))!)[0]).toBe(1);
  });
  it('rejects duplicate recognized paths in a ZIP before replacing data', async () => {
    await importWindowsGame(files());
    const archive = zipSync({ 'one/LVL0000.LVL': new Uint8Array(2048), 'two/LVL0000.LVL': new Uint8Array(2048) });
    await expect(importWindowsGame([new File([archive], 'game.zip')])).rejects.toThrow('Duplicate Windows game files');
    expect(await hasWindowsGame()).toBe(true);
  });
  it('does not automatically overwrite or restore deliberately removed files', async () => {
    expect(await importWindowsGameIfMissing(files())).toBe(true);
    expect(await importWindowsGameIfMissing(files(2))).toBe(false);
    await clearWindowsGame();
    expect(await hasWindowsGame()).toBe(false);
    expect(await canAutoImportWindowsGame()).toBe(false);
    expect(await importWindowsGameIfMissing(files(2))).toBe(false);
    await importWindowsGame(files(2));
    expect(new Uint8Array((await getWindowsGameFile(WINDOWS_LEVEL_FILES[0]))!)[0]).toBe(2);
  });
});

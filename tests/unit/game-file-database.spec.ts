// @vitest-environment node
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_DATABASE, ORIGINAL_STORE, WINDOWS_GAME_STORE, openGameDatabase, transactionDone } from '../../src/game/resources/file/game-file-database';
import { getLemmingsFile, getWindowsAudioFile } from '../../src/game/resources/file/game-file-store';
import { canAutoImportWindowsGraphics, getWindowsGraphicsFile } from '../../src/game/resources/file/windows-graphics-store';
import { canAutoImportWindowsGame, getWindowsGameFile } from '../../src/game/resources/file/windows-game-store';
import { clearWindowsFiles, importWindowsFiles } from '../../src/game/resources/file/windows-file-import';
import { windowsFiles } from '../helpers/synthetic-windows';

beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function seed(name: string, storeName: string, entries: [string, unknown][]): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  try {
    const transaction = database.transaction(storeName, 'readwrite');
    const done = transactionDone(transaction);
    for (const [key, value] of entries) transaction.objectStore(storeName).put(value, key);
    await done;
  } finally { database.close(); }
}
async function seedLegacy() {
  await seed(GAME_DATABASE, ORIGINAL_STORE, [['MAIN.DAT', new Uint8Array([11]).buffer], ['LETSGO.WAV', new Uint8Array([22]).buffer]]);
  await seed('lemmings-windows-graphics', 'graphics', [['LEMMBIG.SPR', new Uint8Array([33]).buffer]]);
  await seed('lemmings-windows-game', 'files', [['LVL0000.LVL', new Uint8Array([44]).buffer]]);
}

describe('unified game database migration', () => {
  it('upgrades existing installs without losing DOS/audio, then removes redundant legacy copies', async () => {
    await seedLegacy();
    expect(await getLemmingsFile('MAIN.DAT')).toEqual(new Uint8Array([11]).buffer);
    expect(await getWindowsAudioFile('LETSGO.WAV')).toEqual(new Uint8Array([22]).buffer);
    expect(await getWindowsGraphicsFile('LEMMBIG.SPR')).toEqual(new Uint8Array([33]).buffer);
    expect(await getWindowsGameFile('LVL0000.LVL')).toEqual(new Uint8Array([44]).buffer);
    await vi.waitFor(async () => expect((await indexedDB.databases()).map(database => database.name)).toEqual([GAME_DATABASE]));
  });
  it('retains legacy files if migration aborts and retries successfully on the next open', async () => {
    await seedLegacy();
    const put = IDBObjectStore.prototype.put;
    const failure = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = put.call(this, value, key);
      if (this.name === WINDOWS_GAME_STORE) request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(openGameDatabase()).rejects.toThrow();
    expect((await indexedDB.databases()).map(database => database.name)).toContain('lemmings-windows-game');
    expect((await indexedDB.databases()).map(database => database.name)).toContain('lemmings-windows-graphics');
    failure.mockRestore();
    expect(await getWindowsGraphicsFile('LEMMBIG.SPR')).toEqual(new Uint8Array([33]).buffer);
    expect(await getWindowsGameFile('LVL0000.LVL')).toEqual(new Uint8Array([44]).buffer);
  });
  it('preserves deliberate removal markers from previous installs', async () => {
    await seed('lemmings-windows-graphics', 'graphics', [['__automatic_graphics_import_disabled__', true]]);
    await seed('lemmings-windows-game', 'files', [['__automatic_game_import_disabled__', true]]);
    expect(await canAutoImportWindowsGraphics()).toBe(false);
    expect(await canAutoImportWindowsGame()).toBe(false);
  });
  it('never restores old data after unified files are deliberately removed', async () => {
    await seedLegacy();
    await clearWindowsFiles();
    // Even an old browser tab writing its old database cannot repopulate the new one.
    await seed('lemmings-windows-game', 'files', [['LVL0000.LVL', new Uint8Array([99]).buffer]]);
    expect(await getWindowsGameFile('LVL0000.LVL')).toBeUndefined();
    expect(await getWindowsGraphicsFile('LEMMBIG.SPR')).toBeUndefined();
    expect(await getWindowsAudioFile('LETSGO.WAV')).toBeUndefined();
    expect(await getLemmingsFile('MAIN.DAT')).toEqual(new Uint8Array([11]).buffer);
  });
  it('serializes migration from concurrent callers before a manual replacement', async () => {
    await seedLegacy();
    await Promise.all([getWindowsGraphicsFile('LEMMBIG.SPR'), getWindowsGameFile('LVL0000.LVL'), importWindowsFiles(windowsFiles(8))]);
    expect(new Uint8Array((await getWindowsGameFile('LVL0000.LVL'))!)[0]).toBe(8);
    expect(new Uint8Array((await getWindowsAudioFile('LETSGO.WAV'))!)[44]).toBe(8);
  });
  it('reports an old tab blocking the upgrade and can retry after it closes', async () => {
    await seedLegacy();
    const oldTab = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(GAME_DATABASE, 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await expect(getWindowsGameFile('LVL0000.LVL')).rejects.toThrow('another tab');
    oldTab.close();
    expect(await getWindowsGameFile('LVL0000.LVL')).toEqual(new Uint8Array([44]).buffer);
  });
});

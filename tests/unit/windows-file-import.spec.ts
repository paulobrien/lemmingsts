// @vitest-environment node
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zipSync } from 'fflate';
import { clearWindowsFiles, importWindowsFiles } from '../../src/game/resources/file/windows-file-import';
import { clearLemmingsFiles, hasLemmingsFiles, getLemmingsFile, getWindowsAudioFile, importLemmingsFiles, importWindowsVoiceFilesIfMissing, REQUIRED_LEMMINGS_FILES } from '../../src/game/resources/file/game-file-store';
import { getWindowsGraphicsFile, importWindowsGraphicsIfMissing } from '../../src/game/resources/file/windows-graphics-store';
import { getWindowsGameFile, importWindowsGameIfMissing } from '../../src/game/resources/file/windows-game-store';
import { WINDOWS_GAME_STORE, WINDOWS_GRAPHICS_STORE } from '../../src/game/resources/file/game-file-database';
import { windowsAudioFiles, windowsFiles, windowsGameFiles, windowsGraphicsFiles, windowsSprite, windowsWav } from '../helpers/synthetic-windows';
import { syntheticDosData } from '../helpers/synthetic-dos';

beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function expectVersion(marker: number) {
  expect(await getWindowsAudioFile('LETSGO.WAV')).toEqual(windowsWav(marker).buffer);
  expect(await getWindowsGraphicsFile('LEMMBIG.SPR')).toEqual(windowsSprite(marker).buffer);
  expect(new Uint8Array((await getWindowsGameFile('LVL0000.LVL'))!)[0]).toBe(marker);
}

describe('atomic Windows import', () => {
  it('replaces all selected components together while preserving DOS data', async () => {
    await importLemmingsFiles(REQUIRED_LEMMINGS_FILES.map((name, index) => new File([Uint8Array.from(syntheticDosData(name, index + 1))], name)));
    const ground = await getLemmingsFile('GROUND0O.DAT');
    await importWindowsFiles(windowsFiles(1));
    await importWindowsFiles(windowsFiles(2));
    await expectVersion(2);
    expect(await getLemmingsFile('GROUND0O.DAT')).toEqual(ground);
  });
  it('keeps every Windows component when DOS files are removed', async () => {
    await importLemmingsFiles(REQUIRED_LEMMINGS_FILES.map((name, index) => new File([Uint8Array.from(syntheticDosData(name, index + 1))], name)));
    await importWindowsFiles(windowsFiles(1));
    await clearLemmingsFiles();
    expect(await hasLemmingsFiles()).toBe(false);
    await expectVersion(1);
  });
  it.each(['graphics', 'game', 'read'])('preserves every previous component when %s validation fails', async kind => {
    await importWindowsFiles(windowsFiles(1));
    let replacement = windowsFiles(2);
    if (kind === 'graphics') replacement = replacement.filter(file => file.name !== 'LEMMBIG.SPR');
    else if (kind === 'game') replacement[replacement.findIndex(file => file.name === 'LVL0000.LVL')] = new File(['bad'], 'LVL0000.LVL');
    else vi.spyOn(replacement.find(file => file.name === 'LEMMINGS.DB')!, 'arrayBuffer').mockRejectedValue(new Error('Read failed'));
    await expect(importWindowsFiles(replacement)).rejects.toThrow();
    await expectVersion(1);
  });
  it('rolls back all components when storage aborts after writes have begun', async () => {
    await importWindowsFiles(windowsFiles(1));
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = put.call(this, value, key);
      if (this.name === WINDOWS_GAME_STORE && key === 'LVL0000.LVL') request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(importWindowsFiles(windowsFiles(2))).rejects.toThrow();
    await expectVersion(1);
  });
  it('also aborts queued writes after a synchronous storage exception', async () => {
    await importWindowsFiles(windowsFiles(1));
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === WINDOWS_GRAPHICS_STORE) throw new Error('Storage failed');
      return put.call(this, value, key);
    });
    await expect(importWindowsFiles(windowsFiles(2))).rejects.toThrow('Storage failed');
    await expectVersion(1);
  });
  it('validates every component in a ZIP and never treats damaged graphics as audio-only', async () => {
    await importWindowsFiles(windowsFiles(1));
    const contents = Object.fromEntries(await Promise.all(windowsFiles(2).map(async file => [`nested/${file.name}`, new Uint8Array(await file.arrayBuffer())])));
    contents['nested/LEMMBIG.SPR'] = new Uint8Array([1]);
    await expect(importWindowsFiles([new File([zipSync(contents)], 'replacement.zip')])).rejects.toThrow('LEMMBIG.SPR');
    await expectVersion(1);
  });
  it.each(['LEMMSMA.SPR', 'TIM1P.MID', 'ICO_PAWS.SPR'])(
    'rejects an incomplete combined installation missing %s without replacing old files', async name => {
      await importWindowsFiles(windowsFiles(1));
      await expect(importWindowsFiles(windowsFiles(2).filter(file => file.name !== name))).rejects.toThrow(name);
      await expectVersion(1);
    },
  );
  it('rejects well-framed but incompatible gameplay masks before replacing anything', async () => {
    await importWindowsFiles(windowsFiles(1));
    const files = windowsFiles(2).map(file => file.name === 'LEMMSMA.SPR' ? new File([windowsSprite(2)], file.name) : file);
    await expect(importWindowsFiles(files)).rejects.toThrow('compatible Windows gameplay masks');
    await expectVersion(1);
  });
  it('allows intentional audio-only and graphics-only selections without replacing other components', async () => {
    await importWindowsFiles(windowsFiles(1));
    expect(await importWindowsFiles(windowsAudioFiles(2))).toEqual({ audio: true, graphics: false, game: false });
    expect(await getWindowsGraphicsFile('LEMMBIG.SPR')).toEqual(windowsSprite(1).buffer);
    expect(await importWindowsFiles(windowsGraphicsFiles(3))).toEqual({ audio: false, graphics: true, game: false });
    expect(await getWindowsAudioFile('LETSGO.WAV')).toEqual(windowsWav(2).buffer);
    expect(new Uint8Array((await getWindowsGameFile('LVL0000.LVL'))!)[0]).toBe(1);
  });
  it('preserves manual files when automatic writes race a coordinated replacement', async () => {
    await Promise.all([
      importWindowsVoiceFilesIfMissing(windowsAudioFiles(1)),
      importWindowsGraphicsIfMissing(windowsGraphicsFiles(1)),
      importWindowsGameIfMissing(windowsGameFiles(1)),
      importWindowsFiles(windowsFiles(2)),
    ]);
    await expectVersion(2);
  });
  it('removes all Windows files atomically and blocks delayed automatic restoration', async () => {
    await importWindowsFiles(windowsFiles(1));
    await clearWindowsFiles();
    expect(await getWindowsAudioFile('LETSGO.WAV')).toBeUndefined();
    expect(await getWindowsGraphicsFile('LEMMBIG.SPR')).toBeUndefined();
    expect(await getWindowsGameFile('LVL0000.LVL')).toBeUndefined();
    expect(await importWindowsVoiceFilesIfMissing(windowsAudioFiles(2))).toBe(false);
    expect(await importWindowsGraphicsIfMissing(windowsGraphicsFiles(2))).toBe(false);
    expect(await importWindowsGameIfMissing(windowsGameFiles(2))).toBe(false);
  });
});

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { zipSync } from 'fflate';
import { WINDOWS_GRAPHICS_FILES, WINDOWS_UI_GRAPHICS_FILES, WINDOWS_GAME_GRAPHICS_FILES } from '../../src/game/resources/file/windows-graphics-names';
import { canAutoImportWindowsGraphics, canAutoImportWindowsUiGraphics, clearWindowsGraphics, getWindowsGraphicsFile, hasWindowsGraphics,
  importWindowsGraphics, importWindowsGraphicsIfMissing } from '../../src/game/resources/file/windows-graphics-store';

vi.stubGlobal('indexedDB', indexedDB);

const sprite = () => Uint8Array.from([
  0x53, 0x52, 0x4c, 0x45, 1, 0, 10, 0, 0, 0,
  0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0x81, 8, 0x80,
]);
const palette = () => Uint8Array.from([0x20, 0x4c, 0x41, 0x50, 1, 0, 1, 2, 3, 0]);
const data = (name: string) => name.endsWith('.PAL') ? palette() : sprite();
const files = () => WINDOWS_GRAPHICS_FILES.map(name => new File([data(name)], name.toLowerCase()));

describe('optional Windows graphics storage', () => {
  beforeEach(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('lemmings-windows-graphics');
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    });
  });
  it('stores and retrieves a validated complete set, ignoring unrelated files', async () => {
    expect(await canAutoImportWindowsGraphics()).toBe(true);
    await importWindowsGraphics([...files(), new File(['ignored'], 'unrelated.txt')]);
    expect(await hasWindowsGraphics()).toBe(true);
    expect(await getWindowsGraphicsFile('lemmbig.spr')).toEqual(sprite().buffer);
    expect(await getWindowsGraphicsFile('unrelated.txt')).toBeUndefined();
  });
  it('rejects incomplete and corrupt imports without replacing existing graphics', async () => {
    await importWindowsGraphics(files());
    await expect(importWindowsGraphics(files().slice(1))).rejects.toThrow('Missing graphics files');
    const broken = files(); broken[0] = new File(['bad'], 'lemmbig.spr');
    await expect(importWindowsGraphics(broken)).rejects.toThrow('LEMMBIG.SPR is not a supported');
    expect(await getWindowsGraphicsFile('LEMMBIG.SPR')).toEqual(sprite().buffer);
  });
  it('reads nested ZIP files and rejects duplicate names', async () => {
    const contents = Object.fromEntries(WINDOWS_GRAPHICS_FILES.map(name => [`LEMMINGS/STYLES/${name}`, data(name)]));
    await importWindowsGraphics([new File([zipSync(contents)], 'graphics.zip')]);
    expect(await hasWindowsGraphics()).toBe(true);
    contents['other/LEMMBIG.SPR'] = sprite();
    await expect(importWindowsGraphics([new File([zipSync(contents)], 'duplicate.zip')])).rejects.toThrow('Duplicate graphics files');
  });
  it('does not replace manual imports or undo explicit removal during automatic imports', async () => {
    await importWindowsGraphics(files());
    expect(await importWindowsGraphicsIfMissing(files())).toBe(false);
    await clearWindowsGraphics();
    expect(await hasWindowsGraphics()).toBe(false);
    expect(await canAutoImportWindowsGraphics()).toBe(false);
    expect(await importWindowsGraphicsIfMissing(files())).toBe(false);
    await importWindowsGraphics(files());
    expect(await hasWindowsGraphics()).toBe(true);
  });
  it('does not replace a manual import when automatic import races another tab', async () => {
    const manual = files();
    const other = files();
    other[0] = new File([Uint8Array.from([...sprite().slice(0, -2), 7, 0x80])], 'lemmbig.spr');
    await Promise.all([importWindowsGraphicsIfMissing(other), importWindowsGraphics(manual)]);
    expect(await getWindowsGraphicsFile('LEMMBIG.SPR')).toEqual(sprite().buffer);
  });

  it('adds only missing icons to older matching installations and preserves manual files', async () => {
    await importWindowsGraphics(files());
    expect(await canAutoImportWindowsUiGraphics()).toBe(true);
    const iconFiles = [...WINDOWS_UI_GRAPHICS_FILES, ...WINDOWS_GAME_GRAPHICS_FILES].map(name => new File([sprite()], name));
    expect(await importWindowsGraphicsIfMissing([...files(), ...iconFiles])).toBe(true);
    expect(await getWindowsGraphicsFile('ICO_CLIM.SPR')).toEqual(sprite().buffer);
    expect(await getWindowsGraphicsFile('LEMMSMA.SPR')).toEqual(sprite().buffer);
    expect(await getWindowsGraphicsFile('LEVEL4OS.SPR')).toEqual(sprite().buffer);
    expect(await canAutoImportWindowsUiGraphics()).toBe(false);
    const custom = files();
    const alternate = Uint8Array.from([...sprite().slice(0, -2), 7, 0x80]);
    await importWindowsGraphics([...custom, new File([alternate], 'ICO_CLIM.SPR')]);
    expect(await importWindowsGraphicsIfMissing([...files(), ...iconFiles])).toBe(true);
    expect(await getWindowsGraphicsFile('ICO_CLIM.SPR')).toEqual(alternate.buffer);
    await clearWindowsGraphics();
    expect(await canAutoImportWindowsUiGraphics()).toBe(false);
    expect(await importWindowsGraphicsIfMissing([...files(), ...iconFiles])).toBe(false);
  });

  it('does not mix a deployment’s icons into graphics with a different palette', async () => {
    const manual = files();
    const index = manual.findIndex(file => file.name.toUpperCase() === 'FE.PAL');
    manual[index] = new File([Uint8Array.from([0x20, 0x4c, 0x41, 0x50, 1, 0, 7, 8, 9, 0])], 'fe.pal');
    await importWindowsGraphics(manual);
    const iconFiles = [...WINDOWS_UI_GRAPHICS_FILES, ...WINDOWS_GAME_GRAPHICS_FILES].map(name => new File([sprite()], name));
    expect(await importWindowsGraphicsIfMissing([...files(), ...iconFiles])).toBe(false);
    expect(await getWindowsGraphicsFile('ICO_CLIM.SPR')).toBeUndefined();
  });
});

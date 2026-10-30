import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameTypes } from '../../src/game/game-types';
import { DrawProperties } from '../../src/game/resources/draw-properties';
import { Level } from '../../src/game/resources/level';
import { ColorPalette } from '../../src/game/resources/lemmings/color-palette';
import { LevelElement } from '../../src/game/resources/lemmings/level-element';
import { LevelProperties } from '../../src/game/resources/lemmings/level-properties';
import { prepareWindowsTerrain } from '../../src/game/resources/prepare-windows-terrain';
import { SolidLayer } from '../../src/game/resources/solid-layer';

const mocks = vi.hoisted(() => ({ get: vi.fn(), sprites: vi.fn(), palette: vi.fn() }));
vi.mock('../../src/game/resources/file/windows-graphics-store', () => ({ getWindowsGraphicsFile: mocks.get }));
vi.mock('../../src/game/resources/windows-graphics', () => ({ decodeWindowsSprites: mocks.sprites, decodeWindowsPalette: mocks.palette }));

function level(special = false) {
  const colors = new ColorPalette();
  const result = new Level(2, 2, GameTypes.LEMMINGS, 0, 0, new LevelProperties(), 0, false,
    new Uint8ClampedArray(16), new SolidLayer(2, 2, new Int8Array(4)), colors, colors);
  result.setWindowsTerrainSource({ graphicSet: 0, special,
    pieces: [new LevelElement(0, 0, 0, new DrawProperties(false, false, false, false))] });
  return result;
}

describe('preparing optional Windows terrain', () => {
  beforeEach(() => {
    mocks.get.mockReset().mockResolvedValue(new ArrayBuffer(1));
    mocks.sprites.mockReset().mockReturnValue([{ width: 2, height: 2, indices: new Uint8Array([1, 1, 1, 1]), mask: new Uint8Array([1, 1, 1, 1]) }]);
    mocks.palette.mockReset().mockReturnValue(new Uint32Array([0, 0x123456]));
  });
  it('loads the matching style and attaches its native layer without changing collision', async () => {
    const target = level();
    const result = await prepareWindowsTerrain(target);
    expect(result.status).toBe('ready');
    expect(mocks.get.mock.calls.map(call => call[0])).toEqual(['LEVEL0B.SPR', 'LEVEL0.PAL']);
    if (result.status !== 'ready') throw new Error('Expected native terrain');
    expect(Array.from(result.layer.pixels.slice(0, 4))).toEqual([0x12, 0x34, 0x56, 255]);
    expect(target.getWindowsTerrain()).toBeUndefined();
    expect(target.hasGroundAt(0, 0)).toBe(false);
  });
  it('does not mistake a special full-screen background for a tile-based level', async () => {
    const target = level(true);
    expect(await prepareWindowsTerrain(target)).toEqual({ status: 'special' });
    expect(mocks.get).not.toHaveBeenCalled();
    expect(target.getWindowsTerrain()).toBeUndefined();
  });
  it('falls back safely if optional files are missing, corrupt, or storage fails', async () => {
    for (const setup of [
      () => mocks.get.mockResolvedValue(undefined),
      () => mocks.get.mockRejectedValue(new Error('storage')),
      () => mocks.sprites.mockImplementation(() => { throw new Error('corrupt'); }),
    ]) {
      mocks.get.mockReset().mockResolvedValue(new ArrayBuffer(1));
      mocks.sprites.mockReset().mockReturnValue([]);
      setup();
      const target = level();
      expect(await prepareWindowsTerrain(target)).toEqual({ status: 'unavailable' });
      expect(target.getWindowsTerrain()).toBeUndefined();
    }
  });
});

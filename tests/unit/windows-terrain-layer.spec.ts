import { describe, expect, it, vi } from 'vitest';
import { GameTypes } from '../../src/game/game-types';
import { DrawProperties } from '../../src/game/resources/draw-properties';
import { Level } from '../../src/game/resources/level';
import { ColorPalette } from '../../src/game/resources/lemmings/color-palette';
import { LevelElement } from '../../src/game/resources/lemmings/level-element';
import { LevelProperties } from '../../src/game/resources/lemmings/level-properties';
import { SolidLayer } from '../../src/game/resources/solid-layer';
import { WindowsTerrainLayer } from '../../src/game/resources/windows-terrain-layer';
import type { WindowsSpriteFrame } from '../../src/game/resources/windows-graphics';
import type { DisplayImage } from '../../src/game/view/display-image';

const colors = new Uint32Array([0, 0x123456, 0xabcdef]);
const frame = (indices: number[], mask: number[]): WindowsSpriteFrame => ({
  width: 2, height: 2, indices: Uint8Array.from(indices), mask: Uint8Array.from(mask),
});
const piece = (x: number, y: number, id: number, options = new DrawProperties(false, false, false, false)) =>
  new LevelElement(x, y, id, options);
const at = (layer: WindowsTerrainLayer, x: number, y: number) =>
  Array.from(layer.pixels.subarray((y * layer.width + x) * 4, (y * layer.width + x + 1) * 4));

describe('native Windows terrain presentation', () => {
  it('composes high-resolution tiles using transparent masks, erasers and placement order', () => {
    const frames = [frame([1, 1, 1, 1], [1, 1, 1, 1]), frame([2, 2, 2, 2], [1, 0, 1, 0])];
    const layer = new WindowsTerrainLayer(3, 2, [
      piece(0, 0, 0), piece(0, 0, 1, new DrawProperties(false, true, false, false)),
      piece(1, 0, 1), piece(1, 0, 1, new DrawProperties(true, false, false, true)),
    ], frames, colors);
    expect(at(layer, 0, 0)).toEqual([0x12, 0x34, 0x56, 255]); // no overwrite
    expect(at(layer, 2, 0)).toEqual([0, 0, 0, 0]); // eraser
    expect(at(layer, 2, 1)).toEqual([0, 0, 0, 0]);
    expect(at(layer, 3, 0)).toEqual([0, 0, 0, 0]); // transparent source
  });

  it('mirrors upside-down pieces and clips pieces at map boundaries', () => {
    const sprite = frame([1, 2, 0, 0], [1, 1, 0, 0]);
    const layer = new WindowsTerrainLayer(2, 2, [piece(0, 0, 0, new DrawProperties(true, false, false, false)), piece(-1, 1, 0)], [sprite], colors);
    expect(at(layer, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(at(layer, 0, 1)).toEqual([0x12, 0x34, 0x56, 255]);
    expect(at(layer, 1, 1)).toEqual([0xab, 0xcd, 0xef, 255]);
    expect(at(layer, 3, 2)).toEqual([0, 0, 0, 0]);
  });

  it('limits only-overwrite pieces to already-drawn pixels', () => {
    const first = frame([1, 1, 1, 1], [1, 0, 1, 0]);
    const second = frame([2, 2, 2, 2], [1, 1, 1, 1]);
    const layer = new WindowsTerrainLayer(1, 1, [piece(0, 0, 0), piece(0, 0, 1, new DrawProperties(false, false, true, false))], [first, second], colors);
    expect(at(layer, 0, 0)).toEqual([0xab, 0xcd, 0xef, 255]);
    expect(at(layer, 1, 0)).toEqual([0, 0, 0, 0]);
  });

  it('mirrors builder and digging changes while keeping DOS collision data authoritative', () => {
    const layer = new WindowsTerrainLayer(2, 2, [piece(0, 0, 0)], [frame([1, 1, 1, 1], [1, 1, 1, 1])], colors);
    const palette = new ColorPalette(); palette.setColorRGB(1, 30, 40, 50);
    const mask = new SolidLayer(2, 2, new Int8Array([1, 0, 0, 0]));
    const level = new Level(2, 2, GameTypes.LEMMINGS, 0, 0, new LevelProperties(), 0, false,
      new Uint8ClampedArray(16), mask, palette, palette);
    level.setWindowsTerrain(layer);
    level.clearGroundAt(0, 0);
    expect(level.hasGroundAt(0, 0)).toBe(false);
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) expect(at(layer, x, y)).toEqual([0, 0, 0, 0]);
    level.setGroundAt(1, 1, 1);
    expect(level.hasGroundAt(1, 1)).toBe(true);
    for (const [x, y] of [[2, 2], [3, 2], [2, 3], [3, 3]]) expect(at(layer, x, y)).toEqual([30, 40, 50, 255]);
    const unchanged = layer.pixels.slice();
    level.setGroundAt(2, 0, 1); level.clearGroundAt(-1, 1);
    expect(layer.pixels).toEqual(unchanged);
  });

  it('rejects missing pieces, palette entries and mismatched level dimensions', () => {
    expect(() => new WindowsTerrainLayer(1, 1, [piece(0, 0, 9)], [], colors)).toThrow();
    expect(() => new WindowsTerrainLayer(1, 1, [piece(0, 0, 0)], [frame([3, 0, 0, 0], [1, 0, 0, 0])], colors)).toThrow();
    const layer = new WindowsTerrainLayer(1, 1, [], [], colors);
    const palette = new ColorPalette();
    const level = new Level(2, 2, GameTypes.LEMMINGS, 0, 0, new LevelProperties(), 0, false,
      new Uint8ClampedArray(16), new SolidLayer(2, 2, new Int8Array(4)), palette, palette);
    expect(() => level.setWindowsTerrain(layer)).toThrow();
    expect(level.getWindowsTerrain()).toBeUndefined();
  });

  it('supplies or clears the native background before drawing the DOS frame', () => {
    const layer = new WindowsTerrainLayer(1, 1, [], [], colors);
    const palette = new ColorPalette();
    const level = new Level(1, 1, GameTypes.LEMMINGS, 0, 0, new LevelProperties(), 0, false,
      new Uint8ClampedArray(4), new SolidLayer(1, 1, new Int8Array(1)), palette, palette);
    const display = { initSize: vi.fn(), setNativeBackground: vi.fn(), setBackground: vi.fn() };
    level.setWindowsTerrain(layer);
    level.render(display as unknown as DisplayImage);
    expect(display.setNativeBackground).toHaveBeenCalledWith(layer.pixels, 2, 2);
    expect(display.setNativeBackground.mock.invocationCallOrder[0]).toBeLessThan(display.setBackground.mock.invocationCallOrder[0]);
    level.setWindowsTerrain(undefined);
    level.render(display as unknown as DisplayImage);
    expect(display.setNativeBackground).toHaveBeenLastCalledWith(null, undefined, undefined);
  });
});

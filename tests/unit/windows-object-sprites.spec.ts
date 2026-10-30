import { describe, expect, it } from 'vitest';
import { GameTypes } from '../../src/game/game-types';
import { DrawProperties } from '../../src/game/resources/draw-properties';
import { Level } from '../../src/game/resources/level';
import { ColorPalette } from '../../src/game/resources/lemmings/color-palette';
import { LevelElement } from '../../src/game/resources/lemmings/level-element';
import { LevelProperties } from '../../src/game/resources/lemmings/level-properties';
import { ObjectImageInfo } from '../../src/game/resources/lemmings/object-image-info';
import { TriggerTypes } from '../../src/game/resources/lemmings/trigger-types';
import { SolidLayer } from '../../src/game/resources/solid-layer';
import { mapWindowsObjectSprites } from '../../src/game/resources/windows-object-sprites';
import type { WindowsSpriteFrame } from '../../src/game/resources/windows-graphics';

const sprite = (color: number): WindowsSpriteFrame => ({ width: 2, height: 2,
  indices: new Uint8Array([color, color, color, color]), mask: new Uint8Array([1, 1, 1, 0]) });

function fixture() {
  const palette = new ColorPalette();
  const level = new Level(4, 4, GameTypes.LEMMINGS, 0, 0, new LevelProperties(), 0, false,
    new Uint8ClampedArray(64), new SolidLayer(4, 4, new Int8Array(16)), palette, palette);
  const info = (count: number, trap = false) => {
    const image = new ObjectImageInfo(palette); image.width = image.height = 1; image.frameCount = count;
    image.frames = Array.from({ length: count }, () => new Uint8Array([1]));
    image.triggerEffectId = trap ? TriggerTypes.TRAP : 0;
    return image;
  };
  const properties = new DrawProperties(false, false, false, false);
  // Place the trap before type zero, exercising style offsets independently of placement order.
  level.setMapObjects([new LevelElement(0, 0, 1, properties), new LevelElement(2, 0, 0, properties)], [info(1), info(3, true)]);
  level.setWindowsTerrainSource({ graphicSet: 0, special: false, pieces: [], objectTypes: [1, 0], objectFrameStarts: [0, 1] });
  const windows = [sprite(128), sprite(129), sprite(130), sprite(131)];
  const colors = new Uint32Array(64); colors[0] = 0x112233; colors[1] = 0x223344; colors[2] = 0x334455; colors[3] = 0x445566;
  return { level, windows, colors };
}

describe('native Windows animated objects', () => {
  it('maps each object and animation frame using style order and the upper palette', () => {
    const { level, windows, colors } = fixture();
    const result = mapWindowsObjectSprites(level, windows, colors);
    const trap = level.objects[0], other = level.objects[1];
    expect(result.size).toBe(4);
    expect(result.get(other.animation.frames[0])!.pixels[0]).toBe(0xff332211);
    expect(result.get(trap.animation.frames[0])!.pixels[0]).toBe(0xff443322);
    expect(result.get(trap.animation.frames[0])!.pixels[3]).toBe(0);
    trap.activateTrap(10);
    expect(result.get(trap.getFrame(10))!.pixels[0]).toBe(0xff665544);
  });
  it('rejects incomplete mappings, incompatible dimensions and invalid palette indices', () => {
    const { level, windows, colors } = fixture();
    expect(() => mapWindowsObjectSprites(level, windows.slice(0, 2), colors)).toThrow();
    expect(() => mapWindowsObjectSprites(level, [sprite(64), ...windows.slice(1)], colors)).toThrow();
    expect(() => mapWindowsObjectSprites(level, [{ ...windows[0], width: 1 }, ...windows.slice(1)], colors)).toThrow();
  });
});

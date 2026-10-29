import { describe, expect, it } from 'vitest';
import { ActionBuildSystem } from '../../src/game/game-play/actions/action-build-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { GameTypes } from '../../src/game/game-types';
import { Level } from '../../src/game/resources/level';
import { ColorPalette } from '../../src/game/resources/lemmings/color-palette';
import { LevelProperties } from '../../src/game/resources/lemmings/level-properties';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';
import { SolidLayer } from '../../src/game/resources/solid-layer';

describe('terrain writes at map boundaries', () => {
  it.each([false, true])('clips builder bricks at the edge without wrapping into another row (right=%s)', right => {
    const width = 16, height = 20;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const mask = new Int8Array(width * height);
    const palette = new ColorPalette();
    palette.setColorRGB(7, 220, 180, 140);
    const level = new Level(width, height, GameTypes.LEMMINGS, 0, 0, new LevelProperties(), 0, false,
      pixels, new SolidLayer(width, height, mask), palette, palette);
    const action = new ActionBuildSystem({ getAnimation: () => ({}) } as unknown as LemmingsSprite);
    const lemming = new Lemming(right ? width - 2 : 1, 15, 0);
    lemming.lookRight = right;
    lemming.frameIndex = 8;
    action.process(level, lemming);

    const expected = new Set(right ? [14 * width + 14, 14 * width + 15] : [14 * width, 14 * width + 1, 14 * width + 2]);
    for (let index = 0; index < mask.length; index++) {
      expect(mask[index], `terrain ${index}`).toBe(expected.has(index) ? 1 : 0);
      expect(Array.from(pixels.subarray(index * 4, index * 4 + 4)), `pixel ${index}`)
        .toEqual(expected.has(index) ? [220, 180, 140, 255] : [0, 0, 0, 0]);
    }
  });

  it('does not let direct solid-layer writes modify the next or previous row', () => {
    const mask = new Int8Array(16);
    const layer = new SolidLayer(4, 4, mask);
    for (const [x, y] of [[-1, 2], [4, 1], [0, -1], [0, 4]]) layer.setGroundAt(x, y);
    expect(Array.from(mask)).toEqual(Array(16).fill(0));
    mask.fill(1);
    for (const [x, y] of [[-1, 2], [4, 1], [0, -1], [0, 4]]) layer.clearGroundAt(x, y);
    expect(Array.from(mask)).toEqual(Array(16).fill(1));
  });
});

import { describe, expect, it } from 'vitest';
import { GameTypes } from '../../src/game/game-types';
import { BinaryReader } from '../../src/game/resources/file/binary-reader';
import { Level } from '../../src/game/resources/level';
import { ColorPalette } from '../../src/game/resources/lemmings/color-palette';
import { LevelProperties } from '../../src/game/resources/lemmings/level-properties';
import { MaskProvider } from '../../src/game/resources/mask-provider';
import { MaskTypes } from '../../src/game/resources/mask-types';
import { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';
import { SpriteTypes } from '../../src/game/resources/sprite-types';
import { SolidLayer } from '../../src/game/resources/solid-layer';

describe('mining mask placement', () => {
  it('places the first pixel of each mining mask thirteen pixels above the lemming', () => {
    // MAIN.DAT's two 16x10x4 bashing masks precede the two 16x13x2 mining masks.
    const bytes = new Uint8Array(512);
    bytes[160] = 0x80;
    bytes[212] = 0x80;
    const masks = new MaskProvider(new BinaryReader(bytes));
    for (const type of [MaskTypes.MINEING_R, MaskTypes.MINEING_L]) {
      const width = 32, height = 32;
      const palette = new ColorPalette();
      const level = new Level(width, height, GameTypes.LEMMINGS, 0, 0, new LevelProperties(), 0, false,
        new Uint8ClampedArray(width * height * 4), new SolidLayer(width, height, new Int8Array(width * height).fill(1)), palette, palette);
      level.clearGroundWithMask(masks.GetMask(type).getMask(0), 20, 20);
      expect(level.hasGroundAt(12, 7)).toBe(false);
      expect(level.hasGroundAt(12, 8)).toBe(true);
    }
  });

  it('aligns both mining animations with the same foot position', () => {
    const sprites = new LemmingsSprite(new BinaryReader(new Uint8Array(200_000)), new ColorPalette());
    expect(sprites.getAnimation(SpriteTypes.MINEING, true).getFrame(0).offsetY).toBe(-13);
    expect(sprites.getAnimation(SpriteTypes.MINEING, false).getFrame(0).offsetY).toBe(-13);
  });
});

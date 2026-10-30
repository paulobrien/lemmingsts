import { describe, expect, it } from 'vitest';
import { Frame } from '../../src/game/resources/frame';
import { BinaryReader } from '../../src/game/resources/file/binary-reader';
import { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';
import { ColorPalette } from '../../src/game/resources/lemmings/color-palette';
import { SpriteTypes } from '../../src/game/resources/sprite-types';
import { mapWindowsLemmingSprites } from '../../src/game/resources/windows-lemming-sprites';
import type { WindowsSpriteFrame } from '../../src/game/resources/windows-graphics';

describe('Windows lemming animation mapping', () => {
  it('keeps separate left and right shrug animations when loading DOS frames', () => {
    const sprites = new LemmingsSprite(new BinaryReader(new Uint8Array(200_000)), new ColorPalette());
    expect(sprites.getAnimation(SpriteTypes.SHRUGGING, true)).not.toBe(sprites.getAnimation(SpriteTypes.SHRUGGING, false));
  });
  it('preserves world anchors and palette colors for matched walking frames', () => {
    const original = Array.from({ length: 8 }, () => new Frame(16, 10, -8, -10));
    const dos = { getAnimation: (type: SpriteTypes, right: boolean) =>
      type === SpriteTypes.WALKING && right ? { frames: original } : undefined } as unknown as LemmingsSprite;
    const frames: WindowsSpriteFrame[] = Array.from({ length: 354 }, () => ({ width: 32, height: 20,
      indices: new Uint8Array(32 * 20), mask: new Uint8Array(32 * 20) }));
    frames[0].indices[0] = 49; frames[0].mask[0] = 1;
    const palette = new Uint32Array(256); palette[49] = 0x123456;
    const map = mapWindowsLemmingSprites(dos, frames, palette);
    expect(map.size).toBe(8);
    expect(map.get(original[0])).toMatchObject({ width: 32, height: 20, offsetX: -12, offsetY: -20 });
    expect(map.get(original[0])!.pixels[0]).toBe(0xff563412);
    expect(map.get(original[0])!.pixels[1]).toBe(0);
  });
  it('rejects incomplete Windows sprite sets', () => {
    expect(() => mapWindowsLemmingSprites({} as LemmingsSprite, [], new Uint32Array(256))).toThrow('Incomplete');
  });
  it('maps the taller hoist and directional shrug art using their original world anchors', () => {
    const hoist = Array.from({ length: 8 }, () => new Frame(16, 12, -8, -12));
    const shrugRight = Array.from({ length: 8 }, () => new Frame(16, 10, -8, -10));
    const shrugLeft = Array.from({ length: 8 }, () => new Frame(16, 10, -8, -10));
    const dos = { getAnimation: (type: SpriteTypes, right: boolean) => {
      if (type === SpriteTypes.POSTCLIMBING && right) return { frames: hoist };
      if (type === SpriteTypes.SHRUGGING) return { frames: right ? shrugRight : shrugLeft };
      return undefined;
    } } as unknown as LemmingsSprite;
    const frames: WindowsSpriteFrame[] = Array.from({ length: 354 }, (_, i) => {
      const height = i >= 40 && i < 56 ? 32 : 26;
      return { width: 32, height, indices: new Uint8Array(32 * height).fill(i % 256), mask: new Uint8Array(32 * height).fill(1) };
    });
    const palette = new Uint32Array(256); palette[190] = 0xff0000; palette[198] = 0x00ff00;
    const map = mapWindowsLemmingSprites(dos, frames, palette);
    expect(hoist.map(frame => map.get(frame)!.offsetY)).toEqual([-34, -30, -26, -22, -18, -18, -18, -18]);
    expect(map.get(shrugRight[0])).toMatchObject({ offsetY: -26 });
    expect(map.get(shrugLeft[0])).toMatchObject({ offsetY: -26 });
    expect(map.get(shrugRight[0])!.pixels[0]).toBe(0xff0000ff);
    expect(map.get(shrugLeft[0])!.pixels[0]).toBe(0xff00ff00);
  });
});

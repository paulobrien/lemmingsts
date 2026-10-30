import { describe, expect, it } from 'vitest';
import { Frame } from '../../src/game/resources/frame';
import { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';
import { SpriteTypes } from '../../src/game/resources/sprite-types';
import { mapWindowsLemmingSprites } from '../../src/game/resources/windows-lemming-sprites';
import type { WindowsSpriteFrame } from '../../src/game/resources/windows-graphics';

describe('Windows lemming animation mapping', () => {
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
});

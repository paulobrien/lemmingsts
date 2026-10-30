import { describe, expect, it, vi } from 'vitest';
import { MaskTypes } from '../../src/game/resources/mask-types';
import { createWindowsMaskProvider } from '../../src/game/resources/windows-mask-provider';
import type { WindowsSpriteFrame } from '../../src/game/resources/windows-graphics';

const decoded = vi.hoisted(() => ({ frames: [] as WindowsSpriteFrame[] }));
vi.mock('../../src/game/resources/windows-graphics', () => ({ decodeWindowsSprites: () => decoded.frames }));

const sprite = (width: number, height: number): WindowsSpriteFrame => ({
  width, height, indices: new Uint8Array(width * height), mask: Uint8Array.from({ length: width * height }, (_, i) => i === 1 ? 1 : 0),
});
function validFrames() {
  const frames = Array.from({ length: 354 }, () => sprite(16, 16));
  frames[335] = sprite(16, 22);
  for (let index = 349; index <= 353; index++) frames[index] = sprite(16, 8);
  return frames;
}

describe('Windows gameplay masks', () => {
  it('maps player-supplied sprite masks to the expected actions and countdown', () => {
    decoded.frames = validFrames();
    const masks = createWindowsMaskProvider(new Uint8Array());
    expect(masks.GetMask(MaskTypes.BASHING_R).length).toBe(4);
    expect(masks.GetMask(MaskTypes.MINEING_L).length).toBe(2);
    expect(masks.GetMask(MaskTypes.NUMBERS).length).toBe(6);
    const mine = masks.GetMask(MaskTypes.MINEING_L).getMask(0);
    expect([mine.offsetX, mine.offsetY]).toEqual([-7, -16]);
    expect(mine.at(0, 0)).toBe(true);
    expect(mine.at(1, 0)).toBe(false);
    expect(masks.GetMask(MaskTypes.NUMBERS).getMask(0).getMask().some(Boolean)).toBe(false);
    expect(masks.GetMask(MaskTypes.NUMBERS).getMask(5).getMask().some(Boolean)).toBe(true);
  });
  it('rejects missing, malformed, or empty gameplay masks', () => {
    decoded.frames = validFrames().slice(0, 350);
    expect(() => createWindowsMaskProvider(new Uint8Array())).toThrow('Incomplete Windows gameplay masks');
    decoded.frames = validFrames(); decoded.frames[336] = sprite(15, 16);
    expect(() => createWindowsMaskProvider(new Uint8Array())).toThrow('Incomplete Windows gameplay masks');
    decoded.frames = validFrames(); decoded.frames[335].mask.fill(0);
    expect(() => createWindowsMaskProvider(new Uint8Array())).toThrow('Incomplete Windows gameplay masks');
  });
});

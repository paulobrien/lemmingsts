import { Mask } from './mask';
import { MaskList } from './mask-list';
import { MaskProvider } from './mask-provider';
import { MaskTypes } from './mask-types';
import { decodeWindowsSprites, type WindowsSpriteFrame } from './windows-graphics';

/**
 * Skill masks are frames in the player's low-resolution Windows lemming sheet.
 * Frame indices: https://github.com/mjfwalsh/lemmini/blob/master/extract.ini
 * The low-resolution sheet has direction-specific terrain masks. Their origin
 * is the lemming's foot, with a one-pixel left-miner alignment adjustment.
 */
export function createWindowsMaskProvider(bytes: Uint8Array): MaskProvider {
  const frames = decodeWindowsSprites(bytes);
  const frame = (index: number, width: number, height: number, offsetX: number, offsetY: number): Mask => {
    const sprite: WindowsSpriteFrame | undefined = frames[index];
    if (!sprite || sprite.width !== width || sprite.height !== height || sprite.mask.length !== width * height ||
        !sprite.mask.some(Boolean)) throw new Error('Incomplete Windows gameplay masks.');
    return new Mask(width, height, offsetX, offsetY, Int8Array.from(sprite.mask));
  };
  const lists: MaskList[] = [];
  lists[MaskTypes.BASHING_R] = new MaskList([336, 337, 338, 339].map(i => frame(i, 16, 16, -8, -16)));
  lists[MaskTypes.BASHING_L] = new MaskList([340, 341, 342, 343].map(i => frame(i, 16, 16, -8, -16)));
  lists[MaskTypes.MINEING_R] = new MaskList([344, 345].map(i => frame(i, 16, 16, -8, -16)));
  lists[MaskTypes.MINEING_L] = new MaskList([346, 347].map(i => frame(i, 16, 16, -7, -16)));
  lists[MaskTypes.EXPLODING] = new MaskList([frame(335, 16, 22, -8, -14)]);
  // Only 1–5 appear in the bomber countdown. Slot zero is never rendered.
  const blank = new Mask(16, 8, -8, -17, new Int8Array(128));
  lists[MaskTypes.NUMBERS] = new MaskList([blank, ...[349, 350, 351, 352, 353].map(i => frame(i, 16, 8, -8, -17))]);
  return new MaskProvider(lists);
}

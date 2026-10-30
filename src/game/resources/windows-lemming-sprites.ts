import { Frame } from './frame';
import { LemmingsSprite } from './lemmings-sprite';
import { SpriteTypes } from './sprite-types';
import { WindowsSpriteFrame } from './windows-graphics';

/** Native-resolution sprite; offsets are in native (2×) pixels. */
export interface WindowsLemmingSprite {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  /** Little-endian RGBA words, with fully transparent pixels as zero. */
  pixels: Uint32Array;
}

/**
 * Link independently decoded Windows frames to the DOS frames driving the
 * simulation. Mappings below were checked against the original low-resolution
 * animation masks; unmatched animations continue to use DOS art.
 */
export function mapWindowsLemmingSprites(dos: LemmingsSprite, windows: WindowsSpriteFrame[], palette: Uint32Array): Map<Frame, WindowsLemmingSprite> {
  if (windows.length < 354 || palette.length < 256) throw new Error('Incomplete Windows lemming graphics.');
  const groups: { type: SpriteTypes; right: boolean; first: number; count: number; shift?: number }[] = [
    { type: SpriteTypes.WALKING, right: true, first: 0, count: 8, shift: 2 },
    { type: SpriteTypes.WALKING, right: false, first: 8, count: 8, shift: 2 },
    { type: SpriteTypes.FALLING, right: true, first: 16, count: 4, shift: 5 },
    { type: SpriteTypes.FALLING, right: false, first: 20, count: 4, shift: 6 },
    { type: SpriteTypes.CLIMBING, right: true, first: 24, count: 8 },
    { type: SpriteTypes.CLIMBING, right: false, first: 32, count: 8 },
    { type: SpriteTypes.UMBRELLA, right: true, first: 56, count: 8 },
    { type: SpriteTypes.UMBRELLA, right: false, first: 64, count: 8 },
    { type: SpriteTypes.OHNO, right: true, first: 72, count: 16 },
    { type: SpriteTypes.SPLATTING, right: true, first: 88, count: 16 },
    { type: SpriteTypes.BLOCKING, right: true, first: 104, count: 16 },
    { type: SpriteTypes.DROWNING, right: true, first: 120, count: 16 },
    { type: SpriteTypes.FRYING, right: true, first: 136, count: 14 },
    { type: SpriteTypes.EXITING, right: true, first: 150, count: 8 },
    { type: SpriteTypes.BUILDING, right: true, first: 158, count: 16 },
    { type: SpriteTypes.BUILDING, right: false, first: 174, count: 16 },
    // The original loader aliases both shrug directions; keep those DOS frames
    // until the two animations can be distinguished safely.
    { type: SpriteTypes.DIGGING, right: true, first: 206, count: 16 },
    { type: SpriteTypes.BASHING, right: true, first: 222, count: 32 },
    { type: SpriteTypes.BASHING, right: false, first: 254, count: 32 },
    { type: SpriteTypes.MINEING, right: true, first: 286, count: 24 },
    { type: SpriteTypes.MINEING, right: false, first: 310, count: 24 },
  ];
  const result = new Map<Frame, WindowsLemmingSprite>();
  for (const group of groups) {
    const frames = dos.getAnimation(group.type, group.right)?.frames;
    if (!frames || frames.length !== group.count) continue;
    for (let index = 0; index < frames.length; index++) {
      const source = windows[group.first + index], original = frames[index];
      if (!source || source.width % 2 || source.height % 2 || source.width > original.width * 2 ||
          source.height > original.height * 2 || source.indices.length !== source.width * source.height ||
          source.mask.length !== source.indices.length) throw new Error('Incompatible Windows lemming frame.');
      const pixels = new Uint32Array(source.indices.length);
      for (let pixel = 0; pixel < pixels.length; pixel++) {
        if (!source.mask[pixel]) continue;
        const rgb = palette[source.indices[pixel]];
        pixels[pixel] = (0xff000000 | ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >> 16) & 0xff)) >>> 0;
      }
      result.set(original, {
        width: source.width, height: source.height,
        offsetX: (original.offsetX + (group.shift ?? 0)) * 2,
        offsetY: (original.offsetY + original.height) * 2 - source.height,
        pixels,
      });
    }
  }
  return result;
}

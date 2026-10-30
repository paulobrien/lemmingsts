import { Frame } from './frame';
import { Level } from './level';
import { WindowsSpriteFrame } from './windows-graphics';
import type { WindowsLemmingSprite } from './windows-lemming-sprites';

/** Map Windows object frames to the DOS frames already used by the simulation. */
export function mapWindowsObjectSprites(level: Level, windows: readonly WindowsSpriteFrame[], palette: Uint32Array): Map<Frame, WindowsLemmingSprite> {
  const source = level.getWindowsTerrainSource();
  if (!source?.objectTypes || !source.objectFrameStarts || source.objectTypes.length !== level.objects.length || palette.length !== 64) {
    throw new Error('Windows object graphics are incompatible with this level.');
  }
  const mapped = new Map<Frame, WindowsLemmingSprite>();
  for (let objectIndex = 0; objectIndex < level.objects.length; objectIndex++) {
    const object = level.objects[objectIndex];
    const type = source.objectTypes[objectIndex];
    const start = source.objectFrameStarts[type];
    if (!Number.isInteger(start) || start < 0) throw new Error('Windows object frame mapping is invalid.');
    for (let i = 0; i < object.animation.frames.length; i++) {
      const original = object.animation.frames[i], frame = windows[start + i];
      if (!frame || frame.width !== original.width * 2 || frame.height !== original.height * 2 ||
          frame.mask.length !== frame.width * frame.height || frame.indices.length !== frame.mask.length) {
        throw new Error('Windows object frame dimensions are incompatible.');
      }
      const pixels = new Uint32Array(frame.indices.length);
      for (let pixel = 0; pixel < pixels.length; pixel++) {
        if (!frame.mask[pixel]) continue;
        // Windows object sprites address their style palette from index 0x80.
        const index = frame.indices[pixel] - 0x80;
        if (index < 0 || index >= palette.length) throw new Error('Windows object palette index is invalid.');
        const rgb = palette[index];
        pixels[pixel] = (0xff000000 | ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >>> 16) & 0xff)) >>> 0;
      }
      mapped.set(original, { width: frame.width, height: frame.height,
        offsetX: original.offsetX * 2, offsetY: original.offsetY * 2, pixels });
    }
  }
  return mapped;
}

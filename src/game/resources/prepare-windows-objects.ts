import { getWindowsGraphicsFile } from './file/windows-graphics-store';
import { Level } from './level';
import { decodeWindowsPalette, decodeWindowsSprites } from './windows-graphics';
import { mapWindowsObjectSprites } from './windows-object-sprites';
import type { WindowsLemmingSprite } from './windows-lemming-sprites';
import type { Frame } from './frame';

/** Prepare locally owned object artwork, falling back safely when unavailable. */
export async function prepareWindowsObjects(level: Level): Promise<Map<Frame, WindowsLemmingSprite> | null> {
  const source = level.getWindowsTerrainSource();
  if (!source || source.special || source.graphicSet < 0 || source.graphicSet > 4) return null;
  try {
    const [sprites, palette] = await Promise.all([
      getWindowsGraphicsFile(`LEVEL${source.graphicSet}OB.SPR`), getWindowsGraphicsFile(`LEVEL${source.graphicSet}.PAL`),
    ]);
    if (!sprites || !palette) return null;
    return mapWindowsObjectSprites(level, decodeWindowsSprites(new Uint8Array(sprites)), decodeWindowsPalette(new Uint8Array(palette)));
  } catch { return null; }
}

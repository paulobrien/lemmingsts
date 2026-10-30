import { getWindowsGraphicsFile } from './file/windows-graphics-store';
import { LemmingsSprite } from './lemmings-sprite';
import { decodeWindowsPalette, decodeWindowsSprites } from './windows-graphics';
import { mapWindowsLemmingSprites, type WindowsLemmingSprite } from './windows-lemming-sprites';
import type { Frame } from './frame';

/** Load locally owned optional sprite artwork without changing the DOS simulation. */
export async function prepareWindowsSprites(sprites: LemmingsSprite): Promise<Map<Frame, WindowsLemmingSprite> | null> {
  try {
    const [spriteData, paletteData] = await Promise.all([
      getWindowsGraphicsFile('LEMMBIG.SPR'), getWindowsGraphicsFile('FE.PAL'),
    ]);
    if (!spriteData || !paletteData) return null;
    return mapWindowsLemmingSprites(sprites, decodeWindowsSprites(new Uint8Array(spriteData)), decodeWindowsPalette(new Uint8Array(paletteData)));
  } catch { return null; }
}

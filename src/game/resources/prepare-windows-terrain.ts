import { getWindowsGraphicsFile } from './file/windows-graphics-store';
import { Level } from './level';
import { decodeWindowsPalette, decodeWindowsSprites } from './windows-graphics';
import { WindowsTerrainLayer } from './windows-terrain-layer';

export type PreparedWindowsTerrain =
  | { status: 'ready'; layer: WindowsTerrainLayer; usesDosBackground?: true }
  | { status: 'unavailable' };

/** Decode optional artwork without mutating the level; callers check for stale requests before attaching. */
export async function prepareWindowsTerrain(level: Level): Promise<PreparedWindowsTerrain> {
  const source = level.getWindowsTerrainSource();
  if (!source || !Number.isInteger(source.graphicSet) || source.graphicSet < 0 || source.graphicSet > 4) return { status: 'unavailable' };
  try {
    const [spriteBytes, paletteBytes] = await Promise.all([
      getWindowsGraphicsFile(`LEVEL${source.graphicSet}B.SPR`),
      getWindowsGraphicsFile(`LEVEL${source.graphicSet}.PAL`),
    ]);
    if (!spriteBytes || !paletteBytes) return { status: 'unavailable' };
    const sprites = decodeWindowsSprites(new Uint8Array(spriteBytes));
    const palette = decodeWindowsPalette(new Uint8Array(paletteBytes));
    // Special maps have no full-resolution Windows equivalent on this disc.
    // Keep their DOS background but allow native Windows sprites and objects.
    if (source.special) return { status: 'ready', layer: level.createSpecialWindowsTerrain(), usesDosBackground: true };
    const layer = new WindowsTerrainLayer(level.width, level.height, source.pieces, sprites, palette);
    return { status: 'ready', layer };
  } catch {
    // Corrupt or unavailable optional graphics must not prevent gameplay.
    return { status: 'unavailable' };
  }
}

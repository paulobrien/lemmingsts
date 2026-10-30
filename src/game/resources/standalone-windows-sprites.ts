import { LemmingsSprite } from './lemmings-sprite';
import { ColorPalette } from './lemmings/color-palette';
import { getWindowsGraphicsFile } from './file/windows-graphics-store';
import { decodeWindowsPalette, decodeWindowsSprites } from './windows-graphics';
import { mapWindowsLemmingSprites } from './windows-lemming-sprites';

/** Build the logical animation frames from locally supplied Windows artwork.
 * Frame sizes and anchors reflect the simulation's logical coordinate system;
 * no DOS graphics data is required. Native-resolution art remains available
 * through the same map as the normal Windows renderer.
 */
export async function prepareStandaloneWindowsSprites(): Promise<LemmingsSprite> {
  const [spriteBytes, paletteBytes] = await Promise.all([
    getWindowsGraphicsFile('LEMMBIG.SPR'), getWindowsGraphicsFile('FE.PAL'),
  ]);
  if (!spriteBytes || !paletteBytes) throw new Error('Windows lemming artwork is missing.');
  const logical = new LemmingsSprite(null, new ColorPalette());
  const native = mapWindowsLemmingSprites(logical,
    decodeWindowsSprites(new Uint8Array(spriteBytes)), decodeWindowsPalette(new Uint8Array(paletteBytes)));
  if (native.size < 300) throw new Error('Windows lemming artwork is incomplete.');
  for (const [frame, source] of native) {
    // Sample at logical pixel centres, taking the native sprite's anchor into
    // account. This fallback raster is also used for picking and canvas output.
    for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
      const sx = (frame.offsetX + x) * 2 - source.offsetX;
      const sy = (frame.offsetY + y) * 2 - source.offsetY;
      if (sx < 0 || sy < 0 || sx >= source.width || sy >= source.height) continue;
      const pixel = source.pixels[sy * source.width + sx];
      if (pixel >>> 24) frame.setPixel(x, y, pixel);
    }
  }
  return logical;
}

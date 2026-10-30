import { Frame } from './frame';
import { getWindowsGraphicsFile } from './file/windows-graphics-store';
import { WINDOWS_UI_GRAPHICS_FILES } from './file/windows-graphics-names';
import { decodeWindowsPalette, decodeWindowsSprites } from './windows-graphics';

export interface WindowsPanelArtwork {
  /** Original Windows order with FF, or the older 12-slot layout without it. */
  panel: Frame[];
  /** Full-resolution Windows pixels and masks in the same order. */
  nativePanel: Frame[];
  /** Locally decoded animation frames in the same order as the panel. */
  animations: Frame[][];
  nativeAnimations: Frame[][];
  /** Original-size PNG data URLs are created locally for the accessible controls. */
  skillIcons: string[];
}

/** Decode owned Windows toolbar artwork. The game data never leaves the device. */
export async function prepareWindowsPanel(): Promise<WindowsPanelArtwork | null> {
  try {
    const [paletteBuffer, ...allAssets] = await Promise.all([
      getWindowsGraphicsFile('FE.PAL'), ...WINDOWS_UI_GRAPHICS_FILES.map(name => getWindowsGraphicsFile(name)),
      getWindowsGraphicsFile('ICO_FF.SPR'),
    ]);
    const assets = allAssets.slice(0, WINDOWS_UI_GRAPHICS_FILES.length);
    const fastForward = allAssets[WINDOWS_UI_GRAPHICS_FILES.length];
    if (!paletteBuffer || assets.some(asset => !asset)) return null;
    const palette = decodeWindowsPalette(new Uint8Array(paletteBuffer));
    if (palette.length !== 256) return null;
    type Converted = { small: Frame[]; native: Frame[]; image: Uint8ClampedArray<ArrayBuffer> };
    const convert = (buffer: ArrayBuffer): Converted | null => {
      const decoded = decodeWindowsSprites(new Uint8Array(buffer));
      const first = decoded[0];
      if (!first || first.width !== 32 || first.height !== 40) return null;
      // A supported disc has at most 29 frames per icon. Bound retained work
      // from imported data; malformed optional animation falls back to frame 0.
      const sources = decoded.length <= 64 && decoded.every(frame => frame.width === 32 && frame.height === 40)
        ? decoded : [first];
      const small: Frame[] = [], native: Frame[] = [];
      const image = new Uint8ClampedArray(32 * 40 * 4);
      sources.forEach((source, frameIndex) => {
        const frame = new Frame(16, 20), full = new Frame(32, 40);
        for (let i = 0; i < source.indices.length; i++) {
          if (!source.mask[i]) continue;
          const rgb = palette[source.indices[i]], r = rgb >> 16 & 255, g = rgb >> 8 & 255, b = rgb & 255;
          if (frameIndex === 0) image.set([r, g, b, 255], i * 4);
          const x = i % 32, y = Math.floor(i / 32);
          const pixel = (0xff000000 | b << 16 | g << 8 | r) >>> 0;
          full.setPixel(x, y, pixel);
          if (!(x % 2) && !(y % 2)) frame.setPixel(x / 2, y / 2, pixel);
        }
        small.push(frame); native.push(full);
      });
      return { small, native, image };
    };
    const converted = assets.map(asset => convert(asset!));
    if (converted.some(item => !item)) return null;
    const decoded = converted as Converted[];
    const skillIcons = decoded.slice(2, 10).map(({ image }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 32; canvas.height = 40;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Windows toolbar canvas unavailable.');
      context.putImageData(new ImageData(image, 32, 40), 0, 0);
      return canvas.toDataURL('image/png');
    });
    const makeResult = (ordered: Converted[]): WindowsPanelArtwork => ({
      panel: ordered.map(item => item.small[0]), nativePanel: ordered.map(item => item.native[0]),
      animations: ordered.map(item => item.small), nativeAnimations: ordered.map(item => item.native), skillIcons,
    });
    // Existing installations without the optional FF artwork keep their old,
    // playable DOS-positioned panel until the missing original file is added.
    if (!fastForward) return makeResult(decoded);
    let ff: Converted | null = null;
    try { ff = convert(fastForward); } catch { /* Optional, keep legacy layout. */ }
    if (!ff) return makeResult(decoded);
    // Eight skills, +, −, pause, fast-forward and nuke, as in Win95.
    return makeResult([...decoded.slice(2, 10), decoded[1], decoded[0], decoded[10], ff, decoded[11]]);
  } catch { return null; }
}

import { Frame } from './frame';
import { getWindowsGraphicsFile } from './file/windows-graphics-store';
import { WINDOWS_UI_GRAPHICS_FILES } from './file/windows-graphics-names';
import { decodeWindowsPalette, decodeWindowsSprites } from './windows-graphics';

export interface WindowsPanelArtwork {
  /** Downsampled icons keep the original HUD hit coordinates and timing. */
  panel: Frame[];
  /** Original-size PNG data URLs are created locally for the accessible controls. */
  skillIcons: string[];
}

/** Decode a complete set of owned Windows toolbar icons; missing assets are optional. */
export async function prepareWindowsPanel(): Promise<WindowsPanelArtwork | null> {
  try {
    const [paletteBuffer, ...assets] = await Promise.all([
      getWindowsGraphicsFile('FE.PAL'), ...WINDOWS_UI_GRAPHICS_FILES.map(name => getWindowsGraphicsFile(name)),
    ]);
    if (!paletteBuffer || assets.some(asset => !asset)) return null;
    const palette = decodeWindowsPalette(new Uint8Array(paletteBuffer));
    if (palette.length !== 256) return null;
    const panel: Frame[] = [];
    const skillIcons: string[] = [];
    for (let index = 0; index < assets.length; index++) {
      const source = decodeWindowsSprites(new Uint8Array(assets[index]!))[0];
      if (!source || source.width !== 32 || source.height !== 40) return null;
      const frame = new Frame(16, 20);
      const pixels = new Uint8ClampedArray(source.width * source.height * 4);
      for (let i = 0; i < source.indices.length; i++) {
        if (!source.mask[i]) continue;
        const rgb = palette[source.indices[i]], r = rgb >> 16 & 255, g = rgb >> 8 & 255, b = rgb & 255;
        pixels.set([r, g, b, 255], i * 4);
        const x = i % source.width, y = Math.floor(i / source.width);
        if (!(x % 2) && !(y % 2)) frame.setPixel(x / 2, y / 2, (0xff000000 | b << 16 | g << 8 | r) >>> 0);
      }
      panel.push(frame);
      if (index >= 2 && index <= 9) {
        const canvas = document.createElement('canvas');
        canvas.width = source.width; canvas.height = source.height;
        const context = canvas.getContext('2d');
        if (!context) return null;
        context.putImageData(new ImageData(pixels, source.width, source.height), 0, 0);
        skillIcons.push(canvas.toDataURL('image/png'));
      }
    }
    return { panel, skillIcons };
  } catch { return null; }
}

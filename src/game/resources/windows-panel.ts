import { Frame } from './frame';
import { getWindowsGraphicsFile } from './file/windows-graphics-store';
import { WINDOWS_UI_GRAPHICS_FILES } from './file/windows-graphics-names';
import { decodeWindowsPalette, decodeWindowsSprites } from './windows-graphics';

export interface WindowsPanelArtwork {
  /** Original Windows order with FF, or the older 12-slot layout without it. */
  panel: Frame[];
  /** Full-resolution Windows pixels and masks in the same order. */
  nativePanel: Frame[];
  /** Original-size PNG data URLs are created locally for the accessible controls. */
  skillIcons: string[];
}

/** Decode a complete set of owned Windows toolbar icons; missing assets are optional. */
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
    const panel: Frame[] = [];
    const nativePanel: Frame[] = [];
    const skillIcons: string[] = [];
    for (let index = 0; index < assets.length; index++) {
      const source = decodeWindowsSprites(new Uint8Array(assets[index]!))[0];
      if (!source || source.width !== 32 || source.height !== 40) return null;
      const frame = new Frame(16, 20);
      const native = new Frame(32, 40);
      const pixels = new Uint8ClampedArray(source.width * source.height * 4);
      for (let i = 0; i < source.indices.length; i++) {
        if (!source.mask[i]) continue;
        const rgb = palette[source.indices[i]], r = rgb >> 16 & 255, g = rgb >> 8 & 255, b = rgb & 255;
        pixels.set([r, g, b, 255], i * 4);
        const x = i % source.width, y = Math.floor(i / source.width);
        native.setPixel(x, y, (0xff000000 | b << 16 | g << 8 | r) >>> 0);
        if (!(x % 2) && !(y % 2)) frame.setPixel(x / 2, y / 2, (0xff000000 | b << 16 | g << 8 | r) >>> 0);
      }
      panel.push(frame);
      nativePanel.push(native);
      if (index >= 2 && index <= 9) {
        const canvas = document.createElement('canvas');
        canvas.width = source.width; canvas.height = source.height;
        const context = canvas.getContext('2d');
        if (!context) return null;
        context.putImageData(new ImageData(pixels, source.width, source.height), 0, 0);
        skillIcons.push(canvas.toDataURL('image/png'));
      }
    }
    // Older installations may not have the optional FF sprite. Keep their
    // existing playable 12-slot panel until the player supplies the artwork.
    if (!fastForward) return { panel, nativePanel, skillIcons };
    let ff: Frame;
    let nativeFf: Frame;
    try {
      const source = decodeWindowsSprites(new Uint8Array(fastForward))[0];
      if (!source || source.width !== 32 || source.height !== 40) return { panel, nativePanel, skillIcons };
      ff = new Frame(16, 20);
      nativeFf = new Frame(32, 40);
      for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
        const index = y * source.width + x;
        if (!source.mask[index]) continue;
        const rgb = palette[source.indices[index]], r = rgb >> 16 & 255, g = rgb >> 8 & 255, b = rgb & 255;
        const pixel = (0xff000000 | b << 16 | g << 8 | r) >>> 0;
        nativeFf.setPixel(x, y, pixel);
        if (!(x % 2) && !(y % 2)) ff.setPixel(x / 2, y / 2, pixel);
      }
    } catch { return { panel, nativePanel, skillIcons }; }
    // Windows 95 uses the eight skills first, then +, −, pause, fast
    // forward and nuke. The old fallback above keeps DOS-style coordinates.
    return { panel: [...panel.slice(2, 10), panel[1], panel[0], panel[10], ff, panel[11]],
      nativePanel: [...nativePanel.slice(2, 10), nativePanel[1], nativePanel[0], nativePanel[10], nativeFf, nativePanel[11]], skillIcons };
  } catch { return null; }
}

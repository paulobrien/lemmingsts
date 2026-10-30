import { LevelElement } from './lemmings/level-element';
import { WindowsSpriteFrame } from './windows-graphics';

/** Presentation-only 2× terrain; simulation continues to use the DOS mask. */
export class WindowsTerrainLayer {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
  private readonly mask: Uint8Array;

  /** Preserve special DOS scenery when no corresponding Windows art exists. */
  static fromLogicalImage(width: number, height: number, image: Uint8ClampedArray): WindowsTerrainLayer {
    if (image.length !== width * height * 4) throw new Error('Invalid logical terrain image.');
    const layer = new WindowsTerrainLayer(width, height, [], [], new Uint32Array());
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const color = (image[index] << 16) | (image[index + 1] << 8) | image[index + 2];
      layer.update(x, y, color, image[index + 3] !== 0);
    }
    return layer;
  }

  constructor(
    readonly logicalWidth: number,
    readonly logicalHeight: number,
    pieces: readonly LevelElement[],
    frames: readonly WindowsSpriteFrame[],
    palette: Uint32Array,
  ) {
    if (!Number.isInteger(logicalWidth) || !Number.isInteger(logicalHeight) ||
        logicalWidth < 1 || logicalHeight < 1 || logicalWidth * logicalHeight > 4_000_000) {
      throw new Error('Invalid Windows terrain dimensions.');
    }
    this.width = logicalWidth * 2;
    this.height = logicalHeight * 2;
    this.pixels = new Uint8ClampedArray(this.width * this.height * 4);
    this.mask = new Uint8Array(this.width * this.height);
    for (const piece of pieces) {
      const frame = frames[piece.id];
      if (!frame || frame.indices.length !== frame.width * frame.height || frame.mask.length !== frame.indices.length) {
        throw new Error('Windows terrain piece is unavailable or invalid.');
      }
      const props = piece.drawProperties;
      for (let y = 0; y < frame.height; y++) {
        const targetY = piece.y * 2 + y;
        if (targetY < 0 || targetY >= this.height) continue;
        const sourceY = props.isUpsideDown ? frame.height - y - 1 : y;
        for (let x = 0; x < frame.width; x++) {
          const targetX = piece.x * 2 + x;
          if (targetX < 0 || targetX >= this.width) continue;
          const source = sourceY * frame.width + x;
          if (!frame.mask[source]) continue;
          const dest = targetY * this.width + targetX;
          if (props.isErase) { this.writePixel(dest, 0, false); continue; }
          if ((props.noOverwrite && this.mask[dest]) || (props.onlyOverwrite && !this.mask[dest])) continue;
          const index = frame.indices[source];
          if (index >= palette.length) throw new Error('Windows terrain palette is incomplete.');
          this.writePixel(dest, palette[index], true);
        }
      }
    }
  }

  /** Apply the same logical pixel mutation to its four display pixels. */
  setGroundAt(x: number, y: number, color: number): void { this.update(x, y, color, true); }
  clearGroundAt(x: number, y: number): void { this.update(x, y, 0, false); }

  private update(x: number, y: number, color: number, solid: boolean): void {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= this.logicalWidth || y >= this.logicalHeight) return;
    const first = y * 2 * this.width + x * 2;
    this.writePixel(first, color, solid);
    this.writePixel(first + 1, color, solid);
    this.writePixel(first + this.width, color, solid);
    this.writePixel(first + this.width + 1, color, solid);
  }

  private writePixel(index: number, color: number, solid: boolean): void {
    this.mask[index] = solid ? 1 : 0;
    const offset = index * 4;
    this.pixels[offset] = solid ? (color >>> 16) & 255 : 0;
    this.pixels[offset + 1] = solid ? (color >>> 8) & 255 : 0;
    this.pixels[offset + 2] = solid ? color & 255 : 0;
    this.pixels[offset + 3] = solid ? 255 : 0;
  }
}

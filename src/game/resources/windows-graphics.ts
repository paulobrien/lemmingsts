/** Standalone readers for Windows Lemmings' indexed SRLE sprites and palettes.
 * Format notes: https://www.lemmingsforums.net/index.php?topic=439.0
 * Original image bytes are supplied by the player; none are bundled here.
 */

export interface WindowsSpriteFrame {
  width: number;
  height: number;
  /** Eight-bit palette indices; transparency is carried separately in mask. */
  indices: Uint8Array;
  mask: Uint8Array;
}

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FRAMES = 4096;
const MAX_DIMENSION = 4096;
const MAX_TOTAL_PIXELS = 32 * 1024 * 1024;

/** Decode SRLE frames into independent indexed pixels and opacity masks. */
export function decodeWindowsSprites(input: Uint8Array): WindowsSpriteFrame[] {
  const fail = (): never => { throw new Error('Invalid Windows Lemmings SRLE sprite data.'); };
  if (input.length < 10 || input.length > MAX_BYTES ||
      input[0] !== 0x53 || input[1] !== 0x52 || input[2] !== 0x4c || input[3] !== 0x45) return fail();
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const count = view.getUint16(4, true);
  const tableEnd = 6 + count * 4;
  if (!count || count > MAX_FRAMES || tableEnd > input.length) return fail();
  const offsets: number[] = [];
  for (let index = 0; index < count; index++) {
    const offset = view.getUint32(6 + index * 4, true);
    if (offset < tableEnd || offset + 12 > input.length || (index && offset <= offsets[index - 1])) return fail();
    offsets.push(offset);
  }
  let totalPixels = 0;
  return offsets.map((offset, frameIndex) => {
    const limit = offsets[frameIndex + 1] ?? input.length;
    if (offset + 12 > limit) return fail();
    const left = view.getUint16(offset, true), top = view.getUint16(offset + 2, true);
    const dataWidth = view.getUint16(offset + 4, true), dataHeight = view.getUint16(offset + 6, true);
    const width = view.getUint16(offset + 8, true), height = view.getUint16(offset + 10, true);
    if (!width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION ||
        left + dataWidth > width || top + dataHeight > height) return fail();
    totalPixels += width * height;
    if (totalPixels > MAX_TOTAL_PIXELS) return fail();
    const indices = new Uint8Array(width * height);
    const mask = new Uint8Array(width * height);
    let cursor = offset + 12;
    for (let row = 0; row < dataHeight; row++) {
      let column = 0;
      while (true) {
        if (cursor >= limit) return fail();
        const control = input[cursor++];
        if (control === 0x80) break;
        if (control < 0x80) {
          column += control;
          if (column > dataWidth) return fail();
          continue;
        }
        const length = control - 0x80;
        if (column + length > dataWidth || cursor + length > limit) return fail();
        const destination = (top + row) * width + left + column;
        indices.set(input.subarray(cursor, cursor + length), destination);
        mask.fill(1, destination, destination + length);
        cursor += length;
        column += length;
      }
    }
    if (cursor !== limit) return fail();
    return { width, height, indices, mask };
  });
}

/** Decode a PAL file's RGB byte entries into 0xRRGGBB values; caller chooses the index base. */
export function decodeWindowsPalette(input: Uint8Array): Uint32Array {
  const fail = (): never => { throw new Error('Invalid Windows Lemmings palette data.'); };
  if (input.length < 10 || input[0] !== 0x20 || input[1] !== 0x4c || input[2] !== 0x41 || input[3] !== 0x50) return fail();
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const count = view.getUint16(4, true);
  if (!count || count > 256 || input.length !== 6 + count * 4) return fail();
  const colors = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 4;
    colors[i] = (input[offset] << 16) | (input[offset + 1] << 8) | input[offset + 2];
  }
  return colors;
}

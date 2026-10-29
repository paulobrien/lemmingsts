/**
 * Make a 2× image with gently softened interior corners. This is a local,
 * deterministic filter: three similar neighbours must agree before one
 * half of their colour is mixed into the corresponding corner pixel.
 *
 * Alpha is copied unchanged from each source pixel to all four output pixels;
 * colours are never sampled across an alpha boundary. Supply `destination` to
 * reuse its memory across frames. The filter does not modify `source`.
 */
export function upscalePixelArt2x(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  destination?: Uint8ClampedArray,
): Uint8ClampedArray {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      !Number.isSafeInteger(width * height * 16) || source.length !== width * height * 4) {
    throw new RangeError('Pixel data must match positive integer image dimensions.');
  }
  const length = width * height * 16;
  const output = destination ?? new Uint8ClampedArray(length);
  if (output.length !== length) throw new RangeError('Destination must hold the complete 2× image.');
  if (source.buffer === output.buffer && source.byteOffset < output.byteOffset + output.byteLength &&
      output.byteOffset < source.byteOffset + source.byteLength) {
    throw new RangeError('Source and destination must not overlap.');
  }

  const rowStride = width * 8;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const center = (y * width + x) * 4;
      const topLeft = y * 2 * rowStride + x * 8;
      // Nearest-neighbour is the baseline, preserving all four alpha values.
      for (let channel = 0; channel < 4; channel++) {
        const value = source[center + channel];
        output[topLeft + channel] = value;
        output[topLeft + 4 + channel] = value;
        output[topLeft + rowStride + channel] = value;
        output[topLeft + rowStride + 4 + channel] = value;
      }
      if (source[center + 3] === 0) continue;
      // Only complete neighbourhoods can establish a reliable corner.
      if (x > 0 && y > 0) blendCorner(source, output, center, center - width * 4, center - 4, center - width * 4 - 4,
        y + 1 < height ? center + width * 4 : center, x + 1 < width ? center + 4 : center, topLeft);
      if (x + 1 < width && y > 0) blendCorner(source, output, center, center - width * 4, center + 4, center - width * 4 + 4,
        y + 1 < height ? center + width * 4 : center, x > 0 ? center - 4 : center, topLeft + 4);
      if (x > 0 && y + 1 < height) blendCorner(source, output, center, center + width * 4, center - 4, center + width * 4 - 4,
        y > 0 ? center - width * 4 : center, x + 1 < width ? center + 4 : center, topLeft + rowStride);
      if (x + 1 < width && y + 1 < height) blendCorner(source, output, center, center + width * 4, center + 4, center + width * 4 + 4,
        y > 0 ? center - width * 4 : center, x > 0 ? center - 4 : center, topLeft + rowStride + 4);
    }
  }
  return output;
}

function distance(data: Uint8ClampedArray, a: number, b: number): number {
  return Math.abs(data[a] - data[b]) + Math.abs(data[a + 1] - data[b + 1]) + Math.abs(data[a + 2] - data[b + 2]);
}

function blendCorner(data: Uint8ClampedArray, output: Uint8ClampedArray, center: number,
  first: number, second: number, diagonal: number, oppositeFirst: number, oppositeSecond: number, target: number): void {
  const alpha = data[center + 3];
  if (data[first + 3] !== alpha || data[second + 3] !== alpha || data[diagonal + 3] !== alpha) return;
  // A narrow colour tolerance lets subtly shaded artwork form one edge.
  if (distance(data, first, second) > 36 || distance(data, first, diagonal) > 36 ||
      distance(data, center, first) < 48 || distance(data, center, second) < 48) return;
  // Do not erase an isolated pixel surrounded on every side by one colour.
  if (distance(data, center, oppositeFirst) > 36 && distance(data, center, oppositeSecond) > 36) return;
  for (let channel = 0; channel < 3; channel++) {
    const neighbours = Math.round((data[first + channel] + data[second + channel] + data[diagonal + channel]) / 3);
    output[target + channel] = Math.round((data[center + channel] + neighbours) / 2);
  }
}

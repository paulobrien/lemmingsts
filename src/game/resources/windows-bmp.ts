/** Decode bounded, uncompressed 8-bit Windows BMP artwork supplied by the player. */
export function decodeWindowsBmp(bytes: Uint8Array): { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> } {
  if (bytes.length < 54 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) throw new Error('Invalid Windows bitmap.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = view.getUint32(10, true), headerSize = view.getUint32(14, true);
  const width = view.getInt32(18, true), signedHeight = view.getInt32(22, true);
  const height = Math.abs(signedHeight), colors = view.getUint32(46, true) || 256;
  const paletteStart = 14 + headerSize;
  const stride = Math.ceil(width / 4) * 4;
  if (headerSize < 40 || width < 1 || width > 2048 || height < 1 || height > 2048 ||
      width * height > 2_000_000 || view.getUint16(26, true) !== 1 || view.getUint16(28, true) !== 8 ||
      view.getUint32(30, true) !== 0 || colors > 256 || paletteStart + colors * 4 > offset ||
      offset + stride * height > bytes.length) throw new Error('Unsupported Windows bitmap.');
  const result = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = offset + (signedHeight > 0 ? height - y - 1 : y) * stride;
    for (let x = 0; x < width; x++) {
      const index = bytes[row + x];
      if (index >= colors) throw new Error('Invalid Windows bitmap palette.');
      const p = paletteStart + index * 4;
      const dest = (y * width + x) * 4;
      result[dest] = bytes[p + 2]; result[dest + 1] = bytes[p + 1]; result[dest + 2] = bytes[p]; result[dest + 3] = 255;
    }
  }
  return { width, height, data: result };
}

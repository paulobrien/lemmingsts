/** Structural checks for the DOS files consumed by this app, before storage. */
export function validateDosFiles(files: readonly { name: string; data: ArrayBuffer }[]): void {
  for (const { name, data } of files) {
    try {
      const bytes = new Uint8Array(data);
      if (/^GROUND[0-4]O\.DAT$/.test(name)) {
        if (bytes.length !== 1056) throw new Error('invalid ground metadata');
      } else if (name === 'ODDTABLE.DAT') {
        // The original level order uses all 80 physical level slots.
        if (bytes.length < 80 * 56 || bytes.length % 56 !== 0) throw new Error('invalid odd table');
      } else {
        const parts = validateContainer(bytes);
        // These minima cover the sprite, masks, panel numbers, home artwork,
        // and panel/letter ranges actually read by the current DOS renderer.
        if (name === 'MAIN.DAT' && (parts.length < 7 || parts[0] < 21104 || parts[1] < 388 || parts[2] < 6560 || parts[3] < 38024 || parts[6] < 8224)) throw new Error('invalid main resources');
        if (name === 'ADLIB.DAT' && (parts.length < 1 || parts[0] < 22025)) throw new Error('invalid audio resources');
        if (/^LEVEL\d{3}\.DAT$/.test(name) && (parts.length < 8 || parts.slice(0, 8).some(size => size !== 2048))) throw new Error('invalid level resources');
        if (/^VGAGR[0-4]\.DAT$/.test(name) && parts.length < 2) throw new Error('invalid graphic resources');
        if (/^VGASPEC[0-3]\.DAT$/.test(name) && (parts.length < 1 || parts[0] < 40)) throw new Error('invalid special graphic resources');
      }
    } catch {
      throw new Error(`${name} is damaged or incompatible with the supported original DOS game. Your existing game files were not changed.`);
    }
  }
}

/** Validate chunk bounds, checksum and compressed stream without materializing game data. */
function validateContainer(bytes: Uint8Array): number[] {
  const sizes: number[] = [];
  const word = (offset: number) => (bytes[offset] << 8) | bytes[offset + 1];
  let start = 0;
  while (start < bytes.length) {
    if (sizes.length >= 16) throw new Error('too many chunks');
    if (start + 11 > bytes.length) throw new Error('truncated chunk');
    const initialBits = bytes[start];
    const checksum = bytes[start + 1];
    const outputSize = word(start + 4);
    const chunkSize = word(start + 8);
    if (initialBits > 8 || outputSize === 0 || chunkSize < 11 || start + chunkSize > bytes.length) throw new Error('invalid chunk header');
    let xor = 0;
    for (let index = start + 10; index < start + chunkSize; index++) xor ^= bytes[index];
    if (xor !== checksum) throw new Error('checksum mismatch');

    let pos = start + chunkSize - 1;
    let buffer = bytes[pos];
    let remainingBits = initialBits;
    const read = (count: number) => {
      let result = 0;
      for (let index = 0; index < count; index++) {
        if (remainingBits === 0) {
          if (--pos < start + 10) throw new Error('truncated compressed stream');
          buffer = bytes[pos];
          remainingBits = 8;
        }
        result = (result << 1) | (buffer & 1);
        buffer >>>= 1;
        remainingBits--;
      }
      return result;
    };
    let written = 0;
    while (written < outputSize) {
      let count: number;
      let offsetBits = 0;
      if (read(1) === 0) {
        if (read(1) === 0) count = read(3) + 1;
        else { count = 2; offsetBits = 8; }
      } else {
        switch (read(2)) {
          case 0: count = 3; offsetBits = 9; break;
          case 1: count = 4; offsetBits = 10; break;
          case 2: count = read(8) + 1; offsetBits = 12; break;
          default: count = read(8) + 9; break;
        }
      }
      if (count > outputSize - written) throw new Error('decompression overflow');
      if (offsetBits) {
        if (read(offsetBits) + 1 > written) throw new Error('invalid back reference');
      } else {
        for (let index = 0; index < count; index++) read(8);
      }
      written += count;
    }
    sizes.push(outputSize);
    start += chunkSize;
  }
  if (sizes.length === 0) throw new Error('empty container');
  return sizes;
}

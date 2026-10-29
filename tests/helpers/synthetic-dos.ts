// Invented data with valid DOS chunk structure, never proprietary game data.
export function syntheticDosData(name: string, value: number): Uint8Array {
  if (name.startsWith('GROUND')) return new Uint8Array(1056);
  if (name === 'ODDTABLE.DAT') return new Uint8Array(80 * 56);
  const lengths = name === 'MAIN.DAT' ? [21104, 388, 6560, 38024, 1, 1, 8224]
    : name === 'ADLIB.DAT' ? [22025]
    : name.startsWith('LEVEL') ? Array(8).fill(2048)
    : name.startsWith('VGAGR') ? [1, 1] : [40];
  const parts = lengths.map(length => chunk(length, value));
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function chunk(length: number, value: number): Uint8Array {
  const bits: number[] = [];
  const push = (number: number, width: number) => {
    for (let bit = width - 1; bit >= 0; bit--) bits.push((number >> bit) & 1);
  };
  push(0, 2); push(0, 3); push(value, 8);
  for (let left = length - 1; left > 0;) {
    const count = Math.min(left, 256);
    push(0b110, 3); push(count - 1, 8); push(0, 12);
    left -= count;
  }
  const first = bits.length % 8 || 8;
  const groups: number[] = [];
  for (let index = 0, width = first; index < bits.length; width = 8) {
    let byte = 0;
    for (let bit = 0; bit < width; bit++) byte |= bits[index++] << bit;
    groups.push(byte);
  }
  const payload = Uint8Array.from(groups.reverse());
  const size = payload.length + 10;
  const checksum = payload.reduce((a, b) => a ^ b, 0);
  return Uint8Array.from([first, checksum, 0, 0, length >> 8, length & 255, 0, 0, size >> 8, size & 255, ...payload]);
}

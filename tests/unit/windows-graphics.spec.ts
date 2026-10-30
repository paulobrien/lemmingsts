import { describe, expect, it } from 'vitest';
import { decodeWindowsPalette, decodeWindowsSprites } from '../../src/game/resources/windows-graphics';

function sprite(frames: { header: number[]; body: number[] }[]): Uint8Array {
  const encoded = frames.map(({ header, body }) => {
    const result = new Uint8Array(12 + body.length);
    const view = new DataView(result.buffer);
    header.forEach((value, index) => view.setUint16(index * 2, value, true));
    result.set(body, 12);
    return result;
  });
  const output = new Uint8Array(6 + 4 * frames.length + encoded.reduce((total, frame) => total + frame.length, 0));
  output.set([0x53, 0x52, 0x4c, 0x45]);
  const view = new DataView(output.buffer);
  view.setUint16(4, frames.length, true);
  let offset = 6 + 4 * frames.length;
  encoded.forEach((frame, index) => {
    view.setUint32(6 + 4 * index, offset, true);
    output.set(frame, offset);
    offset += frame.length;
  });
  return output;
}

describe('Windows Lemmings SRLE graphics', () => {
  it('decodes transparent margins, multiple runs and empty rows', () => {
    const bytes = sprite([{ header: [1, 1, 6, 2, 8, 3], body: [1, 0x82, 0x11, 0x22, 1, 0x81, 0x33, 0x80, 0x80] }]);
    const [frame] = decodeWindowsSprites(bytes);
    expect([frame.width, frame.height]).toEqual([8, 3]);
    expect(Array.from(frame.indices.slice(8, 16))).toEqual([0, 0, 0x11, 0x22, 0, 0x33, 0, 0]);
    expect(Array.from(frame.mask.slice(8, 16))).toEqual([0, 0, 1, 1, 0, 1, 0, 0]);
    expect(frame.mask.slice(16).some(Boolean)).toBe(false);
  });

  it('supports extended offsets and frame offsets above 65535', () => {
    const line = [0xff, ...Array(127).fill(1), 0xff, ...Array(127).fill(2), 0x82, 3, 4, 0x80];
    const first = { header: [0, 0, 256, 256, 256, 256], body: Array.from({ length: 256 }, () => line).flat() };
    const second = { header: [0, 0, 260, 1, 260, 1], body: [127, 127, 2, 0x82, 7, 9, 0x80] };
    const frames = decodeWindowsSprites(sprite([first, second]));
    expect(frames[0].indices[255]).toBe(4);
    expect(Array.from(frames[1].indices.slice(256, 258))).toEqual([7, 9]);
    expect(Array.from(frames[1].mask.slice(254, 259))).toEqual([0, 0, 1, 1, 0]);
  });

  it('preserves an opaque palette index zero independently from transparency', () => {
    const [frame] = decodeWindowsSprites(sprite([{ header: [0, 0, 1, 1, 1, 1], body: [0x81, 0, 0x80] }]));
    expect(frame.indices[0]).toBe(0);
    expect(frame.mask[0]).toBe(1);
  });

  it('rejects corrupt frame tables, truncated runs, and out-of-bounds drawing', () => {
    const good = sprite([{ header: [0, 0, 2, 1, 2, 1], body: [0x82, 1, 2, 0x80] }]);
    expect(() => decodeWindowsSprites(good.slice(0, -1))).toThrow('Invalid Windows Lemmings SRLE');
    const badOffset = good.slice(); new DataView(badOffset.buffer).setUint32(6, 1, true);
    expect(() => decodeWindowsSprites(badOffset)).toThrow('Invalid Windows Lemmings SRLE');
    const oversizedRun = sprite([{ header: [0, 0, 1, 1, 1, 1], body: [0x82, 1, 2, 0x80] }]);
    expect(() => decodeWindowsSprites(oversizedRun)).toThrow('Invalid Windows Lemmings SRLE');
    const impossibleHeader = sprite([{ header: [1, 0, 2, 1, 2, 1], body: [0x80] }]);
    expect(() => decodeWindowsSprites(impossibleHeader)).toThrow('Invalid Windows Lemmings SRLE');
  });

  it('reads bounded PAL entries in RGB byte order', () => {
    const input = Uint8Array.from([0x20, 0x4c, 0x41, 0x50, 2, 0, 0, 0, 0, 0, 0x11, 0x22, 0x33, 0]);
    expect(Array.from(decodeWindowsPalette(input))).toEqual([0, 0x112233]);
    expect(() => decodeWindowsPalette(input.slice(0, -1))).toThrow('Invalid Windows Lemmings palette');
  });
});

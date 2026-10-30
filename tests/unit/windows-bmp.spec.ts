import { expect, it } from 'vitest';
import { decodeWindowsBmp } from '../../src/game/resources/windows-bmp';
import { windowsBitmap } from '../helpers/synthetic-windows';

it('decodes indexed bitmap artwork into bounded RGBA pixels', () => {
  const image = decodeWindowsBmp(windowsBitmap());
  expect([image.width, image.height]).toEqual([2, 1]);
  expect(Array.from(image.data)).toEqual([30, 20, 10, 255, 60, 50, 40, 255]);
});

it('rejects malformed dimensions, compression, palettes and truncated pixels', () => {
  const original = windowsBitmap();
  expect(() => decodeWindowsBmp(original.subarray(0, 50))).toThrow();
  for (const [offset, value] of [[18, 0x7fffffff], [30, 1], [46, 300], [10, 50]] as const) {
    const bytes = original.slice(); new DataView(bytes.buffer).setUint32(offset, value, true);
    expect(() => decodeWindowsBmp(bytes)).toThrow();
  }
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { upscalePixelArt2x } from '../../src/game/view/pixel-art-upscale';

const pixel = (rgb: number, alpha = 255) => [rgb, rgb, rgb, alpha];
const rgba = (rows: number[][]) => Uint8ClampedArray.from(rows.flatMap(row => row.flatMap(value => pixel(value))));
const at = (image: Uint8ClampedArray, width: number, x: number, y: number) =>
  Array.from(image.slice((y * width + x) * 4, (y * width + x + 1) * 4));

describe('2× pixel-art enhancement', () => {
  it('preserves flat colours, dimensions and the supplied reusable output buffer', () => {
    const input = rgba([[30, 30], [30, 30]]);
    const snapshot = input.slice();
    const destination = new Uint8ClampedArray(4 * 4 * 4);
    expect(upscalePixelArt2x(input, 2, 2, destination)).toBe(destination);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) expect(at(destination, 4, x, y)).toEqual(pixel(30));
    expect(input).toEqual(snapshot);
  });

  it('softens the corresponding quarter of a colour-agreed diagonal corner', () => {
    const input = rgba([[100, 100, 0], [100, 0, 0], [0, 0, 0]]);
    const result = upscalePixelArt2x(input, 3, 3);
    expect(at(result, 6, 2, 2)).toEqual(pixel(50));
    expect(at(result, 6, 3, 2)).toEqual(pixel(0));
    expect(at(result, 6, 2, 3)).toEqual(pixel(0));
    expect(at(result, 6, 3, 3)).toEqual(pixel(0));
    expect(upscalePixelArt2x(input, 3, 3)).toEqual(result);
  });

  it('retains isolated pixels and straight edges', () => {
    const isolated = rgba([[100, 100, 100], [100, 0, 100], [100, 100, 100]]);
    const result = upscalePixelArt2x(isolated, 3, 3);
    for (const x of [2, 3]) for (const y of [2, 3]) expect(at(result, 6, x, y)).toEqual(pixel(0));
    const edge = rgba([[100, 100, 100], [0, 0, 0], [0, 0, 0]]);
    const scaled = upscalePixelArt2x(edge, 3, 3);
    expect(at(scaled, 6, 2, 2)).toEqual(pixel(0));
    expect(at(scaled, 6, 3, 2)).toEqual(pixel(0));
  });

  it('treats close shades as one edge while preserving partial alpha', () => {
    const colors = [100, 102, 0, 98, 0, 0, 0, 0, 0];
    const input = Uint8ClampedArray.from(colors.flatMap(color => pixel(color, 128)));
    const result = upscalePixelArt2x(input, 3, 3);
    expect(at(result, 6, 2, 2)).toEqual(pixel(50, 128));
    expect(at(result, 6, 3, 3)).toEqual(pixel(0, 128));
  });

  it('preserves alpha exactly and does not borrow colours across transparency', () => {
    const values = [
      ...pixel(100, 255), ...pixel(100, 255), ...pixel(0, 0),
      ...pixel(100, 255), ...pixel(0, 128), ...pixel(0, 128),
      ...pixel(0, 0), ...pixel(0, 128), ...pixel(0, 128),
    ];
    const input = Uint8ClampedArray.from(values);
    const result = upscalePixelArt2x(input, 3, 3);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        expect(at(result, 6, x * 2 + dx, y * 2 + dy)[3]).toBe(input[(y * 3 + x) * 4 + 3]);
      }
    }
    expect(at(result, 6, 2, 2)).toEqual(pixel(0, 128));
  });

  it('rejects invalid dimensions and overlapping or incorrectly sized buffers', () => {
    expect(() => upscalePixelArt2x(new Uint8ClampedArray(4), 0, 1)).toThrow(RangeError);
    expect(() => upscalePixelArt2x(new Uint8ClampedArray(4), 1.5, 1)).toThrow(RangeError);
    expect(() => upscalePixelArt2x(new Uint8ClampedArray(8), 1, 1)).toThrow(RangeError);
    expect(() => upscalePixelArt2x(new Uint8ClampedArray(4), 1, 1, new Uint8ClampedArray(15))).toThrow(RangeError);
    const shared = new Uint8ClampedArray(16);
    expect(() => upscalePixelArt2x(shared.subarray(0, 4), 1, 1, shared)).toThrow(RangeError);
  });
});

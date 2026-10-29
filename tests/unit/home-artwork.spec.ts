// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { Frame } from '../../src/game/resources/frame';

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../../src/game/resources/file/game-file-store', () => ({ getLemmingsFile: mocks.read }));
import { loadHomeArtwork, paintHomeArtwork } from '../../src/game/resources/home-artwork';

beforeEach(() => { mocks.read.mockReset(); });

it('does not invent artwork when the original file is missing or incomplete', async () => {
  mocks.read.mockResolvedValueOnce(undefined).mockResolvedValueOnce(new ArrayBuffer(12));
  expect(await loadHomeArtwork()).toBeNull();
  expect(await loadHomeArtwork()).toBeNull();
  expect(mocks.read).toHaveBeenCalledWith('MAIN.DAT');
});

it('paints the decoded frame into a canvas without creating an image URL', () => {
  const canvas = document.createElement('canvas');
  const putImageData = vi.fn();
  vi.spyOn(canvas, 'getContext').mockReturnValue({ putImageData } as unknown as CanvasRenderingContext2D);
  const frame = new Frame(2, 1);
  frame.setPixel(0, 0, 0xff332211);
  const imageData = vi.fn(function (data: Uint8ClampedArray, width: number, height: number) {
    return { data, width, height };
  });
  vi.stubGlobal('ImageData', imageData);
  try {
    expect(paintHomeArtwork(canvas, frame)).toBe(true);
    expect([canvas.width, canvas.height]).toEqual([2, 1]);
    expect(putImageData).toHaveBeenCalledOnce();
    expect(imageData).toHaveBeenCalledWith(frame.getData(), 2, 1);
  } finally {
    vi.unstubAllGlobals();
  }
});

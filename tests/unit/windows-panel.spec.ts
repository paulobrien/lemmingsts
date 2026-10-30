// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WINDOWS_UI_GRAPHICS_FILES } from '../../src/game/resources/file/windows-graphics-names';

const mocks = vi.hoisted(() => ({ read: vi.fn(), palette: vi.fn(), sprites: vi.fn(), putImageData: vi.fn() }));
vi.mock('../../src/game/resources/file/windows-graphics-store', () => ({ getWindowsGraphicsFile: mocks.read }));
vi.mock('../../src/game/resources/windows-graphics', () => ({ decodeWindowsPalette: mocks.palette, decodeWindowsSprites: mocks.sprites }));
import { prepareWindowsPanel } from '../../src/game/resources/windows-panel';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue(new ArrayBuffer(1));
  const palette = new Uint32Array(256); palette[1] = 0x112233;
  mocks.palette.mockReturnValue(palette);
  const indices = new Uint8Array(32 * 40), mask = new Uint8Array(32 * 40);
  indices[0] = 1; mask[0] = 1; indices[1] = 1; mask[1] = 1; indices[2] = 1; // Transparent pixels stay transparent.
  mocks.sprites.mockReturnValue([{ width: 32, height: 40, indices, mask }]);
  vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ putImageData: mocks.putImageData }), toDataURL: () => 'data:image/png;base64,local' }) });
});

describe('Windows toolbar artwork', () => {
  it('prepares the original Windows order including fast forward', async () => {
    const artwork = await prepareWindowsPanel();
    expect(mocks.read).toHaveBeenCalledTimes(WINDOWS_UI_GRAPHICS_FILES.length + 2);
    expect(artwork?.panel).toHaveLength(13);
    expect(artwork?.nativePanel).toHaveLength(13);
    expect([artwork?.nativePanel[0].width, artwork?.nativePanel[0].height]).toEqual([32, 40]);
    expect(artwork?.nativePanel[0].getBuffer()[1]).toBe(0xff332211);
    expect(artwork?.nativePanel[0].getMask()[1]).toBe(1);
    expect(artwork?.nativePanel[0].getMask()[2]).toBe(0);
    expect(artwork?.skillIcons).toHaveLength(8);
    expect([artwork?.panel[0].width, artwork?.panel[0].height]).toEqual([16, 20]);
    expect(artwork?.panel[0].getBuffer()[0]).toBe(0xff332211);
    expect(artwork?.panel[0].getMask()[1]).toBe(0);
    expect(mocks.putImageData).toHaveBeenCalledTimes(8);
  });

  it('puts skills before plus, minus, pause, fast forward and nuke', async () => {
    const palette = new Uint32Array(256); for (let i = 1; i <= 13; i++) palette[i] = i;
    mocks.palette.mockReturnValue(palette);
    let index = 0;
    mocks.sprites.mockImplementation(() => {
      const indices = new Uint8Array(32 * 40), mask = new Uint8Array(32 * 40);
      indices[0] = ++index; mask[0] = 1;
      return [{ width: 32, height: 40, indices, mask }];
    });
    const artwork = await prepareWindowsPanel();
    expect(artwork?.panel.map(frame => (frame.getBuffer()[0] >>> 16) & 255))
      .toEqual([3, 4, 5, 6, 7, 8, 9, 10, 2, 1, 11, 13, 12]);
  });

  it('keeps existing imports playable when fast-forward art is missing', async () => {
    mocks.read.mockImplementation(async (name: string) => name === 'ICO_FF.SPR' ? undefined : new ArrayBuffer(1));
    const artwork = await prepareWindowsPanel();
    expect(artwork?.panel).toHaveLength(12);
    expect(artwork?.nativePanel).toHaveLength(12);
    expect(artwork?.skillIcons).toHaveLength(8);
  });

  it('falls back when an icon is missing or has unexpected dimensions', async () => {
    mocks.read.mockResolvedValueOnce(undefined);
    expect(await prepareWindowsPanel()).toBeNull();
    mocks.read.mockResolvedValue(new ArrayBuffer(1));
    mocks.sprites.mockReturnValue([{ width: 1, height: 1 }]);
    expect(await prepareWindowsPanel()).toBeNull();
  });
});

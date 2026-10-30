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
  indices[0] = 1; mask[0] = 1; indices[2] = 1; // Transparent pixels stay transparent.
  mocks.sprites.mockReturnValue([{ width: 32, height: 40, indices, mask }]);
  vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ putImageData: mocks.putImageData }), toDataURL: () => 'data:image/png;base64,local' }) });
});

describe('Windows toolbar artwork', () => {
  it('prepares the native icons and preserves the classic HUD hit areas', async () => {
    const artwork = await prepareWindowsPanel();
    expect(mocks.read).toHaveBeenCalledTimes(WINDOWS_UI_GRAPHICS_FILES.length + 1);
    expect(artwork?.panel).toHaveLength(12);
    expect(artwork?.skillIcons).toHaveLength(8);
    expect([artwork?.panel[0].width, artwork?.panel[0].height]).toEqual([16, 20]);
    expect(artwork?.panel[0].getBuffer()[0]).toBe(0xff332211);
    expect(artwork?.panel[0].getMask()[1]).toBe(0);
    expect(mocks.putImageData).toHaveBeenCalledTimes(8);
  });

  it('falls back when an icon is missing or has unexpected dimensions', async () => {
    mocks.read.mockResolvedValueOnce(undefined);
    expect(await prepareWindowsPanel()).toBeNull();
    mocks.read.mockResolvedValue(new ArrayBuffer(1));
    mocks.sprites.mockReturnValue([{ width: 1, height: 1 }]);
    expect(await prepareWindowsPanel()).toBeNull();
  });
});

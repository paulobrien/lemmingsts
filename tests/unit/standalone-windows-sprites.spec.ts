import { describe, expect, it, vi } from 'vitest';
import { prepareStandaloneWindowsSprites } from '../../src/game/resources/standalone-windows-sprites';
import { SkillPanelSprites } from '../../src/game/resources/skill-panel-sprites';
import { ColorPalette } from '../../src/game/resources/lemmings/color-palette';
import { SpriteTypes } from '../../src/game/resources/sprite-types';

const mocks = vi.hoisted(() => ({ files: new Map<string, ArrayBuffer>() }));
vi.mock('../../src/game/resources/file/windows-graphics-store', () => ({
  getWindowsGraphicsFile: async (name: string) => mocks.files.get(name),
}));

// Independent synthetic SRLE frames: all 354 images are solid palette index 1.
function makeSprites(): ArrayBuffer {
  const count = 354, width = 32, height = 20, frameSize = 12 + height * (width + 2);
  const bytes = new Uint8Array(6 + 4 * count + count * frameSize), view = new DataView(bytes.buffer);
  bytes.set([0x53, 0x52, 0x4c, 0x45]); view.setUint16(4, count, true);
  for (let frame = 0; frame < count; frame++) {
    const start = 6 + 4 * count + frame * frameSize; view.setUint32(6 + 4 * frame, start, true);
    view.setUint16(start + 4, width, true); view.setUint16(start + 6, height, true);
    view.setUint16(start + 8, width, true); view.setUint16(start + 10, height, true);
    let offset = start + 12;
    for (let y = 0; y < height; y++) { bytes[offset++] = 0x80 + width; bytes.fill(1, offset, offset + width); offset += width; bytes[offset++] = 0x80; }
  }
  return bytes.buffer;
}
function makePalette(): ArrayBuffer {
  const bytes = new Uint8Array(6 + 256 * 4); bytes.set([0x20, 0x4c, 0x41, 0x50]);
  new DataView(bytes.buffer).setUint16(4, 256, true); bytes.set([0x12, 0x34, 0x56], 10);
  return bytes.buffer;
}

describe('Windows-only gameplay artwork', () => {
  it('builds usable logical frames from Windows sprites without DOS data', async () => {
    mocks.files.set('LEMMBIG.SPR', makeSprites()); mocks.files.set('FE.PAL', makePalette());
    const sprites = await prepareStandaloneWindowsSprites();
    for (const type of [SpriteTypes.WALKING, SpriteTypes.BUILDING, SpriteTypes.BASHING, SpriteTypes.SHRUGGING]) {
      const animation = sprites.getAnimation(type, true);
      expect(animation.frames.length).toBeGreaterThan(0);
      expect(animation.frames[0].getMask().some(pixel => pixel !== 0)).toBe(true);
    }
  });
  it('rejects missing sprite artwork rather than creating invisible lemmings', async () => {
    mocks.files.clear();
    await expect(prepareStandaloneWindowsSprites()).rejects.toThrow('missing');
  });
  it('provides a complete legible standalone HUD without DOS resources', () => {
    const panel = new SkillPanelSprites(null, null, new ColorPalette());
    expect(panel.getPanelSprite()).toMatchObject({ width: 320, height: 40 });
    for (const character of 'NEED OUT IN TIME0123456789%-') expect(panel.getLetterSprite(character)).toBeDefined();
    for (let digit = 0; digit < 10; digit++) {
      expect(panel.getNumberSpriteLeft(digit).getMask().some(Boolean)).toBe(true);
      expect(panel.getNumberSpriteRight(digit).getMask().some(Boolean)).toBe(true);
    }
  });
});

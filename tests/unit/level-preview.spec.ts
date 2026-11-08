import { describe, expect, it, vi } from 'vitest';
import { Level } from '../../src/game/resources/level';
import type { DisplayImage } from '../../src/game/view/display-image';

describe('level preview', () => {
  it('draws the resting frame of every placed object over the terrain without advancing animations', () => {
    const first = { name: 'entrance' }, second = { name: 'exit' }, trap = { name: 'trap' };
    const flags = { noOverwrite: true };
    const level = {
      render: vi.fn(),
      objects: [
        { x: 8, y: 3, drawProperties: flags, animation: { frames: [first] }, getFrame: vi.fn() },
        { x: 30, y: 6, drawProperties: flags, animation: { frames: [second] }, getFrame: vi.fn() },
        { x: 40, y: 10, drawProperties: flags, animation: { frames: [trap] }, getFrame: vi.fn() },
      ],
    };
    const display = { drawFrameFlags: vi.fn() };
    Level.prototype.renderPreview.call(level as unknown as Level, display as unknown as DisplayImage);
    expect(level.render).toHaveBeenCalledWith(display);
    expect(display.drawFrameFlags.mock.calls).toEqual([[first, 8, 3, flags], [second, 30, 6, flags], [trap, 40, 10, flags]]);
    expect(level.objects.every(object => !object.getFrame.mock.calls.length)).toBe(true);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { ActionCountdownSystem } from '../../src/game/game-play/actions/action-countdown-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { Mask } from '../../src/game/resources/mask';
import { MaskList } from '../../src/game/resources/mask-list';
import type { MaskProvider } from '../../src/game/resources/mask-provider';
import type { DisplayImage } from '../../src/game/view/display-image';

function digit(width: number, offsetX: number, left: number, right: number): Mask {
  const pixels = new Int8Array(width * 8);
  for (let x = left; x <= right; x++) pixels[width + x] = -128;
  return new Mask(width, 8, offsetX, -19, pixels);
}

describe('bomber and nuke countdown placement', () => {
  it.each([
    ['Windows wide digit', 16, -8, 5, 9],
    ['Windows narrow digit', 16, -8, 7, 7],
    ['DOS digit', 8, -1, 1, 5],
    ['even-width digit', 8, -1, 2, 5],
  ])('centres the visible pixels of a %s over the lemming', (_edition, width, offsetX, left, right) => {
    const mask = digit(width, offsetX, left, right);
    const masks = { GetMask: () => new MaskList(Array(9).fill(mask)) } as unknown as MaskProvider;
    const action = new ActionCountdownSystem(masks);
    const drawMask = vi.fn();
    const display = { drawMask } as unknown as DisplayImage;
    const lemming = new Lemming(100, 45, 1);
    action.triggerLemAction(lemming);
    action.draw(display, lemming);

    const [drawn, x, y] = drawMask.mock.calls[0];
    expect(drawn).toBe(mask);
    expect(Math.abs(x + mask.offsetX + (left + right) / 2 - lemming.x)).toBeLessThanOrEqual(0.5);
    expect(y).toBe(lemming.y);
    expect(mask.offsetX).toBe(offsetX);

    // The same cached digit must remain centred as the lemming moves.
    lemming.x += 12;
    action.draw(display, lemming);
    expect(drawMask.mock.calls[1][1] - x).toBe(12);
  });
});

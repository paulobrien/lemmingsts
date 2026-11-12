import { expect, it, vi } from 'vitest';
import { Game } from '../../src/game/game';
import type { DisplayImage } from '../../src/game/view/display-image';

it('keeps the camera chosen during preview when gameplay is attached', () => {
  const display = { setScreenPosition: vi.fn() };
  const setGuiDisplay = vi.fn();
  const game = { gameDisplay: { setGuiDisplay }, level: { screenPositionX: 600 } };
  Game.prototype.setGameDisplay.call(game as unknown as Game, display as unknown as DisplayImage, true);
  expect(setGuiDisplay).toHaveBeenCalledWith(display);
  expect(display.setScreenPosition).not.toHaveBeenCalled();
  Game.prototype.setGameDisplay.call(game as unknown as Game, display as unknown as DisplayImage);
  expect(display.setScreenPosition).toHaveBeenCalledWith(600, 0);
});

import { describe, expect, it } from 'vitest';
import { DisplayImage } from '../../src/game/view/display-image';
import type { Stage } from '../../src/game/view/stage';
import { Position2D } from '../../src/game/utilities/position2d';

function display() {
  const data = new Uint8ClampedArray(4 * 4 * 4);
  const stage = { createImage: () => ({ width: 4, height: 4, data }) } as unknown as Stage;
  const image = new DisplayImage(stage);
  image.initSize(4, 4);
  return { image, data };
}

describe('game display pixels', () => {
  it('draws explosion particles visibly over transparent map pixels', () => {
    const { image, data } = display();
    image.setBackground(new Uint8ClampedArray(data.length));
    image.setPixel(1, 2, 20, 40, 60);
    expect(Array.from(data.subarray(36, 40))).toEqual([20, 40, 60, 255]);
  });

  it('clips particles outside the map instead of drawing on another row', () => {
    const { image, data } = display();
    const original = data.slice();
    for (const [x, y] of [[-1, 2], [4, 1], [0, -1], [0, 4]]) image.setPixel(x, y, 255, 255, 255);
    expect(data).toEqual(original);
  });

  it('does not add debug pixels when the player clicks the game', () => {
    const { image, data } = display();
    const original = data.slice();
    image.onMouseDown.trigger(new Position2D(1, 2));
    expect(data).toEqual(original);
  });

  it('clears the actual display buffer to opaque black', () => {
    const { image, data } = display();
    data.fill(255);
    image.clear();
    expect(Array.from(data)).toEqual(Array.from({ length: 16 }, () => [0, 0, 0, 255]).flat());
  });
});

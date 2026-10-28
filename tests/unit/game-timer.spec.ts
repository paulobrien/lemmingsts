import { describe, expect, it } from 'vitest';
import { GameTimer } from '../../src/game/game-play/game-timer';
import type { Level } from '../../src/game/resources/level';

describe('level countdown', () => {
  it('keeps the final partial second playable and reaches zero on the correct tick', () => {
    const timer = new GameTimer({ timeLimit: 1 } as Level);
    expect(timer.getGameLeftTimeString()).toBe('1-00');
    for (let tick = 0; tick < 17; tick++) timer.tick();
    expect(timer.getGameLeftTimeString()).toBe('0-59');
    for (let tick = 17; tick < 1019; tick++) timer.tick();
    expect(timer.getGameLeftTime()).toBe(1);
    expect(timer.getGameLeftTimeString()).toBe('0-01');
    timer.tick();
    expect(timer.getGameLeftTime()).toBe(0);
    expect(timer.getGameLeftTimeString()).toBe('0-00');
  });
});

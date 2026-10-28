import { describe, expect, it, vi } from 'vitest';
import { LemmingManager } from '../../src/game/game-play/lemming-manager';
import { GameTypes } from '../../src/game/game-types';

describe('lemming release', () => {
  it.each([
    { entrances: 1, expected: [0, 0, 0, 0, 0] },
    { entrances: 2, expected: [0, 1, 1, 0, 0] },
    { entrances: 3, expected: [0, 1, 2, 1, 0] },
    { entrances: 4, expected: [0, 1, 2, 3, 0] },
  ])('uses the original DOS order for $entrances entrances', ({ entrances, expected }) => {
    let left = expected.length;
    const addLemming = vi.fn();
    // Exercise the release scheduling without needing sprites or game data.
    const manager = Object.assign(Object.create(LemmingManager.prototype), {
      level: {
        gameType: GameTypes.LEMMINGS,
        entrances: Array.from({ length: entrances }, (_, index) => ({ x: index * 40 + 10, y: 20 })),
      },
      gameVictoryCondition: {
        getLeftCount: () => left,
        getCurrentReleaseRate: () => 99,
        releaseOne: () => { left--; },
      },
      releaseTickIndex: 0,
      nextEntranceIndex: 0,
      addLemming,
    }) as { addNewLemmings(): void };
    for (let tick = 0; tick < expected.length * 5; tick++) manager.addNewLemmings();
    expect(addLemming.mock.calls).toEqual(expected.map((index) => [index * 40 + 34, 34]));
    expect(left).toBe(0);
  });
});

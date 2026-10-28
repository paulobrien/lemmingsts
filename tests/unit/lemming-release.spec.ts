import { describe, expect, it, vi } from 'vitest';
import { LemmingManager } from '../../src/game/game-play/lemming-manager';
import { GameTypes } from '../../src/game/game-types';
import { GameTimer } from '../../src/game/game-play/game-timer';
import type { Level } from '../../src/game/resources/level';

// The DOS-original timing and entrance-order rules are documented in Lemmix:
// https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L4001
function setup(entrances: number, initialRate: number, count = 10) {
  let left = count, rate = initialRate;
  const addLemming = vi.fn();
  const manager = Object.assign(Object.create(LemmingManager.prototype), {
    level: {
      gameType: GameTypes.LEMMINGS,
      entrances: Array.from({ length: entrances }, (_, index) => ({ x: index * 40 + 10, y: 20 })),
    },
    gameVictoryCondition: {
      getLeftCount: () => left,
      getCurrentReleaseRate: () => rate,
      releaseOne: () => { left--; },
    },
    releaseIteration: 0,
    releaseCountdown: 20,
    nextEntranceIndex: 0,
    addLemming,
  }) as { addNewLemmings(): void };
  return { manager, addLemming, setRate: (value: number) => { rate = value; }, left: () => left };
}

describe('original DOS lemming release', () => {
  it.each([
    { entrances: 1, expected: [0, 0, 0, 0, 0] },
    { entrances: 2, expected: [0, 1, 1, 0, 0] },
    { entrances: 3, expected: [0, 1, 2, 1, 0] },
    { entrances: 4, expected: [0, 1, 2, 3, 0] },
  ])('uses the original DOS order for $entrances entrances', ({ entrances, expected }) => {
    const s = setup(entrances, 99, expected.length);
    for (let tick = 0; tick < 54 + (expected.length - 1) * 4; tick++) s.manager.addNewLemmings();
    expect(s.addLemming.mock.calls).toEqual(expected.map((index) => [index * 40 + 34, 34]));
    expect(s.left()).toBe(0);
  });

  it.each([[1, 53], [20, 43], [50, 28], [98, 4], [99, 4]])(
    'first appears on iteration 54 and later releases at RR %i use %i-frame spacing', (rate, interval) => {
      const s = setup(1, rate, 3);
      const releaseIterations: number[] = [];
      for (let iteration = 1; iteration <= 54 + interval * 2; iteration++) {
        const before = s.addLemming.mock.calls.length;
        s.manager.addNewLemmings();
        if (s.addLemming.mock.calls.length > before) releaseIterations.push(iteration);
      }
      expect(releaseIterations).toEqual([54, 54 + interval, 54 + interval * 2]);
    },
  );

  it('uses the rate in effect at the preceding release to set the next countdown', () => {
    const s = setup(1, 20, 3);
    const releases: number[] = [];
    for (let iteration = 1; iteration <= 101; iteration++) {
      if (iteration === 60) s.setRate(99);
      const before = s.addLemming.mock.calls.length;
      s.manager.addNewLemmings();
      if (s.addLemming.mock.calls.length > before) releases.push(iteration);
    }
    expect(releases).toEqual([54, 97, 101]);
  });

  it('makes the first lemming available to replay commands at zero-based tick 54', () => {
    const s = setup(1, 50, 1);
    const timer = new GameTimer({ timeLimit: 1 } as Level);
    const observed: number[] = [];
    timer.onGameTick.on(() => s.manager.addNewLemmings());
    timer.onBeforeGameTick.on(tick => { if (s.addLemming.mock.calls.length) observed.push(tick!); });
    for (let i = 0; i < 55; i++) timer.tick();
    expect(observed).toEqual([54]);
  });
});

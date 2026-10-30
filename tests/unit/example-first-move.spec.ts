import { describe, expect, it, vi } from 'vitest';
import type { GameFactory } from '../../src/game/game-factory';
import { GameStateTypes } from '../../src/game/game-state-types';
import { SkillTypes } from '../../src/game/game-play/skill-types';
import { getExampleFirstMove } from '../../src/game/solutions/example-first-move';

describe('visual example hint', () => {
  it('simulates the first tested assignment in a disposable game', async () => {
    let ticks = 0;
    const stop = vi.fn();
    const game = {
      getGameTimer: () => ({ tick: () => ticks++ }),
      getCommandManager: () => ({ loadReplay: vi.fn(), serialize: () => ticks > 152 ? '152=s8&152=l0' : '' }),
      getGameState: () => GameStateTypes.RUNNING,
      getLemmingManager: () => ({ getLemming: () => ({ x: 123, y: 60, removed: false, isDisabled: () => false }) }),
      stop,
    };
    const factory = { getGame: vi.fn(async () => game) } as unknown as GameFactory;
    expect(await getExampleFirstMove(factory, 0, 0)).toEqual({ x: 123, y: 60, skill: SkillTypes.DIGGER, gameSeconds: 8 });
    expect(ticks).toBe(153);
    expect(stop).toHaveBeenCalledOnce();
  });

  it('reconstructs the supplied edition-specific replay', async () => {
    let ticks = 0;
    const command = { loadReplay: vi.fn(), serialize: () => ticks > 2 ? '2=s6&2=l3' : '' };
    const game = {
      getGameTimer: () => ({ tick: () => ticks++ }), getCommandManager: () => command,
      getGameState: () => GameStateTypes.RUNNING,
      getLemmingManager: () => ({ getLemming: (id: number) => ({ x: id, y: 4, removed: false, isDisabled: () => false }) }),
      stop: vi.fn(),
    };
    const factory = { getGame: vi.fn(async () => game) } as unknown as GameFactory;
    const solution = { groupIndex: 0, levelIndex: 0, replay: '2=s6&2=l3', hints: ['Hint'] };
    expect(await getExampleFirstMove(factory, 0, 0, solution)).toEqual({ x: 3, y: 4, skill: SkillTypes.BASHER, gameSeconds: 0 });
    expect(command.loadReplay).toHaveBeenCalledWith(solution.replay);
  });

  it('returns no example for a missing solution', async () => {
    const factory = { getGame: vi.fn() } as unknown as GameFactory;
    expect(await getExampleFirstMove(factory, 99, 99)).toBeNull();
    expect(factory.getGame).not.toHaveBeenCalled();
  });
});

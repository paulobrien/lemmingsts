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

  it('returns no example for a missing solution', async () => {
    const factory = { getGame: vi.fn() } as unknown as GameFactory;
    expect(await getExampleFirstMove(factory, 99, 99)).toBeNull();
    expect(factory.getGame).not.toHaveBeenCalled();
  });
});

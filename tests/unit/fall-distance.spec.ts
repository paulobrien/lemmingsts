import { describe, expect, it, vi } from 'vitest';
import { ActionFallSystem } from '../../src/game/game-play/actions/action-fall-system';
import { ActionWalkSystem } from '../../src/game/game-play/actions/action-walk-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingManager } from '../../src/game/game-play/lemming-manager';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import type { Level } from '../../src/game/resources/level';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';

const sprites = { getAnimation: vi.fn(() => ({})) } as unknown as LemmingsSprite;

describe('classic DOS falling distance', () => {
  it.each([
    [63, LemmingStateType.WALKING],
    [64, LemmingStateType.SPLATTING],
    [66, LemmingStateType.SPLATTING],
  ])('a walking lemming dropping %i pixels transitions to %s', (drop, expected) => {
    const ground = { hasGroundAt: (x: number, y: number) => y >= (x === 0 ? 0 : drop) };
    const level = {
      getGroundMaskLayer: () => ground,
      hasGroundAt: (x: number, y: number) => ground.hasGroundAt(x, y),
    } as unknown as Level;
    const walking = new ActionWalkSystem(sprites);
    const falling = new ActionFallSystem(sprites);
    const lemming = new Lemming(0, 0, 0);
    const manager = Object.assign(Object.create(LemmingManager.prototype), {
      actions: { [LemmingStateType.FALLING]: falling },
      logging: { debug: vi.fn() },
    }) as { setLemmingState(lem: Lemming, state: LemmingStateType): void };

    lemming.setAction(walking);
    expect(walking.process(level, lemming)).toBe(LemmingStateType.FALLING);
    manager.setLemmingState(lemming, LemmingStateType.FALLING);
    expect(lemming.state).toBe(3);
    let result = LemmingStateType.NO_STATE_TYPE;
    for (let step = 0; step < 100 && result === LemmingStateType.NO_STATE_TYPE; step++) {
      result = falling.process(level, lemming);
    }
    expect(result).toBe(expected);
  });
});

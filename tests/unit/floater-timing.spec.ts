import { describe, expect, it } from 'vitest';
import { ActionFloatingSystem } from '../../src/game/game-play/actions/action-floating-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import type { Level } from '../../src/game/resources/level';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';

const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
describe('DOS floater timing', () => {
  it('uses every opening frame and repeats the floating portion', () => {
    const action = new ActionFloatingSystem(sprites), lem = new Lemming(10, 20, 0);
    const level = { hasGroundAt: () => false } as unknown as Level;
    const offsets: number[] = [], frames: number[] = [];
    for (let i = 0; i < 17; i++) {
      const y = lem.y;
      expect(action.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
      offsets.push(lem.y - y);
      frames.push(lem.frameIndex);
    }
    expect(offsets).toEqual([3, 3, 3, 3, -1, 0, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
    expect(frames).toEqual([1, 2, 3, 5, 5, 5, 5, 5, 5, 6, 7, 7, 6, 5, 4, 4, 5]);
  });

  it('lands at the first ground pixel encountered during a descent frame', () => {
    const action = new ActionFloatingSystem(sprites), lem = new Lemming(10, 20, 0);
    const level = { hasGroundAt: (_x: number, y: number) => y === 22 } as unknown as Level;
    expect(action.process(level, lem)).toBe(LemmingStateType.WALKING);
    expect(lem.y).toBe(22);
  });
});

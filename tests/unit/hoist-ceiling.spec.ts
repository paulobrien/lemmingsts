import { describe, expect, it } from 'vitest';
import { ActionHoistSystem } from '../../src/game/game-play/actions/action-hoist-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import type { Level } from '../../src/game/resources/level';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';

const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;

describe('DOS hoisting top boundary', () => {
  it('uses the hoister foot offset, turning only above the boundary', () => {
    const action = new ActionHoistSystem(sprites);
    const lem = new Lemming(20, 9, 0);
    expect(action.process({} as Level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect([lem.y, lem.lookRight]).toEqual([7, true]);
    expect(action.process({} as Level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect([lem.y, lem.lookRight]).toEqual([5, false]);
    expect(action.process({} as Level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect([lem.y, lem.lookRight]).toEqual([5, true]);
  });

  it('uses the walker foot offset when hoisting ends', () => {
    const action = new ActionHoistSystem(sprites);
    const lem = new Lemming(20, 4, 0);
    lem.frameIndex = 7;
    expect(action.process({} as Level, lem)).toBe(LemmingStateType.WALKING);
    expect([lem.y, lem.lookRight]).toEqual([3, false]);
  });
});

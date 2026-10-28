import { describe, expect, it, vi } from 'vitest';
import { ActionClimbSystem } from '../../src/game/game-play/actions/action-climb-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import type { Level } from '../../src/game/resources/level';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';

const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;

describe('DOS climber top boundary', () => {
  it('checks row zero when the approach probe extends above the level', () => {
    const hasGroundAt = vi.fn((_x: number, y: number) => y === 0);
    const level = { hasGroundAt } as unknown as Level;
    const lem = new Lemming(20, 7, 0);
    expect(new ActionClimbSystem(sprites).process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect(hasGroundAt).toHaveBeenCalledWith(20, 0);
    expect([lem.y, lem.lookRight]).toEqual([7, true]);
  });

  it.each([true, false])('turns into a faller when its head crosses the top (right=$0)', right => {
    const level = { hasGroundAt: () => false } as unknown as Level;
    const lem = new Lemming(20, 7, 0);
    lem.lookRight = right;
    lem.frameIndex = 3;
    expect(new ActionClimbSystem(sprites).process(level, lem)).toBe(LemmingStateType.FALLING);
    expect([lem.x, lem.y, lem.lookRight]).toEqual([right ? 18 : 22, 6, !right]);
  });

  it('applies the hoister boundary when transitioning over the top', () => {
    const level = { hasGroundAt: () => false } as unknown as Level;
    const lem = new Lemming(20, 6, 0);
    lem.frameIndex = 2;
    expect(new ActionClimbSystem(sprites).process(level, lem)).toBe(LemmingStateType.HOISTING);
    expect([lem.x, lem.y, lem.lookRight]).toEqual([20, 5, false]);
  });
});

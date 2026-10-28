import { describe, expect, it } from 'vitest';
import { ActionBuildSystem } from '../../src/game/game-play/actions/action-build-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import type { Level } from '../../src/game/resources/level';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';

describe('DOS builder ceiling', () => {
  it('continues at foot y=8 and becomes a walker at y=7 without turning', () => {
    const action = new ActionBuildSystem({ getAnimation: () => ({}) } as unknown as LemmingsSprite);
    const level = { hasGroundAt: () => false } as unknown as Level;
    const lem = new Lemming(100, 9, 0);
    lem.frameIndex = 15;
    expect(action.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect([lem.x, lem.y, lem.lookRight]).toEqual([102, 8, true]);
    lem.frameIndex = 15;
    expect(action.process(level, lem)).toBe(LemmingStateType.WALKING);
    expect([lem.x, lem.y, lem.lookRight]).toEqual([104, 7, true]);
  });
});

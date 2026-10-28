import { describe, expect, it } from 'vitest';
import { ActionOhNoSystem } from '../../src/game/game-play/actions/action-ohno-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import type { Level } from '../../src/game/resources/level';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';

describe('DOS Oh No falling', () => {
  it.each([0, 1, 2, 3])('falls %i pixels before reaching terrain or the per-frame limit', gap => {
    const level = { height: 160, hasGroundAt: (_x: number, y: number) => y >= 10 + gap } as Level;
    const action = new ActionOhNoSystem({ getAnimation: () => ({}) } as unknown as LemmingsSprite);
    const lem = new Lemming(6, 10, 0);
    expect(action.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect(lem.y).toBe(10 + gap);
  });

  it('removes a lemming that falls past the DOS lower boundary', () => {
    const level = { height: 160, hasGroundAt: () => false } as unknown as Level;
    const action = new ActionOhNoSystem({ getAnimation: () => ({}) } as unknown as LemmingsSprite);
    const lem = new Lemming(6, 162, 0);
    expect(action.process(level, lem)).toBe(LemmingStateType.OUT_OFF_LEVEL);
    expect(lem.y).toBe(165);
  });

  it('starts the explosion when the animation ends before falling again', () => {
    const level = { height: 160, hasGroundAt: () => false } as unknown as Level;
    const action = new ActionOhNoSystem({ getAnimation: () => ({}) } as unknown as LemmingsSprite);
    const lem = new Lemming(6, 10, 0);
    lem.frameIndex = 15;
    expect(action.process(level, lem)).toBe(LemmingStateType.EXPLODING);
    expect(lem.y).toBe(10);
  });
});

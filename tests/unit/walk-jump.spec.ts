import { describe, expect, it } from 'vitest';
import { ActionJumpSystem } from '../../src/game/game-play/actions/action-jump-system';
import { ActionWalkSystem } from '../../src/game/game-play/actions/action-walk-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import type { Level } from '../../src/game/resources/level';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';

const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
function step(height: number): Level {
  const hasGroundAt = (x: number, y: number) => x === 11 && y >= 21 - height && y <= 20;
  return { hasGroundAt, getGroundMaskLayer: () => ({ hasGroundAt }) } as unknown as Level;
}

describe('DOS walking and jumping', () => {
  it('ascends a short step in the walking frame', () => {
    const lem = new Lemming(10, 20, 0);
    expect(new ActionWalkSystem(sprites).process(step(3), lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect([lem.x, lem.y]).toEqual([11, 18]);
  });

  it('climbs a steep step in successive two-pixel jump frames', () => {
    const level = step(5), lem = new Lemming(10, 20, 0);
    expect(new ActionWalkSystem(sprites).process(level, lem)).toBe(LemmingStateType.JUMPING);
    expect([lem.x, lem.y]).toEqual([11, 18]);
    const jumping = new ActionJumpSystem(sprites);
    expect(jumping.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect([lem.x, lem.y]).toEqual([11, 16]);
    expect(jumping.process(level, lem)).toBe(LemmingStateType.WALKING);
    expect([lem.x, lem.y]).toEqual([11, 16]);
  });

  it('turns a jumper at the DOS top boundary and resumes walking', () => {
    const level = { hasGroundAt: (_x: number, y: number) => y >= 0 } as Level;
    const lem = new Lemming(10, 7, 0);
    const jumping = new ActionJumpSystem(sprites);

    expect(jumping.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect([lem.y, lem.lookRight]).toEqual([5, true]);
    expect(jumping.process(level, lem)).toBe(LemmingStateType.WALKING);
    expect([lem.y, lem.lookRight]).toEqual([3, false]);
  });

  it('turns a walker when stepping above the DOS top boundary', () => {
    const hasGroundAt = (x: number, y: number) => x === 11 && y >= 4 && y <= 5;
    const level = { getGroundMaskLayer: () => ({ hasGroundAt }) } as unknown as Level;
    const lem = new Lemming(10, 5, 0);

    expect(new ActionWalkSystem(sprites).process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect([lem.x, lem.y, lem.lookRight]).toEqual([11, 3, false]);
  });

  it('resumes walking if the top boundary is reached on the first jump frame', () => {
    const hasGroundAt = (x: number, y: number) => x === 11 && y >= 3 && y <= 6;
    const level = { getGroundMaskLayer: () => ({ hasGroundAt }) } as unknown as Level;
    const lem = new Lemming(10, 6, 0);

    expect(new ActionWalkSystem(sprites).process(level, lem)).toBe(LemmingStateType.WALKING);
    expect([lem.x, lem.y, lem.lookRight]).toEqual([11, 3, false]);
  });
});

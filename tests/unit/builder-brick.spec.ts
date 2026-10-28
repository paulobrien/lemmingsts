import { describe, expect, it, vi } from 'vitest';
import { ActionBuildSystem } from '../../src/game/game-play/actions/action-build-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import type { Level } from '../../src/game/resources/level';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';

describe('DOS builder brick timing', () => {
  it.each([true, false])('restores the brick after three completed bricks on frame 10 (right=$0)', right => {
    const terrain = new Set<string>();
    const setGroundAt = vi.fn((x: number, y: number) => terrain.add(`${x},${y}`));
    const level = { setGroundAt, hasGroundAt: (x: number, y: number) => terrain.has(`${x},${y}`) } as unknown as Level;
    const action = new ActionBuildSystem({ getAnimation: () => ({}) } as unknown as LemmingsSprite);
    const lem = new Lemming(20, 10, 0);
    lem.lookRight = right;
    lem.frameIndex = 8;
    lem.state = 3;
    const start = right ? 20 : 16;
    const brick = Array.from({ length: 6 }, (_, i) => [start + i, 9, 7]);

    expect(action.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect(setGroundAt.mock.calls).toEqual(brick);
    expect(terrain.delete(`${start},9`)).toBe(true); // Another lemming removes one brick pixel.
    setGroundAt.mockClear();
    expect(action.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect(setGroundAt.mock.calls).toEqual([brick[0]]);
    expect(terrain.has(`${start},9`)).toBe(true);
    expect([lem.x, lem.y, lem.state]).toEqual([20, 10, 3]);
  });

  it.each([0, 2, 4, 11])('does not repeat frame 10 with %i completed bricks', bricks => {
    const setGroundAt = vi.fn();
    const level = { setGroundAt } as unknown as Level;
    const action = new ActionBuildSystem({ getAnimation: () => ({}) } as unknown as LemmingsSprite);
    const lem = new Lemming(20, 10, 0);
    lem.frameIndex = 9;
    lem.state = bricks;
    expect(action.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect(setGroundAt).not.toHaveBeenCalled();
  });
});

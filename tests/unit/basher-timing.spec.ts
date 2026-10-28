import { describe, expect, it, vi } from 'vitest';
import { ActionBashSystem } from '../../src/game/game-play/actions/action-bash-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import type { Level } from '../../src/game/resources/level';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';
import type { MaskProvider } from '../../src/game/resources/mask-provider';

describe('DOS basher timing', () => {
  it('checks for empty terrain on frame 5 but not on frame 21', () => {
    const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
    const masks = { GetMask: () => ({ getMask: () => ({}) }) } as unknown as MaskProvider;
    const clearGroundWithMask = vi.fn();
    const level = { getGroundMaskLayer: () => ({ hasGroundAt: () => false }), clearGroundWithMask } as unknown as Level;
    const action = new ActionBashSystem(sprites, masks);
    const lem = new Lemming(100, 50, 0);
    lem.frameIndex = 4;
    expect(action.process(level, lem)).toBe(LemmingStateType.WALKING);
    lem.frameIndex = 20;
    expect(action.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect(clearGroundWithMask).toHaveBeenCalledTimes(2);
  });
});

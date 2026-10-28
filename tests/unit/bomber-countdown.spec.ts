import { describe, expect, it } from 'vitest';
import { ActionCountdownSystem } from '../../src/game/game-play/actions/action-countdown-system';
import { ActionFallSystem } from '../../src/game/game-play/actions/action-fall-system';
import { ActionFloatingSystem } from '../../src/game/game-play/actions/action-floating-system';
import { ActionDrowningSystem } from '../../src/game/game-play/actions/action-drowning-system';
import { ActionWalkSystem } from '../../src/game/game-play/actions/action-walk-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import type { Level } from '../../src/game/resources/level';
import type { MaskProvider } from '../../src/game/resources/mask-provider';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';

describe('DOS bomber countdown', () => {
  it.each([
    ['falling', ActionFallSystem, LemmingStateType.EXPLODING],
    ['floating', ActionFloatingSystem, LemmingStateType.EXPLODING],
    ['drowning', ActionDrowningSystem, LemmingStateType.EXPLODING],
    ['walking', ActionWalkSystem, LemmingStateType.OHNO],
  ])('chooses the DOS transition for a %s bomber', (_name, Action, expected) => {
    const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
    const masks = { GetMask: () => ({}) } as unknown as MaskProvider;
    const countdown = new ActionCountdownSystem(masks);
    const lem = new Lemming(10, 10, 0);
    lem.setAction(new Action(sprites));
    countdown.triggerLemAction(lem);
    lem.countdown = 1;
    expect(countdown.process({} as Level, lem)).toBe(expected);
    expect(lem.countdownAction).toBeNull();
  });

  it('expires after 79 frames and clears its countdown state', () => {
    const masks = { GetMask: () => ({}) } as unknown as MaskProvider;
    const action = new ActionCountdownSystem(masks), lem = new Lemming(0, 0, 0);
    const level = {} as Level;
    expect(action.triggerLemAction(lem)).toBe(true);
    expect(lem.countdown).toBe(79);
    for (let frame = 1; frame < 79; frame++) {
      expect(action.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    }
    expect(action.process(level, lem)).toBe(LemmingStateType.OHNO);
    expect(lem.countdown).toBe(0);
    expect(lem.countdownAction).toBeNull();
  });

  it('does not replace an active countdown on reassignment', () => {
    const masks = { GetMask: () => ({}) } as unknown as MaskProvider;
    const first = new ActionCountdownSystem(masks), second = new ActionCountdownSystem(masks);
    const lem = new Lemming(0, 0, 0);
    expect(first.triggerLemAction(lem)).toBe(true);
    expect(second.triggerLemAction(lem)).toBe(false);
    expect(lem.countdownAction).toBe(first);
  });
});

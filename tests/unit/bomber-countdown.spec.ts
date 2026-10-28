import { describe, expect, it } from 'vitest';
import { ActionCountdownSystem } from '../../src/game/game-play/actions/action-countdown-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import type { Level } from '../../src/game/resources/level';
import type { MaskProvider } from '../../src/game/resources/mask-provider';

describe('DOS bomber countdown', () => {
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

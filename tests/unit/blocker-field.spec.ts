import { describe, expect, it } from 'vitest';
import { ActionBlockerSystem } from '../../src/game/game-play/actions/action-blocker-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import { GameTimer } from '../../src/game/game-play/game-timer';
import { TriggerManager } from '../../src/game/game-play/trigger-manager';
import type { Level } from '../../src/game/resources/level';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';
import { TriggerTypes } from '../../src/game/resources/lemmings/trigger-types';

describe('DOS blocker field', () => {
  it('aligns its arms to object-map cells and allows passage below them', () => {
    const manager = new TriggerManager({ getGameTicks: () => 0 } as GameTimer);
    const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
    const action = new ActionBlockerSystem(sprites, manager);
    const blocker = new Lemming(368, 137, 0);
    const ground = { hasGroundAt: () => true } as unknown as Level;
    action.triggerLemAction(blocker);
    // The field is already active immediately after assignment, before the
    // blocker's own update; other lemmings may be processed first.
    expect(manager.trigger(375, 137)).toBe(TriggerTypes.BLOCKER_RIGHT);
    action.process(ground, blocker);

    for (const y of [128, 131, 135, 139]) {
      expect(manager.trigger(364, y)).toBe(TriggerTypes.BLOCKER_LEFT);
      expect(manager.trigger(367, y)).toBe(TriggerTypes.BLOCKER_LEFT);
      expect(manager.trigger(372, y)).toBe(TriggerTypes.BLOCKER_RIGHT);
      expect(manager.trigger(375, y)).toBe(TriggerTypes.BLOCKER_RIGHT);
      expect(manager.trigger(368, y)).toBe(TriggerTypes.NO_TRIGGER);
    }
    expect(manager.trigger(375, 127)).toBe(TriggerTypes.NO_TRIGGER);
    expect(manager.trigger(375, 140)).toBe(TriggerTypes.NO_TRIGGER);
    expect(manager.trigger(375, 141)).toBe(TriggerTypes.NO_TRIGGER);
    expect(manager.trigger(376, 137)).toBe(TriggerTypes.NO_TRIGGER);
  });

  it('releases to walking when its foot pixel is removed, even if ground remains below', () => {
    const manager = new TriggerManager({ getGameTicks: () => 0 } as GameTimer);
    const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
    const action = new ActionBlockerSystem(sprites, manager);
    const blocker = new Lemming(20, 20, 0);
    const ground = { hasGroundAt: (_x: number, y: number) => y === 21 } as unknown as Level;
    action.triggerLemAction(blocker);
    expect(manager.trigger(24, 20)).toBe(TriggerTypes.BLOCKER_RIGHT);
    expect(action.process(ground, blocker)).toBe(LemmingStateType.WALKING);
    expect(manager.trigger(24, 20)).toBe(TriggerTypes.NO_TRIGGER);
  });
});

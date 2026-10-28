import { describe, expect, it, vi } from 'vitest';
import { ActionDrowningSystem } from '../../src/game/game-play/actions/action-drowning-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingManager } from '../../src/game/game-play/lemming-manager';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import { SkillTypes } from '../../src/game/game-play/skill-types';
import { Trigger } from '../../src/game/game-play/trigger';
import { TriggerManager } from '../../src/game/game-play/trigger-manager';
import type { GameTimer } from '../../src/game/game-play/game-timer';
import type { Level } from '../../src/game/resources/level';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';
import { TriggerTypes } from '../../src/game/resources/lemmings/trigger-types';

const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;

describe('DOS drowning', () => {
  it.each([true, false])('stops at a wall without turning, then resumes when clear (right=$0)', right => {
    let blocked = true;
    const level = { hasGroundAt: () => blocked } as unknown as Level;
    const action = new ActionDrowningSystem(sprites);
    const lem = new Lemming(10, 10, 0);
    lem.lookRight = right;
    expect(action.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect([lem.x, lem.lookRight, lem.isDisabled()]).toEqual([10, right, false]);
    blocked = false;
    expect(action.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect([lem.x, lem.lookRight]).toEqual([right ? 11 : 9, right]);
    lem.frameIndex = 15;
    expect(action.process(level, lem)).toBe(LemmingStateType.OUT_OFF_LEVEL);
  });

  it('does not re-trigger water and permits a bomber while drowning', () => {
    const triggers = new TriggerManager({ getGameTicks: () => 1 } as GameTimer);
    const water = new Trigger(TriggerTypes.DROWN, 5, 5, 8, 8);
    triggers.add(water);
    const manager = Object.create(LemmingManager.prototype) as LemmingManager;
    const lem = new Lemming(6, 6, 0);
    lem.action = { process: () => LemmingStateType.NO_STATE_TYPE, getActionName: () => 'walk',
      draw: () => undefined, triggerLemAction: () => false };
    const drowning = new ActionDrowningSystem(sprites);
    const actions = []; actions[LemmingStateType.DROWNING] = drowning;
    const bomber = { triggerLemAction: vi.fn(() => true) };
    Object.assign(manager, { level: { width: 32, height: 32, hasGroundAt: () => true },
      lemmings: [lem], actions, skillActions: { [SkillTypes.BOMBER]: bomber },
      logging: { debug: vi.fn() }, triggerManager: triggers,
      gameVictoryCondition: { getLeftCount: () => 0, removeOne: vi.fn() }, nextNukingLemmingsIndex: -1 });
    manager.tick();
    expect(lem.action).toBe(drowning);
    manager.tick();
    expect(water.getActivationCount()).toBe(1);
    expect(manager.doLemmingAction(lem, SkillTypes.BOMBER)).toBe(true);
    expect(bomber.triggerLemAction).toHaveBeenCalledOnce();
  });
});

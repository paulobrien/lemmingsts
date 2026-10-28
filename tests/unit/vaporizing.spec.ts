import { describe, expect, it, vi } from 'vitest';
import { ActionVaporizingSystem } from '../../src/game/game-play/actions/action-vaporizing-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingManager } from '../../src/game/game-play/lemming-manager';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import { SkillTypes } from '../../src/game/game-play/skill-types';
import { Trigger } from '../../src/game/game-play/trigger';
import { TriggerManager } from '../../src/game/game-play/trigger-manager';
import { GameTimer } from '../../src/game/game-play/game-timer';
import type { Level } from '../../src/game/resources/level';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';
import { SpriteTypes } from '../../src/game/resources/sprite-types';
import { TriggerTypes } from '../../src/game/resources/lemmings/trigger-types';

describe('DOS vaporizing', () => {
  it('uses the fire sprite, stays in place and removes the lemming after 14 frames', () => {
    const animation = { getFrame: vi.fn(() => ({})) };
    const sprites = { getAnimation: vi.fn(() => animation) } as unknown as LemmingsSprite;
    const action = new ActionVaporizingSystem(sprites);
    expect(sprites.getAnimation).toHaveBeenCalledWith(SpriteTypes.FRYING, false);
    const lem = new Lemming(8, 9, 0);
    for (let frame = 1; frame < 14; frame++) {
      expect(action.process({} as Level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
      expect([lem.x, lem.y]).toEqual([8, 9]);
    }
    expect(lem.isDisabled()).toBe(false);
    expect(action.process({} as Level, lem)).toBe(LemmingStateType.OUT_OFF_LEVEL);
  });

  it('enters vaporizing from a fire object and removes the victim after its animation', () => {
    const timer = { getGameTicks: () => 1 } as GameTimer;
    const triggers = new TriggerManager(timer);
    const fire = new Trigger(TriggerTypes.KILL, 5, 5, 8, 8);
    triggers.add(fire);
    const manager = Object.create(LemmingManager.prototype) as LemmingManager;
    const lem = new Lemming(6, 6, 0);
    lem.action = { process: () => LemmingStateType.NO_STATE_TYPE, getActionName: () => 'walk',
      draw: () => undefined, triggerLemAction: () => false };
    const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
    const vapor = new ActionVaporizingSystem(sprites);
    const actions = []; actions[LemmingStateType.FRYING] = vapor;
    const athlete = { triggerLemAction: vi.fn(() => true) };
    const removeOne = vi.fn();
    Object.assign(manager, { level: { width: 32, height: 32 }, lemmings: [lem], actions, skillActions: { [SkillTypes.CLIMBER]: athlete },
      logging: { debug: vi.fn() }, triggerManager: triggers,
      gameVictoryCondition: { getLeftCount: () => 0, removeOne }, nextNukingLemmingsIndex: -1 });
    manager.tick();
    expect(lem.action).toBe(vapor);
    expect(manager.doLemmingAction(lem, SkillTypes.BOMBER)).toBe(false);
    expect(manager.doLemmingAction(lem, SkillTypes.CLIMBER)).toBe(true);
    for (let i = 0; i < 13; i++) manager.tick();
    expect(lem.removed).toBe(false);
    expect(fire.getActivationCount()).toBe(1);
    manager.tick();
    expect(lem.removed).toBe(true);
    expect(removeOne).toHaveBeenCalledOnce();
  });
});

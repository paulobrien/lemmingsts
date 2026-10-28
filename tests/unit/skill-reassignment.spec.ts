import { describe, expect, it, vi } from 'vitest';
import { ActionBlockerSystem } from '../../src/game/game-play/actions/action-blocker-system';
import { ActionBuildSystem } from '../../src/game/game-play/actions/action-build-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingManager } from '../../src/game/game-play/lemming-manager';
import { SkillTypes } from '../../src/game/game-play/skill-types';
import type { TriggerManager } from '../../src/game/game-play/trigger-manager';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';

const sprites = { getAnimation: vi.fn(() => ({})) } as unknown as LemmingsSprite;

describe('skill reassignment', () => {
  it('does not replace a blocker or leave its blocker field behind, but permits a bomber', () => {
    const lemming = new Lemming(0, 0, 0);
    const blocker = new ActionBlockerSystem(sprites, {} as TriggerManager);
    lemming.setAction(blocker);
    const triggerLemAction = vi.fn(() => true);
    const manager = Object.assign(Object.create(LemmingManager.prototype), {
      skillActions: {
        [SkillTypes.BUILDER]: { triggerLemAction },
        [SkillTypes.CLIMBER]: { triggerLemAction },
        [SkillTypes.BOMBER]: { triggerLemAction },
      },
    }) as LemmingManager;
    expect(manager.doLemmingAction(lemming, SkillTypes.BUILDER)).toBe(false);
    expect(manager.doLemmingAction(lemming, SkillTypes.CLIMBER)).toBe(false);
    expect(triggerLemAction).not.toHaveBeenCalled();
    expect(manager.doLemmingAction(lemming, SkillTypes.BOMBER)).toBe(true);
    expect(triggerLemAction).toHaveBeenCalledOnce();
    expect(lemming.action).toBe(blocker);
  });

  it('does not spend another skill to restart the lemming’s current action', () => {
    const lemming = new Lemming(0, 0, 0);
    const builder = new ActionBuildSystem(sprites);
    lemming.setAction(builder);
    const trigger = vi.spyOn(builder, 'triggerLemAction');
    const manager = Object.assign(Object.create(LemmingManager.prototype), {
      skillActions: { [SkillTypes.BUILDER]: builder },
    }) as LemmingManager;
    expect(manager.doLemmingAction(lemming, SkillTypes.BUILDER)).toBe(false);
    expect(trigger).not.toHaveBeenCalled();
  });
});

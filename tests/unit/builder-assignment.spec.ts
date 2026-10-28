import { describe, expect, it, vi } from 'vitest';
import { ActionBuildSystem } from '../../src/game/game-play/actions/action-build-system';
import { ActionFallSystem } from '../../src/game/game-play/actions/action-fall-system';
import { ActionFloatingSystem } from '../../src/game/game-play/actions/action-floating-system';
import { ActionClimbSystem } from '../../src/game/game-play/actions/action-climb-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingManager } from '../../src/game/game-play/lemming-manager';
import { SkillTypes } from '../../src/game/game-play/skill-types';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';

const sprites = { getAnimation: vi.fn(() => ({})) } as unknown as LemmingsSprite;

describe('assigning skills to airborne lemmings', () => {
  it.each([new ActionFallSystem(sprites), new ActionFloatingSystem(sprites)])(
    'does not start building while $getActionName', (action) => {
      const lemming = new Lemming(0, 0, 0);
      lemming.setAction(action);
      expect(new ActionBuildSystem(sprites).triggerLemAction(lemming)).toBe(false);
      expect(lemming.action).toBe(action);
    },
  );

  it('still allows climber and floater abilities to be assigned during a fall', () => {
    const lemming = new Lemming(0, 0, 0);
    lemming.setAction(new ActionFallSystem(sprites));
    expect(new ActionClimbSystem(sprites).triggerLemAction(lemming)).toBe(true);
    expect(new ActionFloatingSystem(sprites).triggerLemAction(lemming)).toBe(true);
    expect(lemming.canClimb).toBe(true);
    expect(lemming.hasParachute).toBe(true);
    expect(lemming.action).toBeInstanceOf(ActionFallSystem);
  });

  it.each([SkillTypes.BLOCKER, SkillTypes.BUILDER, SkillTypes.BASHER, SkillTypes.MINER, SkillTypes.DIGGER])(
    'does not apply ground skill %s while falling or floating', (skill) => {
      const triggerLemAction = vi.fn(() => true);
      const manager = Object.assign(Object.create(LemmingManager.prototype), {
        skillActions: { [skill]: { triggerLemAction } },
      }) as LemmingManager;
      for (const action of [new ActionFallSystem(sprites), new ActionFloatingSystem(sprites)]) {
        const lemming = new Lemming(0, 0, 0);
        lemming.setAction(action);
        expect(manager.doLemmingAction(lemming, skill)).toBe(false);
      }
      expect(triggerLemAction).not.toHaveBeenCalled();
    },
  );
});

import { describe, expect, it, vi } from 'vitest';
import type { IActionSystem } from '../../src/game/game-play/action-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingManager } from '../../src/game/game-play/lemming-manager';
import { SkillTypes } from '../../src/game/game-play/skill-types';

function assignment(skill: SkillTypes, state: string) {
  const triggerLemAction = vi.fn(() => true);
  const manager = Object.assign(Object.create(LemmingManager.prototype), {
    skillActions: { [skill]: { triggerLemAction } },
  }) as LemmingManager;
  const lemming = new Lemming(0, 0, 0);
  lemming.setAction({ getActionName: () => state } as IActionSystem);
  return { result: manager.doLemmingAction(lemming, skill), triggerLemAction };
}

describe('blocker and builder assignment states', () => {
  it.each([SkillTypes.BLOCKER, SkillTypes.BUILDER])(
    'rejects skill %s while jumping, climbing, hoisting or airborne', (skill) => {
      for (const state of ['jump', 'climbing', 'hoist', 'falling', 'floating']) {
        const { result, triggerLemAction } = assignment(skill, state);
        expect(result, state).toBe(false);
        expect(triggerLemAction, state).not.toHaveBeenCalled();
      }
    },
  );

  it.each([SkillTypes.BLOCKER, SkillTypes.BUILDER])(
    'allows skill %s from grounded states', (skill) => {
      for (const state of ['walk', 'shruging', 'bashing', 'mining', 'digging']) {
        const { result, triggerLemAction } = assignment(skill, state);
        expect(result, state).toBe(true);
        expect(triggerLemAction, state).toHaveBeenCalledOnce();
      }
    },
  );

  it('allows a blocker to interrupt building but not another builder', () => {
    expect(assignment(SkillTypes.BLOCKER, 'building').result).toBe(true);
    const builder = assignment(SkillTypes.BUILDER, 'building');
    expect(builder.result).toBe(false);
    expect(builder.triggerLemAction).not.toHaveBeenCalled();
  });

  it.each([SkillTypes.CLIMBER, SkillTypes.FLOATER])(
    'still permits permanent skill %s during a fall', (skill) => {
      expect(assignment(skill, 'falling').result).toBe(true);
    },
  );
});

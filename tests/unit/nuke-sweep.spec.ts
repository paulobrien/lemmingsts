import { describe, expect, it, vi } from 'vitest';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingManager } from '../../src/game/game-play/lemming-manager';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import { SkillTypes } from '../../src/game/game-play/skill-types';

describe('DOS nuke sweep', () => {
  it('runs after updates, skips removed slots in the same frame, and starts at 79', () => {
    const order: string[] = [];
    const lems = Array.from({ length: 4 }, (_, id) => new Lemming(10, 10, id));
    lems[0].removed = true;
    lems[1].process = () => { order.push('update-1'); return LemmingStateType.OUT_OFF_LEVEL; };
    lems[2].process = () => { order.push('update-2'); return LemmingStateType.NO_STATE_TYPE; };
    lems[3].process = () => { order.push('update-3'); return LemmingStateType.NO_STATE_TYPE; };
    const assign = vi.fn((lem: Lemming, skill: SkillTypes) => { order.push(`assign-${lem.id}`); lem.countdown = 79; return skill === SkillTypes.BOMBER; });
    const manager = Object.assign(Object.create(LemmingManager.prototype), {
      level: {}, lemmings: lems, nextNukingLemmingsIndex: 0,
      gameVictoryCondition: { getLeftCount: () => 0 },
      runTrigger: () => LemmingStateType.NO_STATE_TYPE,
      processNewAction: (lem: Lemming, state: LemmingStateType) => { if (state === LemmingStateType.OUT_OFF_LEVEL) lem.remove(); },
      doLemmingAction: assign,
    }) as LemmingManager;
    manager.tick();
    expect(order).toEqual(['update-1', 'update-2', 'update-3', 'assign-2']);
    expect(assign).toHaveBeenCalledWith(lems[2], SkillTypes.BOMBER);
    expect(lems[2].countdown).toBe(79);
    manager.tick();
    expect(assign).toHaveBeenLastCalledWith(lems[3], SkillTypes.BOMBER);
    expect(lems[3].countdown).toBe(79);
  });
});

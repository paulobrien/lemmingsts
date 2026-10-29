import { describe, expect, it, vi } from 'vitest';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingManager } from '../../src/game/game-play/lemming-manager';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import { SoundEffect } from '../../src/game/game-play/sound-effects';
import { Trigger } from '../../src/game/game-play/trigger';
import { TriggerManager } from '../../src/game/game-play/trigger-manager';
import { GameTimer } from '../../src/game/game-play/game-timer';
import { TriggerTypes } from '../../src/game/resources/lemmings/trigger-types';
import { ActionBuildSystem } from '../../src/game/game-play/actions/action-build-system';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';

describe('DOS sound events', () => {
    it('warns once for each of the final three builder bricks', () => {
        const manager = Object.create(LemmingManager.prototype) as LemmingManager;
        const emit = vi.fn();
        const builder = new ActionBuildSystem({ getAnimation: () => ({}) } as unknown as LemmingsSprite);
        const lem = new Lemming(50, 50, 0);
        lem.setAction(builder);
        const actions = [];
        actions[LemmingStateType.SHRUG] = { getActionName: () => 'shrug' };
        Object.assign(manager, {
            level: { width: 100, height: 100, hasGroundAt: () => false, setGroundAt: vi.fn() },
            actions, lemmings: [lem], gameVictoryCondition: { getLeftCount: () => 0 },
            onSoundEffect: { trigger: emit }, nextNukingLemmingsIndex: -1,
            logging: { debug: vi.fn() }, triggerManager: { trigger: () => TriggerTypes.NO_TRIGGER },
        });
        for (let tick = 0; tick < 192; tick++) manager.tick();
        expect(emit.mock.calls).toEqual([
            [SoundEffect.BuilderWarning], [SoundEffect.BuilderWarning], [SoundEffect.BuilderWarning],
        ]);
        expect(lem.action).toBe(actions[LemmingStateType.SHRUG]);
    });

    it('plays the opening cues once, on simulation iterations 15 and 34', () => {
        const manager = Object.create(LemmingManager.prototype) as LemmingManager;
        const emit = vi.fn();
        Object.assign(manager, { onSoundEffect: { trigger: emit }, releaseIteration: 0, releaseCountdown: 20,
            gameVictoryCondition: { getLeftCount: () => 1 }, lemmings: [], nextNukingLemmingsIndex: -1 });
        for (let i = 0; i < 14; i++) manager.tick();
        expect(emit).not.toHaveBeenCalled();
        manager.tick();
        expect(emit.mock.calls).toEqual([[SoundEffect.LetsGo]]);
        for (let i = 0; i < 18; i++) manager.tick();
        expect(emit).toHaveBeenCalledTimes(1);
        manager.tick();
        expect(emit.mock.calls).toEqual([[SoundEffect.LetsGo], [SoundEffect.Entrance]]);
        for (let i = 0; i < 5; i++) manager.tick();
        expect(emit).toHaveBeenCalledTimes(2);
    });

    it('sounds Oh No for assigned bombers but not during a nuke, and sounds water and fire', () => {
        const manager = Object.create(LemmingManager.prototype) as LemmingManager;
        const emit = vi.fn();
        const action = { getActionName: () => 'test' };
        const actions = [];
        actions[LemmingStateType.OHNO] = action;
        actions[LemmingStateType.DROWNING] = action;
        actions[LemmingStateType.FRYING] = action;
        Object.assign(manager, { actions, onSoundEffect: { trigger: emit }, nextNukingLemmingsIndex: -1,
            logging: { debug: vi.fn() } });
        const change = (state: LemmingStateType) =>
            (manager as unknown as { setLemmingState(lem: Lemming, state: LemmingStateType): void })
                .setLemmingState(new Lemming(0, 0, 0), state);
        change(LemmingStateType.OHNO);
        change(LemmingStateType.DROWNING);
        change(LemmingStateType.FRYING);
        Object.assign(manager, { nextNukingLemmingsIndex: 0 });
        change(LemmingStateType.OHNO);
        expect(emit.mock.calls).toEqual([[SoundEffect.OhNo], [SoundEffect.Drowning], [SoundEffect.Fire]]);
    });

    it('plays the configured trap sound only on a successful activation', () => {
        let tick = 1;
        const manager = new TriggerManager({ getGameTicks: () => tick } as GameTimer);
        const sounds: Array<SoundEffect | undefined> = [];
        manager.onSoundEffect.on(sound => sounds.push(sound));
        manager.add(new Trigger(TriggerTypes.TRAP, 0, 0, 2, 2, 3, 14));
        expect(manager.trigger(1, 1)).toBe(TriggerTypes.TRAP);
        expect(manager.trigger(1, 1)).toBe(TriggerTypes.NO_TRIGGER);
        tick = 4;
        expect(manager.trigger(1, 1)).toBe(TriggerTypes.TRAP);
        expect(sounds).toEqual([13, 13]);
        manager.add(new Trigger(TriggerTypes.TRAP, 3, 3, 4, 4, 1, 0));
        manager.trigger(3, 3);
        manager.add(new Trigger(TriggerTypes.TRAP, 5, 5, 6, 6, 1, 19));
        manager.trigger(5, 5);
        expect(sounds).toEqual([13, 13]);
    });
});

import { describe, expect, it, vi } from 'vitest';
import { GameTypes } from '../../src/game/game-types';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingManager } from '../../src/game/game-play/lemming-manager';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import { Trigger } from '../../src/game/game-play/trigger';
import { TriggerManager } from '../../src/game/game-play/trigger-manager';
import { GameTimer } from '../../src/game/game-play/game-timer';
import { DrawProperties } from '../../src/game/resources/draw-properties';
import { Level } from '../../src/game/resources/level';
import { ColorPalette } from '../../src/game/resources/lemmings/color-palette';
import { LevelElement } from '../../src/game/resources/lemmings/level-element';
import { LevelProperties } from '../../src/game/resources/lemmings/level-properties';
import { ObjectImageInfo } from '../../src/game/resources/lemmings/object-image-info';
import { TriggerTypes } from '../../src/game/resources/lemmings/trigger-types';
import { SolidLayer } from '../../src/game/resources/solid-layer';

function emptyLevel(): Level {
    const width = 32, height = 32, palette = new ColorPalette();
    return new Level(width, height, GameTypes.LEMMINGS, 0, 0, new LevelProperties(), 0, false,
        new Uint8ClampedArray(width * height * 4), new SolidLayer(width, height, new Int8Array(width * height)), palette, palette);
}

describe('triggered traps', () => {
    it('removes one lemming and lets others pass until the trap rearms', () => {
        let tick = 10;
        const timer = { getGameTicks: () => tick } as GameTimer;
        const triggers = new TriggerManager(timer);
        triggers.add(new Trigger(TriggerTypes.TRAP, 5, 5, 8, 8, 4));
        const manager = Object.create(LemmingManager.prototype) as LemmingManager;
        const removeOne = vi.fn();
        const first = new Lemming(6, 6, 0), second = new Lemming(6, 6, 1);
        const standing = { process: () => LemmingStateType.NO_STATE_TYPE, getActionName: () => 'walk',
            draw: () => undefined, triggerLemAction: () => false };
        first.action = standing;
        second.action = standing;
        Object.assign(manager, { level: emptyLevel(), lemmings: [first, second], triggerManager: triggers,
            gameVictoryCondition: { getLeftCount: () => 0, removeOne }, nextNukingLemmingsIndex: -1 });
        manager.tick();
        expect(first.removed).toBe(true);
        expect(second.removed).toBe(false);
        expect(removeOne).toHaveBeenCalledOnce();
        tick = 13;
        manager.tick();
        expect(second.removed).toBe(false);
        tick = 14;
        manager.tick();
        expect(second.removed).toBe(true);
        expect(removeOne).toHaveBeenCalledTimes(2);
    });

    it('derives cooldown and one-shot animation from the level object metadata', () => {
        const level = emptyLevel(), palette = new ColorPalette();
        const info = new ObjectImageInfo(palette);
        info.triggerEffectId = TriggerTypes.TRAP;
        info.triggerWidth = info.triggerHeight = 4;
        info.width = info.height = 1;
        info.frameCount = 5;
        info.animationLoop = false;
        info.frames = Array.from({ length: 5 }, () => new Uint8Array([0]));
        const objects: ObjectImageInfo[] = [];
        objects[2] = info;
        level.setMapObjects([new LevelElement(4, 4, 2, new DrawProperties(false, false, false, false))], objects);
        const object = level.objects[0], trigger = level.triggers[0];
        expect(object.getFrame(9)).toBe(object.animation.frames[0]);
        expect(trigger.trigger(5, 5, 10)).toBe(TriggerTypes.TRAP);
        expect(object.getFrame(10)).toBe(object.animation.frames[2]);
        expect(object.getFrame(12)).toBe(object.animation.frames[4]);
        expect(object.getFrame(13)).toBe(object.animation.frames[0]);
        expect(trigger.trigger(5, 5, 13)).toBe(TriggerTypes.NO_TRIGGER);
        expect(trigger.trigger(5, 5, 14)).toBe(TriggerTypes.TRAP);
        expect(object.getFrame(14)).toBe(object.animation.frames[2]);
    });

    it('allows at most one activation per tick even for a one-frame trap', () => {
        const level = emptyLevel(), info = new ObjectImageInfo(new ColorPalette());
        info.triggerEffectId = TriggerTypes.TRAP;
        info.triggerWidth = info.triggerHeight = 4;
        info.frameCount = 1;
        const objects: ObjectImageInfo[] = [];
        objects[2] = info;
        level.setMapObjects([new LevelElement(4, 4, 2, new DrawProperties(false, false, false, false))], objects);
        expect(level.triggers[0].trigger(5, 5, 10)).toBe(TriggerTypes.TRAP);
        expect(level.triggers[0].trigger(5, 5, 10)).toBe(TriggerTypes.NO_TRIGGER);
        expect(level.triggers[0].trigger(5, 5, 11)).toBe(TriggerTypes.TRAP);
    });

    it('uses aligned, bounded trigger cells and later-object priority', () => {
        const level = emptyLevel(), palette = new ColorPalette();
        const exit = new ObjectImageInfo(palette), trap = new ObjectImageInfo(palette);
        exit.triggerEffectId = TriggerTypes.EXIT_LEVEL;
        exit.triggerWidth = exit.triggerHeight = 4;
        trap.triggerEffectId = TriggerTypes.TRAP;
        trap.triggerWidth = trap.triggerHeight = 4;
        trap.frameCount = 5;
        const infos: ObjectImageInfo[] = [];
        infos[2] = exit; infos[3] = trap;
        const props = new DrawProperties(false, false, false, false);
        level.setMapObjects([new LevelElement(7, 7, 2, props), new LevelElement(7, 7, 3, props)], infos);
        let tick = 10;
        const manager = new TriggerManager({ getGameTicks: () => tick } as GameTimer);
        manager.addRange(level.triggers);
        expect(manager.trigger(4, 4)).toBe(TriggerTypes.TRAP);
        // The busy trap owns the cell, so the overlapping exit can't trigger.
        expect(manager.trigger(7, 7)).toBe(TriggerTypes.NO_TRIGGER);
        expect(manager.trigger(8, 7)).toBe(TriggerTypes.NO_TRIGGER);
        tick = 14;
        expect(manager.trigger(5, 5)).toBe(TriggerTypes.TRAP);
    });
});

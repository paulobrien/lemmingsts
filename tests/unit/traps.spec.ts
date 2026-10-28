import { describe, expect, it, vi } from 'vitest';
import { GameTypes } from '../../src/game/game-types';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingManager } from '../../src/game/game-play/lemming-manager';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import { ActionDiggSystem } from '../../src/game/game-play/actions/action-digg-system';
import { ActionBuildSystem } from '../../src/game/game-play/actions/action-build-system';
import { ActionBashSystem } from '../../src/game/game-play/actions/action-bash-system';
import { ActionMineSystem } from '../../src/game/game-play/actions/action-mine-system';
import { ActionFloatingSystem } from '../../src/game/game-play/actions/action-floating-system';
import { ActionCountdownSystem } from '../../src/game/game-play/actions/action-countdown-system';
import { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';
import { MaskProvider } from '../../src/game/resources/mask-provider';
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
    it.each([false, true])('checks floating objects unless its countdown expires (expires=$0)', expires => {
        const triggers = new TriggerManager({ getGameTicks: () => 1 } as GameTimer);
        triggers.add(new Trigger(TriggerTypes.TRAP, 5, 5, 8, 8));
        const manager = Object.create(LemmingManager.prototype) as LemmingManager;
        const first = new Lemming(6, 6, 0);
        const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
        first.setAction(new ActionFloatingSystem(sprites));
        first.state = 5; // Floater frame with zero vertical movement.
        const ohno = { process: () => LemmingStateType.NO_STATE_TYPE, getActionName: () => 'ohno',
            draw: () => undefined, triggerLemAction: () => false };
        const actions = []; actions[LemmingStateType.OHNO] = ohno;
        if (expires) {
            const masks = { GetMask: () => ({}) } as unknown as MaskProvider;
            first.countdownAction = new ActionCountdownSystem(masks);
            first.countdown = 1;
        }
        const level = { hasGroundAt: () => false } as unknown as Level;
        const removeOne = vi.fn();
        Object.assign(manager, { level, actions, logging: { debug: vi.fn() }, lemmings: [first], triggerManager: triggers,
            gameVictoryCondition: { getLeftCount: () => 0, removeOne }, nextNukingLemmingsIndex: -1 });
        manager.tick();
        expect(first.removed).toBe(!expires);
        expect(removeOne).toHaveBeenCalledTimes(expires ? 0 : 1);
        if (expires) expect(first.action).toBe(ohno);
    });

    it.each([
        { priorFrame: 0, waitFrames: 2, expectedX: 8, expectedY: 7 },
        { priorFrame: 3, waitFrames: 11, expectedX: 8, expectedY: 6 },
        { priorFrame: 14, waitFrames: 0, expectedX: 8, expectedY: 6 },
        { priorFrame: 15, waitFrames: 8, expectedX: 6, expectedY: 7 },
        { priorFrame: 23, waitFrames: 0, expectedX: 6, expectedY: 7 },
    ])('checks miners after movement on source frame following $priorFrame', ({ priorFrame, waitFrames, expectedX, expectedY }) => {
        let tick = 1;
        const triggers = new TriggerManager({ getGameTicks: () => tick } as GameTimer);
        triggers.add(new Trigger(TriggerTypes.TRAP, 5, 5, 9, 9));
        const manager = Object.create(LemmingManager.prototype) as LemmingManager;
        const first = new Lemming(6, 6, 0);
        const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
        const masks = { GetMask: () => ({ getMask: () => ({}) }) } as unknown as MaskProvider;
        first.setAction(new ActionMineSystem(sprites, masks));
        first.frameIndex = priorFrame;
        const level = { width: 32, height: 32, hasGroundAt: () => true,
            clearGroundWithMask: () => undefined, isMinerProtectedAt: () => false } as unknown as Level;
        const removeOne = vi.fn();
        Object.assign(manager, { level, lemmings: [first], triggerManager: triggers,
            gameVictoryCondition: { getLeftCount: () => 0, removeOne }, nextNukingLemmingsIndex: -1 });
        for (let i = 0; i < waitFrames; i++) {
            manager.tick();
            expect(first.removed).toBe(false);
            tick++;
        }
        manager.tick();
        expect([first.x, first.y]).toEqual([expectedX, expectedY]);
        expect(first.removed).toBe(true);
        expect(removeOne).toHaveBeenCalledOnce();
    });

    it.each([0, 16])('checks a basher only when it starts moving in cycle %i', firstFrame => {
        let tick = 1;
        const triggers = new TriggerManager({ getGameTicks: () => tick } as GameTimer);
        triggers.add(new Trigger(TriggerTypes.TRAP, 5, 5, 8, 8));
        const manager = Object.create(LemmingManager.prototype) as LemmingManager;
        const first = new Lemming(6, 6, 0);
        const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
        const masks = { GetMask: () => ({ getMask: () => ({}) }) } as unknown as MaskProvider;
        first.setAction(new ActionBashSystem(sprites, masks));
        first.frameIndex = firstFrame;
        const level = { getGroundMaskLayer: () => ({ hasGroundAt: () => true }),
            clearGroundWithMask: () => undefined, isProtectedAt: () => false } as unknown as Level;
        const removeOne = vi.fn();
        Object.assign(manager, { level, lemmings: [first], triggerManager: triggers,
            gameVictoryCondition: { getLeftCount: () => 0, removeOne }, nextNukingLemmingsIndex: -1 });
        for (let i = 1; i <= 10; i++) {
            manager.tick();
            expect(first.removed, `frame ${firstFrame + i}`).toBe(false);
            tick++;
        }
        manager.tick();
        expect(first.x).toBe(7);
        expect(first.removed).toBe(true);
        expect(removeOne).toHaveBeenCalledOnce();
    });

    it('does not check objects when a basher stops during its fifth frame', () => {
        const triggers = new TriggerManager({ getGameTicks: () => 1 } as GameTimer);
        triggers.add(new Trigger(TriggerTypes.TRAP, 5, 5, 8, 8));
        const manager = Object.create(LemmingManager.prototype) as LemmingManager;
        const first = new Lemming(6, 6, 0);
        const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
        const masks = { GetMask: () => ({ getMask: () => ({}) }) } as unknown as MaskProvider;
        first.setAction(new ActionBashSystem(sprites, masks));
        first.frameIndex = 4;
        const walker = { process: () => LemmingStateType.NO_STATE_TYPE, getActionName: () => 'walk',
            draw: () => undefined, triggerLemAction: () => false };
        const actions = []; actions[LemmingStateType.WALKING] = walker;
        const level = { getGroundMaskLayer: () => ({ hasGroundAt: () => false }),
            clearGroundWithMask: () => undefined } as unknown as Level;
        const removeOne = vi.fn();
        Object.assign(manager, { level, actions, logging: { debug: vi.fn() }, lemmings: [first], triggerManager: triggers,
            gameVictoryCondition: { getLeftCount: () => 0, removeOne }, nextNukingLemmingsIndex: -1 });
        manager.tick();
        expect(first.action).toBe(walker);
        expect(first.removed).toBe(false);
        expect(removeOne).not.toHaveBeenCalled();
    });

    it.each([
        { priorFrame: 8, bricks: 0 },
        { priorFrame: 9, bricks: 3 },
    ])('skips object checks on DOS builder brick frames (frame=$priorFrame, completed=$bricks)', ({ priorFrame, bricks }) => {
        let tick = 1;
        const triggers = new TriggerManager({ getGameTicks: () => tick } as GameTimer);
        triggers.add(new Trigger(TriggerTypes.TRAP, 5, 5, 8, 8));
        const manager = Object.create(LemmingManager.prototype) as LemmingManager;
        const first = new Lemming(6, 6, 0);
        first.setAction(new ActionBuildSystem({ getAnimation: () => ({}) } as unknown as LemmingsSprite));
        first.frameIndex = priorFrame;
        first.state = bricks;
        const level = { setGroundAt: vi.fn(), hasGroundAt: () => false } as unknown as Level;
        const removeOne = vi.fn();
        Object.assign(manager, { level, lemmings: [first], triggerManager: triggers,
            gameVictoryCondition: { getLeftCount: () => 0, removeOne }, nextNukingLemmingsIndex: -1 });
        manager.tick();
        expect(first.removed).toBe(false);
        tick++;
        manager.tick();
        expect(first.removed).toBe(true);
        expect(removeOne).toHaveBeenCalledOnce();
    });

    it.each([{ initial: true, checksAfter: 1 }, { initial: false, checksAfter: 8 }])(
        'checks a digger on the correct digging frame (initial=$initial)', ({ initial, checksAfter }) => {
        let tick = 1;
        const triggers = new TriggerManager({ getGameTicks: () => tick } as GameTimer);
        triggers.add(new Trigger(TriggerTypes.TRAP, 5, 5, 8, 8));
        const manager = Object.create(LemmingManager.prototype) as LemmingManager;
        const first = new Lemming(6, 6, 0);
        const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
        first.setAction(new ActionDiggSystem(sprites));
        if (!initial) first.state = 1;
        const level = { hasGroundAt: () => true, clearGroundAt: () => undefined,
            isOutOfLevel: () => false, isProtectedAt: () => false } as unknown as Level;
        const removeOne = vi.fn();
        Object.assign(manager, { level, lemmings: [first], triggerManager: triggers,
            gameVictoryCondition: { getLeftCount: () => 0, removeOne }, nextNukingLemmingsIndex: -1 });
        for (let i = 1; i < checksAfter; i++) {
            manager.tick();
            expect(first.removed, `animation frame ${i}`).toBe(false);
            tick++;
        }
        manager.tick();
        expect(first.removed).toBe(true);
        expect(removeOne).toHaveBeenCalledOnce();
    });

    it('does not check a digger on the frame its bomber countdown expires', () => {
        const triggers = new TriggerManager({ getGameTicks: () => 1 } as GameTimer);
        triggers.add(new Trigger(TriggerTypes.TRAP, 5, 5, 8, 8));
        const manager = Object.create(LemmingManager.prototype) as LemmingManager;
        const first = new Lemming(6, 6, 0);
        const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
        first.setAction(new ActionDiggSystem(sprites));
        first.countdown = 1;
        const ohno = { process: () => LemmingStateType.NO_STATE_TYPE, getActionName: () => 'ohno',
            draw: () => undefined, triggerLemAction: () => false };
        first.countdownAction = { ...ohno, process: () => LemmingStateType.OHNO };
        const actions = [];
        actions[LemmingStateType.OHNO] = ohno;
        const removeOne = vi.fn();
        Object.assign(manager, { level: emptyLevel(), lemmings: [first], triggerManager: triggers, actions, logging: { debug: vi.fn() },
            gameVictoryCondition: { getLeftCount: () => 0, removeOne }, nextNukingLemmingsIndex: -1 });
        manager.tick();
        expect(first.removed).toBe(false);
        expect(first.action).toBe(ohno);
        expect(removeOne).not.toHaveBeenCalled();
    });

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

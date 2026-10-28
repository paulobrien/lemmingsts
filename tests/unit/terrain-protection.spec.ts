import { describe, expect, it, vi } from 'vitest';
import { GameTypes } from '../../src/game/game-types';
import { ActionBashSystem } from '../../src/game/game-play/actions/action-bash-system';
import { ActionDiggSystem } from '../../src/game/game-play/actions/action-digg-system';
import { ActionExplodingSystem } from '../../src/game/game-play/actions/action-exploding-system';
import { ActionMineSystem } from '../../src/game/game-play/actions/action-mine-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingManager } from '../../src/game/game-play/lemming-manager';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import { SkillTypes } from '../../src/game/game-play/skill-types';
import { TriggerManager } from '../../src/game/game-play/trigger-manager';
import { DrawProperties } from '../../src/game/resources/draw-properties';
import { Level } from '../../src/game/resources/level';
import { ColorPalette } from '../../src/game/resources/lemmings/color-palette';
import { LevelElement } from '../../src/game/resources/lemmings/level-element';
import { LevelProperties } from '../../src/game/resources/lemmings/level-properties';
import { ObjectImageInfo } from '../../src/game/resources/lemmings/object-image-info';
import { TriggerTypes } from '../../src/game/resources/lemmings/trigger-types';
import { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';
import { Mask } from '../../src/game/resources/mask';
import { MaskProvider } from '../../src/game/resources/mask-provider';
import { ParticleTable } from '../../src/game/resources/particle-table';
import { SolidLayer } from '../../src/game/resources/solid-layer';

function filledLevel(): Level {
    const width = 32, height = 32;
    const palette = new ColorPalette();
    return new Level(width, height, GameTypes.LEMMINGS, 0, 0, new LevelProperties(), 0, false,
        new Uint8ClampedArray(width * height * 4).fill(255),
        new SolidLayer(width, height, new Int8Array(width * height).fill(1)), palette, palette);
}

function addObject(level: Level, type: TriggerTypes, x: number, y: number, width: number, height: number) {
    const object = new ObjectImageInfo(new ColorPalette());
    object.triggerEffectId = type;
    object.triggerWidth = width;
    object.triggerHeight = height;
    const objects: ObjectImageInfo[] = [];
    objects[2] = object;
    level.setMapObjects([new LevelElement(x, y, 2, new DrawProperties(false, false, true, false))], objects);
}

function steel(level: Level, x = 4, y = 8, width = 4, height = 4) {
    level.setSteelAreas([{ x, y, width, height }]);
}

const singlePixel = new Mask(1, 1, 0, 0, new Int8Array([1]));
const sprite = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
const masks = { GetMask: () => ({ getMask: () => singlePixel }) } as unknown as MaskProvider;

describe('DOS terrain object-map protection', () => {
    it('reads steel as four-pixel cells, including over air, and clips at the edge', () => {
        const level = filledLevel();
        steel(level, -2, -2, 4, 4);
        level.clearGroundAt(0, 0);
        expect(level.isProtectedAt(0, 0)).toBe(true);
        expect(level.isProtectedAt(3, 3)).toBe(true);
        expect(level.isProtectedAt(4, 3)).toBe(false);
        expect(level.isProtectedAt(31, 31)).toBe(false);
    });

    it.each([
        [TriggerTypes.ONWAY_LEFT, -1, 1],
        [TriggerTypes.ONWAY_RIGHT, 1, -1],
    ] as const)('allows movement in arrow %s direction and blocks the opposite', (type, allowed, blocked) => {
        const level = filledLevel();
        addObject(level, type, 7, 7, 4, 4);
        expect(level.isProtectedAt(4, 4, blocked)).toBe(true);
        expect(level.isProtectedAt(7, 7, allowed)).toBe(false);
        expect(level.isProtectedAt(8, 7, blocked)).toBe(false);
        expect(level.isProtectedAt(4, 4)).toBe(false);
    });

    it('lets later interactive objects replace an overlapping steel map cell', () => {
        const level = filledLevel();
        steel(level, 4, 4);
        expect(level.isProtectedAt(5, 5)).toBe(true);
        addObject(level, TriggerTypes.EXIT_LEVEL, 4, 4, 4, 4);
        expect(level.isProtectedAt(5, 5)).toBe(false);
        level.setMapObjects([], []);
        expect(level.isProtectedAt(5, 5)).toBe(true);
    });

    it('does not stop a basher solely because its mask touches steel behind its probe', () => {
        const level = filledLevel(); steel(level, 4, 8);
        const basher = new ActionBashSystem(sprite, masks);
        const lem = new Lemming(5, 10, 0);
        lem.frameIndex = 1;
        expect(basher.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
        // DOS masks can remove protected pixels away from the object-map probe.
        expect(level.hasGroundAt(5, 10)).toBe(false);
    });

    it('turns a moving basher when its forward probe reaches steel', () => {
        const level = filledLevel(); steel(level, 12, 0);
        const basher = new ActionBashSystem(sprite, masks);
        const lem = new Lemming(5, 10, 0);
        lem.frameIndex = 10;
        expect(basher.process(level, lem)).toBe(LemmingStateType.WALKING);
        expect(lem.lookRight).toBe(false);
    });

    it('turns a miner on steel or DOS right-arrow cells under its feet', () => {
        for (const type of [TriggerTypes.STEEL, TriggerTypes.ONWAY_RIGHT]) {
            const level = filledLevel(); addObject(level, type, 4, 8, 4, 4);
            const miner = new ActionMineSystem(sprite, masks);
            const lem = new Lemming(5, 8, 0);
            lem.frameIndex = 2;
            expect(miner.process(level, lem)).toBe(LemmingStateType.WALKING);
            expect(lem.lookRight).toBe(false);
        }
    });

    it('only stops a digger when steel is under the centre probe', () => {
        const digger = new ActionDiggSystem(sprite);
        const edge = filledLevel(); steel(edge, 4, 8);
        const lem = new Lemming(8, 8, 0);
        lem.state = 1; lem.frameIndex = 7;
        expect(digger.process(edge, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
        expect(edge.hasGroundAt(4, 8)).toBe(false);
        const center = filledLevel(); steel(center, 8, 8);
        lem.y = 8; lem.frameIndex = 7;
        expect(digger.process(center, lem)).toBe(LemmingStateType.WALKING);
    });

    it('uses the bomber centre rather than blast-mask overlap to check steel', () => {
        const offset = new Mask(1, 1, 4, 0, new Int8Array([1]));
        const offsetMasks = { GetMask: () => ({ getMask: () => offset }) } as unknown as MaskProvider;
        const triggers = { removeByOwner: () => undefined } as unknown as TriggerManager;
        const bomber = new ActionExplodingSystem(sprite, offsetMasks, triggers, {} as ParticleTable);
        const level = filledLevel(); steel(level, 8, 8);
        const lem = new Lemming(4, 8, 0);
        bomber.process(level, lem);
        expect(level.hasGroundAt(8, 8)).toBe(false);
        const protectedCenter = filledLevel(); steel(protectedCenter, 4, 8);
        lem.frameIndex = 0;
        bomber.process(protectedCenter, lem);
        expect(protectedCenter.hasGroundAt(8, 8)).toBe(true);
    });

    it('rejects protected or airborne skill assignments before executing the action', () => {
        const level = filledLevel(); steel(level, 12, 0);
        const manager = Object.create(LemmingManager.prototype) as LemmingManager;
        const triggerLemAction = vi.fn(() => true);
        Object.assign(manager, { level, skillActions: { [SkillTypes.BASHER]: { triggerLemAction } } });
        const lem = new Lemming(5, 8, 0);
        lem.action = { getActionName: () => 'walk' } as typeof lem.action;
        expect(manager.doLemmingAction(lem, SkillTypes.BASHER)).toBe(false);
        expect(triggerLemAction).not.toHaveBeenCalled();
        lem.action = { getActionName: () => 'falling' } as typeof lem.action;
        expect(manager.doLemmingAction(lem, SkillTypes.BASHER)).toBe(false);
    });
});

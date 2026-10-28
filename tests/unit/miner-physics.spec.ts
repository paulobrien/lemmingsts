import { describe, expect, it, vi } from 'vitest';
import { ActionMineSystem } from '../../src/game/game-play/actions/action-mine-system';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import { Level } from '../../src/game/resources/level';
import { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';
import { MaskProvider } from '../../src/game/resources/mask-provider';

function setup() {
    const mask0 = { stroke: 0 }, mask1 = { stroke: 1 };
    const sprite = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
    const masks = { GetMask: () => ({ getMask: (index: number) => index === 0 ? mask0 : mask1 }) } as unknown as MaskProvider;
    const miner = new ActionMineSystem(sprite, masks);
    const level = { width: 100, height: 160, clearGroundWithMask: vi.fn(), hasGroundAt: vi.fn(() => true),
        isMinerProtectedAt: vi.fn(() => false) } as unknown as Level;
    return { miner, level, mask0, mask1 };
}

describe('DOS miner movement', () => {
    it('starts mining one pixel below the original walking position', () => {
        const { miner } = setup();
        const lemming = new Lemming(10, 20, 0);
        expect(miner.triggerLemAction(lemming)).toBe(true);
        expect(lemming.y).toBe(21);
        expect(lemming.frameIndex).toBe(0);
        expect(miner.triggerLemAction(lemming)).toBe(false);
        expect(lemming.y).toBe(21);
    });

    it.each([true, false])('uses offset mask positions while facing right=%s', (right) => {
        const { miner, level, mask0, mask1 } = setup();
        const lemming = new Lemming(10, 20, 0);
        lemming.lookRight = right;
        miner.process(level, lemming);
        miner.process(level, lemming);
        expect(level.clearGroundWithMask).toHaveBeenNthCalledWith(1, mask0, 10, 20);
        expect(level.clearGroundWithMask).toHaveBeenNthCalledWith(2, mask1, right ? 11 : 9, 21);
    });

    it.each([true, false])('moves twice horizontally on frames 3 and 15 while facing right=%s', (right) => {
        const { miner, level } = setup();
        const lemming = new Lemming(10, 20, 0);
        lemming.lookRight = right;
        lemming.frameIndex = 2;
        expect(miner.process(level, lemming)).toBe(LemmingStateType.NO_STATE_TYPE);
        expect([lemming.x, lemming.y]).toEqual([right ? 12 : 8, 21]);
        lemming.frameIndex = 14;
        miner.process(level, lemming);
        expect([lemming.x, lemming.y]).toEqual([right ? 14 : 6, 21]);
    });

    it('moves one pixel down at the end of the animation cycle', () => {
        const { miner, level } = setup();
        const lemming = new Lemming(10, 20, 0);
        lemming.frameIndex = 23;
        expect(miner.process(level, lemming)).toBe(LemmingStateType.NO_STATE_TYPE);
        expect([lemming.x, lemming.y, lemming.frameIndex]).toEqual([10, 21, 0]);
    });

    it('turns at the world edge rather than moving outside it', () => {
        const { miner, level } = setup();
        const lemming = new Lemming(99, 20, 0);
        lemming.frameIndex = 2;
        expect(miner.process(level, lemming)).toBe(LemmingStateType.WALKING);
        expect([lemming.x, lemming.y, lemming.lookRight]).toEqual([99, 20, false]);
    });

    it('falls on a breakthrough and turns when the destination is protected', () => {
        const { miner, level } = setup();
        const lemming = new Lemming(10, 20, 0);
        lemming.frameIndex = 2;
        vi.mocked(level.hasGroundAt).mockReturnValueOnce(false);
        expect(miner.process(level, lemming)).toBe(LemmingStateType.FALLING);
        lemming.x = 10; lemming.y = 20; lemming.frameIndex = 2;
        vi.mocked(level.isMinerProtectedAt).mockReturnValueOnce(true);
        expect(miner.process(level, lemming)).toBe(LemmingStateType.WALKING);
        expect(vi.mocked(level.isMinerProtectedAt)).toHaveBeenLastCalledWith(12, 21, 1);
        expect(lemming.lookRight).toBe(false);
    });

    it('leaves the level immediately when the final step moves below the playable area', () => {
        const { miner, level } = setup();
        const lemming = new Lemming(10, 165, 0);
        lemming.frameIndex = 23;
        expect(miner.process(level, lemming)).toBe(LemmingStateType.OUT_OFF_LEVEL);
    });
});

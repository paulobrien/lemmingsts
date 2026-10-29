import { describe, expect, it, vi } from 'vitest';
import type { Game } from '../../src/game/game';
import { Lemming } from '../../src/game/game-play/lemming';
import { KeyboardTargeting } from '../../src/game/view/keyboard-targeting';
import type { Stage } from '../../src/game/view/stage';

describe('keyboard lemming targeting', () => {
    it('cycles selectable lemmings, follows them and assigns only the selected target', () => {
        const canvas = document.createElement('canvas');
        canvas.tabIndex = 0;
        document.body.append(canvas);
        const first = new Lemming(24, 30, 0);
        const second = new Lemming(80, 35, 1);
        second.lookRight = false;
        const unavailable = new Lemming(90, 35, 2);
        unavailable.disable();
        const all = [first, second, unavailable];
        const game = { getLemmingManager: () => ({
            getSelectableLemmings: () => all.filter(lem => !lem.removed && !lem.isDisabled()),
            getLemming: (id: number) => all[id],
        }) } as unknown as Game;
        let marker: (() => { x: number; y: number } | null) | null = null;
        const stage = { setKeyboardTarget: (value: typeof marker) => { marker = value; },
            revealGamePosition: vi.fn(), redraw: vi.fn() } as unknown as Stage;
        const assign = vi.fn(), announce = vi.fn();
        const controller = new KeyboardTargeting(canvas, stage, () => game, assign, announce);
        const key = (name: string) => canvas.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
        canvas.focus();
        expect(announce).toHaveBeenLastCalledWith(expect.stringContaining('left and right arrows'));
        key('Enter');
        expect(assign).not.toHaveBeenCalled();
        key('ArrowRight');
        expect(stage.revealGamePosition).toHaveBeenLastCalledWith(24, 30);
        expect(marker!()).toMatchObject({ x: 24, y: 30 });
        key('ArrowRight');
        expect(stage.revealGamePosition).toHaveBeenLastCalledWith(80, 35);
        expect(announce).toHaveBeenLastCalledWith(expect.stringContaining('Lemming 2 of 2'));
        key('Enter');
        expect(assign).toHaveBeenCalledWith(game, 1);
        second.remove();
        key('Enter');
        expect(assign).toHaveBeenCalledTimes(1);
        expect(announce).toHaveBeenLastCalledWith(expect.stringContaining('Choose a lemming'));
        key('ArrowLeft');
        expect(stage.revealGamePosition).toHaveBeenLastCalledWith(24, 30);
        controller.dispose();
        expect(marker).toBeNull();
        canvas.remove();
    });
});

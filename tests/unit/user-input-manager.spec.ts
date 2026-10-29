// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Stage } from '../../src/game/view/stage';
import { UserInputManager } from '../../src/game/view/user-input-manager';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingManager } from '../../src/game/game-play/lemming-manager';
import { SkillTypes } from '../../src/game/game-play/skill-types';

function canvas(): HTMLCanvasElement {
    const element = document.createElement('canvas');
    element.width = 800;
    element.height = 480;
    element.getBoundingClientRect = () => ({ left: 10, top: 20, width: 400, height: 240 } as DOMRect);
    element.getContext = vi.fn(() => ({ canvas: element, fillRect: vi.fn() })) as unknown as typeof element.getContext;
    return element;
}

function pointer(element: HTMLElement, type: string, x: number, y: number, id = 1, pointerType = 'touch'): void {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { clientX: x, clientY: y, pointerId: id, pointerType, button: 0 });
    element.dispatchEvent(event);
}

describe('canvas input', () => {
    it('reports and resets level zoom while the panel ignores the mouse wheel', () => {
        const element = canvas();
        const stage = new Stage(element, 3);
        const changed = vi.fn();
        stage.onZoomChange.on(changed);
        stage.zoomGame(1); // No playfield has been created yet.
        expect(changed).not.toHaveBeenCalled();
        const display = stage.getGameDisplay();
        vi.spyOn(display, 'getWidth').mockReturnValue(1600);
        vi.spyOn(display, 'getHeight').mockReturnValue(160);
        stage.getGuiDisplay();
        const game = stage.getStageImageAt(100, 100)!;
        const panel = stage.getStageImageAt(100, 450)!;

        stage.zoomGame(1);
        expect(game.viewPoint.scale).toBe(3.5);
        expect(changed).toHaveBeenLastCalledWith(true);
        const panelWheel = new WheelEvent('wheel', { clientX: 110, clientY: 225, deltaY: -1, cancelable: true });
        element.dispatchEvent(panelWheel);
        expect(panelWheel.defaultPrevented).toBe(false);
        expect(panel.viewPoint.scale).toBe(3);
        expect(game.viewPoint.scale).toBe(3.5);
        stage.resetZoom();
        expect(game.viewPoint.scale).toBe(3);
        expect(panel.viewPoint.scale).toBe(3);
        expect(changed).toHaveBeenLastCalledWith(false);

        const levelWheel = new WheelEvent('wheel', { clientX: 110, clientY: 70, deltaY: 1, cancelable: true });
        element.dispatchEvent(levelWheel);
        expect(levelWheel.defaultPrevented).toBe(true);
        expect(game.viewPoint.scale).toBe(2.5);
        expect(changed).toHaveBeenLastCalledWith(true);
        stage.resetZoom();
        expect(changed).toHaveBeenLastCalledWith(false);
        const calls = changed.mock.calls.length;
        element.dispatchEvent(new WheelEvent('wheel', { clientX: 110, clientY: 225, deltaY: -1, cancelable: true }));
        expect(panel.viewPoint.scale).toBe(3);
        expect(changed).toHaveBeenCalledTimes(calls);
        stage.dispose();
    });

    it('allows normal scrolling over a level area with no displayed scene', () => {
        const element = canvas();
        const stage = new Stage(element);
        const empty = new WheelEvent('wheel', { clientX: 110, clientY: 70, deltaY: 1, cancelable: true });
        element.dispatchEvent(empty);
        expect(empty.defaultPrevented).toBe(false);
        stage.dispose();
    });

    it('maps touch coordinates into the drawing buffer and releases the last pointer', () => {
        const element = canvas();
        const input = new UserInputManager(element);
        const down = vi.fn();
        const up = vi.fn();
        input.onMouseDown.on(down);
        input.onMouseUp.on(up);
        pointer(element, 'pointerdown', 110, 70);
        pointer(element, 'pointerup', 120, 80);
        expect(down).toHaveBeenCalledWith(expect.objectContaining({ x: 200, y: 100 }));
        expect(up).toHaveBeenCalledWith(expect.objectContaining({ x: 220, y: 120 }));
        input.dispose();
    });

    it('does not send a playfield tap when the pointer pans or is cancelled', () => {
        const element = canvas();
        const stage = new Stage(element);
        const playfield = stage.getGameDisplay();
        const click = vi.fn();
        playfield.onMouseDown.on(click);
        pointer(element, 'pointerdown', 110, 70);
        pointer(element, 'pointermove', 135, 70);
        pointer(element, 'pointerup', 135, 70);
        expect(click).not.toHaveBeenCalled();
        pointer(element, 'pointerdown', 110, 70);
        pointer(element, 'pointercancel', 110, 70);
        expect(click).not.toHaveBeenCalled();
        pointer(element, 'pointerdown', 110, 70);
        pointer(element, 'pointerup', 110, 70);
        expect(click).toHaveBeenCalledOnce();
        stage.dispose();
    });

    it('releases a panel press when the pointer is cancelled', () => {
        const element = canvas();
        const stage = new Stage(element);
        const panel = stage.getGuiDisplay();
        const up = vi.fn();
        panel.onMouseUp.on(up);
        pointer(element, 'pointerdown', 110, 225);
        pointer(element, 'pointercancel', 110, 225);
        expect(up).toHaveBeenCalledOnce();
        stage.dispose();
    });

    it('adds targeting tolerance only for a touch tap', () => {
        const element = canvas();
        const stage = new Stage(element);
        const click = vi.fn();
        stage.getGameDisplay().onMouseDown.on(click);
        pointer(element, 'pointerdown', 110, 70, 1, 'touch');
        pointer(element, 'pointerup', 110, 70, 1, 'touch');
        expect(click).toHaveBeenLastCalledWith(expect.objectContaining({ x: 100, y: 50, hitSlop: 8 }));
        pointer(element, 'pointerdown', 110, 70, 2, 'mouse');
        pointer(element, 'pointerup', 110, 70, 2, 'mouse');
        expect(click).toHaveBeenLastCalledWith(expect.objectContaining({ x: 100, y: 50, hitSlop: 0 }));
        stage.dispose();
    });

    it('selects the nearest lemming when expanded touch targets overlap', () => {
        const manager = Object.create(LemmingManager.prototype) as LemmingManager;
        const left = new Lemming(100, 100, 1);
        const right = new Lemming(109, 100, 2);
        (manager as unknown as { lemmings: Lemming[] }).lemmings = [left, right];
        expect(manager.getLemmingAt(120, 95)).toBeNull();
        expect(manager.getLemmingAt(120, 95, 8)).toBe(right);
        expect(manager.getLemmingAt(104, 95, 8)).toBe(left);
        expect(manager.getLemmingAt(200, 95, 8)).toBeNull();
    });

    it('does not let removed or disabled lemmings obscure a live target', () => {
        const manager = Object.create(LemmingManager.prototype) as LemmingManager;
        const removed = new Lemming(100, 100, 1);
        const disabled = new Lemming(101, 100, 2);
        const active = new Lemming(103, 100, 3);
        removed.remove();
        disabled.disable();
        (manager as unknown as { lemmings: Lemming[] }).lemmings = [removed, disabled, active];
        expect(manager.getLemmingAt(100, 95, 8)).toBe(active);
    });

    it('rejects commands targeting removed or disabled lemmings', () => {
        const manager = Object.create(LemmingManager.prototype) as LemmingManager;
        const triggerLemAction = vi.fn(() => true);
        (manager as unknown as { skillActions: unknown[] }).skillActions = [];
        (manager as unknown as { skillActions: unknown[] }).skillActions[SkillTypes.BOMBER] = { triggerLemAction };
        const removed = new Lemming(100, 100, 1);
        const disabled = new Lemming(101, 100, 2);
        const active = new Lemming(103, 100, 3);
        removed.remove();
        disabled.disable();
        expect(manager.doLemmingAction(removed, SkillTypes.BOMBER)).toBe(false);
        expect(manager.doLemmingAction(disabled, SkillTypes.BOMBER)).toBe(false);
        expect(triggerLemAction).not.toHaveBeenCalled();
        expect(manager.doLemmingAction(active, SkillTypes.BOMBER)).toBe(true);
        expect(triggerLemAction).toHaveBeenCalledOnce();
    });
});

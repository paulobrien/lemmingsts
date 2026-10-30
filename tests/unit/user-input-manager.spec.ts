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
    element.getContext = vi.fn(() => ({ canvas: element, fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
        beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), fill: vi.fn() })) as unknown as typeof element.getContext;
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

    it('centres a small level and maps touch, wheel and zoom relative to it', () => {
        const element = canvas();
        const stage = new Stage(element);
        const playfield = stage.getGameDisplay();
        vi.spyOn(playfield, 'getWidth').mockReturnValue(300);
        vi.spyOn(playfield, 'getHeight').mockReturnValue(100);
        const click = vi.fn();
        playfield.onMouseDown.on(click);

        // A 600x200 level is centred in the 800x380 playfield at (100,90).
        pointer(element, 'pointerdown', 80, 85);
        pointer(element, 'pointerup', 80, 85);
        expect(click).toHaveBeenLastCalledWith(expect.objectContaining({ x: 20, y: 20 }));
        pointer(element, 'pointerdown', 59.5, 85);
        pointer(element, 'pointerup', 59.5, 85);
        expect(click).toHaveBeenCalledTimes(1);
        const margin = new WheelEvent('wheel', { clientX: 59.5, clientY: 85, deltaY: 1, cancelable: true });
        element.dispatchEvent(margin);
        expect(margin.defaultPrevented).toBe(false);

        stage.zoomGame(-1);
        // The centred offset changes to (175,115) at 1.5x.
        pointer(element, 'pointerdown', 112.5, 92.5);
        pointer(element, 'pointerup', 112.5, 92.5);
        expect(click).toHaveBeenLastCalledWith(expect.objectContaining({ x: 20, y: 20 }));
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

    it('zooms around the pinch centre without assigning a skill, then accepts a fresh tap', () => {
        const element = canvas();
        const stage = new Stage(element);
        const playfield = stage.getGameDisplay();
        vi.spyOn(playfield, 'getWidth').mockReturnValue(1600);
        vi.spyOn(playfield, 'getHeight').mockReturnValue(400);
        const click = vi.fn(), changed = vi.fn();
        playfield.onMouseDown.on(click); stage.onZoomChange.on(changed);
        const view = stage.getStageImageAt(1, 1)!.viewPoint;
        view.x = 200; view.y = 100;
        pointer(element, 'pointerdown', 110, 80, 1);
        pointer(element, 'pointerdown', 210, 80, 2);
        pointer(element, 'pointermove', 250, 80, 2);
        expect(view.scale).toBeCloseTo(2.8);
        // The world position under the moving pinch centre is retained.
        expect(view.x + 340 / view.scale).toBeCloseTo(350);
        expect(view.y + 120 / view.scale).toBeCloseTo(160);
        expect(changed).toHaveBeenLastCalledWith(true);
        pointer(element, 'pointerup', 110, 80, 1);
        pointer(element, 'pointermove', 260, 80, 2);
        pointer(element, 'pointerup', 260, 80, 2);
        expect(view.scale).toBeCloseTo(2.8);
        expect(click).not.toHaveBeenCalled();
        stage.resetZoom();
        expect(view.scale).toBe(2);
        expect(changed).toHaveBeenLastCalledWith(false);
        pointer(element, 'pointerdown', 110, 80, 3);
        pointer(element, 'pointerup', 110, 80, 3);
        expect(click).toHaveBeenCalledOnce();
        stage.dispose();
    });

    it('suppresses a cancelled pinch and does not start a pinch across the Windows toolbar or map', () => {
        const element = canvas();
        const stage = new Stage(element);
        const playfield = stage.getGameDisplay();
        vi.spyOn(playfield, 'getWidth').mockReturnValue(1600);
        vi.spyOn(playfield, 'getHeight').mockReturnValue(400);
        const click = vi.fn(), panelClick = vi.fn();
        playfield.onMouseDown.on(click);
        stage.getGuiDisplay().onMouseDown.on(panelClick);
        stage.setMinimapProvider(() => []);
        const view = stage.getStageImageAt(1, 1)!.viewPoint;
        // Both pointers on the level: cancelling either prevents a tap.
        pointer(element, 'pointerdown', 110, 80, 1);
        pointer(element, 'pointerdown', 210, 80, 2);
        pointer(element, 'pointercancel', 210, 80, 2);
        pointer(element, 'pointerup', 110, 80, 1);
        expect(click).not.toHaveBeenCalled();
        expect(view.scale).toBe(2);
        // The second finger lands on the minimap; it must not start a pinch,
        // navigate the map, or activate a panel button.
        pointer(element, 'pointerdown', 110, 80, 3);
        pointer(element, 'pointerdown', 330, 226, 4);
        pointer(element, 'pointermove', 360, 226, 4);
        pointer(element, 'pointerup', 360, 226, 4);
        pointer(element, 'pointerup', 110, 80, 3);
        expect(view.scale).toBe(2);
        expect(view.x).toBe(0);
        expect(panelClick).not.toHaveBeenCalled();
        expect(click).not.toHaveBeenCalled();
        // A subsequent deliberate single-finger tap still works normally.
        pointer(element, 'pointerdown', 110, 80, 5);
        pointer(element, 'pointerup', 110, 80, 5);
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

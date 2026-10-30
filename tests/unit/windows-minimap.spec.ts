// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Stage } from '../../src/game/view/stage';

function testCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 480;
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 400, height: 240 } as DOMRect);
  canvas.getContext = vi.fn(() => ({ canvas, fillRect: vi.fn(), clearRect: vi.fn() })) as unknown as typeof canvas.getContext;
  return canvas;
}
function pointer(element: HTMLElement, type: string, x: number, y: number, id = 1): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, pointerId: id, pointerType: 'touch', button: 0 });
  element.dispatchEvent(event);
}

describe('Windows minimap navigation', () => {
  it('recentres and drags without activating the game panel, and stops intercepting after removal', () => {
    const canvas = testCanvas();
    const stage = new Stage(canvas);
    const scene = stage.getGameDisplay();
    vi.spyOn(scene, 'getWidth').mockReturnValue(1600);
    vi.spyOn(scene, 'getHeight').mockReturnValue(160);
    const panel = stage.getGuiDisplay();
    vi.spyOn(panel, 'getWidth').mockReturnValue(320);
    vi.spyOn(panel, 'getHeight').mockReturnValue(40);
    const panelDown = vi.fn(); const sceneDown = vi.fn();
    panel.onMouseDown.on(panelDown); scene.onMouseDown.on(sceneDown);
    stage.setMinimapProvider(() => []);
    // At the 2.3x Windows GUI scale the map is x≈518..760, y=426..472.
    pointer(canvas, 'pointerdown', 329.6, 244.5);
    pointer(canvas, 'pointerup', 329.6, 244.5);
    const camera = stage.getStageImageAt(1, 1)!.viewPoint;
    expect(camera.x).toBeCloseTo(600);
    expect(camera.y).toBe(0);
    expect(panelDown).not.toHaveBeenCalled();
    expect(sceneDown).not.toHaveBeenCalled();
    pointer(canvas, 'pointerdown', 329.6, 244.5);
    pointer(canvas, 'pointermove', 390, 244.5);
    pointer(canvas, 'pointerup', 390, 244.5);
    expect(camera.x).toBe(1200);
    stage.panGameBy(-200);
    expect(camera.x).toBe(1000);
    // The Windows panel is centred; margins are inert and button coordinates
    // still refer to the original logical 320-pixel panel.
    pointer(canvas, 'pointerdown', 20, 244.5);
    pointer(canvas, 'pointerup', 20, 244.5);
    expect(panelDown).not.toHaveBeenCalled();
    pointer(canvas, 'pointerdown', 35.2, 244.5);
    pointer(canvas, 'pointerup', 35.2, 244.5);
    expect(panelDown).toHaveBeenCalledOnce();
    expect(panelDown.mock.calls[0][0].x).toBeCloseTo(8);
    expect(panelDown.mock.calls[0][0].y).toBeCloseTo(30);
    stage.setMinimapProvider(null);
    pointer(canvas, 'pointerdown', 329.6, 244.5);
    pointer(canvas, 'pointerup', 329.6, 244.5);
    expect(panelDown).toHaveBeenCalledTimes(2);
    stage.dispose();
  });
});

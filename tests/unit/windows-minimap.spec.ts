// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Stage } from '../../src/game/view/stage';

function testCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 480;
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 400, height: 240 } as DOMRect);
  canvas.getContext = vi.fn(() => ({ canvas, fillRect: vi.fn(), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), fill: vi.fn() })) as unknown as typeof canvas.getContext;
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
    expect([canvas.width, canvas.height]).toEqual([960, 440]);
    // The Windows map occupies x=608..928, y=340..416 in a 960×440 canvas.
    pointer(canvas, 'pointerdown', 330, 226.2);
    pointer(canvas, 'pointerup', 330, 226.2);
    const camera = stage.getStageImageAt(1, 1)!.viewPoint;
    expect(camera.x).toBeCloseTo(560);
    expect(camera.y).toBe(0);
    expect(panelDown).not.toHaveBeenCalled();
    expect(sceneDown).not.toHaveBeenCalled();
    pointer(canvas, 'pointerdown', 330, 226.2);
    pointer(canvas, 'pointermove', 400, 226.2);
    pointer(canvas, 'pointerup', 400, 226.2);
    expect(camera.x).toBe(1120);
    stage.panGameBy(-200);
    expect(camera.x).toBe(920);
    // Arrows and thumb drag move the view without ever pressing a skill.
    pointer(canvas, 'pointerdown', 13.3, 198.9);
    pointer(canvas, 'pointerup', 13.3, 198.9);
    expect(camera.x).toBe(760);
    stage.panGameBy(-2000);
    pointer(canvas, 'pointerdown', 51.7, 198.9);
    pointer(canvas, 'pointermove', 400, 198.9);
    pointer(canvas, 'pointerup', 400, 198.9);
    expect(camera.x).toBe(1120);
    expect(panelDown).not.toHaveBeenCalled();
    // The Windows panel is centred; margins are inert and button coordinates
    // still refer to the original logical 320-pixel panel.
    pointer(canvas, 'pointerdown', 11, 227.3);
    pointer(canvas, 'pointerup', 11, 227.3);
    expect(panelDown).not.toHaveBeenCalled();
    pointer(canvas, 'pointerdown', 22.5, 227.3);
    pointer(canvas, 'pointerup', 22.5, 227.3);
    expect(panelDown).toHaveBeenCalledOnce();
    expect(panelDown.mock.calls[0][0].x).toBeCloseTo(8);
    expect(panelDown.mock.calls[0][0].y).toBe(30);
    // The status strip does not activate an icon underneath it.
    pointer(canvas, 'pointerdown', 22.5, 255);
    pointer(canvas, 'pointerup', 22.5, 255);
    expect(panelDown).toHaveBeenCalledOnce();
    stage.setMinimapProvider(null);
    expect([canvas.width, canvas.height]).toEqual([800, 480]);
    pointer(canvas, 'pointerdown', 329.6, 244.5);
    pointer(canvas, 'pointerup', 329.6, 244.5);
    expect(panelDown).toHaveBeenCalledTimes(2);
    stage.dispose();
  });
});

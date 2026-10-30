// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Stage } from '../../src/game/view/stage';

function setup() {
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 480;
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 400, height: 240 } as DOMRect);
  canvas.getContext = vi.fn(() => ({ canvas, fillRect: vi.fn(), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), fill: vi.fn() })) as unknown as typeof canvas.getContext;
  const stage = new Stage(canvas);
  const scene = stage.getGameDisplay();
  vi.spyOn(scene, 'getWidth').mockReturnValue(1600);
  vi.spyOn(scene, 'getHeight').mockReturnValue(160);
  const click = vi.fn(); scene.onMouseDown.on(click);
  return { canvas, stage, scene, click };
}

function pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number, id = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, pointerId: id, pointerType: 'touch', button: 0 });
  canvas.dispatchEvent(event);
}

describe('Windows fullscreen viewport', () => {
  it('fits level height on entry, preserves custom zoom and world centre on resize, and restores the baseline on reset and exit', () => {
    const { canvas, stage } = setup();
    stage.setGameViewPointPosition(400, 0);
    // Fullscreen can start before a Windows game has created its toolbar.
    stage.setWindowsFullscreenViewport(1500, 1000);
    expect([canvas.width, canvas.height]).toEqual([800, 480]);
    stage.setMinimapProvider(() => []);
    expect([canvas.width, canvas.height]).toEqual([960, 640]);
    const view = stage.getStageImageAt(1, 1)!.viewPoint;
    expect(view.scale).toBe(3.25); // 520 visible pixels / 160 level pixels
    expect(view.x + 960 / (2 * view.scale)).toBeCloseTo(600);
    const changed = vi.fn(); stage.onZoomChange.on(changed);
    stage.zoomGame(1);
    const customScale = view.scale, centre = view.x + 960 / (2 * view.scale);
    expect(changed).toHaveBeenLastCalledWith(true);
    stage.setWindowsFullscreenViewport(1200, 900);
    expect([canvas.width, canvas.height]).toEqual([960, 720]);
    expect(view.scale).toBe(customScale);
    expect(view.x + 960 / (2 * view.scale)).toBeCloseTo(centre);
    stage.resetZoom();
    expect(view.scale).toBe(3.75);
    expect(changed).toHaveBeenLastCalledWith(false);
    stage.setWindowsFullscreenViewport();
    expect([canvas.width, canvas.height]).toEqual([960, 440]);
    expect(view.scale).toBe(2);
    stage.dispose();
  });

  it('treats manually returning to fitted zoom as the default and adapts on the next rotation', () => {
    const { stage } = setup();
    stage.setMinimapProvider(() => []);
    stage.setWindowsFullscreenViewport(1500, 1000);
    const view = stage.getStageImageAt(1, 1)!.viewPoint;
    stage.zoomGame(1); stage.zoomGame(-1);
    expect(view.scale).toBe(3.25);
    stage.setWindowsFullscreenViewport(1200, 900);
    expect(view.scale).toBe(3.75);
    stage.dispose();
  });

  it('ignores zero-sized observations, bounds extreme height, and cancels a pending touch when the layout changes', () => {
    const { canvas, stage, scene, click } = setup();
    stage.setMinimapProvider(() => []);
    stage.setWindowsFullscreenViewport(0, 500);
    expect([canvas.width, canvas.height]).toEqual([960, 440]);
    pointer(canvas, 'pointerdown', 110, 70);
    stage.setWindowsFullscreenViewport(1500, 1000);
    pointer(canvas, 'pointerup', 110, 70);
    expect(click).not.toHaveBeenCalled();
    const view = stage.getStageImageAt(1, 1)!.viewPoint;
    stage.setWindowsFullscreenViewport(1, 100000);
    expect(canvas.height).toBe(8192);
    expect(view.scale).toBe(7.5);
    stage.zoomGame(1);
    expect(view.scale).toBe(8);
    stage.resetZoom();
    stage.setWindowsFullscreenViewport(100000, 1);
    expect(canvas.height).toBe(121);
    expect(view.scale).toBe(0.5);
    // A normal fresh touch is still delivered after resize cancellation.
    stage.setWindowsFullscreenViewport();
    pointer(canvas, 'pointerdown', 110, 70); pointer(canvas, 'pointerup', 110, 70);
    expect(click).toHaveBeenCalledOnce();
    expect(scene.getWidth()).toBe(1600);
    stage.dispose();
  });
});

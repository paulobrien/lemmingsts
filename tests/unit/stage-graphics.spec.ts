import { afterEach, describe, expect, it, vi } from 'vitest';
import { Stage } from '../../src/game/view/stage';

class TestImageData {
    readonly data: Uint8ClampedArray<ArrayBuffer>;
    constructor(data: Uint8ClampedArray<ArrayBuffer>, public width: number, public height: number) { this.data = data; }
}

function canvasContexts() {
    const contexts = new WeakMap<HTMLCanvasElement, Record<string, any>>();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
        let ctx = contexts.get(this);
        if (!ctx) {
            ctx = { canvas: this, fillRect: vi.fn(), drawImage: vi.fn(), putImageData: vi.fn(),
                createImageData: (width: number, height: number) => new TestImageData(new Uint8ClampedArray(width * height * 4), width, height),
                save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), strokeRect: vi.fn() };
            contexts.set(this, ctx);
        }
        return ctx as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext);
    vi.stubGlobal('ImageData', TestImageData);
    return contexts;
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('stage graphics modes', () => {
    it('renders original and enhanced previews from the same current game frame and camera', () => {
        const contexts = canvasContexts();
        const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 120;
        const stage = new Stage(canvas, 2);
        const display = stage.getGameDisplay(); display.initSize(20, 10);
        const image = display.getImageData()!;
        image.data.fill(255);
        stage.setGameViewPointPosition(3, 0);
        const original = document.createElement('canvas'), enhanced = document.createElement('canvas');
        stage.setComparisonCanvases(original, enhanced);
        const originalCall = contexts.get(original)!.drawImage.mock.lastCall;
        const enhancedCall = contexts.get(enhanced)!.drawImage.mock.lastCall;
        expect(originalCall[0]).not.toBe(enhancedCall[0]);
        expect(originalCall.slice(5)).toEqual(enhancedCall.slice(5));
        expect(originalCall[1]).toBe(3);
        // The enhanced image contains a one-pixel source border around the same crop.
        expect(enhancedCall.slice(1, 5)).toEqual([2, 0, 32, 20]);
        const filteredContext = contexts.get(enhancedCall[0])!;
        const firstFrame = (filteredContext.putImageData.mock.lastCall[0] as TestImageData).data.slice();
        image.data[(0 * 20 + 4) * 4] = 20;
        display.redraw();
        const secondFrame = (filteredContext.putImageData.mock.lastCall[0] as TestImageData).data;
        expect(secondFrame).not.toEqual(firstFrame);
        stage.setComparisonCanvases(null, null);
        const priorCalls = contexts.get(original)!.drawImage.mock.calls.length;
        display.redraw();
        expect(contexts.get(original)!.drawImage).toHaveBeenCalledTimes(priorCalls);
        stage.dispose();
    });

    it('keeps the original view usable when the enhancement cannot allocate', () => {
        const contexts = canvasContexts();
        const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 120;
        const stage = new Stage(canvas, 2);
        const display = stage.getGameDisplay(); display.initSize(20, 10);
        const error = vi.fn(); stage.onGraphicsError.on(error);
        vi.stubGlobal('ImageData', class { constructor() { throw new Error('allocation failed'); } });
        stage.setGraphicsMode('enhanced');
        expect(error).toHaveBeenCalledOnce();
        const main = contexts.get(canvas)!;
        expect(main.drawImage).toHaveBeenCalled();
        expect(main.drawImage.mock.lastCall[0]).not.toBe(canvas);
        stage.dispose();
    });
});

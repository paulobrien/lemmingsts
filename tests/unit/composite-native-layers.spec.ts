import { describe, expect, it } from 'vitest';
import { compositeNativeLayers } from '../../src/game/view/composite-native-layers';

describe('native layer composition', () => {
    it('preserves terrain behind transparent pixels and paints opaque sprites over it', () => {
        const background = new Uint8ClampedArray([10, 20, 30, 255, 1, 2, 3, 0, 40, 50, 60, 255]);
        const foreground = new Uint8ClampedArray([100, 101, 102, 0, 4, 5, 6, 255, 7, 8, 9, 255]);
        const output = new Uint8ClampedArray(background.length);
        compositeNativeLayers(background, foreground, output);
        expect([...output]).toEqual([10, 20, 30, 255, 4, 5, 6, 255, 7, 8, 9, 255]);
        expect([...background]).toEqual([10, 20, 30, 255, 1, 2, 3, 0, 40, 50, 60, 255]);
    });

    it('reuses the output without leaving sprites behind after they move', () => {
        const background = new Uint8ClampedArray([20, 30, 40, 255, 50, 60, 70, 255]);
        const foreground = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0]);
        const output = new Uint8ClampedArray(background.length);
        compositeNativeLayers(background, foreground, output);
        foreground.set([0, 0, 0, 0, 0, 255, 0, 255]);
        compositeNativeLayers(background, foreground, output);
        expect([...output]).toEqual([20, 30, 40, 255, 0, 255, 0, 255]);
    });

    it('blends partially transparent pixels over opaque and transparent backgrounds', () => {
        const background = new Uint8ClampedArray([100, 50, 0, 255, 200, 100, 0, 0]);
        const foreground = new Uint8ClampedArray([0, 50, 100, 128, 10, 20, 30, 128]);
        const output = new Uint8ClampedArray(background.length);
        compositeNativeLayers(background, foreground, output);
        expect([...output]).toEqual([50, 50, 50, 255, 10, 20, 30, 128]);
    });

    it('rejects incompatible or aliased buffers', () => {
        const data = new Uint8ClampedArray(4);
        expect(() => compositeNativeLayers(data, new Uint8ClampedArray(8), new Uint8ClampedArray(4))).toThrow();
        expect(() => compositeNativeLayers(data, new Uint8ClampedArray(4), data)).toThrow();
    });
});

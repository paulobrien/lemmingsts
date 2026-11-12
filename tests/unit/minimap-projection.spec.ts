import { describe, expect, it } from 'vitest';
import { minimapToWorld, worldToMinimap } from '../../src/game/view/minimap-projection';

describe('shared minimap projection', () => {
    it('round-trips level points using a centered DOS map and clamps outside drags', () => {
        const map = { originX: 210, originY: 18, scaleX: 16, scaleY: 8, maxX: 1599, maxY: 159 };
        expect(worldToMinimap(map, 800, 80)).toEqual({ x: 260, y: 28 });
        expect(minimapToWorld(map, 260, 28)).toEqual({ x: 800, y: 80 });
        expect(minimapToWorld(map, 0, 100)).toEqual({ x: 0, y: 159 });
    });

    it('round-trips level points for the Windows map at fractional scale', () => {
        const map = { originX: 608, originY: 20, scaleX: 1600 / 320, scaleY: 160 / 76, maxX: 1600, maxY: 160 };
        const point = worldToMinimap(map, 800, 80);
        expect(point).toEqual({ x: 768, y: 58 });
        expect(minimapToWorld(map, point.x, point.y)).toEqual({ x: 800, y: 80 });
        expect(minimapToWorld(map, 1000, -1)).toEqual({ x: 1600, y: 0 });
    });
});

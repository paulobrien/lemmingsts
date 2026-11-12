/** Map coordinates use the same origin and scale for drawing and navigation. */
export interface MinimapProjection {
    originX: number;
    originY: number;
    /** Level pixels per minimap pixel. */
    scaleX: number;
    scaleY: number;
    /** Largest coordinates navigation may select, in level pixels. */
    maxX: number;
    maxY: number;
}

/** Map a minimap point to the level, clamping drags beyond its edges. */
export function minimapToWorld(projection: MinimapProjection, x: number, y: number): { x: number; y: number } {
    return {
        x: Math.max(0, Math.min(projection.maxX, (x - projection.originX) * projection.scaleX)),
        y: Math.max(0, Math.min(projection.maxY, (y - projection.originY) * projection.scaleY)),
    };
}

/** Map a level position into the same minimap coordinate system. */
export function worldToMinimap(projection: MinimapProjection, x: number, y: number): { x: number; y: number } {
    return { x: projection.originX + x / projection.scaleX, y: projection.originY + y / projection.scaleY };
}

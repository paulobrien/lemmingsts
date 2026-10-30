/** Graphics are a device-local presentation preference; they do not affect play. */
export type GraphicsMode = 'original' | 'enhanced' | 'windows';
const GRAPHICS_KEY = 'lemmings.graphics.v1';

export function readGraphicsMode(): GraphicsMode {
    try {
        const mode = localStorage.getItem(GRAPHICS_KEY);
        return mode === 'enhanced' || mode === 'windows' ? mode : 'original';
    }
    catch { return 'original'; }
}

export function saveGraphicsMode(mode: GraphicsMode): boolean {
    try { localStorage.setItem(GRAPHICS_KEY, mode); return true; }
    catch { return false; }
}

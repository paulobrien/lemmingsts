/** Toolbar animation is a device preference; old installs default to animated. */
const KEY = 'lemmings.windows-icon-animations.v1';

export function readWindowsIconAnimationsEnabled(): boolean {
    try { return localStorage.getItem(KEY) !== 'off'; }
    catch { return true; }
}

export function saveWindowsIconAnimationsEnabled(enabled: boolean): boolean {
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); return true; }
    catch { return false; }
}

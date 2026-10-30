/** Presentation mode is local to this browser and separate from progress backups. */
export type GameMode = 'dos' | 'windows';
const GAME_MODE_KEY = 'lemmings.game-mode.v1';
// Distinguish automatic choices from an explicit preference, so installing a
// second edition does not override a player who deliberately chose DOS.
const GAME_MODE_PREFERENCE_KEY = 'lemmings.game-mode.preference.v1';
// IndexedDB may still be available when preference storage is blocked or full.
// Keep a failed selection for this visit so gameplay reads the same edition as
// the home screen, without pretending it was saved for the next visit.
let unsavedSelection: { mode: GameMode; preference: GameMode | null } | null = null;

/** Current mode, including a temporary availability-driven selection. */
export function readGameMode(): GameMode {
  if (unsavedSelection) return unsavedSelection.mode;
  try {
    const saved = localStorage.getItem(GAME_MODE_KEY);
    if (saved !== null) return saved === 'windows' ? 'windows' : 'dos';
    return localStorage.getItem('lemmings.audio-style.v1') === 'windows' &&
      localStorage.getItem('lemmings.graphics.v1') === 'windows' ? 'windows' : 'dos';
  } catch { return 'dos'; }
}

/** An explicit choice, or null when no choice has yet been made. */
export function readGameModePreference(): GameMode | null {
  if (unsavedSelection) return unsavedSelection.preference;
  try {
    const preference = localStorage.getItem(GAME_MODE_PREFERENCE_KEY);
    if (preference !== null) return preference === 'dos' || preference === 'windows' ? preference : null;
    // Earlier releases recorded manual selections under GAME_MODE_KEY only.
    const saved = localStorage.getItem(GAME_MODE_KEY);
    if (saved === 'dos' || saved === 'windows') return saved;
    return localStorage.getItem('lemmings.audio-style.v1') === 'windows' &&
      localStorage.getItem('lemmings.graphics.v1') === 'windows' ? 'windows' : null;
  } catch { return null; }
}

/** Apply the mode for this visit; return whether it was also saved for later visits. */
export function writeGameMode(mode: GameMode, explicit = true): boolean {
  if (mode !== 'dos' && mode !== 'windows') return false;
  const preference = explicit ? mode : readGameModePreference();
  try {
    localStorage.setItem(GAME_MODE_PREFERENCE_KEY, preference ?? 'auto');
    localStorage.setItem(GAME_MODE_KEY, mode);
    unsavedSelection = null;
    return true;
  } catch {
    unsavedSelection = { mode, preference };
    return false;
  }
}

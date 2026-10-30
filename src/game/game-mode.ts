/** Presentation mode is local to this browser and separate from progress backups. */
export type GameMode = 'dos' | 'windows';
const GAME_MODE_KEY = 'lemmings.game-mode.v1';

/** Preserve an existing fully Windows presentation, otherwise default to DOS. */
export function readGameMode(): GameMode {
  try {
    const saved = localStorage.getItem(GAME_MODE_KEY);
    if (saved !== null) return saved === 'windows' ? 'windows' : 'dos';
    return localStorage.getItem('lemmings.audio-style.v1') === 'windows' &&
      localStorage.getItem('lemmings.graphics.v1') === 'windows' ? 'windows' : 'dos';
  } catch { return 'dos'; }
}

export function writeGameMode(mode: GameMode): boolean {
  if (mode !== 'dos' && mode !== 'windows') return false;
  try { localStorage.setItem(GAME_MODE_KEY, mode); return true; }
  catch { return false; }
}

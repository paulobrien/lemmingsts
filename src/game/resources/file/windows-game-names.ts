/** Resources for the original 120 Windows levels, supplied by the player. */
export const WINDOWS_LEVEL_FILES: readonly string[] = Array.from({ length: 10 }, (_, group) =>
  Array.from({ length: 8 }, (_, level) => `LVL${String(group).padStart(3, '0')}${level}.LVL`)).flat();
export const WINDOWS_GROUND_FILES: readonly string[] = Array.from({ length: 5 }, (_, i) => `GROUND${i}O.DAT`);
export const WINDOWS_GAME_FILES: readonly string[] = [...WINDOWS_LEVEL_FILES, ...WINDOWS_GROUND_FILES, 'LEMMINGS.DB'];

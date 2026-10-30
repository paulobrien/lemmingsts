// @vitest-environment node
// Opt in: RUN_PRIVATE_GAME_TESTS=1 WINDOWS_LEMMINGS_ISO=/path/to/Windows.iso
// The only imported game data is the user-supplied Windows ISO.
import { readFile } from 'node:fs/promises';
import { indexedDB } from 'fake-indexeddb';
import { expect, it, vi } from 'vitest';
import { GameFactory } from '../../src/game/game-factory';
import { GameTypes } from '../../src/game/game-types';
import { GameStateTypes } from '../../src/game/game-state-types';
import { clearWindowsGame, importWindowsGame, getWindowsGameFile } from '../../src/game/resources/file/windows-game-store';
import { clearWindowsGraphics, importWindowsGraphics } from '../../src/game/resources/file/windows-graphics-store';
import { parseWindowsLevelDatabase } from '../../src/game/resources/windows-level-database';
import { getTestedSolution } from '../../src/game/solutions/tested-solutions';

it.skipIf(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.WINDOWS_LEMMINGS_ISO)(
  'runs the existing recorded solutions on every corresponding Windows-only level', async () => {
    vi.stubGlobal('indexedDB', indexedDB);
    vi.stubGlobal('window', { atob });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'dir').mockImplementation(() => undefined);
    try {
      const data = await readFile(process.env.WINDOWS_LEMMINGS_ISO!);
      const iso = new File([Uint8Array.from(data)], 'windows.iso');
      await importWindowsGame([iso]);
      await importWindowsGraphics([iso]);
      const config = await readFile('public/data/config.json', 'utf8');
      const order = JSON.parse(config)[0]['level.order'] as number[][];
      vi.stubGlobal('fetch', async () => new Response(config));
      const groups = parseWindowsLevelDatabase((await getWindowsGameFile('LEMMINGS.DB'))!);
      const factory = new GameFactory('/data', 'windows');
      let checked = 0;
      for (let group = 0; group < groups.length; group++) {
        for (let index = 0; index < groups[group].levels.length; index++) {
          const entry = groups[group].levels[index];
          const source = Number(entry.fileName.slice(3, 7));
          const dosIndex = order[group].findIndex(value => Math.abs(value) === source);
          expect(dosIndex, `${group}/${index} must map to a unique DOS record`).toBeGreaterThanOrEqual(0);
          expect(order[group].filter(value => Math.abs(value) === source)).toHaveLength(1);
          const solution = getTestedSolution(group, dosIndex);
          expect(solution, `${entry.name} must have a recorded replay`).toBeDefined();
          const game = await factory.getGame(GameTypes.LEMMINGS, group, index);
          expect(game, `${entry.name} must load with Windows files alone`).toBeDefined();
          game!.getCommandManager().loadReplay(solution!.replay);
          const maxTicks = game!.getGameTimer().getGameTimeLimit() + 1;
          for (let tick = 0; tick < maxTicks && game!.getGameState() === GameStateTypes.RUNNING; tick++) game!.getGameTimer().tick();
          expect.soft(game!.getGameState(), `${group + 1}/${index + 1} ${entry.name}`).toBe(GameStateTypes.SUCCEEDED);
          expect.soft(game!.getCommandManager().serialize(), `${entry.name} must execute every command`).toBe(solution!.replay);
          checked++;
        }
      }
      expect(checked).toBe(114);
    } finally {
      await clearWindowsGraphics();
      await clearWindowsGame();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  }, 180_000,
);

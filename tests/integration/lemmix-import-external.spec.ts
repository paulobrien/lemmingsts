// @vitest-environment node
// Optional research check only. Download the DOS Tricky 7 example locally from:
// https://www.lemmingsforums.net/index.php?topic=1490.45
// LEMMIX_V1_REPLAY_PATH=/absolute/path npx vitest run tests/integration/lemmix-import-external.spec.ts
// Tricky 22: https://www.lemmingsforums.net/index.php?topic=1490.30 (Tricky22-100%.lrb)
// LEMMIX_TRICKY22_REPLAY_PATH=/absolute/path RUN_PRIVATE_GAME_TESTS=1 npx vitest run tests/integration/lemmix-import-external.spec.ts
// The externally authored replay is not part of this repository.
import { readFile, readdir } from 'node:fs/promises';
import { indexedDB } from 'fake-indexeddb';
import { expect, it, vi } from 'vitest';
import { GameFactory } from '../../src/game/game-factory';
import { GameTypes } from '../../src/game/game-types';
import { GameStateTypes } from '../../src/game/game-state-types';
import { getTestedSolution } from '../../src/game/solutions/tested-solutions';
import { clearLemmingsFiles, importLemmingsFiles } from '../../src/game/resources/file/game-file-store';
import { parseLemmixReplay, verifyLemmixCandidate } from '../../src/game/solutions/lemmix-replay-import';

const path = process.env.LEMMIX_V1_REPLAY_PATH;
it.skipIf(!path)('parses a public DOS v1 replay as an unverified candidate', async () => {
  const bytes = Uint8Array.from(await readFile(path!));
  const candidate = parseLemmixReplay(bytes, { levelTitle: 'Been there, seen it, done it', initialReleaseRate: 20 });
  expect(candidate.sourceVersion).toBe(1);
  expect(candidate.events.some(event => event.kind === 'assign')).toBe(true);
  expect(candidate.events.some(event => event.kind === 'rate' && event.delta === 79)).toBe(true);
});

async function verifyExternalReplay(replayPath: string, groupIndex: number, levelIndex: number, rescued: number) {
  vi.stubGlobal('indexedDB', indexedDB);
  vi.stubGlobal('window', { atob });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'dir').mockImplementation(() => undefined);
  try {
    const names = await readdir('dos/lemmings');
    await importLemmingsFiles(await Promise.all(names.map(async name =>
      new File([Uint8Array.from(await readFile(`dos/lemmings/${name}`))], name))));
    vi.stubGlobal('fetch', async () => new Response(await readFile('public/data/config.json', 'utf8')));
    const game = (await new GameFactory('/data').getGame(GameTypes.LEMMINGS, groupIndex, levelIndex))!;
    const bytes = Uint8Array.from(await readFile(replayPath));
    const candidate = parseLemmixReplay(bytes, { levelTitle: game.level.name.trim(), initialReleaseRate: game.level.releaseRate });
    const result = verifyLemmixCandidate(game, candidate);
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
    expect(game.getVictoryCondition().getSurvivorsCount()).toBe(rescued);
  } finally {
    await clearLemmingsFiles();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
}

// Optional replay sources are documented in docu/LEMMIX_REPLAY_IMPORT.md.
const externalReplays = [
  { name: 'Tricky 7', env: 'LEMMIX_V1_REPLAY_PATH', group: 1, level: 6, saved: 75 },
  { name: 'Tricky 22', env: 'LEMMIX_TRICKY22_REPLAY_PATH', group: 1, level: 21, saved: 80 },
  { name: 'Taxing 9', env: 'LEMMIX_TAXING9_REPLAY_PATH', group: 2, level: 8, saved: 20 },
  { name: 'Fun 12', env: 'LEMMIX_FUN12_REPLAY_PATH', group: 0, level: 11, saved: 80 },
  { name: 'Fun 14', env: 'LEMMIX_FUN14_REPLAY_PATH', group: 0, level: 13, saved: 80 },
  { name: 'Fun 15', env: 'LEMMIX_FUN15_REPLAY_PATH', group: 0, level: 14, saved: 80 },
  { name: 'Fun 17', env: 'LEMMIX_FUN17_REPLAY_PATH', group: 0, level: 16, saved: 20 },
  { name: 'Fun 19', env: 'LEMMIX_FUN19_REPLAY_PATH', group: 0, level: 18, saved: 80 },
  { name: 'Fun 23', env: 'LEMMIX_FUN23_REPLAY_PATH', group: 0, level: 22, saved: 80 },
  { name: 'Fun 25', env: 'LEMMIX_FUN25_REPLAY_PATH', group: 0, level: 24, saved: 73 },
  { name: 'Fun 28', env: 'LEMMIX_FUN28_REPLAY_PATH', group: 0, level: 27, saved: 80 },
  { name: 'Fun 29', env: 'LEMMIX_FUN29_REPLAY_PATH', group: 0, level: 28, saved: 80 },
  { name: 'Tricky 5', env: 'LEMMIX_TRICKY5_REPLAY_PATH', group: 1, level: 4, saved: 70 },
  { name: 'Tricky 8', env: 'LEMMIX_TRICKY8_REPLAY_PATH', group: 1, level: 7, saved: 58 },
  { name: 'Tricky 10', env: 'LEMMIX_TRICKY10_REPLAY_PATH', group: 1, level: 9, saved: 80 },
  { name: 'Tricky 11', env: 'LEMMIX_TRICKY11_REPLAY_PATH', group: 1, level: 10, saved: 48 },
  { name: 'Tricky 12', env: 'LEMMIX_TRICKY12_REPLAY_PATH', group: 1, level: 11, saved: 50 },
  { name: 'Tricky 14', env: 'LEMMIX_TRICKY14_REPLAY_PATH', group: 1, level: 13, saved: 70 },
  { name: 'Tricky 18', env: 'LEMMIX_TRICKY18_REPLAY_PATH', group: 1, level: 17, saved: 9 },
  { name: 'Tricky 20', env: 'LEMMIX_TRICKY20_REPLAY_PATH', group: 1, level: 19, saved: 80 },
  { name: 'Tricky 22 (alternate)', env: 'LEMMIX_TRICKY22_ALT_REPLAY_PATH', group: 1, level: 21, saved: 80 },
  { name: 'Tricky 23', env: 'LEMMIX_TRICKY23_REPLAY_PATH', group: 1, level: 22, saved: 79 },
  { name: 'Tricky 23 (nuke)', env: 'LEMMIX_TRICKY23_NUKE_REPLAY_PATH', group: 1, level: 22, saved: 50 },
  { name: 'Tricky 24', env: 'LEMMIX_TRICKY24_REPLAY_PATH', group: 1, level: 23, saved: 80 },
  { name: 'Tricky 27', env: 'LEMMIX_TRICKY27_REPLAY_PATH', group: 1, level: 26, saved: 73 },
  { name: 'Tricky 28', env: 'LEMMIX_TRICKY28_REPLAY_PATH', group: 1, level: 27, saved: 80 },
  { name: 'Tricky 29', env: 'LEMMIX_TRICKY29_REPLAY_PATH', group: 1, level: 28, saved: 80 },
  { name: 'Tricky 30', env: 'LEMMIX_TRICKY30_REPLAY_PATH', group: 1, level: 29, saved: 74 },
  { name: 'Taxing 2', env: 'LEMMIX_TAXING2_REPLAY_PATH', group: 2, level: 1, saved: 76 },
  { name: 'Taxing 3', env: 'LEMMIX_TAXING3_REPLAY_PATH', group: 2, level: 2, saved: 80 },
  { name: 'Taxing 4', env: 'LEMMIX_TAXING4_REPLAY_PATH', group: 2, level: 3, saved: 40 },
  { name: 'Taxing 5', env: 'LEMMIX_TAXING5_REPLAY_PATH', group: 2, level: 4, saved: 53 },
  { name: 'Taxing 6', env: 'LEMMIX_TAXING6_REPLAY_PATH', group: 2, level: 5, saved: 50 },
  { name: 'Taxing 7', env: 'LEMMIX_TAXING7_REPLAY_PATH', group: 2, level: 6, saved: 78 },
  { name: 'Taxing 8', env: 'LEMMIX_TAXING8_REPLAY_PATH', group: 2, level: 7, saved: 80 },
  { name: 'Taxing 11', env: 'LEMMIX_TAXING11_REPLAY_PATH', group: 2, level: 10, saved: 50 },
  { name: 'Taxing 12', env: 'LEMMIX_TAXING12_REPLAY_PATH', group: 2, level: 11, saved: 8 },
  { name: 'Taxing 13', env: 'LEMMIX_TAXING13_REPLAY_PATH', group: 2, level: 12, saved: 80 },
  { name: 'Taxing 14', env: 'LEMMIX_TAXING14_REPLAY_PATH', group: 2, level: 13, saved: 77 },
  { name: 'Taxing 15', env: 'LEMMIX_TAXING15_REPLAY_PATH', group: 2, level: 14, saved: 80 },
  { name: 'Taxing 16', env: 'LEMMIX_TAXING16_REPLAY_PATH', group: 2, level: 15, saved: 80 },
  { name: 'Taxing 17', env: 'LEMMIX_TAXING17_REPLAY_PATH', group: 2, level: 16, saved: 80 },
  { name: 'Taxing 18', env: 'LEMMIX_TAXING18_REPLAY_PATH', group: 2, level: 17, saved: 74 },
  { name: 'Taxing 20', env: 'LEMMIX_TAXING20_REPLAY_PATH', group: 2, level: 19, saved: 70 },
  { name: 'Taxing 21', env: 'LEMMIX_TAXING21_REPLAY_PATH', group: 2, level: 20, saved: 20 },
  { name: 'Taxing 22', env: 'LEMMIX_TAXING22_REPLAY_PATH', group: 2, level: 21, saved: 50 },
  { name: 'Taxing 23', env: 'LEMMIX_TAXING23_REPLAY_PATH', group: 2, level: 22, saved: 80 },
  { name: 'Taxing 25', env: 'LEMMIX_TAXING25_REPLAY_PATH', group: 2, level: 24, saved: 80 },
  { name: 'Taxing 26', env: 'LEMMIX_TAXING26_REPLAY_PATH', group: 2, level: 25, saved: 80 },
  { name: 'Taxing 27', env: 'LEMMIX_TAXING27_REPLAY_PATH', group: 2, level: 26, saved: 77 },
  { name: 'Taxing 28', env: 'LEMMIX_TAXING28_REPLAY_PATH', group: 2, level: 27, saved: 70 },
  { name: 'Taxing 29', env: 'LEMMIX_TAXING29_REPLAY_PATH', group: 2, level: 28, saved: 80 },
  { name: 'Mayhem 1', env: 'LEMMIX_MAYHEM1_REPLAY_PATH', group: 3, level: 0, saved: 80 },
  { name: 'Mayhem 2', env: 'LEMMIX_MAYHEM2_REPLAY_PATH', group: 3, level: 1, saved: 80 },
  { name: 'Mayhem 3', env: 'LEMMIX_MAYHEM3_REPLAY_PATH', group: 3, level: 2, saved: 25 },
  { name: 'Mayhem 4', env: 'LEMMIX_MAYHEM4_REPLAY_PATH', group: 3, level: 3, saved: 50 },
  { name: 'Mayhem 5', env: 'LEMMIX_MAYHEM5_REPLAY_PATH', group: 3, level: 4, saved: 76 },
  { name: 'Mayhem 6', env: 'LEMMIX_MAYHEM6_REPLAY_PATH', group: 3, level: 5, saved: 75 },
  { name: 'Mayhem 7', env: 'LEMMIX_MAYHEM7_REPLAY_PATH', group: 3, level: 6, saved: 50 },
  { name: 'Mayhem 8', env: 'LEMMIX_MAYHEM8_REPLAY_PATH', group: 3, level: 7, saved: 74 },
  { name: 'Mayhem 9', env: 'LEMMIX_MAYHEM9_REPLAY_PATH', group: 3, level: 8, saved: 79 },
  { name: 'Mayhem 10', env: 'LEMMIX_MAYHEM10_REPLAY_PATH', group: 3, level: 9, saved: 73 },
  { name: 'Mayhem 12', env: 'LEMMIX_MAYHEM12_REPLAY_PATH', group: 3, level: 11, saved: 75 },
  { name: 'Mayhem 14', env: 'LEMMIX_MAYHEM14_REPLAY_PATH', group: 3, level: 13, saved: 80 },
  { name: 'Mayhem 17', env: 'LEMMIX_MAYHEM17_REPLAY_PATH', group: 3, level: 16, saved: 77 },
  { name: 'Mayhem 18', env: 'LEMMIX_MAYHEM18_REPLAY_PATH', group: 3, level: 17, saved: 72 },
  { name: 'Mayhem 19', env: 'LEMMIX_MAYHEM19_REPLAY_PATH', group: 3, level: 18, saved: 48 },
  { name: 'Mayhem 21', env: 'LEMMIX_MAYHEM21_REPLAY_PATH', group: 3, level: 20, saved: 50 },
  { name: 'Mayhem 23', env: 'LEMMIX_MAYHEM23_REPLAY_PATH', group: 3, level: 22, saved: 72 },
  { name: 'Mayhem 25', env: 'LEMMIX_MAYHEM25_REPLAY_PATH', group: 3, level: 24, saved: 73 },
  { name: 'Mayhem 26', env: 'LEMMIX_MAYHEM26_REPLAY_PATH', group: 3, level: 25, saved: 76 },
  { name: 'Mayhem 27', env: 'LEMMIX_MAYHEM27_REPLAY_PATH', group: 3, level: 26, saved: 50 },
  { name: 'Mayhem 29', env: 'LEMMIX_MAYHEM29_REPLAY_PATH', group: 3, level: 28, saved: 77 },
  { name: 'Mayhem 30', env: 'LEMMIX_MAYHEM30_REPLAY_PATH', group: 3, level: 29, saved: 80 },
];

for (const { name, env, group, level, saved } of externalReplays) {
  const replayPath = process.env[env];
  it.skipIf(!replayPath || process.env.RUN_PRIVATE_GAME_TESTS !== '1')(`verifies the public ${name} replay against local game data`, async () => {
    await verifyExternalReplay(replayPath!, group, level, saved);
  }, 60000);
}

// Strict opt-in gate: each original level must actually complete, whether its
// replay is project-authored or supplied locally from a documented source.
it.skipIf(process.env.REQUIRE_ALL_LEVEL_COMPLETIONS !== '1')('completes all 120 levels with available replays', async () => {
  expect(process.env.RUN_PRIVATE_GAME_TESTS, 'Set RUN_PRIVATE_GAME_TESTS=1 to use your original game files').toBe('1');
  const missing: string[] = [];
  const choices: Array<{ group: number; level: number; replayPath?: string; saved?: number }> = [];
  for (let group = 0; group < 4; group++) {
    for (let level = 0; level < 30; level++) {
      if (getTestedSolution(group, level)) {
        choices.push({ group, level });
        continue;
      }
      const available = externalReplays.find(entry => entry.group === group && entry.level === level && process.env[entry.env]);
      if (available) choices.push({ group, level, replayPath: process.env[available.env], saved: available.saved });
      else {
        const candidates = externalReplays.filter(entry => entry.group === group && entry.level === level).map(entry => entry.env);
        missing.push(`${['Fun', 'Tricky', 'Taxing', 'Mayhem'][group]} ${level + 1}: ${candidates.join(' or ') || 'no replay available'}`);
      }
    }
  }
  expect(missing, `Missing local replays: ${missing.join('; ')}`).toEqual([]);
  vi.stubGlobal('indexedDB', indexedDB);
  vi.stubGlobal('window', { atob });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'dir').mockImplementation(() => undefined);
  try {
    const names = await readdir('dos/lemmings');
    await importLemmingsFiles(await Promise.all(names.map(async name =>
      new File([Uint8Array.from(await readFile(`dos/lemmings/${name}`))], name))));
    vi.stubGlobal('fetch', async () => new Response(await readFile('public/data/config.json', 'utf8')));
    const factory = new GameFactory('/data');
    for (const { group, level, replayPath, saved } of choices) {
      const label = `${['Fun', 'Tricky', 'Taxing', 'Mayhem'][group]} ${level + 1}`;
      const game = await factory.getGame(GameTypes.LEMMINGS, group, level);
      expect(game, label).toBeDefined();
      if (replayPath) {
        const bytes = Uint8Array.from(await readFile(replayPath));
        const candidate = parseLemmixReplay(bytes, { levelTitle: game!.level.name.trim(), initialReleaseRate: game!.level.releaseRate });
        const result = verifyLemmixCandidate(game!, candidate);
        expect(result.ok, `${label}: ${result.ok ? '' : result.reason}`).toBe(true);
        expect(game!.getVictoryCondition().getSurvivorsCount(), label).toBe(saved);
      } else {
        const replay = getTestedSolution(group, level)!.replay;
        game!.getCommandManager().loadReplay(replay);
        while (game!.getGameState() === GameStateTypes.RUNNING && game!.getGameTimer().getGameTicks() <= game!.getGameTimer().getGameTimeLimit()) {
          game!.getGameTimer().tick();
        }
        expect(game!.getGameState(), label).toBe(GameStateTypes.SUCCEEDED);
        expect(game!.getCommandManager().serialize(), `${label}: every command must execute`).toBe(replay);
      }
    }
  } finally {
    await clearLemmingsFiles();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
}, 120_000);

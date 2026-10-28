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

it.skipIf(!path || process.env.RUN_PRIVATE_GAME_TESTS !== '1')('verifies the public Tricky 7 replay against local game data', async () => {
  await verifyExternalReplay(path!, 1, 6, 75);
}, 60000);

const tricky22Path = process.env.LEMMIX_TRICKY22_REPLAY_PATH;
it.skipIf(!tricky22Path || process.env.RUN_PRIVATE_GAME_TESTS !== '1')('verifies the public Tricky 22 replay against local game data', async () => {
  await verifyExternalReplay(tricky22Path!, 1, 21, 80);
}, 60000);

// Taxing9-undamaged.lrb: https://www.lemmingsforums.net/index.php?topic=1490.0
const taxing9Path = process.env.LEMMIX_TAXING9_REPLAY_PATH;
it.skipIf(!taxing9Path || process.env.RUN_PRIVATE_GAME_TESTS !== '1')('verifies the public Taxing 9 replay against local game data', async () => {
  await verifyExternalReplay(taxing9Path!, 2, 8, 20);
}, 60000);

// Optional replay sources are documented in docu/LEMMIX_REPLAY_IMPORT.md.
for (const { name, env, group, level, saved } of [
  { name: 'Fun 12', env: 'LEMMIX_FUN12_REPLAY_PATH', group: 0, level: 11, saved: 80 },
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
  { name: 'Tricky 18', env: 'LEMMIX_TRICKY18_REPLAY_PATH', group: 1, level: 17, saved: 9 },
  { name: 'Tricky 20', env: 'LEMMIX_TRICKY20_REPLAY_PATH', group: 1, level: 19, saved: 80 },
  { name: 'Tricky 22 (alternate)', env: 'LEMMIX_TRICKY22_ALT_REPLAY_PATH', group: 1, level: 21, saved: 80 },
  { name: 'Tricky 23', env: 'LEMMIX_TRICKY23_REPLAY_PATH', group: 1, level: 22, saved: 79 },
  { name: 'Tricky 23 (nuke)', env: 'LEMMIX_TRICKY23_NUKE_REPLAY_PATH', group: 1, level: 22, saved: 50 },
  { name: 'Tricky 24', env: 'LEMMIX_TRICKY24_REPLAY_PATH', group: 1, level: 23, saved: 80 },
  { name: 'Tricky 28', env: 'LEMMIX_TRICKY28_REPLAY_PATH', group: 1, level: 27, saved: 80 },
  { name: 'Tricky 29', env: 'LEMMIX_TRICKY29_REPLAY_PATH', group: 1, level: 28, saved: 80 },
  { name: 'Tricky 30', env: 'LEMMIX_TRICKY30_REPLAY_PATH', group: 1, level: 29, saved: 74 },
  { name: 'Taxing 3', env: 'LEMMIX_TAXING3_REPLAY_PATH', group: 2, level: 2, saved: 80 },
  { name: 'Taxing 8', env: 'LEMMIX_TAXING8_REPLAY_PATH', group: 2, level: 7, saved: 80 },
  { name: 'Taxing 11', env: 'LEMMIX_TAXING11_REPLAY_PATH', group: 2, level: 10, saved: 50 },
  { name: 'Taxing 14', env: 'LEMMIX_TAXING14_REPLAY_PATH', group: 2, level: 13, saved: 77 },
  { name: 'Taxing 15', env: 'LEMMIX_TAXING15_REPLAY_PATH', group: 2, level: 14, saved: 80 },
  { name: 'Taxing 16', env: 'LEMMIX_TAXING16_REPLAY_PATH', group: 2, level: 15, saved: 80 },
  { name: 'Taxing 17', env: 'LEMMIX_TAXING17_REPLAY_PATH', group: 2, level: 16, saved: 80 },
  { name: 'Taxing 20', env: 'LEMMIX_TAXING20_REPLAY_PATH', group: 2, level: 19, saved: 70 },
  { name: 'Taxing 22', env: 'LEMMIX_TAXING22_REPLAY_PATH', group: 2, level: 21, saved: 49 },
  { name: 'Taxing 23', env: 'LEMMIX_TAXING23_REPLAY_PATH', group: 2, level: 22, saved: 80 },
  { name: 'Taxing 25', env: 'LEMMIX_TAXING25_REPLAY_PATH', group: 2, level: 24, saved: 80 },
  { name: 'Taxing 26', env: 'LEMMIX_TAXING26_REPLAY_PATH', group: 2, level: 25, saved: 80 },
  { name: 'Taxing 29', env: 'LEMMIX_TAXING29_REPLAY_PATH', group: 2, level: 28, saved: 80 },
  { name: 'Mayhem 1', env: 'LEMMIX_MAYHEM1_REPLAY_PATH', group: 3, level: 0, saved: 79 },
  { name: 'Mayhem 2', env: 'LEMMIX_MAYHEM2_REPLAY_PATH', group: 3, level: 1, saved: 80 },
  { name: 'Mayhem 4', env: 'LEMMIX_MAYHEM4_REPLAY_PATH', group: 3, level: 3, saved: 50 },
  { name: 'Mayhem 7', env: 'LEMMIX_MAYHEM7_REPLAY_PATH', group: 3, level: 6, saved: 50 },
  { name: 'Mayhem 8', env: 'LEMMIX_MAYHEM8_REPLAY_PATH', group: 3, level: 7, saved: 72 },
  { name: 'Mayhem 9', env: 'LEMMIX_MAYHEM9_REPLAY_PATH', group: 3, level: 8, saved: 79 },
  { name: 'Mayhem 10', env: 'LEMMIX_MAYHEM10_REPLAY_PATH', group: 3, level: 9, saved: 72 },
  { name: 'Mayhem 14', env: 'LEMMIX_MAYHEM14_REPLAY_PATH', group: 3, level: 13, saved: 80 },
  { name: 'Mayhem 19', env: 'LEMMIX_MAYHEM19_REPLAY_PATH', group: 3, level: 18, saved: 48 },
  { name: 'Mayhem 21', env: 'LEMMIX_MAYHEM21_REPLAY_PATH', group: 3, level: 20, saved: 50 },
  { name: 'Mayhem 25', env: 'LEMMIX_MAYHEM25_REPLAY_PATH', group: 3, level: 24, saved: 73 },
  { name: 'Mayhem 27', env: 'LEMMIX_MAYHEM27_REPLAY_PATH', group: 3, level: 26, saved: 50 },
  { name: 'Mayhem 29', env: 'LEMMIX_MAYHEM29_REPLAY_PATH', group: 3, level: 28, saved: 77 },
]) {
  const replayPath = process.env[env];
  it.skipIf(!replayPath || process.env.RUN_PRIVATE_GAME_TESTS !== '1')(`verifies the public ${name} replay against local game data`, async () => {
    await verifyExternalReplay(replayPath!, group, level, saved);
  }, 60000);
}

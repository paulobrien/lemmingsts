// @vitest-environment node
// Optional research check only. Download the DOS Tricky 7 example locally from:
// https://www.lemmingsforums.net/index.php?topic=1490.45
// LEMMIX_V1_REPLAY_PATH=/absolute/path npx vitest run tests/integration/lemmix-import-external.spec.ts
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

it.skipIf(!path || process.env.RUN_PRIVATE_GAME_TESTS !== '1')('verifies the public Tricky 7 replay against local game data', async () => {
  vi.stubGlobal('indexedDB', indexedDB);
  vi.stubGlobal('window', { atob });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'dir').mockImplementation(() => undefined);
  try {
    const names = await readdir('dos/lemmings');
    await importLemmingsFiles(await Promise.all(names.map(async name =>
      new File([Uint8Array.from(await readFile(`dos/lemmings/${name}`))], name))));
    vi.stubGlobal('fetch', async () => new Response(await readFile('public/data/config.json', 'utf8')));
    const game = (await new GameFactory('/data').getGame(GameTypes.LEMMINGS, 1, 6))!;
    const bytes = Uint8Array.from(await readFile(path!));
    const candidate = parseLemmixReplay(bytes, { levelTitle: game.level.name.trim(), initialReleaseRate: game.level.releaseRate });
    const result = verifyLemmixCandidate(game, candidate);
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
    expect(game.getVictoryCondition().getSurvivorsCount()).toBe(75);
  } finally {
    await clearLemmingsFiles();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
}, 60000);

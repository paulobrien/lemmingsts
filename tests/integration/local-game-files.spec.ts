// @vitest-environment node
// Opt-in: RUN_PRIVATE_GAME_TESTS=1 npm run test:unit -- tests/integration/local-game-files.spec.ts
// The original data is read only from the ignored local directory, never committed.
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { GameFactory } from '../../src/game/game-factory';
import { GameTypes } from '../../src/game/game-types';
import { GameStateTypes } from '../../src/game/game-state-types';
import { getTestedSolution, TESTED_SOLUTIONS } from '../../src/game/solutions/tested-solutions';
import { clearLemmingsFiles, importLemmingsFiles } from '../../src/game/resources/file/game-file-store';

const localTest = process.env.RUN_PRIVATE_GAME_TESTS === '1' ? it : it.skip;

describe('local original DOS assets', () => {
  it.skipIf(process.env.REQUIRE_ALL_LEVEL_SOLUTIONS !== '1')('covers all 120 levels with replay solutions', () => {
    expect(process.env.RUN_PRIVATE_GAME_TESTS, 'Set RUN_PRIVATE_GAME_TESTS=1 so the replays are actually exercised').toBe('1');
    const missing: string[] = [];
    const groups = ['Fun', 'Tricky', 'Taxing', 'Mayhem'];
    for (let group = 0; group < groups.length; group++) {
      for (let level = 0; level < 30; level++) {
        if (!getTestedSolution(group, level)) missing.push(`${groups[group]} ${level + 1}`);
      }
    }
    expect(missing, `Missing ${missing.length} solution replays: ${missing.join(', ')}`).toEqual([]);
  });

  localTest('imports the supplied files and decodes ordinary and alternate levels', async () => {
    vi.stubGlobal('indexedDB', indexedDB);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'dir').mockImplementation(() => undefined);
    const directory = resolve('dos/lemmings');
    const names = await readdir(directory);
    const files = await Promise.all(names.map(async (name) =>
      new File([Uint8Array.from(await readFile(resolve(directory, name)))], name),
    ));
    try {
      await importLemmingsFiles(files);
      const configuration = await readFile(resolve('public/data/config.json'), 'utf8');
      vi.stubGlobal('fetch', async () => new Response(configuration));
      const factory = new GameFactory('/data');
      const resources = await factory.getGameResources(GameTypes.LEMMINGS);
      expect(resources).toBeDefined();
      const level = await resources!.getLevel(0, 0);
      expect(level?.name.trim()).toBe('Just dig!');
      expect(level?.width).toBeGreaterThan(0);
      expect(level?.entrances.length).toBeGreaterThan(0);
      const alternateLevel = await resources!.getLevel(0, 7);
      const oddTableName = names.find((name) => name.toUpperCase() === 'ODDTABLE.DAT');
      if (!oddTableName) throw new Error('ODDTABLE.DAT is missing');
      const oddTable = await readFile(resolve(directory, oddTableName));
      expect(alternateLevel?.name.trim()).toBe(oddTable.subarray(6 * 56 + 24, 7 * 56).toString('latin1').trim());
      expect(alternateLevel?.releaseCount).toBe(oddTable.readUInt16BE(6 * 56 + 2));
      const laterGroupLevel = await resources!.getLevel(1, 1);
      expect(laterGroupLevel?.name.trim()).toBe(oddTable.subarray(14 * 56 + 24, 15 * 56).toString('latin1').trim());
      expect(laterGroupLevel?.releaseCount).toBe(oddTable.readUInt16BE(14 * 56 + 2));
      const mayhemLevel = await resources!.getLevel(3, 10);
      expect(mayhemLevel?.name.trim()).toBe(oddTable.subarray(55 * 56 + 24, 56 * 56).toString('latin1').trim());
      expect(mayhemLevel?.releaseCount).toBe(oddTable.readUInt16BE(55 * 56 + 2));
      expect(await resources!.getMainDat()).toBeDefined();
      for (let group = 0; group < 4; group++) {
        for (let index = 0; index < 30; index++) {
          const candidate = await resources!.getLevel(group, index);
          expect(candidate, `level ${group + 1}/${index + 1}`).toBeDefined();
          expect(candidate!.name.trim(), `level ${group + 1}/${index + 1} name`).toBeTruthy();
          expect(candidate!.entrances.length, `level ${group + 1}/${index + 1} entrances`).toBeGreaterThan(0);
          expect(candidate!.releaseCount, `level ${group + 1}/${index + 1} release count`).toBeGreaterThan(0);
          expect(candidate!.needCount, `level ${group + 1}/${index + 1} rescue count`).toBeLessThanOrEqual(candidate!.releaseCount);
        }
      }
    } finally {
      await clearLemmingsFiles();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  localTest('replays every verified solution through to victory', async () => {
    vi.stubGlobal('indexedDB', indexedDB);
    vi.stubGlobal('window', { atob });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'dir').mockImplementation(() => undefined);
    const directory = resolve('dos/lemmings');
    const names = await readdir(directory);
    const files = await Promise.all(names.map(async (name) =>
      new File([Uint8Array.from(await readFile(resolve(directory, name)))], name),
    ));
    try {
      await importLemmingsFiles(files);
      const configuration = await readFile(resolve('public/data/config.json'), 'utf8');
      vi.stubGlobal('fetch', async () => new Response(configuration));
      const factory = new GameFactory('/data');
      expect(TESTED_SOLUTIONS.length).toBeGreaterThan(0);
      for (const solution of TESTED_SOLUTIONS) {
        const label = `level ${solution.groupIndex + 1}/${solution.levelIndex + 1}`;
        const game = await factory.getGame(GameTypes.LEMMINGS, solution.groupIndex, solution.levelIndex);
        expect(game, label).toBeDefined();
        game!.getCommandManager().loadReplay(solution.replay);
        const maxTicks = game!.getGameTimer().getGameTimeLimit() + 1;
        for (let tick = 0; tick < maxTicks && game!.getGameState() === GameStateTypes.RUNNING; tick++) {
          game!.getGameTimer().tick();
        }
        expect.soft(game!.getGameState(), label).toBe(GameStateTypes.SUCCEEDED);
        expect.soft(game!.getVictoryCondition().getSurvivorsCount(), label).toBeGreaterThan(0);
        expect.soft(game!.getCommandManager().serialize(), `${label} must execute every recorded command`).toBe(solution.replay);
      }
    } finally {
      await clearLemmingsFiles();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});

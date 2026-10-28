// @vitest-environment node
// Opt-in: RUN_PRIVATE_GAME_TESTS=1 npx vitest run tests/integration/lemmix-import-private.spec.ts
// The LRB bytes below are generated synthetically; original game data remains local.
import { readFile, readdir } from 'node:fs/promises';
import { indexedDB } from 'fake-indexeddb';
import { expect, it, vi } from 'vitest';
import { GameFactory } from '../../src/game/game-factory';
import { GameTypes } from '../../src/game/game-types';
import { clearLemmingsFiles, importLemmingsFiles } from '../../src/game/resources/file/game-file-store';
import { parseLemmixReplay, verifyLemmixCandidate } from '../../src/game/solutions/lemmix-replay-import';

it.skipIf(process.env.RUN_PRIVATE_GAME_TESTS !== '1')('verifies a synthetic LRB candidate by executing a real level', async () => {
  vi.stubGlobal('indexedDB', indexedDB);
  vi.stubGlobal('window', { atob });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'dir').mockImplementation(() => undefined);
  try {
    const names = await readdir('dos/lemmings');
    await importLemmingsFiles(await Promise.all(names.map(async name =>
      new File([Uint8Array.from(await readFile(`dos/lemmings/${name}`))], name))));
    const config = await readFile('public/data/config.json', 'utf8');
    vi.stubGlobal('fetch', async () => new Response(config));
    const factory = new GameFactory('/data');
    const scout = (await factory.getGame(GameTypes.LEMMINGS, 0, 0))!;
    for (let i = 0; i < 132; i++) scout.getGameTimer().tick();
    const lem = scout.getLemmingManager().getLemming(0)!;
    expect(lem).toBeDefined();

    const bytes = new Uint8Array(96);
    const view = new DataView(bytes.buffer);
    bytes.set([0x4c, 0x52, 0x42, 3]);
    view.setUint32(4, bytes.length, true); view.setUint16(8, 64, true);
    view.setUint16(10, 0x03df, true); view.setUint32(12, 64, true); view.setUint16(18, 1, true);
    bytes.set(new TextEncoder().encode(scout.level.name.trim()), 32);
    view.setUint8(64, 0x52); view.setInt32(65, 132, true); view.setUint16(69, 0x80, true);
    view.setUint8(71, 3); view.setInt32(73, scout.level.releaseRate, true);
    view.setInt32(77, 0, true); view.setInt32(81, lem.x, true); view.setInt32(85, lem.y, true);

    const candidate = parseLemmixReplay(bytes, { levelTitle: scout.level.name.trim(), initialReleaseRate: scout.level.releaseRate });
    const game = (await factory.getGame(GameTypes.LEMMINGS, 0, 0))!;
    expect(verifyLemmixCandidate(game, candidate)).toEqual({ ok: true, replay: '132=s8&132=l0' });
  } finally {
    await clearLemmingsFiles();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
}, 60000);

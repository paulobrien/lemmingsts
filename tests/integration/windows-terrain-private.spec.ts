// @vitest-environment node
// Opt-in only: RUN_PRIVATE_GAME_TESTS=1 WINDOWS_LEMMINGS_ISO=/path/to/Windows.iso npx vitest run tests/integration/windows-terrain-private.spec.ts
// Original game data is read locally and is never committed or uploaded.
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { indexedDB } from 'fake-indexeddb';
import { expect, it, vi } from 'vitest';
import { GameFactory } from '../../src/game/game-factory';
import { GameTypes } from '../../src/game/game-types';
import { clearLemmingsFiles, importLemmingsFiles } from '../../src/game/resources/file/game-file-store';
import { clearWindowsGraphics, importWindowsGraphics } from '../../src/game/resources/file/windows-graphics-store';
import { prepareWindowsTerrain } from '../../src/game/resources/prepare-windows-terrain';

it.skipIf(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.WINDOWS_LEMMINGS_ISO)(
  'prepares every compatible original level from local Windows and DOS files', async () => {
    vi.stubGlobal('indexedDB', indexedDB);
    vi.stubGlobal('window', { atob });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'dir').mockImplementation(() => undefined);
    try {
      const directory = resolve('dos/lemmings');
      const names = await readdir(directory);
      await importLemmingsFiles(await Promise.all(names.map(async name =>
        new File([Uint8Array.from(await readFile(resolve(directory, name)))], name))));
      const iso = await readFile(process.env.WINDOWS_LEMMINGS_ISO!);
      await importWindowsGraphics([new File([Uint8Array.from(iso)], 'windows-lemmings.iso')]);
      const configuration = await readFile('public/data/config.json', 'utf8');
      vi.stubGlobal('fetch', async () => new Response(configuration));
      const resources = (await new GameFactory('/data').getGameResources(GameTypes.LEMMINGS))!;
      let ready = 0, special = 0;
      for (let group = 0; group < 4; group++) {
        for (let index = 0; index < 30; index++) {
          const target = (await resources.getLevel(group, index))!;
          const before = target.hasGroundAt(0, 0);
          const result = await prepareWindowsTerrain(target);
          if (target.getWindowsTerrainSource()!.special) {
            expect(result).toEqual({ status: 'special' });
            special++;
            continue;
          }
          expect(result.status, `level ${group + 1}/${index + 1}`).toBe('ready');
          if (result.status !== 'ready') continue;
          expect(target.hasGroundAt(0, 0)).toBe(before);
          target.setWindowsTerrain(result.layer);
          const x = target.width - 1, y = target.height - 1;
          target.setGroundAt(x, y, 1);
          expect(target.hasGroundAt(x, y)).toBe(true);
          target.clearGroundAt(x, y);
          expect(target.hasGroundAt(x, y)).toBe(false);
          const high = result.layer, pixel = ((y * 2) * high.width + x * 2) * 4;
          expect(high.pixels[pixel + 3]).toBe(0);
          ready++;
        }
      }
      expect(ready).toBeGreaterThan(0);
      expect(special).toBeGreaterThan(0);
      expect(ready + special).toBe(120);
    } finally {
      await clearWindowsGraphics();
      await clearLemmingsFiles();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  }, 120_000,
);

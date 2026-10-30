// @vitest-environment node
// RUN_PRIVATE_GAME_TESTS=1 LEMMINGS_WINDOWS_ISO=/path/to/disc.iso npx vitest run tests/integration/windows-level-art-private.spec.ts
// Player-owned game data is used locally; no original files are committed.
import { readFile, readdir } from 'node:fs/promises';
import { indexedDB } from 'fake-indexeddb';
import { expect, it, vi } from 'vitest';
import { GameFactory } from '../../src/game/game-factory';
import { GameTypes } from '../../src/game/game-types';
import { clearLemmingsFiles, importLemmingsFiles } from '../../src/game/resources/file/game-file-store';
import { readWindowsGameIso, readWindowsGraphicsIso } from '../../src/game/resources/file/windows-iso';
import { parseWindowsLevelDatabase, readWindowsLevelRecord } from '../../src/game/resources/windows-level-database';
import { createWindowsLevel } from '../../src/game/resources/windows-level-art';

it.skipIf(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO)(
  'constructs all Windows levels with the same logical terrain and object masks as matching DOS levels', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'dir').mockImplementation(() => undefined);
    vi.stubGlobal('indexedDB', indexedDB); vi.stubGlobal('window', { atob });
    try {
      const names = await readdir('dos/lemmings');
      await importLemmingsFiles(await Promise.all(names.map(async name =>
        new File([Uint8Array.from(await readFile(`dos/lemmings/${name}`))], name))));
      const disc = await readFile(process.env.LEMMINGS_WINDOWS_ISO!);
      const image = new File([Uint8Array.from(disc)], 'disc.iso');
      const selection = [...await readWindowsGameIso(image), ...await readWindowsGraphicsIso(image)];
      const files = new Map(await Promise.all(selection.map(async file => [file.name, await file.arrayBuffer()] as const)));
      const groups = parseWindowsLevelDatabase(files.get('LEMMINGS.DB')!);
      const config = JSON.parse(await readFile('public/data/config.json', 'utf8'));
      vi.stubGlobal('fetch', async () => new Response(JSON.stringify(config)));
      const dos = (await new GameFactory('/data').getGameResources(GameTypes.LEMMINGS))!;
      const styles = await Promise.all(Array.from({ length: 5 }, async (_, set) => ({
        ground: files.get(`GROUND${set}O.DAT`)!,
        terrain: files.get(`LEVEL${set}S.SPR`)!,
        objects: files.get(`LEVEL${set}OS.SPR`)!,
      })));
      let count = 0;
      for (let group = 0; group < groups.length; group++) for (const entry of groups[group].levels) {
        const id = Number(entry.fileName.slice(3, 7));
        const dosIndex = (config[0]['level.order'][group] as number[]).findIndex(value => Math.abs(value) === id);
        expect(dosIndex).toBeGreaterThanOrEqual(0);
        const reader = readWindowsLevelRecord(entry, files.get(entry.fileName)!);
        const style = styles[reader.graphicSet1];
        const actual = createWindowsLevel(reader, group, dosIndex, style.ground, style.terrain, style.objects);
        const expected = (await dos.getLevel(group, dosIndex))!;
        let different = 0;
        for (let y = 0; y < actual.height; y++) for (let x = 0; x < actual.width; x++) {
          if (actual.hasGroundAt(x, y) !== expected.hasGroundAt(x, y)) different++;
        }
        expect(different, `terrain collision, group ${group}, level ${dosIndex}`).toBe(0);
        expect(actual.objects.length).toBe(expected.objects.length);
        for (let object = 0; object < actual.objects.length; object++) {
          const frames = actual.objects[object].animation.frames, reference = expected.objects[object].animation.frames;
          expect(frames.length).toBe(reference.length);
          for (let frame = 0; frame < frames.length; frame++) expect(frames[frame].getMask()).toEqual(reference[frame].getMask());
        }
        count++;
      }
      expect(count).toBe(114);
    } finally { await clearLemmingsFiles(); vi.unstubAllGlobals(); vi.restoreAllMocks(); }
  }, 60_000,
);

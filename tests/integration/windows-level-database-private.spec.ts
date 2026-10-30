// @vitest-environment node
// Opt in with RUN_PRIVATE_GAME_TESTS=1 WINDOWS_LEMMINGS_ISO=/path/to/Windows.iso.
// Player-owned files are inspected locally and are never committed.
import { readFile } from 'node:fs/promises';
import { expect, it, vi } from 'vitest';
import { BinaryReader } from '../../src/game/resources/file/binary-reader';
import { FileContainer } from '../../src/game/resources/file/file-container';
import { readWindowsGameIso } from '../../src/game/resources/file/windows-iso';
import { LevelReader } from '../../src/game/resources/lemmings/level-reader';
import { OddTableReader } from '../../src/game/resources/lemmings/odd-table-reader';
import { parseWindowsLevelDatabase, readWindowsLevelRecord } from '../../src/game/resources/windows-level-database';

it.skipIf(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.WINDOWS_LEMMINGS_ISO)(
  'reads the complete Windows original-game hierarchy and matches the DOS level records and starting conditions', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'dir').mockImplementation(() => undefined);
    try {
      const disc = await readFile(process.env.WINDOWS_LEMMINGS_ISO!);
      const selected = await readWindowsGameIso(new File([Uint8Array.from(disc)], 'disc.iso'));
      const files = new Map(await Promise.all(selected.map(async file => [file.name, await file.arrayBuffer()] as const)));
      const groups = parseWindowsLevelDatabase(files.get('LEMMINGS.DB')!);
      expect(groups.map(group => group.levels.length)).toEqual([28, 28, 29, 29]);
      const config = JSON.parse(await readFile('public/data/config.json', 'utf8'))[0]['level.order'] as number[][];
      const odd = new OddTableReader(new BinaryReader(Uint8Array.from(await readFile('dos/lemmings/oddtable.dat'))));
      const containers = await Promise.all(Array.from({ length: 10 }, async (_, index) =>
        new FileContainer(new BinaryReader(Uint8Array.from(await readFile(`dos/lemmings/level${String(index).padStart(3, '0')}.dat`))))));
      let checked = 0;
      for (let group = 0; group < groups.length; group++) for (const entry of groups[group].levels) {
        const id = Number(entry.fileName.slice(3, 7));
        const matches = config[group].filter(value => Math.abs(value) === id);
        expect(matches).toHaveLength(1);
        const reference = new LevelReader(containers[Math.floor(id / 10)].getPart(id % 10));
        const expected = matches[0] < 0 ? odd.getLevelProperties(Math.floor(id / 10) * 8 + id % 10)! : reference.levelProperties;
        const actual = readWindowsLevelRecord(entry, files.get(entry.fileName)!);
        expect(actual.levelProperties).toMatchObject({ releaseRate: expected.releaseRate, releaseCount: expected.releaseCount,
          needCount: expected.needCount, timeLimit: expected.timeLimit, skills: expected.skills });
        expect(actual.terrains).toEqual(reference.terrains);
        expect(actual.objects).toEqual(reference.objects);
        expect(actual.steel).toEqual(reference.steel);
        checked++;
      }
      expect(checked).toBe(114);
    } finally { vi.restoreAllMocks(); }
  }, 60_000,
);

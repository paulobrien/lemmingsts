import { describe, expect, it, vi } from 'vitest';
import { parseWindowsLevelDatabase, readWindowsLevelRecord } from '../../src/game/resources/windows-level-database';

function database(): Uint8Array {
  const data = new Uint8Array(8 + 10 * 137), view = new DataView(data.buffer);
  view.setUint32(0, 2, true); view.setUint32(4, 10, true);
  const record = (index: number, depth: number, folder: number, name: string, file = '') => {
    const start = 8 + index * 137;
    data[start + 2] = depth; data[start + 3] = folder;
    data.set(new TextEncoder().encode(name), start + 10);
    data.set(new TextEncoder().encode(file), start + 50);
    return start;
  };
  record(0, 1, 1, 'Original Levels....', 'orig');
  for (const [i, name] of ['Fun', 'Tricky', 'Taxing', 'Mayhem'].entries()) {
    record(1 + i * 2, 2, 1, `${name}....`);
    const start = record(2 + i * 2, 3, 0, `Level ${i}`, `LVL000${i}.LVL`);
    if (i === 1) {
      data[start + 124] = 1;
      data.set([1, 2, 3, 4, 5, 6, 7, 8, 5, 45, 50, 30], start + 125);
    }
  }
  record(9, 1, 1, 'Other edition', 'other');
  return data;
}

describe('Windows level database', () => {
  it('extracts the original hierarchy and alternate starting conditions', () => {
    const groups = parseWindowsLevelDatabase(database());
    expect(groups.map(group => [group.name, group.levels.length])).toEqual([['Fun', 1], ['Tricky', 1], ['Taxing', 1], ['Mayhem', 1]]);
    expect(groups[0].levels[0]).toEqual({ name: 'Level 0', fileName: 'LVL0000.LVL' });
    expect(groups[1].levels[0].properties).toMatchObject({
      levelName: 'Level 1', releaseRate: 30, releaseCount: 50, needCount: 45, timeLimit: 5,
      skills: [undefined, 1, 2, 3, 4, 5, 6, 7, 8],
    });
  });
  it('applies overrides to an actual level reader without altering its map data', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'dir').mockImplementation(() => undefined);
    const entry = parseWindowsLevelDatabase(database())[1].levels[0];
    const bytes = new Uint8Array(2048); bytes.fill(255, 0x120, 0x760);
    const reader = readWindowsLevelRecord(entry, bytes);
    expect(reader.levelProperties).toEqual(entry.properties);
    reader.levelProperties.skills[1]--;
    expect(readWindowsLevelRecord(entry, bytes).levelProperties.skills[1]).toBe(1);
    expect(reader.terrains).toEqual([]);
    expect(() => readWindowsLevelRecord(entry, bytes.subarray(1))).toThrow(/Invalid Windows level file/);
    vi.restoreAllMocks();
  });
  it('rejects bad record sizes, paths and invalid overrides', () => {
    const truncated = database().subarray(0, -1);
    expect(() => parseWindowsLevelDatabase(truncated)).toThrow(/corrupt/);
    const badPath = database(); badPath[8 + 2 * 137 + 50] = 46;
    expect(() => parseWindowsLevelDatabase(badPath)).toThrow(/corrupt/);
    const badOverride = database(); badOverride[8 + 4 * 137 + 134] = 90;
    expect(() => parseWindowsLevelDatabase(badOverride)).toThrow(/corrupt/);
  });
});

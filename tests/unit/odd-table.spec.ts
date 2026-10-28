import { describe, expect, it } from 'vitest';
import { GameConfig } from '../../src/game/config/game-config';
import { BinaryReader } from '../../src/game/resources/file/binary-reader';
import { LevelIndexResolve } from '../../src/game/resources/level-index-resolve';
import { OddTableReader } from '../../src/game/resources/lemmings/odd-table-reader';

describe('alternate level properties', () => {
  it('maps alternate entries to physical level slots of eight parts each', () => {
    const config = new GameConfig();
    config.level.order = [[1, -6], [4, -16], [-67]];
    const resolver = new LevelIndexResolve(config);
    expect(resolver.resolve(0, 1)?.levelNumber).toBe(6);
    expect(resolver.resolve(1, 1)?.levelNumber).toBe(14);
    expect(resolver.resolve(2, 0)?.levelNumber).toBe(55);
  });

  it('reads consecutive properties and bounds-checks table indices', () => {
    const bytes = new Uint8Array(112);
    bytes[1] = 7;
    bytes.set(new TextEncoder().encode('First level'), 24);
    bytes[57] = 9;
    bytes.set(new TextEncoder().encode('Second level'), 80);
    const table = new OddTableReader(new BinaryReader(bytes));
    expect(table.getLevelProperties(0)?.releaseRate).toBe(7);
    expect(table.getLevelProperties(0)?.levelName.replace(/\0/g, '')).toBe('First level');
    expect(table.getLevelProperties(1)?.releaseRate).toBe(9);
    expect(table.getLevelProperties(1)?.levelName.replace(/\0/g, '')).toBe('Second level');
    expect(table.getLevelProperties(-1)).toBeNull();
    expect(table.getLevelProperties(2)).toBeNull();
  });

  it('reads strings sequentially and honours explicit offsets', () => {
    const reader = new BinaryReader(new TextEncoder().encode('abcdef'));
    expect(reader.readString(2)).toBe('ab');
    expect(reader.readString(2)).toBe('cd');
    expect(reader.readString(2, 1)).toBe('bc');
  });
});

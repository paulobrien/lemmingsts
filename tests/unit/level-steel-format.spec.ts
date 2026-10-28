import { expect, it } from 'vitest';
import { BinaryReader } from '../../src/game/resources/file/binary-reader';
import { LevelReader } from '../../src/game/resources/lemmings/level-reader';

it('decodes DOS steel x/y and width/height from their packed bits', () => {
  const bytes = new Uint8Array(2048);
  bytes.fill(0xff, 0x120, 0x760); // Empty terrain entries.
  // Includes the x-coordinate bit stored in the high bit of the second byte.
  bytes.set([0x00, 0x9f, 0x52, 0x00, 0x91, 0x85, 0x27, 0x00], 0x760);
  const level = new LevelReader(new BinaryReader(bytes));
  expect(level.steel.map(({ x, y, width, height }) => ({ x, y, width, height }))).toEqual([
    { x: -12, y: 124, width: 24, height: 12 },
    { x: 1148, y: 20, width: 12, height: 32 },
  ]);
});

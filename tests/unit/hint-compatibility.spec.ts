// @vitest-environment node
import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { HINT_DATA_FILES, verifyHintData } from '../../src/game/solutions/hint-compatibility';

describe('hint data compatibility', () => {
  it('does not claim unrelated, same-named data is the verified edition', async () => {
    const read = vi.fn(async (_name: string) => new Uint8Array([1, 2, 3]).buffer);
    expect(await verifyHintData(read, webcrypto.subtle as unknown as SubtleCrypto)).toBe('different');
    expect(read.mock.calls.map(([name]) => name)).toEqual(HINT_DATA_FILES);
  });

  it('reports unavailable when local data, storage or cryptography is unavailable', async () => {
    expect(await verifyHintData(async () => undefined, webcrypto.subtle as unknown as SubtleCrypto)).toBe('unavailable');
    expect(await verifyHintData(async () => { throw new Error('storage failed'); }, webcrypto.subtle as unknown as SubtleCrypto)).toBe('unavailable');
    expect(await verifyHintData(async () => new ArrayBuffer(1), null as unknown as SubtleCrypto)).toBe('unavailable');
  });
});

describe('Windows hint data compatibility', () => {
  it('fingerprints every level, database, gameplay mask and style resource', async () => {
    const { verifyWindowsHintData, WINDOWS_HINT_GAME_FILES, WINDOWS_HINT_GRAPHICS_FILES } = await import('../../src/game/solutions/hint-compatibility');
    const game = vi.fn(async (_name: string) => new Uint8Array([1, 2, 3]).buffer);
    const graphics = vi.fn(async (_name: string) => new Uint8Array([4, 5, 6]).buffer);
    expect(await verifyWindowsHintData(game, graphics, webcrypto.subtle as unknown as SubtleCrypto)).toBe('different');
    expect(game.mock.calls.map(([name]) => name)).toEqual(WINDOWS_HINT_GAME_FILES);
    expect(graphics.mock.calls.map(([name]) => name)).toEqual(WINDOWS_HINT_GRAPHICS_FILES);
    expect(WINDOWS_HINT_GAME_FILES).toHaveLength(86);
    expect(WINDOWS_HINT_GRAPHICS_FILES).toHaveLength(28);
    expect(WINDOWS_HINT_GRAPHICS_FILES).toEqual(expect.arrayContaining(['LEMMSMA.SPR', 'LEMMBIG.SPR', 'FE.PAL', 'LEVEL0S.SPR', 'LEVEL4OS.SPR', 'LEVEL4OB.SPR']));
  });

  it('does not enable hints when storage, an input or hashing is unavailable', async () => {
    const { verifyWindowsHintData } = await import('../../src/game/solutions/hint-compatibility');
    const read = async () => new ArrayBuffer(1);
    expect(await verifyWindowsHintData(async () => undefined, read, webcrypto.subtle as unknown as SubtleCrypto)).toBe('unavailable');
    expect(await verifyWindowsHintData(read, async () => undefined, webcrypto.subtle as unknown as SubtleCrypto)).toBe('unavailable');
    expect(await verifyWindowsHintData(read, async () => { throw new Error('storage failed'); }, webcrypto.subtle as unknown as SubtleCrypto)).toBe('unavailable');
    expect(await verifyWindowsHintData(read, read, null as unknown as SubtleCrypto)).toBe('unavailable');
  });
});

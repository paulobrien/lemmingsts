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

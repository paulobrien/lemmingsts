// @vitest-environment node
// Opt in: RUN_PRIVATE_GAME_TESTS=1 LEMMINGS_WINDOWS_ISO=/path/to/windows.iso
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { indexedDB } from 'fake-indexeddb';
import { expect, it, vi } from 'vitest';
import { clearWindowsGame, getWindowsGameFile, importWindowsGame } from '../../src/game/resources/file/windows-game-store';
import { clearWindowsGraphics, getWindowsGraphicsFile, importWindowsGraphics } from '../../src/game/resources/file/windows-graphics-store';
import { verifyWindowsHintData } from '../../src/game/solutions/hint-compatibility';

it.skipIf(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO)(
  'recognizes the disc used to verify Windows hints and rejects modified game and graphics data', async () => {
    vi.stubGlobal('indexedDB', indexedDB);
    try {
      const bytes = await readFile(process.env.LEMMINGS_WINDOWS_ISO!);
      const iso = new File([Uint8Array.from(bytes)], 'game.iso');
      await importWindowsGame([iso]);
      await importWindowsGraphics([iso]);
      const subtle = webcrypto.subtle as unknown as SubtleCrypto;
      expect(await verifyWindowsHintData(getWindowsGameFile, getWindowsGraphicsFile, subtle)).toBe('verified');
      const altered = (read: (name: string) => Promise<ArrayBuffer | undefined>, target: string) => async (name: string) => {
        const result = await read(name);
        if (result && name === target) { const copy = result.slice(0); new Uint8Array(copy)[0] ^= 1; return copy; }
        return result;
      };
      expect(await verifyWindowsHintData(altered(getWindowsGameFile, 'LVL0000.LVL'), getWindowsGraphicsFile, subtle)).toBe('different');
      expect(await verifyWindowsHintData(getWindowsGameFile, altered(getWindowsGraphicsFile, 'LEMMSMA.SPR'), subtle)).toBe('different');
      expect(await verifyWindowsHintData(getWindowsGameFile, altered(getWindowsGraphicsFile, 'LEVEL0B.SPR'), subtle)).toBe('different');
    } finally {
      await clearWindowsGraphics(); await clearWindowsGame(); vi.unstubAllGlobals();
    }
  }, 30_000,
);

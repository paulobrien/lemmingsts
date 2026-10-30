// @vitest-environment node
// Optional local verification: RUN_PRIVATE_GAME_TESTS=1 npx vitest run tests/integration/windows-masks-private.spec.ts
// Only the positions and difference counts are compared; no original graphics are retained.
import { readFile } from 'node:fs/promises';
import { expect, it, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { clearWindowsGraphics, getWindowsGraphicsFile, hasStandaloneWindowsGraphics, importWindowsGraphics } from '../../src/game/resources/file/windows-graphics-store';
import { BinaryReader } from '../../src/game/resources/file/binary-reader';
import { FileContainer } from '../../src/game/resources/file/file-container';
import { MaskProvider } from '../../src/game/resources/mask-provider';
import { MaskTypes } from '../../src/game/resources/mask-types';
import { createWindowsMaskProvider } from '../../src/game/resources/windows-mask-provider';
import type { Mask } from '../../src/game/resources/mask';

const pixels = (mask: Mask): Set<string> => {
  const result = new Set<string>();
  for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) {
    if (!mask.at(x, y)) result.add(`${x + mask.offsetX},${y + mask.offsetY}`);
  }
  return result;
};

it.skipIf(process.env.RUN_PRIVATE_GAME_TESTS !== '1')('decodes the actual Windows physics masks and compares their origins against DOS', async () => {
  const windows = createWindowsMaskProvider(Uint8Array.from(await readFile('dos/windows-graphics/GFX/LEMMSMA.SPR')));
  const dos = new MaskProvider(new FileContainer(new BinaryReader(await readFile('dos/lemmings/main.dat'))).getPart(1));
  for (const type of [MaskTypes.BASHING_R, MaskTypes.BASHING_L, MaskTypes.MINEING_R, MaskTypes.MINEING_L, MaskTypes.EXPLODING]) {
    for (let index = 0; index < dos.GetMask(type).length; index++) {
      const a = pixels(dos.GetMask(type).getMask(index)), b = pixels(windows.GetMask(type).getMask(index));
      const difference = [...a].filter(x => !b.has(x)).length + [...b].filter(x => !a.has(x)).length;
      // Windows has a few extra pixels in the first bash frame and explosion.
      const expected = type === MaskTypes.EXPLODING ? 1 : (type === MaskTypes.BASHING_R || type === MaskTypes.BASHING_L) && index === 0 ? 9 : 0;
      expect(difference, `mask type ${type}, frame ${index}`).toBe(expected);
    }
  }
});

// Import the actual ISO into an empty store without importing any DOS files.
it.skipIf(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO)(
  'accepts the Windows disc as a complete standalone graphics and mask set', async () => {
    vi.stubGlobal('indexedDB', indexedDB);
    try {
      const iso = await readFile(process.env.LEMMINGS_WINDOWS_ISO!);
      await importWindowsGraphics([new File([Uint8Array.from(iso)], 'windows.iso')]);
      expect(await hasStandaloneWindowsGraphics()).toBe(true);
      for (const name of ['LEMMSMA.SPR', ...Array.from({length: 5}, (_, i) => [`LEVEL${i}S.SPR`, `LEVEL${i}OS.SPR`]).flat()]) {
        expect(await getWindowsGraphicsFile(name), name).toBeDefined();
      }
    } finally { await clearWindowsGraphics(); vi.unstubAllGlobals(); }
  }, 30_000);

// @vitest-environment node
// RUN_PRIVATE_GAME_TESTS=1 WINDOWS_LEMMINGS_ISO=/path/to/disc.iso npx vitest run tests/integration/windows-standalone-sprites-private.spec.ts
// Tests read the player's local assets only; no game content is recorded.
import { readFile } from 'node:fs/promises';
import { indexedDB } from 'fake-indexeddb';
import { expect, it, vi } from 'vitest';
import { clearWindowsGraphics, importWindowsGraphics } from '../../src/game/resources/file/windows-graphics-store';
import { prepareStandaloneWindowsSprites } from '../../src/game/resources/standalone-windows-sprites';
import { prepareWindowsSprites } from '../../src/game/resources/prepare-windows-sprites';
import { SpriteTypes } from '../../src/game/resources/sprite-types';

it.skipIf(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.WINDOWS_LEMMINGS_ISO)(
  'prepares game animation frames using only Windows ISO artwork', async () => {
    vi.stubGlobal('indexedDB', indexedDB);
    try {
      const iso = await readFile(process.env.WINDOWS_LEMMINGS_ISO!);
      await importWindowsGraphics([new File([Uint8Array.from(iso)], 'windows.iso')]);
      const sprites = await prepareStandaloneWindowsSprites();
      const native = await prepareWindowsSprites(sprites);
      expect(native?.size).toBeGreaterThan(300);
      for (const type of [SpriteTypes.WALKING, SpriteTypes.FALLING, SpriteTypes.BUILDING, SpriteTypes.BASHING, SpriteTypes.MINEING, SpriteTypes.POSTCLIMBING, SpriteTypes.SHRUGGING]) {
        for (const right of [false, true]) for (const frame of sprites.getAnimation(type, right).frames) {
          expect(native!.has(frame)).toBe(true);
          expect(frame.getMask().some(Boolean)).toBe(true);
        }
      }
    } finally { await clearWindowsGraphics(); vi.unstubAllGlobals(); }
  }, 30_000,
);

// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { readWindowsGameIso } from '../../src/game/resources/file/windows-iso';
import { WINDOWS_GAME_FILES } from '../../src/game/resources/file/windows-game-names';

it.skipIf(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO)(
  'extracts every standalone Windows level and metadata file from the supplied disc', async () => {
    const bytes = await readFile(process.env.LEMMINGS_WINDOWS_ISO!);
    const files = await readWindowsGameIso(new File([bytes], 'game.iso'));
    expect(files.map(file => file.name).sort()).toEqual([...WINDOWS_GAME_FILES].sort());
    expect(files.filter(file => file.name.endsWith('.LVL')).every(file => file.size === 2048)).toBe(true);
  }, 30_000,
);

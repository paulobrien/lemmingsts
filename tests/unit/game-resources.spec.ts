import { describe, expect, it, vi } from 'vitest';
import { GameConfig } from '../../src/game/config/game-config';
import { GameResources } from '../../src/game/game-resources';
import type { FileProvider } from '../../src/game/resources/file/file-provider';

describe('game resources', () => {
  it.each([
    ['sprite data', (resources: GameResources) => resources.getMainDat()],
    ['sound data', (resources: GameResources) => resources.getMusicPlayer(0)],
  ])('propagates %s failures and retries after an import', async (_name, load) => {
    const loadBinary = vi.fn().mockRejectedValue(new Error('Missing game file'));
    const provider = { loadBinary } as unknown as FileProvider;
    const resources = new GameResources(provider, new GameConfig());
    await expect(load(resources)).rejects.toThrow('Missing game file');
    await expect(load(resources)).rejects.toThrow('Missing game file');
    expect(loadBinary).toHaveBeenCalledTimes(2);
  });
});

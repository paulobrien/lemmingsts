import { describe, expect, it } from 'vitest';
import { ConfigReader } from '../../src/game/utilities/config-reader';
import { LevelConfig } from '../../src/game/config/level-config';
import { GameTypes } from '../../src/game/game-types';

describe('game configuration', () => {
    it('enables the original game odd table from its configured key', async () => {
        const reader = new ConfigReader(Promise.resolve(JSON.stringify([{
            name: 'Lemmings', path: 'lemmings', gametype: 'LEMMINGS',
            'level.useOddTable': true, 'level.order': [[1]],
            'level.filePrefix': 'LEVEL', 'level.groups': ['Fun'],
        }])));

        expect((await reader.getConfig(GameTypes.LEMMINGS))?.level.useOddTable).toBe(true);
    });

    it('propagates a configuration loading failure', async () => {
        const reader = new ConfigReader(Promise.reject(new Error('unavailable')));
        await expect(reader.getConfig(GameTypes.LEMMINGS)).rejects.toThrow('unavailable');
    });

    it('returns zero for a level group past either end', () => {
        const levels = new LevelConfig();
        levels.order = [[1, 2]];
        expect(levels.getGroupLength(0)).toBe(2);
        expect(levels.getGroupLength(-1)).toBe(0);
        expect(levels.getGroupLength(1)).toBe(0);
    });
});

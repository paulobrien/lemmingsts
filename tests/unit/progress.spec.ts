// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readProgress, readSettings, recordCompletion, saveSettings } from '../../src/game/progress';

describe('local game progress', () => {
    beforeEach(() => localStorage.clear());

    it('saves completion and keeps the best rescue percentage', () => {
        expect(recordCompletion(1, 0, 3, 80)).toBe(true);
        recordCompletion(1, 0, 3, 60);
        recordCompletion(1, 0, 3, 95);
        recordCompletion(1, 1, 3, 50);
        expect(readProgress()).toEqual([
            { gameType: 1, groupIndex: 0, levelIndex: 3, bestSavedPercent: 95 },
            { gameType: 1, groupIndex: 1, levelIndex: 3, bestSavedPercent: 50 },
        ]);
    });

    it('uses safe defaults when stored data is invalid', () => {
        localStorage.setItem('lemmings.progress.v1', '{invalid');
        localStorage.setItem('lemmings.settings.v1', JSON.stringify({ speed: 0, musicEnabled: true }));
        expect(readProgress()).toEqual([]);
        expect(readSettings()).toEqual({ speed: 1, musicEnabled: true });
        saveSettings({ speed: 2, musicEnabled: false });
        expect(readSettings()).toEqual({ speed: 2, musicEnabled: false });
    });
});

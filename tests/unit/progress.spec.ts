// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportProgressBackup, readLastLevel, readProgress, readSettings, recordCompletion, rememberLevel, restoreProgressBackup, saveSettings, suggestNextLevel } from '../../src/game/progress';

describe('local game progress', () => {
    it('suggests the next level after a completed selection and keeps unfinished selections', () => {
        const completed = { gameType: 1, groupIndex: 0, levelIndex: 10, bestSavedPercent: 98 };
        const last = { gameType: 1, groupIndex: 0, levelIndex: 10 };
        expect(suggestNextLevel(last, [completed], [28, 28, 29, 29])).toEqual({ ...last, levelIndex: 11 });
        expect(suggestNextLevel(last, [], [28, 28, 29, 29])).toEqual(last);
        expect(suggestNextLevel(last, [{ ...completed, groupIndex: 1 }], [28, 28, 29, 29])).toEqual(last);
    });

    it('uses edition-specific group boundaries and keeps the final level at the end', () => {
        const last = { gameType: 1, groupIndex: 0, levelIndex: 27 };
        const completed = [{ ...last, bestSavedPercent: 100 }];
        expect(suggestNextLevel(last, completed, [28, 28, 29, 29])).toEqual({ ...last, groupIndex: 1, levelIndex: 0 });
        expect(suggestNextLevel(last, completed, [30, 30, 30, 30])).toEqual({ ...last, levelIndex: 28 });
        const final = { ...last, groupIndex: 3, levelIndex: 28 };
        expect(suggestNextLevel(final, [{ ...final, bestSavedPercent: 100 }], [28, 28, 29, 29])).toEqual(final);
        expect(suggestNextLevel({ ...last, levelIndex: 29 }, [], [28, 28, 29, 29])).toBeNull();
        expect(suggestNextLevel(null, [], [28])).toBeNull();
    });
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

    it('keeps DOS and Windows completion and last-level state independent', () => {
        recordCompletion(1, 0, 1, 60);
        recordCompletion(1, 0, 1, 90, 'windows');
        rememberLevel(1, 0, 2);
        rememberLevel(1, 0, 3, 'windows');
        expect(readProgress()[0].bestSavedPercent).toBe(60);
        expect(readProgress('windows')[0].bestSavedPercent).toBe(90);
        expect(readLastLevel()?.levelIndex).toBe(2);
        expect(readLastLevel('windows')?.levelIndex).toBe(3);
        const backup = exportProgressBackup();
        expect(JSON.parse(backup).version).toBe(2);
        localStorage.clear();
        expect(restoreProgressBackup(backup)).toBe(true);
        expect(readProgress()[0].bestSavedPercent).toBe(60);
        expect(readProgress('windows')[0].bestSavedPercent).toBe(90);
        expect(readLastLevel()?.levelIndex).toBe(2);
        expect(readLastLevel('windows')?.levelIndex).toBe(3);
        recordCompletion(1, 0, 1, 95, 'windows');
        expect(readProgress('windows')[0].bestSavedPercent).toBe(95);
        expect(readProgress()[0].bestSavedPercent).toBe(60);
    });

    it('restores a legacy backup without inheriting stale Windows progress', () => {
        recordCompletion(1, 0, 1, 60);
        const legacy = exportProgressBackup();
        recordCompletion(1, 0, 1, 90, 'windows');
        rememberLevel(1, 0, 3, 'windows');
        expect(restoreProgressBackup(legacy)).toBe(true);
        expect(readProgress('windows')).toEqual([]);
        expect(readLastLevel('windows')).toBeNull();
        rememberLevel(1, 0, 4, 'windows');
        expect(readProgress()[0].bestSavedPercent).toBe(60);
        expect(readLastLevel('windows')?.levelIndex).toBe(4);
    });

    it('rejects malformed Windows backup data without replacing either edition', () => {
        recordCompletion(1, 0, 1, 60);
        recordCompletion(1, 0, 1, 90, 'windows');
        const backup = exportProgressBackup();
        const value = JSON.parse(backup);
        for (const bad of [
            { ...value, windowsProgress: [...value.windowsProgress, value.windowsProgress[0]] },
            { ...value, windowsLastLevel: { gameType: 1, groupIndex: 4, levelIndex: 0 } },
            { ...value, windowsProgress: [{ ...value.windowsProgress[0], secret: 'file' }] },
        ]) {
            expect(() => restoreProgressBackup(JSON.stringify(bad))).toThrow();
            expect(exportProgressBackup()).toBe(backup);
        }
    });

    it('uses safe defaults when stored data is invalid', () => {
        localStorage.setItem('lemmings.progress.v1', '{invalid');
        localStorage.setItem('lemmings.settings.v1', JSON.stringify({ speed: 0, musicEnabled: true }));
        expect(readProgress()).toEqual([]);
        expect(readSettings()).toEqual({ speed: 1, musicEnabled: true, soundEnabled: false });
        saveSettings({ speed: 2, musicEnabled: false, soundEnabled: true });
        expect(readSettings()).toEqual({ speed: 2, musicEnabled: false, soundEnabled: true });
    });

    it('round-trips progress, settings and last level without game files', () => {
        recordCompletion(1, 2, 5, 85);
        saveSettings({ speed: 4, musicEnabled: true, soundEnabled: false });
        rememberLevel(1, 2, 6);
        const backup = exportProgressBackup();
        expect(JSON.parse(backup)).toEqual({
            format: 'lemmings-progress', version: 1,
            progress: [{ gameType: 1, groupIndex: 2, levelIndex: 5, bestSavedPercent: 85 }],
            settings: { speed: 4, musicEnabled: true, soundEnabled: false },
            lastLevel: { gameType: 1, groupIndex: 2, levelIndex: 6 },
        });
        localStorage.clear();
        expect(restoreProgressBackup(backup)).toBe(true);
        expect(readLastLevel()).toEqual({ gameType: 1, groupIndex: 2, levelIndex: 6 });
        expect(readProgress()[0].bestSavedPercent).toBe(85);
        expect(readSettings().speed).toBe(4);
        expect(recordCompletion(1, 2, 5, 90)).toBe(true);
        expect(rememberLevel(1, 2, 7)).toBe(true);
        expect(saveSettings({ speed: 2, musicEnabled: false, soundEnabled: true })).toBe(true);
        expect(JSON.parse(exportProgressBackup())).toMatchObject({
            progress: [{ bestSavedPercent: 90 }],
            settings: { speed: 2, musicEnabled: false, soundEnabled: true },
            lastLevel: { levelIndex: 7 },
        });
    });

    it('rejects invalid, duplicate, or unrelated data before replacing anything', () => {
        recordCompletion(1, 0, 1, 80);
        const before = exportProgressBackup();
        const value = JSON.parse(before);
        for (const bad of [
            '{', JSON.stringify({ ...value, version: 2 }),
            JSON.stringify({ ...value, gameFiles: 'not a progress backup' }),
            JSON.stringify({ ...value, progress: [...value.progress, value.progress[0]] }),
            JSON.stringify({ ...value, progress: [{ ...value.progress[0], bestSavedPercent: 101 }] }),
            JSON.stringify({ ...value, lastLevel: { gameType: 1, groupIndex: 0, levelIndex: 30 } }),
            ' '.repeat(64 * 1024 + 1),
        ]) {
            expect(() => restoreProgressBackup(bad)).toThrow();
            expect(exportProgressBackup()).toBe(before);
        }
    });

    it('does not partially replace the current state when storage rejects the restore', () => {
        recordCompletion(1, 0, 0, 75);
        const before = exportProgressBackup();
        const other = JSON.parse(before);
        other.progress = [];
        const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage full'); });
        try {
            expect(restoreProgressBackup(JSON.stringify(other))).toBe(false);
            expect(exportProgressBackup()).toBe(before);
            expect(rememberLevel(1, 0, 0)).toBe(false);
        } finally { spy.mockRestore(); }
    });

    it('exports only known fields from older, locally edited records', () => {
        localStorage.setItem('lemmings.progress.v1', JSON.stringify([
            { gameType: 1, groupIndex: 0, levelIndex: 1, bestSavedPercent: 50, privateData: 'not exported' },
            { gameType: 1, groupIndex: 0, levelIndex: 1, bestSavedPercent: 75 },
        ]));
        const value = JSON.parse(exportProgressBackup());
        expect(value.progress).toEqual([{ gameType: 1, groupIndex: 0, levelIndex: 1, bestSavedPercent: 75 }]);
    });
});

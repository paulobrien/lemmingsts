/** Progress is intentionally local to this browser/device. */
export interface LevelCompletion {
    gameType: number;
    groupIndex: number;
    levelIndex: number;
    bestSavedPercent: number;
}

export interface GameSettings {
    speed: number;
    musicEnabled: boolean;
}

const PROGRESS_KEY = 'lemmings.progress.v1';
const SETTINGS_KEY = 'lemmings.settings.v1';

function readJson(key: string): unknown {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch {
        return null;
    }
}

function writeJson(key: string, value: unknown): boolean {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

export function readProgress(): LevelCompletion[] {
    const value = readJson(PROGRESS_KEY);
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is LevelCompletion =>
        entry !== null && typeof entry === 'object' &&
        Number.isInteger(entry.gameType) && Number.isInteger(entry.groupIndex) &&
        Number.isInteger(entry.levelIndex) && typeof entry.bestSavedPercent === 'number');
}

export function recordCompletion(gameType: number, groupIndex: number, levelIndex: number, savedPercent: number): boolean {
    const progress = readProgress();
    const previous = progress.find(entry => entry.gameType === gameType && entry.groupIndex === groupIndex && entry.levelIndex === levelIndex);
    if (previous) previous.bestSavedPercent = Math.max(previous.bestSavedPercent, savedPercent);
    else progress.push({ gameType, groupIndex, levelIndex, bestSavedPercent: savedPercent });
    return writeJson(PROGRESS_KEY, progress);
}

export function readSettings(): GameSettings {
    const value = readJson(SETTINGS_KEY) as Partial<GameSettings> | null;
    return {
        speed: value && [1, 2, 4].includes(value.speed as number) ? value.speed as number : 1,
        musicEnabled: value?.musicEnabled === true,
    };
}

export function saveSettings(settings: GameSettings): boolean {
    return writeJson(SETTINGS_KEY, settings);
}

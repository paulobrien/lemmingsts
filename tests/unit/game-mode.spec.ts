// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readGameMode, readGameModePreference, writeGameMode } from '../../src/game/game-mode';

describe('device game mode', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());
  it('defaults to DOS and stores a single explicit mode', () => {
    expect(readGameMode()).toBe('dos');
    expect(writeGameMode('windows')).toBe(true);
    expect(readGameMode()).toBe('windows');
    expect(writeGameMode('dos')).toBe(true);
    expect(readGameMode()).toBe('dos');
    localStorage.setItem('lemmings.game-mode.v1', 'unrecognised');
    expect(readGameMode()).toBe('dos');
  });
  it('migrates only a fully Windows legacy presentation and never overrides an explicit choice', () => {
    localStorage.setItem('lemmings.audio-style.v1', 'windows');
    expect(readGameMode()).toBe('dos');
    localStorage.setItem('lemmings.graphics.v1', 'windows');
    expect(readGameMode()).toBe('windows');
    writeGameMode('dos');
    expect(readGameMode()).toBe('dos');
  });
  it('distinguishes an automatic choice from a saved preference', () => {
    expect(readGameModePreference()).toBeNull();
    expect(writeGameMode('windows', false)).toBe(true);
    expect(readGameMode()).toBe('windows');
    expect(readGameModePreference()).toBeNull();
    expect(writeGameMode('dos')).toBe(true);
    expect(writeGameMode('windows', false)).toBe(true);
    expect(readGameMode()).toBe('windows');
    expect(readGameModePreference()).toBe('dos');
  });
  it('preserves existing explicit mode when making an automatic choice', () => {
    localStorage.setItem('lemmings.game-mode.v1', 'dos');
    expect(readGameModePreference()).toBe('dos');
    expect(writeGameMode('windows', false)).toBe(true);
    expect(readGameModePreference()).toBe('dos');
  });
  it('remains usable if local storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('blocked'); });
    expect(readGameMode()).toBe('dos');
    expect(writeGameMode('windows')).toBe(false);
  });
});

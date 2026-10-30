// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readWindowsIconAnimationsEnabled, saveWindowsIconAnimationsEnabled } from '../../src/game/view/windows-icon-preference';

describe('Windows toolbar animation preference', () => {
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('defaults to enabled and remembers either choice', () => {
    expect(readWindowsIconAnimationsEnabled()).toBe(true);
    expect(saveWindowsIconAnimationsEnabled(false)).toBe(true);
    expect(readWindowsIconAnimationsEnabled()).toBe(false);
    expect(saveWindowsIconAnimationsEnabled(true)).toBe(true);
    expect(readWindowsIconAnimationsEnabled()).toBe(true);
  });

  it('continues with a safe default and reports when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readWindowsIconAnimationsEnabled()).toBe(true);
    expect(saveWindowsIconAnimationsEnabled(false)).toBe(false);
  });
});

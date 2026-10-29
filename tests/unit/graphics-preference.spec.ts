// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readGraphicsMode, saveGraphicsMode } from '../../src/views/graphics-preference';

describe('device graphics preference', () => {
    beforeEach(() => localStorage.clear());
    it('uses original by default and ignores unknown stored values', () => {
        expect(readGraphicsMode()).toBe('original');
        localStorage.setItem('lemmings.graphics.v1', 'unknown');
        expect(readGraphicsMode()).toBe('original');
        expect(saveGraphicsMode('enhanced')).toBe(true);
        expect(readGraphicsMode()).toBe('enhanced');
    });
    it('keeps original usable when browser storage is unavailable', () => {
        const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable'); });
        const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable'); });
        try { expect(readGraphicsMode()).toBe('original'); expect(saveGraphicsMode('enhanced')).toBe(false); }
        finally { read.mockRestore(); write.mockRestore(); }
    });
});

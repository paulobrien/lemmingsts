import { describe, expect, it } from 'vitest';
import { getTestedSolution } from '../../src/game/solutions/tested-solutions';
import { getWindowsTestedSolution } from '../../src/game/solutions/windows-tested-solutions';

describe('Windows tested solutions', () => {
  it('has a progressive, verified route for each Windows-disc level', () => {
    const skipped = [[12, 21], [13, 20], [14], [21]];
    for (let group = 0; group < 4; group++) {
      const source = Array.from({ length: 30 }, (_, index) => index).filter(index => !skipped[group].includes(index));
      for (const [level, dosIndex] of source.entries()) {
        const actual = getWindowsTestedSolution(group, level);
        const dos = getTestedSolution(group, dosIndex)!;
        expect(actual, `${group}/${level}`).toBeDefined();
        expect(actual).toMatchObject({ groupIndex: group, levelIndex: level });
        expect(actual!.hints.length).toBeGreaterThanOrEqual(2);
        expect(actual!.hints.every(hint => hint.trim().length > 0)).toBe(true);
        if (!(group === 0 && dosIndex === 4) && !(group === 2 && dosIndex === 7) && !(group === 3 && dosIndex === 25)) {
          expect(actual!.replay).toBe(dos.replay);
          expect(actual!.hints).toEqual(dos.hints);
        }
      }
      expect(getWindowsTestedSolution(group, source.length)).toBeUndefined();
    }
  });
  it('uses the three Windows-specific verified routes', () => {
    expect(getWindowsTestedSolution(0, 4)!.replay).not.toContain('&710=l8');
    expect(getWindowsTestedSolution(2, 7)!.replay).toContain('871=l0&915=s5');
    expect(getWindowsTestedSolution(2, 7)!.hints.join(' ')).toContain('while the bridge is being built');
    expect(getWindowsTestedSolution(3, 24)!.replay).toContain('&2880=s4&2880=s3&2880=l5');
  });
  it('rejects out-of-range or non-integer indices', () => {
    for (const [group, level] of [[-1, 0], [4, 0], [0, -1], [0, 28], [0.5, 0], [0, 1.5], [NaN, 0]]) {
      expect(getWindowsTestedSolution(group, level)).toBeUndefined();
    }
  });
});

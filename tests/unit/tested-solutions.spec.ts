import { describe, expect, it } from 'vitest';
import { getSolutionCoverage, getTestedSolution, TESTED_SOLUTIONS } from '../../src/game/solutions/tested-solutions';

describe('tested solutions', () => {
  it('exposes progressive hints for verified levels only', () => {
    expect(getTestedSolution(0, 0)?.hints).toHaveLength(2);
    const unverifiedLevel = Array.from({ length: 120 }, (_, index) => ({
      group: Math.floor(index / 30), level: index % 30,
    })).find(({ group, level }) => !getTestedSolution(group, level));
    if (unverifiedLevel) expect(getTestedSolution(unverifiedLevel.group, unverifiedLevel.level)).toBeUndefined();
    expect(getSolutionCoverage()).toEqual({ verified: TESTED_SOLUTIONS.length, unverified: 120 - TESTED_SOLUTIONS.length, total: 120 });
  });

  it('does not contain duplicate or out-of-range level entries', () => {
    const keys = new Set<string>();
    for (const solution of TESTED_SOLUTIONS) {
      expect(solution.groupIndex).toBeGreaterThanOrEqual(0);
      expect(solution.groupIndex).toBeLessThan(4);
      expect(solution.levelIndex).toBeGreaterThanOrEqual(0);
      expect(solution.levelIndex).toBeLessThan(30);
      expect(solution.replay).toMatch(/^\d+=[lsind]/);
      const key = `${solution.groupIndex}:${solution.levelIndex}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
    expect(getSolutionCoverage().verified).toBe(keys.size);
  });
});

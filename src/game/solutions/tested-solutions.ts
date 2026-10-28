/**
 * Replays are actions in this engine's own format, verified against the
 * original DOS game data. Hints are written separately from those commands.
 * Do not add entries until their replay completes the level in the local test.
 */
export interface TestedSolution {
  readonly groupIndex: number;
  readonly levelIndex: number;
  readonly replay: string;
  /** Hints go from gentle to more specific and must reflect the tested replay. */
  readonly hints: readonly string[];
}

export const TESTED_SOLUTIONS: readonly TestedSolution[] = [
  {
    groupIndex: 0,
    levelIndex: 0,
    replay: '132=s8&132=l0',
    hints: [
      'Look for a place to dig through the floor.',
      'Make the first lemming a digger before it reaches the right-hand wall.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 1,
    replay: '0=s2&34=l0&88=l1&142=l2&196=l3&250=l4&304=l5&358=l6&412=l7&466=l8&520=l9',
    hints: [
      'What could protect the lemmings from the long fall?',
      'Select Floater, then give each lemming a parachute as it emerges.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 8,
    replay: '70=s6&70=l0',
    hints: [
      'The route to the exit is blocked, but a horizontal path may help.',
      'Give the first lemming the Basher skill early, before the crowd reaches the obstacle.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 10,
    replay: '75=s6&75=l0',
    hints: [
      'The crowd is trapped by a wall.',
      'Make the first lemming a Basher as it approaches the right-hand wall.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 16,
    replay: '15=s6&15=l0',
    hints: [
      'One entrance gives its lemmings a way out of their pen.',
      'Make the first lemming from the rightmost entrance a Basher against the wall to its right.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 23,
    replay: '240=s6&240=l0',
    hints: [
      'Look for a way through at the far side of the lower platform.',
      'After the first lemming drops to the lower platform, make it bash through the right-hand wall.',
    ],
  },
];

/** Unverified levels deliberately return no solution or hints. */
export function getTestedSolution(groupIndex: number, levelIndex: number): TestedSolution | undefined {
  return TESTED_SOLUTIONS.find((solution) => solution.groupIndex === groupIndex && solution.levelIndex === levelIndex);
}

export function getSolutionCoverage(): { verified: number; unverified: number; total: number } {
  const total = 120;
  return { verified: TESTED_SOLUTIONS.length, unverified: total - TESTED_SOLUTIONS.length, total };
}

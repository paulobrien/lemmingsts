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
    levelIndex: 2,
    replay: '150=s4&150=l0&360=l1&540=l2&730=l3&910=l4',
    hints: [
      'The platforms form a zigzag route downward, but the crowd needs help turning at each edge.',
      'Place Blockers alternately on the right and left ends of successive platforms, then turn the final group toward the exit.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 3,
    replay: '143=l0&150=s7&150=l0&246=s1&246=l1&349=l2&452=l3&555=l4&658=l5&761=l6&864=l7&967=l8&1070=l9',
    hints: [
      'A path must be opened, and each lemming needs a way up the far wall.',
      'Make the first lemming a Climber, then a Miner near the start; make each following lemming a Climber.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 4,
    replay: '145=s6&145=l0&258=l0&276=l1&355=l2&434=l3&575=l0&590=l3&601=l2&612=l1&649=l0&659=l1&669=l4&679=l2&690=l3&711=l2&721=l0',
    hints: [
      'The barriers on the route can be opened from the side.',
      'Choose a Basher for lemmings approaching each barrier; repeat until the path to the exit is clear.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 5,
    replay: '40=s3&40=l0&295=s4&295=l1&296=s3&296=l1',
    hints: [
      'The crowd needs an opening in its starting chamber and a way past the narrow post.',
      'Bomb the first lemming to open the floor; make a lemming block beside the post, then give that Blocker a Bomber.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 6,
    replay: '203=s5&203=l0&655=l0',
    hints: [
      'The crowd needs a way up to the higher ground, and then across a narrow gap.',
      'Use the first lemming to build towards the right-hand ledge; assign it another Builder near the far edge before it steps into the gap.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 7,
    replay: '21=s4&21=l0',
    hints: [
      'The exit is close to the entrance; the crowd initially heads the wrong way.',
      'Place a Blocker shortly after the first lemming lands to turn the rest back toward the exit.',
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
    levelIndex: 9,
    replay: '34=s2&34=l0&88=l1&120=s4&120=l0&142=s2&142=l2&196=l3&250=l4&304=l5&358=l6&412=l7&466=l8&520=l9&574=l10&628=l11&682=l12&736=l13&790=l14&844=l15&898=l16&952=l17&1006=l18&1060=l19',
    hints: [
      'The long drop calls for a way to slow the fall, then the group must turn toward the exit.',
      'Give each lemming a Floater; after the first lands, make it a Blocker to turn the others left.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 23,
    replay: '240=s6&240=l0',
    hints: [
      'A horizontal path can help the group.',
      'Try assigning a Basher to the leading lemming after it has travelled a little way.',
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

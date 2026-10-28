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
    replay: '152=s8&152=l0',
    hints: [
      'Look for a place to dig through the floor.',
      'Make the first lemming a digger before it reaches the right-hand wall.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 1,
    replay: '0=s2&54=l0&82=l1&110=l2&138=l3&166=l4&194=l5&222=l6&250=l7&278=l8&306=l9',
    hints: [
      'What could protect the lemmings from the long fall?',
      'Select Floater, then give each lemming a parachute as it emerges.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 2,
    replay: '170=s4&170=l0&354=l1&508=l2&672=l3&826=l4',
    hints: [
      'The platforms form a zigzag route downward, but the crowd needs help turning at each edge.',
      'Place Blockers alternately on the right and left ends of successive platforms, then turn the final group toward the exit.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 4,
    replay: '165=s6&165=l0&270=l1&278=l0&323=l2&376=l3&532=l3&569=l2&585=l4&595=l0&606=l1&632=l3&647=l2&653=l1&679=l2&741=l0',
    hints: [
      'The barriers on the route can be opened from the side.',
      'Choose a Basher for lemmings approaching each barrier; repeat until the path to the exit is clear.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 5,
    replay: '60=s3&60=l0&289=s4&289=l1&290=s3&290=l1',
    hints: [
      'The crowd needs an opening in its starting chamber and a way past the narrow post.',
      'Bomb the first lemming to open the floor; make a lemming block beside the post, then give that Blocker a Bomber.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 6,
    replay: '223=s5&223=l0&675=l0',
    hints: [
      'The crowd needs a way up to the higher ground, and then across a narrow gap.',
      'Use the first lemming to build towards the right-hand ledge; assign it another Builder near the far edge before it steps into the gap.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 7,
    replay: '74=s4&74=l0',
    hints: [
      'The exit is close to the entrance; the crowd initially heads the wrong way.',
      'Place a Blocker shortly after the first lemming lands to turn the rest back toward the exit.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 8,
    replay: '123=s6&123=l0',
    hints: [
      'The route to the exit is blocked, but a horizontal path may help.',
      'Give the first lemming the Basher skill early, before the crowd reaches the obstacle.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 9,
    replay: '54=s2&54=l0&82=l1&110=l2&138=l3&140=s4&140=l0&141=s2&166=l4&194=l5&222=l6&250=l7&278=l8&306=l9&334=l10&362=l11&390=l12&418=l13&446=l14&474=l15&502=l16&530=l17&558=l18&586=l19',
    hints: [
      'The long drop calls for a way to slow the fall, then the group must turn toward the exit.',
      'Give each lemming a Floater; after the first lands, make it a Blocker to turn the others left.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 11,
    replay: '168=s6&168=l0&298=s4&298=l1&383=s5&383=l0&616=l0&816=l0&913=l0&944=n',
    hints: [
      'Keep the crowd away from the left-hand drop, then make a route out of the hollow.',
      'Bash through the central wall, use a Blocker near the left edge, then build from the hollow until the crowd can reach the exit.',
      'Once enough lemmings are safe, the remaining lemmings can be nuked to finish the level.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 12,
    replay: '0=s8&555=l0&599=l1&643=l2&687=l3&731=l4&775=l5&819=l6&863=l7&907=l8&951=l9&995=l10&1039=l11&1083=l12&1127=l13&1171=l14&1215=l15&1259=l16&1303=l17&1347=l18&1391=l19',
    hints: [
      'The drop is too far from the top of the platform, but shorter from inside it.',
      'Make each lemming dig its own hole, starting towards the right and placing each next hole just to the left.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 18,
    replay: '858=s5&858=l0&1058=l0&1258=l0&1458=l0&1560=i3&1561=i3&1562=i3&1563=i3&1564=i3&1565=i3&1566=i3&1567=i3&1568=i3&1569=i3&1570=i3&1571=i3&1572=i3&1573=i3&1574=i3&1575=i3&1576=i3&1577=i3&1578=i3&1579=i3&1580=i3&1581=i3&1582=i3&1583=i3&1584=i3&1585=i3&1586=i1',
    hints: [
      'The last hill needs a route to the elevated exit.',
      'Start building near the middle of the last hill, extend the bridge as needed, then raise the release rate so the crowd arrives in time.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 19,
    replay: '75=s5&75=l0&367=s6&367=l0&411=l0&447=l0&491=l0&527=l0&570=l0&607=l0&633=s5&633=l0&1340=i3&1341=i3&1342=i3&1343=i3&1344=i3&1345=i3&1346=i3&1347=i3&1348=i3&1349=i3&1350=i3&1351=i3&1352=i3&1353=i3&1354=i3&1355=i3&1356=i3&1357=i3&1358=i3&1359=i3&1360=i3&1361=i3&1362=i3&1363=i3&1364=i3&1365=i3&1366=i3&1367=i3&1368=i3&1369=i3',
    hints: [
      'There is a gap at the start, a row of barriers, and a final gap near the exit.',
      'Bridge the opening, bash through the barriers, then build to the exit before increasing the release rate.',
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

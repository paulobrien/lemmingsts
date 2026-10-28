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
    levelIndex: 3,
    replay: '54=l0&80=s7&80=l0&107=s1&107=l1&160=l2&213=l3&266=l4&319=l5&372=l6&425=l7&478=l8&531=l9',
    hints: [
      'The lemmings need a way out of their starting enclosure and over the wall.',
      'Make each lemming a Climber, and use the first as a Miner to open a path out.',
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
    replay: '223=s5&223=l0&677=l0',
    hints: [
      'The crowd needs a way up to the higher ground, and then across a narrow gap.',
      'Use the first lemming to build towards the right-hand ledge; assign it another Builder near the far edge before it steps into the gap.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 7,
    replay: '75=s4&75=l0',
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
    replay: '172=s6&172=l0&302=s4&302=l1&387=s5&387=l0&620=l0&820=l0&917=l0&949=n',
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
    levelIndex: 13,
    replay: '152=s6&152=l0&317=s5&317=l0&509=l0&701=l0&893=l0&909=s6&909=l14&1431=s5&1431=l14&1623=l14&1815=l14&2007=l14&2162=s6&2162=l32&2349=l32',
    hints: [
      'There is water below the chambers and barriers between them.',
      'Open the first barrier, then build a staircase in each chamber so a Basher can open a safe route through the next barrier.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 15,
    replay: '198=s5&198=l0&390=l0&582=l0&774=l0&966=l0&1158=l0&1350=l0',
    hints: [
      'The exit is high above the right-hand edge of the starting platform.',
      'Start the first lemming building near that edge and extend the staircase until it reaches the exit platform.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 17,
    replay: '249=s4&249=l0&249=s3&249=l0&375=s4&375=l8&375=s3&375=l8&487=s4&487=l16&487=s3&487=l16&604=s4&604=l17&604=s3&604=l17&781=s4&781=l18&781=s3&781=l18',
    hints: [
      'The floors have dangerous fire patches; choose a safe spot above each room.',
      'Stop and bomb a lemming to open each floor in turn, keeping the holes clear of flames and offset so the drops stay safe.',
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
  {
    groupIndex: 0,
    levelIndex: 20,
    replay: '296=s6&296=l0&316=l0&336=l0&356=l1&376=l2&407=l3&430=l3&454=l4&492=l5&512=l5&532=l1&554=l4&574=l2&604=l11&632=l12&660=l0&687=l0&707=l6&727=l0&1123=s5&1123=l0',
    hints: [
      'There is a route through the rock, followed by a trap before the exit.',
      'Bash through the rock, then use a Builder to give the group a safe path above the trap.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 24,
    replay: '353=s6&353=l0&485=s8&485=l1',
    hints: [
      'The route climbs the fence before reaching the web above the exit.',
      'Bash through the barrier at the top of the fence, then dig down through the web so the crowd can reach the exit.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 25,
    replay: '85=s5&85=l0&123=l1&368=l0&406=l1&568=l0&606=l1&768=l0&806=l1&968=l0&984=s6&984=l0&1006=s5&1006=l1&1022=s6&1022=l1',
    hints: [
      'Both lemmings must cross the gaps and reach the exit together.',
      'Give each a Builder at the first ledge; extend the second bridge as needed, then bash through the wall ahead.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 29,
    replay: '64=s6&64=l0&120=l0&208=l0',
    hints: [
      'The pits descend in a zigzag; each has a narrow side wall.',
      'Bash out of the first pit to the left, the next to the right, and the last to the left.',
    ],
  },
  {
    groupIndex: 1,
    levelIndex: 1,
    replay: '0=s8&0=i3&1=i3&2=i3&3=i3&4=i3&5=i3&6=i3&7=i3&8=i3&9=i3&10=i3&11=i1&555=l0&583=l1&611=l2&639=l3&667=l4&695=l5&723=l6&751=l7&779=l8&807=l9&835=l10&863=l11&891=l12&919=l13&947=l14&975=l15&1003=l16&1031=l17&1059=l18&1087=l19&1115=l20&1143=l21&1171=l22&1199=l23&1227=l24&1255=l25&1283=l26&1311=l27&1339=l28&1367=l29&1395=l30&1423=l31&1451=l32&1479=l33&1507=l34&1535=l35&1563=l36&1591=l37&1619=l38&1647=l39',
    hints: [
      'The drop becomes safe if each lemming can descend through the platform first.',
      'Raise the release rate, then assign each lemming a Digger, starting on the right and moving left across the platform.',
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

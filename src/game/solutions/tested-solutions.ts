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
    replay: '0=s6&166=l0&290=l0&595=l7&628=l0&645=l0&659=l8&673=l7&681=l7&691=l0&710=l8&745=l9&765=l7',
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
    levelIndex: 10,
    replay: '54=l0&54=s2&54=l0&82=s1&82=l1&82=s2&82=l1&396=s4&396=l0&429=s6&429=l1&650=s3&650=l0',
    hints: [
      'The arrowed wall can only be bashed in one direction.',
      'Give the first two lemmings Climber and Floater. On the far side, use one as a Blocker to turn the other around, then bash back through the wall and bomb the Blocker.',
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
    replay: '75=s5&75=l0&338=s6&338=l3&371=l3&396=l3&429=l3&454=l3&486=l3&512=l3&530=s5&530=l0&586=s6&586=l3&1340=i3&1341=i3&1342=i3&1343=i3&1344=i3&1345=i3&1346=i3&1347=i3&1348=i3&1349=i3&1350=i3&1351=i3&1352=i3&1353=i3&1354=i3&1355=i3&1356=i3&1357=i3&1358=i3&1359=i3&1360=i3&1361=i3&1362=i3&1363=i3&1364=i3&1365=i3&1366=i3&1367=i3&1368=i3&1369=i3',
    hints: [
      'There is a gap at the start, a row of barriers, and a final gap near the exit.',
      'Bridge the opening, bash through the barriers, then build to the exit before increasing the release rate.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 20,
    replay: '296=s6&296=l0&316=l0&336=l0&356=l1&376=l2&407=l3&430=l3&454=l4&492=l5&512=l5&532=l1&554=l4&574=l2&604=l11&632=l12&660=l0&687=l0&707=l6&727=l0&1148=s5&1148=l0',
    hints: [
      'There is a route through the rock, followed by a trap before the exit.',
      'Bash through the rock, then use a Builder to give the group a safe path above the trap.',
    ],
  },
  {
    groupIndex: 0,
    levelIndex: 23,
    replay: '400=s8&400=l0',
    hints: [
      'Look for a way down from the lower platform.',
      'After the first lemming drops to the lower platform, make it dig through the floor.',
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
    replay: '64=s6&64=l0&131=l0&219=l0',
    hints: [
      'The pits descend in a zigzag; each has a narrow side wall.',
      'Bash out of the first pit to the left, the next to the right, and the last to the left.',
    ],
  },
  {
    groupIndex: 1,
    levelIndex: 0,
    replay: '210=s4&210=l1&330=s5&330=l0&530=l0&730=l0&930=l0&1272=s6&1272=l0&1700=s3&1700=l1',
    hints: [
      'Keep the crowd safe while one lemming prepares a route over the gap and through the obstacle.',
      'Use a Blocker to hold the group; have the leader build across the pit and bash through the wall, then bomb the Blocker to release the others.',
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
  {
    groupIndex: 1,
    levelIndex: 2,
    replay: '130=s4&130=l1&160=s8&160=l0&215=s4&215=l2&560=s7&560=l0&744=s5&744=l0&944=l0&1144=l0&1344=l0&1544=l0&1744=l0&1944=l0&2144=l0&2160=s6&2160=l0&2400=s3&2400=l1',
    hints: [
      'Keep the group at the entrance while one lemming creates a safe route down and back up.',
      'Dig near the right edge and mine out to the lower platform. Build a staircase from its left end to the far ledge, then release the group.',
    ],
  },
  {
    groupIndex: 1,
    levelIndex: 3,
    replay: '54=l0&80=l1&106=l2&132=l3&158=l4&184=l5&210=l6&236=l7&262=l8&288=l9&314=l10&340=l11&366=l12&392=l13&418=l14&444=l15&470=l16&496=l17&522=l18&548=l19&574=l20&600=l21&600=s4&600=l1&626=s1&626=l22&652=l23&678=l24&704=l25&710=s5&710=l0&730=s1&730=l26&756=l27&782=l28&808=l29&834=l30&848=s4&848=l2&860=s1&860=l31&886=l32&910=s5&910=l0&912=s1&912=l33&938=l34&964=l35&990=l36&1016=l37&1042=l38&1068=l39&1162=s5&1162=l0&1362=l0&1562=l0&1700=s6&1700=l0&1730=s5&1730=l0&2000=s3&2000=l1',
    hints: [
      'Send a climber ahead and keep others safe while the route to the exit is prepared.',
      'Give the crowd Climber, use Blockers on both sides of the wall, then build across the gaps. At the small platform, interrupt the bridge so the leader can drop onto it before building again; remove the right Blocker when the route is ready.',
    ],
  },
  {
    groupIndex: 1,
    levelIndex: 5,
    replay: '54=l0&54=s2&54=l0&215=s5&215=l0&415=l0&615=l0&800=s6&800=l0&903=s5&903=l0&1103=l0&1315=l0&1515=l0&1700=s1&1700=l2&1700=s2&1700=l2&1701=s1&1701=l4&1701=s2&1701=l4&1702=s1&1702=l1&1702=s2&1702=l1&1704=s1&1704=l3&1704=s2&1704=l3',
    hints: [
      'Send one lemming ahead and prepare a safe route before letting the others follow.',
      'Give the leader Climber and Floater, build across the gaps using the lower island, then give the others the same two abilities while they face right.',
    ],
  },
  {
    groupIndex: 1,
    levelIndex: 8,
    replay: '100=s4&100=l0&250=l2&337=s5&337=l1&537=l1&737=l1&840=s7&840=l1&960=s5&960=l1&1160=l1&1360=l1&1430=s7&1430=l1&1530=s6&1530=l1&1798=s5&1798=l1&1998=l1&2198=l1&3000=s3&3000=l2',
    hints: [
      'Keep the crowd in place and send one lemming along the left route.',
      'Build towards each left ledge, mine through the bridges near the far wall to descend safely, then bash right through the mound and bridge the last gap. Release the left Blocker when ready.',
    ],
  },
  {
    groupIndex: 1,
    levelIndex: 9,
    replay: '105=s6&105=l0&110=s4&110=l1&150=l3&178=s6&178=l2&204=s4&204=l4&232=l5&373=s5&373=l0&448=l2&573=l0&746=l2&773=l0&973=l0&1045=l2&1173=l0&1245=l2&1373=l0&1421=s6&1421=l0&1445=s5&1445=l2&1645=l2&1845=l2&2021=s6&2021=l2&2500=s3&2500=l3&2500=l5',
    hints: [
      'Protect both entrances, then prepare a separate path to the central exit from each side.',
      'Hold each crowd between two Blockers. Bash the barriers and build inward from each side, interrupting each bridge above the exit so the lemmings can drop in; bomb the inner Blockers once the paths are ready.',
    ],
  },
  {
    groupIndex: 1,
    levelIndex: 10,
    replay: '180=s4&180=l1&326=s5&326=l0&539=l0&739=l0&939=l0&1139=l0&1339=l0&1539=l0&1739=l0&1939=l0&2139=l0&2204=s6&2204=l0&2329=l0&2451=s5&2451=l2&2651=l2&2851=l2',
    hints: [
      'Hold the crowd while a leader prepares a way into the attic.',
      'Bridge the left gap, build a long staircase to the walls, and bash through them. Build a second bridge over the Blocker to release the crowd without damaging the floor.',
    ],
  },
  {
    groupIndex: 1,
    levelIndex: 11,
    replay: '54=s2&54=l0&107=l1&160=l2&200=s1&200=l0&213=s2&213=l3&266=l4&319=l5&372=l6&425=l7&478=l8&531=l9&584=l10&609=s5&609=l0&637=s2&637=l11&690=l12&743=l13&796=l14&809=s5&809=l0&849=s2&849=l15&902=l16&955=l17&1008=l18&1061=l19&1114=l20&1167=l21&1220=l22&1273=l23&1300=s1&1300=l1&1301=l3&1302=l5&1303=l7&1304=l9&1305=l12&1306=l2&1307=l11&1308=l14&1309=l16&1310=l4&1311=l13&1312=l18&1313=l20&1314=l6&1315=l15&1316=l22&1318=l8&1319=l17&1322=l10&1323=l19&1326=s2&1326=l24&1327=s1&1327=l21&1331=l23&1359=l24&1379=s2&1379=l25&1412=s1&1412=l25&1432=s2&1432=l26&1465=s1&1465=l26&1485=s2&1485=l27&1518=s1&1518=l27&1538=s2&1538=l28&1571=s1&1571=l28&1591=s2&1591=l29&1624=s1&1624=l29&1644=s2&1644=l30&1677=s1&1677=l30&1697=s2&1697=l31&1730=s1&1730=l31&1750=s2&1750=l32&1783=s1&1783=l32&1803=s2&1803=l33&1836=s1&1836=l33&1856=s2&1856=l34&1889=s1&1889=l34&1909=s2&1909=l35&1942=s1&1942=l35&1962=s2&1962=l36&1995=s1&1995=l36&2015=s2&2015=l37&2048=s1&2048=l37&2068=s2&2068=l38&2101=s1&2101=l38&2121=s2&2121=l39&2154=s1&2154=l39&2174=s2&2174=l40&2207=s1&2207=l40&2227=s2&2227=l41&2260=s1&2260=l41&2280=s2&2280=l42&2313=s1&2313=l42&2333=s2&2333=l43&2366=s1&2366=l43&2386=s2&2386=l44&2419=s1&2419=l44&2439=s2&2439=l45&2472=s1&2472=l45&2492=s2&2492=l46&2525=s1&2525=l46&2545=s2&2545=l47&2578=s1&2578=l47&2598=s2&2598=l48&2631=s1&2631=l48&2651=s2&2651=l49&2684=s1&2684=l49',
    hints: [
      'Protect the long fall and let one lemming prepare the route out.',
      'Give each lemming Floater; make a leader a Climber and build at the far edge so the group can float down to the exit. Then give the waiting lemmings Climber.',
    ],
  },
  {
    groupIndex: 1,
    levelIndex: 12,
    replay: '54=s2&54=l0&120=s5&120=l0&127=s4&127=l1&182=l2&320=s5&320=l0&337=l0&537=l0&553=l0&753=l0&769=l0&969=l0&985=l0&1185=l0&1385=l0&1585=l0&1618=l0&1818=l0&2023=l0&2223=l0&2431=l0&2658=l0&2918=l0&3250=s3&3250=l1&3300=i3&3301=i3&3302=i3&3303=i3&3304=i3&3305=i3&3306=i3&3307=i3&3308=i3&3309=i3&3310=i3&3311=i3&3312=i3&3313=i3&3314=i3&3315=i3&3316=i3&3317=i3&3318=i3&3319=i3&3320=i3&3321=i3&3322=i3&3323=i3&3324=i3&3325=i3&3326=i3&3327=i3&3328=i3&3329=i3&3330=i3&3331=i3&3332=i2&3485=s4&3485=l3',
    hints: [
      'Protect the first drop and keep the crowd on the steel while one lemming builds a route.',
      'Use a Floater to build zigzagging stairs to the upper platforms and bridge the last gap. Release the crowd from the right-hand Blocker, and place another Blocker at the upper turn to guide them onto the next staircase.',
    ],
  },
  {
    groupIndex: 1,
    levelIndex: 13,
    replay: '140=s4&140=l1&165=s6&165=l0&236=s4&236=l2&302=s6&302=l0&761=l0&1561=l0&1720=s5&1720=l0&1920=l0&2120=l0&2320=l0&2520=l0&2584=s6&2584=l0&2695=s5&2695=l0&2895=l0&3095=l0&3295=l0&3495=l0&3695=l0&3740=s6&3740=l0&3800=s3&3800=l1',
    hints: [
      'Keep the crowd safe while a leader opens the obstacles and crosses the chasm.',
      'Bash through the obstacles, build across the chasm and to the exit, interrupting the bridges to land on the far ground and exit platform. Then bomb the Blocker holding the group.',
    ],
  },
  {
    groupIndex: 1,
    levelIndex: 14,
    replay: '54=s3&54=l0&82=l1&110=l2&138=l3',
    hints: [
      'The group can spare only four lemmings to open the route.',
      'Assign Bomber to each of the first four as it leaves the hatch; let the remaining six follow the opening.',
    ],
  },
  {
    groupIndex: 1,
    levelIndex: 15,
    replay: '110=s7&110=l0&220=s6&220=l0&867=s3&867=l0&874=l33&888=l13&904=l34&923=l14&929=l35&949=l36&969=l37&978=l15&994=l38',
    hints: [
      'Open the first ledge, then create a descending route through the fences.',
      'Mine right, switch the Miner to Basher before reaching the bottom, then give ten approaching lemmings Bombers at progressively later points along the fence.',
    ],
  },
  {
    groupIndex: 1,
    levelIndex: 16,
    replay: '54=s3&54=l0&208=l1',
    hints: [
      'Two openings can guide the group down, but you cannot spare a third lemming.',
      'Bomb one lemming on the top ledge, then bomb another while it walks right along the next ledge so the group can descend toward the exit.',
    ],
  },
  {
    groupIndex: 1,
    levelIndex: 17,
    replay: '82=s2&82=l1&170=s8&170=l0&230=s3&230=l0',
    hints: [
      'Use the third pillar to make the long drop safer, and protect the one who gets past the hole.',
      'Make the first lemming dig into the third pillar, give the next a Floater, then bomb the Digger to open the side of the shaft.',
    ],
  },
  {
    groupIndex: 1,
    levelIndex: 24,
    replay: '54=s2&54=l0&86=l8&86=s1&86=l8&118=s2&118=l16&150=l24&182=l32&214=l40&246=l48&278=l56&310=l64&342=l72&515=s8&515=l0&567=s5&567=l8&588=l0&767=s6&767=l8&872=s5&872=l8&1110=l0&1158=l0&1238=l0&1377=l0',
    hints: [
      'There are exactly enough Floaters to meet the target; spread them through the crowd.',
      'Dig a shallow holding cell in the pillar, send an athlete ahead to bridge and bash toward the exit, then build the waiting Floaters out.',
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

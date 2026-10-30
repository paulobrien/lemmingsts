import { getTestedSolution, type TestedSolution } from './tested-solutions';

/** DOS positions present in the verified Windows disc's original-game catalogue.
 * Windows omits six DOS levels, so its displayed indices must not be used as DOS indices. */
const OMITTED_DOS_LEVELS: readonly (readonly number[])[] = [[12, 21], [13, 20], [14], [21]];
const WINDOWS_TO_DOS: readonly (readonly number[])[] = OMITTED_DOS_LEVELS.map(omitted =>
  Array.from({ length: 30 }, (_, index) => index).filter(index => !omitted.includes(index)));

/** Return the tested Windows replay and progressive hints for this disc's level order.
 * Callers must first check the Windows game-data fingerprint. */
export function getWindowsTestedSolution(groupIndex: number, levelIndex: number): TestedSolution | undefined {
  if (!Number.isInteger(groupIndex) || !Number.isInteger(levelIndex) || groupIndex < 0 || levelIndex < 0) return undefined;
  const dosIndex = WINDOWS_TO_DOS[groupIndex]?.[levelIndex];
  if (dosIndex === undefined) return undefined;
  const dos = getTestedSolution(groupIndex, dosIndex);
  if (!dos) return undefined;
  let replay = dos.replay;
  let hints = dos.hints;
  // Windows uses a slightly different bash mask, making these DOS commands
  // inapplicable and requiring an earlier route through The Art Gallery.
  if (groupIndex === 0 && dosIndex === 4) replay = replay.replace('&710=l8', '');
  if (groupIndex === 3 && dosIndex === 25) replay = replay.replace('&2880=l5', '');
  if (groupIndex === 2 && dosIndex === 7) {
    replay = '340=s6&340=l0&363=s5&363=l1&387=l0&414=l2&457=l3&500=l4&539=s6&539=l0&584=l0&684=l0&871=l0&915=s5&915=l0&1000=i99&1107=l0&1299=l0&1559=l0&1751=l0&1776=s6&1776=l18';
    hints = [
      'One lemming can prepare the route while the others wait in the gallery.',
      'After opening the first rope, use Builders to close the passage behind your scout.',
      'Bash through the obstacles, then start the bridge as soon as the scout reaches the gap. Raise the release rate while the bridge is being built; bash the raised barrier to release the crowd.',
    ];
  }
  return { groupIndex, levelIndex, replay, hints };
}

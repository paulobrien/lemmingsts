import { GameFactory } from '../game-factory';
import { GameStateTypes } from '../game-state-types';
import { GameTypes } from '../game-types';
import { SkillTypes } from '../game-play/skill-types';
import { getTestedSolution, type TestedSolution } from './tested-solutions';

export interface ExampleFirstMove {
  x: number;
  y: number;
  skill: SkillTypes;
  gameSeconds: number;
}

/** Reconstruct an illustrative first move in a separate, disposable game. */
export async function getExampleFirstMove(factory: GameFactory, group: number, level: number,
  solution: TestedSolution | null | undefined = getTestedSolution(group, level)): Promise<ExampleFirstMove | null> {
  if (!solution) return null;
  let skill = SkillTypes.CLIMBER;
  let first: { tick: number; id: number } | null = null;
  for (const part of solution.replay.split('&')) {
    const select = /^(\d+)=s(\d+)$/.exec(part);
    if (select) skill = Number(select[2]) as SkillTypes;
    const assign = /^(\d+)=l(\d+)$/.exec(part);
    if (assign) { first = { tick: Number(assign[1]), id: Number(assign[2]) }; break; }
  }
  if (!first || !SkillTypes.isValid(skill)) return null;
  const game = await factory.getGame(GameTypes.LEMMINGS, group, level);
  if (!game) return null;
  try {
    const timer = game.getGameTimer();
    game.getCommandManager().loadReplay(solution.replay);
    for (let tick = 0; tick < first.tick; tick++) {
      if (game.getGameState() !== GameStateTypes.RUNNING) return null;
      timer.tick();
      // Yield during long examples so the interface remains responsive.
      if (tick > 0 && tick % 200 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    const lem = game.getLemmingManager().getLemming(first.id);
    if (!lem || lem.removed || lem.isDisabled()) return null;
    const result: ExampleFirstMove = { x: lem.x, y: lem.y, skill, gameSeconds: Math.floor(first.tick / 17) };
    timer.tick();
    if (!game.getCommandManager().serialize().split('&').includes(`${first.tick}=l${first.id}`)) return null;
    return result;
  } finally {
    game.stop();
  }
}

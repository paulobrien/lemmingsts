import type { Game } from '../game';
import { CommandLemmingsAction } from '../game-play/commands/command-lemming-action';
import type { PlayerAssignmentResult } from './player-assignment-result';

/** Feedback belongs to live player input; replay commands remain silent. */
export function assignPlayerSkill(game: Game, lemmingId: number | null): PlayerAssignmentResult {
    let result: PlayerAssignmentResult;
    if (lemmingId === null) result = 'miss';
    else if (!game.getGameSkills().canDecreaseSkill(game.getGameSkills().getSelectedSkill())) result = 'unavailable';
    else result = game.queueCommand(new CommandLemmingsAction(lemmingId)) ? 'assigned' : 'rejected';
    game.onPlayerAssignment.trigger(result);
    return result;
}

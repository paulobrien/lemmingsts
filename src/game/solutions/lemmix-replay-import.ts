import { Game } from '../game';
import { GameStateTypes } from '../game-state-types';
import { GameTypes } from '../game-types';
import { CommandLemmingsAction } from '../game-play/commands/command-lemming-action';
import { CommandSelectSkill } from '../game-play/commands/command-select-skill';
import { SkillTypes } from '../game-play/skill-types';

/**
 * A deliberately limited Lemmix replay importer for local research.
 * Lemmix's public Game.pas defines a 64-byte LRB header and 32-byte records:
 * https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L219
 * Source physics are not identical to this engine. Parsing only produces a
 * candidate; it must pass verifyLemmixCandidate on a fresh game before use.
 */
type Event =
  | { readonly tick: number; readonly kind: 'select'; readonly skill: SkillTypes }
  | { readonly tick: number; readonly kind: 'assign'; readonly skill: SkillTypes; readonly id: number; readonly x: number; readonly y: number };

export interface LemmixCandidate {
  readonly levelTitle: string;
  readonly initialReleaseRate: number;
  readonly sourceLevelHash: string;
  readonly events: readonly Event[];
  readonly replay: string;
}

// DOSORIG_MECHANICS, including Obsolete and TriggeredTrapLemmixBugSolved.
// These flags identify the replay's source rules, not proof that this engine
// implements each DOS quirk. Optional glitch and other game styles are rejected.
const DOS_ORIGINAL_MECHANICS = 0x03df;
const HEADER_SIZE = 64;
const RECORD_SIZE = 32;
const SELECT = 0x40;
const ASSIGN = 0x80;
const ACTION_SKILL: Readonly<Record<number, SkillTypes>> = {
  3: SkillTypes.DIGGER, 4: SkillTypes.CLIMBER, 7: SkillTypes.BUILDER,
  8: SkillTypes.BASHER, 9: SkillTypes.MINER, 11: SkillTypes.FLOATER,
  15: SkillTypes.BLOCKER, 18: SkillTypes.BOMBER,
};
const BUTTON_SKILL: Readonly<Record<number, SkillTypes>> = {
  3: SkillTypes.CLIMBER, 4: SkillTypes.FLOATER, 5: SkillTypes.BOMBER,
  6: SkillTypes.BLOCKER, 7: SkillTypes.BUILDER, 8: SkillTypes.BASHER,
  9: SkillTypes.MINER, 10: SkillTypes.DIGGER,
};

/** Parse v3 DOS-original skill-only records. This does not validate a solution. */
export function parseLemmixReplay(
  bytes: Uint8Array,
  target: { readonly levelTitle: string; readonly initialReleaseRate: number },
): LemmixCandidate {
  const fail = (message: string): never => { throw new Error(`Unsupported or invalid LRB: ${message}`); };
  if (!Number.isInteger(target.initialReleaseRate) || target.initialReleaseRate < 1 || target.initialReleaseRate > 99) fail('invalid target release rate');
  if (bytes.byteLength < HEADER_SIZE) fail('truncated header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] !== 0x4c || bytes[1] !== 0x52 || bytes[2] !== 0x42) fail('signature');
  if (view.getUint8(3) !== 3) fail('only version 3 is supported');
  if (view.getUint32(4, true) !== bytes.byteLength) fail('file size');
  if (view.getUint16(8, true) !== HEADER_SIZE || view.getUint32(12, true) !== HEADER_SIZE) fail('header layout');
  if (view.getUint16(10, true) !== DOS_ORIGINAL_MECHANICS) fail('mechanics are not the supported DOS-original set');
  if (view.getUint8(16) !== 0 || view.getUint8(17) !== 0 || view.getInt32(28, true) !== 0) fail('reserved header or pause-glitch data');
  const count = view.getUint16(18, true);
  if (count > 32768 || bytes.byteLength !== HEADER_SIZE + count * RECORD_SIZE) fail('record count or trailing data');
  const title = new TextDecoder('windows-1252').decode(bytes.subarray(32, 64)).replace(/\0+$/, '').trim();
  if (!title || title !== target.levelTitle.trim()) fail('level title does not match');
  const sourceLevelHash = view.getBigUint64(20, true).toString(16).padStart(16, '0');
  const events: Event[] = [];
  const commands: string[] = [];
  let selected = SkillTypes.CLIMBER;
  let lastTick = 0;
  const select = (tick: number, skill: SkillTypes) => {
    if (selected !== skill) {
      selected = skill;
      events.push({ tick, kind: 'select', skill });
      commands.push(`${tick}=s${skill}`);
    }
  };
  for (let i = 0; i < count; i++) {
    const offset = HEADER_SIZE + i * RECORD_SIZE;
    if (view.getUint8(offset) !== 0x52) fail(`record ${i}: signature`);
    const tick = view.getInt32(offset + 1, true);
    if (tick < lastTick || tick < 0 || tick > 1_000_000) fail(`record ${i}: invalid iteration order`);
    lastTick = tick;
    const flags = view.getUint16(offset + 5, true);
    if (!flags || (flags & ~(SELECT | ASSIGN))) fail(`record ${i}: pause, release-rate, nuke or other action flags`);
    if (view.getUint8(offset + 29) !== 0 || view.getUint8(offset + 30) !== 0 || view.getUint8(offset + 31) !== 0) fail(`record ${i}: glitch or reserved flags`);
    const rate = view.getInt32(offset + 9, true);
    if (rate !== target.initialReleaseRate) fail(`record ${i}: release-rate changes or unspecified rates are not supported`);
    // Lemmix applies assignments before button selection if both occur.
    if (flags & ASSIGN) {
      const skill = ACTION_SKILL[view.getUint8(offset + 7)];
      const id = view.getInt32(offset + 13, true);
      if (skill === undefined || id < 0 || id > 127) fail(`record ${i}: skill or lemming index`);
      select(tick, skill);
      const x = view.getInt32(offset + 17, true), y = view.getInt32(offset + 21, true);
      events.push({ tick, kind: 'assign', skill, id, x, y });
      commands.push(`${tick}=l${id}`);
    } else if (view.getUint8(offset + 7) !== 0) fail(`record ${i}: unexpected assigned skill`);
    if (flags & SELECT) {
      const skill = BUTTON_SKILL[view.getUint8(offset + 8)];
      if (skill === undefined) fail(`record ${i}: selected button`);
      select(tick, skill);
    } else if (view.getUint8(offset + 8) !== 0) fail(`record ${i}: unexpected selected button`);
  }
  if (!events.some(event => event.kind === 'assign')) fail('no skill assignments');
  return { levelTitle: title, initialReleaseRate: target.initialReleaseRate, sourceLevelHash, events, replay: commands.join('&') };
}

/**
 * Run a candidate against a fresh game, rejecting any position mismatch, failed
 * assignment or loss. Consumes the game. The title and Lemmix hash are not a
 * byte-for-byte level-identity proof; pass the intended original level explicitly.
 */
export function verifyLemmixCandidate(game: Game, candidate: LemmixCandidate): { ok: true; replay: string } | { ok: false; reason: string } {
  const fail = (reason: string) => ({ ok: false as const, reason });
  if (game.getGameTimer().getGameTicks() !== 0 || game.getGameTimer().isRunning() || game.getCommandManager().serialize() !== '' || game.getGameState() !== GameStateTypes.RUNNING) return fail('game must be fresh and stopped');
  if (game.level.gameType !== GameTypes.LEMMINGS || game.level.name.trim() !== candidate.levelTitle || game.getVictoryCondition().getCurrentReleaseRate() !== candidate.initialReleaseRate) return fail('game level or starting release rate differs');
  if (game.getGameSkills().getSelectedSkill() !== SkillTypes.CLIMBER) return fail('unexpected initial selected skill');
  let next = 0;
  const timer = game.getGameTimer();
  const maxTicks = timer.getGameTimeLimit() + 1;
  while (timer.getGameTicks() < maxTicks && game.getGameState() === GameStateTypes.RUNNING) {
    const tick = timer.getGameTicks();
    while (next < candidate.events.length && candidate.events[next].tick === tick) {
      const event = candidate.events[next++];
      if (event.kind === 'select') {
        game.queueCommand(new CommandSelectSkill(event.skill));
        if (game.getGameSkills().getSelectedSkill() !== event.skill) return fail(`skill selection failed at tick ${tick}`);
      } else {
        const lemming = game.getLemmingManager().getLemming(event.id);
        if (!lemming || lemming.removed || lemming.x !== event.x || lemming.y !== event.y) return fail(`lemming ${event.id} position differs at tick ${tick}`);
        const count = game.getGameSkills().getSkill(event.skill);
        game.queueCommand(new CommandLemmingsAction(event.id));
        if (game.getGameSkills().getSkill(event.skill) !== count - 1) return fail(`skill assignment failed at tick ${tick}`);
      }
    }
    timer.tick();
  }
  if (next !== candidate.events.length) return fail('game ended before all replay actions');
  if (game.getGameState() !== GameStateTypes.SUCCEEDED) return fail('replay did not win');
  if (game.getCommandManager().serialize() !== candidate.replay) return fail('executed commands differ from candidate');
  return { ok: true, replay: candidate.replay };
}

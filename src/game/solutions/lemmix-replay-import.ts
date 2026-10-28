import { Game } from '../game';
import { GameStateTypes } from '../game-state-types';
import { GameTypes } from '../game-types';
import { CommandLemmingsAction } from '../game-play/commands/command-lemming-action';
import { CommandNuke } from '../game-play/commands/command-nuke';
import { CommandReleaseRateDecrease } from '../game-play/commands/command-release-rate-decrease';
import { CommandReleaseRateIncrease } from '../game-play/commands/command-release-rate-increase';
import { CommandSelectSkill } from '../game-play/commands/command-select-skill';
import { SkillTypes } from '../game-play/skill-types';
import { TriggerTypes } from '../resources/lemmings/trigger-types';

/**
 * A deliberately limited Lemmix replay importer for local research.
 * Lemmix's public Game.pas defines a 64-byte LRB header and 32-byte records:
 * https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L219
 * Source physics are not identical to this engine. Parsing only produces a
 * candidate; it must pass verifyLemmixCandidate on a fresh game before use.
 */
type Event =
  | { readonly tick: number; readonly kind: 'select'; readonly skill: SkillTypes }
  | { readonly tick: number; readonly kind: 'assign'; readonly skill: SkillTypes; readonly id: number; readonly x: number; readonly y: number }
  | { readonly tick: number; readonly kind: 'nuke' }
  | { readonly tick: number; readonly kind: 'rate'; readonly delta: number };

export interface LemmixCandidate {
  readonly levelTitle: string;
  readonly initialReleaseRate: number;
  readonly sourceLevelHash: string;
  readonly sourceVersion: 1 | 3;
  readonly events: readonly Event[];
  readonly replay: string;
}

// DOSORIG_MECHANICS, including Obsolete and TriggeredTrapLemmixBugSolved.
// These flags identify the replay's source rules, not proof that this engine
// implements each DOS quirk. Optional glitch and other game styles are rejected.
const DOS_ORIGINAL_MECHANICS = 0x03df;
// Version 1 predates the fixed triggered-trap animation mechanic.
const LEGACY_DOS_ORIGINAL_MECHANICS = 0x01df;
const HEADER_SIZE = 64;
const RECORD_SIZE = 32;
const SELECT = 0x40;
const ASSIGN = 0x80;
const NUKE = 0x100;
const START_PAUSE = 0x01;
const END_PAUSE = 0x02;
const PAUSING = 0x04;
const RATE_INCREASE = 0x08;
const RATE_DECREASE = 0x10;
const RATE_STOP = 0x20;
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

/** Parse a limited DOS-original v1 or v3 recording. This does not validate a solution. */
export function parseLemmixReplay(
  bytes: Uint8Array,
  target: { readonly levelTitle: string; readonly initialReleaseRate: number },
): LemmixCandidate {
  const fail = (message: string): never => { throw new Error(`Unsupported or invalid LRB: ${message}`); };
  if (!Number.isInteger(target.initialReleaseRate) || target.initialReleaseRate < 1 || target.initialReleaseRate > 99) fail('invalid target release rate');
  if (bytes.byteLength < HEADER_SIZE) fail('truncated header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] !== 0x4c || bytes[1] !== 0x52 || bytes[2] !== 0x42) fail('signature');
  const versionByte = view.getUint8(3);
  if (versionByte !== 1 && versionByte !== 3) fail('only versions 1 and 3 are supported');
  const sourceVersion: 1 | 3 = versionByte === 1 ? 1 : 3;
  if (view.getUint32(4, true) !== bytes.byteLength) fail('file size');
  if (view.getUint16(8, true) !== HEADER_SIZE || view.getUint32(12, true) !== HEADER_SIZE) fail('header layout');
  if (view.getUint16(10, true) !== (sourceVersion === 1 ? LEGACY_DOS_ORIGINAL_MECHANICS : DOS_ORIGINAL_MECHANICS)) fail('mechanics are not the supported DOS-original set');
  if (sourceVersion === 3 && (view.getUint8(16) !== 0 || view.getUint8(17) !== 0 || view.getInt32(28, true) !== 0)) fail('reserved header or pause-glitch data');
  const count = view.getUint16(18, true);
  if (count > 32768 || bytes.byteLength !== HEADER_SIZE + count * RECORD_SIZE) fail('record count or trailing data');
  const title = new TextDecoder('windows-1252').decode(bytes.subarray(32, 64)).replace(/\0+$/, '').trim();
  if (!title || title !== target.levelTitle.trim()) fail('level title does not match');
  const sourceLevelHash = sourceVersion === 3 ? view.getBigUint64(20, true).toString(16).padStart(16, '0') : '';
  const events: Event[] = [];
  const commands: string[] = [];
  let selected = SkillTypes.CLIMBER;
  let lastTick = 0;
  let releaseRate = target.initialReleaseRate;
  let heldRate: -1 | 0 | 1 = 0;
  let nuked = false;
  const changeRate = (tick: number, delta: number) => {
    if (!delta) return;
    events.push({ tick, kind: 'rate', delta });
    commands.push(`${tick}=${delta > 0 ? 'i' : 'd'}${Math.abs(delta)}`);
    releaseRate += delta;
  };
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
    // Lemmix adjusts a held button immediately before each simulation step;
    // actions recorded at iteration N run before the adjustment for N+1.
    // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L3421
    for (let step = lastTick; step < tick && heldRate !== 0; step++) {
      const next = Math.max(target.initialReleaseRate, Math.min(99, releaseRate + heldRate));
      if (next === releaseRate) break;
      changeRate(step, next - releaseRate);
    }
    lastTick = tick;
    const flags = view.getUint16(offset + 5, true);
    if (!flags || (flags & ~(SELECT | ASSIGN | NUKE | START_PAUSE | END_PAUSE | PAUSING | RATE_INCREASE | RATE_DECREASE | RATE_STOP))) fail(`record ${i}: unsupported action flags`);
    if (sourceVersion === 3 && (view.getUint8(offset + 29) !== 0 || view.getUint8(offset + 30) !== 0 || view.getUint8(offset + 31) !== 0)) fail(`record ${i}: glitch or reserved flags`);
    const rate = view.getInt32(offset + 9, true);
    if (rate < target.initialReleaseRate || rate > 99) fail(`record ${i}: invalid release rate`);
    // Pause annotations are ignored in Lemmix playback: actions still occur
    // at their recorded iterations, even if annotations are incomplete.
    // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L4390
    if (flags === START_PAUSE) {
      if (rate !== releaseRate) fail(`record ${i}: unexpected release-rate change`);
      continue;
    }
    if (flags === END_PAUSE) {
      if (rate !== releaseRate) fail(`record ${i}: unexpected release-rate change`);
      continue;
    }
    if (flags & (START_PAUSE | END_PAUSE)) fail(`record ${i}: combined pause boundary`);
    if (flags & NUKE) {
      // Standard Lemmix records a nuke independently; reject ambiguous
      // combinations and optional glitch mechanics instead of guessing.
      // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L4268
      if ((flags & ~(NUKE | PAUSING)) || rate !== releaseRate || view.getUint8(offset + 7) || view.getUint8(offset + 8)) fail(`record ${i}: unsupported nuke record`);
      // During playback Lemmix calls BtnNuke for each record; subsequent
      // standalone calls immediately return once the nuke is already active.
      // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L3987
      if (!nuked) {
        events.push({ tick, kind: 'nuke' });
        commands.push(`${tick}=n`);
        nuked = true;
      }
      continue;
    }
    const rateFlags = flags & (RATE_INCREASE | RATE_DECREASE | RATE_STOP);
    const pausedStop = !!(flags & PAUSING) && !!(rateFlags & RATE_STOP);
    if (rateFlags && !pausedStop && rateFlags !== RATE_INCREASE && rateFlags !== RATE_DECREASE && rateFlags !== RATE_STOP) fail(`record ${i}: unsupported release-rate flags`);
    if ((flags & PAUSING) && rateFlags && !pausedStop) fail(`record ${i}: incomplete paused release-rate change`);
    if (!(flags & (SELECT | ASSIGN)) && !rateFlags) fail(`record ${i}: no supported action`);
    if (!pausedStop && rate !== releaseRate) fail(`record ${i}: unexpected release-rate change`);
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
    if (rateFlags) {
      if (pausedStop) { changeRate(tick, rate - releaseRate); heldRate = 0; }
      else if (rateFlags === RATE_STOP) heldRate = 0;
      else heldRate = rateFlags === RATE_INCREASE ? 1 : -1;
    }
  }
  if (heldRate !== 0 && releaseRate !== (heldRate > 0 ? 99 : target.initialReleaseRate)) fail('release-rate hold has no recorded end');
  if (!events.some(event => event.kind === 'assign')) fail('no skill assignments');
  return { levelTitle: title, initialReleaseRate: target.initialReleaseRate, sourceLevelHash, sourceVersion, events, replay: commands.join('&') };
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
  // v1 starts a triggered trap one animation frame later than the fixed
  // mechanics. Until a trap activates, that difference has no effect.
  // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L2353
  const legacyTraps = candidate.sourceVersion === 1
    ? game.level.triggers.filter(trigger => trigger.getType() === TriggerTypes.TRAP) : [];
  const legacyTrapActivated = () => legacyTraps.some(trigger => trigger.getActivationCount() > 0);
  if (legacyTrapActivated()) return fail('legacy triggered-trap physics are unsupported');
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
      } else if (event.kind === 'rate') {
        const rate = game.getVictoryCondition().getCurrentReleaseRate();
        game.queueCommand(event.delta > 0 ? new CommandReleaseRateIncrease(event.delta) : new CommandReleaseRateDecrease(-event.delta));
        if (game.getVictoryCondition().getCurrentReleaseRate() !== rate + event.delta) return fail(`release-rate change failed at tick ${tick}`);
      } else if (event.kind === 'nuke') {
        if (game.getLemmingManager().isNuking()) return fail(`nuke already active at tick ${tick}`);
        game.queueCommand(new CommandNuke());
        if (!game.getLemmingManager().isNuking()) return fail(`nuke failed at tick ${tick}`);
      } else {
        const lemming = game.getLemmingManager().getLemming(event.id);
        if (!lemming || lemming.removed) return fail(`lemming ${event.id} is unavailable at tick ${tick}`);
        const count = game.getGameSkills().getSkill(event.skill);
        game.queueCommand(new CommandLemmingsAction(event.id));
        if (game.getGameSkills().getSkill(event.skill) !== count - 1) return fail(`skill assignment failed at tick ${tick}`);
        // Lemmix records positions after assignment. Becoming a miner moves
        // the lemming down one pixel as part of that transition.
        // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L4320
        if (lemming.x !== event.x || lemming.y !== event.y) return fail(`lemming ${event.id} position differs at tick ${tick}`);
      }
    }
    timer.tick();
    if (legacyTrapActivated()) return fail(`legacy triggered-trap physics are unsupported at tick ${timer.getGameTicks()}`);
  }
  if (next !== candidate.events.length) return fail('game ended before all replay actions');
  if (game.getGameState() !== GameStateTypes.SUCCEEDED) return fail('replay did not win');
  if (game.getCommandManager().serialize() !== candidate.replay) return fail('executed commands differ from candidate');
  return { ok: true, replay: candidate.replay };
}

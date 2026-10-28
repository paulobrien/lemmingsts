import { describe, expect, it } from 'vitest';
import type { Game } from '../../src/game/game';
import { GameStateTypes } from '../../src/game/game-state-types';
import { GameTypes } from '../../src/game/game-types';
import { SkillTypes } from '../../src/game/game-play/skill-types';
import { Trigger } from '../../src/game/game-play/trigger';
import { TriggerTypes } from '../../src/game/resources/lemmings/trigger-types';
import { parseLemmixReplay, verifyLemmixCandidate } from '../../src/game/solutions/lemmix-replay-import';

interface RecordData { tick: number; flags: number; assigned?: number; button?: number; rate?: number; id?: number; x?: number; y?: number; glitch?: number }
function lrb(records: RecordData[]): Uint8Array {
  const bytes = new Uint8Array(64 + records.length * 32);
  const view = new DataView(bytes.buffer);
  bytes.set([0x4c, 0x52, 0x42, 3]);
  view.setUint32(4, bytes.length, true); view.setUint16(8, 64, true);
  view.setUint16(10, 0x03df, true); view.setUint32(12, 64, true);
  view.setUint16(18, records.length, true); view.setBigUint64(20, 0x1234n, true);
  bytes.set(new TextEncoder().encode('Synthetic level'), 32);
  for (const [i, record] of records.entries()) {
    const p = 64 + i * 32;
    view.setUint8(p, 0x52); view.setInt32(p + 1, record.tick, true);
    view.setUint16(p + 5, record.flags, true); view.setUint8(p + 7, record.assigned ?? 0);
    view.setUint8(p + 8, record.button ?? 0); view.setInt32(p + 9, record.rate ?? 50, true);
    view.setInt32(p + 13, record.id ?? 0, true); view.setInt32(p + 17, record.x ?? 12, true);
    view.setInt32(p + 21, record.y ?? 34, true); view.setUint8(p + 29, record.glitch ?? 0);
  }
  return bytes;
}
const target = { levelTitle: 'Synthetic level', initialReleaseRate: 50 };

function fakeGame(x = 12, allowAssignment = true): Game {
  let ticks = 0, selected = SkillTypes.CLIMBER, remaining = 10, releaseRate = 50, nuking = false;
  const lemming = { x, y: 34, removed: false };
  const commands: string[] = [];
  const timer = { getGameTicks: () => ticks, getGameTimeLimit: () => 4, isRunning: () => false, tick: () => { ticks++; } };
  const skills = { getSelectedSkill: () => selected, getSkill: () => remaining };
  return {
    level: { name: 'Synthetic level', gameType: GameTypes.LEMMINGS, triggers: [] },
    getGameTimer: () => timer,
    getGameState: () => ticks >= 3 ? GameStateTypes.SUCCEEDED : GameStateTypes.RUNNING,
    getGameSkills: () => skills,
    getVictoryCondition: () => ({ getCurrentReleaseRate: () => releaseRate }),
    getLemmingManager: () => ({ getLemming: () => lemming, isNuking: () => nuking }),
    getCommandManager: () => ({ serialize: () => commands.join('&') }),
    queueCommand: (command: { getCommandKey(): string; save(): number[] }) => {
      const key = command.getCommandKey(), value = command.save()[0];
      if (key === 's' && selected !== value) { selected = value; commands.push(`${ticks}=s${value}`); }
      if (key === 'l' && allowAssignment) {
        remaining--;
        if (selected === SkillTypes.MINER) lemming.y++;
        commands.push(`${ticks}=l${value}`);
      }
      if (key === 'i') { releaseRate += value; commands.push(`${ticks}=i${value}`); }
      if (key === 'd') { releaseRate -= value; commands.push(`${ticks}=d${value}`); }
      if (key === 'n' && !nuking) { nuking = true; commands.push(`${ticks}=n`); }
    },
  } as unknown as Game;
}

describe('Lemmix replay conversion (synthetic inputs)', () => {
  it('converts a DOS-original skill record and verifies it against a fresh game', () => {
    const candidate = parseLemmixReplay(lrb([{ tick: 1, flags: 0x80, assigned: 3 }]), target);
    expect(candidate.replay).toBe('1=s8&1=l0');
    expect(candidate.sourceLevelHash).toBe('0000000000001234');
    expect(verifyLemmixCandidate(fakeGame(), candidate)).toEqual({ ok: true, replay: '1=s8&1=l0' });
  });

  it('preserves the ordering of button selections and implicit assignment selections', () => {
    const candidate = parseLemmixReplay(lrb([
      { tick: 0, flags: 0x40, button: 7 },
      { tick: 1, flags: 0xc0, assigned: 3, button: 4 },
    ]), target);
    expect(candidate.replay).toBe('0=s5&1=s8&1=l0&1=s2');
    expect(verifyLemmixCandidate(fakeGame(), candidate)).toEqual({ ok: true, replay: candidate.replay });
  });

  it('rejects simulation if the recorded position differs or the action fails', () => {
    const candidate = parseLemmixReplay(lrb([{ tick: 1, flags: 0x80, assigned: 3 }]), target);
    expect(verifyLemmixCandidate(fakeGame(13), candidate)).toEqual({ ok: false, reason: 'lemming 0 position differs at tick 1' });
    expect(verifyLemmixCandidate(fakeGame(12, false), candidate)).toEqual({ ok: false, reason: 'skill assignment failed at tick 1' });
  });

  it('converts and verifies a standard nuke after an assignment', () => {
    const candidate = parseLemmixReplay(lrb([
      { tick: 1, flags: 0x80, assigned: 3 },
      { tick: 2, flags: 0x104 },
    ]), target);
    expect(candidate.replay).toBe('1=s8&1=l0&2=n');
    expect(verifyLemmixCandidate(fakeGame(), candidate)).toEqual({ ok: true, replay: candidate.replay });
  });

  it('rejects duplicate nukes and nuke-percentage glitch mechanics', () => {
    expect(() => parseLemmixReplay(lrb([
      { tick: 1, flags: 0x80, assigned: 3 },
      { tick: 2, flags: 0x100 }, { tick: 2, flags: 0x100 },
    ]), target)).toThrow('unsupported nuke record');
    const bytes = lrb([{ tick: 1, flags: 0x80, assigned: 3 }, { tick: 2, flags: 0x100 }]);
    new DataView(bytes.buffer).setUint16(10, 0x07df, true);
    expect(() => parseLemmixReplay(bytes, target)).toThrow('mechanics');
  });

  it('compares a miner position after the one-pixel assignment transition', () => {
    const candidate = parseLemmixReplay(lrb([{ tick: 1, flags: 0x80, assigned: 9, y: 35 }]), target);
    expect(verifyLemmixCandidate(fakeGame(), candidate)).toEqual({ ok: true, replay: candidate.replay });
    const wrongPosition = parseLemmixReplay(lrb([{ tick: 1, flags: 0x80, assigned: 9, y: 34 }]), target);
    expect(verifyLemmixCandidate(fakeGame(), wrongPosition)).toEqual({ ok: false, reason: 'lemming 0 position differs at tick 1' });
  });

  it('translates paired pauses and a paused instantaneous v1 rate change', () => {
    const bytes = lrb([
      { tick: 0, flags: 1 },
      { tick: 0, flags: 0x2c, rate: 99 },
      { tick: 0, flags: 2, rate: 99 },
      { tick: 1, flags: 0x80, assigned: 3, rate: 99 },
    ]);
    bytes[3] = 1;
    new DataView(bytes.buffer).setUint16(10, 0x01df, true);
    bytes[16] = 64; // v1's old, unreliable record-size field
    bytes[64 + 29] = 245; // v1 does not define v3's glitch flags
    const candidate = parseLemmixReplay(bytes, target);
    expect(candidate.sourceVersion).toBe(1);
    expect(candidate.replay).toBe('0=i49&1=s8&1=l0');
    expect(verifyLemmixCandidate(fakeGame(), candidate)).toEqual({ ok: true, replay: candidate.replay });
  });

  it('expands a held rate button before each following simulation step, including the stop boundary', () => {
    const candidate = parseLemmixReplay(lrb([
      { tick: 0, flags: 0x08 },
      { tick: 1, flags: 0x80, assigned: 3, rate: 51 },
      { tick: 2, flags: 0x20, rate: 52 },
    ]), target);
    expect(candidate.replay).toBe('0=i1&1=s8&1=l0&1=i1');
    expect(verifyLemmixCandidate(fakeGame(), candidate)).toEqual({ ok: true, replay: candidate.replay });
  });

  it('clamps held changes and supports a paused record combining both directions', () => {
    const candidate = parseLemmixReplay(lrb([
      { tick: 0, flags: 0x01 },
      { tick: 0, flags: 0x3c, rate: 98 },
      { tick: 0, flags: 0x02, rate: 98 },
      { tick: 0, flags: 0x08, rate: 98 },
      { tick: 3, flags: 0x20, rate: 99 },
      { tick: 3, flags: 0x80, assigned: 3, rate: 99 },
    ]), target);
    expect(candidate.replay).toBe('0=i48&0=i1&3=s8&3=l0');
  });

  it('expands held decreases and can reverse direction at a record boundary', () => {
    const candidate = parseLemmixReplay(lrb([
      { tick: 0, flags: 1 }, { tick: 0, flags: 0x2c, rate: 53 }, { tick: 0, flags: 2, rate: 53 },
      { tick: 0, flags: 0x10, rate: 53 },
      { tick: 2, flags: 0x08, rate: 51 },
      { tick: 3, flags: 0x20, rate: 52 },
      { tick: 3, flags: 0x80, assigned: 3, rate: 52 },
    ]), target);
    expect(candidate.replay).toBe('0=i3&0=d1&1=d1&2=i1&3=s8&3=l0');
  });

  it('rejects held records whose stored rate disagrees with frame-by-frame changes', () => {
    expect(() => parseLemmixReplay(lrb([
      { tick: 0, flags: 0x08 },
      { tick: 2, flags: 0x20, rate: 51 },
      { tick: 2, flags: 0x80, assigned: 3, rate: 51 },
    ]), target)).toThrow('unexpected release-rate change');
  });

  it('rejects an unfinished hold whose future changes cannot be represented', () => {
    expect(() => parseLemmixReplay(lrb([
      { tick: 0, flags: 0x08 },
      { tick: 1, flags: 0x80, assigned: 3, rate: 51 },
    ]), target)).toThrow('hold has no recorded end');
  });

  it('allows legacy candidates past dormant traps and rejects an activated trap', () => {
    const bytes = lrb([{ tick: 1, flags: 0x80, assigned: 3 }]);
    bytes[3] = 1;
    new DataView(bytes.buffer).setUint16(10, 0x01df, true);
    const candidate = parseLemmixReplay(bytes, target);
    const game = fakeGame();
    const trap = new Trigger(TriggerTypes.TRAP, 1, 1, 3, 3, 5);
    game.level.triggers = [trap];
    expect(trap.trigger(0, 0, 0)).toBe(TriggerTypes.NO_TRIGGER);
    expect(verifyLemmixCandidate(game, candidate)).toEqual({ ok: true, replay: candidate.replay });

    const activatedGame = fakeGame();
    const activatedTrap = new Trigger(TriggerTypes.TRAP, 1, 1, 3, 3, 5);
    activatedGame.level.triggers = [activatedTrap];
    const timer = activatedGame.getGameTimer(), advance = timer.tick.bind(timer);
    timer.tick = () => { advance(); if (timer.getGameTicks() === 3) activatedTrap.trigger(2, 2, 3); };
    expect(verifyLemmixCandidate(activatedGame, candidate)).toEqual({ ok: false, reason: 'legacy triggered-trap physics are unsupported at tick 3' });
  });

  it.each([
    ['pause', { tick: 1, flags: 0x81, assigned: 3 }],
    ['nuke', { tick: 1, flags: 0x180, assigned: 3 }],
    ['rate change', { tick: 1, flags: 0x80, assigned: 3, rate: 51 }],
    ['right-click glitch', { tick: 1, flags: 0x80, assigned: 3, glitch: 2 }],
    ['unassignable skill', { tick: 1, flags: 0x80, assigned: 12 }],
  ])('rejects unsupported %s', (_name, record) => {
    expect(() => parseLemmixReplay(lrb([record]), target)).toThrow('Unsupported or invalid LRB');
  });

  it('replays actions across multi-iteration and final unclosed pauses', () => {
    const bytes = lrb([
      { tick: 0, flags: 1 }, { tick: 1, flags: 0x84, assigned: 3 },
      { tick: 2, flags: 2 },
    ]);
    bytes[3] = 1;
    new DataView(bytes.buffer).setUint16(10, 0x01df, true);
    const candidate = parseLemmixReplay(bytes, target);
    expect(candidate.replay).toBe('1=s8&1=l0');
    expect(verifyLemmixCandidate(fakeGame(), candidate)).toEqual({ ok: true, replay: candidate.replay });

    const unclosed = lrb([{ tick: 0, flags: 1 }, { tick: 1, flags: 0x84, assigned: 3 }]);
    expect(parseLemmixReplay(unclosed, target).replay).toBe('1=s8&1=l0');
  });

  it('ignores incomplete pause annotations because Lemmix playback ignores them', () => {
    const candidate = parseLemmixReplay(lrb([
      { tick: 0, flags: 2 }, { tick: 1, flags: 0x84, assigned: 3 },
      { tick: 2, flags: 1 },
    ]), target);
    expect(candidate.replay).toBe('1=s8&1=l0');
    expect(verifyLemmixCandidate(fakeGame(), candidate)).toEqual({ ok: true, replay: candidate.replay });
  });

  it('rejects mismatched levels, versions, physics and malformed lengths', () => {
    const bytes = lrb([{ tick: 1, flags: 0x80, assigned: 3 }]);
    expect(() => parseLemmixReplay(bytes, { ...target, levelTitle: 'Different' })).toThrow('level title');
    const unsupported = bytes.slice(); unsupported[3] = 2;
    expect(() => parseLemmixReplay(unsupported, target)).toThrow('versions 1 and 3');
    const physics = bytes.slice(); new DataView(physics.buffer).setUint16(10, 0, true);
    expect(() => parseLemmixReplay(physics, target)).toThrow('mechanics');
    expect(() => parseLemmixReplay(bytes.slice(0, -1), target)).toThrow('file size');
  });

  it('rejects records in decreasing tick order', () => {
    expect(() => parseLemmixReplay(lrb([
      { tick: 2, flags: 0x80, assigned: 3 }, { tick: 1, flags: 0x80, assigned: 3 },
    ]), target)).toThrow('iteration order');
  });
});

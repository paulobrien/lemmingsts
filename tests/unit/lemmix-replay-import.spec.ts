import { describe, expect, it } from 'vitest';
import type { Game } from '../../src/game/game';
import { GameStateTypes } from '../../src/game/game-state-types';
import { GameTypes } from '../../src/game/game-types';
import { SkillTypes } from '../../src/game/game-play/skill-types';
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
  let ticks = 0, selected = SkillTypes.CLIMBER, remaining = 10;
  const commands: string[] = [];
  const timer = { getGameTicks: () => ticks, getGameTimeLimit: () => 4, isRunning: () => false, tick: () => { ticks++; } };
  const skills = { getSelectedSkill: () => selected, getSkill: () => remaining };
  return {
    level: { name: 'Synthetic level', gameType: GameTypes.LEMMINGS },
    getGameTimer: () => timer,
    getGameState: () => ticks >= 3 ? GameStateTypes.SUCCEEDED : GameStateTypes.RUNNING,
    getGameSkills: () => skills,
    getVictoryCondition: () => ({ getCurrentReleaseRate: () => 50 }),
    getLemmingManager: () => ({ getLemming: () => ({ x, y: 34, removed: false }) }),
    getCommandManager: () => ({ serialize: () => commands.join('&') }),
    queueCommand: (command: { getCommandKey(): string; save(): number[] }) => {
      const key = command.getCommandKey(), value = command.save()[0];
      if (key === 's' && selected !== value) { selected = value; commands.push(`${ticks}=s${value}`); }
      if (key === 'l' && allowAssignment) { remaining--; commands.push(`${ticks}=l${value}`); }
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

  it.each([
    ['pause', { tick: 1, flags: 0x81, assigned: 3 }],
    ['nuke', { tick: 1, flags: 0x180, assigned: 3 }],
    ['rate change', { tick: 1, flags: 0x80, assigned: 3, rate: 51 }],
    ['right-click glitch', { tick: 1, flags: 0x80, assigned: 3, glitch: 2 }],
    ['unassignable skill', { tick: 1, flags: 0x80, assigned: 12 }],
  ])('rejects unsupported %s', (_name, record) => {
    expect(() => parseLemmixReplay(lrb([record]), target)).toThrow('Unsupported or invalid LRB');
  });

  it('rejects mismatched levels, versions, physics and malformed lengths', () => {
    const bytes = lrb([{ tick: 1, flags: 0x80, assigned: 3 }]);
    expect(() => parseLemmixReplay(bytes, { ...target, levelTitle: 'Different' })).toThrow('level title');
    const old = bytes.slice(); old[3] = 1;
    expect(() => parseLemmixReplay(old, target)).toThrow('version 3');
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

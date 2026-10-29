import { describe, expect, it, vi } from 'vitest';
import { Game } from '../../src/game/game';
import { CommandManager } from '../../src/game/game-play/commands/command-manager';
import { CommandLemmingsAction } from '../../src/game/game-play/commands/command-lemming-action';
import { CommandSelectSkill } from '../../src/game/game-play/commands/command-select-skill';
import { GameTimer } from '../../src/game/game-play/game-timer';
import { SkillTypes } from '../../src/game/game-play/skill-types';
import { Level } from '../../src/game/resources/level';

function setup() {
    const actions: string[] = [];
    let selectedSkill = SkillTypes.CLIMBER;
    const skills = {
        getSelectedSkill: () => selectedSkill,
        setSelectedSkill: (value: SkillTypes) => { selectedSkill = value; actions.push(`select:${value}`); return true; },
        canDecreaseSkill: () => true,
        decreaseSkill: () => true,
    };
    const manager = {
        getLemming: (id: number) => ({ id }),
        doLemmingAction: (lemming: { id: number }, skill: SkillTypes) => {
            actions.push(`assign:${lemming.id}:${skill}`); return true;
        },
    };
    const sound = { trigger: vi.fn() };
    const game = { getGameSkills: () => skills, getLemmingManager: () => manager, onSoundEffect: sound } as unknown as Game;
    const timer = new GameTimer({ timeLimit: 5 } as Level);
    return { timer, actions, sound, commands: new CommandManager(game, timer) };
}

describe('replay commands', () => {
    it('records and replays all commands at tick zero in order', () => {
        const original = setup();
        original.commands.queueCommand(new CommandSelectSkill(SkillTypes.BUILDER));
        original.commands.queueCommand(new CommandLemmingsAction(7));
        expect(original.actions).toEqual(['select:5', 'assign:7:5']);
        expect(original.sound.trigger).toHaveBeenCalledWith(0);
        expect(original.sound.trigger).toHaveBeenCalledWith(3);
        expect(original.commands.serialize()).toBe('0=s5&0=l7');

        const playback = setup();
        playback.commands.loadReplay(original.commands.serialize());
        playback.timer.tick();
        expect(playback.actions).toEqual(original.actions);
        expect(playback.commands.serialize()).toBe('0=s5&0=l7');
    });

    it('accepts legacy strings and repeated ticks while rejecting invalid tick values', () => {
        const playback = setup();
        playback.commands.loadReplay('garbage=s2&-1=s2&1.5=s2&1=s5&1=l7&2=s8');
        playback.timer.tick();
        expect(playback.actions).toEqual([]);
        playback.timer.tick();
        expect(playback.actions).toEqual(['select:5', 'assign:7:5']);
        playback.timer.tick();
        expect(playback.actions).toEqual(['select:5', 'assign:7:5', 'select:8']);
    });

    it('replaces previously loaded replay commands', () => {
        const playback = setup();
        playback.commands.loadReplay('0=s5');
        playback.commands.loadReplay('0=s8');
        playback.timer.tick();
        expect(playback.actions).toEqual(['select:8']);
    });

    it('only records commands that actually execute', () => {
        const playback = setup();
        const failed = { getCommandKey: () => 's', save: () => [5], load: vi.fn(), execute: () => false };
        playback.commands.queueCommand(failed);
        expect(playback.commands.serialize()).toBe('');
    });
});

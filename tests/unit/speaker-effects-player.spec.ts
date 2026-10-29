import { describe, expect, it, vi } from 'vitest';
import { SoundEffect } from '../../src/game/game-play/sound-effects';
import { SpeakerEffectsPlayer } from '../../src/game/resources/sound/speaker-effects-player';

function audioContext() {
    const oscillators: Array<{ type: string; frequency: { setValueAtTime: ReturnType<typeof vi.fn> }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended: (() => void) | null }> = [];
    const gains: Array<{ gain: { setValueAtTime: ReturnType<typeof vi.fn> }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
    const context = {
        currentTime: 10, state: 'suspended', destination: {}, resume: vi.fn(async () => {}), close: vi.fn(async () => {}),
        createOscillator: vi.fn(() => {
            const oscillator = { type: '', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null };
            oscillators.push(oscillator);
            return oscillator;
        }),
        createGain: vi.fn(() => {
            const gain = { gain: { setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
            gains.push(gain);
            return gain;
        }),
    };
    return { context, oscillators, gains };
}

describe('speaker effect lifecycle', () => {
    it('schedules a finite square wave and disconnects its nodes on completion', () => {
        const { context, oscillators, gains } = audioContext();
        const player = new SpeakerEffectsPlayer(() => context as unknown as AudioContext);
        player.play(SoundEffect.Digger);
        expect(oscillators[0].type).toBe('square');
        expect(oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(110, 10);
        expect(oscillators[0].stop).toHaveBeenCalledWith(10.055);
        expect(gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0, 10.055);
        expect(context.resume).toHaveBeenCalledOnce();
        oscillators[0].onended?.();
        expect(oscillators[0].disconnect).toHaveBeenCalledOnce();
        expect(gains[0].disconnect).toHaveBeenCalledOnce();
        player.stop();
        expect(context.close).toHaveBeenCalledOnce();
    });

    it('replaces regular cues, preserves a nuke alert, and stops immediately', () => {
        const { context, oscillators, gains } = audioContext();
        const player = new SpeakerEffectsPlayer(() => context as unknown as AudioContext);
        player.play(SoundEffect.Basher);
        player.play(SoundEffect.Miner);
        expect(oscillators[0].stop).toHaveBeenCalledTimes(2);
        expect(oscillators[0].disconnect).toHaveBeenCalledOnce();
        player.play(SoundEffect.Nuke);
        expect(oscillators[2].frequency.setValueAtTime).toHaveBeenCalledTimes(4);
        player.play(SoundEffect.Digger);
        expect(oscillators).toHaveLength(3);
        player.stop();
        expect(oscillators[2].stop).toHaveBeenCalledTimes(2);
        expect(gains[2].disconnect).toHaveBeenCalledOnce();
        expect(context.close).toHaveBeenCalledOnce();
        player.stop();
        expect(context.close).toHaveBeenCalledOnce();
    });
});

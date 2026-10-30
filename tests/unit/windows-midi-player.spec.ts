import { describe, expect, it, vi } from 'vitest';
import { WindowsMidiPlayer, WINDOWS_MIDI_TRACKS } from '../../src/game/resources/sound/windows-midi-player';
import { validateWindowsMidi } from '../../src/game/resources/sound/windows-midi-validation';

// Small synthetic SMF: one note-on, a delayed note-off and end-of-track.
function midi(): ArrayBuffer {
    return new Uint8Array([
        0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
        0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 12,
        0, 0x90, 60, 100, 48, 0x80, 60, 0, 0, 0xff, 0x2f, 0,
    ]).buffer;
}

function fixture() {
    const context = { state: 'running' as AudioContextState, resume: vi.fn(async () => {}), suspend: vi.fn(async () => {}) };
    const synth = { getAudioContext: vi.fn(() => context as unknown as AudioContext), setLoop: vi.fn(), loadMIDI: vi.fn(), playMIDI: vi.fn(), stopMIDI: vi.fn() };
    return { context, synth };
}

describe('Windows MIDI validation', () => {
    it('accepts a bounded SMF with audible notes and a terminating track', () => {
        expect(validateWindowsMidi(midi())).toBe(true);
        expect(WINDOWS_MIDI_TRACKS).toHaveLength(15);
    });

    it('rejects malformed and incomplete tracks before the third-party parser', () => {
        const truncated = midi().slice(0, 28);
        const noTerminator = new Uint8Array(midi()); noTerminator[32] = 1;
        const zeroDuration = new Uint8Array(midi()); zeroDuration[26] = 0;
        const badDivision = new Uint8Array(midi()); badDivision[12] = 0x80;
        const huge = new ArrayBuffer(1024 * 1024 + 1);
        for (const bytes of [truncated, noTerminator.buffer, zeroDuration.buffer, badDivision.buffer, huge]) {
            expect(validateWindowsMidi(bytes)).toBe(false);
        }
    });
});

describe('Windows MIDI playback', () => {
    it('loads once, loops and resumes after pause, and stops cleanly', async () => {
        const { context, synth } = fixture();
        const load = vi.fn(async () => midi());
        const player = new WindowsMidiPlayer(load, () => synth);
        expect(await player.play()).toBe(true);
        expect(synth.loadMIDI).toHaveBeenCalledOnce();
        expect(synth.setLoop).toHaveBeenCalledWith(1);
        player.suspend();
        expect(synth.stopMIDI).toHaveBeenCalledOnce();
        expect(context.suspend).toHaveBeenCalledOnce();
        expect(await player.play()).toBe(true);
        expect(load).toHaveBeenCalledOnce();
        expect(synth.playMIDI).toHaveBeenCalledTimes(2);
        player.stop();
    });

    it('does not decode missing or malformed files and allows AdLib fallback', async () => {
        const { synth } = fixture();
        const missing = new WindowsMidiPlayer(async () => null, () => synth);
        expect(await missing.play()).toBe(false);
        missing.stop();
        const bad = new WindowsMidiPlayer(async () => new ArrayBuffer(32), () => synth);
        expect(await bad.play()).toBe(false);
        expect(synth.loadMIDI).not.toHaveBeenCalled();
        bad.stop();
    });

    it('discards a late track after pause, teardown or a newer player', async () => {
        const { synth } = fixture();
        let release!: (data: ArrayBuffer | null) => void;
        const player = new WindowsMidiPlayer(() => new Promise(resolve => { release = resolve; }), () => synth);
        const pending = player.play();
        player.stop();
        release(midi());
        expect(await pending).toBe(false);
        expect(synth.loadMIDI).not.toHaveBeenCalled();
        const old = new WindowsMidiPlayer(() => new Promise(resolve => { release = resolve; }), () => synth);
        const stale = old.play();
        const next = new WindowsMidiPlayer(async () => midi(), () => synth);
        expect(await next.play()).toBe(true);
        old.stop();
        release(midi());
        expect(await stale).toBe(false);
        expect(synth.loadMIDI).toHaveBeenCalledOnce();
        expect(synth.playMIDI).toHaveBeenCalledOnce();
        next.stop();
    });
});

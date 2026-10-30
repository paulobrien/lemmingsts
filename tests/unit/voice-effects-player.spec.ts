import { describe, expect, it, vi } from 'vitest';
import { SoundEffect } from '../../src/game/game-play/sound-effects';
import { VoiceEffectsPlayer, type VoiceFileName } from '../../src/game/resources/sound/voice-effects-player';

function audio() {
    const sources: Array<{ buffer: AudioBuffer | null; onended: (() => void) | null; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
    const buffer = {} as AudioBuffer;
    const context = {
        state: 'running' as AudioContextState,
        destination: {},
        resume: vi.fn(async () => {}), close: vi.fn(async () => {}),
        decodeAudioData: vi.fn(async () => buffer),
        createBufferSource: vi.fn(() => {
            const source = { buffer: null, onended: null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
            sources.push(source);
            return source;
        }),
    };
    return { context, sources, buffer };
}

describe('locally supplied voice effects', () => {
    it('maps the three sound events to WAVs and reuses decoded audio', async () => {
        const { context, sources, buffer } = audio();
        const load = vi.fn(async (_name: VoiceFileName) => new Uint8Array(100));
        const player = new VoiceEffectsPlayer(load, () => context as unknown as AudioContext);
        expect(await player.play(SoundEffect.LetsGo)).toBe(true);
        expect(await player.play(SoundEffect.OhNo)).toBe(true);
        expect(await player.play(SoundEffect.Exit)).toBe(true);
        expect(await player.play(SoundEffect.Exit)).toBe(true);
        expect(load.mock.calls.map(([name]) => name)).toEqual(['LETSGO.WAV', 'OHNO.WAV', 'YIPPEE.WAV']);
        expect(context.decodeAudioData).toHaveBeenCalledTimes(3);
        expect(sources).toHaveLength(4);
        expect(sources[0].stop).toHaveBeenCalledOnce();
        expect(sources[3].buffer).toBe(buffer);
        expect(sources[3].start).toHaveBeenCalledOnce();
        player.stop();
        expect(sources[3].stop).toHaveBeenCalledOnce();
        expect(context.close).toHaveBeenCalledOnce();
    });

    it('falls back for unmapped, absent, oversized, malformed or unavailable voices', async () => {
        const { context } = audio();
        const load = vi.fn(async () => null as Uint8Array | null);
        const player = new VoiceEffectsPlayer(load, () => context as unknown as AudioContext);
        expect(await player.play(999)).toBe(false);
        expect(load).not.toHaveBeenCalled();
        expect(await player.play(SoundEffect.LetsGo)).toBe(false);
        player.stop();
        const oversized = new VoiceEffectsPlayer(async () => new Uint8Array(1024 * 1024 + 1), () => context as unknown as AudioContext);
        expect(await oversized.play(SoundEffect.LetsGo)).toBe(false);
        expect(context.decodeAudioData).not.toHaveBeenCalled();
        const malformed = new VoiceEffectsPlayer(async () => new Uint8Array(100), () => context as unknown as AudioContext);
        context.decodeAudioData.mockRejectedValueOnce(new Error('bad WAV'));
        expect(await malformed.play(SoundEffect.LetsGo)).toBe(false);
        const blocked = new VoiceEffectsPlayer(async () => new Uint8Array(100), () => { throw new Error('unavailable'); });
        expect(await blocked.play(SoundEffect.LetsGo)).toBe(false);
    });

    it('does not start a voice after stop or a newer sound', async () => {
        const { context, sources } = audio();
        let release!: (bytes: Uint8Array | null) => void;
        const player = new VoiceEffectsPlayer(() => new Promise(resolve => { release = resolve; }), () => context as unknown as AudioContext);
        const pending = player.play(SoundEffect.LetsGo);
        player.cancel();
        release(new Uint8Array(100));
        expect(await pending).toBe(false);
        expect(sources).toHaveLength(0);
        const later = player.play(SoundEffect.OhNo);
        player.stop();
        release(new Uint8Array(100));
        expect(await later).toBe(false);
        expect(sources).toHaveLength(0);
    });

    it('primes a suspended context when called from a gesture and closes it on stop', () => {
        const { context } = audio();
        context.state = 'suspended';
        const player = new VoiceEffectsPlayer(async () => null, () => context as unknown as AudioContext);
        expect(player.prime()).toBe(true);
        expect(context.resume).toHaveBeenCalledOnce();
        player.stop();
        expect(context.close).toHaveBeenCalledOnce();
    });
});

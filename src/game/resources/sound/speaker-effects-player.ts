import { SoundEffect } from '../../game-play/sound-effects';

// These short square-wave cues are approximations, not decoded DOS samples.
// The original digging and nuke effects used the PC speaker, separate from
// ADLIB.DAT. Compare https://github.com/Eric-Lautanen/lemmings/blob/main/game.js
const patterns: Partial<Record<SoundEffect, readonly [number, number][]>> = {
    [SoundEffect.Digger]: [[110, 0.055]],
    [SoundEffect.Basher]: [[210, 0.060]],
    [SoundEffect.Miner]: [[340, 0.045]],
    [SoundEffect.Nuke]: [[880, 0.12], [660, 0.12], [880, 0.12], [660, 0.16]],
};

/** A separate, monophonic, finite PC-speaker-inspired effects channel. */
export class SpeakerEffectsPlayer {
    private context: AudioContext | null = null;
    private current: { oscillator: OscillatorNode; gain: GainNode } | null = null;
    private nukeUntil = 0;

    constructor(private readonly createContext: () => AudioContext = () => new AudioContext()) {}

    public play(effect: SoundEffect): void {
        const pattern = patterns[effect];
        if (!pattern) return;
        const context = this.context ?? (this.context = this.createContext());
        const now = context.currentTime;
        // Do not let frequent digging cues cut the short nuke alert off.
        if (effect !== SoundEffect.Nuke && now < this.nukeUntil) return;
        this.stopCurrent();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'square';
        oscillator.connect(gain);
        gain.connect(context.destination);
        let end = now;
        for (const [frequency, duration] of pattern) {
            oscillator.frequency.setValueAtTime(frequency, end);
            end += duration;
        }
        gain.gain.setValueAtTime(0.035, now);
        gain.gain.setValueAtTime(0, end);
        const current = { oscillator, gain };
        this.current = current;
        oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
            if (this.current === current) this.current = null;
        };
        if (effect === SoundEffect.Nuke) this.nukeUntil = end;
        oscillator.start(now);
        oscillator.stop(end);
        if (context.state === 'suspended') void context.resume().catch(() => {});
    }

    private stopCurrent(): void {
        const current = this.current;
        this.current = null;
        if (!current) return;
        current.oscillator.onended = null;
        try { current.oscillator.stop(); } catch { /* already stopped */ }
        current.oscillator.disconnect();
        current.gain.disconnect();
    }

    public stop(): void {
        this.stopCurrent();
        const context = this.context;
        this.context = null;
        this.nukeUntil = 0;
        if (context) void context.close().catch(() => {});
    }
}

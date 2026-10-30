import { SoundEffect } from '../../game-play/sound-effects';

/** Filenames in the player's own Windows Lemmings sound directory. */
export type VoiceFileName = string;

const voices: Partial<Record<number, VoiceFileName>> = {
    [SoundEffect.LetsGo]: 'LETSGO.WAV',
    [SoundEffect.OhNo]: 'OHNO.WAV',
    [SoundEffect.Exit]: 'YIPPEE.WAV',
    [SoundEffect.Entrance]: 'DOOR.WAV',
    [SoundEffect.Splat]: 'SPLAT.WAV',
    [SoundEffect.Steel]: 'CHINK.WAV',
    [SoundEffect.Explosion]: 'EXPLODE.WAV',
    [SoundEffect.Fire]: 'FIRE.WAV',
    [SoundEffect.Drowning]: 'GLUG.WAV',
};

/** Plays locally supplied sampled voices, falling back to the caller's normal effects on failure. */
export class VoiceEffectsPlayer {
    private context: AudioContext | null = null;
    private current: AudioBufferSourceNode | null = null;
    private generation = 0;
    private readonly buffers = new Map<VoiceFileName, Promise<AudioBuffer | null>>();

    constructor(
        private readonly load: (name: VoiceFileName) => Promise<Uint8Array | null>,
        private readonly createContext: () => AudioContext = () => new AudioContext(),
    ) {}

    /** Call directly from a player gesture so browsers can enable audio. */
    public prime(): boolean {
        try {
            const context = this.context ?? (this.context = this.createContext());
            if (context.state === 'suspended') void context.resume().catch(() => {});
            return context.state !== 'closed';
        } catch {
            return false;
        }
    }

    /** Invalidate a pending voice and stop the current one without closing the context. */
    public cancel(): void {
        this.generation++;
        const source = this.current;
        this.current = null;
        if (!source) return;
        source.onended = null;
        try { source.stop(); } catch { /* already stopped */ }
        source.disconnect();
    }

    /** Returns false when no voice could be played, so the caller can use the AdLib cue. */
    public async play(effect: number): Promise<boolean> {
        const name = voices[effect];
        if (!name) return false;
        this.cancel();
        const generation = this.generation;
        if (!this.prime()) return false;
        const context = this.context!;
        try {
            let pending = this.buffers.get(name);
            if (!pending) {
                pending = this.load(name).then(bytes => {
                    // Bound allocation and pass a copy because decodeAudioData may detach its input.
                    if (!bytes || bytes.length < 44 || bytes.length > 1024 * 1024) return null;
                    return context.decodeAudioData(Uint8Array.from(bytes).buffer);
                }).catch(() => null);
                this.buffers.set(name, pending);
            }
            const buffer = await pending;
            if (!buffer || generation !== this.generation || context !== this.context || context.state === 'closed') return false;
            if (context.state === 'suspended') await context.resume();
            if (generation !== this.generation || context !== this.context || context.state !== 'running') return false;
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.onended = () => {
                source.disconnect();
                if (this.current === source) this.current = null;
            };
            this.current = source;
            source.start();
            return true;
        } catch {
            if (generation === this.generation && context === this.context) this.cancel();
            return false;
        }
    }

    public stop(): void {
        this.cancel();
        const context = this.context;
        this.context = null;
        this.buffers.clear();
        if (context) void context.close().catch(() => {});
    }
}

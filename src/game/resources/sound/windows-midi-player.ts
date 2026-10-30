import TinySynth from 'webaudio-tinysynth';
import { validateWindowsMidi } from './windows-midi-validation';

/** Windows Lemmings MIDI names in the order listed by the Windows executable.
 * Cycling these is a convenient fallback; the original level-to-track mapping
 * has not been established.
 */
export const WINDOWS_MIDI_TRACKS = [
    'CANCANP.MID', 'LEMMIN1P.MID', 'LEMMIN2P.MID', 'LEMMIN3P.MID',
    'MOUNTAIP.MID', 'TENLEMSP.MID', 'TIM1P.MID', 'TIM2P.MID',
    'TIM3P.MID', 'TIM4P.MID', 'TIM5P.MID', 'TIM6P.MID',
    'TIM7P.MID', 'TIM8P.MID', 'TIM9P.MID',
] as const;
export type WindowsMidiFileName = typeof WINDOWS_MIDI_TRACKS[number];

interface MidiSynth {
    getAudioContext(): AudioContext;
    setLoop(loop: number): void;
    loadMIDI(data: ArrayBuffer): void;
    playMIDI(): void;
    stopMIDI(): void;
}

// TinySynth starts an internal scheduler without a disposal method. Keep one
// instance for the app rather than leaking a scheduler for every level.
let sharedSynth: MidiSynth | null = null;
let owner: WindowsMidiPlayer | null = null;
function shared(): MidiSynth {
    return sharedSynth ?? (sharedSynth = new TinySynth({ quality: 1, useReverb: 0, voices: 32 }));
}

/** Local Windows MIDI playback using a synthesized General MIDI approximation. */
export class WindowsMidiPlayer {
    private synth: MidiSynth | null = null;
    private loaded = false;
    private generation = 0;

    constructor(private readonly load: () => Promise<ArrayBuffer | null>, private readonly acquire: () => MidiSynth = shared) {}

    /** Call directly from a user gesture to unlock audio on mobile browsers. */
    public prime(): boolean {
        try {
            const synth = this.synth ?? (this.synth = this.acquire());
            if (owner !== this) {
                if (owner) synth.stopMIDI();
                owner = this;
                this.loaded = false;
            }
            const context = synth.getAudioContext();
            if (context.state === 'suspended') void context.resume().catch(() => {});
            return context.state !== 'closed';
        } catch {
            return false;
        }
    }

    /** Return false if the track is missing, invalid, stale or cannot play. */
    public async play(): Promise<boolean> {
        const generation = ++this.generation;
        if (!this.prime()) return false;
        const synth = this.synth!;
        try {
            if (!this.loaded) {
                const data = await this.load();
                if (generation !== this.generation || owner !== this) return false;
                if (!data || !validateWindowsMidi(data)) return false;
                synth.loadMIDI(data);
                synth.setLoop(1);
                this.loaded = true;
            }
            const context = synth.getAudioContext();
            if (context.state === 'suspended') await context.resume();
            if (generation !== this.generation || owner !== this || context.state !== 'running') return false;
            synth.playMIDI();
            return true;
        } catch {
            return false;
        }
    }

    /** Stop sounding notes while keeping the current position for resume. */
    public suspend(): void {
        this.generation++;
        if (owner !== this || !this.synth) return;
        this.synth.stopMIDI();
        const context = this.synth.getAudioContext();
        if (context.state === 'running') void context.suspend().catch(() => {});
    }

    public stop(): void {
        this.suspend();
        if (owner === this) owner = null;
        this.loaded = false;
        this.synth = null;
    }
}

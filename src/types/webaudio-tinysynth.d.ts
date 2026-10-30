declare module 'webaudio-tinysynth' {
    export default class TinySynth {
        constructor(options?: { quality?: number; useReverb?: number; voices?: number });
        getAudioContext(): AudioContext;
        setLoop(loop: number): void;
        loadMIDI(data: ArrayBuffer): void;
        playMIDI(): void;
        stopMIDI(): void;
    }
}

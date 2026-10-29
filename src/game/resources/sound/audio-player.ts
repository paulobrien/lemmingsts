import { LogHandler } from '@/game/utilities/log-handler';
import { OPL } from './DBOPL/db-opl3';
import { IOpl3 } from './opl3';
import { SoundImagePlayer } from './sound-image-player';

export class AudioPlayer {

    private log = new LogHandler('AudioPlayer');

    public audioCtx: AudioContext | null = null;
    public processor: ScriptProcessorNode | null = null

    private opl: IOpl3 | null = null;

    private soundImagePlayer: SoundImagePlayer | null = null

    private samplesPerTick = 1;
    private finishedSamples = 0;
    private generatedSamples = 0;
    private autoSuspended = false;


    /** is the sound playing at the moment */
    private isPlaying = false;


    constructor(src: SoundImagePlayer, private readonly suspendOnEnd = false) {
        try {
            /// setup audio context
            this.audioCtx = new AudioContext();
            if (!this.audioCtx) {
                this.log.debug('Uanbel to create AudioContext!');
                return;
            }

            this.soundImagePlayer = src;

            this.log.debug('debug: ' + this.soundImagePlayer.sampleRateFactor.toString(16));

            this.log.debug('Sound image sample rate factor: ' + this.soundImagePlayer.sampleRateFactor + ' --> ' + this.soundImagePlayer.getSamplingInterval());
            this.log.debug('Audio sample rate ' + this.audioCtx.sampleRate);

            this.samplesPerTick = this.getSamplesPerTick(src);
            // The OPL synthesizer generates output directly. A BufferSource
            // with no buffer ends immediately and used to disconnect the
            // processor, leaving the running context silent.
            this.processor = this.audioCtx.createScriptProcessor(8192, 0, 2);

            this.opl = new OPL(this.audioCtx.sampleRate, 2);


            /// setup Web-Audio
            this.processor.onaudioprocess = (e: AudioProcessingEvent) => this.audioScriptProcessor(e);
            this.processor.connect(this.audioCtx.destination);

            this.play();
        } catch (error) {
            this.stop();
            throw error;
        }
    }


    /** Start playback of the song/sound */
    public play() {
        if (!this.audioCtx) {
            return;
        }

        void this.audioCtx.resume().catch(() => { /* Browser audio may be unavailable. */ });

        this.isPlaying = true;
    }

    /** Reuse this audio graph for a new, monophonic sound effect. */
    public setTrack(src: SoundImagePlayer) {
        if (!this.audioCtx) return;
        const samplesPerTick = this.getSamplesPerTick(src);
        this.soundImagePlayer = src;
        this.samplesPerTick = samplesPerTick;
        this.lenGen = 0;
        this.finishedSamples = 0;
        this.generatedSamples = 0;
        this.autoSuspended = false;
        this.opl = new OPL(this.audioCtx.sampleRate, 2);
    }

    private getSamplesPerTick(src: SoundImagePlayer): number {
        const interval = src.getSamplingInterval();
        if (!Number.isFinite(interval) || interval <= 0) throw new Error('Invalid sound track timing.');
        const samples = Math.round(this.audioCtx!.sampleRate / interval);
        if (!Number.isFinite(samples)) throw new Error('Invalid sound track timing.');
        return Math.max(1, samples);
    }


    /** processor task for generating sample */
    private lenGen = 0;
    public audioScriptProcessor(e: AudioProcessingEvent) {

        if ((!this.opl)  || (!this.soundImagePlayer)){
            return;
        }

        const b = e.outputBuffer;

        const c0 = b.getChannelData(0);
        const c1 = b.getChannelData(1);

        const lenFill = b.length;
        let posFill = 0;

        while (posFill < lenFill) {
            // Fill any leftover delay from the last buffer-fill event first
            while (this.lenGen > 0) {
                if (lenFill - posFill < 2) {
                    // No more space in buffer
                    return;
                }

                const lenNow = Math.max(2, Math.min(512, this.lenGen, lenFill - posFill));

                const samples = this.opl.generate(lenNow);

                for (let i = 0; i < lenNow; i++) {
                    c0[posFill] = samples[i * 2 + 0] / 32768.0;
                    c1[posFill] = samples[i * 2 + 1] / 32768.0;
                    posFill++;
                }

                this.lenGen -= lenNow;
                if (this.suspendOnEnd) {
                    this.generatedSamples += lenNow;
                    if (this.soundImagePlayer.isFinished()) this.finishedSamples += lenNow;
                }
            }

            // Let the OPL release envelope decay before suspending the idle
            // effects context; the next effect resumes this same graph. Bound
            // malformed/nonterminating sound data to five seconds as well.
            if (this.suspendOnEnd && !this.autoSuspended && this.audioCtx &&
                (this.finishedSamples >= this.audioCtx.sampleRate || this.generatedSamples >= this.audioCtx.sampleRate * 5)) {
                this.autoSuspended = true;
                void this.audioCtx.suspend().catch(() => { /* Audio may already be closed. */ });
                return;
            }


            /// read on music-state from source file
            this.soundImagePlayer.read((reg: number, value: number) => {
                if (!this.opl) {
                    return;
                }

                /// write Adlib-Commands
                this.opl.write(reg, value);
            });


            this.lenGen += this.samplesPerTick;
        }
    }

    /** pause playing */
    public suspend() {
        if (!this.audioCtx) {
            return;
        }

        void this.audioCtx.suspend().catch(() => { /* Already closed or unavailable. */ });
    }

    /** stop playing and close */
    public stop() {

        if (this.isPlaying) {
            this.isPlaying = false;
        }

        try {
            if (this.audioCtx) {
                void this.audioCtx.close().catch(() => { /* Already closed or unavailable. */ });
            }
        } catch (ex) {
            // nothing to do here
        }

        if (this.processor) {
            this.processor.onaudioprocess = null;
        }

        try {
            if (this.processor && this.audioCtx) this.processor.disconnect(this.audioCtx.destination);
            
        } catch (ex) {
            // nothing to do here
         }


        this.audioCtx = null;
        this.processor = null;

        this.opl = null;
        this.soundImagePlayer = null;

    }

}

import { LogHandler } from '@/game/utilities/log-handler';
import { OPL } from './DBOPL/db-opl3';
import { IOpl3 } from './opl3';
import { SoundImagePlayer } from './sound-image-player';

export class AudioPlayer {

    private log = new LogHandler('AudioPlayer');

    public audioCtx: AudioContext | null = null;
    public source: AudioBufferSourceNode | null = null;
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

            this.samplesPerTick = Math.max(1, Math.round(this.audioCtx.sampleRate / (this.soundImagePlayer.getSamplingInterval())));
            this.source = this.audioCtx.createBufferSource();
            this.processor = this.audioCtx.createScriptProcessor(8192, 2, 2);

            // When the buffer source stops playing, disconnect everything
            this.source.onended = () => {

                if ((!this.source) || (!this.processor) || (!this.audioCtx)) {
                    return;
                }

                console.log('source.onended()');
                this.source.disconnect(this.processor);
                this.processor.disconnect(this.audioCtx.destination);
                this.processor = null;
                this.source = null;
            }

            this.opl = new OPL(this.audioCtx.sampleRate, 2);


            /// setup Web-Audio
            this.processor.onaudioprocess = (e: AudioProcessingEvent) => this.audioScriptProcessor(e);
            this.processor.connect(this.audioCtx.destination);
            this.source.connect(this.processor);
            this.source.start();

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
        this.soundImagePlayer = src;
        this.samplesPerTick = Math.max(1, Math.round(this.audioCtx.sampleRate / src.getSamplingInterval()));
        this.lenGen = 0;
        this.finishedSamples = 0;
        this.generatedSamples = 0;
        this.autoSuspended = false;
        this.opl = new OPL(this.audioCtx.sampleRate, 2);
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

        this.audioCtx.suspend();
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
            if ((this.source) && (this.processor)) {
                this.source.disconnect(this.processor);
            }
            if (this.processor && this.audioCtx) this.processor.disconnect(this.audioCtx.destination);
            
        } catch (ex) {
            // nothing to do here
         }


        this.audioCtx = null;
        this.source = null;
        this.processor = null;

        this.opl = null;
        this.soundImagePlayer = null;

    }

}

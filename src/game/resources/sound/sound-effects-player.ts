import { AudioPlayer } from './audio-player';
import { SoundImagePlayer } from './sound-image-player';

/** One reusable, monophonic effects player for the current level. */
export class SoundEffectsPlayer {
    private player: AudioPlayer | null = null;
    private generation = 0;

    constructor(
        private readonly load: (index: number) => Promise<SoundImagePlayer>,
        private readonly create: (track: SoundImagePlayer) => AudioPlayer = track => new AudioPlayer(track, true),
    ) {}

    public async play(index: number): Promise<void> {
        const generation = ++this.generation;
        try {
            const track = await this.load(index);
            // A newer sound, pause, mute or level teardown invalidates this request.
            if (generation !== this.generation) return;
            if (this.player) {
                this.player.setTrack(track);
                this.player.play();
            } else {
                this.player = this.create(track);
            }
        } catch {
            // Effects are optional; unavailable audio must not interrupt play.
        }
    }

    public stop(): void {
        this.generation++;
        this.player?.stop();
        this.player = null;
    }
}

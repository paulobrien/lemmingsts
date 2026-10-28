import { DrawProperties } from '../resources/draw-properties';
import { Frame } from '../resources/frame';
import { LevelElement } from '../resources/lemmings/level-element';
import { ObjectImageInfo } from '../resources/lemmings/object-image-info';
import { TriggerTypes } from '../resources/lemmings/trigger-types';
import { Animation } from '../resources/animation';

/** represent a object (e.g. Exit, Entry, Trap, ...) */
export class MapObject {
    public animation: Animation;
    public x: number;
    public y: number;
    public drawProperties: DrawProperties;
    private triggeredAt: number | null = null;
    private isTriggeredTrap: boolean;
    private frameCount: number;

    constructor(ob: LevelElement, objectImg: ObjectImageInfo) {
        this.x = ob.x;
        this.y = ob.y;

        this.drawProperties = ob.drawProperties;
        this.isTriggeredTrap = objectImg.triggerEffectId === TriggerTypes.TRAP;
        this.frameCount = objectImg.frameCount;

        this.animation = new Animation();

        this.animation.isRepeat = objectImg.animationLoop;
        this.animation.firstFrameIndex = objectImg.firstFrameIndex;

        for (let i = 0; i < objectImg.frames.length; i++) {
            let newFrame = new Frame(objectImg.width, objectImg.height);

            //newFrame.clear();
            newFrame.drawPaletteImage(objectImg.frames[i], objectImg.width, objectImg.height, objectImg.palette, 0, 0);

            this.animation.frames.push(newFrame);
        }
    }

    /** A triggered trap animates once, then remains at rest until activated. */
    public activateTrap(tick: number): void {
        this.triggeredAt = tick;
    }

    public getFrame(tick: number): Frame {
        if (!this.isTriggeredTrap) return this.animation.getFrame(tick);
        // DOS starts the trap at frame 1, then advances objects after processing
        // lemmings in the same tick. The resting frame is 0. See
        // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas
        const elapsed = this.triggeredAt === null ? -1 : tick - this.triggeredAt;
        const frame = elapsed >= 0 && elapsed + 2 < this.frameCount ? elapsed + 2 : 0;
        return this.animation.getFrame(frame);
    }
}

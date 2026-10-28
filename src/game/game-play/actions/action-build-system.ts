import { LemmingsSprite } from '@/game/resources/lemmings-sprite';
import { Level } from '@/game/resources/level';
import { SpriteTypes } from '@/game/resources/sprite-types';
import { DisplayImage } from '@/game/view/display-image';
import { IActionSystem } from '../action-system';
import { Lemming } from '../lemming';
import { LemmingStateType } from '../lemming-state-type';
import { SoundSystem } from '../sound-system';
import { Animation } from './../../resources/animation';
import { ActionFallSystem } from './action-fall-system';
import { ActionFloatingSystem } from './action-floating-system';

export class ActionBuildSystem implements IActionSystem {

    public soundSystem = new SoundSystem();

    private sprite: Animation[] = [];

    constructor(sprites: LemmingsSprite) {

        this.sprite.push(sprites.getAnimation(SpriteTypes.BUILDING, false));
        this.sprite.push(sprites.getAnimation(SpriteTypes.BUILDING, true));
    }

    public getActionName(): string {
        return "building";
    }


    public triggerLemAction(lem: Lemming): boolean {
        // A builder needs to be on the ground; assigning it while falling or
        // floating must not cancel the fall or consume a skill.
        if (lem.action instanceof ActionFallSystem || lem.action instanceof ActionFloatingSystem) {
            return false;
        }
        lem.setAction(this);

        return true;
    }

    /** render Lemming to game display */
    public draw(gameDisplay: DisplayImage, lem: Lemming) {

        const ani = this.sprite[(lem.lookRight ? 1 : 0)];
        const frame = ani.getFrame(lem.frameIndex);

        gameDisplay.drawFrame(frame, lem.x, lem.y);
    }



    public process(level: Level, lem: Lemming): LemmingStateType {

        lem.frameIndex = (lem.frameIndex + 1) % 16;

        // DOS/Lemmix repeats this brick on frame 10 when nine bricks remain.
        // Another lemming can remove part of it between the two frames.
        // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L2996
        if (lem.frameIndex == 9 || (lem.frameIndex == 10 && lem.state == 3)) {

            /// lay brick
            const x = lem.x + (lem.lookRight ? 0 : -4);
            for (let i = 0; i < 6; i++) {
                if (!level.hasGroundAt(x + i, lem.y - 1)) level.setGroundAt(x + i, lem.y - 1, 7);
            }

            return LemmingStateType.NO_STATE_TYPE;
        }

        if (lem.frameIndex == 0) {
            /// walk 

            lem.y--;

            for (let i = 0; i < 2; i++) {
                lem.x += (lem.lookRight ? 1 : -1);
                if (level.hasGroundAt(lem.x, lem.y - 1)) {
                    lem.lookRight = !lem.lookRight;
                    return LemmingStateType.WALKING;
                }
            }

            lem.state++;
            if (lem.state >= 12) {
                return LemmingStateType.SHRUG;
            }

            if (level.hasGroundAt(lem.x + (lem.lookRight ? 2 : -2), lem.y - 9)) {
                lem.lookRight = !lem.lookRight;
                return LemmingStateType.WALKING;
            }

            // DOS stops a builder when its 13-pixel-tall sprite rises above
            // the top boundary. It becomes a walker without turning around.
            // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L3044
            if (lem.y - 13 < Lemming.LEM_MIN_Y) {
                return LemmingStateType.WALKING;
            }
        }
        return LemmingStateType.NO_STATE_TYPE;

    }


}


import { LemmingsSprite } from '@/game/resources/lemmings-sprite';
import { Level } from '@/game/resources/level';
import { SpriteTypes } from '@/game/resources/sprite-types';
import { DisplayImage } from '@/game/view/display-image';
import { IActionSystem } from '../action-system';
import { Lemming } from '../lemming';
import { LemmingStateType } from '../lemming-state-type';
import { SoundSystem } from '../sound-system';
import { Animation } from './../../resources/animation';

export class ActionFloatingSystem implements IActionSystem {

    // Lemmix's table is indexed independently from the animation frame.
    // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L731
    private static floatSpeed: number[] = [3, 3, 3, 3, -1, 0, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2];
    private static floatFrame: number[] = [1, 2, 3, 5, 5, 5, 5, 5, 5, 6, 7, 7, 6, 5, 4, 4];

    public soundSystem = new SoundSystem();

    private sprite: Animation[] = [];

    constructor(sprites: LemmingsSprite) {
        this.sprite.push(sprites.getAnimation(SpriteTypes.UMBRELLA, false));
        this.sprite.push(sprites.getAnimation(SpriteTypes.UMBRELLA, true));
    }

    public getActionName(): string {
        return "floating";
    }


    public triggerLemAction(lem: Lemming): boolean {
        if (lem.hasParachute) {
            return false;
        }

        lem.hasParachute = true;
        return true;
    }


    /** render Lemming to game display */
    public draw(gameDisplay: DisplayImage, lem: Lemming) {
        let ani = this.sprite[(lem.lookRight ? 1 : 0)];

        let frame = ani.getFrame(lem.frameIndex);

        gameDisplay.drawFrame(frame, lem.x, lem.y);
    }


    public process(level: Level, lem: Lemming): LemmingStateType {

        const index = lem.state;
        let speed = ActionFloatingSystem.floatSpeed[index];
        lem.frameIndex = ActionFloatingSystem.floatFrame[index];
        lem.state = index === 15 ? 8 : index + 1;

        for (let i = 0; i < speed; i++) {
            if (level.hasGroundAt(lem.x, lem.y + i)) {
                // landed
                lem.y += i;
                return LemmingStateType.WALKING;
            }
        }
        lem.y += speed;

        return LemmingStateType.NO_STATE_TYPE;
    }

}


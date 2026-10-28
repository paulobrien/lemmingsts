import { LemmingsSprite } from '@/game/resources/lemmings-sprite';
import { TriggerTypes } from '@/game/resources/lemmings/trigger-types';
import { Level } from '@/game/resources/level';
import { SpriteTypes } from '@/game/resources/sprite-types';
import { DisplayImage } from '@/game/view/display-image';
import { IActionSystem } from '../action-system';
import { Lemming } from '../lemming';
import { LemmingStateType } from '../lemming-state-type';
import { SoundSystem } from '../sound-system';
import { Trigger } from '../trigger';
import { TriggerManager } from '../trigger-manager';
import { Animation } from './../../resources/animation';

export class ActionBlockerSystem implements IActionSystem {

    public soundSystem = new SoundSystem();

    private sprite: Animation;

    constructor(sprites: LemmingsSprite, private triggerManager: TriggerManager) {
        this.sprite = sprites.getAnimation(SpriteTypes.BLOCKING, false);
    }

    public getActionName(): string {
        return 'blocking';
    }

    public triggerLemAction(lem: Lemming): boolean {
        lem.setAction(this);

        return true;
    }

    /** render Lemming to game display */
    public draw(gameDisplay: DisplayImage, lem: Lemming) {

        const frame = this.sprite.getFrame(lem.frameIndex);

        gameDisplay.drawFrame(frame, lem.x, lem.y);
    }


    public process(level: Level, lem: Lemming): LemmingStateType {

        if (lem.state == 0) {
            // DOS stores blocker arms in a 4-pixel object grid: three rows
            // sampled at y-6, y-2 and y+2, and columns at x-4 and x+4.
            // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L1899
            const left = Math.floor((lem.x - 4) / 4) * 4;
            const right = Math.floor((lem.x + 4) / 4) * 4;
            const top = Math.floor((lem.y - 6) / 4) * 4;
            const bottom = Math.floor((lem.y + 2) / 4) * 4 + 3;
            const trigger1 = new Trigger(TriggerTypes.BLOCKER_LEFT, left, top, left + 3, bottom, 0, 0, lem);
            const trigger2 = new Trigger(TriggerTypes.BLOCKER_RIGHT, right, top, right + 3, bottom, 0, 0, lem);

            this.triggerManager.add(trigger1);
            this.triggerManager.add(trigger2);

            lem.state = 1;
        }

        lem.frameIndex++;
        if (!level.hasGroundAt(lem.x, lem.y + 1)) {
            this.triggerManager.removeByOwner(lem);

            return LemmingStateType.FALLING;
        }

        return LemmingStateType.NO_STATE_TYPE;
    }

}

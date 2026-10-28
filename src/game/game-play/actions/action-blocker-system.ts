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
        // Lemmix rejects a blocker whose 3×3 object-map field would overlap
        // any existing blocker field.
        // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L1909
        for (const dx of [-4, 0, 4]) for (const dy of [-6, -2, 2]) {
            if (this.triggerManager.hasBlockerFieldAt(lem.x + dx, lem.y + dy)) return false;
        }
        lem.setAction(this);

        // Lemmix installs the object-map field as part of the transition,
        // before any lemming is updated in the next simulation frame.
        // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L1973
        const left = Math.floor((lem.x - 4) / 4) * 4;
        const center = Math.floor(lem.x / 4) * 4;
        const right = Math.floor((lem.x + 4) / 4) * 4;
        const top = Math.floor((lem.y - 6) / 4) * 4;
        const bottom = Math.floor((lem.y + 2) / 4) * 4 + 3;
        this.triggerManager.add(new Trigger(TriggerTypes.BLOCKER_LEFT, left, top, left + 3, bottom, 0, 0, lem));
        this.triggerManager.add(new Trigger(TriggerTypes.BLOCKER_CENTER, center, top, center + 3, bottom, 0, 0, lem));
        this.triggerManager.add(new Trigger(TriggerTypes.BLOCKER_RIGHT, right, top, right + 3, bottom, 0, 0, lem));

        return true;
    }

    /** render Lemming to game display */
    public draw(gameDisplay: DisplayImage, lem: Lemming) {

        const frame = this.sprite.getFrame(lem.frameIndex);

        gameDisplay.drawFrame(frame, lem.x, lem.y);
    }


    public process(level: Level, lem: Lemming): LemmingStateType {

        lem.frameIndex++;
        // Lemmix releases the blocker to walking when the foot pixel is
        // removed; the walking action handles falling on the following frame.
        // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L3319
        if (!level.hasGroundAt(lem.x, lem.y)) {
            this.triggerManager.removeByOwner(lem);

            return LemmingStateType.WALKING;
        }

        return LemmingStateType.NO_STATE_TYPE;
    }

}

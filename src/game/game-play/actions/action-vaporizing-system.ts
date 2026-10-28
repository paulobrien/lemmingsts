import { LemmingsSprite } from '@/game/resources/lemmings-sprite';
import { Level } from '@/game/resources/level';
import { SpriteTypes } from '@/game/resources/sprite-types';
import { DisplayImage } from '@/game/view/display-image';
import { IActionSystem } from '../action-system';
import { Lemming } from '../lemming';
import { LemmingStateType } from '../lemming-state-type';

/** The DOS fire effect is a stationary, 14-frame death animation. */
export class ActionVaporizingSystem implements IActionSystem {
    private readonly sprite;

    constructor(sprites: LemmingsSprite) {
        this.sprite = sprites.getAnimation(SpriteTypes.FRYING, false);
    }

    public getActionName(): string { return 'vaporizing'; }
    public triggerLemAction(): boolean { return false; }

    public draw(display: DisplayImage, lem: Lemming): void {
        display.drawFrame(this.sprite.getFrame(lem.frameIndex), lem.x, lem.y);
    }

    public process(_level: Level, lem: Lemming): LemmingStateType {
        // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L3312
        lem.frameIndex++;
        return lem.frameIndex >= 14 ? LemmingStateType.OUT_OFF_LEVEL : LemmingStateType.NO_STATE_TYPE;
    }
}

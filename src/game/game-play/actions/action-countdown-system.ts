import { Level } from '@/game/resources/level';
import { MaskList } from '@/game/resources/mask-list';
import { MaskProvider } from '@/game/resources/mask-provider';
import { MaskTypes } from '@/game/resources/mask-types';
import { DisplayImage } from '@/game/view/display-image';
import { IActionSystem } from '../action-system';
import { Lemming } from '../lemming';
import { LemmingStateType } from '../lemming-state-type';
import { SoundSystem } from '../sound-system';
import { ActionFallSystem } from './action-fall-system';
import { ActionFloatingSystem } from './action-floating-system';
import { ActionDrowningSystem } from './action-drowning-system';
import { ActionVaporizingSystem } from './action-vaporizing-system';

export class ActionCountdownSystem implements IActionSystem {

    public soundSystem = new SoundSystem();

    private numberMasks: MaskList;

    constructor(masks: MaskProvider) {
        this.numberMasks = masks.GetMask(MaskTypes.NUMBERS)
    }

    public getActionName(): string {
        return 'countdown';
    }

    public triggerLemAction(lem: Lemming): boolean {
        return lem.setCountDown(this);
    }

    /** render Lemming to game display */
    public draw(gameDisplay: DisplayImage, lem: Lemming) {
        let count = lem.getCountDownTime();

        if (count <= 0) {
            return;
        }

        let numberFrame = this.numberMasks.getMask(count);

        gameDisplay.drawMask(numberFrame, lem.x, lem.y);
    }



    public process(level: Level, lem: Lemming): LemmingStateType {

        if (lem.countdown <= 0) {
            return LemmingStateType.NO_STATE_TYPE;
        }

        lem.countdown--;

        if (lem.countdown == 0) {
            lem.setCountDown(null);
            // DOS/Lemmix skips Oh No for airborne or drowning bombers.
            // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L2218
            if (lem.action instanceof ActionFallSystem || lem.action instanceof ActionFloatingSystem ||
                lem.action instanceof ActionDrowningSystem || lem.action instanceof ActionVaporizingSystem) return LemmingStateType.EXPLODING;
            return LemmingStateType.OHNO;
        }

        return LemmingStateType.NO_STATE_TYPE;
    }


}

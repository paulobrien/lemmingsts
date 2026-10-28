import { LemmingsSprite } from '@/game/resources/lemmings-sprite';
import { Level } from '@/game/resources/level';
import { MaskList } from '@/game/resources/mask-list';
import { MaskProvider } from '@/game/resources/mask-provider';
import { MaskTypes } from '@/game/resources/mask-types';
import { SpriteTypes } from '@/game/resources/sprite-types';
import { DisplayImage } from '@/game/view/display-image';
import { IActionSystem } from '../action-system';
import { Lemming } from '../lemming';
import { LemmingStateType } from '../lemming-state-type';
import { SoundSystem } from '../sound-system';
import { Animation } from './../../resources/animation';

export class ActionMineSystem implements IActionSystem {

    public soundSystem = new SoundSystem();
    private sprite: Animation[] = [];
    private masks: MaskList[] = [];

    constructor(sprites: LemmingsSprite, masks: MaskProvider) {
        this.sprite.push(sprites.getAnimation(SpriteTypes.MINEING, false));
        this.sprite.push(sprites.getAnimation(SpriteTypes.MINEING, true));

        this.masks.push(masks.GetMask(MaskTypes.MINEING_L));
        this.masks.push(masks.GetMask(MaskTypes.MINEING_R));
    }



    public draw(gameDisplay: DisplayImage, lem: Lemming) {
        let ani = this.sprite[(lem.lookRight ? 1 : 0)];

        let frame = ani.getFrame(lem.frameIndex);

        gameDisplay.drawFrame(frame, lem.x, lem.y);
    }


    public getActionName(): string {
        return 'mining';
    }


    public triggerLemAction(lem: Lemming): boolean {
        if (lem.action === this) return false;
        lem.setAction(this);
        // In the DOS transition the miner starts one pixel lower than a walker.
        lem.y++;

        return true;
    }


    public process(level: Level, lem: Lemming): LemmingStateType {

        lem.frameIndex = (lem.frameIndex + 1) % 24;

        switch (lem.frameIndex) {
            case 1:
            case 2: {
                const mask = this.masks[lem.lookRight ? 1 : 0];
                const secondStroke = lem.frameIndex === 2;
                const dx = secondStroke ? (lem.lookRight ? 1 : -1) : 0;
                const dy = secondStroke ? 1 : 0;
                level.clearGroundWithMask(mask.getMask(lem.frameIndex - 1), lem.x + dx, lem.y + dy);
                break;
            }

            case 3:
            case 15: {
                const direction = lem.lookRight ? 1 : -1;
                // The original moves twice, checking each step at the edge.
                for (let step = 0; step < 2; step++) {
                    const nextX = lem.x + direction;
                    if (nextX < 0 || nextX >= level.width) {
                        lem.lookRight = !lem.lookRight;
                        return LemmingStateType.WALKING;
                    }
                    lem.x = nextX;
                }
                if (lem.frameIndex === 3) {
                    lem.y++;
                    if (lem.y >= level.height + 6) return LemmingStateType.OUT_OFF_LEVEL;
                }

                if (!level.hasGroundAt(lem.x, lem.y)) {
                    return LemmingStateType.FALLING;
                }
                if (level.isMinerProtectedAt(lem.x, lem.y, direction)) {
                    lem.lookRight = !lem.lookRight;
                    return LemmingStateType.WALKING;
                }
                break;
            }

            case 0:
                lem.y++;
                if (lem.y >= level.height + 6) return LemmingStateType.OUT_OFF_LEVEL;
                break;
        }

        return LemmingStateType.NO_STATE_TYPE;
    }

}

import { LemmingsSprite } from '../resources/lemmings-sprite';
import { GameTypes } from '../game-types';
import { TriggerTypes } from '../resources/lemmings/trigger-types';
import { Level } from '../resources/level';
import { MaskProvider } from '../resources/mask-provider';
import { ParticleTable } from '../resources/particle-table';
import { LogHandler } from '../utilities/log-handler';
import { DisplayImage } from '../view/display-image';
import { EventHandler } from '../utilities/event-handler';
import { IActionSystem } from './action-system';
import { ActionBashSystem } from './actions/action-bash-system';
import { ActionBlockerSystem } from './actions/action-blocker-system';
import { ActionBuildSystem } from './actions/action-build-system';
import { ActionClimbSystem } from './actions/action-climb-system';
import { ActionCountdownSystem } from './actions/action-countdown-system';
import { ActionDiggSystem } from './actions/action-digg-system';
import { ActionDrowningSystem } from './actions/action-drowning-system';
import { ActionExitingSystem } from './actions/action-exiting-system';
import { ActionExplodingSystem } from './actions/action-exploding-system';
import { ActionFallSystem } from './actions/action-fall-system';
import { ActionFloatingSystem } from './actions/action-floating-system';
import { ActionHoistSystem } from './actions/action-hoist-system';
import { ActionJumpSystem } from './actions/action-jump-system';
import { ActionMineSystem } from './actions/action-mine-system';
import { ActionOhNoSystem } from './actions/action-ohno-system';
import { ActionShrugSystem } from './actions/action-shrug-system';
import { ActionSplatterSystem } from './actions/action-splatter-system';
import { ActionWalkSystem } from './actions/action-walk-system';
import { ActionVaporizingSystem } from './actions/action-vaporizing-system';
import { GameVictoryCondition } from './game-victory-condition';
import { Lemming } from './lemming';
import { LemmingStateType } from './lemming-state-type';
import { SkillTypes } from './skill-types';
import { SoundEffect } from './sound-effects';
import { TriggerManager } from './trigger-manager';

    export class LemmingManager {

        public readonly onSoundEffect = new EventHandler<SoundEffect>();

        /** list of all Lemming in the game */
        private lemmings: Lemming[] = [];

        /** list of all Actions a Lemming can do */
        private actions: IActionSystem[] = [];
        private skillActions: IActionSystem[] = [];

        // Lemmix opens entrances on iteration 35, then counts down 20 frames.
        private releaseIteration: number = 0;
        private releaseCountdown: number = 20;
        private nextEntranceIndex: number = 0;

        private logging = new LogHandler("LemmingManager");

        /** next lemming index need to explode */
        private nextNukingLemmingsIndex: number = -1;

        constructor(private level: Level,
            lemmingsSprite: LemmingsSprite,
            private triggerManager: TriggerManager,
            private gameVictoryCondition: GameVictoryCondition,
            masks: MaskProvider,
            particleTable: ParticleTable) {

            this.actions[LemmingStateType.WALKING] = new ActionWalkSystem(lemmingsSprite);
            this.actions[LemmingStateType.FALLING] = new ActionFallSystem(lemmingsSprite);
            this.actions[LemmingStateType.JUMPING] = new ActionJumpSystem(lemmingsSprite);
            this.actions[LemmingStateType.DIGGING] = new ActionDiggSystem(lemmingsSprite);
            this.actions[LemmingStateType.EXITING] = new ActionExitingSystem(lemmingsSprite, gameVictoryCondition);
            this.actions[LemmingStateType.FLOATING] = new ActionFloatingSystem(lemmingsSprite);
            this.actions[LemmingStateType.BLOCKING] = new ActionBlockerSystem(lemmingsSprite, triggerManager);
            this.actions[LemmingStateType.MINEING] = new ActionMineSystem(lemmingsSprite, masks);
            this.actions[LemmingStateType.CLIMBING] = new ActionClimbSystem(lemmingsSprite);
            this.actions[LemmingStateType.HOISTING] = new ActionHoistSystem(lemmingsSprite);
            this.actions[LemmingStateType.BASHING] = new ActionBashSystem(lemmingsSprite, masks);
            this.actions[LemmingStateType.BUILDING] = new ActionBuildSystem(lemmingsSprite);
            this.actions[LemmingStateType.SHRUG] = new ActionShrugSystem(lemmingsSprite);
            this.actions[LemmingStateType.EXPLODING] = new ActionExplodingSystem(lemmingsSprite, masks, triggerManager, particleTable);
            this.actions[LemmingStateType.OHNO] = new ActionOhNoSystem(lemmingsSprite);
            this.actions[LemmingStateType.SPLATTING] = new ActionSplatterSystem(lemmingsSprite);
            this.actions[LemmingStateType.DROWNING] = new ActionDrowningSystem(lemmingsSprite);
            this.actions[LemmingStateType.FRYING] = new ActionVaporizingSystem(lemmingsSprite);


            this.skillActions[SkillTypes.DIGGER] = this.actions[LemmingStateType.DIGGING];
            this.skillActions[SkillTypes.FLOATER] = this.actions[LemmingStateType.FLOATING];
            this.skillActions[SkillTypes.BLOCKER] = this.actions[LemmingStateType.BLOCKING];
            this.skillActions[SkillTypes.MINER] = this.actions[LemmingStateType.MINEING];
            this.skillActions[SkillTypes.CLIMBER] = this.actions[LemmingStateType.CLIMBING];
            this.skillActions[SkillTypes.BASHER] = this.actions[LemmingStateType.BASHING];
            this.skillActions[SkillTypes.BUILDER] = this.actions[LemmingStateType.BUILDING];
            this.skillActions[SkillTypes.BOMBER] = new ActionCountdownSystem(masks);

        }


        private processNewAction(lem: Lemming, newAction: LemmingStateType): boolean {

            if (newAction == LemmingStateType.NO_STATE_TYPE) {
                return false;
            }

            this.setLemmingState(lem, newAction);

            return true;
        }


        /** process all Lemmings to the next time-step */
        public tick() {

            this.addNewLemmings();

            let lems = this.lemmings;

            for (let i = 0; i < lems.length; i++) {

                let lem = lems[i];

                if (lem.removed) continue;

                const previousAction = lem.action;
                const countdownFinishes = lem.countdownAction !== null && lem.countdown === 1;
                let newAction = lem.process(this.level);
                // DOS/Lemmix checks interactive objects for a digger only on
                // the frames where it digs a row (0 and 8), not during the
                // seven intervening animation frames. The initial digging
                // frame remains 0; later frames increment before processing.
                // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L2907
                // Lemmix skips both the action and its object check when the
                // bomber countdown reaches zero, for every lemming action.
                // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L4440
                let checkObjects = !countdownFinishes;
                if (checkObjects && previousAction instanceof ActionDiggSystem) {
                    checkObjects = lem.frameIndex === 0 || lem.frameIndex === 8;
                } else if (checkObjects && previousAction instanceof ActionBuildSystem) {
                    // Lemmix skips object checks on brick-laying frame 9 and
                    // the extra frame 10 when three bricks are complete.
                    // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L2996
                    checkObjects = lem.frameIndex !== 9 &&
                        !(lem.frameIndex === 10 && lem.state === 3);
                } else if (checkObjects && previousAction instanceof ActionBashSystem) {
                    // Lemmix checks objects only during the five moving
                    // frames in each half of the basher animation.
                    // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L3053
                    checkObjects = lem.frameIndex % 16 >= 11;
                } else if (checkObjects && previousAction instanceof ActionMineSystem) {
                    // Miners check objects after moving on frames 0, 3 and 15;
                    // their mask and idle frames do not check objects.
                    // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L3123
                    checkObjects = lem.frameIndex === 0 || lem.frameIndex === 3 || lem.frameIndex === 15;
                }
                this.processNewAction(lem, newAction);

                if (checkObjects) {
                    let triggerAction = this.runTrigger(lem);
                    this.processNewAction(lem, triggerAction);
                }
            }

            if (this.isNuking()) {
                // The DOS sweep runs after lemmings update and skips removed
                // slots without spending a frame on each of them.
                // https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L4061
                while (this.nextNukingLemmingsIndex < lems.length && lems[this.nextNukingLemmingsIndex].removed) {
                    this.nextNukingLemmingsIndex++;
                }
                const next = lems[this.nextNukingLemmingsIndex];
                if (next) {
                    this.doLemmingAction(next, SkillTypes.BOMBER);
                    this.nextNukingLemmingsIndex++;
                }
            }
        }

        /** Add a new Lemming to the manager */
        private addLemming(x: number, y: number) {

            let lem = new Lemming(x, y, this.lemmings.length);

            this.setLemmingState(lem, LemmingStateType.FALLING);

            this.lemmings.push(lem);
        }


        /** let a new lemming arise from an entrance */
        private addNewLemmings() {
            if (this.gameVictoryCondition.getLeftCount() <= 0) {
                return;
            }

            this.releaseIteration++;
            if (this.releaseIteration < 35) return;
            this.releaseCountdown--;

            if (this.releaseCountdown === 0) {
                this.releaseCountdown = Math.floor((99 - this.gameVictoryCondition.getCurrentReleaseRate()) / 2) + 4;

                const entrances = this.level.entrances;
                if (entrances.length === 0) return;
                // Original DOS Lemmings uses a four-slot entrance order: two
                // entrances release A-B-B-A, and three use A-B-C-B.
                let entranceOrder = entrances.map((_, index) => index);
                if (this.level.gameType === GameTypes.LEMMINGS && entrances.length === 2) {
                    entranceOrder = [0, 1, 1, 0];
                } else if (this.level.gameType === GameTypes.LEMMINGS && entrances.length === 3) {
                    entranceOrder = [0, 1, 2, 1];
                }
                const entrance = entrances[entranceOrder[this.nextEntranceIndex]];
                this.nextEntranceIndex = (this.nextEntranceIndex + 1) % entranceOrder.length;

                this.addLemming(entrance.x + 24, entrance.y + 14);

                this.gameVictoryCondition.releaseOne();
            }
        }



        private runTrigger(lem: Lemming): LemmingStateType {
            // Vaporizing lemmings remain hittable for DOS athlete skills, but
            // Lemmix does not check objects during their death animation.
            if (lem.isRemoved() || lem.isDisabled() || lem.action instanceof ActionVaporizingSystem) {
                return LemmingStateType.NO_STATE_TYPE;
            }

            let triggerType = this.triggerManager.trigger(lem.x, lem.y);

            switch (triggerType) {
                case TriggerTypes.NO_TRIGGER:
                    return LemmingStateType.NO_STATE_TYPE;
                case TriggerTypes.DROWN:
                    return LemmingStateType.DROWNING;
                case TriggerTypes.EXIT_LEVEL:
                    return LemmingStateType.EXITING;
                case TriggerTypes.KILL:
                    return LemmingStateType.FRYING;
                case TriggerTypes.TRAP:
                    return LemmingStateType.OUT_OFF_LEVEL;
                case TriggerTypes.BLOCKER_LEFT:
                    if (lem.lookRight) lem.lookRight = false;
                    return LemmingStateType.NO_STATE_TYPE;
                case TriggerTypes.BLOCKER_RIGHT:
                    if (!lem.lookRight) lem.lookRight = true;
                    return LemmingStateType.NO_STATE_TYPE;
                default:
                    this.logging.log("unknown trigger type: " + triggerType);
                    return LemmingStateType.NO_STATE_TYPE;

            }
        }


        /** render all Lemmings to the GameDisplay */
        public render(gameDisplay: DisplayImage) {
            let lems = this.lemmings;

            for (let i = 0; i < lems.length; i++) {
                lems[i].render(gameDisplay);
            }
        }

        /** render all Lemmings to the GameDisplay */
        public renderDebug(gameDisplay: DisplayImage) {
            let lems = this.lemmings;

            for (let i = 0; i < lems.length; i++) {
                lems[i].renderDebug(gameDisplay);
            }
        }

        /** return the lemming with a given id */
        public getLemming(id:number): Lemming {
            return this.lemmings[id];
        }

        /** return a lemming at a given position */
        public getLemmingAt(x: number, y: number, hitSlop = 0): Lemming | null {
            let lems = this.lemmings;

            let minDistance = 99999;
            let minDistanceLem = null;

            for (let i = 0; i < lems.length; i++) {
                let lem = lems[i];

                // Dead or exiting lemmings must not obscure selectable ones.
                if (lem.removed || lem.isDisabled()) continue;

                let distance = lem.getClickDistance(x, y, hitSlop);
                //console.log("--> "+ distance);

                if ((distance < 0) || (distance >= minDistance)) {
                    continue;
                }

                minDistance = distance;
                minDistanceLem = lem;
            }
            //console.log("====> "+ (minDistanceLem? minDistanceLem.id : "null"));
            return minDistanceLem;
        }

        /** change the action a Lemming is doing */
        private setLemmingState(lem: Lemming, stateType: LemmingStateType) {

            if (stateType == LemmingStateType.OUT_OFF_LEVEL) {
                lem.remove();
                this.gameVictoryCondition.removeOne();
                return;
            }

            let actionSystem = this.actions[stateType];

            if (actionSystem == null) {
                lem.remove();

                this.logging.log(lem.id + " Action: Error not an action: " + LemmingStateType[stateType]);
                return;
            }
            else {
                this.logging.debug(lem.id + " Action: " + actionSystem.getActionName());
            }

            lem.setAction(actionSystem);
            // Sound events are observational and do not affect simulation.
            if (stateType === LemmingStateType.EXITING) this.onSoundEffect.trigger(SoundEffect.Exit);
            else if (stateType === LemmingStateType.SPLATTING) this.onSoundEffect.trigger(SoundEffect.Splat);
            else if (stateType === LemmingStateType.EXPLODING) this.onSoundEffect.trigger(SoundEffect.Explosion);
            // Original DOS/Lemmix starts its fall counter at three pixels.
            // A later custom-DOS variant starts at zero; this engine targets
            // the classic original rules rather than identifying executables.
            if (stateType === LemmingStateType.FALLING) lem.state = 3;
        }


        /** change the action a Lemming is doing */
        public doLemmingAction(lem: Lemming, skillType: SkillTypes): boolean {
            if (lem == null || lem.removed || lem.isDisabled()) {
                return false;
            }

            // A lemming already vaporizing cannot receive a new bomber.
            if (skillType === SkillTypes.BOMBER && lem.action instanceof ActionVaporizingSystem) return false;

            // DOS accepts blockers and builders only from these active ground
            // states; a jump, climb or hoist is not an assignable ground state.
            if (skillType === SkillTypes.BLOCKER || skillType === SkillTypes.BUILDER) {
                const current = lem.action?.getActionName();
                const allowed = ['walk', 'shruging', 'building', 'bashing', 'mining', 'digging'];
                if (!current || !allowed.includes(current) ||
                    (skillType === SkillTypes.BUILDER && current === 'building')) return false;
            }

            // Reject impossible assignments before consuming a skill. DOS checks
            // the object-map cell in front and/or under the lemming at assignment.
            if (skillType === SkillTypes.BASHER || skillType === SkillTypes.MINER || skillType === SkillTypes.DIGGER) {
                const current = lem.action?.getActionName();
                const allowed = ['walk', 'shruging', 'building', 'bashing', 'mining', 'digging'];
                if (!current || !allowed.includes(current) ||
                    (skillType === SkillTypes.BASHER && current === 'bashing') ||
                    (skillType === SkillTypes.MINER && current === 'mining') ||
                    (skillType === SkillTypes.DIGGER && current === 'digging')) return false;
                const direction = lem.lookRight ? 1 : -1;
                if ((skillType === SkillTypes.BASHER || skillType === SkillTypes.MINER) &&
                    this.level.isProtectedAt(lem.x + 8 * direction, lem.y - 8, direction)) return false;
                if ((skillType === SkillTypes.MINER || skillType === SkillTypes.DIGGER) &&
                    this.level.isProtectedAt(lem.x, lem.y)) return false;
            }

            const needsGround = skillType === SkillTypes.BLOCKER || skillType === SkillTypes.BUILDER ||
                skillType === SkillTypes.BASHER || skillType === SkillTypes.MINER || skillType === SkillTypes.DIGGER;
            if (needsGround && (lem.action instanceof ActionFallSystem || lem.action instanceof ActionFloatingSystem)) {
                return false;
            }
            // A blocker remains committed until it is freed by terrain changes
            // or assigned a bomber countdown. Reassigning its main action
            // would also leave behind the blocker field it owns.
            if (lem.action instanceof ActionBlockerSystem && skillType !== SkillTypes.BOMBER) {
                return false;
            }

            let actionSystem = this.skillActions[skillType];
            if (!actionSystem) {
                this.logging.log(lem.id + " Unknown Action: " + skillType);
                return false;
            }

            if (lem.action === actionSystem) return false;

            return actionSystem.triggerLemAction(lem);
        }


        /** return if the game is in nuke state */
        public isNuking() {
            return this.nextNukingLemmingsIndex >= 0;
        }


        /** start the nuking of all lemmings */
        public doNukeAllLemmings() {
            this.nextNukingLemmingsIndex = 0;
        }
    }


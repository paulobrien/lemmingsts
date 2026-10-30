import { Game } from '../game';
import { CommandNuke } from '../game-play/commands/command-nuke';
import { CommandReleaseRateDecrease } from '../game-play/commands/command-release-rate-decrease';
import { CommandReleaseRateIncrease } from '../game-play/commands/command-release-rate-increase';
import { CommandSelectSkill } from '../game-play/commands/command-select-skill';
import { GameSkills } from '../game-play/game-skills';
import { GameTimer } from '../game-play/game-timer';
import { GameVictoryCondition } from '../game-play/game-victory-condition';
import { SkillTypes } from '../game-play/skill-types';
import { SkillPanelSprites } from '../resources/skill-panel-sprites';
import { DisplayImage } from './display-image';
import { Frame } from '../resources/frame';
import { GameStateTypes } from '../game-state-types';

/** handles the in-game-gui. e.g. the panel on the bottom of the game */
export class GameGui {

    private gameTimeChanged = true;
    private skillsCountChanged = true;
    private skillSelectionChanged = true;
    private backgroundChanged = true;

    private display?: DisplayImage;
    private deltaReleaseRate = 0;
    private nukeRequestHandler: (() => void) | null = null;
    private fastForwardRequestHandler: (() => void) | null = null;
    private fastForwardActive = false;
    private windowsPanel: readonly Frame[] | null = null;
    private windowsNativePanel: readonly Frame[] | null = null;
    private windowsAnimations: readonly (readonly Frame[])[] | null = null;
    private windowsNativeAnimations: readonly (readonly Frame[])[] | null = null;
    private iconAnimationTick = 0;
    private iconAnimationChanged = false;

    /** New Windows art uses its original 13-button layout; older sets use DOS positions. */
    public setWindowsPanel(icons: readonly Frame[] | null, nativeIcons?: readonly Frame[] | null,
        animations?: readonly (readonly Frame[])[] | null, nativeAnimations?: readonly (readonly Frame[])[] | null) {
        this.windowsPanel = icons?.length === 12 || icons?.length === 13 ? icons : null;
        this.windowsNativePanel = this.windowsPanel && nativeIcons?.length === this.windowsPanel.length &&
            nativeIcons.every(icon => icon.width === 32 && icon.height === 40) ? nativeIcons : null;
        const validAnimations = this.windowsNativePanel && animations && nativeAnimations &&
            animations.length === this.windowsPanel?.length && nativeAnimations.length === this.windowsPanel?.length && animations.every((frames, index) =>
                frames.length > 0 && frames.length === nativeAnimations[index].length &&
                frames.every(frame => frame.width === 16 && frame.height === 20) &&
                nativeAnimations[index].every(frame => frame.width === 32 && frame.height === 40));
        this.windowsAnimations = validAnimations ? animations ?? null : null;
        this.windowsNativeAnimations = validAnimations ? nativeAnimations ?? null : null;
        this.iconAnimationTick = 0;
        this.iconAnimationChanged = false;
        this.backgroundChanged = true;
    }

    public setFastForwardRequestHandler(handler: (() => void) | null) {
        this.fastForwardRequestHandler = handler;
    }

    public setFastForwardActive(active: boolean) {
        if (this.fastForwardActive === active) return;
        this.fastForwardActive = active;
        this.backgroundChanged = true;
    }

    private get isWindowsLayout(): boolean { return this.windowsPanel?.length === 13; }

    public setNukeRequestHandler(handler: (() => void) | null) {
        this.nukeRequestHandler = handler;
    }

    constructor(private game: Game,
        private skillPanelSprites: SkillPanelSprites,
        private skills: GameSkills,
        private gameTimer: GameTimer,
        private gameVictoryCondition: GameVictoryCondition) {

        gameTimer.onGameTick.on(() => {
            this.gameTimeChanged = true;
            this.doReleaseRateChanges();
            // Advance the supplied Win95 sprite sequences with simulation
            // ticks: pause freezes them and the speed control scales them.
            if (this.windowsAnimations?.some(frames => frames.length > 1)) {
                this.iconAnimationTick++;
                this.iconAnimationChanged = true;
            }
        });

        skills.onCountChanged.on(() => {
            this.skillsCountChanged = true;
            this.backgroundChanged = true;
        });

        skills.onSelectionChanged.on(() => {
            this.skillSelectionChanged = true;
            this.backgroundChanged = true;
        })
    }

    private doReleaseRateChanges() {
        if (this.deltaReleaseRate == 0) {
            return;
        }

        if (this.deltaReleaseRate > 0) {
            this.game.queueCommand(new CommandReleaseRateIncrease(this.deltaReleaseRate));
        }
        else {
            this.game.queueCommand(new CommandReleaseRateDecrease(-this.deltaReleaseRate));
        }

    }

    /// handel click on the skills panel
    private handleSkillMouseDown(x: number) {
        if (this.game.getGameState() !== GameStateTypes.RUNNING) return;
        const panelIndex = Math.trunc(x / 16);

        if (panelIndex == (this.isWindowsLayout ? 9 : 0)) {
            this.deltaReleaseRate = -3;
            this.doReleaseRateChanges();
            return;
        }
        if (panelIndex == (this.isWindowsLayout ? 8 : 1)) {

            this.deltaReleaseRate = 3;
            this.doReleaseRateChanges();
            return;
        }

        if (panelIndex == 10) {
            this.gameTimer.toggle();
            return;
        }

        if (this.isWindowsLayout && panelIndex == 11) {
            this.fastForwardRequestHandler?.();
            return;
        }

        if (panelIndex == (this.isWindowsLayout ? 12 : 11)) {
            this.nukeRequestHandler?.();
            return;
        }

        const newSkill = this.getSkillByPanelIndex(panelIndex);
        if (newSkill == SkillTypes.UNKNOWN) return;

        this.game.queueCommand(new CommandSelectSkill(newSkill));

        this.skillSelectionChanged = true;
    }


    public handleSkillDoubleClick(x: number) {
        if (this.game.getGameState() !== GameStateTypes.RUNNING) return;
        const panelIndex = Math.trunc(x / 16);

        /// trigger the nuke for all lemmings
        if (panelIndex == (this.isWindowsLayout ? 12 : 11) && !this.nukeRequestHandler) {
            this.game.queueCommand(new CommandNuke());
        }
    }

    /** init the display */
    public setGuiDisplay(display: DisplayImage) {
        this.display = display;

        /// handle user input in gui
        this.display.onMouseDown.on((e) => {
            this.deltaReleaseRate = 0;

            if (!e) {
                return;
            }

            if (e.y > 15) {
                this.handleSkillMouseDown(e.x);
            }
        });

        this.display.onMouseUp.on(() => {
            /// clear release rate change
            this.deltaReleaseRate = 0;
        })

        this.display.onDoubleClick.on((e) => {
            /// clear release rate change
            this.deltaReleaseRate = 0;

            if (!e) {
                return;
            }

            if (e.y > 15) {
                this.handleSkillDoubleClick(e.x);
            }

        })


        this.gameTimeChanged = true;
        this.skillsCountChanged = true;
        this.skillSelectionChanged = true;
        this.backgroundChanged = true;
    }


    /** render the gui to the screen display */
    public render() {
        if (!this.display) {
            return;
        }

        const display = this.display;

        /// background
        if (this.backgroundChanged) {
            this.backgroundChanged = false;

            const panelImage = this.skillPanelSprites.getPanelSprite();
            display.initSize(panelImage.width, panelImage.height);
            // The Stage can reuse its GUI display for a different game/mode.
            if (display.getNativeLayers?.()) display.setNativeBackground(null);
            display.setBackground(panelImage.getData());

            if (this.windowsPanel) {
                for (let index = 0; index < this.windowsPanel.length; index++) {
                    const frames = this.windowsAnimations?.[index];
                    const icon = frames ? frames[this.iconAnimationTick % frames.length] : this.windowsPanel[index];
                    display.drawFrameCovered(icon, index * 16, 20, 192, 192, 192);
                }
                if (this.windowsNativePanel) this.setNativeWindowsPanel(display);
            }

            /// redraw everything
            this.gameTimeChanged = true;
            this.skillsCountChanged = true;
            this.skillSelectionChanged = true;
            this.iconAnimationChanged = false;
        } else if (this.iconAnimationChanged && this.windowsPanel) {
            this.iconAnimationChanged = false;
            const background = display.getNativeLayers?.()?.background;
            if (background && this.windowsNativePanel) {
                // Reuse the existing native image rather than allocate an
                // entire panel on every game tick (especially at 4× speed).
                this.paintNativeWindowsIcons(new Uint32Array(background.data.buffer, background.data.byteOffset, background.data.byteLength / 4), background.width, background.height);
            } else {
                for (let index = 0; index < this.windowsPanel.length; index++) {
                    const frames = this.windowsAnimations?.[index];
                    display.drawFrameCovered(frames ? frames[this.iconAnimationTick % frames.length] : this.windowsPanel[index], index * 16, 20, 192, 192, 192);
                }
            }
        }

        /////////
        /// green text
        // IN uses the floor of saved / total, so display the target using
        // the same percentage convention while victory uses exact counts.
        const total = this.gameVictoryCondition.getReleaseCount();
        const needed = this.gameVictoryCondition.getNeedCount();
        // Above 100 lemmings, adjacent counts can have the same displayed
        // percentage. Show the exact count instead of implying an early win.
        const target = total > 100 ? String(needed) : `${this.stringPad(String(total > 0 ? Math.floor(needed / total * 100) : 0), 3)}%`;
        if (this.isWindowsLayout) {
            // Four equally sized fields keep the labels balanced across the
            // toolbar, including the area above the minimap. Painting spaces
            // on both sides also clears digits when values become shorter.
            const fields = [
                `Need ${target}`,
                `Out ${this.gameVictoryCondition.getOutCount()}`,
                `In ${this.gameVictoryCondition.getSurvivorPercentage()}%`,
                `Time ${this.gameTimer.getGameLeftTimeString()}`,
            ];
            fields.forEach((field, index) => {
                const leftPadding = Math.max(0, Math.floor((10 - field.length) / 2));
                this.drawGreenString(display, field.padStart(field.length + leftPadding).padEnd(10), index * 80, 0);
            });
            this.gameTimeChanged = false;
        } else {
            this.drawGreenString(display, `Need ${target}`, 0, 0);
            this.drawGreenString(display, 'Out ' + this.gameVictoryCondition.getOutCount() + '  ', 112, 0);
            this.drawGreenString(display, 'In' + this.stringPad(this.gameVictoryCondition.getSurvivorPercentage() + '', 3) + '%', 186, 0);

            if (this.gameTimeChanged) {
                this.gameTimeChanged = false;
                this.renderGameTime(display, 248, 0);
            }
        }

        /////////
        /// white skill numbers
        this.drawPanelNumber(display, this.gameVictoryCondition.getMinReleaseRate(), this.isWindowsLayout ? 9 : 0);
        this.drawPanelNumber(display, this.gameVictoryCondition.getCurrentReleaseRate(), this.isWindowsLayout ? 8 : 1);

        if (this.skillsCountChanged) {
            this.skillsCountChanged = false;

            for (let i = 1 /* jump over unknown */; i < SkillTypes.length(); i++) {
                const count = this.skills.getSkill(i);
                // Windows leaves unavailable skills blank. The background is
                // rebuilt on count changes, so the last digit is also erased.
                if (this.isWindowsLayout && count <= 0) continue;
                this.drawPanelNumber(display, count, this.getPanelIndexBySkill(i));
            }
        }

        ////////
        /// selected skill
        if (this.skillSelectionChanged) {
            this.skillSelectionChanged = false;
            this.drawSelection(display, this.getPanelIndexBySkill(this.skills.getSelectedSkill()));
            if (this.isWindowsLayout && this.fastForwardActive) this.drawSelection(display, 11);
        }

    }

    /** Composite player-supplied 32×40 artwork onto native grey Windows buttons. */
    private setNativeWindowsPanel(display: DisplayImage): void {
        const image = display.getImageData();
        if (!image || !this.windowsNativePanel) return;
        const width = image.width * 2, height = image.height * 2;
        const pixels = new Uint8ClampedArray(width * height * 4);
        const out = new Uint32Array(pixels.buffer);
        const original = new Uint32Array(image.data.buffer, image.data.byteOffset, image.data.byteLength / 4);
        for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
            const color = original[y * image.width + x], at = y * 2 * width + x * 2;
            out[at] = out[at + 1] = out[at + width] = out[at + width + 1] = color;
        }
        this.paintNativeWindowsIcons(out, width, height);
        display.setNativeBackground(pixels, width, height);
    }

    private paintNativeWindowsIcons(out: Uint32Array, width: number, height: number): void {
        if (!this.windowsNativePanel) return;
        for (let slot = 0; slot < this.windowsNativePanel.length; slot++) {
            const frames = this.windowsNativeAnimations?.[slot];
            const icon = frames ? frames[this.iconAnimationTick % frames.length] : this.windowsNativePanel[slot];
            const source = icon.getBuffer(), mask = icon.getMask();
            for (let y = 0; y < 40; y++) for (let x = 0; x < 32; x++) {
                const destX = slot * 32 + x, destY = 40 + y;
                if (destX >= width || destY >= height) continue;
                // Win95-style raised control edges; icon pixels remain unscaled.
                const base = y === 0 || x === 0 ? 0xffffffff : y === 39 || x === 31 ? 0xff808080 : 0xffc0c0c0;
                out[destY * width + destX] = mask[y * 32 + x] ? source[y * 32 + x] : base;
            }
        }
    }

    /** left pad a string with spaces */
    private stringPad(str: string, length: number): string {
        if (str.length >= length) {
            return str;
        }

        return ' '.repeat(length - str.length) + str;
    }

    /** return the skillType for an index */
    private getSkillByPanelIndex(panelIndex: number): SkillTypes {
        if (this.isWindowsLayout) panelIndex += 2;
        switch (Math.trunc(panelIndex)) {
            case 2: return SkillTypes.CLIMBER;
            case 3: return SkillTypes.FLOATER;
            case 4: return SkillTypes.BOMBER;
            case 5: return SkillTypes.BLOCKER;
            case 6: return SkillTypes.BUILDER;
            case 7: return SkillTypes.BASHER;
            case 8: return SkillTypes.MINER;
            case 9: return SkillTypes.DIGGER;
            default: return SkillTypes.UNKNOWN;
        }
    }

    /** return the index for a skillType */
    private getPanelIndexBySkill(skill: SkillTypes): number {
        if (this.isWindowsLayout) return SkillTypes.isValid(skill) ? skill - 1 : -1;
        switch (skill) {
            case SkillTypes.CLIMBER: return 2;
            case SkillTypes.FLOATER: return 3;
            case SkillTypes.BOMBER: return 4;
            case SkillTypes.BLOCKER: return 5;
            case SkillTypes.BUILDER: return 6;
            case SkillTypes.BASHER: return 7;
            case SkillTypes.MINER: return 8;
            case SkillTypes.DIGGER: return 9;
            default: return -1;
        }
    }

    /** draw a white rectangle border to the panel */
    private drawSelection(display: DisplayImage, panelIndex: number) {
        display.drawRect(16 * panelIndex, 16, 16, 23, 255, 255, 255);
    }

    /** draw the game time to the panel */
    private renderGameTime(display: DisplayImage, x: number, y: number) {
        const gameTime = this.gameTimer.getGameLeftTimeString();

        this.drawGreenString(display, 'Time ' + gameTime + '-00', x, y);
    }

    /** draw a white number to the skill-panel */
    private drawPanelNumber(display: DisplayImage, number: number, panelIndex: number) {
        this.drawNumber(display, number, 4 + 16 * panelIndex, 17);
    }

    /** draw a white number */
    private drawNumber(display: DisplayImage, number: number, x: number, y: number): number {

        if (number > 0) {
            const num1Img = this.skillPanelSprites.getNumberSpriteLeft(Math.floor(number / 10));
            const num2Img = this.skillPanelSprites.getNumberSpriteRight(number % 10);

            display.drawFrameCovered(num1Img, x, y, 0, 0, 0);
            display.drawFrame(num2Img, x, y);
        }
        else {
            const numImg = this.skillPanelSprites.getNumberSpriteEmpty();
            display.drawFrame(numImg, x, y);
        }


        return x + 8;
    }

    /** draw a text with green letters */
    private drawGreenString(display: DisplayImage, text: string, x: number, y: number): number {

        for (let i = 0; i < text.length; i++) {

            const letterImg = this.skillPanelSprites.getLetterSprite(text[i]);

            if (letterImg != null) {
                display.drawFrameCovered(letterImg, x, y, 0, 0, 0);
            }

            x += 8;
        }

        return x;
    }
}

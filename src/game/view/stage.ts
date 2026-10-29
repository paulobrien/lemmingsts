import { Position2D } from '../utilities/position2d';
import { DisplayImage } from './display-image';
import { StageImageProperties } from './stage-image-properties';
import { UserInputManager } from './user-input-manager';

/** handel the display / output of game, gui, ... */
export class Stage {

    private stageCav: HTMLCanvasElement;
    private gameImgProps: StageImageProperties;
    private guiImgProps: StageImageProperties;

    private controller: UserInputManager;
    private pressedImage: StageImageProperties | null = null;
    private pressPosition: Position2D | null = null;
    private dragging = false;
    private keyboardTarget: (() => Position2D | null) | null = null;
    private exampleHint: Position2D | null = null;


    constructor(canvasForOutput: HTMLCanvasElement, zoom = 2) {
        this.controller = new UserInputManager(canvasForOutput);

        this.handleOnMouseUp();
        this.handleOnMouseDown();
        this.handleOnMouseMove();
        this.controller.onCancel.on(() => this.cancelPress());
        this.handleOnDoubleClick();
        this.handelOnZoom();

        this.stageCav = canvasForOutput;

        this.gameImgProps = new StageImageProperties(zoom);

        this.guiImgProps = new StageImageProperties(zoom);

        this.updateStageSize();

        this.clear();
    }

    private calcPosition2D(stageImage: StageImageProperties, e: Position2D): Position2D {
        const x = (stageImage.viewPoint.getSceneX(e.x - stageImage.x));
        const y = (stageImage.viewPoint.getSceneY(e.y - stageImage.y));

        const result = new Position2D(x, y);
        // Keep touch assistance bounded so a tap still selects a nearby lemming.
        result.hitSlop = Math.min(12, e.hitSlop / stageImage.viewPoint.scale);
        return result;
    }


    private handleOnDoubleClick(): void {

        this.controller.onDoubleClick.on((e) => {
            if (!e) {
                return;
            }

            const stageImage = this.getStageImageAt(e.x, e.y);
            if ((stageImage == null) || (stageImage.display == null)) return;

            stageImage.display.onDoubleClick.trigger(this.calcPosition2D(stageImage, e));
        });
    }


    private handleOnMouseDown(): void {

        this.controller.onMouseDown.on((e) => {
            if (!e) {
                return;
            }

            const stageImage = this.getStageImageAt(e.x, e.y);
            if ((stageImage == null) || (stageImage.display == null)) {
                return;
            }

            this.pressedImage = stageImage;
            this.pressPosition = new Position2D(e.x, e.y);
            this.dragging = false;
            // The playfield waits until release so a pan doesn't assign a skill.
            // The panel still receives down immediately for held release-rate buttons.
            if (stageImage !== this.gameImgProps) {
                stageImage.display.onMouseDown.trigger(this.calcPosition2D(stageImage, e));
            }
        });
    }


    private handleOnMouseUp(): void {

        this.controller.onMouseUp.on((e) => {
            if (!e) {
                return;
            }

            const stageImage = this.pressedImage;
            const pressPosition = this.pressPosition;
            this.pressedImage = null;
            this.pressPosition = null;
            if (!stageImage || !stageImage.display || !pressPosition) return;

            const distance = Math.hypot(e.x - pressPosition.x, e.y - pressPosition.y);
            if (stageImage === this.gameImgProps && !this.dragging && distance < 12
                && this.getStageImageAt(e.x, e.y) === stageImage) {
                stageImage.display.onMouseDown.trigger(this.calcPosition2D(stageImage, e));
            }
            stageImage.display.onMouseUp.trigger(this.calcPosition2D(stageImage, e));
        });
    }



    private handleOnMouseMove(): void {
        this.controller.onMouseMove.on((e) => {
            if (!e) {
                return;
            }

            if (e.button) {
                const stageImage = this.pressedImage;
                if (stageImage == null) {
                    return;
                }

                if (stageImage == this.gameImgProps) {
                    if (!this.dragging && this.pressPosition &&
                        Math.hypot(e.x - this.pressPosition.x, e.y - this.pressPosition.y) >= 12) {
                        this.dragging = true;
                        this.updateViewPoint(stageImage, this.pressPosition.x - e.x, this.pressPosition.y - e.y, 0);
                    } else if (this.dragging) {
                        this.updateViewPoint(stageImage, e.deltaX, e.deltaY, 0);
                    }
                }
            }
            else {
                const stageImage = this.getStageImageAt(e.x, e.y);
                if ((stageImage == null) || (stageImage.display == null)) {
                    return;
                }

                const x = e.x - stageImage.x;
                const y = e.y - stageImage.y;

                stageImage.display.onMouseMove.trigger(new Position2D(stageImage.viewPoint.getSceneX(x), stageImage.viewPoint.getSceneY(y)));
            }
        });
    }


    private handelOnZoom(): void {
        this.controller.onZoom.on((e) => {
            if (!e) {
                return;
            }

            const stageImage = this.getStageImageAt(e.x, e.y);
            if (stageImage == null) {
                return;
            }
            this.updateViewPoint(stageImage, 0, 0, e.deltaZoom);
        });
    }

    private cancelPress(): void {
        if (this.pressedImage && this.pressedImage.display && this.pressPosition) {
            this.pressedImage.display.onMouseUp.trigger(this.calcPosition2D(this.pressedImage, this.pressPosition));
        }
        this.pressedImage = null;
        this.pressPosition = null;
        this.dragging = false;
    }

    public zoomGame(delta: number): void {
        this.updateViewPoint(this.gameImgProps, 0, 0, delta);
    }

    /** Follow and outline a keyboard-selected lemming without changing terrain. */
    public setKeyboardTarget(target: (() => Position2D | null) | null): void {
        this.keyboardTarget = target;
        this.redraw();
    }

    /** Mark a position from a tested example; it is not live advice. */
    public setExampleHint(position: Position2D | null): void {
        this.exampleHint = position;
        if (position) this.revealGamePosition(position.x, position.y);
        else this.redraw();
    }

    public revealGamePosition(x: number, y: number): void {
        const image = this.gameImgProps;
        const desiredX = x - image.width / image.viewPoint.scale / 2;
        const desiredY = y - image.height / image.viewPoint.scale / 2;
        this.updateViewPoint(image, (desiredX - image.viewPoint.x) * image.viewPoint.scale,
            (desiredY - image.viewPoint.y) * image.viewPoint.scale, 0);
    }

    /** Remove listeners belonging to the previous game before attaching a new one. */
    public clearInputBindings(): void {
        this.cancelPress();
        for (const image of [this.gameImgProps.display, this.guiImgProps.display]) {
            if (!image) continue;
            image.onMouseDown.dispose();
            image.onMouseUp.dispose();
            image.onMouseMove.dispose();
            image.onDoubleClick.dispose();
        }
    }

    public dispose(): void {
        this.cancelPress();
        this.keyboardTarget = null;
        this.exampleHint = null;
        this.controller.dispose();
        this.resetFade();
    }


    private updateViewPoint(stageImage: StageImageProperties, deltaX: number, deltaY: number, deltaZoom: number) {
        if (!stageImage.display) {
            return;
        }

        stageImage.viewPoint.scale += deltaZoom * 0.5;
        stageImage.viewPoint.scale = this.limitValue(0.5, stageImage.viewPoint.scale, 10);

        stageImage.viewPoint.x += deltaX / stageImage.viewPoint.scale;
        stageImage.viewPoint.y += deltaY / stageImage.viewPoint.scale;

        stageImage.viewPoint.x = this.limitValue(0, stageImage.viewPoint.x, stageImage.display.getWidth() - stageImage.width / stageImage.viewPoint.scale);
        stageImage.viewPoint.y = this.limitValue(0, stageImage.viewPoint.y, stageImage.display.getHeight() - stageImage.height / stageImage.viewPoint.scale);


        /// redraw
        this.clear(stageImage);
        const gameImg = stageImage.display.getImageData();

        if (!gameImg) {
            return;
        }

        this.draw(stageImage, gameImg);

    }

    private limitValue(minLimit: number, value: number, maxLimit: number): number {

        const useMax = Math.max(minLimit, maxLimit);

        return Math.min(Math.max(minLimit, value), useMax);
    }

    public updateStageSize() {

        const ctx = this.stageCav.getContext('2d');
        if (!ctx) {
            return;
        }

        const stageHeight = ctx.canvas.height;
        const stageWidth = ctx.canvas.width;

        this.gameImgProps.y = 0;
        this.gameImgProps.height = stageHeight - 100;
        this.gameImgProps.width = stageWidth;

        this.guiImgProps.y = stageHeight - 100;
        this.guiImgProps.height = 100;
        this.guiImgProps.width = stageWidth;

    }

    public getStageImageAt(x: number, y: number): StageImageProperties | null {
        if (this.isPositionInStageImage(this.gameImgProps, x, y)) {
            return this.gameImgProps;
        }

        if (this.isPositionInStageImage(this.guiImgProps, x, y)) {
            return this.guiImgProps;
        }

        return null;
    }

    private isPositionInStageImage(stageImage: StageImageProperties, x: number, y: number) {
        return ((stageImage.x <= x) && ((stageImage.x + stageImage.width) >= x)
            && (stageImage.y <= y) && ((stageImage.y + stageImage.height) >= y));
    }

    public getGameDisplay(): DisplayImage {
        if (this.gameImgProps.display) {
            return this.gameImgProps.display;
        }

        this.gameImgProps.display = new DisplayImage(this);

        return this.gameImgProps.display;
    }

    public getGuiDisplay(): DisplayImage {
        if (this.guiImgProps.display) {
            return this.guiImgProps.display;
        }

        this.guiImgProps.display = new DisplayImage(this);

        return this.guiImgProps.display;
    }

    /** set the position of the view point for the game display */
    public setGameViewPointPosition(x: number, y: number): void {
        this.gameImgProps.viewPoint.x = x;
        this.gameImgProps.viewPoint.y = y;


    }

    /** redraw everything */
    public redraw() {
        if (this.gameImgProps.display) {
            const gameImg = this.gameImgProps.display.getImageData();

            if (gameImg) {
                this.draw(this.gameImgProps, gameImg);
            }
        }

        if (this.guiImgProps.display) {
            const guiImg = this.guiImgProps.display.getImageData();

            if (guiImg) {
                this.draw(this.guiImgProps, guiImg);
            }
        }
    }


    public createImage(display: DisplayImage, width: number, height: number): ImageData | null {
        if (display == this.gameImgProps.display) {
            return this.gameImgProps.createImage(width, height);
        }
        else {
            return this.guiImgProps.createImage(width, height);
        }
    }

    /** clear the stage/display/output */
    public clear(stageImage?: StageImageProperties) {
        const ctx = this.stageCav.getContext('2d');
        if (!ctx) {
            return;
        }

        ctx.fillStyle = '#000000';

        if (stageImage == null) {
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
        else {
            ctx.fillRect(stageImage.x, stageImage.y, stageImage.width, stageImage.height);
        }
    }

    private fadeTimer = 0;
    private fadeAlpha = 0;

    public resetFade() {
        this.fadeAlpha = 0;

        if (this.fadeTimer != 0) {
            clearInterval(this.fadeTimer);
            this.fadeTimer = 0;
        }
    }

    public startFadeOut() {

        this.resetFade();

        this.fadeTimer = window.setInterval(() => {
            this.fadeAlpha = Math.min(this.fadeAlpha + 0.02, 1);

            if (this.fadeAlpha <= 0) {
                clearInterval(this.fadeTimer);
            }
        }, 40);

    }

    /** draw everything to the stage/display */
    private draw(display: StageImageProperties, img: ImageData) {

        if (!display.ctx) {
            return;
        }

        /// write image to context
        display.ctx.putImageData(img, 0, 0);

        const ctx = this.stageCav.getContext('2d');
        if (!ctx) {
            return;
        }

        ctx.imageSmoothingEnabled = false;

        const outH = display.height;
        const outW = display.width;

        ctx.globalAlpha = 1;

        //- Display Layers
        let dW = img.width - display.viewPoint.x; //- display width
        if ((dW * display.viewPoint.scale) > outW) {
            dW = outW / display.viewPoint.scale;
        }

        let dH = img.height - display.viewPoint.y; //- display height
        if ((dH * display.viewPoint.scale) > outH) {
            dH = outH / display.viewPoint.scale;
        }

        if (!display.cav) {
            return;
        }

        //- drawImage(image,sx,sy,sw,sh,dx,dy,dw,dh)
        ctx.drawImage(display.cav,
            display.viewPoint.x, display.viewPoint.y, dW, dH,
            display.x, display.y, Math.trunc(dW * display.viewPoint.scale), Math.trunc(dH * display.viewPoint.scale));

        if (display === this.gameImgProps && this.exampleHint) {
            const scale = display.viewPoint.scale;
            const x = display.x + (this.exampleHint.x - display.viewPoint.x) * scale;
            const y = display.y + (this.exampleHint.y - display.viewPoint.y) * scale;
            ctx.save();
            ctx.beginPath();
            ctx.rect(display.x, display.y, display.width, display.height);
            ctx.clip();
            ctx.strokeStyle = '#68e4ff';
            ctx.lineWidth = 3;
            ctx.strokeRect(x - 9 * scale, y - 17 * scale, 18 * scale, 20 * scale);
            ctx.restore();
        }

        if (display === this.gameImgProps && this.keyboardTarget) {
            const target = this.keyboardTarget();
            if (target) {
                const scale = display.viewPoint.scale;
                const x = display.x + (target.x - display.viewPoint.x) * scale;
                const y = display.y + (target.y - display.viewPoint.y) * scale;
                ctx.save();
                ctx.beginPath();
                ctx.rect(display.x, display.y, display.width, display.height);
                ctx.clip();
                ctx.strokeStyle = '#ffed76';
                ctx.lineWidth = 2;
                ctx.strokeRect(x - 7 * scale, y - 15 * scale, 14 * scale, 17 * scale);
                ctx.restore();
            }
        }

        //- apply fading
        if (this.fadeAlpha != 0) {
            ctx.globalAlpha = this.fadeAlpha;
            ctx.fillStyle = 'black';
            ctx.fillRect(display.x, display.y, Math.trunc(dW * display.viewPoint.scale), Math.trunc(dH * display.viewPoint.scale));
        }

    }
}

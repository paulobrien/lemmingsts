import { Position2D } from '../utilities/position2d';
import { EventHandler } from '../utilities/event-handler';
import { DisplayImage } from './display-image';
import { upscalePixelArt2x } from './pixel-art-upscale';
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
    private graphicsMode: 'original' | 'enhanced' = 'original';
    private comparisonOriginal: HTMLCanvasElement | null = null;
    private comparisonEnhanced: HTMLCanvasElement | null = null;
    private enhancedCanvas: HTMLCanvasElement | null = null;
    private enhancedContext: CanvasRenderingContext2D | null = null;
    private cropPixels: Uint8ClampedArray<ArrayBuffer> | null = null;
    private enhancedPixels: Uint8ClampedArray<ArrayBuffer> | null = null;
    private enhancedImage: ImageData | null = null;
    public readonly onGraphicsError = new EventHandler<string>();
    /** True when the playfield is away from its starting scale. */
    public readonly onZoomChange = new EventHandler<boolean>();
    private readonly defaultZoom: number;


    constructor(canvasForOutput: HTMLCanvasElement, zoom = 2) {
        this.defaultZoom = zoom;
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
            // The classic panel must stay at its original scale; wheel zoom is
            // for inspecting the level only.
            if (stageImage !== this.gameImgProps || !stageImage.display) {
                return;
            }
            const scene = this.calcPosition2D(stageImage, e);
            if (scene.x < 0 || scene.y < 0 || scene.x >= stageImage.display.getWidth() || scene.y >= stageImage.display.getHeight()) return;
            e.handled = true;
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

    /** Restore the level scale without moving its camera more than bounds require. */
    public resetZoom(): void {
        const image = this.gameImgProps;
        this.updateViewPoint(image, 0, 0, (this.defaultZoom - image.viewPoint.scale) / 0.5);
    }

    /** Graphics modes affect presentation only; simulation and input stay unchanged. */
    public setGraphicsMode(mode: 'original' | 'enhanced'): void {
        this.graphicsMode = mode;
        if (mode === 'original' && !this.comparisonEnhanced) this.releaseEnhancedFrame();
        this.redraw();
    }

    /** Read-only comparison canvases receive the same scene and camera as play. */
    public setComparisonCanvases(original: HTMLCanvasElement | null, enhanced: HTMLCanvasElement | null): void {
        this.comparisonOriginal = original && enhanced ? original : null;
        this.comparisonEnhanced = original && enhanced ? enhanced : null;
        if (!this.comparisonEnhanced && this.graphicsMode === 'original') this.releaseEnhancedFrame();
        if (this.comparisonOriginal && this.comparisonEnhanced) {
            for (const canvas of [this.comparisonOriginal, this.comparisonEnhanced]) {
                canvas.width = this.stageCav.width;
                canvas.height = this.stageCav.height;
                if (!canvas.getContext('2d')) {
                    this.failEnhancedGraphics();
                    break;
                }
            }
        }
        this.clear();
        this.redraw();
    }

    private releaseEnhancedFrame(): void {
        if (this.enhancedCanvas) { this.enhancedCanvas.width = 0; this.enhancedCanvas.height = 0; }
        this.enhancedCanvas = null;
        this.enhancedContext = null;
        this.cropPixels = null;
        this.enhancedPixels = null;
        this.enhancedImage = null;
    }

    private failEnhancedGraphics(): void {
        this.graphicsMode = 'original';
        this.comparisonOriginal = null;
        this.comparisonEnhanced = null;
        this.releaseEnhancedFrame();
        this.onGraphicsError.trigger('Enhanced graphics are unavailable. Original graphics have been restored.');
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
        this.comparisonOriginal = null;
        this.comparisonEnhanced = null;
        this.releaseEnhancedFrame();
        this.onGraphicsError.dispose();
        this.onZoomChange.dispose();
        this.controller.dispose();
        this.resetFade();
    }


    private updateViewPoint(stageImage: StageImageProperties, deltaX: number, deltaY: number, deltaZoom: number) {
        if (!stageImage.display) {
            return;
        }

        const previousScale = stageImage.viewPoint.scale;
        stageImage.viewPoint.scale += deltaZoom * 0.5;
        stageImage.viewPoint.scale = this.limitValue(0.5, stageImage.viewPoint.scale, 10);

        stageImage.viewPoint.x += deltaX / stageImage.viewPoint.scale;
        stageImage.viewPoint.y += deltaY / stageImage.viewPoint.scale;

        stageImage.viewPoint.x = this.limitValue(0, stageImage.viewPoint.x, stageImage.display.getWidth() - stageImage.width / stageImage.viewPoint.scale);
        stageImage.viewPoint.y = this.limitValue(0, stageImage.viewPoint.y, stageImage.display.getHeight() - stageImage.height / stageImage.viewPoint.scale);

        if (stageImage === this.gameImgProps && stageImage.viewPoint.scale !== previousScale) {
            this.onZoomChange.trigger(this.gameImgProps.viewPoint.scale !== this.defaultZoom);
        }


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
        for (const canvas of [this.stageCav, this.comparisonOriginal, this.comparisonEnhanced]) {
            if (!canvas) continue;
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;
            ctx.fillStyle = '#000000';
            if (stageImage == null) ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            else ctx.fillRect(stageImage.x, stageImage.y, stageImage.width, stageImage.height);
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

    /** Filter only the visible world crop plus a one-pixel neighbour border. */
    private createEnhancedViewport(display: StageImageProperties, img: ImageData, width: number, height: number) {
        const left = Math.max(0, Math.floor(display.viewPoint.x) - 1);
        const top = Math.max(0, Math.floor(display.viewPoint.y) - 1);
        const right = Math.min(img.width, Math.ceil(display.viewPoint.x + width) + 1);
        const bottom = Math.min(img.height, Math.ceil(display.viewPoint.y + height) + 1);
        const cropWidth = right - left, cropHeight = bottom - top;
        if (cropWidth < 1 || cropHeight < 1) throw new Error('Empty game viewport');
        if (!this.enhancedCanvas) {
            this.enhancedCanvas = document.createElement('canvas');
            this.enhancedContext = this.enhancedCanvas.getContext('2d');
            if (!this.enhancedContext) throw new Error('Canvas unavailable');
        }
        if (!this.cropPixels || this.cropPixels.length !== cropWidth * cropHeight * 4 ||
            this.enhancedCanvas.width !== cropWidth * 2 || this.enhancedCanvas.height !== cropHeight * 2) {
            this.cropPixels = new Uint8ClampedArray(cropWidth * cropHeight * 4);
            this.enhancedPixels = new Uint8ClampedArray(cropWidth * cropHeight * 16);
            this.enhancedImage = new ImageData(this.enhancedPixels, cropWidth * 2, cropHeight * 2);
            this.enhancedCanvas.width = cropWidth * 2;
            this.enhancedCanvas.height = cropHeight * 2;
        }
        for (let row = 0; row < cropHeight; row++) {
            const start = ((top + row) * img.width + left) * 4;
            this.cropPixels.set(img.data.subarray(start, start + cropWidth * 4), row * cropWidth * 4);
        }
        upscalePixelArt2x(this.cropPixels, cropWidth, cropHeight, this.enhancedPixels!);
        this.enhancedContext!.putImageData(this.enhancedImage!, 0, 0);
        return { canvas: this.enhancedCanvas, x: (display.viewPoint.x - left) * 2,
            y: (display.viewPoint.y - top) * 2, width: width * 2, height: height * 2 };
    }

    /** draw everything to the stage/display */
    private draw(display: StageImageProperties, img: ImageData) {

        if (!display.ctx) {
            return;
        }

        /// write image to context
        display.ctx.putImageData(img, 0, 0);

        const outH = display.height;
        const outW = display.width;

        //- Display Layers
        let dW = img.width - display.viewPoint.x; //- display width
        if ((dW * display.viewPoint.scale) > outW) {
            dW = outW / display.viewPoint.scale;
        }

        let dH = img.height - display.viewPoint.y; //- display height
        if ((dH * display.viewPoint.scale) > outH) {
            dH = outH / display.viewPoint.scale;
        }

        if (!display.cav || dW <= 0 || dH <= 0) return;

        let enhanced: ReturnType<Stage['createEnhancedViewport']> | null = null;
        if (display === this.gameImgProps && (this.graphicsMode === 'enhanced' || this.comparisonEnhanced)) {
            try {
                enhanced = this.createEnhancedViewport(display, img, dW, dH);
            } catch {
                // A renderer failure must not interrupt the simulation or leave
                // stale comparison previews on screen.
                this.failEnhancedGraphics();
            }
        }

        const targets: Array<{ canvas: HTMLCanvasElement | null; enhanced: boolean }> = [
            { canvas: this.stageCav, enhanced: this.graphicsMode === 'enhanced' },
            { canvas: this.comparisonOriginal, enhanced: false },
            { canvas: this.comparisonEnhanced, enhanced: true },
        ];
        for (const target of targets) {
            if (!target.canvas) continue;
            const ctx = target.canvas.getContext('2d');
            if (!ctx) continue;
            ctx.imageSmoothingEnabled = false;
            ctx.globalAlpha = 1;
            const filtered = target.enhanced && enhanced;
            let failed = false;
            try {
                ctx.drawImage(filtered ? filtered.canvas : display.cav,
                    filtered ? filtered.x : display.viewPoint.x, filtered ? filtered.y : display.viewPoint.y,
                    filtered ? filtered.width : dW, filtered ? filtered.height : dH,
                    display.x, display.y, Math.trunc(dW * display.viewPoint.scale), Math.trunc(dH * display.viewPoint.scale));
            } catch (error) {
                if (!filtered) throw error;
                this.failEnhancedGraphics();
                if (target.canvas !== this.stageCav) break;
                ctx.drawImage(display.cav, display.viewPoint.x, display.viewPoint.y, dW, dH,
                    display.x, display.y, Math.trunc(dW * display.viewPoint.scale), Math.trunc(dH * display.viewPoint.scale));
                failed = true;
            }

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
                const selected = this.keyboardTarget();
                if (selected) {
                    const scale = display.viewPoint.scale;
                    const x = display.x + (selected.x - display.viewPoint.x) * scale;
                    const y = display.y + (selected.y - display.viewPoint.y) * scale;
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
            if (failed) break;
        }

    }
}

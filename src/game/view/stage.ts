import { Position2D } from '../utilities/position2d';
import { EventHandler } from '../utilities/event-handler';
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
    private nativeCanvas: HTMLCanvasElement | null = null;
    private nativeForegroundCanvas: HTMLCanvasElement | null = null;
    private nativeGuiCanvas: HTMLCanvasElement | null = null;
    private nativeGuiForegroundCanvas: HTMLCanvasElement | null = null;
    private minimapLemmings: (() => readonly { x: number; y: number }[]) | null = null;
    private minimapDragging = false;
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

    /** Centre a playfield that does not fill the viewport; the panel stays fixed. */
    private contentOffset(stageImage: StageImageProperties): Position2D {
        if (!stageImage.display) return new Position2D(0, 0);
        if (stageImage === this.guiImgProps && this.minimapLemmings) {
            return new Position2D(Math.max(0, Math.floor((stageImage.width - stageImage.display.getWidth() * stageImage.viewPoint.scale) / 2)), 0);
        }
        if (stageImage !== this.gameImgProps) return new Position2D(0, 0);
        const width = stageImage.display.getWidth(), height = stageImage.display.getHeight();
        if (!width || !height) return new Position2D(0, 0);
        const scale = stageImage.viewPoint.scale;
        return new Position2D(Math.max(0, Math.floor((stageImage.width - width * scale) / 2)),
            Math.max(0, Math.floor((stageImage.height - height * scale) / 2)));
    }

    private calcPosition2D(stageImage: StageImageProperties, e: Position2D): Position2D {
        const offset = this.contentOffset(stageImage);
        const x = (stageImage.viewPoint.getSceneX(e.x - stageImage.x - offset.x));
        const y = (stageImage.viewPoint.getSceneY(e.y - stageImage.y - offset.y));

        const result = new Position2D(x, y);
        // Keep touch assistance bounded so a tap still selects a nearby lemming.
        result.hitSlop = Math.min(12, e.hitSlop / stageImage.viewPoint.scale);
        return result;
    }

    /** Do not target the edge of a level by tapping its empty margins. */
    private isInContent(stageImage: StageImageProperties, e: Position2D): boolean {
        if (!stageImage.display || (stageImage !== this.gameImgProps && !(stageImage === this.guiImgProps && this.minimapLemmings))) return true;
        const width = stageImage.display.getWidth(), height = stageImage.display.getHeight();
        if (!width || !height) return true;
        const offset = this.contentOffset(stageImage), scale = stageImage.viewPoint.scale;
        const x = e.x - stageImage.x - offset.x, y = e.y - stageImage.y - offset.y;
        return x >= 0 && y >= 0 && x < width * scale && y < height * scale;
    }


    private handleOnDoubleClick(): void {

        this.controller.onDoubleClick.on((e) => {
            if (!e) {
                return;
            }

            if (this.isOnMinimap(e)) return;

            const stageImage = this.getStageImageAt(e.x, e.y);
            if ((stageImage == null) || (stageImage.display == null) || !this.isInContent(stageImage, e)) return;

            stageImage.display.onDoubleClick.trigger(this.calcPosition2D(stageImage, e));
        });
    }


    private handleOnMouseDown(): void {

        this.controller.onMouseDown.on((e) => {
            if (!e) {
                return;
            }

            if (this.isOnMinimap(e)) {
                this.minimapDragging = true;
                this.navigateMinimap(e);
                return;
            }

            const stageImage = this.getStageImageAt(e.x, e.y);
            if ((stageImage == null) || (stageImage.display == null) || !this.isInContent(stageImage, e)) {
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

            if (this.minimapDragging) {
                this.minimapDragging = false;
                return;
            }

            const stageImage = this.pressedImage;
            const pressPosition = this.pressPosition;
            this.pressedImage = null;
            this.pressPosition = null;
            if (!stageImage || !stageImage.display || !pressPosition) return;

            const distance = Math.hypot(e.x - pressPosition.x, e.y - pressPosition.y);
            if (stageImage === this.gameImgProps && !this.dragging && distance < 12
                && this.getStageImageAt(e.x, e.y) === stageImage && this.isInContent(stageImage, e)) {
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

            if (this.minimapDragging && e.button) {
                this.navigateMinimap(e);
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
                if ((stageImage == null) || (stageImage.display == null) || !this.isInContent(stageImage, e)) {
                    return;
                }

                stageImage.display.onMouseMove.trigger(this.calcPosition2D(stageImage, e));
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
            if (stageImage !== this.gameImgProps || !stageImage.display || !this.isInContent(stageImage, e)) {
                return;
            }
            const scene = this.calcPosition2D(stageImage, e);
            if (scene.x < 0 || scene.y < 0 || scene.x >= stageImage.display.getWidth() || scene.y >= stageImage.display.getHeight()) return;
            e.handled = true;
            this.updateViewPoint(stageImage, 0, 0, e.deltaZoom);
        });
    }

    private cancelPress(): void {
        this.minimapDragging = false;
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

    /** Enable the Windows micro-map for a live game, or remove it on teardown. */
    public setMinimapProvider(provider: (() => readonly { x: number; y: number }[]) | null): void {
        this.minimapLemmings = provider;
        this.minimapDragging = false;
        this.updateWindowsPanelScale();
        // Clear both margins when switching between centred Windows and DOS panels.
        this.clear(this.guiImgProps);
        this.redraw();
    }

    /** Fill more of the stage with the Windows panel while preserving its proportions. */
    private updateWindowsPanelScale(): void {
        if (!this.minimapLemmings) {
            this.guiImgProps.viewPoint.scale = this.defaultZoom;
            return;
        }
        const width = this.guiImgProps.display?.getWidth() || 320;
        const height = this.guiImgProps.display?.getHeight() || 40;
        this.guiImgProps.viewPoint.scale = Math.min(this.defaultZoom * 1.15,
            this.guiImgProps.width / width, this.guiImgProps.height / height);
    }

    /** Move the camera by logical world pixels (also available to keyboard controls). */
    public panGameBy(x: number, y = 0): void {
        const scale = this.gameImgProps.viewPoint.scale;
        this.updateViewPoint(this.gameImgProps, x * scale, y * scale, 0);
    }

    /** The map occupies the free part of the Windows bar, to the right of its icons. */
    private minimapBounds(): { x: number; y: number; width: number; height: number } | null {
        if (!this.minimapLemmings || !this.gameImgProps.display?.getWidth() || !this.gameImgProps.display.getHeight()) return null;
        const panelX = this.guiImgProps.x + this.contentOffset(this.guiImgProps).x;
        const x = panelX + 13 * 16 * this.guiImgProps.viewPoint.scale + 8;
        const y = this.guiImgProps.y + 20 * this.guiImgProps.viewPoint.scale;
        const panelWidth = Math.min(this.guiImgProps.width,
            (this.guiImgProps.display?.getWidth() ?? 0) * this.guiImgProps.viewPoint.scale);
        const width = panelWidth - (x - panelX) - 8;
        const height = Math.min(20 * this.guiImgProps.viewPoint.scale, this.guiImgProps.height - (y - this.guiImgProps.y));
        return width > 4 && height > 4 ? { x, y, width, height } : null;
    }

    private isOnMinimap(point: Position2D): boolean {
        const bounds = this.minimapBounds();
        return !!bounds && point.x >= bounds.x && point.x < bounds.x + bounds.width &&
            point.y >= bounds.y && point.y < bounds.y + bounds.height;
    }

    private navigateMinimap(point: Position2D): void {
        const bounds = this.minimapBounds();
        const display = this.gameImgProps.display;
        if (!bounds || !display) return;
        const clamp = (value: number) => Math.max(0, Math.min(1, value));
        this.revealGamePosition(clamp((point.x - bounds.x) / bounds.width) * display.getWidth(),
            clamp((point.y - bounds.y) / bounds.height) * display.getHeight());
    }

    /** Paint the current scene, live lemmings and the yellow camera rectangle. */
    private drawMinimap(): void {
        const bounds = this.minimapBounds();
        const image = this.gameImgProps;
        if (!bounds || !image.cav || !image.display || !this.minimapLemmings) return;
        const ctx = this.stageCav.getContext('2d');
        if (!ctx) return;
        const width = image.display.getWidth(), height = image.display.getHeight();
        ctx.save();
        ctx.beginPath();
        ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.clip();
        ctx.fillStyle = '#000';
        ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.imageSmoothingEnabled = false;
        // The already-composited Windows layer preserves the player's native
        // terrain and animated objects; logical art remains a safe fallback.
        const source = image.display.getNativeLayers() && this.nativeCanvas ? this.nativeCanvas : image.cav;
        // The original micro-map renders the terrain in grey, with coloured
        // lemmings and viewport drawn over it. Keep this processing local.
        const supportsFilter = typeof ctx.filter === 'string';
        if (supportsFilter) ctx.filter = 'grayscale(1)';
        ctx.drawImage(source, 0, 0, source.width, source.height, bounds.x, bounds.y, bounds.width, bounds.height);
        if (supportsFilter) {
            ctx.filter = 'none';
        } else {
            ctx.globalCompositeOperation = 'saturation';
            ctx.fillStyle = '#808080';
            ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.fillStyle = '#00ff00';
        for (const lemming of this.minimapLemmings()) {
            if (lemming.x >= 0 && lemming.x < width && lemming.y >= 0 && lemming.y < height) {
                ctx.fillRect(bounds.x + Math.floor(lemming.x / width * bounds.width),
                    bounds.y + Math.floor(lemming.y / height * bounds.height), 2, 2);
            }
        }
        const viewWidth = Math.min(width, image.width / image.viewPoint.scale);
        const viewHeight = Math.min(height, image.height / image.viewPoint.scale);
        const left = bounds.x + image.viewPoint.x / width * bounds.width;
        const top = bounds.y + image.viewPoint.y / height * bounds.height;
        const right = Math.min(bounds.x + bounds.width - 1, left + viewWidth / width * bounds.width);
        const bottom = Math.min(bounds.y + bounds.height - 1, top + viewHeight / height * bounds.height);
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.floor(left) + .5, Math.floor(top) + .5,
            Math.max(0, Math.floor(right - left) - 1), Math.max(0, Math.floor(bottom - top) - 1));
        ctx.restore();
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
        this.minimapLemmings = null;
        this.minimapDragging = false;
        this.nativeCanvas = null;
        this.nativeForegroundCanvas = null;
        this.nativeGuiCanvas = null;
        this.nativeGuiForegroundCanvas = null;
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

        if (stageImage === this.gameImgProps) this.drawMinimap();

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
        this.updateWindowsPanelScale();

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
        this.drawMinimap();
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
        for (const canvas of [this.stageCav]) {
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

    /** draw everything to the stage/display */
    private draw(display: StageImageProperties, img: ImageData) {

        if (!display.ctx) {
            return;
        }

        /// write image to context
        display.ctx.putImageData(img, 0, 0);

        const outH = display.height;
        const outW = display.width;

        // Starting positions can be set before the level image exists. Clamp
        // them once the dimensions are known, including for small levels.
        if (display === this.gameImgProps) {
            display.viewPoint.x = this.limitValue(0, display.viewPoint.x, img.width - outW / display.viewPoint.scale);
            display.viewPoint.y = this.limitValue(0, display.viewPoint.y, img.height - outH / display.viewPoint.scale);
        }
        const offset = this.contentOffset(display);
        const destX = display.x + offset.x, destY = display.y + offset.y;

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

        // Compose native artwork at its original 2× resolution when available.
        let nativeCanvas: HTMLCanvasElement | null = null;
        const native = display.display?.getNativeLayers();
        if (native) {
            try {
                const game = display === this.gameImgProps;
                if (game) {
                    if (!this.nativeCanvas) this.nativeCanvas = document.createElement('canvas');
                    if (!this.nativeForegroundCanvas) this.nativeForegroundCanvas = document.createElement('canvas');
                } else {
                    if (!this.nativeGuiCanvas) this.nativeGuiCanvas = document.createElement('canvas');
                    if (!this.nativeGuiForegroundCanvas) this.nativeGuiForegroundCanvas = document.createElement('canvas');
                }
                const backCanvas = (game ? this.nativeCanvas : this.nativeGuiCanvas)!;
                const frontCanvas = (game ? this.nativeForegroundCanvas : this.nativeGuiForegroundCanvas)!;
                for (const canvas of [backCanvas, frontCanvas]) {
                    if (canvas.width !== native.background.width || canvas.height !== native.background.height) {
                        canvas.width = native.background.width;
                        canvas.height = native.background.height;
                    }
                }
                const background = backCanvas.getContext('2d');
                const foreground = frontCanvas.getContext('2d');
                if (!background || !foreground) throw new Error('Native graphics canvas unavailable');
                background.putImageData(native.background, 0, 0);
                foreground.putImageData(native.foreground, 0, 0);
                background.drawImage(frontCanvas, 0, 0);
                nativeCanvas = backCanvas;
            } catch {
                if (display === this.gameImgProps) { this.nativeCanvas = null; this.nativeForegroundCanvas = null; }
                else { this.nativeGuiCanvas = null; this.nativeGuiForegroundCanvas = null; }
                display.display?.rejectNativeBackground();
            }
        } else if (display === this.gameImgProps) {
            this.nativeCanvas = null;
            this.nativeForegroundCanvas = null;
        } else {
            this.nativeGuiCanvas = null;
            this.nativeGuiForegroundCanvas = null;
        }

        const ctx = this.stageCav.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 1;
        // Transparent erased terrain must replace pixels from the prior frame.
        if (display === this.gameImgProps) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(display.x, display.y, display.width, display.height);
        }
        if (nativeCanvas) {
            ctx.drawImage(nativeCanvas, display.viewPoint.x * 2, display.viewPoint.y * 2, dW * 2, dH * 2,
                destX, destY, Math.trunc(dW * display.viewPoint.scale), Math.trunc(dH * display.viewPoint.scale));
        } else {
            ctx.drawImage(display.cav, display.viewPoint.x, display.viewPoint.y, dW, dH,
                destX, destY, Math.trunc(dW * display.viewPoint.scale), Math.trunc(dH * display.viewPoint.scale));
        }

        if (display === this.gameImgProps && this.exampleHint) {
            const scale = display.viewPoint.scale;
            const x = destX + (this.exampleHint.x - display.viewPoint.x) * scale;
            const y = destY + (this.exampleHint.y - display.viewPoint.y) * scale;
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
                const x = destX + (selected.x - display.viewPoint.x) * scale;
                const y = destY + (selected.y - display.viewPoint.y) * scale;
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
            ctx.fillRect(destX, destY, Math.trunc(dW * display.viewPoint.scale), Math.trunc(dH * display.viewPoint.scale));
        }
    }
}

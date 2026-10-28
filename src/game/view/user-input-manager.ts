import { EventHandler } from '../utilities/event-handler';
import { Position2D } from '../utilities/position2d';

export class MouseMoveEventArguments extends Position2D {
    public mouseDownX = 0;
    public mouseDownY = 0;

    constructor(x = 0, y = 0, public deltaX = 0, public deltaY = 0, public button = false) {
        super(x, y);
    }
}

export class ZoomEventArguments extends Position2D {
    constructor(x = 0, y = 0, public deltaZoom = 0) {
        super(x, y);
    }
}

/** Translates pointer coordinates from CSS pixels to the canvas's drawing space. */
export class UserInputManager {
    private activePointer: number | null = null;
    private activePointerType = '';
    private mouseDownX = 0;
    private mouseDownY = 0;
    private lastMouseX = 0;
    private lastMouseY = 0;

    public onMouseMove = new EventHandler<MouseMoveEventArguments>();
    public onMouseUp = new EventHandler<Position2D>();
    public onMouseDown = new EventHandler<Position2D>();
    public onCancel = new EventHandler<void>();
    public onDoubleClick = new EventHandler<Position2D>();
    public onZoom = new EventHandler<ZoomEventArguments>();

    constructor(private element: HTMLCanvasElement) {
        element.addEventListener('pointerdown', this.pointerDown);
        element.addEventListener('pointermove', this.pointerMove);
        element.addEventListener('pointerup', this.pointerUp);
        element.addEventListener('pointercancel', this.pointerCancel);
        element.addEventListener('lostpointercapture', this.pointerCancel);
        element.addEventListener('dblclick', this.doubleClick);
        element.addEventListener('wheel', this.wheel, { passive: false });
    }

    public dispose(): void {
        this.element.removeEventListener('pointerdown', this.pointerDown);
        this.element.removeEventListener('pointermove', this.pointerMove);
        this.element.removeEventListener('pointerup', this.pointerUp);
        this.element.removeEventListener('pointercancel', this.pointerCancel);
        this.element.removeEventListener('lostpointercapture', this.pointerCancel);
        this.element.removeEventListener('dblclick', this.doubleClick);
        this.element.removeEventListener('wheel', this.wheel);
        this.activePointer = null;
    }

    private getRelativePosition(clientX: number, clientY: number): Position2D {
        const rect = this.element.getBoundingClientRect();
        // The drawing buffer stays fixed while CSS makes the canvas responsive.
        const scaleX = rect.width ? this.element.width / rect.width : 1;
        const scaleY = rect.height ? this.element.height / rect.height : 1;
        return new Position2D((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    }

    private pointerDown = (event: PointerEvent): void => {
        if (this.activePointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
        this.activePointer = event.pointerId;
        this.activePointerType = event.pointerType;
        const position = this.getRelativePosition(event.clientX, event.clientY);
        this.mouseDownX = this.lastMouseX = position.x;
        this.mouseDownY = this.lastMouseY = position.y;
        this.element.setPointerCapture?.(event.pointerId);
        this.onMouseDown.trigger(position);
        event.preventDefault();
    };

    private pointerMove = (event: PointerEvent): void => {
        if (this.activePointer !== null && event.pointerId !== this.activePointer) return;
        const position = this.getRelativePosition(event.clientX, event.clientY);
        const pressed = this.activePointer === event.pointerId;
        const args = new MouseMoveEventArguments(position.x, position.y,
            pressed ? this.lastMouseX - position.x : 0,
            pressed ? this.lastMouseY - position.y : 0, pressed);
        args.mouseDownX = this.mouseDownX;
        args.mouseDownY = this.mouseDownY;
        if (pressed) {
            this.lastMouseX = position.x;
            this.lastMouseY = position.y;
        }
        this.onMouseMove.trigger(args);
        if (pressed) event.preventDefault();
    };

    private pointerUp = (event: PointerEvent): void => {
        if (event.pointerId !== this.activePointer) return;
        this.activePointer = null;
        const position = this.getRelativePosition(event.clientX, event.clientY);
        if (this.activePointerType === 'touch') {
            const width = this.element.getBoundingClientRect().width;
            position.hitSlop = width ? 8 * this.element.width / width : 0;
        }
        this.activePointerType = '';
        this.onMouseUp.trigger(position);
        event.preventDefault();
    };

    private pointerCancel = (event: PointerEvent): void => {
        if (event.pointerId !== this.activePointer) return;
        this.activePointer = null;
        this.onCancel.trigger();
    };

    private doubleClick = (event: MouseEvent): void => {
        this.onDoubleClick.trigger(this.getRelativePosition(event.clientX, event.clientY));
        event.preventDefault();
    };

    private wheel = (event: WheelEvent): void => {
        const position = this.getRelativePosition(event.clientX, event.clientY);
        if (event.deltaY !== 0) this.onZoom.trigger(new ZoomEventArguments(position.x, position.y, event.deltaY < 0 ? 1 : -1));
        event.preventDefault();
    };
}

import type { Game } from '../game';
import { Position2D } from '../utilities/position2d';
import type { Stage } from './stage';

/** Keyboard users can cycle live lemmings and assign the selected skill. */
export class KeyboardTargeting {
    private selectedId: number | null = null;
    private selectedGame: Game | null = null;

    constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly stage: Stage,
        private readonly getGame: () => Game | null,
        private readonly assign: (game: Game, id: number) => void,
        private readonly announce: (message: string) => void,
    ) {
        canvas.addEventListener('keydown', this.onKeyDown);
        canvas.addEventListener('focus', this.onFocus);
        stage.setKeyboardTarget(() => {
            const game = this.getGame();
            if (!game || game !== this.selectedGame || this.selectedId === null) return null;
            const lem = game.getLemmingManager().getLemming(this.selectedId);
            return lem && !lem.removed && !lem.isDisabled() ? new Position2D(lem.x, lem.y) : null;
        });
    }

    public reset(): void {
        this.selectedId = null;
        this.selectedGame = null;
        this.stage.redraw();
    }

    public dispose(): void {
        this.canvas.removeEventListener('keydown', this.onKeyDown);
        this.canvas.removeEventListener('focus', this.onFocus);
        this.stage.setKeyboardTarget(null);
    }

    private onFocus = (): void => {
        this.announce('Use left and right arrows to choose a lemming, then Enter to assign the selected skill.');
    };

    private onKeyDown = (event: KeyboardEvent): void => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(event.key)) return;
        event.preventDefault();
        const game = this.getGame();
        if (!game) {
            this.announce('Start the level to choose a lemming.');
            return;
        }
        if (game !== this.selectedGame) {
            this.selectedGame = game;
            this.selectedId = null;
        }
        const lemmings = game.getLemmingManager().getSelectableLemmings();
        if (!lemmings.length) {
            this.selectedId = null;
            this.stage.redraw();
            this.announce('No lemmings are available yet.');
            return;
        }
        const index = lemmings.findIndex(lem => lem.id === this.selectedId);
        if (event.key === 'Enter') {
            if (index < 0) {
                this.selectedId = null;
                this.stage.redraw();
                this.announce('Choose a lemming with the left or right arrow first.');
                return;
            }
            this.assign(game, lemmings[index].id);
            return;
        }
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? lemmings.length - 1
            : index < 0 ? (event.key === 'ArrowRight' ? 0 : lemmings.length - 1)
                : (index + (event.key === 'ArrowRight' ? 1 : -1) + lemmings.length) % lemmings.length;
        const lem = lemmings[next];
        this.selectedId = lem.id;
        this.stage.revealGamePosition(lem.x, lem.y);
        const direction = lem.lookRight ? 'right' : 'left';
        this.announce(`Lemming ${next + 1} of ${lemmings.length}, ${lem.action?.getActionName() || 'active'}, facing ${direction}.`);
    };
}

import type { Game } from '../game';
import { GameStateTypes } from '../game-state-types';
import { GameSkills } from '../game-play/game-skills';
import { GameTimer } from '../game-play/game-timer';
import { GameVictoryCondition } from '../game-play/game-victory-condition';
import type { GameResources } from '../game-resources';
import type { Level } from '../resources/level';
import { prepareWindowsPanel } from '../resources/windows-panel';
import { GameGui } from './game-gui';
import type { Stage } from './stage';

/** Load player-owned artwork before touching the stage so navigation can cancel safely. */
export async function prepareWindowsLevelPreview(resources: GameResources, level: Level) {
    try {
        const panel = await prepareWindowsPanel();
        if (!panel || panel.panel.length !== 13) return null;
        const sprites = await resources.getSkillPanelSprite(level.colorPalette);
        return { panel, sprites };
    } catch {
        return null;
    }
}

/** Show the Windows panel and status using fresh, stopped preview state. */
export function renderWindowsLevelPreview(stage: Stage, level: Level,
    prepared: NonNullable<Awaited<ReturnType<typeof prepareWindowsLevelPreview>>>): void {
    const timer = new GameTimer(level);
    const victory = new GameVictoryCondition(level);
    const skills = new GameSkills(level);
    // The preview has no game actions and never starts its timer. The input
    // listeners GameGui registers are removed before control returns.
    const previewGame = { getGameState: () => GameStateTypes.UNKNOWN, queueCommand: () => false } as unknown as Game;
    const gui = new GameGui(previewGame, prepared.sprites, skills, timer, victory);
    const panel = prepared.panel;
    gui.setWindowsPanel(panel.panel, panel.nativePanel, panel.animations, panel.nativeAnimations);
    gui.setGuiDisplay(stage.getGuiDisplay());
    gui.render();
    stage.clearInputBindings();
    stage.setMinimapProvider(() => []);
    stage.setWindowsStatusProvider(() => ({ needed: victory.getNeedCount(), total: victory.getReleaseCount(),
        out: 0, home: 0, time: timer.getGameLeftTimeString() }));
}

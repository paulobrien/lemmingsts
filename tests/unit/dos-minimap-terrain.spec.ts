import { describe, expect, it, vi } from 'vitest';
import { DOS_MINIMAP, GameGui } from '../../src/game/view/game-gui';
import { EventHandler } from '../../src/game/utilities/event-handler';
import type { Game } from '../../src/game/game';
import type { GameSkills } from '../../src/game/game-play/game-skills';
import type { GameTimer } from '../../src/game/game-play/game-timer';
import type { GameVictoryCondition } from '../../src/game/game-play/game-victory-condition';
import type { SkillPanelSprites } from '../../src/game/resources/skill-panel-sprites';
import type { DisplayImage } from '../../src/game/view/display-image';

function setup() {
    const ground = new Set<string>();
    const level = { width: 1600, height: 160, hasGroundAt: (x: number, y: number) => ground.has(`${x},${y}`) };
    const event = () => new EventHandler();
    const timer = { onGameTick: new EventHandler<void>(), getGameLeftTimeString: () => '5-00' };
    const skills = { onCountChanged: event(), onSelectionChanged: event(), getSkill: () => 5, getSelectedSkill: () => 1 };
    const victory = { getReleaseCount: () => 10, getNeedCount: () => 5, getOutCount: () => 0, getSurvivorPercentage: () => 0,
        getMinReleaseRate: () => 50, getCurrentReleaseRate: () => 50 };
    const sprite = { width: 16, height: 16 };
    const panel = { getPanelSprite: () => ({ width: 320, height: 40, getData: () => new Uint8ClampedArray(320 * 40 * 4) }),
        getLetterSprite: () => null, getNumberSpriteLeft: () => sprite, getNumberSpriteRight: () => sprite, getNumberSpriteEmpty: () => sprite };
    const display = { onMouseDown: event(), onMouseMove: event(), onMouseUp: event(), onDoubleClick: event(),
        initSize: vi.fn(), setBackground: vi.fn(), drawFrameCovered: vi.fn(), drawFrame: vi.fn(), drawRect: vi.fn(),
        fillRect: vi.fn(), setPixel: vi.fn(), drawHorizontalLine: vi.fn(), drawVerticalLine: vi.fn() };
    const game = { level, getLemmingManager: () => ({ getSelectableLemmings: () => [] }) };
    const gui = new GameGui(game as unknown as Game, panel as unknown as SkillPanelSprites, skills as unknown as GameSkills,
        timer as unknown as GameTimer, victory as unknown as GameVictoryCondition);
    gui.setGuiDisplay(display as unknown as DisplayImage);
    gui.setViewportProvider(() => null);
    return { ground, gui, timer, display };
}

describe('DOS minimap terrain', () => {
    it.each([
        ['a single-pixel-high builder brick', Array.from({ length: 6 }, (_, x) => `${160 + x},121`)],
        ['a one-pixel-wide wall', Array.from({ length: 6 }, (_, y) => `161,${120 + y}`)],
    ])('shows and clears %s after the terrain refresh', (_name, pixels) => {
        const { ground, gui, timer, display } = setup();
        gui.render();
        display.setPixel.mockClear();
        for (const pixel of pixels) ground.add(pixel);
        for (let tick = 0; tick < 4; tick++) timer.onGameTick.trigger();
        gui.render();
        // A standard 1600×160 level has 16×8 cells with a two-pixel left inset.
        expect(display.setPixel).toHaveBeenCalledWith(DOS_MINIMAP.x + 2 + 10, DOS_MINIMAP.y + 15, 48, 160, 48);
        ground.clear();
        display.setPixel.mockClear();
        for (let tick = 0; tick < 4; tick++) timer.onGameTick.trigger();
        gui.render();
        expect(display.setPixel).not.toHaveBeenCalledWith(DOS_MINIMAP.x + 2 + 10, DOS_MINIMAP.y + 15, 48, 160, 48);
    });
});

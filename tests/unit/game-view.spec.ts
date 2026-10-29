// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import GameView from '../../src/views/game-view.vue';
import { GameStateTypes } from '../../src/game/game-state-types';
import { readProgress } from '../../src/game/progress';

const mock = vi.hoisted(() => {
    const timer = {
        running: false,
        speedFactor: 1,
        continue: vi.fn(function (this: { running: boolean }) { this.running = true; }),
        suspend: vi.fn(function (this: { running: boolean }) { this.running = false; }),
        toggle: vi.fn(function (this: { running: boolean }) { this.running = !this.running; }),
        isRunning: vi.fn(function (this: { running: boolean }) { return this.running; }),
        getGameLeftTimeString: vi.fn(() => '5-00'),
        onGameTick: { on: vi.fn() },
    };
    const level = { name: 'Just dig!', screenPositionX: 0, render: vi.fn() };
    const event = { on: vi.fn() };
    const display = { onMouseDown: event, clear: vi.fn(), redraw: vi.fn(), setScreenPosition: vi.fn() };
    const stage = { getGameDisplay: vi.fn(() => display), getGuiDisplay: vi.fn(() => display), resetFade: vi.fn(), clearInputBindings: vi.fn(), dispose: vi.fn(), zoomGame: vi.fn() };
    const skills = { getSkill: vi.fn(() => 10), getSelectedSkill: vi.fn(() => 1) };
    const endEvent: { handler?: (result: { state: number; survivorPercentage: number }) => void } = {};
    const soundEvent: { handler?: (effect: number) => void } = {};
    const effects = { play: vi.fn(async () => undefined), stop: vi.fn() };
    const game = {
        getGameTimer: vi.fn(() => timer), getGameSkills: vi.fn(() => skills),
        getVictoryCondition: vi.fn(() => ({ getCurrentReleaseRate: () => 50 })),
        setGameDisplay: vi.fn(), setGuiDisplay: vi.fn(), start: vi.fn(() => timer.continue()),
        stop: vi.fn(() => timer.suspend()), queueCommand: vi.fn(),
        onGameEnd: { on: vi.fn((handler: (result: { state: number; survivorPercentage: number }) => void) => { endEvent.handler = handler; }) },
        onSoundEffect: { on: vi.fn((handler: (effect: number) => void) => { soundEvent.handler = handler; }) },
    };
    const resources = { getLevel: vi.fn(async () => level), getSoundTrack: vi.fn() };
    const config = { level: { groups: ['Fun'], order: [[0, 1]], getGroupLength: () => 2 } };
    const getGame = vi.fn(async () => game);
    const replace = vi.fn(async () => undefined);
    return { timer, level, stage, game, resources, config, getGame, replace, endEvent, soundEvent, effects };
});

vi.mock('vue-router', () => ({
    useRoute: () => ({ params: { gameType: '1' }, query: {} }),
    useRouter: () => ({ replace: mock.replace }),
}));
vi.mock('@/game/view/stage', () => ({ Stage: vi.fn(function () { return mock.stage; }) }));
vi.mock('@/game/resources/sound/sound-effects-player', () => ({ SoundEffectsPlayer: vi.fn(function () { return mock.effects; }) }));
vi.mock('@/game/game-factory', () => ({ GameFactory: vi.fn(function () {
    return { getConfig: async () => mock.config, getGameResources: async () => mock.resources, getGame: mock.getGame };
}) }));

async function flushPromises() {
    for (let index = 0; index < 8; index++) await Promise.resolve();
    await nextTick();
}

function mountView() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp(GameView);
    app.component('RouterLink', defineComponent({ setup: (_props, { slots }) => () => h('a', slots.default?.()) }));
    app.mount(container);
    return { container, unmount: () => { app.unmount(); container.remove(); } };
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll('button')).find(candidate => candidate.textContent?.trim() === label);
    if (!found) throw new Error(`Button ${label} not found`);
    return found;
}

describe('game view lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mock.timer.running = false;
        mock.getGame.mockImplementation(async () => mock.game);
    });

    it('persists the sound toggle and silences effects on pause and teardown', async () => {
        const wrapper = mountView();
        await flushPromises();
        button(wrapper.container, 'Start level').click();
        await flushPromises();
        mock.soundEvent.handler?.(3);
        expect(mock.effects.play).not.toHaveBeenCalled();

        button(wrapper.container, 'Sound off').click();
        await nextTick();
        expect(JSON.parse(localStorage.getItem('lemmings.settings.v1')!).soundEnabled).toBe(true);
        mock.soundEvent.handler?.(3);
        expect(mock.effects.play).toHaveBeenCalledWith(3);
        button(wrapper.container, 'Pause').click();
        await nextTick();
        expect(mock.effects.stop).toHaveBeenCalled();
        mock.effects.play.mockClear();
        mock.soundEvent.handler?.(15);
        expect(mock.effects.play).not.toHaveBeenCalled();
        button(wrapper.container, 'Sound on').click();
        await nextTick();
        expect(JSON.parse(localStorage.getItem('lemmings.settings.v1')!).soundEnabled).toBe(false);
        wrapper.unmount();
        expect(mock.effects.stop).toHaveBeenCalled();
    });

    it('pauses, resumes, and stops the old game before changing level', async () => {
        const wrapper = mountView();
        await flushPromises();
        button(wrapper.container, 'Start level').click();
        await flushPromises();
        expect(mock.timer.isRunning()).toBe(true);
        button(wrapper.container, 'Pause').click();
        await nextTick();
        expect(mock.timer.isRunning()).toBe(false);
        button(wrapper.container, 'Resume').click();
        await nextTick();
        expect(mock.timer.isRunning()).toBe(true);
        button(wrapper.container, 'Next level →').click();
        await flushPromises();
        expect(mock.game.stop).toHaveBeenCalledOnce();
        expect(wrapper.container.textContent).toContain('Level 2');
        expect(mock.replace).toHaveBeenCalledWith({ query: { group: 0, level: 1 } });
        expect(button(wrapper.container, 'Start level').disabled).toBe(false);
        wrapper.unmount();
        expect(mock.stage.dispose).toHaveBeenCalledOnce();
    });

    it('moves focus to the pause menu and returns it when Escape or Back resumes', async () => {
        const wrapper = mountView();
        await flushPromises();
        button(wrapper.container, 'Start level').click();
        await flushPromises();

        for (const key of ['Escape', 'BrowserBack']) {
            button(wrapper.container, 'Pause').focus();
            button(wrapper.container, 'Pause').click();
            await nextTick();
            const menu = wrapper.container.querySelector<HTMLElement>('[role="region"][aria-labelledby="pause-menu-heading"]');
            expect(menu).not.toBeNull();
            expect(document.activeElement).toBe(menu!.querySelector('h2'));
            expect(menu!.textContent).toContain('Level selection');
            expect(mock.timer.isRunning()).toBe(false);

            window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
            await nextTick();
            expect(mock.timer.isRunning()).toBe(true);
            expect(wrapper.container.querySelector('#pause-menu')).toBeNull();
            expect(document.activeElement).toBe(button(wrapper.container, 'Pause'));
        }
        wrapper.unmount();
    });

    it('restarts the paused level and starts the new game', async () => {
        const wrapper = mountView();
        await flushPromises();
        button(wrapper.container, 'Start level').click();
        await flushPromises();
        button(wrapper.container, 'Pause').click();
        await nextTick();
        button(wrapper.container, 'Restart level').click();
        await flushPromises();
        expect(mock.game.stop).toHaveBeenCalledOnce();
        expect(mock.getGame).toHaveBeenCalledTimes(2);
        expect(mock.game.start).toHaveBeenCalledTimes(2);
        expect(mock.timer.isRunning()).toBe(true);
        expect(wrapper.container.querySelector('#pause-menu')).toBeNull();
        expect(document.activeElement).toBe(button(wrapper.container, 'Pause'));
        wrapper.unmount();
    });

    it('stops a game that finishes loading after the view is closed', async () => {
        let resolveGame!: (game: typeof mock.game) => void;
        mock.getGame.mockImplementation(() => new Promise(resolve => { resolveGame = resolve; }));
        const wrapper = mountView();
        await flushPromises();
        button(wrapper.container, 'Start level').click();
        wrapper.unmount();
        resolveGame(mock.game);
        await flushPromises();
        expect(mock.game.stop).toHaveBeenCalledOnce();
        expect(mock.game.start).not.toHaveBeenCalled();
    });

    it('pauses on backgrounding and requires the player to resume', async () => {
        const wrapper = mountView();
        await flushPromises();
        button(wrapper.container, 'Start level').click();
        await flushPromises();
        const original = Object.getOwnPropertyDescriptor(document, 'hidden');
        try {
            Object.defineProperty(document, 'hidden', { configurable: true, value: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await nextTick();
            expect(mock.timer.isRunning()).toBe(false);
            expect(button(wrapper.container, 'Resume')).toBeDefined();
            Object.defineProperty(document, 'hidden', { configurable: true, value: false });
            document.dispatchEvent(new Event('visibilitychange'));
            expect(mock.timer.isRunning()).toBe(false);
            button(wrapper.container, 'Resume').click();
            expect(mock.timer.isRunning()).toBe(true);
        } finally {
            if (original) Object.defineProperty(document, 'hidden', original);
            else delete (document as { hidden?: boolean }).hidden;
            wrapper.unmount();
        }
    });

    it('stores a successful level result and stops its timer', async () => {
        const wrapper = mountView();
        await flushPromises();
        button(wrapper.container, 'Start level').click();
        await flushPromises();
        mock.endEvent.handler?.({ state: GameStateTypes.SUCCEEDED, survivorPercentage: 80 });
        await nextTick();
        expect(mock.timer.isRunning()).toBe(false);
        expect(wrapper.container.textContent).toContain('Level complete! You saved 80%.');
        expect(readProgress()).toEqual([{ gameType: 1, groupIndex: 0, levelIndex: 0, bestSavedPercent: 80 }]);
        wrapper.unmount();
    });

    it('reveals verified hints one at a time and hides them on level change', async () => {
        const wrapper = mountView();
        await flushPromises();
        expect(wrapper.container.textContent).not.toContain('Look for a place to dig');
        button(wrapper.container, 'Show a hint').click();
        await nextTick();
        expect(wrapper.container.textContent).toContain('Look for a place to dig');
        expect(wrapper.container.textContent).not.toContain('Make the first lemming');
        button(wrapper.container, 'Another hint').click();
        await nextTick();
        expect(wrapper.container.textContent).toContain('Make the first lemming');
        button(wrapper.container, 'Next level →').click();
        await flushPromises();
        expect(wrapper.container.textContent).not.toContain('Look for a place to dig');
        expect(wrapper.container.textContent).not.toContain('What could protect a lemming');
        expect(button(wrapper.container, 'Show a hint')).toBeDefined();
        wrapper.unmount();
    });
});

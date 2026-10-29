import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameFullscreen } from '../../src/views/use-game-fullscreen';

describe('game fullscreen', () => {
    let fullscreenElement: Element | null;
    let exitFullscreen: ReturnType<typeof vi.fn>;
    let app: ReturnType<typeof createApp> | null;
    let container: HTMLElement;

    beforeEach(() => {
        fullscreenElement = null;
        exitFullscreen = vi.fn(async () => {
            fullscreenElement = null;
            document.dispatchEvent(new Event('fullscreenchange'));
        });
        Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
        Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen });
        document.body.style.overflow = 'scroll';
        container = document.createElement('div');
        document.body.append(container);
        app = null;
    });
    afterEach(() => {
        app?.unmount();
        container.remove();
        document.body.style.overflow = '';
        Reflect.deleteProperty(document, 'fullscreenElement');
        Reflect.deleteProperty(document, 'exitFullscreen');
    });

    function mount() {
        const Component = defineComponent({
            setup() {
                const element = ref<HTMLElement | null>(null);
                const { fullscreenActive, fullscreenMode, toggleFullscreen } = useGameFullscreen(element);
                return () => h('main', { ref: element, 'data-mode': fullscreenMode.value }, [
                    h('button', { 'aria-pressed': fullscreenActive.value, onClick: toggleFullscreen }, 'Fullscreen'),
                ]);
            },
        });
        app = createApp(Component);
        app.mount(container);
        return { target: container.querySelector('main')!, button: container.querySelector('button')! };
    }

    it('enters native fullscreen, tracks browser exits, and restores page scrolling', async () => {
        const { target, button } = mount();
        Object.defineProperty(target, 'requestFullscreen', { value: vi.fn(async () => {
            fullscreenElement = target;
            document.dispatchEvent(new Event('fullscreenchange'));
        }) });
        button.click();
        await vi.waitFor(() => expect(target.dataset.mode).toBe('native'));
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(document.body.style.overflow).toBe('hidden');
        fullscreenElement = null;
        document.dispatchEvent(new Event('fullscreenchange'));
        await nextTick();
        expect(target.dataset.mode).toBe('off');
        expect(document.body.style.overflow).toBe('scroll');
    });

    it.each(['unavailable', 'rejected'])('offers an escapable expanded view when fullscreen is %s', async kind => {
        const { target, button } = mount();
        Object.defineProperty(target, 'requestFullscreen', { value: kind === 'unavailable' ? undefined : vi.fn(async () => { throw new Error('denied'); }) });
        button.click();
        await vi.waitFor(() => expect(target.dataset.mode).toBe('expanded'));
        expect(document.body.style.overflow).toBe('hidden');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
        await nextTick();
        expect(target.dataset.mode).toBe('off');
        expect(document.body.style.overflow).toBe('scroll');
    });

    it('closes a native fullscreen request that completes after navigation', async () => {
        const { target, button } = mount();
        let finish!: () => void;
        Object.defineProperty(target, 'requestFullscreen', { value: () => new Promise<void>(resolve => {
            finish = () => { fullscreenElement = target; resolve(); };
        }) });
        button.click();
        app!.unmount();
        app = null;
        finish();
        await vi.waitFor(() => expect(exitFullscreen).toHaveBeenCalledOnce());
        expect(document.body.style.overflow).toBe('scroll');
    });
});

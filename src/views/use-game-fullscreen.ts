import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

type FullscreenMode = 'off' | 'native' | 'expanded';

/** Native fullscreen when available, otherwise an expanded in-page view. */
export function useGameFullscreen(element: Ref<HTMLElement | null>) {
    const fullscreenMode = ref<FullscreenMode>('off');
    const fullscreenActive = computed(() => fullscreenMode.value !== 'off');
    let oldBodyOverflow: string | null = null;
    let pending = false;
    let disposed = false;

    function setMode(mode: FullscreenMode) {
        if (mode !== 'off' && oldBodyOverflow === null) {
            oldBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        } else if (mode === 'off' && oldBodyOverflow !== null) {
            document.body.style.overflow = oldBodyOverflow;
            oldBodyOverflow = null;
        }
        fullscreenMode.value = mode;
    }

    function onFullscreenChange() {
        if (fullscreenMode.value === 'native' && document.fullscreenElement !== element.value) setMode('off');
    }

    function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape' && fullscreenMode.value === 'expanded') {
            event.preventDefault();
            setMode('off');
        }
    }

    async function toggleFullscreen() {
        const target = element.value;
        if (!target || pending || disposed) return;
        pending = true;
        try {
            if (fullscreenMode.value === 'expanded') {
                setMode('off');
            } else if (fullscreenMode.value === 'native') {
                if (document.fullscreenElement === target) await document.exitFullscreen();
                if (!disposed && document.fullscreenElement !== target) setMode('off');
            } else if (typeof target.requestFullscreen === 'function') {
                try {
                    await target.requestFullscreen();
                    if (disposed) {
                        if (document.fullscreenElement === target) await document.exitFullscreen();
                    } else {
                        setMode(document.fullscreenElement === target ? 'native' : 'expanded');
                    }
                } catch {
                    if (!disposed) setMode('expanded');
                }
            } else {
                setMode('expanded');
            }
        } catch {
            // If a browser refuses to exit, fullscreenchange remains the
            // source of truth and the exit control stays available.
        } finally {
            pending = false;
        }
    }

    onMounted(() => {
        document.addEventListener('fullscreenchange', onFullscreenChange);
        window.addEventListener('keydown', onKeyDown);
    });
    onBeforeUnmount(() => {
        disposed = true;
        document.removeEventListener('fullscreenchange', onFullscreenChange);
        window.removeEventListener('keydown', onKeyDown);
        if (document.fullscreenElement === element.value) void document.exitFullscreen().catch(() => {});
        setMode('off');
    });

    return { fullscreenActive, fullscreenMode, toggleFullscreen };
}

// @vitest-environment jsdom
// RUN_PRIVATE_GAME_TESTS=1 LEMMINGS_WINDOWS_ISO=/path/to/disc.iso npx vitest run tests/integration/windows-only-home-private.spec.ts
// Player-owned files are imported into an in-memory browser database only.
import { readFile } from 'node:fs/promises';
import { File as NodeFile } from 'node:buffer';
import { indexedDB } from 'fake-indexeddb';
import { expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import MainView from '../../src/views/main-view.vue';
import { hasLemmingsFiles } from '../../src/game/resources/file/game-file-store';

vi.mock('@/game/resources/file/bundled-game-import', () => ({ importBundledLemmingsFiles: async () => 'absent' }));
vi.mock('@/game/resources/file/bundled-voice-import', () => ({ importBundledWindowsVoices: async () => 'absent' }));
vi.mock('@/game/resources/file/bundled-graphics-import', () => ({ importBundledWindowsGraphics: async () => 'absent' }));
vi.mock('@/game/resources/file/bundled-windows-game-import', () => ({ importBundledWindowsGame: async () => 'absent' }));
vi.mock('@/offline-readiness', async () => {
  const { ref } = await import('vue'); return { offlineReadiness: ref('ready') };
});

it.skipIf(process.env.RUN_PRIVATE_GAME_TESTS !== '1' || !process.env.LEMMINGS_WINDOWS_ISO)(
  'enables Windows play after importing only a Windows ISO in a fresh browser', async () => {
    localStorage.clear();
    vi.stubGlobal('indexedDB', indexedDB); vi.stubGlobal('File', NodeFile);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'dir').mockImplementation(() => undefined);
    const config = await readFile('public/data/config.json', 'utf8');
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      if (!String(input).endsWith('config.json')) throw new Error(`Unexpected request ${input}`);
      return new Response(config);
    });
    const container = document.createElement('div'); document.body.appendChild(container);
    const app = createApp(MainView);
    app.component('RouterLink', defineComponent({ setup: (_props, { slots }) => () => h('a', slots.default?.()) }));
    try {
      app.mount(container);
      const disc = await readFile(process.env.LEMMINGS_WINDOWS_ISO!);
      const input = container.querySelector<HTMLInputElement>('input[accept*=".iso"]')!;
      Object.defineProperty(input, 'files', { configurable: true, value: [new NodeFile([disc], 'windows.iso')] });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await vi.waitFor(async () => {
        await nextTick();
        expect(container.textContent).toContain('Play Lemmings');
        expect(container.querySelector<HTMLSelectElement>('.game-mode select')?.value).toBe('windows');
        expect(container.querySelector('.level-picker')).not.toBeNull();
      }, { timeout: 10_000, interval: 25 });
      expect(await hasLemmingsFiles()).toBe(false);
      expect(container.querySelector('a.primary-button')).not.toBeNull();
      expect(container.querySelectorAll('.level-picker select')[1].querySelectorAll('option').length).toBe(28);
      expect(container.textContent).not.toContain('Missing files:');
    } finally { app.unmount(); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); }
  }, 30_000,
);

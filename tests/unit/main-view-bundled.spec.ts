// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import MainView from '../../src/views/main-view.vue';

const mock = vi.hoisted(() => ({
  bundled: vi.fn(async (): Promise<'imported' | 'existing' | 'absent'> => 'absent'),
  hasFiles: vi.fn(async () => false),
  importFiles: vi.fn(async () => undefined),
}));

vi.mock('@/game/resources/file/bundled-game-import', () => ({ importBundledLemmingsFiles: mock.bundled }));
vi.mock('@/game/resources/file/game-file-store', () => ({ hasLemmingsFiles: mock.hasFiles, clearLemmingsFiles: vi.fn(), importLemmingsFiles: mock.importFiles }));
vi.mock('@/game/game-factory', () => ({ GameFactory: vi.fn(function () {
  return { getConfig: async () => ({ level: { groups: ['Fun'], getGroupLength: () => 30 } }) };
}) }));
vi.mock('@/game/resources/home-artwork', () => ({ loadHomeArtwork: async () => null, paintHomeArtwork: vi.fn() }));
vi.mock('@/offline-readiness', async () => {
  const { ref } = await import('vue');
  return { offlineReadiness: ref('ready') };
});

async function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(MainView);
  app.component('RouterLink', defineComponent({ setup: (_props, { slots }) => () => h('a', slots.default?.()) }));
  app.mount(container);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await nextTick();
  return { container, unmount: () => { app.unmount(); container.remove(); } };
}

describe('home setup', () => {
  beforeEach(() => {
    localStorage.clear();
    mock.bundled.mockReset().mockResolvedValue('absent');
    mock.hasFiles.mockReset().mockResolvedValue(false);
    mock.importFiles.mockReset().mockResolvedValue(undefined);
  });

  it('offers manual import when a deployment has no game files', async () => {
    const view = await mount();
    expect(view.container.textContent).toContain('Add your game files');
    expect(view.container.textContent).not.toContain('Game files added to this device.');
    view.unmount();
  });

  it('offers play when deployment files were successfully installed locally', async () => {
    mock.bundled.mockResolvedValue('imported');
    mock.hasFiles.mockResolvedValue(true);
    const view = await mount();
    expect(view.container.textContent).toContain('Game files added to this device. You’re ready to play!');
    expect(view.container.textContent).toContain('Play Lemmings');
    expect(view.container.textContent).not.toContain('Add your game files');
    view.unmount();
  });

  it('keeps existing local files without claiming they were just imported', async () => {
    mock.bundled.mockResolvedValue('existing');
    mock.hasFiles.mockResolvedValue(true);
    const view = await mount();
    expect(view.container.textContent).toContain('Play Lemmings');
    expect(view.container.textContent).not.toContain('Game files added to this device.');
    view.unmount();
  });

  it('does not claim success if files are removed before readiness is checked', async () => {
    mock.bundled.mockResolvedValue('imported');
    mock.hasFiles.mockResolvedValue(false);
    const view = await mount();
    expect(view.container.textContent).toContain('Add your game files');
    expect(view.container.textContent).not.toContain('Game files added to this device.');
    view.unmount();
  });

  it('offers manual import with an actionable message if automatic setup fails', async () => {
    mock.bundled.mockRejectedValue(new Error('Bundled files could not be validated. Please add your game files manually.'));
    const view = await mount();
    expect(view.container.textContent).toContain('Bundled files could not be validated. Please add your game files manually.');
    expect(view.container.textContent).toContain('Add your game files');
    view.unmount();
  });

  it('allows manual import while auto discovery is pending and ignores its stale error', async () => {
    let rejectDiscovery!: (reason: Error) => void;
    mock.bundled.mockImplementation(() => new Promise((_resolve, reject) => { rejectDiscovery = reject; }));
    mock.importFiles.mockImplementation(async () => { mock.hasFiles.mockResolvedValue(true); });
    const view = await mount();
    const button = Array.from(view.container.querySelectorAll('button')).find(item => item.textContent?.includes('Add your game files'))!;
    expect(button.disabled).toBe(false);
    expect(view.container.textContent).toContain('You can also add your own files now.');
    const input = view.container.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['sample'], 'main.dat')] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    for (let i = 0; i < 8; i++) await Promise.resolve();
    await nextTick();
    expect(view.container.textContent).toContain('Play Lemmings');
    expect(view.container.textContent).toContain('Game files added. You’re ready to play!');
    rejectDiscovery(new Error('Late discovery failed.'));
    for (let i = 0; i < 8; i++) await Promise.resolve();
    await nextTick();
    expect(view.container.textContent).toContain('Play Lemmings');
    expect(view.container.textContent).not.toContain('Late discovery failed.');
    view.unmount();
  });

  it('refreshes readiness when automatic import finishes during backup restore', async () => {
    let finishDiscovery!: (result: 'imported') => void;
    mock.bundled.mockImplementation(() => new Promise(resolve => { finishDiscovery = resolve; }));
    const view = await mount();
    let finishBackup!: (text: string) => void;
    const input = view.container.querySelector<HTMLInputElement>('input[accept=".json,application/json"]')!;
    const file = { size: 300, text: () => new Promise<string>(resolve => { finishBackup = resolve; }) };
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    mock.hasFiles.mockResolvedValue(true);
    finishDiscovery('imported');
    for (let i = 0; i < 8; i++) await Promise.resolve();
    await nextTick();
    expect(view.container.textContent).not.toContain('Play Lemmings');
    finishBackup(JSON.stringify({ format: 'lemmings-progress', version: 1, progress: [], settings: { speed: 1, musicEnabled: false, soundEnabled: false }, lastLevel: null }));
    for (let i = 0; i < 8; i++) await Promise.resolve();
    await nextTick();
    expect(view.container.textContent).toContain('Play Lemmings');
    expect(view.container.textContent).toContain('Progress and settings restored.');
    view.unmount();
  });
});

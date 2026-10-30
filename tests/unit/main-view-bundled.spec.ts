// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import MainView from '../../src/views/main-view.vue';

const mock = vi.hoisted(() => ({
  bundled: vi.fn(async (): Promise<'imported' | 'existing' | 'absent'> => 'absent'),
  hasFiles: vi.fn(async () => false),
  importFiles: vi.fn(async () => undefined),
  bundledVoices: vi.fn(async () => undefined),
  hasVoices: vi.fn(async () => false),
  hasAudio: vi.fn(async () => false),
  hasGraphics: vi.fn(async () => false),
  importVoices: vi.fn(async () => undefined),
  clearVoices: vi.fn(async () => undefined),
  bundledGraphics: vi.fn(async () => undefined),
  importGraphics: vi.fn(async () => undefined),
  clearGraphics: vi.fn(async () => undefined),
}));

vi.mock('@/game/resources/file/bundled-game-import', () => ({ importBundledLemmingsFiles: mock.bundled }));
vi.mock('@/game/resources/file/bundled-voice-import', () => ({ importBundledWindowsVoices: mock.bundledVoices }));
vi.mock('@/game/resources/file/bundled-graphics-import', () => ({ importBundledWindowsGraphics: mock.bundledGraphics }));
vi.mock('@/game/resources/file/windows-graphics-store', () => ({ hasWindowsGraphics: mock.hasGraphics, importWindowsGraphics: mock.importGraphics, clearWindowsGraphics: mock.clearGraphics }));
vi.mock('@/game/resources/file/game-file-store', () => ({ hasLemmingsFiles: mock.hasFiles, clearLemmingsFiles: vi.fn(), importLemmingsFiles: mock.importFiles, hasWindowsVoiceFiles: mock.hasVoices, hasWindowsAudioFiles: mock.hasAudio, importWindowsVoiceFiles: mock.importVoices, clearWindowsVoiceFiles: mock.clearVoices }));
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
    mock.bundledVoices.mockReset().mockResolvedValue(undefined);
    mock.hasVoices.mockReset().mockResolvedValue(false);
    mock.hasAudio.mockReset().mockResolvedValue(false);
    mock.hasGraphics.mockReset().mockResolvedValue(false);
    mock.importVoices.mockReset().mockResolvedValue(undefined);
    mock.clearVoices.mockReset().mockResolvedValue(undefined);
    mock.bundledGraphics.mockReset().mockResolvedValue(undefined);
    mock.importGraphics.mockReset().mockResolvedValue(undefined);
    mock.clearGraphics.mockReset().mockResolvedValue(undefined);
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

  it('allows the player to add and remove optional Windows voices', async () => {
    mock.hasFiles.mockResolvedValue(true);
    mock.importVoices.mockImplementation(async () => { mock.hasVoices.mockResolvedValue(true); });
    mock.clearVoices.mockImplementation(async () => { mock.hasVoices.mockResolvedValue(false); });
    const view = await mount();
    expect(view.container.textContent).toContain('Add Windows files');
    const input = view.container.querySelector<HTMLInputElement>('input[accept^=".wav"]')!;
    const files = [new File(['one'], 'LETSGO.WAV'), new File(['two'], 'OHNO.WAV'), new File(['three'], 'YIPPEE.WAV')];
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    await nextTick();
    expect(mock.importVoices).toHaveBeenCalledWith(files);
    const remove = Array.from(view.container.querySelectorAll('button')).find(button => button.textContent === 'Remove Windows files')!;
    remove.click();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    await nextTick();
    expect(mock.clearVoices).toHaveBeenCalledOnce();
    expect(view.container.textContent).toContain('Windows files removed from this browser.');
    expect(view.container.textContent).toContain('Add Windows files');
    view.unmount();
  });

  it('imports graphics as well when a Windows ISO is selected', async () => {
    mock.hasFiles.mockResolvedValue(true);
    const view = await mount();
    const input = view.container.querySelector<HTMLInputElement>('input[accept^=".wav"]')!;
    const files = [new File(['disc'], 'lemmings.iso')];
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    for (let i = 0; i < 15; i++) await Promise.resolve();
    await nextTick();
    expect(mock.importVoices).toHaveBeenCalledWith(files);
    expect(mock.importGraphics).toHaveBeenCalledWith(files);
    expect(view.container.textContent).toContain('Windows audio and graphics added to this device.');
    view.unmount();
  });

  it('keeps game setup responsive when optional voice discovery is still pending', async () => {
    mock.hasFiles.mockResolvedValue(true);
    mock.bundled.mockResolvedValue('imported');
    mock.bundledVoices.mockImplementation(() => new Promise(() => {}));
    const view = await mount();
    expect(view.container.textContent).toContain('Play Lemmings');
    expect(view.container.textContent).toContain('Game files added to this device.');
    view.unmount();
  });

  it('only enables Windows with complete audio and graphics, and restores the chosen mode', async () => {
    mock.hasFiles.mockResolvedValue(true);
    mock.hasVoices.mockResolvedValue(true);
    mock.hasAudio.mockResolvedValue(true);
    mock.hasGraphics.mockResolvedValue(false);
    let view = await mount();
    let select = view.container.querySelector<HTMLSelectElement>('.game-mode select')!;
    expect(select.value).toBe('dos');
    expect(select.querySelector<HTMLOptionElement>('option[value=windows]')!.disabled).toBe(true);
    view.unmount();
    mock.hasGraphics.mockResolvedValue(true);
    view = await mount();
    select = view.container.querySelector<HTMLSelectElement>('.game-mode select')!;
    expect(select.querySelector<HTMLOptionElement>('option[value=windows]')!.disabled).toBe(false);
    select.value = 'windows';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    expect(localStorage.getItem('lemmings.game-mode.v1')).toBe('windows');
    view.unmount();
    view = await mount();
    select = view.container.querySelector<HTMLSelectElement>('.game-mode select')!;
    expect(select.value).toBe('windows');
    view.unmount();
  });

  it('blocks a saved Windows mode when its files disappear until DOS is selected', async () => {
    localStorage.setItem('lemmings.game-mode.v1', 'windows');
    mock.hasFiles.mockResolvedValue(true);
    const view = await mount();
    expect(view.container.textContent).toContain('Windows files are not ready');
    expect(view.container.querySelector('a.primary-button')).toBeNull();
    const select = view.container.querySelector<HTMLSelectElement>('.game-mode select')!;
    select.value = 'dos';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    expect(view.container.querySelector('a.primary-button')).not.toBeNull();
    expect(localStorage.getItem('lemmings.game-mode.v1')).toBe('dos');
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

// @vitest-environment node
// Opt-in only: uses the locally imported original DOS ADLIB.DAT.
import { readFile, readdir } from 'node:fs/promises';
import { indexedDB } from 'fake-indexeddb';
import { expect, it, vi } from 'vitest';
import { GameFactory } from '../../src/game/game-factory';
import { GameTypes } from '../../src/game/game-types';
import { GameStateTypes } from '../../src/game/game-state-types';
import { SoundEffect } from '../../src/game/game-play/sound-effects';
import { getTestedSolution } from '../../src/game/solutions/tested-solutions';
import { clearLemmingsFiles, importLemmingsFiles } from '../../src/game/resources/file/game-file-store';
import { AudioPlayer } from '../../src/game/resources/sound/audio-player';

it.skipIf(process.env.RUN_PRIVATE_GAME_TESTS !== '1')('renders and finishes the connected DOS effects', async () => {
  class TestAudioContext {
    readonly sampleRate = 48_000;
    readonly destination = {};
    readonly suspend = vi.fn(async () => undefined);
    readonly resume = vi.fn(async () => undefined);
    readonly close = vi.fn(async () => undefined);
    createBufferSource() { return { onended: null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn() }; }
    createScriptProcessor() { return { onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() }; }
  }
  vi.stubGlobal('indexedDB', indexedDB);
  vi.stubGlobal('window', { atob });
  vi.stubGlobal('AudioContext', TestAudioContext);
  vi.stubGlobal('fetch', async () => new Response(await readFile('public/data/config.json', 'utf8')));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'dir').mockImplementation(() => undefined);
  try {
    const names = await readdir('dos/lemmings');
    await importLemmingsFiles(await Promise.all(names.map(async name =>
      new File([Uint8Array.from(await readFile(`dos/lemmings/${name}`))], name))));
    const factory = new GameFactory('/data');
    const resources = (await factory.getGameResources(GameTypes.LEMMINGS))!;
    for (const effect of [SoundEffect.SelectSkill, SoundEffect.Entrance, SoundEffect.LetsGo, SoundEffect.Assign, SoundEffect.OhNo,
      SoundEffect.Splat, SoundEffect.Steel, SoundEffect.Explosion, SoundEffect.Fire, SoundEffect.Exit, SoundEffect.Drowning, SoundEffect.BuilderWarning,
      5, 6, 8, 13, 14]) {
      const track = await resources.getSoundTrack(effect);
      const player = new AudioPlayer(track, true);
      const context = player.audioCtx as unknown as TestAudioContext;
      const peaks: number[] = [];
      for (let i = 0; i < 12; i++) {
        const channels = [new Float32Array(8192), new Float32Array(8192)];
        player.audioScriptProcessor({ outputBuffer: { length: 8192, getChannelData: (index: number) => channels[index] } } as AudioProcessingEvent);
        peaks.push(channels[0].reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0));
        if (context.suspend.mock.calls.length) break;
      }
      expect(Math.max(...peaks)).toBeGreaterThan(0.01);
      expect(track.isFinished()).toBe(true);
      expect(context.suspend).toHaveBeenCalledOnce();
      // Some trap and water effects have a longer, quiet release than the
      // original four cues; all must decay before the player suspends.
      const originalCue = [SoundEffect.Assign, SoundEffect.Exit, SoundEffect.Splat, SoundEffect.Explosion].includes(effect);
      expect(peaks.at(-1), `effect ${effect} release`).toBeLessThan(originalCue ? 0.001 : 0.01);
      player.stop();
      expect(context.close).toHaveBeenCalledOnce();
    }

    const game = (await factory.getGame(GameTypes.LEMMINGS, 0, 0))!;
    const events: SoundEffect[] = [];
    game.onSoundEffect.on(effect => { if (effect !== undefined) events.push(effect); });
    game.getCommandManager().loadReplay(getTestedSolution(0, 0)!.replay);
    while (game.getGameState() === GameStateTypes.RUNNING && game.getGameTimer().getGameTicks() <= game.getGameTimer().getGameTimeLimit()) {
      game.getGameTimer().tick();
    }
    expect(game.getGameState()).toBe(GameStateTypes.SUCCEEDED);
    expect(events).toContain(SoundEffect.LetsGo);
    expect(events).toContain(SoundEffect.Entrance);
    expect(events).toContain(SoundEffect.Assign);
    expect(events).toContain(SoundEffect.Exit);
  } finally {
    await clearLemmingsFiles();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
}, 60_000);

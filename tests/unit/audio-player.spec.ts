import { afterEach, expect, it, vi } from 'vitest';
import { AudioPlayer } from '../../src/game/resources/sound/audio-player';
import type { SoundImagePlayer } from '../../src/game/resources/sound/sound-image-player';

afterEach(() => vi.unstubAllGlobals());

it('connects its generated audio directly to the output for the lifetime of the player', () => {
  const processor = { onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() };
  class TestAudioContext {
    readonly sampleRate = 48_000;
    readonly destination = {};
    readonly resume = vi.fn(async () => undefined);
    readonly close = vi.fn(async () => undefined);
    readonly createScriptProcessor = vi.fn(() => processor);
  }
  vi.stubGlobal('AudioContext', TestAudioContext);
  const track = { sampleRateFactor: 16800, getSamplingInterval: () => 80 } as unknown as SoundImagePlayer;
  const player = new AudioPlayer(track);
  const context = player.audioCtx as unknown as TestAudioContext;
  expect(context.createScriptProcessor).toHaveBeenCalledWith(8192, 0, 2);
  expect(processor.connect).toHaveBeenCalledWith(context.destination);
  expect(processor.onaudioprocess).toBeTypeOf('function');
  expect(processor.disconnect).not.toHaveBeenCalled();
  player.stop();
  expect(processor.disconnect).toHaveBeenCalledWith(context.destination);
  expect(processor.onaudioprocess).toBeNull();
  expect(context.close).toHaveBeenCalledOnce();
});

it('suspends a nonterminating effect after a bounded amount of audio', () => {
  class TestAudioContext {
    readonly sampleRate = 48_000;
    readonly destination = {};
    readonly suspend = vi.fn(async () => undefined);
    readonly resume = vi.fn(async () => undefined);
    readonly close = vi.fn(async () => undefined);
    createBufferSource() { return { onended: null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn() }; }
    createScriptProcessor() { return { onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() }; }
  }
  vi.stubGlobal('AudioContext', TestAudioContext);
  const track = { sampleRateFactor: 16800, getSamplingInterval: () => 80, isFinished: () => false, read: () => undefined } as unknown as SoundImagePlayer;
  const player = new AudioPlayer(track, true);
  const context = player.audioCtx as unknown as TestAudioContext;
  for (let i = 0; i < 32 && !context.suspend.mock.calls.length; i++) {
    const channels = [new Float32Array(8192), new Float32Array(8192)];
    player.audioScriptProcessor({ outputBuffer: { length: 8192, getChannelData: (index: number) => channels[index] } } as AudioProcessingEvent);
  }
  expect(context.suspend).toHaveBeenCalledOnce();
  player.stop();
  expect(context.close).toHaveBeenCalledOnce();
});

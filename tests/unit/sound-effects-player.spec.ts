import { describe, expect, it, vi } from 'vitest';
import { SoundEffectsPlayer } from '../../src/game/resources/sound/sound-effects-player';
import type { AudioPlayer } from '../../src/game/resources/sound/audio-player';
import type { SoundImagePlayer } from '../../src/game/resources/sound/sound-image-player';
import type { SpeakerEffectsPlayer } from '../../src/game/resources/sound/speaker-effects-player';
import { SoundEffect } from '../../src/game/game-play/sound-effects';

const track = (id: number) => ({ id } as unknown as SoundImagePlayer);

describe('sound effects lifecycle', () => {
  it('routes speaker cues separately without cancelling a pending AdLib effect, and stops both', async () => {
    let resolve!: (value: SoundImagePlayer) => void;
    const player = { stop: vi.fn() };
    const speaker = { play: vi.fn(), stop: vi.fn() };
    const load = vi.fn(() => new Promise<SoundImagePlayer>(done => { resolve = done; }));
    const effects = new SoundEffectsPlayer(load, () => player as unknown as AudioPlayer, speaker as unknown as SpeakerEffectsPlayer);
    const pending = effects.play(SoundEffect.Exit);
    await effects.play(SoundEffect.Nuke);
    expect(speaker.play).toHaveBeenCalledWith(SoundEffect.Nuke);
    expect(load).toHaveBeenCalledTimes(1);
    resolve(track(SoundEffect.Exit));
    await pending;
    effects.stop();
    expect(player.stop).toHaveBeenCalledOnce();
    expect(speaker.stop).toHaveBeenCalledOnce();
  });
  it('reuses one player and closes it when stopped', async () => {
    const player = { setTrack: vi.fn(), play: vi.fn(), stop: vi.fn() };
    const create = vi.fn(() => player as unknown as AudioPlayer);
    const effects = new SoundEffectsPlayer(async id => track(id), create);
    await effects.play(3);
    await effects.play(15);
    expect(create).toHaveBeenCalledTimes(1);
    expect(player.setTrack).toHaveBeenCalledWith(track(15));
    expect(player.play).toHaveBeenCalledOnce();
    effects.stop();
    effects.stop();
    expect(player.stop).toHaveBeenCalledOnce();
    await effects.play(7);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('discards sound loads made stale by a later sound or stop', async () => {
    const pending: Array<(value: SoundImagePlayer) => void> = [];
    const create = vi.fn(() => ({ stop: vi.fn() } as unknown as AudioPlayer));
    const effects = new SoundEffectsPlayer(() => new Promise(resolve => pending.push(resolve)), create);
    const first = effects.play(3);
    const second = effects.play(15);
    pending[0](track(3));
    await first;
    expect(create).not.toHaveBeenCalled();
    effects.stop();
    pending[1](track(15));
    await second;
    expect(create).not.toHaveBeenCalled();
  });

  it('does not interrupt gameplay if loading or audio creation fails', async () => {
    const effects = new SoundEffectsPlayer(async () => { throw new Error('unavailable'); });
    await expect(effects.play(3)).resolves.toBeUndefined();
    const broken = new SoundEffectsPlayer(async () => track(3), () => { throw new Error('no audio'); });
    await expect(broken.play(3)).resolves.toBeUndefined();
  });
});

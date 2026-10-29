import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioConfig } from '../../src/game/config/audio-config';
import { BinaryReader } from '../../src/game/resources/file/binary-reader';
import { SoundImageChannels } from '../../src/game/resources/sound/sound-image-channel';

afterEach(() => vi.restoreAllMocks());

describe.each([1, 2])('sound-image interpreter version %i', version => {
  function channel(data: Uint8Array) {
    const result = new SoundImageChannels(new BinaryReader(data), new AudioConfig());
    result.soundImageVersion = version;
    result.initSound();
    result.di08hL = 0xb8;
    result.di08hH = 4;
    return result;
  }

  it('stops a channel with a self-referencing jump instead of hanging the game', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const data = new Uint8Array(16);
    // Jump reads a zero pointer at 4, follows the zero at 6, then jumps
    // back to position 8 using the little-endian pointer at zero.
    data[0] = 8;
    data[8] = 0x80;
    const sound = channel(data);
    sound.channelPosition = 8;
    sound.programPointer = 4;
    const write = vi.fn();
    sound.read(write);
    expect(sound.isFinished()).toBe(true);
    expect(write).toHaveBeenLastCalledWith(0xb8, 4);
    write.mockClear();
    sound.read(write);
    expect(write).not.toHaveBeenCalled();
  });

  it('stops a channel that runs off the end of its data', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const sound = channel(new Uint8Array([0xe0]));
    const write = vi.fn();
    sound.read(write);
    expect(sound.isFinished()).toBe(true);
    expect(write).toHaveBeenCalledExactlyOnceWith(0xb8, 4);
  });

  it('continues a valid delay and reaches its normal stop instruction', () => {
    const sound = channel(new Uint8Array([0xe1, 0x82, 0x85]));
    const write = vi.fn();
    sound.read(write);
    expect(sound.isFinished()).toBe(false);
    expect(sound.waitTime).toBe(2);
    sound.read(write);
    expect(sound.isFinished()).toBe(false);
    sound.read(write);
    expect(sound.isFinished()).toBe(true);
  });
});

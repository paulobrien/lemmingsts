// @vitest-environment node
// Original ADLIB data stays local and is never included in this test source.
import { readFile, readdir } from 'node:fs/promises';
import { expect, it, vi } from 'vitest';
import { GameTypes } from '../../src/game/game-types';
import { BinaryReader } from '../../src/game/resources/file/binary-reader';
import { FileContainer } from '../../src/game/resources/file/file-container';
import { SoundImageManager } from '../../src/game/resources/sound/sound-image-manager';
import { ConfigReader } from '../../src/game/utilities/config-reader';

it.skipIf(process.env.RUN_PRIVATE_GAME_TESTS !== '1')('decodes all original music tracks without hitting malformed-data guards', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'dir').mockImplementation(() => {});
  try {
    const config = (await new ConfigReader(readFile('public/data/config.json', 'utf8')).getConfig(GameTypes.LEMMINGS))!;
    const name = (await readdir('dos/lemmings')).find(name => name.toUpperCase() === 'ADLIB.DAT')!;
    const data = new FileContainer(new BinaryReader(await readFile(`dos/lemmings/${name}`))).getPart(0);
    const sounds = new SoundImageManager(data, config.audioConfig);
    for (let index = 0; index < config.audioConfig.numberOfTracks; index++) {
      const track = sounds.getMusicTrack(index);
      let writes = 0;
      // Four minutes per song exercises looping track programs as well as
      // their opening notes without allocating or exposing original audio.
      const ticks = Math.ceil(track.getSamplingInterval() * 240);
      for (let tick = 0; tick < ticks; tick++) track.read(() => { writes++; });
      expect(writes, `music track ${index}`).toBeGreaterThan(100);
    }
    const invalid = log.mock.calls.some(args => String(args[0]).includes('invalid or non-yielding sound channel'));
    expect(invalid, 'valid music must not trigger the malformed-channel guard').toBe(false);
  } finally {
    vi.restoreAllMocks();
  }
}, 60_000);

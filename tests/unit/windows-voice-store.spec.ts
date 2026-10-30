// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { zipSync } from 'fflate';
import { syntheticDosData } from '../helpers/synthetic-dos';
import {
  canAutoImportLemmingsFiles, canAutoImportWindowsVoiceFiles, clearLemmingsFiles, clearWindowsVoiceFiles,
  getLemmingsFile, getWindowsAudioFile, getWindowsVoiceFile, hasWindowsVoiceFiles, importLemmingsFiles,
  importWindowsVoiceFiles, importWindowsVoiceFilesIfMissing, importLemmingsFilesIfEmpty, REQUIRED_LEMMINGS_FILES,
  WINDOWS_VOICE_FILES,
} from '../../src/game/resources/file/game-file-store';

vi.stubGlobal('indexedDB', indexedDB);

function wav(sample = 128): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(48);
  const view = new DataView(bytes.buffer);
  const tag = (offset: number, value: string) => bytes.set(new TextEncoder().encode(value), offset);
  tag(0, 'RIFF'); view.setUint32(4, 40, true); tag(8, 'WAVE');
  tag(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, 7092, true); view.setUint32(28, 7092, true);
  view.setUint16(32, 1, true); view.setUint16(34, 8, true); tag(36, 'data');
  view.setUint32(40, 4, true); bytes.fill(sample, 44);
  return bytes;
}
const voices = (sample = 128) => WINDOWS_VOICE_FILES.map(name => new File([wav(sample)], name.toLowerCase()));
const game = () => REQUIRED_LEMMINGS_FILES.map((name, i) => new File([Uint8Array.from(syntheticDosData(name, i + 1))], name));
const midi = () => Uint8Array.from([77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
  77, 84, 114, 107, 0, 0, 0, 12, 0, 144, 60, 100, 48, 128, 60, 0, 0, 255, 47, 0]);

describe('optional Windows voice files', () => {
  beforeEach(async () => { await clearLemmingsFiles(); });

  it('imports voices into the existing game without changing the DOS files, and retains them across DOS reimports', async () => {
    await importWindowsVoiceFiles(voices());
    expect(await hasWindowsVoiceFiles()).toBe(true);
    await importLemmingsFiles(game());
    const main = await getLemmingsFile('MAIN.DAT');
    await importWindowsVoiceFiles(voices());
    expect(await hasWindowsVoiceFiles()).toBe(true);
    expect(await getWindowsVoiceFile('LETSGO.WAV')).toEqual(wav().buffer);
    expect(await getLemmingsFile('MAIN.DAT')).toEqual(main);
    await importLemmingsFiles(game());
    expect(await hasWindowsVoiceFiles()).toBe(true);
    await clearLemmingsFiles();
    expect(await hasWindowsVoiceFiles()).toBe(false);
  });

  it('accepts Windows files first and keeps them when DOS files are automatically imported later', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('lemmings-game-files');
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    });
    await importWindowsVoiceFiles(voices(77));
    expect(await canAutoImportLemmingsFiles()).toBe(true);
    expect(await importLemmingsFilesIfEmpty(game())).toBe(true);
    expect(await getWindowsVoiceFile('LETSGO.WAV')).toEqual(wav(77).buffer);
    expect(await getLemmingsFile('MAIN.DAT')).toBeDefined();
  });

  it('accepts a ZIP with nested voice names and rejects duplicates', async () => {
    await importLemmingsFiles(game());
    const archive = zipSync(Object.fromEntries(WINDOWS_VOICE_FILES.map(name => [`SOUND/${name}`, wav()])));
    await importWindowsVoiceFiles([new File([archive], 'voices.zip')]);
    expect(await hasWindowsVoiceFiles()).toBe(true);
    const duplicate = zipSync({ 'SOUND/LETSGO.WAV': wav(), 'other/letsgo.wav': wav() });
    await expect(importWindowsVoiceFiles([new File([duplicate], 'voices.zip')])).rejects.toThrow('Duplicate voice files');
    expect(await hasWindowsVoiceFiles()).toBe(true);
  });

  it('rejects incomplete or malformed replacement files without losing saved speech', async () => {
    await importLemmingsFiles(game());
    await importWindowsVoiceFiles(voices());
    await expect(importWindowsVoiceFiles(voices().slice(1))).rejects.toThrow('Missing voice files: LETSGO.WAV');
    const malformed = voices();
    malformed[1] = new File(['not a WAV'], 'ohno.wav');
    await expect(importWindowsVoiceFiles(malformed)).rejects.toThrow('OHNO.WAV is not a supported PCM WAV file');
    expect(await getWindowsVoiceFile('OHNO.WAV')).toEqual(wav().buffer);
  });

  it('automatically augments old imports without overwriting manual voices or undoing removal', async () => {
    await importLemmingsFiles(game());
    expect(await canAutoImportWindowsVoiceFiles()).toBe(true);
    await importWindowsVoiceFiles(voices(100));
    expect(await importWindowsVoiceFilesIfMissing(voices(110))).toBe(false);
    expect(await getWindowsVoiceFile('LETSGO.WAV')).toEqual(wav(100).buffer);
    await clearWindowsVoiceFiles();
    expect(await canAutoImportWindowsVoiceFiles()).toBe(false);
    expect(await importWindowsVoiceFilesIfMissing(voices())).toBe(false);
    await importWindowsVoiceFiles(voices(120));
    expect(await getWindowsVoiceFile('LETSGO.WAV')).toEqual(wav(120).buffer);
  });

  it('does not let delayed automatic loading replace manually imported voices', async () => {
    await importLemmingsFiles(game());
    expect(await canAutoImportWindowsVoiceFiles()).toBe(true);
    await importWindowsVoiceFiles(voices(99));
    expect(await importWindowsVoiceFilesIfMissing(voices(110))).toBe(false);
    expect(await getWindowsVoiceFile('LETSGO.WAV')).toEqual(wav(99).buffer);
  });

  it('preserves the manual selection when an automatic import races another tab', async () => {
    await importLemmingsFiles(game());
    await Promise.all([importWindowsVoiceFilesIfMissing(voices(110)), importWindowsVoiceFiles(voices(99))]);
    expect(await getWindowsVoiceFile('LETSGO.WAV')).toEqual(wav(99).buffer);
  });

  it('optionally stores validated Windows sound effects and MIDI alongside the voices', async () => {
    await importLemmingsFiles(game());
    const additional = [new File([wav(77)], 'splat.wav'), new File([midi()], 'tim1p.mid')];
    await importWindowsVoiceFiles([...voices(), ...additional]);
    expect(await getWindowsAudioFile('splat.wav')).toEqual(wav(77).buffer);
    expect(await getWindowsAudioFile('TIM1P.MID')).toEqual(midi().buffer);
    await expect(importWindowsVoiceFiles([...voices(), new File(['bad'], 'TIM1P.MID')])).rejects.toThrow('TIM1P.MID is not a supported MIDI file');
    expect(await getWindowsAudioFile('TIM1P.MID')).toEqual(midi().buffer);
    await clearWindowsVoiceFiles();
    expect(await getWindowsAudioFile('splat.wav')).toBeUndefined();
    expect(await getWindowsAudioFile('TIM1P.MID')).toBeUndefined();
  });

  it.each(['missing terminator', 'zero duration', 'unsupported timing'] as const)(
    'rejects a structurally valid MIDI replacement with %s before replacing existing audio', async problem => {
      await importWindowsVoiceFiles([...voices(77), new File([midi()], 'TIM1P.MID')]);
      const malformed = midi();
      if (problem === 'missing terminator') malformed[32] = 1;
      else if (problem === 'zero duration') malformed[26] = 0;
      else malformed[12] = 0x80;
      await expect(importWindowsVoiceFiles([...voices(99), new File([malformed], 'TIM1P.MID')]))
        .rejects.toThrow('TIM1P.MID is not a supported MIDI file');
      expect(await getWindowsAudioFile('TIM1P.MID')).toEqual(midi().buffer);
      expect(await getWindowsVoiceFile('OHNO.WAV')).toEqual(wav(77).buffer);
    });
});

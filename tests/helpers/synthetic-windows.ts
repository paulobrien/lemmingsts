import { WINDOWS_GAME_FILES, WINDOWS_LEVEL_FILES } from '../../src/game/resources/file/windows-game-names';
import { WINDOWS_GRAPHICS_FILES } from '../../src/game/resources/file/windows-graphics-names';
import { WINDOWS_VOICE_FILES } from '../../src/game/resources/file/windows-voice-files';

/** Minimal invented fixtures; no original game assets. */
export function windowsWav(marker = 1): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(48); const view = new DataView(bytes.buffer);
  const tag = (offset: number, value: string) => bytes.set(new TextEncoder().encode(value), offset);
  tag(0, 'RIFF'); view.setUint32(4, 40, true); tag(8, 'WAVE');
  tag(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, 7092, true); view.setUint32(28, 7092, true);
  view.setUint16(32, 1, true); view.setUint16(34, 8, true); tag(36, 'data');
  view.setUint32(40, 4, true); bytes.fill(marker, 44); return bytes;
}
export function windowsSprite(marker = 1): Uint8Array<ArrayBuffer> {
  return Uint8Array.from([0x53, 0x52, 0x4c, 0x45, 1, 0, 10, 0, 0, 0,
    0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0x81, marker, 0x80]);
}
export function windowsDatabase(): Uint8Array<ArrayBuffer> {
  const data = new Uint8Array(8 + 9 * 137); const view = new DataView(data.buffer);
  view.setUint32(0, 2, true); view.setUint32(4, 9, true);
  const record = (i: number, depth: number, folder: number, name: string, file = '') => {
    const start = 8 + i * 137; data[start + 2] = depth; data[start + 3] = folder;
    data.set(new TextEncoder().encode(name), start + 10); data.set(new TextEncoder().encode(file), start + 50);
  };
  record(0, 1, 1, 'Original', 'orig');
  ['Fun', 'Tricky', 'Taxing', 'Mayhem'].forEach((name, i) => {
    record(1 + 2 * i, 2, 1, name); record(2 + 2 * i, 3, 0, name, `LVL000${i}.LVL`);
  });
  return data;
}
export const windowsAudioFiles = (marker = 1) => WINDOWS_VOICE_FILES.map(name => new File([windowsWav(marker)], name));
export const windowsGraphicsFiles = (marker = 1) => WINDOWS_GRAPHICS_FILES.map(name => new File([
  name.endsWith('.PAL') ? Uint8Array.from([0x20, 0x4c, 0x41, 0x50, 1, 0, 1, 2, 3, 0]) : windowsSprite(marker),
], name));
export const windowsGameFiles = (marker = 1) => WINDOWS_GAME_FILES.map(name => new File([
  name === 'LEMMINGS.DB' ? windowsDatabase() : new Uint8Array(WINDOWS_LEVEL_FILES.includes(name) ? 2048 : 1056).fill(marker),
], name));
export const windowsFiles = (marker = 1) => [...windowsAudioFiles(marker), ...windowsGraphicsFiles(marker), ...windowsGameFiles(marker)];

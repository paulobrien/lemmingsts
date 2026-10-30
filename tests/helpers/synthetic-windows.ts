import { WINDOWS_GAME_FILES, WINDOWS_LEVEL_FILES } from '../../src/game/resources/file/windows-game-names';
import { WINDOWS_GRAPHICS_ALL_FILES, WINDOWS_GRAPHICS_FILES } from '../../src/game/resources/file/windows-graphics-names';
import { WINDOWS_AUDIO_FILES, WINDOWS_VOICE_FILES } from '../../src/game/resources/file/windows-voice-files';

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
export function windowsBitmap(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(66), view = new DataView(bytes.buffer);
  bytes.set([0x42, 0x4d]); view.setUint32(2, bytes.length, true); view.setUint32(10, 62, true);
  view.setUint32(14, 40, true); view.setInt32(18, 2, true); view.setInt32(22, 1, true);
  view.setUint16(26, 1, true); view.setUint16(28, 8, true); view.setUint32(46, 2, true);
  bytes.set([10, 20, 30, 0, 40, 50, 60, 0], 54); bytes.set([0, 1], 62);
  return bytes;
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
/** Small, nonempty masks with the frame dimensions required by the simulation. */
export function windowsMaskSprites(marker = 1): Uint8Array<ArrayBuffer> {
  const count = 354; const tableEnd = 6 + count * 4;
  const bytes = new Uint8Array(tableEnd + count * 15); const view = new DataView(bytes.buffer);
  bytes.set([0x53, 0x52, 0x4c, 0x45]); view.setUint16(4, count, true);
  for (let index = 0; index < count; index++) {
    const offset = tableEnd + index * 15; view.setUint32(6 + index * 4, offset, true);
    view.setUint16(offset + 4, 1, true); view.setUint16(offset + 6, 1, true);
    view.setUint16(offset + 8, 16, true);
    view.setUint16(offset + 10, index === 335 ? 22 : index >= 349 ? 8 : 16, true);
    bytes.set([0x81, marker, 0x80], offset + 12);
  }
  return bytes;
}
export function windowsMidi(): Uint8Array<ArrayBuffer> {
  return Uint8Array.from([77, 84, 104, 100, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
    77, 84, 114, 107, 0, 0, 0, 12, 0, 0x90, 60, 80, 96, 0x80, 60, 0, 0, 255, 47, 0]);
}
export const windowsFiles = (marker = 1) => [
  ...WINDOWS_AUDIO_FILES.map(name => new File([name.endsWith('.MID') ? windowsMidi() : windowsWav(marker)], name)),
  ...windowsGraphicsFiles(marker),
  ...WINDOWS_GRAPHICS_ALL_FILES.filter(name => !WINDOWS_GRAPHICS_FILES.includes(name))
    .map(name => new File([name === 'LEMMSMA.SPR' ? windowsMaskSprites(marker) : name.endsWith('.BMP') ? windowsBitmap() : windowsSprite(marker)], name)),
  ...windowsGameFiles(marker),
];

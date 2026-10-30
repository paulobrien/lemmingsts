/** Optional speech recordings from a separately owned Windows Lemmings copy. */
export const WINDOWS_VOICE_FILES = ['LETSGO.WAV', 'OHNO.WAV', 'YIPPEE.WAV'] as const;
export type WindowsVoiceFile = typeof WINDOWS_VOICE_FILES[number];

/** Recognized Windows sound and MIDI files; only the three voices are required. */
export const WINDOWS_SOUND_FILES: readonly string[] = [
  ...WINDOWS_VOICE_FILES, 'BANG.WAV', 'CHAIN.WAV', 'CHANGEOP.WAV', 'CHINK.WAV',
  'DIE.WAV', 'DOOR.WAV', 'ELECTRIC.WAV', 'EXPLODE.WAV', 'FIRE.WAV', 'GLUG.WAV',
  'MANTRAP.WAV', 'MOUSEPRE.WAV', 'OING.WAV', 'SCRAPE.WAV', 'SLICER.WAV',
  'SPLASH.WAV', 'SPLAT.WAV', 'TENTON.WAV', 'THUD.WAV', 'THUNK.WAV', 'TING.WAV',
];
export const WINDOWS_MUSIC_FILES: readonly string[] = [
  'CANCANP.MID', 'LEMMIN1P.MID', 'LEMMIN2P.MID', 'LEMMIN3P.MID', 'MOUNTAIP.MID',
  'TENLEMSP.MID', ...Array.from({ length: 9 }, (_, index) => `TIM${index + 1}P.MID`),
];
export const WINDOWS_AUDIO_FILES: readonly string[] = [...WINDOWS_SOUND_FILES, ...WINDOWS_MUSIC_FILES];

/** Check bounded, uncompressed PCM WAV data before saving it locally. */
export function validateWindowsVoiceFile(name: string, buffer: ArrayBuffer): void {
  const bytes = new Uint8Array(buffer);
  const fail = (): never => { throw new Error(`${name} is not a supported PCM WAV file.`); };
  if (bytes.length < 44 || bytes.length > 1024 * 1024) return fail();
  const view = new DataView(buffer);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  const end = view.getUint32(4, true) + 8;
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || end !== bytes.length) return fail();
  let foundFormat = false;
  let foundData = false;
  let blockAlign = 0;
  let dataLength = 0;
  for (let offset = 12; offset < end;) {
    if (offset + 8 > end) return fail();
    const length = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + length > end) return fail();
    if (tag(offset) === 'fmt ') {
      if (foundFormat || length < 16) return fail();
      const format = view.getUint16(start, true);
      const channels = view.getUint16(start + 2, true);
      const sampleRate = view.getUint32(start + 4, true);
      const byteRate = view.getUint32(start + 8, true);
      blockAlign = view.getUint16(start + 12, true);
      const bits = view.getUint16(start + 14, true);
      if (format !== 1 || (channels !== 1 && channels !== 2) ||
          sampleRate < 1000 || sampleRate > 96000 || ![8, 16, 24, 32].includes(bits) ||
          blockAlign !== channels * bits / 8 || byteRate !== sampleRate * blockAlign) return fail();
      foundFormat = true;
    } else if (tag(offset) === 'data') {
      if (foundData || !length) return fail();
      foundData = true;
      dataLength = length;
    }
    offset = start + length + (length % 2);
    if (offset > end) return fail();
  }
  if (!foundFormat || !foundData || dataLength % blockAlign !== 0) return fail();
}

/** Validate a Standard MIDI File's header and bounded track chunks. */
export function validateWindowsMusicFile(name: string, buffer: ArrayBuffer): void {
  const bytes = new Uint8Array(buffer);
  const fail = (): never => { throw new Error(`${name} is not a supported MIDI file.`); };
  if (bytes.length < 22 || bytes.length > 1024 * 1024) return fail();
  const view = new DataView(buffer);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (tag(0) !== 'MThd' || view.getUint32(4) !== 6) return fail();
  const format = view.getUint16(8), tracks = view.getUint16(10), division = view.getUint16(12);
  if (format > 1 || tracks < 1 || tracks > 128 || (format === 0 && tracks !== 1) || !division) return fail();
  let offset = 14;
  for (let i = 0; i < tracks; i++) {
    if (offset + 8 > bytes.length || tag(offset) !== 'MTrk') return fail();
    const length = view.getUint32(offset + 4);
    offset += 8 + length;
    if (offset > bytes.length) return fail();
  }
  if (offset !== bytes.length) return fail();
}

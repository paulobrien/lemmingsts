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

/** Import and playback use the same bounded MIDI parser requirements. */
export function validateWindowsMusicFile(name: string, buffer: ArrayBuffer): void {
  if (!validateWindowsMidi(buffer)) throw new Error(`${name} is not a supported MIDI file.`);
}

/** Validate untrusted Standard MIDI Files before passing them to the MIDI synth.
 * The synth's parser assumes well-formed, terminated tracks and can otherwise
 * loop forever. Bound file size, event count, variable-length numbers and all
 * reads, and require an end-of-track event for each track.
 */
export function validateWindowsMidi(input: ArrayBuffer): boolean {
    const data = new Uint8Array(input);
    if (data.length < 22 || data.length > 1024 * 1024) return false;
    const four = (p: number, s: string) => s.split('').every((c, i) => data[p + i] === c.charCodeAt(0));
    const u16 = (p: number) => data[p] * 256 + data[p + 1];
    const u32 = (p: number) => data[p] * 0x1000000 + data[p + 1] * 0x10000 + data[p + 2] * 256 + data[p + 3];
    if (!four(0, 'MThd') || u32(4) !== 6) return false;
    const format = u16(8), tracks = u16(10), division = u16(12);
    if (format > 1 || !tracks || tracks > 64 || (format === 0 && tracks !== 1) || !division || division >= 0x8000) return false;
    let pos = 14, events = 0, notes = 0, firstTick = Infinity, lastTick = -1;
    for (let track = 0; track < tracks; track++) {
        if (pos + 8 > data.length || !four(pos, 'MTrk')) return false;
        const length = u32(pos + 4); pos += 8;
        const end = pos + length;
        if (end > data.length) return false;
        let running = 0, ended = false, tick = 0;
        const variable = (): number | null => {
            let value = 0;
            for (let i = 0; i < 4; i++) {
                if (pos >= end) return null;
                const byte = data[pos++]; value = value * 128 + (byte & 0x7f);
                if (!(byte & 0x80)) return value;
            }
            return null;
        };
        while (pos < end && ++events <= 100_000) {
            const delta = variable();
            if (delta === null || pos >= end || (tick += delta) > 10_000_000) return false;
            let status = data[pos];
            if (status & 0x80) {
                pos++;
                if (status < 0xf0) running = status;
                else running = 0;
            } else {
                if (!running) return false;
                status = running;
            }
            if (status === 0xff) {
                if (pos >= end) return false;
                const type = data[pos++], size = variable();
                if (size === null || size > end - pos) return false;
                if (type === 0x51 && (size !== 3 || (data[pos] === 0 && data[pos + 1] === 0 && data[pos + 2] === 0))) return false;
                if (type === 0x51) { firstTick = Math.min(firstTick, tick); lastTick = Math.max(lastTick, tick); }
                if (type === 0x2f) {
                    if (size !== 0) return false;
                    ended = true;
                    pos += size;
                    break;
                }
                pos += size;
            } else if (status === 0xf0 || status === 0xf7) {
                const size = variable();
                if (size === null || size > end - pos) return false;
                firstTick = Math.min(firstTick, tick); lastTick = Math.max(lastTick, tick);
                pos += size;
            } else if (status >= 0x80 && status <= 0xef) {
                const size = (status & 0xe0) === 0xc0 ? 1 : 2;
                if (pos + size > end || Array.from(data.subarray(pos, pos + size)).some(byte => byte >= 0x80)) return false;
                if ((status & 0xf0) === 0x90 && data[pos + 1] !== 0) notes++;
                firstTick = Math.min(firstTick, tick); lastTick = Math.max(lastTick, tick);
                pos += size;
            } else return false;
        }
        if (!ended || events > 100_000) return false;
        pos = end;
    }
    // The bundled synth loops its retained events, not the end-of-track marker.
    // All retained events at one tick would make its scheduling loop run forever.
    return notes > 0 && lastTick > firstTick && pos === data.length;
}

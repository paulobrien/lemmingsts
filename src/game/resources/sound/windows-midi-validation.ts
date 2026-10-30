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

/** Composite native RGBA foreground pixels over a background into a reusable
 * buffer. Game artwork is normally either transparent or fully opaque; the
 * remaining case preserves source-over semantics for partially opaque pixels.
 * The three buffers must be distinct and of equal, whole-pixel length.
 */
export function compositeNativeLayers(background: Uint8ClampedArray, foreground: Uint8ClampedArray,
    output: Uint8ClampedArray): void {
    if (background.length !== foreground.length || output.length !== background.length || background.length % 4 !== 0 ||
        output.buffer === foreground.buffer || output.buffer === background.buffer) {
        throw new Error('Native compositing buffers must be distinct and have matching RGBA dimensions.');
    }

    output.set(background);
    for (let index = 0; index < foreground.length; index += 4) {
        const alpha = foreground[index + 3];
        if (alpha === 0) continue;
        if (alpha === 255) {
            output[index] = foreground[index];
            output[index + 1] = foreground[index + 1];
            output[index + 2] = foreground[index + 2];
            output[index + 3] = 255;
            continue;
        }
        const backgroundAlpha = background[index + 3];
        const backgroundWeight = backgroundAlpha * (255 - alpha) / 255;
        const resultAlpha = alpha + backgroundWeight;
        for (let channel = 0; channel < 3; channel++) {
            output[index + channel] = (foreground[index + channel] * alpha + background[index + channel] * backgroundWeight) / resultAlpha;
        }
        output[index + 3] = resultAlpha;
    }
}

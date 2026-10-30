/** Windows original-game high-resolution graphics used by the native-art prototype. */
export const WINDOWS_GRAPHICS_FILES: readonly string[] = [
  'LEMMBIG.SPR', 'FE.PAL',
  ...Array.from({ length: 5 }, (_, index) => [`LEVEL${index}.PAL`, `LEVEL${index}B.SPR`, `LEVEL${index}OB.SPR`]).flat(),
];
export const WINDOWS_GRAPHICS_GFX_FILES: readonly string[] = ['LEMMBIG.SPR', 'FE.PAL'];
export const WINDOWS_GRAPHICS_STYLE_FILES: readonly string[] = WINDOWS_GRAPHICS_FILES.filter(name => !WINDOWS_GRAPHICS_GFX_FILES.includes(name));

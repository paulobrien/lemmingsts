/** Windows original-game high-resolution graphics used by the native-art prototype. */
export const WINDOWS_GRAPHICS_FILES: readonly string[] = [
  'LEMMBIG.SPR', 'FE.PAL',
  ...Array.from({ length: 5 }, (_, index) => [`LEVEL${index}.PAL`, `LEVEL${index}B.SPR`, `LEVEL${index}OB.SPR`]).flat(),
];
/** Optional toolbar artwork; older imports without these files remain usable. */
export const WINDOWS_UI_GRAPHICS_FILES: readonly string[] = [
  'ICO_MINS.SPR', 'ICO_PLUS.SPR', 'ICO_CLIM.SPR', 'ICO_FLOT.SPR',
  'ICO_BOMB.SPR', 'ICO_BLOK.SPR', 'ICO_BILD.SPR', 'ICO_BASH.SPR',
  'ICO_AXE.SPR', 'ICO_DIG.SPR', 'ICO_PAWS.SPR', 'ICO_NUKE.SPR',
];
export const WINDOWS_GRAPHICS_ALL_FILES: readonly string[] = [...WINDOWS_GRAPHICS_FILES, ...WINDOWS_UI_GRAPHICS_FILES];
export const WINDOWS_GRAPHICS_GFX_FILES: readonly string[] = ['LEMMBIG.SPR', 'FE.PAL', ...WINDOWS_UI_GRAPHICS_FILES];
export const WINDOWS_GRAPHICS_STYLE_FILES: readonly string[] = WINDOWS_GRAPHICS_FILES.filter(name => !WINDOWS_GRAPHICS_GFX_FILES.includes(name));

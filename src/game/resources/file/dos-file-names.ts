/** Original DOS Lemmings resources required by the current configuration. */
export const REQUIRED_LEMMINGS_FILES: readonly string[] = [
  'ADLIB.DAT', 'MAIN.DAT', 'ODDTABLE.DAT',
  ...Array.from({ length: 10 }, (_, index) => `LEVEL${String(index).padStart(3, '0')}.DAT`),
  ...Array.from({ length: 5 }, (_, index) => `GROUND${index}O.DAT`),
  ...Array.from({ length: 5 }, (_, index) => `VGAGR${index}.DAT`),
  ...Array.from({ length: 4 }, (_, index) => `VGASPEC${index}.DAT`),
];

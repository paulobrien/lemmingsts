# Windows-only game data: developer investigation

The current Windows mode requires both the DOS game files and the Windows files. Importing the Windows ISO by itself stores its supported audio and artwork, but does not yet make the game playable. The game still loads levels and physics resources from the DOS engine data. The Windows files are user-supplied and must not be committed or included in source archives.

## What the supplied Windows disc contains

The disc includes individual 2,048-byte original level records in `LEMMINGS/LEVEL/ORIG/`, graphics metadata in `LEMMINGS/STYLES/GROUND0O.DAT` through `GROUND4O.DAT`, Windows sprite sheets and palettes, 15 MIDI tracks, and 24 WAV effects. In a local comparison, the 80 original base level records matched the corresponding unpacked DOS level records, and the five `GROUND` metadata files matched the DOS files. The ISO does not contain the DOS-format `MAIN.DAT`, `ODDTABLE.DAT`, `VGAGR*.DAT`, `VGASPEC*.DAT` or `ADLIB.DAT` files used by the existing loader.

`LEMMINGS/USERS/LEMMINGS.DB` describes level ordering and variants. The supplied file has an eight-byte header followed by 137-byte records for levels and folders. Level records contain a name and source filename; alternate records also contain starting skills, time, required saves, population and release rate. The Windows database parser is checked against all 114 entries in the supplied disc's original-game hierarchy: their starting values and decoded object, terrain and steel placements match the corresponding DOS records. This comparison does not verify that a level can be completed using Windows-derived collision data and masks. Other Windows releases may use a different database layout.

The disc's original-game database contains 28 Fun, 28 Tricky, 29 Taxing and 29 Mayhem entries. Compared with the 120 DOS entries, it omits Fun 13 (We all fall down), Fun 22 (A Beast of a level), Tricky 14 (MENACING !!), Tricky 21 (All the 6's), Taxing 15 (What an AWESOME level), and Mayhem 22 (A BeastII of a level). Four of those are special-picture levels and the disc does not contain their full-size backgrounds. Do not present a copied DOS level as a native Windows-disc level. Windows level indices and DOS level indices differ, so progress and replay hints must be isolated or explicitly mapped and verified.

The DOS gameplay masks currently come from unpacked `MAIN.DAT` part 1 (`MaskProvider`): bash, mine and explosion masks as well as countdown digits. A local search for exact contiguous 16-byte or longer sequences from that part in the supplied Windows `LEMMINGS.EXE` and `PROCESS.DLL` found no matches. This does not rule out transformed, compressed or differently represented masks, or other files on the disc.

## Work required before offering Windows-only play

1. Define a Windows resource provider and import the needed level records, database and additional data, retaining the same privacy, validation, storage, offline and bundle guarantees as the current importers. Establish version checks and useful errors for unsupported discs.
2. Use the parsed Windows level ordering and alternate-level properties from the supplied disc. Its 114 entries have been compared against the corresponding DOS level records. Other releases require their own format and compatibility checks.
3. Replace the remaining DOS-specific level loading paths with Windows terrain, objects and palette data, including special terrain. Verify positioning, animation, collision and one-way/steel behaviour.
4. Provide Windows-compatible lemming animations, skill panel assets, glyphs and gameplay masks. Establish the exact physics masks from a reliable source or reconstruct and validate them; visual similarity alone is insufficient.
5. Route Windows mode through the new provider without loading DOS `MAIN.DAT`, `VGAGR`, `ODDTABLE` or `ADLIB` resources. Keep the DOS provider independent and avoid silently falling back across editions.
6. Add integration coverage for a fresh browser containing only the Windows disc, all levels loading, representative mechanics, save/reload and offline usage. Run the existing recorded solutions or equivalent completion checks against every level and investigate any edition-specific differences before claiming completion.

Until these steps are complete, retain the DOS prerequisite and explain it wherever the Windows import or mode is offered.

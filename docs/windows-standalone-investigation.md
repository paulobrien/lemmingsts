# Windows-only game data: developer investigation

Windows mode loads levels, graphics and gameplay masks from the Windows disc and can run without DOS game files. The simulation is shared with the DOS mode, but the resources and level order are edition-specific. The Windows files are user-supplied and must not be committed or included in source archives.

## What the supplied Windows disc contains

The disc includes individual 2,048-byte original level records in `LEMMINGS/LEVEL/ORIG/`, graphics metadata in `LEMMINGS/STYLES/GROUND0O.DAT` through `GROUND4O.DAT`, Windows sprite sheets and palettes, 15 MIDI tracks, and 24 WAV effects. In a local comparison, the 80 original base level records matched the corresponding unpacked DOS level records, and the five `GROUND` metadata files matched the DOS files. The ISO does not contain the DOS-format `MAIN.DAT`, `ODDTABLE.DAT`, `VGAGR*.DAT`, `VGASPEC*.DAT` or `ADLIB.DAT` files used by the existing loader.

`LEMMINGS/USERS/LEMMINGS.DB` describes level ordering and variants. The supplied file has an eight-byte header followed by 137-byte records for levels and folders. Level records contain a name and source filename; alternate records also contain starting skills, time, required saves, population and release rate. The Windows database parser is checked against all 114 entries in the supplied disc's original-game hierarchy: their starting values and decoded object, terrain and steel placements match the corresponding DOS records. Private replay checks also exercise the Windows-derived terrain, sprites and masks; their results are described below. Other Windows releases may use a different database layout.

The disc's original-game database contains 28 Fun, 28 Tricky, 29 Taxing and 29 Mayhem entries. Compared with the 120 DOS entries, it omits Fun 13 (We all fall down), Fun 22 (A Beast of a level), Tricky 14 (MENACING !!), Tricky 21 (All the 6's), Taxing 15 (What an AWESOME level), and Mayhem 22 (A BeastII of a level). Four of those are special-picture levels and the disc does not contain their full-size backgrounds. Do not present a copied DOS level as a native Windows-disc level. Windows level indices and DOS level indices differ, so progress and replay hints must be isolated or explicitly mapped and verified.

The Windows gameplay masks are extracted at runtime from the player's `GFX/LEMMSMA.SPR`. A private comparison found that the first bash mask adds nine pixels in each direction compared with DOS and the explosion mask differs by one pixel. Those Windows masks are used as supplied: the DOS masks are not copied into the build or substituted during Windows play.

## Verification and remaining work

The low-resolution Windows terrain and placed object masks were compared with their DOS counterparts across all 114 Windows catalogue entries; their initial collision geometry matched. Private, Windows-only replay checks use only disc resources and map entries to separately authored DOS replays. In the initial run 113 of 114 levels completed; the DOS replay for Windows Taxing 8 failed, and two other levels completed with a recorded command rejected. Investigation traced those differences to the Windows bash mask. With a Windows-specific Taxing 8 route and adjustments to the other two recordings, all 114 levels complete and every replay command is accepted.

The Windows interface uses a generic bitmap font for some HUD text and does not reproduce the Windows application's original menus or minimap. Windows MIDI instruments are approximate. Existing DOS hints remain unavailable in Windows mode until separately verified against the Windows rules and ordering. More actual-device testing, supported-disc validation and Windows-specific completion routes remain useful.

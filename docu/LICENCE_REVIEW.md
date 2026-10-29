# Licence review: bundled OPL code

The inherited top-level `LICENSE` contains an MIT notice for the project followed by an LGPL-2.1-or-later notice attributed to Robson Cozendey for an OPL emulator. It does not identify the files covered by that latter notice.

The `src/game/resources/sound/DBOPL/` TypeScript files actually included in the current application identify the DOSBox Team and state GPL version 2 or later. Their README also identifies the implementation as a port of DOSBox's `dbopl.cpp`. The [DOSBox Staging licence](https://github.com/dosbox-staging/dosbox-staging/blob/main/LICENSE) describes its DOSBox-derived works as GPL-2.0-or-later. These notices conflict with any blanket claim that the bundled emulator is LGPL.

Production builds include a source archive and site-accessible notices for the project, DOSBox-derived code and key bundled dependencies. The archive contains application build inputs and explicitly excludes the player's DOS files. Providing these materials is a practical step, not a conclusion that all distribution obligations have been met. The inherited notices and the terms for the combined application still require review; do not represent this as resolved or describe the whole application as solely MIT. Preserve the existing copyright notices, including if the emulator is replaced.

The original DOS game files are separate from the application code. They must never be committed or included in the downloadable application source. The standard build imports them locally from the player. An explicitly enabled deployment bundle can also deliver operator-supplied files; the current play site uses that option and is public. That hosting decision does not resolve any rights questions around the original assets.

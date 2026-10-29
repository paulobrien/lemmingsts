# Lemmings TS

A modern browser player built on [Lemmings.ts](https://github.com/tomsoftware/Lemmings.ts), Thomas Zeugner's TypeScript Lemmings clone. The original project supplied the game engine, DOS data readers, rendering and AdLib music playback that this version builds on. Thanks to Thomas for making that work available.

Play with a mouse on a computer or with touch on an Android phone or tablet. The app can be installed from the browser and, once the app and your own game files are stored on the device, played offline. This is an early preview: actual Android hardware and some DOS physics details still need further verification.

## What changed

This modernization retains the original engine and game data formats while improving the experience around them:

- Replaced the old Vue CLI toolchain with Vite and current Vue and TypeScript tooling, a lockfile, type checking, automated tests and CI.
- Redesigned level selection and gameplay screens for desktop and touch, including responsive canvas scaling, skill controls, panning, zoom, speed, an in-game pause menu and level navigation. Fullscreen uses the browser API when available and an expanded view otherwise.
- Recreated the surrounding interface with a pixel-era look. After import, the home screen decodes the original title artwork from the player's own `MAIN.DAT` in memory; before import it uses original CSS artwork. The standard build contains no original game graphics.
- Added a local game-file import, including ZIP support, and an optional private-deployment bundle that loads automatically on each device. The app shell has an installable PWA manifest and offline cache; progress and preferences are saved locally per browser.
- Added structural validation before replacing imported game files, an offline-readiness indicator, and safer app-shell updates that retain a working offline version if an update is interrupted.
- Made level objectives and rescued counts visible, added action feedback and a shared nuke confirmation, remembered the last level and best result, and added progress-only backup and restore.
- Added keyboard lemming targeting and an optional visual first-move example, reconstructed from a separate tested replay without changing the player's current game.
- Improved game-data decoding, DOS simulation behaviour and audio handling, with focused regression tests and optional tests using locally supplied original files.
- Added independently authored completion replays and progressive, optional hints for all 120 levels of the original DOS game. Each replay has been tested against the supplied local files; loading a level alone is not treated as proof that it can be completed.
- Added optional original AdLib music and effects, plus synthesized PC-speaker-style digging, bashing, mining and nuke cues. The synthesized sounds are approximations, not original samples.
- Added an application source archive and licence notices to production builds. The original game files are not included.

The original Lemmings.ts project also described support for other Lemmings editions. Their historical configuration and parsers remain in the repository, but this version's import and verification work currently supports **original DOS Lemmings only**; the other editions should not be assumed to work.

## Bring your own game files

The original DOS files are not included. Use your own compatible copy; the expected names are listed in [the original-DOS file list](public/data/lemmings/README.md). The local `dos/` directory is ignored by Git, including `dos/lemmings/` and any ZIP kept there. Never commit original game files or put them in `public/data`: the build rejects unexpected files in that directory.

Open the app, choose **Add your game files** or **Or choose a folder**, and select the original files together or an unencrypted ZIP containing them. Names are accepted in upper or lower case. The app checks file structure before storing the files in the browser's local IndexedDB; it does not upload them. An invalid replacement leaves any existing files intact. Structural validation cannot prove that a set is the exact edition used for the tested hints. Import separately on each device. Use **Remove game files** on the home screen to remove them; clearing site storage may also remove files and progress.

### Optional bundle for a private deployment

If you operate a private site, you can add your own files to its build so that a new device loads them automatically. Put the required original DOS files in the ignored `dos/lemmings/` directory, then run:

```sh
npm ci
npm run build:local
```

This validates the required files and copies them into `dist/data/local-game/`, with a small manifest. Deploy that `dist/` directory only to a host that requires authentication for the site **and its asset paths**. The files are not encrypted: anyone who can access those paths can download them. A public URL, an obscure path, or leaving the files out of Git does not protect a deployed copy. The generated `dist/` directory and the original `dos/` directory are ignored by Git; the source archive excludes game files.

On first visit, the app checks for the same-origin manifest, downloads and validates the files, and stores them in that browser's IndexedDB. Existing files are never overwritten by the automatic import; if the bundle is absent or cannot be validated, manual import remains available. Removing game files deliberately prevents them being automatically re-imported on that browser; adding files manually works as usual. The service worker does not cache the bundle. Each device needs to load it while online before it can play offline.

`npm run build` is the default, game-file-free build and clears the prior `dist/` output, including any private bundle. An alternative source directory can be supplied to the opt-in build with `LEMMINGS_DOS_DIR=/path/to/files npm run build:local`. The host must serve the generated JSON manifest and DAT files as static files on the same origin; authentication redirects or an HTML fallback for a missing file cannot act as a bundle.

## Play and install

Choose a difficulty and level, then start the level. The target and time are shown before play, and the rescued count is updated during play. Select a skill and click or tap a lemming to assign it; drag the game area to pan, and use the zoom controls or a mouse wheel over the level to change the view. **Reset zoom** restores the default scale. To play with a keyboard, focus the game canvas, use left/right arrows to select an active lemming, and press Enter to assign the selected skill; Space pauses or resumes. Choose **Fullscreen** to fit the game screen to the display; the on-screen **Controls** button opens the skill, zoom, audio and other controls. If the browser doesn't allow native fullscreen, the game expands within the available browser window instead. The pause menu offers resume, restart, level selection and fullscreen controls while keeping skill selection available. Speed and release-rate controls are available during a level. Both nuke controls use the same confirmation.

Hints are optional and reveal one step at a time. A local fingerprint of the imported level, terrain and physics files is checked against the data used for the tested solutions; hints are unavailable for a different or unverifiable set, but the game remains playable. Nothing is uploaded for this check. After revealing a hint, **Show example first move** marks where the tested route begins. It is an illustration from a separate replay, not advice adapted to the current attempt; its position and timing can differ if you play another route.

On Android Chrome, open the HTTPS site and use **Install app** or **Add to Home screen**. Load the app while online and import your files on that device before trying it offline; the home screen reports when the app shell is ready. Browser-managed storage can be cleared or evicted. Progress, settings and imported files do not sync between devices. **Export backup** on the home screen saves progress, settings and the last level, but never the game files; **Restore backup** replaces those settings and progress on the device. Keep your own game-file copy separately. For checks on the actual phone and tablet, see [Android device check](docu/ANDROID_DEVICE_CHECK.md).

In a level, open **Display settings** to choose **Original** or the experimental **Enhanced** style. Original is the default. Enhanced applies a locally computed 2× edge-guided filter to the visible game area; it preserves the classic HUD and changes presentation only, not level rules, hit targets or physics. **Compare styles** shows read-only original and enhanced previews of the same view and moment; scroll sideways if needed on a small screen. The graphics preference is saved separately on each device and is not included in progress backups. Enhancement and live comparison may slow play, especially on phones or at high speed; switch back to Original or close the comparison if needed.

Music and sound effects have separate switches and start off by default. The AdLib effects include opening cues, skill selection and assignments, builder warnings, steel, Oh No, exits, splats, explosions, drowning, fire and triggered traps. Each effects channel is monophonic; the short nuke alert takes priority over other speaker cues. The AdLib interpreter uses a legacy Web Audio processor, and browsers may require user interaction before audio can play.

## Develop

Requires Node.js 22.12 or newer and npm:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite and import the game files through the app. Common checks are:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

The production build is in `dist/`. A static host must serve `index.html` as a fallback for app routes such as `/game/1`. The standard build checks the public data directory and creates `source-code.zip` with application source and build inputs, excluding the player's DOS files. See the private-deployment instructions above for the separate opt-in build.

## Tests and level verification

The default unit tests and CI use synthetic fixtures and need no original game files. Browser tests use Playwright; install Chromium with `npx playwright install chromium`, then run `npm run test:e2e`. CI runs installation, type checking, unit tests, the production build and browser tests.

With the original files privately present in `dos/lemmings/`, run the stricter optional checks:

```sh
RUN_PRIVATE_GAME_TESTS=1 REQUIRE_ALL_LEVEL_SOLUTIONS=1 npx vitest run tests/integration/local-game-files.spec.ts
RUN_PRIVATE_GAME_TESTS=1 npx vitest run tests/integration/import-validation-private.spec.ts
RUN_PRIVATE_GAME_TESTS=1 npx vitest run tests/integration/sound-effects-private.spec.ts
RUN_PRIVATE_GAME_TESTS=1 npm run test:e2e
```

The authored coverage gate requires a solution for every original level and plays each replay through to victory. [Integration test notes](tests/integration/README.md) describe optional additional checks using separately obtained community recordings. Those recordings and the original DOS files are not in Git or in the public build. Passing these replays verifies the tested routes in this engine, not complete equivalence with every DOS release.

## Licence and acknowledgements

The repository's [LICENSE](LICENSE) includes an MIT notice and a separate LGPL notice for an OPL emulator. However, the bundled DOSBox-derived [DBOPL source](src/game/resources/sound/DBOPL/db-opl3.ts) explicitly carries a GPL-2.0-or-later notice. Those inherited notices do not establish that the combined application is solely MIT or that DBOPL is LGPL. The site provides source and notices, but the distribution terms still need review; see [licence review](docu/LICENCE_REVIEW.md).

Lemmings and the original game assets belong to their respective rights holders. This project does not claim rights to the original game or supply its assets. The optional private bundle uses your own files; neither it nor local import is a guarantee about trademark or other rights.

Thomas's original acknowledgements thank DMA for the original game; Volker Oth, ccexplore and Mindless for reverse engineering the level and graphics formats; and the DOSBox project for its OPL emulator. Those contributions remain central to this project.

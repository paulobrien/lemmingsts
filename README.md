# Lemmings at Home

A browser-based Lemmings player, modernised from [tomsoftware/Lemmings.ts](https://github.com/tomsoftware/Lemmings.ts). Play on desktop, Android phone or Android tablet, with mouse or touch. The application can be installed as a progressive web app and, once set up, played offline.

## Game files

The original DOS Lemmings data files are not included. Use your own compatible copy: the expected filenames are listed in [public/data/lemmings/README.md](public/data/lemmings/README.md). The `dos/` directory, including the supplied local copy in `dos/lemmings/`, is ignored by Git. Keep ZIP archives of your game files there or outside the repository. Never commit game files or put them in `public/data`; a build-time check rejects unexpected files there.

Open the app and choose **Add your game files** or **Or choose a folder**. Select the original DOS files together, or choose one unencrypted ZIP archive containing them; uppercase and lowercase names are accepted. The app validates the required files and stores them in this browser's local IndexedDB; it does not upload them. Import the files separately on each device. You can remove the imported files from the home screen. Clearing browser storage may remove game files and progress.

Only the original DOS Lemmings edition is supported by the current import flow. Other editions in the historical configuration have not yet been adapted.

## Develop

Requires Node.js 22.12 or newer and npm:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Import your original game files through the app; they should not be copied into the public directory.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

The default tests and CI use synthetic fixtures and need no original game files. Browser smoke tests use Playwright; install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e`. To run the optional integration and browser tests against the ignored local copy:

```sh
RUN_PRIVATE_GAME_TESTS=1 npx vitest run tests/integration/local-game-files.spec.ts
RUN_PRIVATE_GAME_TESTS=1 npx vitest run tests/integration/sound-effects-private.spec.ts
RUN_PRIVATE_GAME_TESTS=1 npm run test:e2e
```

## Install and play offline

Serve the production build over HTTPS (localhost also works for development). In Android Chrome, use the browser's install or add-to-home-screen option. After the app has loaded, the service worker has prepared the app shell, and the original files have been imported on that device, it can run without a connection. Offline storage is managed by the browser and can be cleared or evicted. Install and offline behaviour should be checked on the target devices and browser.

For the remaining physical phone and tablet checks, see [Android device check](docu/ANDROID_DEVICE_CHECK.md).

Progress and settings are stored locally per browser. They do not sync between devices. A static host must serve `index.html` as a fallback for application routes such as `/game/1`. The production build is in `dist/` and contains the app but no original game files.

Hints are revealed one at a time on request. All 120 original levels have a project-authored solution and hints, and each recorded solution has passed the local completion test using the original game files. Separately obtained community recordings can provide additional compatibility checks. Some original DOS physics details still need further verification.

Music and sound effects have separate switches and start off by default. The optional effects use the locally imported DOS AdLib data and cover the opening cues, skill selection and assignments, builder warnings, steel, Oh No, exits, splats, explosions, drowning, fire and triggered traps. Other gameplay effects are not yet connected. Effects are monophonic: a newer effect replaces the previous one. The existing AdLib interpreter uses a legacy Web Audio processor, and browsers may require a user interaction before audio can play.

## Licence and acknowledgements

The repository's [LICENSE](LICENSE) includes an MIT licence and a separate LGPL notice for an OPL emulator. However, the bundled DOSBox-derived [DBOPL source](src/game/resources/sound/DBOPL/db-opl3.ts) explicitly carries a GPL-2.0-or-later notice. These inherited notices do not establish that the complete application is solely MIT or that DBOPL is LGPL. See [licence review](docu/LICENCE_REVIEW.md) before distributing the application. The original Lemmings game files have their own rights and are not covered by the project licence; this project does not claim rights to them.

Thanks to DMA for the original game; Volker Oth, ccexplore and Mindless for reverse-engineering the level and graphics formats; and the DOSBox project for its OPL emulator.

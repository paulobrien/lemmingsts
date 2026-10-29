# Lemmings modernisation plan

## Goal and approach

Create a polished, faithful Lemmings experience for desktop browsers, Android tablets and Android phones. Keep the original game's character while making the interface easy to use with a mouse or touch. Treat the existing TypeScript engine as a starting point and replace or repair parts as evidence demands.

Build an installable progressive web app (PWA) first: one web application can run in a desktop browser and be installed to an Android home screen. Expo is built around React Native; adopting it here would require a separate native layer or substantial UI and browser-API adaptation. Revisit it only if a concrete native feature or distribution requirement warrants that work.

Original game files must never enter Git or the downloadable source archive. The standard build and original import-only preview contain no game files. The owner subsequently chose a second public play deployment with an explicit opt-in game-file bundle; preserve that distinction when deploying both sites. Each browser stores files and progress separately, with no automatic sync. See the [current deployment instructions](README.md#the-two-hosted-sites).

## Current status

The baseline, toolchain migration, 120 authored completion replays, progressive hints, local import and backups, installable/offline app shell, optional graphics enhancement, and both hosted deployments are implemented. Fullscreen play shows the original game and HUD; the original pause button opens the surrounding controls. The stages below retain their acceptance criteria and the rationale behind the work.

Remaining release checks are physical Android phone/tablet installation, offline relaunch, audio output and interruptions, portrait HUD usability, and performance of the optional enhanced filter. Chromium emulation cannot establish those hardware results. DOS physics parity outside the tested routes and the inherited OPL licence questions also remain open; passing the replay gate is not proof of full DOS equivalence.

## 1. Establish a working baseline

- Document the current Node setup and determine whether the existing application builds and runs; do not assume the original engine is correct.
- Validate the supplied DOS edition against the expected files and load at least one original level locally without committing or publicly serving the data. The supplied names are lowercase while the current loader requests uppercase; accommodate this on case-sensitive systems.
- Exercise level loading, movement, skill assignment, success/failure and audio. Record bugs and verify behaviour against representative levels, including levels using alternate level data.
- Create a small, repeatable local smoke-test procedure and capture behaviour to preserve through the migration.

**Done when:** a representative level is playable locally, its known issues are recorded, and the game files remain untracked.

## 2. Modernise the development foundation

- Move from Vue CLI to Vite, update Vue, TypeScript and supporting tooling, and replace or adapt the old class-based screens as needed. Preserve routing, asset paths and game behaviour.
- Add a lockfile, documented supported Node version, reproducible install, type checking and a production build. Fix migration errors incrementally.
- Introduce an automated unit test runner and CI for installation, type checking, tests and build. Use synthetic or independently authored fixtures; CI must not require proprietary game files.

**Done when:** a clean checkout can install, run the automated checks and build; the baseline level still works with locally supplied files.

## 3. Make the engine reliable and testable

- Add focused tests for binary parsing, level configuration, game rules, timers and representative skill behaviours. Use synthetic fixtures and add regression tests for bugs we fix.
- Separate game logic from rendering and input where useful, retaining the original timing and gameplay. Inspect lifecycle cleanup, resource loading and error handling.
- Builder bricks overlapping visible, non-solid object pixels are covered by a synthetic regression. Lemmix renders its simulation world without objects and draws objects separately, so the builder's world-pixel check and this engine's terrain-mask check agree for that case. See [Lemmix's gameplay setup](https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas#L1507) and [world renderer](https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.Rendering.pas#L2476); this comparison does not independently establish the original DOS executable's behavior.
- Add an opt-in local integration or browser smoke test using the supplied assets, without adding those assets to Git or CI.
- Verify every original level with a deterministic recorded solution that meets its rescue target. Track levels with a tested solution separately from levels that have merely loaded. Adapt external walkthroughs or replays only after checking edition, physics, format and reuse rights.
- Keep optional, progressively revealing hints alongside verified solutions. Never show a hint automatically or imply an unverified level has a tested solution.

**Done when:** key behaviour has regression coverage, the baseline level still plays correctly, and all 120 original levels have individually passing completion replays.

## 4. Design for desktop and touch

- Replace the prototype menus with a responsive home screen, level selection and clear loading/error states. Preserve the classic game graphics where practical.
- Support portrait and landscape layouts on phones and tablets. Scale the canvas correctly and translate pointer coordinates to game coordinates.
- Design touch interactions for tapping a lemming, selecting skills, panning and zooming without accidental actions. Provide appropriately sized controls for pause, restart and speed; retain usable desktop mouse and keyboard controls.
- Test accessibility basics, readability, audio start/resume, interruptions and performance on actual Android hardware as well as desktop browsers.

**Done when:** a representative level is comfortable to start, control and finish on a desktop, Android phone and Android tablet.

## 5. Progress and installable app

- Save completed levels, preferences and appropriate progress locally. Make the per-device nature of storage clear; do not promise cross-device sync without implementing it.
- Provide a first-run game-data import and validation flow, with useful errors for missing or incompatible files. Store imported data locally and provide a way to remove it.
- Add a web app manifest, icons, standalone presentation and HTTPS deployment. Add a service worker and an explicit offline strategy for the app shell and user-supplied data; installation alone does not make gameplay available offline.
- Test installation, first-run setup, offline launch and gameplay, updates, storage failures and recovery on real Android Chrome devices. Verify that the standard build and import-only preview contain no original game data, and that only the explicitly bundled play deployment contains the operator-supplied files.

**Done when:** the app installs from a secure hosted site and plays a previously imported level offline on both Android form factors.

## 6. Polish and release

- Improve presentation, level completion feedback, settings and onboarding; address real-device feedback and bugs. Optional AdLib effects cover opening cues, skill selection and assignments, builder warnings, steel, Oh No, exits, splats, explosions, water, fire and triggered traps. Digging, bashing, mining and nuke use synthesized PC-speaker-style approximations; check audio and balance on real devices.
- Document setup, the private asset workflow, accessibility and known limitations. Production builds include an application source archive and licence notices. The bundled DOSBox-derived DBOPL files carry GPL-2.0-or-later notices that conflict with the root file's LGPL emulator notice; resolve the remaining distribution questions described in [licence review](docu/LICENCE_REVIEW.md), and review game-asset rights before any wider distribution.
- Deploy the app to an appropriate HTTPS host and test the production build. Preserve the owner-authorized distinction between the bundled play site and the game-file-free preview; never include original files in source repositories or source downloads.
- Consider cross-device progress sync only if desired; it requires a storage and privacy design. If a Play Store listing or Android package becomes a requirement, assess a Trusted Web Activity and Android signing first. Consider Expo or a native rewrite only for specific needs that the web app cannot meet.

**Done when:** the production experience works on the intended devices and the remaining limitations are understood.

## References

- [Vue tooling guidance](https://vuejs.org/guide/scaling-up/tooling)
- [Installable web app manifest](https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest/)
- [PWA caching and offline support](https://web.dev/learn/pwa/caching/)
- [Android Trusted Web Activities](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities)
- [Expo WebView](https://docs.expo.dev/versions/latest/sdk/webview/)

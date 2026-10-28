# Lemmings modernisation plan

## Goal and approach

Create a polished, faithful Lemmings experience for desktop browsers, Android tablets and Android phones. Keep the original game's character while making the interface easy to use with a mouse or touch. Treat the existing TypeScript engine as a starting point and replace or repair parts as evidence demands.

Build an installable progressive web app (PWA) first: one web application can run in a desktop browser and be installed to an Android home screen. Expo is built around React Native; adopting it here would require a separate native layer or substantial UI and browser-API adaptation. Revisit it only if a concrete native feature or distribution requirement warrants that work.

The app must not commit, bundle or publicly distribute the original game files. Prefer importing the owner's files into browser storage on each device. This requires an explicit first-run import and space on each device; it does not automatically sync assets or progress. Keep a private local development route for testing, and decide on any alternative hosting or distribution of game data separately.

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
- Verify builder bricks overlapping visible, non-solid object pixels. Lemmix checks the world pixel before drawing a brick, while this engine checks its separate solid-terrain mask; their behavior may differ where an object is visible without solid terrain.
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
- Test installation, first-run setup, offline launch and gameplay, updates, storage failures and recovery on real Android Chrome devices. Verify that build output and hosted resources contain no original game data.

**Done when:** the app installs from a secure hosted site and plays a previously imported level offline on both Android form factors.

## 6. Polish and release

- Improve presentation, level completion feedback, settings and onboarding; address real-device feedback and bugs. Optional AdLib effects cover opening cues, skill assignments, Oh No, exits, splats, explosions, water, fire and triggered traps; connect and verify the remaining gameplay effects.
- Document setup, the private asset workflow, accessibility and known limitations. Review the project's code, emulator and game-asset licences before any wider distribution.
- Deploy the app to an appropriate HTTPS host and test the production build. Never publish original game files as part of the site.
- Consider cross-device progress sync only if desired; it requires a storage and privacy design. If a Play Store listing or Android package becomes a requirement, assess a Trusted Web Activity and Android signing first. Consider Expo or a native rewrite only for specific needs that the web app cannot meet.

**Done when:** the production experience works on the intended devices and the remaining limitations are understood.

## References

- [Vue tooling guidance](https://vuejs.org/guide/scaling-up/tooling)
- [Installable web app manifest](https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest/)
- [PWA caching and offline support](https://web.dev/learn/pwa/caching/)
- [Android Trusted Web Activities](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities)
- [Expo WebView](https://docs.expo.dev/versions/latest/sdk/webview/)

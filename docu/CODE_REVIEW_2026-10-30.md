# Code review — 30 October 2026

This review covered the application from local file import to gameplay, progress,
offline updates and deployment packaging. Particular attention went to the
Windows standalone edition, hint compatibility, edition selection, and the new
in-game rescue target. Review findings were fixed in separate commits with
regression tests.

## Findings addressed

| Area | Finding and correction |
| --- | --- |
| Windows replacement | Audio, graphics and levels were stored separately. All selected components are now prepared before a single IndexedDB transaction; a read, validation or write failure preserves the previous installation. Removal also uses a single transaction. |
| Existing installations | Windows stores migrate into the shared database before use. Failed migration retains the legacy copies for retry. Old copies are deleted only after a successful migration, and removal markers prevent in-flight automatic imports from undoing a removal. A later home-page visit can restore a deployment's Windows bundle. An older tab blocking the upgrade produces an actionable error. |
| Complete Windows imports | ISO and combined audio/art/level imports now require the complete standalone resource set, and supplied simulation sprites must contain compatible gameplay masks. Intentional component-only selections remain supported. |
| Edition removal | Removing DOS previously cleared Windows audio too. DOS and Windows removal and automatic-import preferences are now independent. |
| MIDI validation | Import accepted some tracks that the playback parser rejected. Import, playback and deployment packaging now use the same bounded event validation. Invalid replacement music leaves saved audio intact. |
| Finished games | The original pause control could resume the simulation after a win, loss or timeout. Terminal games now suspend their timer and reject further panel commands, skill assignments and restart attempts on that game instance. Starting a fresh level remains supported. |
| Preference failures | Windows-only play could remain stuck in DOS mode if localStorage writes failed. The selected edition now remains available in memory for the current visit, with a message explaining that the preference was not saved. |
| Offline installation | An installation could replace working supporting resources before discovering an invalid script or stylesheet. The service worker now fetches and validates the complete installation set before writing it, with the document written last. Response bodies are fully downloaded during staging, avoiding a connection-slot stall and detecting interrupted downloads before writes. |
| Home file management | DOS import controls disappeared after installing Windows alone, and a levels-only Windows import had no removal control. Both actions remain available. Setup instructions now describe DOS and Windows formats once and share one explanation of local storage. |
| Documentation | Corrected the home screenshot's artwork attribution, refreshed its setup instructions, replaced the old partial-import warning with the atomic replacement contract, and updated storage migration and device recovery guidance. |

## Review coverage

- Import selection, ZIP/ISO extraction, bounded binary validation, migration,
  rollback, removal, automatic deployment imports and concurrent writes.
- Game lifecycle, timers, skills and input, terminal state, rendering and terrain
  restoration, Windows palettes/sprites/masks/panel, and audio lifecycle.
- Level catalogue mapping, replay command acceptance, hint fingerprints and
  separate first-move examples.
- Vue routing and loading, edition availability, fullscreen and pause menus,
  touch/mouse/keyboard controls, accessible objective text and focus handling.
- Progress/settings backup and restore, service-worker updates and offline use,
  source archives, build scripts, dependency notices and game-file exclusions.
- README, modernisation status, integration notes and Android playtest guidance.

## Verification

The complete local Vitest run passed **581 tests**, including private integration
checks using the supplied game files and configured community recordings. The
strict replay gates cover **120 DOS levels and 114 Windows levels**, including
recorded-command acceptance. Type checking passed. The npm dependency audit
reported no known vulnerabilities in the installed dependency tree on this date.

The browser replacement regression runs against the production build in desktop,
Android phone and Android tablet emulations. It imports the Windows ISO, aborts
the actual browser write transaction on replacement, compares hashes of every
saved file, reloads, and starts Windows gameplay successfully.

The full private Playwright run passed **107 tests**, with four intentional
project-specific skips: the two touch-only zoom tests on desktop, and the
desktop-only Windows offline reload check on the two mobile emulations. The run
includes DOS and Windows level completion through the UI, hints, audio sample
output, fullscreen target/pause/zoom controls, import recovery, backups and
offline updates. Native fullscreen zoom is checked in each orientation separately;
expanded fullscreen also exercises live viewport rotation.

The review corrected an ambiguous keyboard-test selector after the accessible
objective was added, and adjusted native fullscreen tests to respect Chromium's
restriction on resizing a fullscreen test window. No production behavior was
changed to accommodate those harness failures.

## Limits and remaining device checks

No additional confirmed application defects remained in the reviewed paths.
This is evidence from code inspection and the exercised tests, not a proof that
every possible game state or browser condition is correct.

Actual Android installation, device rotation in native fullscreen, audio output,
interruption recovery, touch precision and TalkBack still need the ongoing
[device playtest](ANDROID_DEVICE_CHECK.md). Emulated Chrome is not Android
hardware. The replay checks prove the recorded routes in this engine, rather
than exact equivalence with every original DOS or Windows executable.

Component-only imports intentionally permit independently replacing resources;
they do not establish that the resulting combination is the verified edition.
Hint fingerprints continue to reject unverified combinations. Structural
validation cannot prove every possible level will work.

The Cache API has no transaction spanning multiple cache writes. The offline
fix protects against fetch/validation failures before writes, but does not claim
rollback after a disk failure partway through cache writes. Browser storage may
still be cleared or evicted. Backups contain progress/settings, not game files.

Existing licensing and distribution questions remain documented in
[the licence review](LICENCE_REVIEW.md); this code review does not resolve them.

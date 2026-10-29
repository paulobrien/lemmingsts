# Private game-data integration tests

These tests read the original DOS files from the ignored `dos/lemmings/` directory and never commit them or bundle them into the application. They import the files into an in-memory IndexedDB implementation, decode every level, and run each recorded replay to a successful result.

Run the tests with the local files present:

```sh
RUN_PRIVATE_GAME_TESTS=1 npm run test:unit -- tests/integration/local-game-files.spec.ts
```

Replays and separately authored progressive hints live in `src/game/solutions/tested-solutions.ts`. Only levels with a replay that has been verified in this harness should have an entry. The normal tests do not claim that levels without entries have been solved.

To verify all 120 levels using project-authored replays and optionally check separately obtained community recordings, set the replay path environment variables documented in [the Lemmix replay guide](../../docu/LEMMIX_REPLAY_IMPORT.md), then run:

```sh
RUN_PRIVATE_GAME_TESTS=1 REQUIRE_ALL_LEVEL_COMPLETIONS=1 npx vitest run tests/integration/lemmix-import-external.spec.ts
```

This strict combined gate runs a completion replay for every level, and reports a missing replay if a level has neither an authored solution nor a configured community replay. The community files are not included in Git, and their recorded positions and actions are checked before a win is accepted. If this checkout has the ignored `dos/replay-research-env.sh` and its corresponding local recordings, source that file from the repository root to run those additional checks.

To require all 120 levels to have **project-authored** replay solutions and hints, run:

```sh
RUN_PRIVATE_GAME_TESTS=1 REQUIRE_ALL_LEVEL_SOLUTIONS=1 npm run test:unit -- tests/integration/local-game-files.spec.ts
```

The coverage gate lists missing levels and fails if any lack recorded solutions. The replay test must also pass before coverage is considered verified. All 120 levels currently have authored replays and hints.

For strategy research, the [DOS Lemmings walkthrough by Snow Dragon](https://gamefaqs.gamespot.com/pc/564576-lemmings/faqs/18338) distinguishes game editions and covers the original levels. Recorded commands are independently tested here and hint text is written for this project; the walkthrough itself is not redistributed.

The unassisted Fun 13 fall check was cross-checked with the supplied DOS executable in DOSBox: the level requires all 20 lemmings, and some die without intervention. This confirms the outcome for that executable and local data, not for every Lemmings release; other editions can use different fall-distance rules.

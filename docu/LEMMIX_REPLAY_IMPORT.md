# Lemmix replay research prototype

`parseLemmixReplay` and `verifyLemmixCandidate` in `src/game/solutions/lemmix-replay-import.ts` are offline TypeScript APIs for experimenting with `.lrb` recordings. They do not import, download, or distribute third-party replay files.

The parser accepts version 1 and version 3 LRB files with the corresponding DOS-original mechanics flags. It supports skill-selection and skill-assignment records, paired pauses within a single simulation iteration, and instantaneous release-rate changes while paused. It rejects other versions, physics flags, held release-rate changes, nuke and glitch actions, invalid sizes, a different level title or initial release rate, and other unsupported records. Version 1 predates a Lemmix trap-timing fix, so verification rejects version 1 candidates for levels with triggered traps. The parser retains a version 3 source level hash but does **not** verify it against the game data. This narrow subset is not expected to accept every DOS replay.

Parsing produces a **candidate**, not a verified solution. Pass the candidate and a fresh, stopped `Game` for the intended original level to `verifyLemmixCandidate`. Verification consumes the game by running it to completion and checks the source-recorded lemming positions, successful assignments, victory and executed command sequence. Even a passing replay does not establish full physics equivalence with DOS or prove the source and target files are identical.

The binary layout and event mapping are based on the public [Lemmix source](https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas), not on bundled external replays.

## Checks

`npm test` runs synthetic binary-format and simulated-game tests without original game files. To verify a synthetic LRB against the locally supplied original game data, run:

```sh
RUN_PRIVATE_GAME_TESTS=1 npx vitest run tests/integration/lemmix-import-private.spec.ts
```

A public [DOS Tricky 7 replay](https://www.lemmingsforums.net/index.php?topic=1490.45) was separately examined: it is an older version 1 replay with pause and rate actions. With the locally supplied game data, its recorded positions and actions verify and it wins with 75 lemmings rescued. This is one replay, not a general proof of equivalent physics. The positive version 3 cases have only been tested with synthetic LRB data; no real version 3 replay has yet been verified.

To repeat the version 1 parsing check with a locally obtained copy of that replay, without committing it:

```sh
LEMMIX_V1_REPLAY_PATH=/absolute/path/to/replay.lrb npx vitest run tests/integration/lemmix-import-external.spec.ts
```

To also run the replay against local game data, set `RUN_PRIVATE_GAME_TESTS=1` in that command. Neither the replay nor the game files are included in the repository.

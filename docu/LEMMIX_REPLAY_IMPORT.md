# Lemmix replay research prototype

`parseLemmixReplay` and `verifyLemmixCandidate` in `src/game/solutions/lemmix-replay-import.ts` are offline TypeScript APIs for experimenting with `.lrb` recordings. They do not import, download, or distribute third-party replay files.

The parser accepts only version 3 LRB files with the exact DOS-original mechanics flags and skill-selection or skill-assignment records. It rejects other versions, physics flags, pause, release-rate, nuke and glitch actions, invalid sizes, a different level title or release rate, and other unsupported records. It retains the source level hash but does **not** verify it against the game data. This narrow subset is not expected to accept every DOS replay.

Parsing produces a **candidate**, not a verified solution. Pass the candidate and a fresh, stopped `Game` for the intended original level to `verifyLemmixCandidate`. Verification consumes the game by running it to completion and checks the source-recorded lemming positions, successful assignments, victory and executed command sequence. Even a passing replay does not establish full physics equivalence with DOS or prove the source and target files are identical.

The binary layout and event mapping are based on the public [Lemmix source](https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas), not on bundled external replays.

## Checks

`npm test` runs synthetic binary-format and simulated-game tests without original game files. To verify a synthetic LRB against the locally supplied original game data, run:

```sh
RUN_PRIVATE_GAME_TESTS=1 npx vitest run tests/integration/lemmix-import-private.spec.ts
```

A public [DOS Tricky 7 replay](https://www.lemmingsforums.net/index.php?topic=1490.45) was separately examined: it is an older version 1 replay with pause and rate actions. The prototype correctly rejects it. The positive version 3 cases have only been tested with synthetic LRB data; no real version 3 replay has yet been verified.

To repeat the rejection check with a locally obtained copy of that replay, without committing it:

```sh
LEMMIX_V1_REPLAY_PATH=/absolute/path/to/replay.lrb npx vitest run tests/integration/lemmix-import-external.spec.ts
```

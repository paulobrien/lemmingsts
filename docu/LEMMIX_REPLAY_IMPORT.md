# Lemmix replay research prototype

`parseLemmixReplay` and `verifyLemmixCandidate` in `src/game/solutions/lemmix-replay-import.ts` are offline TypeScript APIs for experimenting with `.lrb` recordings. They do not import, download, or distribute third-party replay files.

The parser accepts version 1 and version 3 LRB files with the corresponding DOS-original mechanics flags. It supports skill-selection and skill-assignment records, standard standalone nuke records, pause annotations, instantaneous paused release-rate changes, and held release-rate buttons whose changes and stopping point are fully represented. Repeated standalone nuke records have no effect once the nuke is active. Lemmix playback ignores pause annotations, including pauses spanning several iterations or incomplete pause markers; actions remain at their recorded iterations. Held buttons are expanded into per-frame rate changes using Lemmix's update order; a hold with an unknown future effect is rejected. It rejects other versions, physics flags, nuke-glitch mechanics, combined nuke records, other glitch actions, invalid sizes, a different level title or initial release rate, and other unsupported records. Version 1 predates a Lemmix trap-timing fix, so verification stops as soon as a triggered trap actually activates; a dormant trap does not by itself prevent verification. The parser retains a version 3 source level hash but does **not** verify it against the game data. This narrow subset is not expected to accept every DOS replay.

Parsing produces a **candidate**, not a verified solution. Pass the candidate and a fresh, stopped `Game` for the intended original level to `verifyLemmixCandidate`. Verification consumes the game by running it to completion and checks the source-recorded lemming positions, successful assignments, victory and executed command sequence. Even a passing replay does not establish full physics equivalence with DOS or prove the source and target files are identical.

The binary layout and event mapping are based on the public [Lemmix source](https://github.com/ericlangedijk/Lemmix/blob/master/src/Game.pas), not on bundled external replays.

## Checks

`npm test` runs synthetic binary-format and simulated-game tests without original game files. To verify a synthetic LRB against the locally supplied original game data, run:

```sh
RUN_PRIVATE_GAME_TESTS=1 npx vitest run tests/integration/lemmix-import-private.spec.ts
```

A public [DOS Tricky 7 replay](https://www.lemmingsforums.net/index.php?topic=1490.45) was separately examined: it is an older version 1 replay with pause and rate actions. With the locally supplied game data, its recorded positions and actions verify and it wins with 75 lemmings rescued. This is one replay, not a general proof of equivalent physics. The positive version 3 cases have only been tested with synthetic LRB data; no real version 3 replay has yet been verified.

A separate [Tricky 22 replay](https://www.lemmingsforums.net/index.php?action=dlattach;attach=654), `Tricky22-100%.lrb`, and its [nine-builder alternate](https://www.lemmingsforums.net/index.php?action=dlattach;attach=655), `Tricky22_9builders_100.lrb`, each verify with all 80 lemmings rescued. They are distinct recordings. These examples are third-party recordings; the project neither bundles nor redistributes them.

The public [Taxing 9 replay](https://www.lemmingsforums.net/index.php?topic=1490.0), `Taxing9-undamaged.lrb`, verifies with 20 rescued.

The following locally obtained recordings also verify after the walker/jumper
top-boundary correction. Fun 17 uses a blocker glitch; these results describe
only the runs checked here, not all solutions or full DOS parity.

| Level | Recording | Environment variable | Rescued |
| --- | --- | --- | ---: |
| Fun 14 | [attachment 642](https://www.lemmingsforums.net/index.php?action=dlattach;attach=642) | `LEMMIX_FUN14_REPLAY_PATH` | 80 |
| Fun 15 | [attachment 643](https://www.lemmingsforums.net/index.php?action=dlattach;attach=643) | `LEMMIX_FUN15_REPLAY_PATH` | 80 |
| Fun 17 | [attachment 656](https://www.lemmingsforums.net/index.php?action=dlattach;attach=656) | `LEMMIX_FUN17_REPLAY_PATH` | 20 |
| Mayhem 17 | [attachment 13697](https://www.lemmingsforums.net/index.php?action=dlattach;attach=13697) | `LEMMIX_MAYHEM17_REPLAY_PATH` | 77 |
| Mayhem 23 | [attachment 13700](https://www.lemmingsforums.net/index.php?action=dlattach;attach=13700) | `LEMMIX_MAYHEM23_REPLAY_PATH` | 72 |

Additional public recordings verified on local files are [Tricky 5](https://www.lemmingsforums.net/index.php?topic=1490.0) (70 rescued), [Fun 25 and Taxing 3](https://www.lemmingsforums.net/index.php?topic=1490.15) (73 and 80), [Fun 12, Tricky 10, an alternate Tricky 22, and Taxing 20](https://www.lemmingsforums.net/index.php?topic=1490.30) (80, 80, 80 and 70), [Taxing 11 and Taxing 15](https://www.lemmingsforums.net/index.php?topic=1490.15) (50 and 80), and [Taxing 16](https://www.lemmingsforums.net/index.php?topic=1490.45) (80). The verification outcome describes this engine's execution of each recording; it is not a claim of complete DOS physics equivalence.

The public [Taxing 25](https://www.lemmingsforums.net/index.php?topic=4539.45) and [Mayhem 27](https://www.lemmingsforums.net/index.php?topic=4539.105) recordings also verify, saving 80 and 50 respectively.

The public [Mayhem 19 DOS recording](https://www.lemmingsforums.net/index.php?topic=1383.105) verifies with 48 rescued when supplied as `LEMMIX_MAYHEM19_REPLAY_PATH` alongside `RUN_PRIVATE_GAME_TESTS=1`.

The following recordings from the public [minimum-skills challenge](https://www.lemmingsforums.net/index.php?topic=1068.0) also verify on the local original game files. Their environment variables enable the matching opt-in integration tests. Rescue counts are measured in this engine.

| Level | Recording | Environment variable | Rescued |
| --- | --- | --- | ---: |
| Fun 19 | [attachment 11977](https://www.lemmingsforums.net/index.php?action=dlattach;attach=11977) | `LEMMIX_FUN19_REPLAY_PATH` | 80 |
| Fun 23 | [attachment 11966](https://www.lemmingsforums.net/index.php?action=dlattach;attach=11966) | `LEMMIX_FUN23_REPLAY_PATH` | 80 |
| Fun 28 | [attachment 11971](https://www.lemmingsforums.net/index.php?action=dlattach;attach=11971) | `LEMMIX_FUN28_REPLAY_PATH` | 80 |
| Fun 29 | [attachment 11](https://www.lemmingsforums.net/index.php?action=dlattach;attach=11) | `LEMMIX_FUN29_REPLAY_PATH` | 80 |
| Tricky 12 | [attachment 11972](https://www.lemmingsforums.net/index.php?action=dlattach;attach=11972) | `LEMMIX_TRICKY12_REPLAY_PATH` | 50 |
| Tricky 24 | [attachment 11973](https://www.lemmingsforums.net/index.php?action=dlattach;attach=11973) | `LEMMIX_TRICKY24_REPLAY_PATH` | 80 |
| Tricky 28 | [attachment 11974](https://www.lemmingsforums.net/index.php?action=dlattach;attach=11974) | `LEMMIX_TRICKY28_REPLAY_PATH` | 80 |
| Taxing 8 | [attachment 12043](https://www.lemmingsforums.net/index.php?action=dlattach;attach=12043) | `LEMMIX_TAXING8_REPLAY_PATH` | 80 |
| Taxing 4 | [attachment 8](https://www.lemmingsforums.net/index.php?action=dlattach;attach=8) | `LEMMIX_TAXING4_REPLAY_PATH` | 40 |
| Taxing 6 | [attachment 11963](https://www.lemmingsforums.net/index.php?action=dlattach;attach=11963) | `LEMMIX_TAXING6_REPLAY_PATH` | 50 |
| Taxing 13 | [attachment 9](https://www.lemmingsforums.net/index.php?action=dlattach;attach=9) | `LEMMIX_TAXING13_REPLAY_PATH` | 80 |
| Taxing 22 | [attachment 11967](https://www.lemmingsforums.net/index.php?action=dlattach;attach=11967) | `LEMMIX_TAXING22_REPLAY_PATH` | 50 |
| Taxing 26 | [attachment 12815](https://www.lemmingsforums.net/index.php?action=dlattach;attach=12815) | `LEMMIX_TAXING26_REPLAY_PATH` | 80 |
| Taxing 29 | [attachment 11975](https://www.lemmingsforums.net/index.php?action=dlattach;attach=11975) | `LEMMIX_TAXING29_REPLAY_PATH` | 80 |
| Mayhem 4 | [attachment 11964](https://www.lemmingsforums.net/index.php?action=dlattach;attach=11964) | `LEMMIX_MAYHEM4_REPLAY_PATH` | 50 |
| Mayhem 5 | [attachment 12175](https://www.lemmingsforums.net/index.php?action=dlattach;attach=12175) | `LEMMIX_MAYHEM5_REPLAY_PATH` | 76 |
| Mayhem 6 | [attachment 12173](https://www.lemmingsforums.net/index.php?action=dlattach;attach=12173) | `LEMMIX_MAYHEM6_REPLAY_PATH` | 75 |
| Mayhem 7 | [attachment 12189](https://www.lemmingsforums.net/index.php?action=dlattach;attach=12189) | `LEMMIX_MAYHEM7_REPLAY_PATH` | 50 |
| Mayhem 14 | [attachment 12190](https://www.lemmingsforums.net/index.php?action=dlattach;attach=12190) | `LEMMIX_MAYHEM14_REPLAY_PATH` | 80 |
| Mayhem 26 | [attachment 12](https://www.lemmingsforums.net/index.php?action=dlattach;attach=12) | `LEMMIX_MAYHEM26_REPLAY_PATH` | 76 |
| Mayhem 30 | [attachment 12182](https://www.lemmingsforums.net/index.php?action=dlattach;attach=12182) | `LEMMIX_MAYHEM30_REPLAY_PATH` | 80 |

These further wins use recordings posted in the public [DOS skill challenge](https://www.lemmingsforums.net/index.php?topic=1084.0). Some run until the level timer expires; the counts below are the result actually verified in this engine.

| Level | Recording | Environment variable | Rescued |
| --- | --- | --- | ---: |
| Tricky 8 | [attachment 13667](https://www.lemmingsforums.net/index.php?action=dlattach;attach=13667) | `LEMMIX_TRICKY8_REPLAY_PATH` | 58 |
| Tricky 11 | [attachment 13656](https://www.lemmingsforums.net/index.php?action=dlattach;attach=13656) | `LEMMIX_TRICKY11_REPLAY_PATH` | 48 |
| Tricky 14 | [attachment 13669](https://www.lemmingsforums.net/index.php?action=dlattach;attach=13669) | `LEMMIX_TRICKY14_REPLAY_PATH` | 70 |
| Tricky 18 | [attachment 371](https://www.lemmingsforums.net/index.php?action=dlattach;attach=371) | `LEMMIX_TRICKY18_REPLAY_PATH` | 9 |
| Tricky 23 (nuke) | [attachment 13662](https://www.lemmingsforums.net/index.php?action=dlattach;attach=13662) | `LEMMIX_TRICKY23_NUKE_REPLAY_PATH` | 50 |
| Tricky 29 | [attachment 13659](https://www.lemmingsforums.net/index.php?action=dlattach;attach=13659) | `LEMMIX_TRICKY29_REPLAY_PATH` | 80 |
| Tricky 30 | [attachment 13660](https://www.lemmingsforums.net/index.php?action=dlattach;attach=13660) | `LEMMIX_TRICKY30_REPLAY_PATH` | 74 |
| Taxing 7 | [attachment 13687](https://www.lemmingsforums.net/index.php?action=dlattach;attach=13687) | `LEMMIX_TAXING7_REPLAY_PATH` | 78 |
| Taxing 2 | [attachment 13683](https://www.lemmingsforums.net/index.php?action=dlattach;attach=13683) | `LEMMIX_TAXING2_REPLAY_PATH` | 76 |
| Taxing 5 | [attachment 13686](https://www.lemmingsforums.net/index.php?action=dlattach;attach=13686) | `LEMMIX_TAXING5_REPLAY_PATH` | 53 |
| Taxing 12 | [attachment 13694](https://www.lemmingsforums.net/index.php?action=dlattach;attach=13694) | `LEMMIX_TAXING12_REPLAY_PATH` | 8 |
| Taxing 14 | [attachment 13695](https://www.lemmingsforums.net/index.php?action=dlattach;attach=13695) | `LEMMIX_TAXING14_REPLAY_PATH` | 77 |
| Mayhem 9 | [attachment 334](https://www.lemmingsforums.net/index.php?action=dlattach;attach=334) | `LEMMIX_MAYHEM9_REPLAY_PATH` | 79 |
| Mayhem 3 | [attachment 13668](https://www.lemmingsforums.net/index.php?action=dlattach;attach=13668) | `LEMMIX_MAYHEM3_REPLAY_PATH` | 25 |
| Mayhem 21 | [attachment 352](https://www.lemmingsforums.net/index.php?action=dlattach;attach=352) | `LEMMIX_MAYHEM21_REPLAY_PATH` | 50 |

The following wins use files from the public [LemmingsWelt challenge replay archive](https://www.camanis.net/lemmings/lemmingswelt/index.php?dir=challenge_replays). For ZIP archives, extract the named `.lrb` entry locally and set the environment variable to its path. Counts describe this engine's run and can differ from the original archive description.

| Level | Archive file and replay entry | Environment variable | Rescued |
| --- | --- | --- | ---: |
| Tricky 20 | `Tricky_20_digbuildbash.lrb` | `LEMMIX_TRICKY20_REPLAY_PATH` | 80 |
| Tricky 23 | `tricky23_save79.zip` / `Tricky23_save79.lrb` | `LEMMIX_TRICKY23_REPLAY_PATH` | 79 |
| Tricky 27 | `tricky27_1min.lrb` | `LEMMIX_TRICKY27_REPLAY_PATH` | 73 |
| Taxing 17 | `Taxing_17_buildbash.lrb` | `LEMMIX_TAXING17_REPLAY_PATH` | 80 |
| Taxing 18 | `taxing18.zip` / `Taxing_18.lrb` | `LEMMIX_TAXING18_REPLAY_PATH` | 74 |
| Taxing 21 | `Taxing_21.lrb` | `LEMMIX_TAXING21_REPLAY_PATH` | 20 |
| Taxing 23 | `taxing23_saveall_16builders.zip` / `Taxing23_saveall_16builders.lrb` | `LEMMIX_TAXING23_REPLAY_PATH` | 80 |
| Taxing 27 | `taxing27_1min.lrb` | `LEMMIX_TAXING27_REPLAY_PATH` | 77 |
| Taxing 28 | `70taxing28.zip` / `POOR WEE CREATURES!.lrb` | `LEMMIX_TAXING28_REPLAY_PATH` | 70 |
| Mayhem 1 | `Replay7.zip` / `Steel Works.lrb` | `LEMMIX_MAYHEM1_REPLAY_PATH` | 80 |
| Mayhem 2 | `80mayhem2.zip` / `The Boiler Room.lrb` | `LEMMIX_MAYHEM2_REPLAY_PATH` | 80 |
| Mayhem 8 | `mayhem8-10_1min.zip` / `mayhem8_1min.lrb` | `LEMMIX_MAYHEM8_REPLAY_PATH` | 74 |
| Mayhem 10 | `mayhem10.zip` / `Mayhem10_save73.lrb` | `LEMMIX_MAYHEM10_REPLAY_PATH` | 73 |
| Mayhem 12 | `mayhem12_1min.lrb` | `LEMMIX_MAYHEM12_REPLAY_PATH` | 75 |
| Mayhem 18 | `mayhem18_1min.lrb` | `LEMMIX_MAYHEM18_REPLAY_PATH` | 72 |
| Mayhem 25 | `mayhem25_1min.lrb` | `LEMMIX_MAYHEM25_REPLAY_PATH` | 73 |
| Mayhem 29 | `Mayhem 29_West_77-80.zip` / `Mayhem 29 Save Me_west_77-80.lrb` | `LEMMIX_MAYHEM29_REPLAY_PATH` | 77 |

The Mayhem 18 run reaches the rescue requirement but finishes when this engine's level timer expires; its passing check does not verify the archive filename's one-minute claim.

To repeat the version 1 parsing check with a locally obtained copy of that replay, without committing it:

```sh
LEMMIX_V1_REPLAY_PATH=/absolute/path/to/replay.lrb npx vitest run tests/integration/lemmix-import-external.spec.ts
```

To also run the replay against local game data, set `RUN_PRIVATE_GAME_TESTS=1` in that command. Neither the replay nor the game files are included in the repository.

To verify Tricky 22 using a locally obtained copy:

```sh
RUN_PRIVATE_GAME_TESTS=1 LEMMIX_TRICKY22_REPLAY_PATH=/absolute/path/to/Tricky22-100%.lrb npx vitest run tests/integration/lemmix-import-external.spec.ts
```

For Taxing 9, set `LEMMIX_TAXING9_REPLAY_PATH` to the locally obtained recording instead.

The other recordings can be checked in the same way using `LEMMIX_FUN12_REPLAY_PATH`, `LEMMIX_FUN25_REPLAY_PATH`, `LEMMIX_TRICKY5_REPLAY_PATH`, `LEMMIX_TRICKY10_REPLAY_PATH`, `LEMMIX_TRICKY22_ALT_REPLAY_PATH`, `LEMMIX_TAXING3_REPLAY_PATH`, `LEMMIX_TAXING11_REPLAY_PATH`, `LEMMIX_TAXING15_REPLAY_PATH`, `LEMMIX_TAXING16_REPLAY_PATH`, and `LEMMIX_TAXING20_REPLAY_PATH` respectively, together with `RUN_PRIVATE_GAME_TESTS=1`. Each path should point to the corresponding downloaded `.lrb` file.

The corresponding optional variables for the other two recordings are `LEMMIX_TAXING25_REPLAY_PATH` and `LEMMIX_MAYHEM27_REPLAY_PATH`.

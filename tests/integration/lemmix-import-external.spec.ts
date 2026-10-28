// @vitest-environment node
// Optional research check only. Download the DOS Tricky 7 example locally from:
// https://www.lemmingsforums.net/index.php?topic=1490.45
// LEMMIX_V1_REPLAY_PATH=/absolute/path npx vitest run tests/integration/lemmix-import-external.spec.ts
// The externally authored replay is not part of this repository.
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parseLemmixReplay } from '../../src/game/solutions/lemmix-replay-import';

const path = process.env.LEMMIX_V1_REPLAY_PATH;
it.skipIf(!path)('parses a public DOS v1 replay as an unverified candidate', async () => {
  const bytes = Uint8Array.from(await readFile(path!));
  const candidate = parseLemmixReplay(bytes, { levelTitle: 'Been there, seen it, done it', initialReleaseRate: 20 });
  expect(candidate.sourceVersion).toBe(1);
  expect(candidate.events.some(event => event.kind === 'assign')).toBe(true);
  expect(candidate.events.some(event => event.kind === 'rate' && event.delta === 79)).toBe(true);
});

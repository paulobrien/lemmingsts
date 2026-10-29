// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('modified DOSBox OPL source notices', () => {
  it.each(['Channel.ts', 'Chip.ts', 'Handler.ts', 'Operator.ts', 'db-opl3.ts'])(
    'retains its original licence and dated change notice in %s', file => {
      const header = readFileSync(`src/game/resources/sound/DBOPL/${file}`, 'utf8').slice(0, 1200);
      expect(header).toContain('The DOSBox Team');
      expect(header).toContain('GNU General Public License');
      expect(header).toContain('Modified 2021-01-13: updated import paths');
      expect(header).toContain('Modified 2026-10-28: corrected import-path case');
    },
  );
});

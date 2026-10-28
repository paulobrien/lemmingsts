import { expect, it } from 'vitest';
import { GameTypes } from '../../src/game/game-types';
import { ActionBlockerSystem } from '../../src/game/game-play/actions/action-blocker-system';
import type { GameTimer } from '../../src/game/game-play/game-timer';
import { Lemming } from '../../src/game/game-play/lemming';
import { Trigger } from '../../src/game/game-play/trigger';
import { TriggerManager } from '../../src/game/game-play/trigger-manager';
import { Level } from '../../src/game/resources/level';
import { ColorPalette } from '../../src/game/resources/lemmings/color-palette';
import { LevelProperties } from '../../src/game/resources/lemmings/level-properties';
import { TriggerTypes } from '../../src/game/resources/lemmings/trigger-types';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';
import { SolidLayer } from '../../src/game/resources/solid-layer';

it('overlays steel and objects with all blocker cells, rejects overlap, and restores them on removal', () => {
  const width = 64, height = 40, palette = new ColorPalette();
  const level = new Level(width, height, GameTypes.LEMMINGS, 0, 0, new LevelProperties(), 0, false,
    new Uint8ClampedArray(width * height * 4), new SolidLayer(width, height, new Int8Array(width * height)), palette, palette);
  level.setSteelAreas([{ x: 12, y: 12, width: 20, height: 12 }]);
  const triggers = new TriggerManager({ getGameTicks: () => 1 } as GameTimer);
  const exit = new Trigger(TriggerTypes.EXIT_LEVEL, 20, 20, 23, 23);
  triggers.add(exit);
  level.setBlockerFieldLookup((x, y) => triggers.hasBlockerFieldAt(x, y));
  const sprites = { getAnimation: () => ({}) } as unknown as LemmingsSprite;
  const blocker = new ActionBlockerSystem(sprites, triggers);
  const first = new Lemming(20, 20, 0);
  expect(blocker.triggerLemAction(first)).toBe(true);

  for (const x of [16, 20, 24]) {
    expect(triggers.hasBlockerFieldAt(x, 20)).toBe(true);
    expect(level.isProtectedAt(x, 20)).toBe(false);
    expect(level.isMinerProtectedAt(x, 20, -1)).toBe(false);
    expect(level.isExplosionProtectedAt(x, 20)).toBe(false);
  }
  expect(level.isProtectedAt(12, 20)).toBe(true);
  expect(triggers.trigger(20, 20)).toBe(TriggerTypes.NO_TRIGGER);

  const overlapping = new Lemming(24, 20, 1);
  expect(blocker.triggerLemAction(overlapping)).toBe(false);
  const separate = new Lemming(40, 20, 2);
  expect(blocker.triggerLemAction(separate)).toBe(true);
  triggers.removeByOwner(first);
  expect(level.isProtectedAt(20, 20)).toBe(true);
  expect(triggers.trigger(20, 20)).toBe(TriggerTypes.EXIT_LEVEL);
  expect(triggers.hasBlockerFieldAt(40, 20)).toBe(true);
});

import { describe, expect, it, vi } from 'vitest';
import { ActionBuildSystem } from '../../src/game/game-play/actions/action-build-system';
import { GameTypes } from '../../src/game/game-types';
import { Lemming } from '../../src/game/game-play/lemming';
import { LemmingStateType } from '../../src/game/game-play/lemming-state-type';
import { DrawProperties } from '../../src/game/resources/draw-properties';
import { Level } from '../../src/game/resources/level';
import { ColorPalette } from '../../src/game/resources/lemmings/color-palette';
import { LevelElement } from '../../src/game/resources/lemmings/level-element';
import { LevelProperties } from '../../src/game/resources/lemmings/level-properties';
import { ObjectImageInfo } from '../../src/game/resources/lemmings/object-image-info';
import type { LemmingsSprite } from '../../src/game/resources/lemmings-sprite';
import { SolidLayer } from '../../src/game/resources/solid-layer';
import { DisplayImage } from '../../src/game/view/display-image';
import type { Stage } from '../../src/game/view/stage';

describe('DOS builder brick timing', () => {
  it.each([true, false])('restores the brick after three completed bricks on frame 10 (right=$0)', right => {
    const terrain = new Set<string>();
    const setGroundAt = vi.fn((x: number, y: number) => terrain.add(`${x},${y}`));
    const level = { setGroundAt, hasGroundAt: (x: number, y: number) => terrain.has(`${x},${y}`) } as unknown as Level;
    const action = new ActionBuildSystem({ getAnimation: () => ({}) } as unknown as LemmingsSprite);
    const lem = new Lemming(20, 10, 0);
    lem.lookRight = right;
    lem.frameIndex = 8;
    lem.state = 3;
    const start = right ? 20 : 16;
    const brick = Array.from({ length: 6 }, (_, i) => [start + i, 9, 7]);

    expect(action.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect(setGroundAt.mock.calls).toEqual(brick);
    expect(terrain.delete(`${start},9`)).toBe(true); // Another lemming removes one brick pixel.
    setGroundAt.mockClear();
    expect(action.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect(setGroundAt.mock.calls).toEqual([brick[0]]);
    expect(terrain.has(`${start},9`)).toBe(true);
    expect([lem.x, lem.y, lem.state]).toEqual([20, 10, 3]);
  });

  it.each([0, 2, 4, 11])('does not repeat frame 10 with %i completed bricks', bricks => {
    const setGroundAt = vi.fn();
    const level = { setGroundAt } as unknown as Level;
    const action = new ActionBuildSystem({ getAnimation: () => ({}) } as unknown as LemmingsSprite);
    const lem = new Lemming(20, 10, 0);
    lem.frameIndex = 9;
    lem.state = bricks;
    expect(action.process(level, lem)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect(setGroundAt).not.toHaveBeenCalled();
  });

  it.each([false, true])('builds solid terrain under a visible object (no-overwrite=$0)', noOverwrite => {
    const width = 24, height = 16;
    const palette = new ColorPalette();
    palette.setColorRGB(1, 12, 34, 56);
    palette.setColorRGB(7, 210, 180, 150);
    const terrain = new SolidLayer(width, height, new Int8Array(width * height));
    const background = new Uint8ClampedArray(width * height * 4);
    for (let i = 3; i < background.length; i += 4) background[i] = 255;
    const level = new Level(width, height, GameTypes.LEMMINGS, 0, 0, new LevelProperties(), 0, false,
      background, terrain, palette, palette);
    const object = new ObjectImageInfo(palette);
    object.width = object.height = object.frameCount = 1;
    object.frames = [new Uint8Array([1])];
    const objects: ObjectImageInfo[] = [];
    objects[2] = object;
    level.setMapObjects([new LevelElement(10, 8, 2, new DrawProperties(false, noOverwrite, false, false))], objects);

    const pixels = new Uint8ClampedArray(width * height * 4);
    const stage = { createImage: () => ({ width, height, data: pixels }) } as unknown as Stage;
    const display = new DisplayImage(stage);
    const render = () => {
      level.render(display);
      const sprite = level.objects[0];
      display.drawFrameFlags(sprite.getFrame(0), sprite.x, sprite.y, sprite.drawProperties);
      return new Uint32Array(pixels.buffer)[8 * width + 10];
    };

    // Lemmix builds its simulation world without objects, then draws objects
    // separately: Game.pas#L1507, Game.Rendering.pas#L2476.
    expect(render()).toBe(palette.getColor(1));
    expect(level.hasGroundAt(10, 8)).toBe(false);
    level.setGroundAt(12, 8, 1); // Existing terrain is preserved by the brick.
    const action = new ActionBuildSystem({ getAnimation: () => ({}) } as unknown as LemmingsSprite);
    const lemming = new Lemming(8, 9, 0);
    lemming.lookRight = true;
    lemming.frameIndex = 8;
    action.process(level, lemming);

    for (let x = 8; x <= 13; x++) expect(level.hasGroundAt(x, 8)).toBe(true);
    expect(render()).toBe(palette.getColor(noOverwrite ? 7 : 1));
    expect(new Uint32Array(pixels.buffer)[8 * width + 12]).toBe(palette.getColor(1));
  });
});

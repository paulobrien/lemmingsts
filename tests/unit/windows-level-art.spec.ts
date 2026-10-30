import { describe, expect, it } from 'vitest';
import { createWindowsLevel } from '../../src/game/resources/windows-level-art';
import { LevelReader } from '../../src/game/resources/lemmings/level-reader';
import { LevelProperties } from '../../src/game/resources/lemmings/level-properties';
import { DrawProperties } from '../../src/game/resources/draw-properties';
import { LevelElement } from '../../src/game/resources/lemmings/level-element';

function sprite(index: number): ArrayBuffer {
  const data = new Uint8Array(10 + 12 + 3), view = new DataView(data.buffer);
  data.set([0x53, 0x52, 0x4c, 0x45]); view.setUint16(4, 1, true); view.setUint32(6, 10, true);
  view.setUint16(14, 1, true); view.setUint16(16, 1, true); view.setUint16(18, 1, true); view.setUint16(20, 1, true);
  data.set([0x81, index, 0x80], 22); return data.buffer;
}
function ground(): ArrayBuffer {
  const data = new Uint8Array(1056);
  data[3] = 1; data[4] = 1; data[5] = 1; // object 0: one 1×1 frame
  data[448] = 1; data[449] = 1; // terrain 0: 1×1
  return data.buffer;
}
function reader(): LevelReader {
  return { levelWidth: 10, levelHeight: 10, levelProperties: new LevelProperties(), screenPositionX: 0,
    graphicSet1: 0, graphicSet2: 0, isSuperLemming: false, steel: [],
    terrains: [new LevelElement(2, 3, 0, new DrawProperties(false, false, false, false))],
    objects: [new LevelElement(4, 5, 0, new DrawProperties(false, false, false, false))],
  } as LevelReader;
}
describe('Windows level artwork', () => {
  it('uses low-resolution Windows masks for logical terrain and object frames', () => {
    const level = createWindowsLevel(reader(), 0, 0, ground(), sprite(8), sprite(129));
    expect(level.hasGroundAt(2, 3)).toBe(true);
    expect(level.hasGroundAt(3, 3)).toBe(false);
    expect(level.objects[0].animation.frames[0].getMask()[0]).toBe(1);
  });
  it('rejects special backgrounds and incompatible palette indices', () => {
    const special = reader(); special.graphicSet2 = 1;
    expect(() => createWindowsLevel(special, 0, 0, ground(), sprite(8), sprite(129))).toThrow('special level background');
    expect(() => createWindowsLevel(reader(), 0, 0, ground(), sprite(20), sprite(129))).toThrow('palette index');
  });
});

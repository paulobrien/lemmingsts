import { GameTypes } from '../game-types';
import { BinaryReader } from './file/binary-reader';
import { GroundReader } from './lemmings/ground-reader';
import { LevelReader } from './lemmings/level-reader';
import { GroundRenderer } from './ground-renderer';
import { Level } from './level';
import { SolidLayer } from './solid-layer';
import { decodeWindowsSprites, type WindowsSpriteFrame } from './windows-graphics';

/** Convert original low-resolution Windows SRLE images to the indexed logical
 * frames used by the engine. The transparency mask remains independent of the
 * colour index: this controls actual terrain collision, not just presentation. */
function logicalFrame(frame: WindowsSpriteFrame, width: number, height: number, paletteOffset: number, paletteSize: number): Uint8Array {
  if (frame.width !== width || frame.height !== height || frame.mask.length !== width * height || frame.indices.length !== width * height) {
    throw new Error('Windows level artwork dimensions do not match its metadata.');
  }
  const pixels = new Uint8Array(width * height);
  for (let index = 0; index < pixels.length; index++) {
    if (!frame.mask[index]) { pixels[index] = 0x80; continue; }
    const color = frame.indices[index] - paletteOffset;
    if (color < 0 || color >= paletteSize) throw new Error('Windows level artwork has an invalid palette index.');
    pixels[index] = color;
  }
  return pixels;
}

/** Construct a logical level from its Windows .LVL record and style assets. */
export function createWindowsLevel(reader: LevelReader, levelMode: number, levelIndex: number,
  groundBytes: ArrayBuffer, terrainBytes: ArrayBuffer, objectBytes: ArrayBuffer): Level {
  if (reader.graphicSet2) throw new Error('This Windows disc does not contain this special level background.');
  if (groundBytes.byteLength !== 1056) throw new Error('Invalid Windows style metadata.');
  const ground = new GroundReader(new BinaryReader(groundBytes));
  const terrain = decodeWindowsSprites(new Uint8Array(terrainBytes));
  const objects = decodeWindowsSprites(new Uint8Array(objectBytes));
  const terrainInfo = ground.getTerraImages(), objectInfo = ground.getObjectImages();
  for (let index = 0; index < terrain.length; index++) {
    const info = terrainInfo[index];
    if (!info) throw new Error('Windows terrain metadata is incomplete.');
    info.frames = [logicalFrame(terrain[index], info.width, info.height, 8, 8)];
  }
  for (const piece of reader.terrains) if (!terrainInfo[piece.id]?.frames.length) {
    throw new Error('Windows terrain piece is missing.');
  }
  let offset = 0;
  const objectFrameStarts = objectInfo.map(info => {
    const start = offset;
    info.frames = [];
    for (let frame = 0; frame < info.frameCount; frame++, offset++) {
      if (!objects[offset]) throw new Error('Windows object frame is missing.');
      info.frames.push(logicalFrame(objects[offset], info.width, info.height, 128, 16));
    }
    return start;
  });
  if (offset !== objects.length) throw new Error('Windows object artwork does not match its metadata.');
  const image = GroundRenderer.fromGroundMap(reader, terrainInfo).img;
  const level = new Level(reader.levelWidth, reader.levelHeight, GameTypes.LEMMINGS, levelIndex, levelMode,
    reader.levelProperties, reader.screenPositionX, reader.isSuperLemming,
    image.getData(), new SolidLayer(reader.levelWidth, reader.levelHeight, image.mask), ground.colorPalette, ground.groundPalette);
  level.setWindowsTerrainSource({ graphicSet: reader.graphicSet1, special: false, pieces: reader.terrains,
    objectTypes: reader.objects.map(object => object.id), objectFrameStarts });
  level.setSteelAreas(reader.steel);
  level.setMapObjects(reader.objects, objectInfo);
  return level;
}

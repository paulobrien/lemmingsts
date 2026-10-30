import { BinaryReader } from './file/binary-reader';
import { LevelReader } from './lemmings/level-reader';
import { LevelProperties } from './lemmings/level-properties';

const HEADER_SIZE = 8;
const RECORD_SIZE = 137;
const LEVEL_SIZE = 2048;
const GROUP_NAMES = ['Fun', 'Tricky', 'Taxing', 'Mayhem'] as const;

export interface WindowsLevelEntry {
  name: string;
  fileName: string;
  /** Alternate starting properties, when supplied by the Windows database. */
  properties?: LevelProperties;
}
export interface WindowsLevelGroup { name: string; levels: WindowsLevelEntry[] }

/**
 * Read the original-game hierarchy from the Windows level database. A level
 * record points to a raw DOS-format LVL record; repeated levels may instead
 * supply their own skills and other starting conditions in the database.
 * Only the original-game branch is accepted; subsequent branches are other
 * game editions and have different assets and rules.
 */
export function parseWindowsLevelDatabase(buffer: ArrayBuffer | Uint8Array): WindowsLevelGroup[] {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const fail = (): never => { throw new Error('Unsupported or corrupt Windows Lemmings level database.'); };
  if (data.length < HEADER_SIZE || (data.length - HEADER_SIZE) % RECORD_SIZE !== 0) return fail();
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = view.getUint32(4, true);
  if (view.getUint32(0, true) !== 2 || count !== (data.length - HEADER_SIZE) / RECORD_SIZE || count > 4096) return fail();
  const str = (start: number, length: number): string => {
    const bytes = data.subarray(start, start + length);
    const zero = bytes.indexOf(0);
    return String.fromCharCode(...bytes.subarray(0, zero < 0 ? bytes.length : zero)).trim();
  };
  const groups: WindowsLevelGroup[] = [];
  let inOriginal = false;
  let group: WindowsLevelGroup | undefined;
  for (let i = 0; i < count; i++) {
    const pos = HEADER_SIZE + i * RECORD_SIZE;
    const depth = data[pos + 2], folder = data[pos + 3];
    const name = str(pos + 10, 32);
    if (folder === 1 && depth === 1) {
      if (inOriginal) break;
      if (str(pos + 50, 32).toLowerCase() === 'orig') inOriginal = true;
      continue;
    }
    if (!inOriginal) continue;
    if (folder === 1 && depth === 2) {
      const groupName = name.replace(/\.+$/, '');
      if (groupName !== GROUP_NAMES[groups.length]) return fail();
      group = { name: groupName, levels: [] }; groups.push(group);
      continue;
    }
    if (folder !== 0 || depth !== 3 || !group || !name) return fail();
    const fileName = str(pos + 50, 32).toUpperCase();
    if (!/^LVL00[0-9][0-7]\.LVL$/.test(fileName)) return fail();
    let properties: LevelProperties | undefined;
    if (data[pos + 124] !== 0) {
      properties = new LevelProperties();
      properties.levelName = name;
      for (let skill = 0; skill < 8; skill++) properties.skills[skill + 1] = data[pos + 125 + skill];
      properties.timeLimit = data[pos + 133];
      properties.needCount = data[pos + 134];
      properties.releaseCount = data[pos + 135];
      properties.releaseRate = data[pos + 136];
      if (properties.releaseRate < 1 || properties.releaseRate > 99 || properties.releaseCount < 1 ||
          properties.needCount > properties.releaseCount || properties.timeLimit < 1 ||
          properties.skills.some(skill => skill > 99)) return fail();
    }
    group.levels.push({ name, fileName, properties });
    if (group.levels.length > 30) return fail();
  }
  if (groups.length !== GROUP_NAMES.length || groups.some(item => !item.levels.length)) return fail();
  return groups;
}

/** Decode an ISO's uncompressed LVL record, applying the Windows database override. */
export function readWindowsLevelRecord(entry: WindowsLevelEntry, buffer: ArrayBuffer | Uint8Array): LevelReader {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (data.byteLength !== LEVEL_SIZE) throw new Error(`Invalid Windows level file: ${entry.fileName}`);
  const level = new LevelReader(new BinaryReader(data));
  if (entry.properties) level.levelProperties = entry.properties;
  else level.levelProperties.levelName = entry.name;
  return level;
}

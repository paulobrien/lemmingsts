// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { WINDOWS_GRAPHICS_FILES, WINDOWS_GRAPHICS_GFX_FILES } from '../../src/game/resources/file/windows-graphics-names';
// @ts-expect-error Build-only helper has no declaration file.
import { packageWindowsGraphics } from '../../scripts/package-windows-graphics.mjs';
const sprite = () => Uint8Array.from([0x53,0x52,0x4c,0x45,1,0,10,0,0,0,0,0,0,0,1,0,1,0,1,0,1,0,0x81,8,0x80]);
const palette = () => Uint8Array.from([0x20,0x4c,0x41,0x50,1,0,1,2,3,0]);
it('packages only valid supplied graphics and rejects incomplete bundles', () => {
 const root=mkdtempSync(join(tmpdir(),'lemmings-graphics-'));
 try {
  const source=join(root,'source'), build=join(root,'dist'); mkdirSync(source); mkdirSync(build); mkdirSync(join(source,'GFX')); mkdirSync(join(source,'STYLES'));
  for (const name of WINDOWS_GRAPHICS_FILES) writeFileSync(join(source,WINDOWS_GRAPHICS_GFX_FILES.includes(name)?'GFX':'STYLES',name),name.endsWith('.PAL')?palette():sprite());
  writeFileSync(join(source,'GFX','unrelated.txt'),'excluded');
  const dest=packageWindowsGraphics(source,build);
  expect(readdirSync(dest).sort()).toEqual([...WINDOWS_GRAPHICS_FILES.map(name=>name.toLowerCase()),'manifest.json'].sort());
  expect(JSON.parse(readFileSync(join(dest,'manifest.json'),'utf8')).files).toHaveLength(WINDOWS_GRAPHICS_FILES.length);
  expect(() => packageWindowsGraphics(source,build)).toThrow('already exists');
  rmSync(dest,{recursive:true}); rmSync(join(source,'GFX','FE.PAL'));
  expect(() => packageWindowsGraphics(source,build)).toThrow('Missing graphics files');
 } finally { rmSync(root,{recursive:true,force:true}); }
});

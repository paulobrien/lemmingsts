// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
// @ts-expect-error Build-only helper has no declaration file.
import { packageWindowsAudio } from '../../scripts/package-windows-audio.mjs';
function wav() {
 const data = new Uint8Array(48), view = new DataView(data.buffer);
 const tag = (at: number, s: string) => data.set(new TextEncoder().encode(s), at);
 tag(0,'RIFF'); view.setUint32(4,40,true); tag(8,'WAVE'); tag(12,'fmt '); view.setUint32(16,16,true);
 view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,7092,true); view.setUint32(28,7092,true);
 view.setUint16(32,1,true); view.setUint16(34,8,true); tag(36,'data'); view.setUint32(40,4,true);
 return data;
}
it('packages only valid supplied audio and rejects incomplete or duplicate bundles', () => {
 const root=mkdtempSync(join(tmpdir(),'lemmings-audio-'));
 try {
  const source=join(root,'source'), build=join(root,'dist'); mkdirSync(source); mkdirSync(build); mkdirSync(join(source,'SOUND'));
  for (const name of ['LETSGO.WAV','OHNO.WAV','YIPPEE.WAV']) writeFileSync(join(source,'SOUND',name),wav());
  writeFileSync(join(source,'SOUND','unrelated.txt'),'excluded');
  const dest=packageWindowsAudio(source,build);
  expect(readdirSync(dest).sort()).toEqual(['letsgo.wav','manifest.json','ohno.wav','yippee.wav']);
  expect(JSON.parse(readFileSync(join(dest,'manifest.json'),'utf8'))).toEqual({version:1,files:['letsgo.wav','ohno.wav','yippee.wav']});
  expect(() => packageWindowsAudio(source,build)).toThrow('already exists');
  rmSync(dest,{recursive:true}); rmSync(join(source,'SOUND','OHNO.WAV'));
  expect(() => packageWindowsAudio(source,build)).toThrow('Missing voice files');
 } finally { rmSync(root,{recursive:true,force:true}); }
});

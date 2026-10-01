import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {HEROES,WEAPONS,RELIC} from '../src/content.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('every playable hero and weapon owner has traceable, intact, alpha-bearing four-direction art',async()=>{
  const manifest=JSON.parse(await fs.readFile(path.join(root,'survivor/assets/prepared-manifest.json'),'utf8'));
  for(const id of new Set([...HEROES.map(h=>h.id),...WEAPONS.map(w=>w.owner)])){
    const asset=manifest.assets.find(a=>a.id==='unit-'+id);assert.ok(asset,id);const source=await fs.readFile(path.join(root,asset.source)),bytes=await fs.readFile(path.join(root,'survivor/assets',asset.file));assert.equal(sha(source),asset.sourceSha256);assert.equal(sha(bytes),asset.sha256);
    const metadata=await sharp(bytes).metadata();assert.equal(metadata.width,768);assert.equal(metadata.height,768);assert.equal(metadata.hasAlpha,true);const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(let view=0;view<4;view++){let opaque=0,empty=0,white=0;for(let y=0;y<384;y+=3)for(let x=0;x<384;x+=3){const p=((y+Math.floor(view/2)*384)*info.width+x+(view%2)*384)*4;if(data[p+3]>249){opaque++;if(data[p]>210&&data[p+1]>210&&data[p+2]>210)white++;}if(data[p+3]===0)empty++;}assert.ok(opaque>300,id+' direction '+view);assert.ok(empty>1000,id+' native empty alpha');if(['rumi','snow_rabbit','night_rabbit','silver_rabbit','cinderella','jasmine'].includes(id))assert.ok(white>50,id+' white remains opaque');}
    assert.deepEqual(manifest.frames[id].directions,['down','up','left','right']);assert.deepEqual(manifest.frames[id].anchor,[256,480]);
  }
});
test('recipes refer to real relics, all nine shared identities remain distinct',()=>{
  assert.equal(new Set(HEROES.map(h=>h.id)).size,9);for(const w of WEAPONS)assert.ok(RELIC[w.relic],w.id);assert.match(HEROES.find(h=>h.id==='rumi').identity,/맨발/);assert.match(HEROES.find(h=>h.id==='silver_rabbit').identity,/남성/);assert.match(HEROES.find(h=>h.id==='cinderella').identity,/남성/);assert.match(HEROES.find(h=>h.id==='time_ruler').identity,/별도 인물/);
});
test('new Jasmine art retains its original generated source and explicitly records review status',async()=>{
  const cast=JSON.parse(await fs.readFile(path.join(root,'survivor/assets/cast.json'),'utf8')),frame=cast.frames.find(f=>f.id==='jasmine');
  assert.match(frame.reviewStatus,/Not an existing approved Defense/);assert.equal(sha(await fs.readFile(path.join(root,frame.source.path))),frame.source.sha256);
  assert.equal(frame.source.feet.length,4);assert.equal(frame.source.referencePaths.length,2);for(const p of frame.source.referencePaths)await fs.access(path.join(root,p));
});

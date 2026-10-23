import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {HEROES,ASSET_PATHS} from '../src/content.js';
import {MEMORIAL_STORIES,MEMORIAL_MEDIA_PATHS,MEMORIAL_MEDIA_MANIFEST} from '../src/memorial.js';
import {assetFile} from '../scripts/local-inputs.mjs';
import {createProfile,command,parseProfile,validateProfile} from '../src/profile.js';

test('all thirty original stories unlock at bond ten and match the supplied body hashes',()=>{
  const ids=HEROES.map(h=>h.id).sort();
  for(const table of [MEMORIAL_STORIES,MEMORIAL_MEDIA_PATHS,MEMORIAL_MEDIA_MANIFEST])assert.deepEqual(Object.keys(table).sort(),ids);
  for(const id of ids){
    const s=MEMORIAL_STORIES[id],m=MEMORIAL_MEDIA_MANIFEST[id];assert.equal(s.unlockBond,10);assert.ok(s.title.length>2);assert.ok(s.paragraphs.length>0);
    assert.doesNotMatch(s.title,/^\[?\d+[-.]\d*/);
    assert.equal(createHash('sha256').update(s.paragraphs.join('\n')).digest('hex'),m.bodySha256,id+' original story text');
  }
});

test('lazy memorial pack is separate from combat textures, AVIF 4:4:4, opaque and within mobile budgets',async()=>{
  let total=0,base64=0;
  for(const h of HEROES){
    const id=h.id,m=MEMORIAL_MEDIA_MANIFEST[id],relative=MEMORIAL_MEDIA_PATHS[id];assert.ok(!Object.values(ASSET_PATHS).includes(relative));
    const bytes=await fs.readFile(assetFile(relative)),meta=await sharp(bytes).metadata();
    assert.equal(meta.format,'heif');assert.equal(meta.width,720);assert.equal(meta.height,1080);assert.equal(meta.hasAlpha,false);
    assert.equal(bytes.length,m.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),m.outputSha256,id);
    const av1C=bytes.indexOf(Buffer.from('av1C'));assert.ok(av1C>=0);assert.equal((bytes[av1C+6]>>3)&1,0,'no horizontal chroma subsampling');assert.equal((bytes[av1C+6]>>2)&1,0,'no vertical chroma subsampling');
    assert.ok(bytes.length<100*1024,id+' individual budget');total+=bytes.length;base64+=4*Math.ceil(bytes.length/3);
  }
  assert.ok(total<2.5*1024*1024);assert.ok(base64<3*1024*1024);
});

test('bond ten gates reading, progress survives old-save migration, and no reading action earns affection or currency',()=>{
  const p=createProfile(1791198000000);p.heroes.star_boy.bond=9;assert.equal(command(p,'memory',{id:'star_boy',page:0}).ok,false);
  p.heroes.star_boy.bond=10;const wallet=[p.dreams,p.dust],bond=p.heroes.star_boy.bond;assert.ok(command(p,'memory',{id:'star_boy',page:1}).ok);assert.equal(parseProfile(JSON.stringify(p)).memories.star_boy.page,1);assert.deepEqual([p.dreams,p.dust],wallet);assert.equal(p.heroes.star_boy.bond,bond);
  assert.ok(command(p,'memory',{id:'star_boy',page:MEMORIAL_STORIES.star_boy.paragraphs.length-1}).ok);assert.equal(p.memories.star_boy.read,true);assert.ok(command(p,'memory',{id:'star_boy',page:0}).ok);assert.equal(p.memories.star_boy.read,true);
  p.memories.star_boy.page=9999;assert.equal(validateProfile(p),false);delete p.memories;assert.ok(parseProfile(p));
});

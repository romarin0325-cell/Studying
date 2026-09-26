import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {HEROES,ASSET_MANIFEST} from '../defense/merge/content.js';
import {anatomicalScale} from './pack_defense_directions.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function validateDirections(){
  const root=new URL('../defense/assets/merge/units/',import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
  const landmarks=JSON.parse(await readFile(new URL('../defense/docs/art/ANATOMICAL_LANDMARKS.json',import.meta.url),'utf8'));
  const profile=JSON.parse(await readFile(new URL('../defense/docs/art/HEAD_PROFILE.json',import.meta.url),'utf8'));
  assert.equal(manifest.version,2);
  assert.equal(HEROES.length,21);assert.equal(manifest.frames.length,21);assert.equal(ASSET_MANIFEST.length,24);
  assert.deepEqual(new Set(manifest.frames.map(f=>f.id)),new Set(HEROES.map(h=>h.id)));
  let count=0;
  for(const h of HEROES){
    const m=manifest.frames.find(f=>f.id===h.id),bytes=await readFile(new URL(m.file,root));
    assert.equal(hash(bytes),m.sha256,h.id+' output differs from recorded hash');
    const entry=landmarks.find(e=>e.id===h.id);
    assert.ok(entry?.anatomy,h.id+' missing anatomical reference');
    assert.equal(entry.sourceSha256,m.source.sha256,h.id+' anatomical data belongs to a different source');
    assert.deepEqual(entry.anatomy,m.source.anatomy);
    assert.equal(m.source.scale,anatomicalScale(entry.anatomy.skull,profile),h.id+' must be repacked after profile/landmark changes');
    assert.ok(m.anatomy.headWidth>0&&m.anatomy.headHeight>0&&m.anatomy.packedSkull.length===4);
    assert.equal(m.anatomy.heightClassApplied,false,h.id+' height must not change the common head scale');
    assert.match(m.anatomy.uncertainty,/estimates/);
    assert.deepEqual(m.directions,['down','up','left','right']);assert.deepEqual(m.anchor,[256,480]);assert.equal(m.cell,512);
    assert.deepEqual(h.art.portrait,m.portrait);assert.equal(h.art.foot,480/512);assert.equal(h.art.scale,1);assert.equal(h.art.directional,true);
    assert.match(m.source.sha256,/^[0-9a-f]{64}$/);assert.ok(m.source.scale>0&&m.source.scale<2);assert.equal(m.source.feet.length,4);
    const meta=await sharp(bytes).metadata();assert.equal(meta.width,1024);assert.equal(meta.height,1024);assert.equal(meta.hasAlpha,true);
    const hashes=[];
    for(let i=0;i<4;i++){
      const rgba=await sharp(bytes).extract({left:i%2*512,top:Math.floor(i/2)*512,width:512,height:512}).ensureAlpha().raw().toBuffer();
      let visible=0,opaque=0;
      for(let j=3;j<rgba.length;j+=4){if(rgba[j]>16)visible++;if(rgba[j]===255)opaque++;}
      assert.ok(visible>5000&&visible<512*512*.8,h.id+'/'+m.directions[i]+' must contain a sprite and transparent padding');
      assert.ok(opaque>visible*.7,h.id+' opaque painted materials');
      for(const corner of [0,511,511*512,512*512-1])assert.equal(rgba[corner*4+3],0,h.id+' nontransparent corner');
      hashes.push(hash(rgba));count++;
    }
    assert.equal(new Set(hashes).size,4,h.id+' needs four distinct authored images');
  }
  return {heroes:21,directions:count,releaseAssets:ASSET_MANIFEST.length};
}

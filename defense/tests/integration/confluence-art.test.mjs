import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDirections} from '../../../scripts/validate_defense_directions.mjs';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
test('production art records anatomical estimates, source hashes, 21 alpha atlases and 84 distinct frames; this is not visual approval',async()=>{
  assert.deepEqual(await validateDirections(),{heroes:21,directions:84,releaseAssets:27});
});

test('all twenty repacked relic cells have transparent gutters and match the reviewed packing record',async()=>{
  const file=new URL('../../assets/merge/relics.webp',import.meta.url),bytes=await readFile(file);
  const record=JSON.parse(await readFile(new URL('../../doc/RELIC_PACKING.json',import.meta.url),'utf8'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);assert.equal(record.frames.length,20);
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([info.width,info.height],[1280,1024]);
  for(const {cell:[left,top,w,h],id} of record.frames){
    let opaque=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const a=data[((top+y)*info.width+left+x)*4+3];
      if(x<22||x>=w-22||y<22||y>=h-22)assert.equal(a,0,`${id}: neighboring artwork entered the gutter`);
      else if(a>200)opaque++;
    }
    assert.ok(opaque>1000,`${id}: empty or damaged icon`);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDirections} from '../../../scripts/validate_defense_directions.mjs';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {packDirections} from '../../../scripts/pack_defense_directions.mjs';

test('trio source hashes, anatomical estimates and isolated effect cells match the reviewed production assets',async()=>{
  const base=new URL('../../docs/art/trio/',import.meta.url);
  const entries=JSON.parse(await readFile(new URL('LANDMARKS.json',base),'utf8'));
  const profile=JSON.parse(await readFile(new URL('../../docs/art/HEAD_PROFILE.json',import.meta.url),'utf8'));
  const {anatomicalScale}=await import('../../../scripts/pack_defense_directions.mjs');
  for(const e of entries){
    const bytes=await readFile(new URL('sources/'+e.file,base));assert.equal(createHash('sha256').update(bytes).digest('hex'),e.sourceSha256,e.id);
    assert.equal(e.anatomy.directionSkulls.length,4);assert.deepEqual(e.anatomy.directionSkulls[0],e.anatomy.skull);
    assert.match(e.anatomy.uncertainty,/estimates/);assert.equal(e.alphaMode,'native');
    const scale=anatomicalScale(e.anatomy.skull,profile,e.id);
    for(const [i,[l,t,r,b]] of e.anatomy.directionSkulls.entries()){
      const width=(r-l)*scale,height=(b-t)*scale,referenceWidth=i<2?profile.head.frontWidth:profile.head.sideWidth;
      assert.ok(Math.abs(width/referenceWidth-1)<=profile.review.directionTolerance,e.id+' skull width '+i);
      assert.ok(Math.abs(height/profile.head.height-1)<=profile.review.directionTolerance,e.id+' skull height '+i);
      assert.ok(e.feet[i][1]>b,e.id+' foot anchor below chin');
    }
  }
  const record=JSON.parse(await readFile(new URL('ATLAS_PACKING.json',base),'utf8'));
  const source=await readFile(new URL('sources/effects-trio.png',base));assert.equal(createHash('sha256').update(source).digest('hex'),record.sourceSha256);
  const bytes=await readFile(new URL('../../assets/merge/effects-trio.webp',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
  const {data,info}=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([info.width,info.height],[768,512]);
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(x%256<16||x%256>=240||y%256<16||y%256>=240){const k=(y*info.width+x)*3;assert.ok(Math.max(data[k],data[k+1],data[k+2])<10,'trio effect bleed');}
});

test('production art records anatomical estimates, source hashes, 31 alpha atlases and 124 distinct frames; this is not visual approval',async()=>{
  assert.deepEqual(await validateDirections(),{heroes:30,forms:31,directions:124,releaseAssets:43});
});

test('native alpha import preserves hot-pink crystal material and opaque whites',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'defense-native-alpha-'));
  try{
    const rgba=Buffer.alloc(512*512*4);
    for(let n=0;n<4;n++)for(let y=110;y<230;y++)for(let x=78;x<178;x++){const j=((Math.floor(n/2)*256+y)*512+n%2*256+x)*4;rgba[j]=255;rgba[j+1]=x<100?255:0;rgba[j+2]=255;rgba[j+3]=253;}
    const png=await sharp(rgba,{raw:{width:512,height:512,channels:4}}).png().toBuffer();await writeFile(path.join(dir,'test.png'),png);
    const [result]=await packDirections({sourceDir:dir,outputDir:path.join(dir,'out'),entries:[{id:'test',file:'test.png',sourceSha256:createHash('sha256').update(png).digest('hex'),alphaMode:'native',alphaOpaqueThreshold:250,feet:Array(4).fill([128,240]),face:[128,160],anatomy:{skull:[78,110,178,210]}}]});
    const raw=await sharp(await readFile(path.join(dir,'out',result.file))).ensureAlpha().raw().toBuffer();let pink=0,white=0;
    for(let j=0;j<raw.length;j+=4){if(raw[j]>220&&raw[j+2]>220&&raw[j+3]===255){if(raw[j+1]<25)pink++;if(raw[j+1]>235)white++;}}
    assert.ok(pink>10000,'magenta was incorrectly removed from native artwork');assert.ok(white>1000,'white material must remain opaque');
  }finally{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(dir,{recursive:true,force:true});}
});

test('expansion atlases match reviewed hashes and every relic/effect has an isolated gutter',async()=>{
  const log=JSON.parse(await readFile(new URL('../../docs/art/expansion/ATLAS_PACKING.json',import.meta.url),'utf8'));
  for(const record of log.records){const bytes=await readFile(new URL('../../assets/merge/'+record.id+'.webp',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);
    if(!['relics-expansion','effects-expansion','finishers'].includes(record.id))continue;
    const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});const relic=record.id==='relics-expansion';
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(x%256<12||x%256>=244||y%256<12||y%256>=244){const j=(y*info.width+x)*4;if(relic)assert.equal(data[j+3],0);else assert.ok(Math.max(data[j],data[j+1],data[j+2])<10,record.id+' neighboring effect crossed padding');}
  }
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

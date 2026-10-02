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
test('nine reviewed walking atlases preserve distinct poses, transparent gutters and shared references',async()=>{
  const manifest=JSON.parse(await fs.readFile(path.join(root,'survivor/assets/prepared-manifest.json'),'utf8'));
  const specs=JSON.parse(await fs.readFile(path.join(root,manifest.renewal.source),'utf8'));assert.equal(sha(await fs.readFile(path.join(root,manifest.renewal.source))),manifest.renewal.sha256);
  for(const h of HEROES){const spec=specs.find(s=>s.id==='walk-'+h.id),asset=manifest.assets.find(s=>s.id===spec?.id);assert.ok(asset,h.id);assert.ok(spec.reference);assert.ok(spec.review.length>30);
    assert.equal(sha(await fs.readFile(path.join(root,spec.source))),asset.sourceSha256);const bytes=await fs.readFile(path.join(root,'survivor/assets',asset.file));assert.equal(sha(bytes),asset.sha256);
    const m=await sharp(bytes).metadata();assert.equal(m.width,spec.cell*4);assert.equal(m.height,spec.cell*4);assert.ok(m.hasAlpha);const meta=manifest.frames[h.id].walk;assert.deepEqual(meta.anchor,[spec.cell/2,spec.cell*.9375]);
    for(let row=0;row<4;row++){const hashes=[];for(let col=0;col<4;col++){
      const frame=await sharp(bytes).extract({left:col*spec.cell,top:row*spec.cell,width:spec.cell,height:spec.cell}).ensureAlpha().raw().toBuffer();hashes.push(sha(frame));let filled=0;
      for(let y=0;y<spec.cell;y++)for(let x=0;x<spec.cell;x++){const alpha=frame[(y*spec.cell+x)*4+3];if(alpha>100)filled++;if(x<3||x>spec.cell-4||y>spec.cell-4)assert.ok(alpha<10,h.id+' safe cell edge');}assert.ok(filled>2000&&filled<22000,h.id+' full body remains visible');
    }assert.ok(new Set(hashes).size>=3,h.id+' real phases in direction '+row);}
  }
});
test('illustrated combat atlases have every required cell and stay inside a decoded texture budget',async()=>{
  const m=JSON.parse(await fs.readFile(path.join(root,'survivor/assets/prepared-manifest.json'),'utf8'));let decoded=0;
  for(const a of m.assets){const info=await sharp(path.join(root,'survivor/assets',a.file)).metadata();decoded+=info.width*info.height*4;}
  assert.ok(decoded<88*1024*1024,'decoded full catalog <88 MiB; walking decode is bounded separately');
  for(const [id,columns,rows] of [['secrets',4,2],['weapons',4,4],['relics',4,4],['effects',4,4],['enemies',4,6],['bosses',4,3]]){
    const a=m.assets.find(a=>a.id===id);assert.ok(a,id);const bytes=await fs.readFile(path.join(root,'survivor/assets',a.file)),info=await sharp(bytes).metadata();assert.ok(info.hasAlpha);const cw=info.width/columns,ch=info.height/rows;
    for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const stats=await sharp(bytes).extract({left:x*cw,top:y*ch,width:cw,height:ch}).stats();assert.ok(stats.channels[3].max>200,id+' has visible painted asset');assert.equal(stats.channels[3].min,0,id+' has native alpha');}
  }
});


test('anatomical profile and all frame pivots are pinned to measured source versions',async()=>{
  const manifest=JSON.parse(await fs.readFile(path.join(root,'survivor/assets/prepared-manifest.json'),'utf8')),normal=manifest.normalization;
  assert.ok(normal);assert.equal(sha(await fs.readFile(path.join(root,normal.source))),normal.sha256);assert.equal(sha(await fs.readFile(path.join(root,normal.processor))),normal.processorSha256);
  const profile=JSON.parse(await fs.readFile(path.join(root,normal.source),'utf8'));assert.match(profile.uncertainty,/estimates/);
  for(const h of HEROES){const frame=manifest.frames[h.id];assert.equal(frame.anatomy.headHeight,144);assert.equal(profile.frames[h.id].sourceSha256,manifest.assets.find(a=>a.id==='unit-'+h.id).sourceSha256);assert.equal(profile.frames[h.id].walkSourceSha256,manifest.assets.find(a=>a.id==='walk-'+h.id).sourceSha256);const records=normal.frames.filter(f=>f.id==='walk-'+h.id);assert.equal(records.length,16);for(const record of records){assert.deepEqual(record.root,frame.walk.anchor);assert.ok(record.landmarks.foot>record.landmarks.chin);assert.ok(record.headScale>0&&record.bodyScale>0);}}
});
test('atlas cleanup removes neighboring cut fragments while preserving opaque white materials',async()=>{
  const {cleanFrame,alphaBounds}=await import('../scripts/art-normalization.mjs');
  const main=await sharp({create:{width:32,height:32,channels:4,background:'#ffffffff'}}).png().toBuffer(),foreign=await sharp({create:{width:3,height:20,channels:4,background:'#ffac00ff'}}).png().toBuffer();
  const bytes=await sharp({create:{width:80,height:80,channels:4,background:'#00000000'}}).composite([{input:main,left:24,top:24},{input:foreign,left:77,top:30}]).png().toBuffer();const clean=await cleanFrame(bytes);assert.equal(clean.removed,60);assert.deepEqual(await alphaBounds(clean.bytes),{left:24,top:24,width:32,height:32});const stats=await sharp(clean.bytes).stats();assert.equal(stats.channels[0].max,255);assert.equal(stats.channels[3].max,255);
});

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
// Text fingerprints survive Git CRLF/LF checkout; binary pixels retain byte identity.
const sourceHash=(source,bytes)=>sha(/\.(json|mjs)$/.test(source)?bytes.toString('utf8').replace(/\r\n/g,'\n'):bytes);
test('every playable hero and weapon owner has traceable, intact, alpha-bearing four-direction art',async()=>{
  const manifest=JSON.parse(await fs.readFile(path.join(root,'survivor/assets/prepared-manifest.json'),'utf8'));
  for(const id of new Set([...HEROES.map(h=>h.id),...WEAPONS.map(w=>w.owner)])){
    const asset=manifest.assets.find(a=>a.id==='unit-'+id);assert.ok(asset,id);const bytes=await fs.readFile(path.join(root,'survivor/assets',asset.file));assert.equal(sha(bytes),asset.sha256);
    const metadata=await sharp(bytes).metadata();assert.equal(metadata.width,768);assert.equal(metadata.height,768);assert.equal(metadata.hasAlpha,true);const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(let view=0;view<4;view++){let opaque=0,empty=0,white=0;for(let y=0;y<384;y+=3)for(let x=0;x<384;x+=3){const p=((y+Math.floor(view/2)*384)*info.width+x+(view%2)*384)*4;if(data[p+3]>249){opaque++;if(data[p]>210&&data[p+1]>210&&data[p+2]>210)white++;}if(data[p+3]===0)empty++;if(x===0||x===381||y===0||y===381)assert.ok(data[p+3]<10,id+' complete canonical cell has clear gutters');}assert.ok(opaque>300,id+' direction '+view);assert.ok(empty>1000,id+' native empty alpha');if(['rumi','snow_rabbit','night_rabbit','silver_rabbit','cinderella','jasmine'].includes(id))assert.ok(white>50,id+' white remains opaque');}
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
  const specs=JSON.parse(await fs.readFile(path.join(root,manifest.renewal.source),'utf8'));assert.equal(sourceHash(manifest.renewal.source,await fs.readFile(path.join(root,manifest.renewal.source))),manifest.renewal.sha256);
  for(const h of HEROES){const spec=specs.find(s=>s.id==='walk-'+h.id),asset=manifest.assets.find(s=>s.id===spec?.id);assert.ok(asset,h.id);assert.ok(spec.reference);assert.ok(spec.review.length>30);
    const bytes=await fs.readFile(path.join(root,'survivor/assets',asset.file));assert.equal(sha(bytes),asset.sha256);
    const m=await sharp(bytes).metadata();assert.equal(m.width,spec.cell*4);assert.equal(m.height,spec.cell*4);assert.ok(m.hasAlpha);const meta=manifest.frames[h.id].walk;assert.deepEqual(meta.anchor,[spec.cell/2,spec.cell*.9375]);
    for(let row=0;row<4;row++){const hashes=[];for(let col=0;col<4;col++){
      const frame=await sharp(bytes).extract({left:col*spec.cell,top:row*spec.cell,width:spec.cell,height:spec.cell}).ensureAlpha().raw().toBuffer();hashes.push(sha(frame));let filled=0;
      for(let y=0;y<spec.cell;y++)for(let x=0;x<spec.cell;x++){const alpha=frame[(y*spec.cell+x)*4+3];if(alpha>100)filled++;if(x<3||x>spec.cell-4||y>spec.cell-4)assert.ok(alpha<10,h.id+' safe cell edge');}assert.ok(filled>2000&&filled<22000,h.id+' full body remains visible');
    }assert.ok(new Set(hashes).size>=3,h.id+' real phases in direction '+row);}
  }
});
test('illustrated combat atlases have every required cell and stay inside a decoded texture budget',async()=>{
  const m=JSON.parse(await fs.readFile(path.join(root,'survivor/assets/prepared-manifest.json'),'utf8'));let decoded=0;
  for(const a of m.assets.filter(a=>!a.id.startsWith('full-'))){const info=await sharp(path.join(root,'survivor/assets',a.file)).metadata();decoded+=info.width*info.height*4;}
  assert.ok(decoded<88*1024*1024,'decoded embedded catalog <88 MiB; review-only full portraits are cropped from unit atlases at runtime');
  for(const [id,columns,rows] of [['menu',4,2],['ordeal-bosses',2,3],['secrets',4,2],['weapons',4,4],['relics',4,4],['effects',4,4],['enemies',4,6],['bosses',4,3],['nightfall-icons',3,3],['nightfall-fx',4,2]]){
    const a=m.assets.find(a=>a.id===id);assert.ok(a,id);const bytes=await fs.readFile(path.join(root,'survivor/assets',a.file)),info=await sharp(bytes).metadata();assert.ok(info.hasAlpha);const cw=info.width/columns,ch=info.height/rows;
    for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const stats=await sharp(bytes).extract({left:x*cw,top:y*ch,width:cw,height:ch}).stats();assert.ok(stats.channels[3].max>200,id+' has visible painted asset');assert.equal(stats.channels[3].min,0,id+' has native alpha');}
  }
});


test('anatomical profile and all frame pivots are pinned to measured source versions',async()=>{
  const manifest=JSON.parse(await fs.readFile(path.join(root,'survivor/assets/prepared-manifest.json'),'utf8')),normal=manifest.normalization;
  assert.ok(normal);assert.equal(sourceHash(normal.source,await fs.readFile(path.join(root,normal.source))),normal.sha256);assert.equal(sha(Buffer.from((await fs.readFile(path.join(root,normal.processor),'utf8')).replace(/\r\n/g,'\n'))),normal.processorSha256);
  const profile=JSON.parse(await fs.readFile(path.join(root,normal.source),'utf8'));assert.match(profile.uncertainty,/estimates/);
  for(const h of HEROES){const frame=manifest.frames[h.id];assert.equal(frame.anatomy.headHeight,144);const records=normal.frames.filter(f=>f.id==='walk-'+h.id);assert.equal(records.length,16);for(const record of records){assert.deepEqual(record.root,frame.walk.anchor);assert.ok(record.landmarks.foot>record.landmarks.chin);assert.ok(record.headScale>0&&record.bodyScale>0);}}
});
test('atlas cleanup removes neighboring cut fragments while preserving opaque white materials',async()=>{
  const {cleanFrame,alphaBounds}=await import('../scripts/art-normalization.mjs');
  const main=await sharp({create:{width:32,height:32,channels:4,background:'#ffffffff'}}).png().toBuffer(),foreign=await sharp({create:{width:3,height:20,channels:4,background:'#ffac00ff'}}).png().toBuffer();
  const bytes=await sharp({create:{width:80,height:80,channels:4,background:'#00000000'}}).composite([{input:main,left:24,top:24},{input:foreign,left:77,top:30}]).png().toBuffer();const clean=await cleanFrame(bytes);assert.equal(clean.removed,60);assert.deepEqual(await alphaBounds(clean.bytes),{left:24,top:24,width:32,height:32});const stats=await sharp(clean.bytes).stats();assert.equal(stats.channels[0].max,255);assert.equal(stats.channels[3].max,255);
});


test('reviewed side cycles are disclosed reflections; independent armed views retain their authored hands',async()=>{
  const m=JSON.parse(await fs.readFile(path.join(root,'survivor/assets/prepared-manifest.json'),'utf8')),profile=JSON.parse(await fs.readFile(path.join(root,m.normalization.source),'utf8'));
  assert.equal(sourceHash(m.ordeal.source,await fs.readFile(path.join(root,m.ordeal.source))),m.ordeal.sha256);
  for(const h of HEROES){
    const body=profile.frames[h.id],records=m.normalization.frames.filter(f=>f.id==='walk-'+h.id);
    const asset=m.assets.find(a=>a.id==='walk-'+h.id),bytes=await fs.readFile(path.join(root,'survivor/assets',asset.file));
    for(let phase=0;phase<4;phase++){
      const left=records[8+phase],right=records[12+phase];
      if(body.mirrorRight){
        assert.equal(right.mirroredFrom,8+phase);assert.equal(left.headScale,right.headScale);assert.equal(left.legScale,right.legScale);
        const raw=await sharp(bytes).ensureAlpha().raw().toBuffer();
        for(let y=0;y<208;y++)for(let x=0;x<208;x++){
          const sourceX=208-x,leftAlpha=sourceX===208?0:raw[((416+y)*832+phase*208+sourceX)*4+3];
          assert.equal(raw[((624+y)*832+phase*208+x)*4+3],leftAlpha,'the actual packed side alpha is reflected about its foot pivot: '+h.id);
        }
      }else{assert.equal(right.mirroredFrom,undefined);assert.ok(body.weaponHand);}
    }
    const full=m.assets.find(a=>a.id==='full-'+h.id);assert.ok(full);assert.equal((await sharp(path.join(root,'survivor/assets',full.file)).metadata()).width,384);
  }
  assert.ok(profile.frames.silver_rabbit.canonical.targetBody<profile.frames.time_ruler.canonical.targetBody*.7);
});

test('newly painted figures have one uniform transform in every view and no regional body scaling',async()=>{
  const m=JSON.parse(await fs.readFile(path.join(root,'survivor/assets/prepared-manifest.json'))),p=JSON.parse(await fs.readFile(path.join(root,m.normalization.source)));
  assert.equal(p.version,3);
  for(const record of m.normalization.frames){assert.equal(record.headScale,record.bodyScale);assert.equal(record.headScale,record.torsoScale);assert.equal(record.headScale,record.legScale);assert.match(record.method,/whole-figure uniform/);}
  for(const h of HEROES){const b=p.frames[h.id];assert.ok(b.nativeWalk);assert.equal(sha(await fs.readFile(path.join(root,b.identityReference.path))),b.identityReference.sha256);assert.equal(b.walk.frames.length,16);for(const f of b.walk.frames)assert.equal(f.registration.atSearchBoundary,false,'review registration bound: '+h.id);}
  // Natural source proportions survive packing. Art targets are not the output
  // measurements; this compares the measured standing body below the chin.
  assert.ok(m.frames.silver_rabbit.anatomy.bodyHeight<m.frames.time_ruler.anatomy.bodyHeight*.75,'short rabbit below-chin body stays smaller than the adult');
});

test('whole-figure packing preserves aspect ratio and refuses actual clipping',async()=>{
  const {wholeFrame}=await import('../scripts/art-normalization.mjs');
  const square=await sharp({create:{width:12,height:12,channels:4,background:'#ffffffff'}}).png().toBuffer();
  const source=await sharp({create:{width:80,height:80,channels:4,background:'#00000000'}}).composite([{input:square,left:30,top:30}]).png().toBuffer();
  const result=await wholeFrame(source,{scale:2,rootX:36,foot:42,cell:128,baseline:100,headHeight:12,chin:42});
  const box=(await import('../scripts/art-normalization.mjs')).alphaBounds;const bounds=await box(result.bytes);assert.equal(bounds.width,bounds.height);assert.equal(result.headScale,result.legScale);
  await assert.rejects(wholeFrame(source,{scale:6,rootX:36,foot:42,cell:64,baseline:60,headHeight:12,chin:42}),/would clip/);
});

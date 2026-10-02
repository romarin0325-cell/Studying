import {readFile,writeFile,mkdtemp,copyFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {packDirections} from '../../scripts/pack_defense_directions.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const doc=path.join(root,'defense/docs/art/trio'),sourceDir=path.join(doc,'sources');
const entries=JSON.parse(await readFile(path.join(doc,'LANDMARKS.json'),'utf8'));
const out=path.join(root,'defense/assets/merge/units'),staging=await mkdtemp(path.join(os.tmpdir(),'defense-trio-pack-'));
const prior=JSON.parse(await readFile(path.join(out,'manifest.json'),'utf8'));
let added;
try{
  added=await packDirections({sourceDir,entries,outputDir:staging,proofDir:path.join(doc,'review/directions')});
  for(const frame of added)await copyFile(path.join(staging,frame.file),path.join(out,frame.file));
}finally{
  if(!path.resolve(staging).startsWith(path.resolve(os.tmpdir())+path.sep))throw new Error('Invalid temporary packing path');
  await rm(staging,{recursive:true,force:true});
}
const ids=new Set(added.map(x=>x.id));prior.frames=[...prior.frames.filter(x=>!ids.has(x.id)),...added];
await writeFile(path.join(out,'manifest.json'),JSON.stringify(prior,null,2)+'\n');
const file=path.join(root,'defense/docs/art/ANATOMICAL_LANDMARKS.json'),all=JSON.parse(await readFile(file,'utf8'));
await writeFile(file,JSON.stringify([...all.filter(x=>!ids.has(x.id)),...entries],null,2)+'\n');
await writeFile(path.join(root,'defense/merge/art-frames.js'),'// Generated from hash-bound anatomical estimates and foot anchors.\nexport const PORTRAIT_FRAMES = '+JSON.stringify(Object.fromEntries(prior.frames.map(x=>[x.id,x.portrait])),null,2)+';\n');

// Effects alone use a fixed cell inset. Character packing above never derives
// its scale from silhouette or ornament bounds. Isolated cells prevent bleed.
const input=await readFile(path.join(sourceDir,'effects-trio.png')),meta=await sharp(input).metadata(),layers=[];
for(let i=0;i<6;i++)layers.push({input:await sharp(input).extract({left:i%3*(meta.width/3),top:Math.floor(i/3)*(meta.height/2),width:meta.width/3,height:meta.height/2}).resize(216,216,{fit:'contain',background:'#000'}).png().toBuffer(),left:i%3*256+20,top:Math.floor(i/3)*256+20});
const fx=await sharp({create:{width:768,height:512,channels:3,background:'#000'}}).composite(layers).webp({quality:94,effort:6}).toBuffer();
await writeFile(path.join(root,'defense/assets/merge/effects-trio.webp'),fx);
await writeFile(path.join(doc,'ATLAS_PACKING.json'),JSON.stringify({id:'effects-trio',sourceSha256:createHash('sha256').update(input).digest('hex'),sha256:createHash('sha256').update(fx).digest('hex'),columns:3,rows:2,cell:256,gutter:20,bytes:fx.length},null,2)+'\n');
console.log('Preserved '+(prior.frames.length-added.length)+' existing unit atlases; packed '+added.length+' new forms and one six-cell effect atlas.');

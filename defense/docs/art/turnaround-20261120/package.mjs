// Reproduce current runtime images from the retained native PNG, selected master,
// and verified baseline at 3379bc5. Run from any directory with project deps installed.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {imageHash,imageMetadata,imageManifestFile} from '../../../scripts/image-pack.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),game=path.resolve(here,'../../..');
const asFile=relative=>path.resolve(game,relative);
const json=x=>JSON.stringify(x,null,2)+'\n';
const dir='cast-turnaround-20261120';
const inputs={
 phantom:{base:'cast-v2/phantom-pajamas-guided',edits:[2,3],png:'35ac0caf9359d6244cbd6d1b9a39aff4a5da090be6bb55d9f78d495e4aaae4dc',source:'20ecf21b0dd3aba91f2d5107701d8804de47e6b916880334f17f8ffa884a736e',game:'f22359e0992f9db1fd08e8408b783b73fb7625c063e68207bf412357b1545282'},
 lightning_sage:{base:'cast-v2/lightning_sage',edits:[2,3],png:'6472dd601a8bc011f245de4534e373800bc055014e978355467c860d790b6ee8',source:'85049bdc24e0ee377c7d75a2b5263833709d72e9aa6bdef5e3f9f131c9b614e1',game:'006e58485083b37e43b20e97cf6b29b681bbcd8e06ada46a8c5408e80309e913'},
 time_magician:{base:'cast-selected-20261109/time_magician',edits:[3],png:'dfe8e55e2f12c5bd433d4a00088c601dfa8dca3b9247092e5931f18f796dbf4d',source:'dac8f3a4ed7b3ad183af697402d322eeb70b69aa26a8f4220026c99b0f20b07f',game:'d9d1b0cef97c9942b915df975ef47eb2d2f1325a4d7a80e91d142424e30f40b8'}
};
async function exact(file,hash){
 const b=await fs.readFile(file);assert.equal(imageHash(b),hash,file);return b;
}
async function pixels(bytes,width){
 const x=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.deepEqual([x.info.width,x.info.height,x.info.channels],[width,width,4]);return x.data;
}
async function lossless(b,width){return sharp(b,{raw:{width,height:width,channels:4}}).webp({lossless:true,effort:6}).toBuffer();}
function quadrant(i,w){return Number((i%w)>=w/2)+2*Number(Math.floor(i/w)>=w/2);}
function changed(a,b,k,visibleOnly=false){
 if(visibleOnly&&!a[k+3]&&!b[k+3])return false;
 return a[k]!==b[k]||a[k+1]!==b[k+1]||a[k+2]!==b[k+2]||a[k+3]!==b[k+3];
}
function diffRows(a,b,w){
 const result=[0,0,0,0];
 for(let i=0;i<w*w;i++)if(changed(a,b,i*4,true))result[quadrant(i,w)]++;
 return result;
}
// Lanczos-3 support during 1024 to 640 downsampling extends five source
// pixels beyond each sample. Preserve previous decoded battlefield pixels elsewhere.
function dilatedFootprint(mask,w,out){
 const stride=w+1,integral=new Uint32Array(stride*stride);
 for(let y=0;y<w;y++){let row=0;for(let x=0;x<w;x++){row+=mask[y*w+x];integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;}}
 const projected=new Uint8Array(out*out),ratio=w/out,r=Math.ceil(3*ratio);
 for(let y=0;y<out;y++)for(let x=0;x<out;x++){
   const sx=(x+.5)*ratio-.5,sy=(y+.5)*ratio-.5;
   const x0=Math.max(0,Math.floor(sx-r)),y0=Math.max(0,Math.floor(sy-r)),x1=Math.min(w,Math.ceil(sx+r)+1),y1=Math.min(w,Math.ceil(sy+r)+1);
   projected[y*out+x]=Number(integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0]>0);
 }
 return projected;
}
async function safeSave(file,bytes){
 await fs.mkdir(path.dirname(file),{recursive:true});
 try{await fs.writeFile(file,bytes,{flag:'wx'});}
 catch(e){if(e.code!=='EEXIST')throw e;assert.ok((await fs.readFile(file)).equals(bytes),'Output has different bytes: '+file);}
}
async function pack(id,spec,profile){
 const oldPng=await exact(asFile('assets/'+spec.base+'.png'),spec.png);
 const oldSource=await exact(asFile('assets/'+spec.base+'.webp'),spec.source);
 const oldCombat=await exact(asFile('assets/optimized/'+spec.base+'.webp'),spec.game);
 const pngPath='./assets/'+dir+'/'+id+'.png',source='./assets/'+dir+'/'+id+'.webp',output='./assets/optimized/'+dir+'/'+id+'.webp';
 const selected=await exact(asFile(pngPath),measurements.actors[id].masterSHA256);
 const [base,after,sourceBase,combatBase]=await Promise.all([pixels(oldPng,1024),pixels(selected,1024),pixels(oldSource,1024),pixels(oldCombat,640)]);
 const maskInput=await fs.readFile(path.join(here,id,'allowed-mask.png')),mask=await sharp(maskInput).removeAlpha().greyscale().raw().toBuffer({resolveWithObject:true});
 assert.deepEqual([mask.info.width,mask.info.height,mask.info.channels],[1024,1024,1],'Mask coordinates');
 const exactChanges=new Uint8Array(1024*1024),masterChanges=[0,0,0,0],sourcePixels=Buffer.from(sourceBase);
 for(let i=0;i<exactChanges.length;i++){
   const k=i*4;if(!changed(base,after,k))continue;
   assert.ok(mask.data[i]>0&&spec.edits.includes(quadrant(i,1024)),'Unapproved master change in '+id+' at '+i);
   masterChanges[quadrant(i,1024)]++;exactChanges[i]=1;after.copy(sourcePixels,k,k,k+4);
 }
 for(const cell of spec.edits)assert.ok(masterChanges[cell]>0,'No change in requested view');
 const srcBytes=await lossless(sourcePixels,1024);
 const srcDecoded=await pixels(srcBytes,1024);
 assert.deepEqual(diffRows(sourcePixels,srcDecoded,1024),[0,0,0,0]);
 const coverage=dilatedFootprint(exactChanges,1024,640);
 const {codec,width,height,...options}=profile;assert.equal(codec,'webp');assert.equal(width,640);assert.equal(height,640);
 const standard=await sharp(srcBytes).resize(width,height).webp(options).toBuffer(),candidate=await pixels(standard,640);
 const combat=Buffer.from(combatBase);let wouldChangeProtected=0;
 for(let i=0;i<coverage.length;i++){
   const k=i*4;
   if(coverage[i])candidate.copy(combat,k,k,k+4);
   else if(changed(candidate,combatBase,k,true))wouldChangeProtected++;
 }
 const packed=wouldChangeProtected?await lossless(combat,640):standard,combatDecoded=await pixels(packed,640);
 assert.deepEqual(diffRows(combat,combatDecoded,640),[0,0,0,0]);
 const sourceChanges=diffRows(sourceBase,srcDecoded,1024),gameChanges=diffRows(combatBase,combatDecoded,640);
 for(let d=0;d<4;d++){assert.equal(sourceChanges[d]>0,spec.edits.includes(d));assert.equal(gameChanges[d]>0,spec.edits.includes(d));}
 assert.ok(packed.length<srcBytes.length,'Combat derivative must be smaller than retained WebP');
 await safeSave(asFile(source),srcBytes);await safeSave(asFile(output),packed);
 const record=async bytes=>({bytes:bytes.length,sha256:imageHash(bytes),metadata:await imageMetadata(bytes)});
 return {id,editedDirections:spec.edits,before:{png:spec.png,source:spec.source,game:spec.game,gameBytes:oldCombat.length},
   master:{file:pngPath,sha256:imageHash(selected),bytes:selected.length,changedPixels:masterChanges,changesOutsideMask:0,maskSha256:imageHash(maskInput)},
   source,original:await record(srcBytes),output:{path:output,...await record(packed)},sourceVisibleChanges:sourceChanges,deployedVisibleChanges:gameChanges,
   deployedChangesOutsideFilterSupport:0,encoding:wouldChangeProtected?'lossless preservation of previous decoded pixels outside Lanczos support':'standard unit profile'};
}
const measurements=JSON.parse(await fs.readFile(path.join(here,'review.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(imageManifestFile,'utf8')),records=[];
for(const [id,spec] of Object.entries(inputs)){
 const entry=manifest.images.find(x=>x.id==='atlas:unit-'+id);assert.ok(entry);
 const result=await pack(id,spec,manifest.profiles.unit);
 assert.ok([spec.source,result.original.sha256].includes(entry.original.sha256),'Unrelated manifest change for '+id);
 Object.assign(entry,{source:result.source,original:result.original,output:result.output,decision:'Separate smaller combat atlas with unchanged decoded pixels preserved outside the regional edit.'});
 records.push(result);
}
await fs.writeFile(imageManifestFile,json(manifest));await fs.writeFile(path.join(here,'pixels.json'),json(records));
console.log(json(records.map(({id,master,deployedVisibleChanges,output})=>({id,masterChanges:master.changedPixels,deployedVisibleChanges,gameBytes:output.bytes}))));

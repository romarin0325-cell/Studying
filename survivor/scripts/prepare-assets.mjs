import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {cleanFrame,wholeFrame,alphaBounds} from './art-normalization.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'survivor/assets/prepared');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFile(path.join(root,p));
const cast=JSON.parse(await read('survivor/assets/cast.json'));
const defense=JSON.parse(await read('defense/assets/merge/units/manifest.json'));
const sources=cast.frames.map(f=>({id:'unit-'+f.id,source:f.sourcePath,frame:f}));
for(const id of ['storm_sage','lightning_sage','queen','galaxy_whale','great_detective'])sources.push({id:'unit-'+id,source:'defense/assets/merge/units/'+id+'.webp',frame:defense.frames.find(f=>f.id===id)});
const profileSource='survivor/assets/body-profile.json',profileBytes=await read(profileSource),profile=JSON.parse(profileBytes),proofs=[];
await fs.mkdir(out,{recursive:true});
const manifest={version:1,processor:'Whole painted figures: uniform aspect-preserving scale and sole translation; exact unarmed side reflections; native alpha; no body-region splicing or runtime pixel processing',processorHash:sha((await read('survivor/scripts/prepare-assets.mjs')).toString().replace(/\r\n/g,'\n')),assets:[],frames:{}};
manifest.normalization={source:profileSource,sha256:sha(profileBytes),processor:'survivor/scripts/art-normalization.mjs',processorSha256:sha((await read('survivor/scripts/art-normalization.mjs')).toString().replace(/\r\n/g,'\n'))};
async function save(id,bytes,source,sourceSha256){const file=id+'.webp';await fs.writeFile(path.join(out,file),bytes);const previous=manifest.assets.findIndex(a=>a.id===id);if(previous>=0)manifest.assets.splice(previous,1);manifest.assets.push({id,source,sourceSha256,file:'prepared/'+file,sha256:sha(bytes),bytes:bytes.length});}
const reflect=async(bytes,cell)=>sharp(bytes).flop().extend({left:1,right:0,top:0,bottom:0,background:'#00000000'}).extract({left:0,top:0,width:cell,height:cell}).png().toBuffer();
function record(id,i,frame,sample,removed,sourceFrame=i,mirroredFrom){proofs.push({id,frame:i,removed,landmarks:sample,sourceFrame,headScale:frame.headScale,bodyScale:frame.bodyScale,torsoScale:frame.torsoScale,legScale:frame.legScale,root:frame.root,method:frame.method,mirroredFrom});}
for(const item of sources){
  const raw=await read(item.source),sourceSha256=sha(raw),id=item.id.slice(5),body=profile.frames[id];
  if(item.frame.sourceSha256&&item.frame.sourceSha256!==sourceSha256)throw new Error('Canonical identity reference changed: '+item.source);
  if(body.nativeWalk){if(body.identityReference.sha256!==sourceSha256)throw new Error('Identity profile reference changed: '+id);continue;}
  if(body.sourceSha256!==sourceSha256)throw new Error('Body profile source changed: '+id);
  const layers=[];let front;
  for(let view=0;view<4;view++){
    const clean=await cleanFrame(await sharp(raw).extract({left:view%2*512,top:Math.floor(view/2)*512,width:512,height:512}).png().toBuffer()),s=body.canonical;
    const f=await wholeFrame(clean.bytes,{...s,scale:body.targetHead/(s.chin-s.skullTop),headHeight:s.chin-s.skullTop,cell:512,baseline:480}).catch(e=>{throw new Error(id+' view '+view+': '+e.message);});
    if(view===0)front=f;layers.push({input:f.bytes,left:view%2*512,top:Math.floor(view/2)*512});record(item.id,view,f,s,clean.removed);
  }
  const atlas=await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
  const bytes=await sharp(atlas).resize({width:768}).webp({quality:90,alphaQuality:100}).toBuffer();
  await save(item.id,bytes,item.source,sourceSha256);
  manifest.frames[id]={portrait:{x:256,y:(front.chin+front.skullTop)/2,size:body.targetHead*1.65},anchor:[256,480],directions:['down','up','left','right'],anatomy:{headHeight:body.targetHead,bodyHeight:480-front.chin,sole:480,method:front.method}};
}
const specs=[];manifest.renewal={references:[]};
for(const name of ['renewal','reverie','ordeal']){const source='survivor/assets/'+name+'/sources.json',bytes=await read(source);manifest[name]={...manifest[name],source,sha256:sha(bytes)};specs.push(...JSON.parse(bytes));}
for(const spec of specs){
  const raw=await read(spec.source),sourceSha256=sha(raw),meta=await sharp(raw).metadata();let bytes;
  if(spec.reference)manifest.renewal.references.push({source:spec.reference,sha256:sha(await read(spec.reference))});
  if(spec.kind==='scene')bytes=await sharp(raw).resize(1200,800).webp({quality:87}).toBuffer();
  else if(spec.kind==='background')bytes=await sharp(raw).resize(1024,1024).webp({quality:87}).toBuffer();
  else{
    const frames=[];
    for(let i=0;i<spec.columns*spec.rows;i++){
      const index=spec.sequence?.[i]??i,col=index%spec.columns,row=Math.floor(index/spec.columns),edges=spec.rowXEdges?.[row]||spec.xEdges;
      const left=edges?Math.round(edges[col]/1254*meta.width):Math.floor(col*meta.width/spec.columns),right=edges?Math.round(edges[col+1]/1254*meta.width):Math.floor((col+1)*meta.width/spec.columns);
      const top=spec.yEdges?Math.round(spec.yEdges[row]/1254*meta.height):Math.floor(row*meta.height/spec.rows),bottom=spec.yEdges?Math.round(spec.yEdges[row+1]/1254*meta.height):Math.floor((row+1)*meta.height/spec.rows),rect=spec.rects?.[index];
      let region=rect?{left:rect[0],top:rect[1],width:rect[2],height:rect[3]}:{left,top,width:right-left,height:bottom-top};
      if(spec.extractionPadding){const [px,py]=spec.extractionPadding,l=Math.max(0,left-px),t=Math.max(0,top-py);region={left:l,top:t,width:Math.min(meta.width,right+px)-l,height:Math.min(meta.height,bottom+py)-t};}
      const extracted=await sharp(raw).extract(region).png().toBuffer();
      const clean=['walk','icons','actors'].includes(spec.kind)&&spec.id!=='effects'?await cleanFrame(extracted,spec.kind==='walk'?{minArea:140,maxGap:14,keepSecondary:!spec.isolatedFigure}:undefined):{bytes:extracted,removed:0};const frame=spec.flipFrames?.includes(i)?await sharp(clean.bytes).flop().png().toBuffer():clean.bytes;frames.push({frame,bounds:await alphaBounds(frame),removed:clean.removed});
    }
    const cell=spec.cell,walking=spec.kind==='walk',actor=spec.kind==='actors',composites=[],normalizedWalk=[];
    const id=walking?spec.id.slice(5):null,body=profile.frames[id];
    if(walking&&body.walkSourceSha256!==sourceSha256)throw new Error('Walk profile source changed: '+id);
    for(let i=0;i<frames.length;i++){
      const {frame,bounds:b}=frames[i],view=Math.floor(i/4);
      if(walking){
        const sample=body.walk.frames[i];let normalized;
        if(view===3&&body.mirrorRight){const original=normalizedWalk[i-4];normalized={...original,bytes:await reflect(original.bytes,cell)};}
        else normalized=await wholeFrame(frame,{...sample,scale:body.targetHead/512*160/(body.walk.views[view].chin-body.walk.views[view].skullTop),headHeight:sample.chin-sample.skullTop,cell,baseline:cell*.9375}).catch(e=>{throw new Error(spec.id+' frame '+i+': '+e.message);});
        normalizedWalk.push(normalized);composites.push({input:normalized.bytes,left:i%4*cell,top:view*cell});
        const mirror=view===3&&body.mirrorRight;record(spec.id,i,normalized,body.walk.frames[mirror?i-4:i],frames[mirror?i-4:i].removed,spec.sequence?.[mirror?i-4:i]??(mirror?i-4:i),mirror?i-4:undefined);continue;
      }
      const group=frames.slice(Math.floor(i/spec.columns)*spec.columns,Math.floor(i/spec.columns)*spec.columns+spec.columns),scale=actor?Math.min((cell-20)/Math.max(...group.map(f=>f.bounds.width)),(cell-24)/Math.max(...group.map(f=>f.bounds.height))):Math.min((cell-20)/b.width,(cell-20)/b.height),width=Math.max(1,Math.round(b.width*scale)),height=Math.max(1,Math.round(b.height*scale));
      composites.push({input:await sharp(frame).extract(b).resize(width,height).png().toBuffer(),left:i%spec.columns*cell+Math.round((cell-width)/2),top:Math.floor(i/spec.columns)*cell+(actor?Math.round(cell*.9375)-height:Math.round((cell-height)/2))});
    }
    bytes=await sharp({create:{width:cell*spec.columns,height:cell*spec.rows,channels:4,background:'#00000000'}}).composite(composites).webp({quality:90,alphaQuality:100}).toBuffer();
    if(walking){
      const canon=[],layers=[];
      for(let view=0;view<4;view++){
        const i=view*4+1,sample=body.walk.frames[i];let f;
        if(view===3&&body.mirrorRight)f={...canon[2],bytes:await reflect(canon[2].bytes,512)};
        else f=await wholeFrame(frames[i].frame,{...sample,scale:body.targetHead/(body.walk.views[view].chin-body.walk.views[view].skullTop),headHeight:sample.chin-sample.skullTop,cell:512,baseline:480}).catch(e=>{throw new Error('unit-'+id+' view '+view+': '+e.message);});
        canon.push(f);layers.push({input:f.bytes,left:view%2*512,top:Math.floor(view/2)*512});record('unit-'+id,view,f,body.walk.frames[view===3&&body.mirrorRight?9:i],frames[i].removed,view===3&&body.mirrorRight?9:i,view===3&&body.mirrorRight?2:undefined);
      }
      const atlas=await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
      const canonical=await sharp(atlas).resize({width:768}).webp({quality:90,alphaQuality:100}).toBuffer();await save('unit-'+id,canonical,spec.source,sourceSha256);
      await save('full-'+id,await sharp(canon[0].bytes).resize({width:384}).webp({quality:93,alphaQuality:100}).toBuffer(),spec.source,sourceSha256);
      manifest.frames[id]={portrait:{x:256,y:(canon[0].chin+canon[0].skullTop)/2,size:body.targetHead*1.65},anchor:[256,480],directions:['down','up','left','right'],anatomy:{headHeight:body.targetHead,bodyHeight:480-canon[0].chin,sole:480,method:canon[0].method},walk:{texture:spec.id,columns:4,rows:4,cell,anchor:[cell/2,cell*.9375],distancePerFrame:16,displayScale:cell/160}};
    }
  }
  await save(spec.id,bytes,spec.source,sourceSha256);
}
manifest.normalization.frames=proofs;
await fs.writeFile(path.join(root,'survivor/assets/prepared-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${manifest.assets.length} consistent offline textures (${Math.round(manifest.assets.reduce((n,a)=>n+a.bytes,0)/1024)} KiB)`);

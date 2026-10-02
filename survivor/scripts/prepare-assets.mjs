import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {cleanFrame,anatomicalFrame,walkLandmarks,alphaBounds} from './art-normalization.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'survivor/assets/prepared');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cast=JSON.parse(await fs.readFile(path.join(root,'survivor/assets/cast.json'),'utf8'));
const defense=JSON.parse(await fs.readFile(path.join(root,'defense/assets/merge/units/manifest.json'),'utf8'));
const extras=['storm_sage','lightning_sage','queen','galaxy_whale','great_detective'];
const sources=cast.frames.map(f=>({id:'unit-'+f.id,source:f.sourcePath,frame:f}));
for(const id of extras){const frame=defense.frames.find(f=>f.id===id);sources.push({id:'unit-'+id,source:'defense/assets/merge/units/'+id+'.webp',frame});}

const profileSource='survivor/assets/body-profile.json',profileBytes=await fs.readFile(path.join(root,profileSource)),profile=JSON.parse(profileBytes),proofs=[];
await fs.mkdir(out,{recursive:true});const manifest={version:1,processor:'Anatomically normalized cast and sole-aligned walking atlases; cleaned illustrated combat cells; native alpha; no runtime pixel processing',processorHash:sha((await fs.readFile(fileURLToPath(import.meta.url),'utf8')).replace(/\r\n/g,'\n')),assets:[],frames:{}};
manifest.normalization={source:profileSource,sha256:sha(profileBytes),processor:'survivor/scripts/art-normalization.mjs',processorSha256:sha((await fs.readFile(path.join(root,'survivor/scripts/art-normalization.mjs'),'utf8')).replace(/\r\n/g,'\n'))};
for(const item of sources){const raw=await fs.readFile(path.join(root,item.source));const sourceSha256=sha(raw);
  if(item.frame?.sourceSha256&&item.frame.sourceSha256!==sourceSha256)throw new Error('Canonical character source changed: '+item.source);
  const unit=item.id.startsWith('unit-'),id=item.id.slice(5),body=profile.frames[id];let normalized=raw;
  if(body){if(body.sourceSha256!==sourceSha256)throw new Error('Anatomical profile source changed: '+item.id);const layers=[],side=512;for(let view=0;view<4;view++){const cleaned=await cleanFrame(await sharp(raw).extract({left:view%2*side,top:Math.floor(view/2)*side,width:side,height:side}).png().toBuffer());let frame;try{frame=await anatomicalFrame(cleaned.bytes,{...body.canonical,targetHead:body.targetHead,targetBody:body.canonical.targetBody,cell:512,baseline:480});}catch(error){throw new Error(item.id+' view '+view+': '+error.message);}layers.push({input:frame.bytes,left:view%2*512,top:Math.floor(view/2)*512});proofs.push({id:item.id,frame:view,removed:cleaned.removed,headScale:frame.headScale,bodyScale:frame.bodyScale,root:frame.root});}
    normalized=await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
  }
  const bytes=await sharp(normalized).resize({width:unit?768:item.id==='garden'?960:undefined,withoutEnlargement:true}).webp({quality:unit?90:85,alphaQuality:100}).toBuffer();
  const file=item.id+'.webp';await fs.writeFile(path.join(out,file),bytes);manifest.assets.push({id:item.id,source:item.source,sourceSha256,file:'prepared/'+file,sha256:sha(bytes),bytes:bytes.length});
  if(item.frame)manifest.frames[id]={portrait:body?{x:256,y:480-body.canonical.targetBody-body.targetHead/2,size:body.targetHead*1.65}:item.frame.portrait,anchor:item.frame.anchor,directions:item.frame.directions,anatomy:body?{headHeight:body.targetHead,bodyHeight:body.canonical.targetBody,sole:480}:undefined};
}
// Generated originals and reviewed frame substitutions are explicit build inputs.
const specsPath='survivor/assets/renewal/sources.json';
const specsBytes=await fs.readFile(path.join(root,specsPath));
manifest.renewal={source:specsPath,sha256:sha(specsBytes),references:[]};
const specs=JSON.parse(specsBytes);
const bounds=alphaBounds;
const reverieSource='survivor/assets/reverie/sources.json',reverieBytes=await fs.readFile(path.join(root,reverieSource));manifest.reverie={source:reverieSource,sha256:sha(reverieBytes)};specs.push(...JSON.parse(reverieBytes));
const ordealSource='survivor/assets/ordeal/sources.json',ordealBytes=await fs.readFile(path.join(root,ordealSource));manifest.ordeal={source:ordealSource,sha256:sha(ordealBytes)};specs.push(...JSON.parse(ordealBytes));
for(const spec of specs){
  const raw=await fs.readFile(path.join(root,spec.source));const meta=await sharp(raw).metadata();let bytes;
  if(spec.reference){const reference=await fs.readFile(path.join(root,spec.reference));manifest.renewal.references.push({source:spec.reference,sha256:sha(reference)});}
  if(spec.kind==='scene')bytes=await sharp(raw).resize(1200,800).webp({quality:87}).toBuffer();
  else if(spec.kind==='background')bytes=await sharp(raw).resize(1024,1024).webp({quality:87}).toBuffer();
  else{
    const frames=[];
    for(let i=0;i<spec.columns*spec.rows;i++){
      const index=spec.sequence?.[i]??i,col=index%spec.columns,row=Math.floor(index/spec.columns);
      const edges=spec.rowXEdges?.[row]||spec.xEdges;
      const left=edges?Math.round(edges[col]/1254*meta.width):Math.floor(col*meta.width/spec.columns);
      const right=edges?Math.round(edges[col+1]/1254*meta.width):Math.floor((col+1)*meta.width/spec.columns);
      const top=spec.yEdges?Math.round(spec.yEdges[row]/1254*meta.height):Math.floor(row*meta.height/spec.rows),bottom=spec.yEdges?Math.round(spec.yEdges[row+1]/1254*meta.height):Math.floor((row+1)*meta.height/spec.rows);
      const rect=spec.rects?.[index],region=rect?{left:rect[0],top:rect[1],width:rect[2],height:rect[3]}:{left,top,width:right-left,height:bottom-top};
      const extracted=await sharp(raw).extract(region).png().toBuffer(),cleaned=['walk','icons','actors'].includes(spec.kind)&&spec.id!=='effects'?await cleanFrame(extracted):{bytes:extracted,removed:0};
      frames.push({frame:cleaned.bytes,bounds:await bounds(cleaned.bytes),removed:cleaned.removed});
    }
    const cell=spec.cell,walking=spec.kind==='walk',actor=spec.kind==='actors';
    if(walking&&profile.frames[spec.id.slice(5)].walkSourceSha256!==sha(raw))throw new Error('Walking anatomical profile source changed: '+spec.id);
    const composites=[],normalizedWalk=[];
    for(let i=0;i<frames.length;i++){
      const {frame,bounds:b}=frames[i];
      if(walking){
        const body=profile.frames[spec.id.slice(5)],view=Math.floor(i/4),sample=await walkLandmarks(frame,{...body.walk.views[view],rootX:body.walk.phaseRoots?.[view]?.[i%4]??body.walk.views[view].rootX}).catch(error=>{throw new Error(spec.id+' frame '+i+': '+error.message);});let normalized;
        if(view===3&&body.mirrorRight){
          // Raster flip reflects about (cell-1)/2. Translate one pixel to keep
          // the exact anatomical pivot at cell/2; transparent gutters permit it.
          const reflected=await sharp(normalizedWalk[i-4]).flop().extend({left:1,right:0,top:0,bottom:0,background:'#00000000'}).extract({left:0,top:0,width:cell,height:cell}).png().toBuffer();
          const original=proofs.find(p=>p.id===spec.id&&p.frame===i-4);normalized={...original,bytes:reflected};
        }else try{normalized=await anatomicalFrame(frame,{...sample,referenceFoot:body.walk.views[view].foot,targetTorso:body.targetTorso/512*160,targetHead:body.targetHead/512*160,targetBody:body.canonical.targetBody/512*160,cell,baseline:cell*.9375});}catch(error){throw new Error(spec.id+' frame '+i+': '+error.message);}
        normalizedWalk.push(normalized.bytes);composites.push({input:normalized.bytes,left:i%spec.columns*cell,top:view*cell});proofs.push({id:spec.id,frame:i,removed:frames[i].removed,landmarks:view===3&&body.mirrorRight?normalized.landmarks:sample,sourceFrame:spec.sequence?.[view===3&&body.mirrorRight?i-4:i]??(view===3&&body.mirrorRight?i-4:i),headScale:normalized.headScale,bodyScale:normalized.bodyScale,torsoScale:normalized.torsoScale,legScale:normalized.legScale,root:normalized.root,mirroredFrom:view===3&&body.mirrorRight?i-4:undefined});continue;
      }
      const group=frames.slice(Math.floor(i/spec.columns)*spec.columns,Math.floor(i/spec.columns)*spec.columns+spec.columns);const scale=actor?Math.min((cell-20)/Math.max(...group.map(f=>f.bounds.width)),(cell-24)/Math.max(...group.map(f=>f.bounds.height))):Math.min((cell-20)/b.width,(cell-20)/b.height),width=Math.max(1,Math.round(b.width*scale)),height=Math.max(1,Math.round(b.height*scale));
      const input=await sharp(frame).extract(b).resize(width,height).png().toBuffer();
      composites.push({input,left:i%spec.columns*cell+Math.round((cell-width)/2),top:Math.floor(i/spec.columns)*cell+((walking||actor)?Math.round(cell*.9375)-height:Math.round((cell-height)/2))});
    }
    bytes=await sharp({create:{width:cell*spec.columns,height:cell*spec.rows,channels:4,background:'#00000000'}}).composite(composites).webp({quality:90,alphaQuality:100}).toBuffer();
    if(walking){
      const id=spec.id.slice(5),body=profile.frames[id],sample=await walkLandmarks(frames[1].frame,{...body.walk.views[0],rootX:body.walk.phaseRoots?.[0]?.[1]??body.walk.views[0].rootX});
      const full=await anatomicalFrame(frames[1].frame,{...sample,referenceFoot:body.walk.views[0].foot,targetHead:body.targetHead,targetBody:body.canonical.targetBody,targetTorso:body.targetTorso,cell:512,baseline:480});
      const preview=await sharp(full.bytes).resize(384,384).webp({quality:93,alphaQuality:100}).toBuffer(),file='full-'+id+'.webp';await fs.writeFile(path.join(out,file),preview);
      manifest.assets.push({id:'full-'+id,source:spec.source,sourceSha256:sha(raw),file:'prepared/'+file,sha256:sha(preview),bytes:preview.length});
    }
    if(walking)manifest.frames[spec.id.slice(5)].walk={texture:spec.id,columns:4,rows:4,cell,anchor:[cell/2,cell*.9375],distancePerFrame:16,displayScale:cell/160};
  }
  const file=spec.id+'.webp';await fs.writeFile(path.join(out,file),bytes);
  const old=manifest.assets.findIndex(a=>a.id===spec.id);if(old>=0)manifest.assets.splice(old,1);
  manifest.assets.push({id:spec.id,source:spec.source,sourceSha256:sha(raw),file:'prepared/'+file,sha256:sha(bytes),bytes:bytes.length});
}
manifest.normalization.frames=proofs;
await fs.writeFile(path.join(root,'survivor/assets/prepared-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${manifest.assets.length} consistent offline textures (${Math.round(manifest.assets.reduce((n,a)=>n+a.bytes,0)/1024)} KiB)`);

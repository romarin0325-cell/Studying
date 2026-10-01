import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'survivor/assets/prepared');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cast=JSON.parse(await fs.readFile(path.join(root,'survivor/assets/cast.json'),'utf8'));
const defense=JSON.parse(await fs.readFile(path.join(root,'defense/assets/merge/units/manifest.json'),'utf8'));
const extras=['storm_sage','lightning_sage','queen','galaxy_whale','great_detective'];
const sources=cast.frames.map(f=>({id:'unit-'+f.id,source:f.sourcePath,frame:f}));
for(const id of extras){const frame=defense.frames.find(f=>f.id===id);sources.push({id:'unit-'+id,source:'defense/assets/merge/units/'+id+'.webp',frame});}

await fs.mkdir(out,{recursive:true});const manifest={version:1,processor:'Canonical 768px portraits and reviewed uniformly scaled walking/combat atlases; native alpha; no runtime pixel processing',processorHash:sha((await fs.readFile(fileURLToPath(import.meta.url),'utf8')).replace(/\r\n/g,'\n')),assets:[],frames:{}};
for(const item of sources){const raw=await fs.readFile(path.join(root,item.source));const sourceSha256=sha(raw);
  if(item.frame?.sourceSha256&&item.frame.sourceSha256!==sourceSha256)throw new Error('Canonical character source changed: '+item.source);
  const unit=item.id.startsWith('unit-');const bytes=await sharp(raw).resize({width:unit?768:item.id==='garden'?960:undefined,withoutEnlargement:true}).webp({quality:unit?90:85,alphaQuality:100}).toBuffer();
  const file=item.id+'.webp';await fs.writeFile(path.join(out,file),bytes);manifest.assets.push({id:item.id,source:item.source,sourceSha256,file:'prepared/'+file,sha256:sha(bytes),bytes:bytes.length});
  if(item.frame)manifest.frames[item.id.slice(5)]={portrait:item.frame.portrait,anchor:item.frame.anchor,directions:item.frame.directions};
}
// Generated originals and reviewed frame substitutions are explicit build inputs.
const specsPath='survivor/assets/renewal/sources.json';
const specsBytes=await fs.readFile(path.join(root,specsPath));
manifest.renewal={source:specsPath,sha256:sha(specsBytes),references:[]};
const specs=JSON.parse(specsBytes);
async function bounds(bytes){
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=0,bottom=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>80){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  if(right<left)throw new Error('Empty animation frame');return {left,top,width:right-left+1,height:bottom-top+1};
}
for(const spec of specs){
  const raw=await fs.readFile(path.join(root,spec.source));const meta=await sharp(raw).metadata();let bytes;
  if(spec.reference){const reference=await fs.readFile(path.join(root,spec.reference));manifest.renewal.references.push({source:spec.reference,sha256:sha(reference)});}
  if(spec.kind==='background')bytes=await sharp(raw).resize(1024,1024).webp({quality:87}).toBuffer();
  else{
    const frames=[];
    for(let i=0;i<spec.columns*spec.rows;i++){
      const index=spec.sequence?.[i]??i,col=index%spec.columns,row=Math.floor(index/spec.columns);
      const edges=spec.rowXEdges?.[row]||spec.xEdges;
      const left=edges?Math.round(edges[col]/1254*meta.width):Math.floor(col*meta.width/spec.columns);
      const right=edges?Math.round(edges[col+1]/1254*meta.width):Math.floor((col+1)*meta.width/spec.columns);
      const top=spec.yEdges?Math.round(spec.yEdges[row]/1254*meta.height):Math.floor(row*meta.height/spec.rows),bottom=spec.yEdges?Math.round(spec.yEdges[row+1]/1254*meta.height):Math.floor((row+1)*meta.height/spec.rows);
      const rect=spec.rects?.[index],region=rect?{left:rect[0],top:rect[1],width:rect[2],height:rect[3]}:{left,top,width:right-left,height:bottom-top};
      const frame=await sharp(raw).extract(region).png().toBuffer();
      frames.push({frame,bounds:await bounds(frame)});
    }
    const cell=spec.cell,walking=spec.kind==='walk';let targetHeight=cell*.82;
    if(walking&&spec.reference){const ref=await fs.readFile(path.join(root,spec.reference)),m=await sharp(ref).metadata(),side=Math.floor(m.width/2),b=await bounds(await sharp(ref).extract({left:0,top:0,width:side,height:side}).png().toBuffer());targetHeight=cell*Math.max(.74,Math.min(.87,b.height/side));}
    const actor=spec.kind==='actors';
    const factor=walking?Math.min((cell-18)/Math.max(...frames.map(f=>f.bounds.width)),targetHeight/Math.max(...frames.map(f=>f.bounds.height))):null;
    const composites=[];
    for(let i=0;i<frames.length;i++){
      const {frame,bounds:b}=frames[i];const group=frames.slice(Math.floor(i/4)*4,Math.floor(i/4)*4+4);const scale=factor||(actor?Math.min((cell-20)/Math.max(...group.map(f=>f.bounds.width)),(cell-24)/Math.max(...group.map(f=>f.bounds.height))):Math.min((cell-20)/b.width,(cell-20)/b.height)),width=Math.max(1,Math.round(b.width*scale)),height=Math.max(1,Math.round(b.height*scale));
      const input=await sharp(frame).extract(b).resize(width,height).png().toBuffer();
      composites.push({input,left:i%spec.columns*cell+Math.round((cell-width)/2),top:Math.floor(i/spec.columns)*cell+((walking||actor)?Math.round(cell*.9375)-height:Math.round((cell-height)/2))});
    }
    bytes=await sharp({create:{width:cell*spec.columns,height:cell*spec.rows,channels:4,background:'#00000000'}}).composite(composites).webp({quality:90,alphaQuality:100}).toBuffer();
    if(walking)manifest.frames[spec.id.slice(5)].walk={texture:spec.id,columns:4,rows:4,cell,anchor:[cell/2,cell*.9375],distancePerFrame:16};
  }
  const file=spec.id+'.webp';await fs.writeFile(path.join(out,file),bytes);
  const old=manifest.assets.findIndex(a=>a.id===spec.id);if(old>=0)manifest.assets.splice(old,1);
  manifest.assets.push({id:spec.id,source:spec.source,sourceSha256:sha(raw),file:'prepared/'+file,sha256:sha(bytes),bytes:bytes.length});
}
await fs.writeFile(path.join(root,'survivor/assets/prepared-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${manifest.assets.length} consistent offline textures (${Math.round(manifest.assets.reduce((n,a)=>n+a.bytes,0)/1024)} KiB)`);

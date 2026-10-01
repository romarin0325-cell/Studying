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
sources.push({id:'garden',source:'defense/assets/merge/garden.webp'});
for(const i of [2,3])sources.push({id:'world'+i,source:'shooter/generated-assets/worlds/'+i+'.webp'});
for(const group of ['enemy','boss','sentinel'])for(let i=0;i<4;i++)sources.push({id:group+'-'+i,source:'shooter/generated-assets/'+({enemy:'enemies',boss:'bosses',sentinel:'sentinels'}[group])+'/'+i+'.webp'});
await fs.mkdir(out,{recursive:true});const manifest={version:1,processor:'Uniform 768px atlas scaling; existing direction layouts and native alpha retained; no runtime image manipulation',processorHash:sha((await fs.readFile(fileURLToPath(import.meta.url),'utf8')).replace(/\r\n/g,'\n')),assets:[],frames:{}};
for(const item of sources){const raw=await fs.readFile(path.join(root,item.source));const sourceSha256=sha(raw);
  if(item.frame?.sourceSha256&&item.frame.sourceSha256!==sourceSha256)throw new Error('Canonical character source changed: '+item.source);
  const unit=item.id.startsWith('unit-');const bytes=await sharp(raw).resize({width:unit?768:item.id==='garden'?960:undefined,withoutEnlargement:true}).webp({quality:unit?90:85,alphaQuality:100}).toBuffer();
  const file=item.id+'.webp';await fs.writeFile(path.join(out,file),bytes);manifest.assets.push({id:item.id,source:item.source,sourceSha256,file:'prepared/'+file,sha256:sha(bytes),bytes:bytes.length});
  if(item.frame)manifest.frames[item.id.slice(5)]={portrait:item.frame.portrait,anchor:item.frame.anchor,directions:item.frame.directions};
}
await fs.writeFile(path.join(root,'survivor/assets/prepared-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${manifest.assets.length} consistent offline textures (${Math.round(manifest.assets.reduce((n,a)=>n+a.bytes,0)/1024)} KiB)`);

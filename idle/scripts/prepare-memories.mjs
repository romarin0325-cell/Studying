import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const sources=JSON.parse(await fs.readFile(path.join(root,'assets/generated-sources.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(root,'assets/manifest.json'),'utf8'));
const season=JSON.parse(await fs.readFile(path.join(root,'src/data/season.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const tiles=[];
for(const [id,file]of Object.entries(sources)){
 const source=await fs.readFile(file),meta=await sharp(source).metadata();
 const bytes=await sharp(source).resize({width:1152,height:1536,fit:'inside',withoutEnlargement:true}).webp({quality:86,effort:6}).toBuffer();
 const sized=await sharp(bytes).metadata(),dest=`assets/memories/${id}.webp`;
 await fs.writeFile(path.join(root,dest),bytes);
 const item=season.memories.find(x=>x.id===id),prior=manifest.assets.findIndex(x=>x.id===id);
 const entry={id,name:item?.name||id,path:dest,sourcePath:file,sourceSha256:sha(source),sha256:sha(bytes),width:sized.width,height:sized.height,sourceWidth:meta.width,sourceHeight:meta.height,canonicalPersonId:item?.heroIds?.length===1?item.heroIds[0]:item?.heroIds||id.split('_')[1],crop:'none',anchor:[.5,.28],reviewed:false,origin:'new illustration, referenced original outfit',role:id.startsWith('archive')?'standing':id==='s01_lumi_whale'?'shared-scene':'story-scene'};
 if(prior>=0)manifest.assets[prior]=entry;else manifest.assets.push(entry);
 const idx=tiles.length,label=Buffer.from(`<svg width="230" height="30"><rect width="230" height="30" fill="#18233b"/><text x="8" y="19" fill="white" font-size="13">${id} ${sized.width}:${sized.height}</text></svg>`);
 const thumb=await sharp(bytes).resize(230,340,{fit:'contain',background:'#d7dce6'}).extend({bottom:30,background:'#18233b'}).composite([{input:label,left:0,top:340}]).png().toBuffer();
 tiles.push({input:thumb,left:idx%5*230,top:Math.floor(idx/5)*370});
}
await fs.writeFile(path.join(root,'assets/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await sharp({create:{width:1150,height:Math.ceil(tiles.length/5)*370,channels:3,background:'#18233b'}}).composite(tiles).jpeg({quality:92}).toFile(path.join(root,'docs/review/memory-contact-sheet.jpg'));
console.log(`${tiles.length} memory artworks, original aspect ratios retained`);

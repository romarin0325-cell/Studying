import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),settings={width:320,height:480,fit:'inside',withoutEnlargement:true,quality:82,version:1};
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function prepareThumbnails(){
 const manifest=JSON.parse(await fs.readFile(path.join(root,'assets/manifest.json'),'utf8')),out={settings,assets:{}};
 let previous={};try{previous=JSON.parse(await fs.readFile(path.join(root,'assets/thumbnails.json'),'utf8'));}catch{}
 await fs.mkdir(path.join(root,'assets/thumbs'),{recursive:true});
 for(const a of manifest.assets){const file='assets/thumbs/'+a.id+'.webp',key=sha(JSON.stringify([a.sha256,settings])),cached=previous.assets?.[a.id];let bytes;
 if(cached?.key===key){try{const b=await fs.readFile(path.join(root,file));if(sha(b)===cached.sha256)bytes=b;}catch{}}
 if(!bytes){bytes=await sharp(await fs.readFile(path.join(root,a.path))).resize({width:settings.width,height:settings.height,fit:'inside',withoutEnlargement:true}).webp({quality:settings.quality,effort:5}).toBuffer();await fs.writeFile(path.join(root,file),bytes);}
 const meta=await sharp(bytes).metadata();out.assets[a.id]={path:file,key,sha256:sha(bytes),width:meta.width,height:meta.height};
 }
 await fs.writeFile(path.join(root,'assets/thumbnails.json'),JSON.stringify(out,null,2)+'\n');return out;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename))console.log('Prepared '+Object.keys((await prepareThumbnails()).assets).length+' aspect-preserving thumbnails');

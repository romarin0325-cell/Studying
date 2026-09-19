import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ASSET_MANIFEST } from '../defense/js/content/assets.js';
const root = fileURLToPath(new URL('../defense/', import.meta.url));

// Same edge-connected mask as the former runtime implementation. Only alpha
// changes, preserving colors, sprite bounds and isolated white costume details.
export function removeBackground(data, width, height, white) {
  const visited = new Uint8Array(width * height), pending = new Int32Array(width * height);
  let head=0,tail=0;
  const enqueue=i=>{
    if(visited[i])return;
    const o=i*4, lo=Math.min(data[o],data[o+1],data[o+2]), hi=Math.max(data[o],data[o+1],data[o+2]);
    if(!(white ? lo>=240 : lo>=224 && hi-lo<=14))return;
    visited[i]=1;pending[tail++]=i;
  };
  for(let x=0;x<width;x++){enqueue(x);enqueue((height-1)*width+x);}
  for(let y=1;y<height-1;y++){enqueue(y*width);enqueue(y*width+width-1);}
  while(head<tail){
    const i=pending[head++],x=i%width,y=Math.floor(i/width);data[i*4+3]=0;
    if(x)enqueue(i-1);if(x+1<width)enqueue(i+1);if(y)enqueue(i-width);if(y+1<height)enqueue(i+width);
  }
  return data;
}
export async function prepareArt({checkOnly=false}={}) {
  let checked=0,converted=0;
  for(const entry of ASSET_MANIFEST.filter(e=>e.hasAlpha)){
    const file=path.resolve(root,entry.path);
    const input=await readFile(file), metadata=await sharp(input).metadata();
    const stats=await sharp(input).stats();
    if(metadata.hasAlpha && stats.channels[3]?.min===0){checked++;continue;}
    if(checkOnly)throw new Error('Unprepared opaque release asset: '+entry.id);
    const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    removeBackground(data,info.width,info.height,entry.sourceBackgroundStatus==='generated-white');
    const output=sharp(data,{raw:{width:info.width,height:info.height,channels:4}});
    const encoded=path.extname(file)==='.png' ? await output.png().toBuffer() : await output.webp({quality:90,alphaQuality:100,effort:5}).toBuffer();
    await writeFile(file,encoded); converted++;
  }
  console.log('Defense alpha assets: '+checked+' checked, '+converted+' prepared');
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  await prepareArt({checkOnly:process.argv.includes('--check')});
}

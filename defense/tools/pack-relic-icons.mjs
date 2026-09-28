import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {ARTIFACTS} from '../merge/content.js';

// The generated source is NOT a regular grid. These reviewed dividers follow
// the empty gutters of each column, including the tall first-row silhouettes.
export const RELIC_REGIONS=[
  [0,0,255,338],[255,0,255,346],[510,0,242,341],[752,0,245,351],[1023,0,231,351],
  [0,338,255,321],[255,346,255,304],[510,341,242,311],[752,351,245,300],[997,351,257,300],
  [0,652,255,274],[255,650,255,287],[510,652,242,277],[752,651,245,279],[997,651,257,284],
  [0,926,255,328],[255,937,255,317],[510,929,242,325],[775,930,222,324],[997,935,257,319],
];
// The lantern tip and comet tip overlap vertically, but occupy different x
// positions. Clear only the neighboring object, preserving both silhouettes.
export const RELIC_EXCLUSIONS={5:[[210,314,45,7]],10:[[0,0,190,12]]};
export const RELIC_SOURCE_SHA='271c71dbecfeaec7f687232e685c8ba0e37fdc6ee175b4c28ef13cf64d95de33';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function packRelics(source,output){
  const bytes=await readFile(source),sourceHash=hash(bytes);
  if(sourceHash!==RELIC_SOURCE_SHA)throw new Error('Relic source changed: review all twenty crop regions before packing');
  const layers=[],frames=[];
  for(let i=0;i<RELIC_REGIONS.length;i++){
    const [left,top,width,height]=RELIC_REGIONS[i];
    const {data,info}=await sharp(bytes).extract({left,top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(const [x,y,w,h] of RELIC_EXCLUSIONS[i]||[]){
      for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)data[(py*width+px)*4+3]=0;
    }
    const region=await sharp(data,{raw:info}).png().toBuffer();
    const isolated=await sharp(region).trim({threshold:8}).png().toBuffer();
    const icon=await sharp(isolated).resize(212,212,{fit:'inside',withoutEnlargement:true}).png().toBuffer();
    const meta=await sharp(icon).metadata(),x=i%5*256+Math.floor((256-meta.width)/2),y=Math.floor(i/5)*256+Math.floor((256-meta.height)/2);
    layers.push({input:icon,left:x,top:y});frames.push({id:ARTIFACTS[i].id,source:RELIC_REGIONS[i],exclude:RELIC_EXCLUSIONS[i]||[],cell:[i%5*256,Math.floor(i/5)*256,256,256]});
  }
  const packed=await sharp({create:{width:1280,height:1024,channels:4,background:'#00000000'}}).composite(layers).webp({quality:92,alphaQuality:100,effort:6}).toBuffer();
  await writeFile(output,packed);
  return {sourceHash,sha256:hash(packed),bytes:packed.length,cell:256,minimumGutter:22,frames};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(!process.argv[2])throw new Error('Usage: node defense/tools/pack-relic-icons.mjs SOURCE.png');
  const output=fileURLToPath(new URL('../assets/merge/relics.webp',import.meta.url));
  const record=await packRelics(process.argv[2],output);
  await writeFile(new URL('../doc/RELIC_PACKING.json',import.meta.url),JSON.stringify(record,null,2)+'\n');
  console.log(`Packed 20 isolated relics: ${record.bytes} bytes, 1280 x 1024, 22px minimum gutters`);
}

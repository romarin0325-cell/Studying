// Retain supplied PNGs and their encodings at immutable, content-addressed paths.
// Existing paintings stay at their original paths. Only the selected catalog records
// change; story text and body hashes are preserved.
// Usage: node defense/scripts/art/replace-memorials.mjs <png dir> <id>=<file.png> [...]
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {gameRoot} from '../local-inputs.mjs';
import {MEMORIAL_MEDIA_FORMATS as format} from '../../src/memorial-media.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const base64Bytes=bytes=>4*Math.ceil(bytes/3);
const usage='Usage: replace-memorials.mjs <png dir> <id>=<file.png> ...';

async function checkExisting(file,bytes){
  try{
    if(!(await fs.readFile(file)).equals(bytes))throw new Error('Refusing to overwrite preserved memorial: '+file);
  }catch(error){if(error.code!=='ENOENT')throw error;}
}

async function preserve(file,bytes){
  await fs.mkdir(path.dirname(file),{recursive:true});
  try{await fs.writeFile(file,bytes,{flag:'wx'});}
  catch(error){if(error.code!=='EEXIST')throw error;await checkExisting(file,bytes);}
}

export async function replaceMemorials(dir,pairs,{root=gameRoot}={}){
  if(!dir||!pairs?.length)throw new Error(usage);
  const manifestFile=path.join(root,'src/memorial-media.js');
  let text=await fs.readFile(manifestFile,'utf8');
  const newline=text.includes('\r\n')?'\r\n':'\n';
  const files=[],results={},seen=new Set();
  // Prepare and validate the whole batch before writing any preserved file or catalog.
  for(const pair of pairs){
    const at=pair.indexOf('='),id=pair.slice(0,at),name=pair.slice(at+1);
    if(at<1||!name||!/^[a-z][a-z0-9_]*$/.test(id))throw new Error(usage);
    if(seen.has(id))throw new Error('Duplicate memorial: '+id);
    seen.add(id);
    const recordPattern=new RegExp('(^|\\r?\\n)  "'+id+'": (\\{[\\s\\S]*?\\r?\\n  \\})');
    const match=recordPattern.exec(text);
    if(!match)throw new Error('No manifest record: '+id);
    const record=JSON.parse(match[2]);
    const input=await fs.readFile(path.resolve(dir,name));
    const meta=await sharp(input).metadata(),stats=await sharp(input).stats();
    if(meta.format!=='png'||meta.width*3!==meta.height*2||meta.width<format.width)throw new Error('Need a 2:3 PNG at least 720 wide: '+id);
    const pipeline=()=>{
      let image=sharp(input,{failOn:'error'}).rotate().toColourspace(format.colourspace).resize({width:format.width,height:format.height,...format.resize});
      if(stats.isOpaque)image=image.removeAlpha();
      return image;
    };
    const avif=await pipeline().avif(format.avif).toBuffer();
    let quality=format.webp.quality,webp;
    for(;;){
      webp=await pipeline().webp({quality,effort:format.webp.effort,smartSubsample:format.webp.smartSubsample}).toBuffer();
      if(webp.length<=format.webp.maxBytes)break;
      quality-=format.webp.qualityStep;
      if(quality<format.webp.minQuality)throw new Error('WebP over budget at minimum quality: '+id);
    }
    if(avif.length>=100*1024)throw new Error('AVIF over the 100 KB memorial budget: '+id);
    const sourceSha256=hash(input),outputSha256=hash(avif),webpSha256=hash(webp);
    const sourcePath='./assets/memorial-sources/'+id+'/'+sourceSha256+'.png';
    const avifPath='./assets/memorial/replacements/'+id+'/'+outputSha256+'.avif';
    const webpPath='./assets/memorial-webp/replacements/'+id+'/'+webpSha256+'.webp';
    const output=await sharp(avif).metadata();
    const next={...record,sourceFilename:name,sourcePath,sourceSha256,sourceBytes:input.length,
      sourceWidth:meta.width,sourceHeight:meta.height,sourceHasAlpha:!!meta.hasAlpha,sourceIsOpaque:stats.isOpaque,
      alphaRemoved:!!meta.hasAlpha&&stats.isOpaque,outputSha256,bytes:avif.length,base64Bytes:base64Bytes(avif.length),
      width:output.width,height:output.height,hasAlpha:!!output.hasAlpha,avifPath,
      encoder:Object.fromEntries(['sharp','vips','webp','aom','heif'].map(key=>[key,sharp.versions[key]])),
      webp:{...record.webp,path:webpPath,quality,bytes:webp.length,base64Bytes:base64Bytes(webp.length),outputSha256:webpSha256,
        width:output.width,height:output.height,hasAlpha:!!output.hasAlpha}};
    const replacement=JSON.stringify(next,null,2).split('\n').join(newline+'  ');
    text=text.replace(recordPattern,()=>match[1]+'  "'+id+'": '+replacement);
    for(const [relative,bytes] of [[sourcePath,input],[avifPath,avif],[webpPath,webp]])files.push({file:path.resolve(root,relative),bytes});
    results[id]={source:sourcePath,sourceSha256,avif:avifPath,webp:webpPath,webpQuality:quality};
  }
  for(const {file,bytes} of files)await checkExisting(file,bytes);
  for(const {file,bytes} of files)await preserve(file,bytes);
  await fs.writeFile(manifestFile,text);
  return results;
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  const [dir,...pairs]=process.argv.slice(2);
  console.log(JSON.stringify(await replaceMemorials(dir,pairs),null,2));
}

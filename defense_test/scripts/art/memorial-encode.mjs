// Encodes one memorial original with the exact catalog pipeline (MEMORIAL_MEDIA_FORMATS) and prints the manifest entry.
//   node defense_test/scripts/art/memorial-encode.mjs <source.png> <defense_test dir> <id> <sourceFilename> <story.json>
// story.json is MEMORIAL_STORIES[id] ({title,paragraphs}); bodySha256 ties the image record to the story text.
// Writes assets/memorial/<id>.avif and assets/memorial-webp/<id>.webp and prints the manifest entry to paste into
// src/memorial-media.js. Keep the original PNG outside the repository (2:3, at least 720x1080).
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {pathToFileURL} from 'node:url';
const [src,game,id,sourceFilename,storyFile]=process.argv.slice(2);
const {MEMORIAL_MEDIA_FORMATS:format}=await import(pathToFileURL(path.join(game,'src/memorial-media.js')).href);
const digest=b=>createHash('sha256').update(b).digest('hex');
const input=await fs.readFile(src),meta=await sharp(input).metadata(),stats=await sharp(input).stats();
if(meta.format!=='png'||meta.width*3!==meta.height*2)throw new Error('need a 2:3 PNG, got '+meta.format+' '+meta.width+'x'+meta.height);
const pipeline=()=>{let img=sharp(input,{failOn:'error'}).rotate().toColourspace(format.colourspace).resize({width:format.width,height:format.height,...format.resize});if(stats.isOpaque)img=img.removeAlpha();return img;};
const avif=await pipeline().avif(format.avif).toBuffer();
let quality=format.webp.quality,webp=await pipeline().webp({quality,effort:format.webp.effort,smartSubsample:format.webp.smartSubsample}).toBuffer();
while(webp.length>format.webp.maxBytes){quality-=format.webp.qualityStep;webp=await pipeline().webp({quality,effort:format.webp.effort,smartSubsample:format.webp.smartSubsample}).toBuffer();}
await fs.writeFile(path.join(game,'assets/memorial',id+'.avif'),avif);
await fs.writeFile(path.join(game,'assets/memorial-webp',id+'.webp'),webp);
const am=await sharp(avif).metadata(),wm=await sharp(webp).metadata(),av1C=avif.indexOf(Buffer.from('av1C')),flags=avif[av1C+6];
const story=JSON.parse(await fs.readFile(storyFile,'utf8'));
const entry={sourceFilename,sourceSha256:digest(input),sourceBytes:input.length,sourceWidth:meta.width,sourceHeight:meta.height,sourceHasAlpha:!!meta.hasAlpha,sourceIsOpaque:stats.isOpaque,alphaRemoved:!!meta.hasAlpha&&stats.isOpaque,
  outputSha256:digest(avif),width:am.width,height:am.height,hasAlpha:!!am.hasAlpha,bytes:avif.length,base64Bytes:4*Math.ceil(avif.length/3),codec:'avif',quality:format.avif.quality,effort:format.avif.effort,chromaSubsampling:format.avif.chromaSubsampling,
  av1Config:{profile:avif[av1C+5]>>5,monochrome:!!(flags&0x10),subsamplingX:(flags>>3)&1,subsamplingY:(flags>>2)&1},
  titleLine:null,bodyStartLine:null,bodyEndLine:null,bodySha256:digest(story.paragraphs.join('\n')),avifPath:`./assets/memorial/${id}.avif`,
  webp:{path:`./assets/memorial-webp/${id}.webp`,codec:'webp',sourceCodec:'png',quality,effort:format.webp.effort,smartSubsample:format.webp.smartSubsample,width:wm.width,height:wm.height,hasAlpha:!!wm.hasAlpha,bytes:webp.length,base64Bytes:4*Math.ceil(webp.length/3),outputSha256:digest(webp)}};
console.log(JSON.stringify({[id]:entry},null,2));

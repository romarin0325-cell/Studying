// Replace selected memorial paintings with owner-supplied 2:3 PNGs (pass 18). The PNGs stay outside Git; this encodes
// them with the catalog's settings (MEMORIAL_MEDIA_FORMATS: AVIF q52 4:4:4, WebP q82 stepping down to the size cap) and
// rewrites only those records in src/memorial-media.js. Story text and its hash are untouched.
// Usage: node defense/scripts/art/replace-memorials.mjs <png dir> <id>=<file.png> [...]
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {gameRoot} from '../local-inputs.mjs';
import {MEMORIAL_MEDIA_FORMATS as format} from '../../src/memorial-media.js';
const hash=b=>createHash('sha256').update(b).digest('hex'),b64=n=>4*Math.ceil(n/3);
const [dir,...pairs]=process.argv.slice(2);if(!dir||!pairs.length)throw Error('Usage: replace-memorials.mjs <png dir> <id>=<file.png> ...');
const manifestFile=path.join(gameRoot,'src/memorial-media.js');let text=await fs.readFile(manifestFile,'utf8');
const results={};
for(const pair of pairs){
  const at=pair.indexOf('='),id=pair.slice(0,at),name=pair.slice(at+1),input=await fs.readFile(path.join(dir,name)),meta=await sharp(input).metadata(),stats=await sharp(input).stats();
  if(meta.format!=='png'||meta.width*3!==meta.height*2||meta.width<format.width)throw Error('Need a 2:3 PNG at least 720 wide: '+id);
  const pipeline=()=>{let image=sharp(input,{failOn:'error'}).rotate().toColourspace(format.colourspace).resize({width:format.width,height:format.height,...format.resize});if(stats.isOpaque)image=image.removeAlpha();return image;};
  const avif=await pipeline().avif(format.avif).toBuffer();let quality=format.webp.quality,webp;
  for(;;){webp=await pipeline().webp({quality,effort:format.webp.effort,smartSubsample:format.webp.smartSubsample}).toBuffer();if(webp.length<=format.webp.maxBytes)break;quality-=format.webp.qualityStep;if(quality<format.webp.minQuality)throw Error('WebP over budget at minimum quality: '+id);}
  if(avif.length>=100*1024)throw Error('AVIF over the 100 KB memorial budget: '+id);
  // Locate this hero's record and replace its source/output fields in place, keeping key order and story fields.
  const start=text.indexOf(`\n  "${id}": {`);if(start<0)throw Error('No manifest record: '+id);
  const end=text.indexOf('\n  }',start)+4,record=text.slice(start,end);
  const set=(block,key,value)=>{const re=new RegExp(`("${key}": )("(?:[^"\\\\]|\\\\.)*"|[^,\\r\\n]+)`);if(!re.test(block))throw Error(id+': no '+key);return block.replace(re,(m,k)=>k+JSON.stringify(value));};
  const [head,webpPart]=record.split('"webp": {');
  let top=head;
  for(const [k,v] of Object.entries({sourceFilename:name,sourceSha256:hash(input),sourceBytes:input.length,sourceWidth:meta.width,sourceHeight:meta.height,sourceHasAlpha:!!meta.hasAlpha,sourceIsOpaque:stats.isOpaque,alphaRemoved:!!meta.hasAlpha&&stats.isOpaque,outputSha256:hash(avif),bytes:avif.length,base64Bytes:b64(avif.length)}))top=set(top,k,v);
  let tail=webpPart;
  for(const [k,v] of Object.entries({quality,bytes:webp.length,base64Bytes:b64(webp.length),outputSha256:hash(webp)}))tail=set(tail,k,v);
  text=text.slice(0,start)+top+'"webp": {'+tail+text.slice(end);
  const avifPath=record.match(/"avifPath": "([^"]+)"/)[1],webpPath=tail.match(/"path": "([^"]+)"/)[1];
  await fs.writeFile(path.join(gameRoot,avifPath),avif);await fs.writeFile(path.join(gameRoot,webpPath),webp);
  results[id]={source:name,sourceSha256:hash(input),avif:avif.length,webp:webp.length,webpQuality:quality};
}
await fs.writeFile(manifestFile,text);
console.log(JSON.stringify(results,null,2));

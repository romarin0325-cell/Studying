// Reproduce only Gold Dragon's selected files; never overwrite preserved input art.
// node defense/docs/art/gold-dragon-20261029/prepare.mjs <original Gold PNG>
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {MEMORIAL_STORIES} from '../../../src/memorial.js';
const dir=path.dirname(fileURLToPath(import.meta.url)),game=path.resolve(dir,'../../..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const original=await fs.readFile(process.argv[2]);
const sourceSha256=hash(original);
if(sourceSha256!=='8644f560115f835e6b5c5d7700b5b0cc81cd3a6a9953c61490e33579ffa721d3')throw Error('Gold original differs from reviewed input');
async function preserve(relative,bytes){
  const dest=path.join(game,relative);await fs.mkdir(path.dirname(dest),{recursive:true});
  try{await fs.writeFile(dest,bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;if(!(await fs.readFile(dest)).equals(bytes))throw Error('Preserved bytes differ: '+relative);}
}
const sourcePath='./assets/memorial-sources/gold_dragon/'+sourceSha256+'.png';
await preserve(sourcePath,original);
// Keep the full 3:5 original. Equal side padding is explicit; no costume/wing crop.
const painting=await sharp(original).rotate().toColourspace('srgb').resize(720,1080,{fit:'contain',background:'#171c28'}).removeAlpha().png().toBuffer();
const avif=await sharp(painting).avif({quality:52,effort:4,chromaSubsampling:'4:4:4'}).toBuffer();
let quality=82,webp;
do{webp=await sharp(painting).webp({quality,effort:6,smartSubsample:true}).toBuffer();if(webp.length<100*1024)break;quality-=2;}while(quality>=64);
if(avif.length>=100*1024||webp.length>=100*1024)throw Error('Memorial budget exceeded');
const avifHash=hash(avif),webpHash=hash(webp);
const avifPath='./assets/memorial/replacements/gold_dragon/'+avifHash+'.avif';
const webpPath='./assets/memorial-webp/replacements/gold_dragon/'+webpHash+'.webp';
await preserve(avifPath,avif);await preserve(webpPath,webp);
const meta=await sharp(original).metadata();
const record={
  sourceFilename:'골드드래곤.png',sourceSha256,sourcePath,sourceBytes:original.length,sourceWidth:meta.width,sourceHeight:meta.height,
  sourceHasAlpha:!!meta.hasAlpha,sourceIsOpaque:(await sharp(original).stats()).isOpaque,
  sourceKind:'User-supplied original character illustration. New memorial prose authored from the supplied concept sheet.',
  normalization:'sRGB; whole 768x1280 original contained at 648x1080, 36px #171c28 padding on each side, no cropping',
  alphaRemoved:!!meta.hasAlpha,outputSha256:avifHash,width:720,height:1080,hasAlpha:false,bytes:avif.length,base64Bytes:4*Math.ceil(avif.length/3),codec:'avif',quality:52,effort:4,chromaSubsampling:'4:4:4',
  titleLine:null,bodyStartLine:null,bodyEndLine:null,bodySha256:hash(Buffer.from(MEMORIAL_STORIES.gold_dragon.paragraphs.join('\n'))),avifPath,
  webp:{path:webpPath,codec:'webp',sourceCodec:'png',quality,effort:6,smartSubsample:true,width:720,height:1080,hasAlpha:false,bytes:webp.length,base64Bytes:4*Math.ceil(webp.length/3),outputSha256:webpHash},
  encoder:Object.fromEntries(['sharp','vips','webp','aom','heif'].map(k=>[k,sharp.versions[k]]))
};
const catalogPath=path.join(game,'src/new-memorial-media.js');
let catalog=await fs.readFile(catalogPath,'utf8');
const serial=JSON.stringify(record,null,2).replace(/\n/g,'\n  ');
if(!catalog.includes('"gold_dragon":'))catalog=catalog.replace('export const NEW_MEMORIAL_MEDIA = {','export const NEW_MEMORIAL_MEDIA = {\n  "gold_dragon": '+serial+',');
else{
  const pattern=/(^|\r?\n)  "gold_dragon": (\{[\s\S]*?\r?\n  \})/,match=catalog.match(pattern);
  if(!match||JSON.parse(match[2]).sourceSha256!==sourceSha256)throw Error('Refusing to change the selected Gold original');
  catalog=catalog.replace(pattern,match[1]+'  "gold_dragon": '+serial);
}
await fs.writeFile(catalogPath,catalog);
// Six native-alpha painted components, uniformly shrunk to add cell gutters.
// No keys, background removal, recolouring or repainting; actual alpha is preserved.
const raw=await fs.readFile(path.join(dir,'vfx/generation.png'));
const layers=[];
for(let frame=0;frame<6;frame++){
  const cell=await sharp(raw).extract({left:frame%3*512,top:Math.floor(frame/3)*512,width:512,height:512}).resize(472,472).png().toBuffer();
  layers.push({input:cell,left:frame%3*512+20,top:Math.floor(frame/3)*512+20});
}
const atlas=await sharp({create:{width:1536,height:1024,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
const encoded=await sharp(atlas).webp({quality:95,alphaQuality:100,effort:6}).toBuffer();
await preserve('./assets/merge/gold-breath.webp',encoded);
await fs.writeFile(path.join(dir,'vfx/packing.json'),JSON.stringify({columns:3,rows:2,cell:512,padding:20,scale:472/512,sourceSha256:hash(raw),outputSha256:hash(encoded),bytes:encoded.length,frames:['gather-gold','rise-gold','fall-gold','impact-gold','seal-gold','gather-crimson']},null,2)+'\n');
console.log(JSON.stringify({memorialAvif:avif.length,memorialWebp:webp.length,vfxBytes:encoded.length,sourceSha256}));

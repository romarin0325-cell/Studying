// Manual preparation from the external, user-provided PNG originals.
// Normal builds never invoke this script or require MEMORIAL_SOURCE_DIR.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {HEROES} from '../src/content.js';
import {MEMORIAL_MEDIA_FORMATS as format,MEMORIAL_MEDIA_MANIFEST as catalog} from '../src/memorial-media.js';
import {gameRoot,assetFile} from './local-inputs.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=message=>{throw new Error(message);};
const sameIds=(actual,expected)=>actual.length===expected.length&&actual.every((id,i)=>id===expected[i]);
const heroIds=HEROES.map(hero=>hero.id).sort();
if(heroIds.length!==30||!sameIds(Object.keys(catalog).sort(),heroIds))fail('The canonical media catalog must select exactly the thirty active heroes.');
if(new Set(Object.values(catalog).map(media=>media.sourceFilename)).size!==30)fail('Each hero must select a distinct PNG original.');
if(format.width*3!==format.height*2)fail('Memorial output must retain the full 2:3 portrait ratio.');

const reproduce=new Set();let candidate=false;
for(const argument of process.argv.slice(2)){
  if(argument==='--candidate')candidate=true;
  else if(argument==='--check-avif')for(const id of heroIds)reproduce.add(id);
  else if(argument.startsWith('--check-avif=')){
    const id=argument.slice('--check-avif='.length);
    if(!catalog[id])fail('Unknown AVIF reproduction hero: '+id);
    reproduce.add(id);
  }else fail('Unknown preparation argument: '+argument);
}
if(!process.env.MEMORIAL_SOURCE_DIR)fail('Set MEMORIAL_SOURCE_DIR to the external original-PNG folder. This script is manual; normal builds need no originals.');
const sourceRoot=path.resolve(process.env.MEMORIAL_SOURCE_DIR);
const repository=path.resolve(gameRoot,'..'),relativeSource=path.relative(repository,sourceRoot);
if(!relativeSource||relativeSource!=='..'&&!relativeSource.startsWith('..'+path.sep)&&!path.isAbsolute(relativeSource))fail('Keep the original PNG folder outside the repository.');
const inputNames=(await fs.readdir(sourceRoot)).filter(name=>/\.png$/i.test(name));
const expectedFiles=new Set(Object.values(catalog).map(media=>media.sourceFilename));
const missingInputs=[...expectedFiles].filter(name=>!inputNames.includes(name));
if(missingInputs.length)fail('Missing selected original PNG files: '+missingInputs.join(', '));
const unusedInputNames=inputNames.filter(name=>!expectedFiles.has(name)).sort();
const reviewDir=path.join(gameRoot,'test-results','.media-review');
const candidateRoot=path.join(reviewDir,'candidate-assets');

async function existing(file){
  try{return await fs.readFile(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}
}
function assertSinglePngFrame(bytes,id){
  // libvips PNG metadata does not expose APNG pages; inspect its frame declaration too.
  const signature=Buffer.from([137,80,78,71,13,10,26,10]);
  if(bytes.length<8||!bytes.subarray(0,8).equals(signature))fail('Original memorial must be a single-frame PNG: '+id);
  let frames=null,frameControls=0,ended=false;
  for(let at=8;at+12<=bytes.length;){
    const length=bytes.readUInt32BE(at),end=at+length+12;
    if(end>bytes.length)fail('Malformed PNG chunk: '+id);
    const type=bytes.toString('ascii',at+4,at+8);
    if(type==='acTL'){
      if(length!==8||frames!==null)fail('Malformed PNG animation control: '+id);
      frames=bytes.readUInt32BE(at+8);
      if(frames!==1)fail('Original memorial must be a single-frame PNG: '+id);
    }
    if(type==='fcTL'){
      if(length!==26)fail('Malformed PNG frame control: '+id);
      frameControls++;
    }
    at=end;
    if(type==='IEND'){ended=true;break;}
  }
  if(!ended)fail('Malformed PNG missing IEND: '+id);
  if(frames!==null&&frameControls!==frames||frames===null&&frameControls!==0)fail('Original memorial must be a single-frame PNG: '+id);
}
async function encodedMetadata(bytes,codec,id,expectedAlpha){
  const metadata=await sharp(bytes,{failOn:'error'}).metadata();
  if((metadata.pages||1)!==1)fail('Encoded memorial must contain exactly one frame: '+id+' '+codec);
  if(metadata.format!==(codec==='avif'?'heif':'webp')||metadata.width!==format.width||metadata.height!==format.height||metadata.hasAlpha!==expectedAlpha||metadata.space!=='srgb')fail('Encoded dimensions, color or alpha mismatch: '+id+' '+codec);
  if(codec==='avif'){
    const av1C=bytes.indexOf(Buffer.from('av1C'));
    if(av1C<0||bytes[av1C+4]!==0x81||(bytes[av1C+6]&0x1c)!==0)fail('AVIF must retain color 4:4:4: '+id);
  }
  return {width:metadata.width,height:metadata.height,hasAlpha:metadata.hasAlpha,space:metadata.space};
}

const entries=[],candidateCatalog={};
for(const hero of HEROES){
  const id=hero.id,record=catalog[id],sourceFile=path.resolve(sourceRoot,record.sourceFilename),inside=path.relative(sourceRoot,sourceFile);
  if(!inside||inside==='..'||inside.startsWith('..'+path.sep)||path.isAbsolute(inside))fail('PNG selection must stay inside MEMORIAL_SOURCE_DIR: '+id);
  const input=await fs.readFile(sourceFile),sourceMetadata=await sharp(input,{failOn:'error'}).metadata();
  if(sourceMetadata.format!=='png'||(sourceMetadata.pages||1)!==1)fail('Original memorial must be a single-frame PNG: '+id);
  assertSinglePngFrame(input,id);
  const stats=await sharp(input,{failOn:'error'}).stats();
  if(!candidate&&(digest(input)!==record.sourceSha256||input.length!==record.sourceBytes))fail('Original PNG selection/hash mismatch: '+id+'; use --candidate to review a changed original without overwriting deployed assets.');
  const swaps=[5,6,7,8].includes(sourceMetadata.orientation),oriented=sourceMetadata.autoOrient||{width:swaps?sourceMetadata.height:sourceMetadata.width,height:swaps?sourceMetadata.width:sourceMetadata.height};
  if(oriented.width*3!==oriented.height*2||oriented.width<format.width||oriented.height<format.height)fail('Original must contain the full 2:3 composition at sufficient resolution: '+id);
  if(!candidate&&(sourceMetadata.width!==record.sourceWidth||sourceMetadata.height!==record.sourceHeight||sourceMetadata.hasAlpha!==record.sourceHasAlpha||stats.isOpaque!==record.sourceIsOpaque))fail('Original metadata differs from the reviewed source: '+id);
  const expectedAlpha=sourceMetadata.hasAlpha&&!stats.isOpaque;
  const pipeline=()=>{
    let image=sharp(input,{failOn:'error'}).rotate().toColourspace(format.colourspace).resize({width:format.width,height:format.height,...format.resize});
    if(stats.isOpaque)image=image.removeAlpha();
    return image;
  };

  const avifFile=candidate?path.join(candidateRoot,'avif',id+'.avif'):assetFile(record.avifPath),previousAvif=candidate?null:await existing(avifFile);
  if(previousAvif&&(digest(previousAvif)!==record.outputSha256||previousAvif.length!==record.bytes))fail('Existing reviewed AVIF was changed; restore or review it explicitly: '+id);
  let avif=previousAvif,avifSourceChecked=false;
  if(candidate||!avif||reproduce.has(id)){
    const reproduced=await pipeline().avif(format.avif).toBuffer();
    if(!candidate&&(digest(reproduced)!==record.outputSha256||reproduced.length!==record.bytes))fail('AVIF reproduction is not byte-identical; inspect encoder/source versions or use --candidate before changing approved art: '+id);
    avifSourceChecked=true;
    if(!avif){await fs.mkdir(path.dirname(avifFile),{recursive:true});await fs.writeFile(avifFile,reproduced);avif=reproduced;}
  }
  const avifMetadata=await encodedMetadata(avif,'avif',id,expectedAlpha);

  let quality=format.webp.quality;
  if(quality<format.webp.minQuality||format.webp.qualityStep<=0)fail('Invalid manual WebP quality range.');
  let webp=await pipeline().webp({quality,effort:format.webp.effort,smartSubsample:format.webp.smartSubsample}).toBuffer();
  while(webp.length>format.webp.maxBytes){
    quality-=format.webp.qualityStep;
    if(quality<format.webp.minQuality)fail('WebP exceeds the manual per-image target at the reviewed minimum quality '+format.webp.minQuality+': '+id+'; review size/quality instead of silently degrading art.');
    webp=await pipeline().webp({quality,effort:format.webp.effort,smartSubsample:format.webp.smartSubsample}).toBuffer();
  }
  if(!candidate&&(quality!==record.webp.quality||digest(webp)!==record.webp.outputSha256||webp.length!==record.webp.bytes))fail('Direct PNG-to-WebP output differs from the visually reviewed catalog: '+id+'; use --candidate for review.');
  const webpMetadata=await encodedMetadata(webp,'webp',id,expectedAlpha),webpFile=candidate?path.join(candidateRoot,'webp',id+'.webp'):assetFile(record.webp.path),previousWebp=await existing(webpFile),webpWritten=!previousWebp||!previousWebp.equals(webp);
  if(webpWritten){await fs.mkdir(path.dirname(webpFile),{recursive:true});await fs.writeFile(webpFile,webp);}
  const entry={id,sourceFilename:record.sourceFilename,sourceSha256:digest(input),sourceBytes:input.length,sourceWidth:sourceMetadata.width,sourceHeight:sourceMetadata.height,sourceHasAlpha:sourceMetadata.hasAlpha,sourceIsOpaque:stats.isOpaque,alphaRemoved:sourceMetadata.hasAlpha&&stats.isOpaque,avifPath:record.avifPath,avifSha256:digest(avif),avifBytes:avif.length,avifPreserved:!!previousAvif,avifSourceChecked,webpPath:record.webp.path,webpSha256:digest(webp),webpBytes:webp.length,webpQuality:quality,webpWritten,...webpMetadata};
  entries.push(entry);
  if(candidate){
    const av1C=avif.indexOf(Buffer.from('av1C')),flags=avif[av1C+6];
    candidateCatalog[id]={...record,sourceSha256:entry.sourceSha256,sourceBytes:input.length,sourceWidth:sourceMetadata.width,sourceHeight:sourceMetadata.height,sourceHasAlpha:sourceMetadata.hasAlpha,sourceIsOpaque:stats.isOpaque,alphaRemoved:entry.alphaRemoved,outputSha256:entry.avifSha256,width:avifMetadata.width,height:avifMetadata.height,hasAlpha:avifMetadata.hasAlpha,bytes:avif.length,base64Bytes:4*Math.ceil(avif.length/3),codec:'avif',...format.avif,av1Config:{profile:avif[av1C+5]>>5,monochrome:!!(flags&16),subsamplingX:(flags>>3)&1,subsamplingY:(flags>>2)&1},webp:{path:record.webp.path,codec:'webp',sourceCodec:'png',quality,effort:format.webp.effort,smartSubsample:format.webp.smartSubsample,width:webpMetadata.width,height:webpMetadata.height,hasAlpha:webpMetadata.hasAlpha,bytes:webp.length,base64Bytes:4*Math.ceil(webp.length/3),outputSha256:entry.webpSha256}};
  }
  console.log(`${id}: ${candidate?'candidate only; ':''}direct PNG -> WebP q${quality}, ${webp.length} B; AVIF ${candidate?'candidate':previousAvif?'preserved':'restored'}${avifSourceChecked&&!candidate?' / source-byte identity checked':''}`);
}

const sum=field=>entries.reduce((total,entry)=>total+entry[field],0);
const embedded=Object.fromEntries(entries.map(entry=>[entry.id,'data:image/webp;base64,'+'A'.repeat(4*Math.ceil(entry.webpBytes/3))]));
const report={createdAt:new Date().toISOString(),manualOnly:true,candidateOnly:candidate,sourcePngCount:inputNames.length,selectedCount:entries.length,unusedInputNames,encoderVersions:{sharp:sharp.versions.sharp,vips:sharp.versions.vips,webp:sharp.versions.webp,aom:sharp.versions.aom,heif:sharp.versions.heif},avifReproductionIds:[...reproduce],totals:{avifBytes:sum('avifBytes'),webpBytes:sum('webpBytes'),webpBase64Bytes:entries.reduce((total,entry)=>total+4*Math.ceil(entry.webpBytes/3),0),webpEmbeddedObjectBytes:Buffer.byteLength(JSON.stringify(embedded)),maximumWebpBytes:Math.max(...entries.map(entry=>entry.webpBytes)),averageWebpBytes:sum('webpBytes')/entries.length},entries};
await fs.mkdir(reviewDir,{recursive:true});await fs.writeFile(path.join(reviewDir,candidate?'candidate-report.json':'prepare-report.json'),JSON.stringify(report,null,2));
if(candidate)await fs.writeFile(path.join(reviewDir,'candidate-catalog.json'),JSON.stringify({formats:{...format,encoder:report.encoderVersions},catalog:candidateCatalog},null,2));
console.log(JSON.stringify({selected:report.selectedCount,sourcePngCount:report.sourcePngCount,unusedInputs:unusedInputNames,...report.totals}));

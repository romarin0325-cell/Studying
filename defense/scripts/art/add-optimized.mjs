// Encode only the static images that are new to docs/ASSET_OPTIMIZATION.json (same profile and encoder as optimize-images.mjs)
// and splice them in; existing entries and their optimized files are never re-encoded (house rule). --dry-run lists them.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {imageInputs,IMAGE_PROFILES} from '../image-policy.mjs';
import {imageManifestFile,imageHash,imageMetadata} from '../image-pack.mjs';
import {assetFile} from '../local-inputs.mjs';

const dryRun=process.argv.includes('--dry-run'),manifest=JSON.parse(await fs.readFile(imageManifestFile,'utf8'));
const have=new Map(manifest.images.map(image=>[image.id,image])),images=[];
for(const input of imageInputs()){
  const old=have.get(input.id);if(old){images.push(old);continue;}
  if(dryRun){console.log('would add',input.id);continue;}
  const source=await fs.readFile(assetFile(input.source)),metadata=await imageMetadata(source),original={bytes:source.length,sha256:imageHash(source),metadata};
  if(!input.profile){images.push({...input,original,output:null,decision:'Build-only source; omitted from HTML and preload.'});console.log('added',input.id,'(build-only)');continue;}
  const {codec,width,height,...options}=IMAGE_PROFILES[input.profile];let pipeline=sharp(source);if(width)pipeline=pipeline.resize(width,height);
  const candidate=await pipeline[codec](options).toBuffer(),smaller=candidate.length<source.length,bytes=smaller?candidate:source;
  const relative=smaller?input.source.replace('./assets/','./assets/optimized/'):input.source;
  if(smaller){
    const file=assetFile(relative);let existing;
    try{existing=await fs.readFile(file);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(existing&&!existing.equals(bytes))throw new Error('Refusing to overwrite existing optimized file: '+relative);
    if(!existing){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);}
  }
  images.push({...input,original,output:{path:relative,bytes:bytes.length,sha256:imageHash(bytes),metadata:await imageMetadata(bytes)},decision:smaller?'Separate smaller encoding; source preserved.':'Candidate was not smaller; retained source bytes.'});
  console.log('added',input.id,source.length,'->',bytes.length);
}
if(dryRun)console.log('Dry run complete; no files written.');
else{
  manifest.images=images;
  const sum=f=>images.reduce((s,i)=>s+f(i),0);
  Object.assign(manifest.totals,{sourceBytes:sum(i=>i.original.bytes),deployableSourceBytes:sum(i=>i.output?i.original.bytes:0),outputBytes:sum(i=>i.output?.bytes||0),optimizedFiles:sum(i=>Number(Boolean(i.output&&i.output.path!==i.source))),derivedFiles:manifest.derived.length,derivedOutputBytes:manifest.derived.reduce((s,i)=>s+i.output.bytes,0)});
  await fs.writeFile(imageManifestFile,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest.totals));
}

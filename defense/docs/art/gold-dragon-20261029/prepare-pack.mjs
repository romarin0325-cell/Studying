// Add only the new Gold inputs to the existing prepared pack; never re-encode unrelated art.
// Follow with: node defense/scripts/optimize-images.mjs --derived-only
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {imageInputs,IMAGE_PROFILES} from '../../../scripts/image-policy.mjs';
import {imageManifestFile,imageHash,imageMetadata} from '../../../scripts/image-pack.mjs';
import {assetFile} from '../../../scripts/local-inputs.mjs';
const manifest=JSON.parse(await fs.readFile(imageManifestFile,'utf8'));
const old=new Map(manifest.images.map(i=>[i.id,i]));
const additions=new Set(['atlas:unit-gold_dragon','atlas:gold-breath','memorial:gold_dragon','memorial-webp:gold_dragon']);
const images=[];
for(const input of imageInputs()){
  const previous=old.get(input.id);
  if(previous){
    const {original,output,decision,...recipe}=previous;
    if(JSON.stringify(recipe)===JSON.stringify(input)){images.push(previous);continue;}
    if(!additions.has(input.id))throw Error('Unrelated input recipe changed: '+input.id);
  }
  if(!additions.has(input.id))throw Error('Unexpected new source: '+input.id);
  const source=await fs.readFile(assetFile(input.source)),original={bytes:source.length,sha256:imageHash(source),metadata:await imageMetadata(source)};
  const {codec,width,height,...options}=IMAGE_PROFILES[input.profile];
  let pipeline=sharp(source);if(width)pipeline=pipeline.resize(width,height);
  const candidate=await pipeline[codec](options).toBuffer(),smaller=candidate.length<source.length,bytes=smaller?candidate:source;
  const relative=smaller?input.source.replace('./assets/','./assets/optimized/'):input.source;
  if(smaller){const dest=assetFile(relative);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,bytes);}
  images.push({...input,original,output:{path:relative,bytes:bytes.length,sha256:imageHash(bytes),metadata:await imageMetadata(bytes)},decision:smaller?'Separate smaller encoding; source preserved.':'Candidate was not smaller; retained source bytes.'});
  console.log(input.id+': '+source.length+' -> '+bytes.length+' B');
}
manifest.images=images;
manifest.totals={...manifest.totals,...images.reduce((s,i)=>({sourceBytes:s.sourceBytes+i.original.bytes,deployableSourceBytes:s.deployableSourceBytes+(i.output?i.original.bytes:0),outputBytes:s.outputBytes+(i.output?.bytes||0),optimizedFiles:s.optimizedFiles+Number(Boolean(i.output&&i.output.path!==i.source))}),{sourceBytes:0,deployableSourceBytes:0,outputBytes:0,optimizedFiles:0})};
await fs.writeFile(imageManifestFile,JSON.stringify(manifest,null,2)+'\n');

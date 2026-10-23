// Manual encoding pass. Normal builds only validate/read the committed image pack.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {assetFile} from './local-inputs.mjs';
import {imageInputs,IMAGE_PROFILES,DERIVED_PROFILES} from './image-policy.mjs';
import {imageManifestFile,imageHash,imageMetadata,loadImagePack} from './image-pack.mjs';
import {writeImageReview} from './review-image-pack.mjs';

if(process.argv.includes('--check')){
  const {manifest}=await loadImagePack();
  console.log('Preserved sources and optimized pack verified: '+manifest.images.length+' images.');
}else{
  const images=[];
  for(const input of imageInputs()){
    const source=await fs.readFile(assetFile(input.source)),metadata=await imageMetadata(source);
    const original={bytes:source.length,sha256:imageHash(source),metadata};
    if(!input.profile){images.push({...input,original,output:null,decision:'Build-only source; omitted from HTML and preload.'});continue;}
    const {codec,width,height,...options}=IMAGE_PROFILES[input.profile];
    let pipeline=sharp(source);if(width)pipeline=pipeline.resize(width,height);
    const candidate=await pipeline[codec](options).toBuffer();
    const smaller=candidate.length<source.length,bytes=smaller?candidate:source;
    const relative=smaller?input.source.replace('./assets/','./assets/optimized/'):input.source;
    if(smaller){const file=assetFile(relative);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);}
    images.push({...input,original,output:{path:relative,bytes:bytes.length,sha256:imageHash(bytes),metadata:await imageMetadata(bytes)},decision:smaller?'Separate smaller encoding; source preserved.':'Candidate was not smaller; retained source bytes.'});
    console.log(input.id+': '+source.length+' -> '+bytes.length+' B'+(smaller?'':' (retained)'));
  }
  const totals=images.reduce((s,i)=>({sourceBytes:s.sourceBytes+i.original.bytes,deployableSourceBytes:s.deployableSourceBytes+(i.output?i.original.bytes:0),outputBytes:s.outputBytes+(i.output?.bytes||0),optimizedFiles:s.optimizedFiles+Number(Boolean(i.output&&i.output.path!==i.source))}),{sourceBytes:0,deployableSourceBytes:0,outputBytes:0,optimizedFiles:0});
  const manifest={schema:1,pass:'2026-10-23 single-HTML optimization',policy:'Never overwrite/delete the pre-pass image. Both source and smaller encoding stay in Git; no runtime transcoding or persistent build cache.',
    encoder:{sharp:sharp.versions.sharp,vips:sharp.versions.vips,webp:sharp.versions.webp,aom:sharp.versions.aom,heif:sharp.versions.heif},profiles:IMAGE_PROFILES,derivedProfiles:DERIVED_PROFILES,totals,images};
  await fs.writeFile(imageManifestFile,JSON.stringify(manifest,null,2)+'\n');
  await writeImageReview(manifest);
  console.log(JSON.stringify(totals));
}

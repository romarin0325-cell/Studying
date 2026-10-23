// Manual preparation only. Normal builds read the committed static and UI packs.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {assetFile} from './local-inputs.mjs';
import {imageInputs,derivedImageInputs,IMAGE_PROFILES,DERIVED_PROFILES} from './image-policy.mjs';
import {imageManifestFile,imageHash,imageMetadata,loadImagePack} from './image-pack.mjs';
import {writeImageReview} from './review-image-pack.mjs';

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const encoder=()=>({sharp:sharp.versions.sharp,vips:sharp.versions.vips,webp:sharp.versions.webp});

async function prepareDerived(manifest,previous){
  const derived=[],old=new Map((previous?.derived||[]).map(image=>[image.id,image]));
  const originals=new Map(manifest.images.map(image=>[image.source,image.original]));
  let encoded=0,reused=0;
  for(const input of derivedImageInputs()){
    const original=originals.get(input.source);
    if(!original)throw new Error('Unregistered UI source: '+input.source);
    const prior=old.get(input.id),profile=DERIVED_PROFILES[input.profile];
    if(prior){
      const {sourceSha256,output,...recipe}=prior;
      if(sourceSha256===original.sha256&&same(recipe,input)&&same(previous.derivedProfiles?.[input.profile],profile)&&same(previous.derivedEncoder,encoder())){
        try{
          const bytes=await fs.readFile(assetFile(input.destination));
          const meta=await imageMetadata(bytes);
          if(output.path===input.destination&&bytes.length===output.bytes&&imageHash(bytes)===output.sha256&&same(meta,output.metadata)&&
              meta.width===profile.width&&meta.height===profile.height&&meta.codec==='webp'){
            derived.push(prior);reused++;continue;
          }
        }catch(error){if(error.code&&error.code!=='ENOENT')throw error;}
      }
    }
    const source=await fs.readFile(assetFile(input.source));
    if(imageHash(source)!==original.sha256)throw new Error('UI source changed during preparation: '+input.source);
    let pipeline=sharp(source),crop=input.crop;
    if(crop?.columns){
      const width=original.metadata.width/crop.columns,height=original.metadata.height/crop.rows;
      if(!Number.isInteger(width)||!Number.isInteger(height)||crop.index<0||crop.index>=crop.columns*crop.rows)throw new Error('Invalid relic crop: '+input.id);
      crop={left:crop.index%crop.columns*width,top:Math.floor(crop.index/crop.columns)*height,width,height};
    }
    if(crop)pipeline=pipeline.extract(crop);
    const {width,height,...options}=profile;
    if(input.profile!=='figure'||width!==crop.width||height!==crop.height)pipeline=pipeline.resize(width,height,input.profile==='relic'?{fit:'contain'}:{});
    const bytes=await pipeline.webp(options).toBuffer(),file=assetFile(input.destination);
    await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);
    derived.push({...input,sourceSha256:original.sha256,output:{path:input.destination,bytes:bytes.length,sha256:imageHash(bytes),metadata:await imageMetadata(bytes)}});
    encoded++;
    if(encoded%24===0)console.log('Prepared UI images: '+encoded);
  }
  return {derived,encoded,reused};
}

if(process.argv.includes('--check')){
  const {manifest}=await loadImagePack();
  console.log('Preserved sources and optimized pack verified: '+manifest.images.length+' sources, '+manifest.derived.length+' UI images; no encoding.');
}else{
  let previous=null;
  try{previous=JSON.parse(await fs.readFile(imageManifestFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const derivedOnly=process.argv.includes('--derived-only');
  let manifest;
  if(derivedOnly)({manifest}=await loadImagePack({includeDerived:false}));
  else{
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
    manifest={schema:1,pass:'2026-10-23 single-HTML optimization',encoder:{...encoder(),aom:sharp.versions.aom,heif:sharp.versions.heif},profiles:IMAGE_PROFILES,totals,images};
  }
  const prepared=await prepareDerived(manifest,previous);
  manifest.policy='Preserve every pre-pass source. Commit smaller static encodings and fixed-path UI crops; normal builds validate/read them without encoding or cache repair.';
  manifest.derivedProfiles=DERIVED_PROFILES;manifest.derivedEncoder=encoder();manifest.derived=prepared.derived;
  manifest.totals.derivedFiles=prepared.derived.length;
  manifest.totals.derivedOutputBytes=prepared.derived.reduce((sum,image)=>sum+image.output.bytes,0);
  await fs.writeFile(imageManifestFile,JSON.stringify(manifest,null,2)+'\n');
  if(!derivedOnly)await writeImageReview(manifest);
  console.log(JSON.stringify({staticImages:manifest.images.length,derivedImages:prepared.derived.length,encoded:prepared.encoded,reused:prepared.reused,derivedBytes:manifest.totals.derivedOutputBytes}));
}

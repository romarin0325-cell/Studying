import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {gameRoot,assetFile} from './local-inputs.mjs';
import {imageInputs,derivedImageInputs,IMAGE_PROFILES,DERIVED_PROFILES} from './image-policy.mjs';

export const imageManifestFile=path.join(gameRoot,'docs/ASSET_OPTIMIZATION.json');
export const imageHash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const imageMetadata=async bytes=>{
  const m=await sharp(bytes).metadata();
  return {width:m.width,height:m.height,hasAlpha:Boolean(m.hasAlpha),codec:m.format==='heif'&&m.compression==='av1'?'avif':m.format};
};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const refresh='run node defense_test/scripts/optimize-images.mjs --derived-only and commit the UI files and manifest.';

// The manual preparation command can validate the static pack before refreshing UI crops.
// Every normal consumer also requires the complete, current derived pack.
export async function loadImagePack({includeDerived=true}={}){
  const manifest=JSON.parse(await fs.readFile(imageManifestFile,'utf8'));
  const expected=imageInputs();
  if(manifest.schema!==1||!same(manifest.profiles,IMAGE_PROFILES)||
      !same(manifest.images.map(({id,source,profile,uses})=>({id,source,profile,uses})),expected.map(({id,source,profile,uses})=>({id,source,profile,uses})))){
    throw new Error('Image inventory/settings changed; run node defense_test/scripts/optimize-images.mjs and commit its outputs.');
  }
  const bytesByPath=new Map(),sources=new Map();
  for(const image of manifest.images){
    const original=await fs.readFile(assetFile(image.source));
    if(original.length!==image.original.bytes||imageHash(original)!==image.original.sha256)throw new Error('Preserved image changed; refresh optimization: '+image.source);
    sources.set(image.source,image.original);
    bytesByPath.set(image.source,original);
    if(!image.output)continue;
    if(image.output.path!==image.source&&!image.output.path.startsWith('./assets/optimized/'))throw new Error('Optimized image must remain separate: '+image.id);
    const bytes=image.output.path===image.source?original:await fs.readFile(assetFile(image.output.path));
    if(bytes.length!==image.output.bytes||imageHash(bytes)!==image.output.sha256||bytes.length>original.length||
        !same(await imageMetadata(bytes),image.output.metadata))throw new Error('Optimized image mismatch: '+image.id);
    const m=image.output.metadata,originalMeta=image.original.metadata,profile=IMAGE_PROFILES[image.profile];
    const retained=image.output.path===image.source;
    if(m.width!==(!retained&&profile.width||originalMeta.width)||m.height!==(!retained&&profile.height||originalMeta.height)||m.hasAlpha!==originalMeta.hasAlpha||m.codec!==originalMeta.codec)throw new Error('Optimized dimensions, codec or alpha changed: '+image.id);
    bytesByPath.set(image.source,bytes);
  }
  const derivedBytes=new Map();
  if(includeDerived){
    const expectedDerived=derivedImageInputs();
    if(!same(manifest.derivedProfiles,DERIVED_PROFILES)||!Array.isArray(manifest.derived)||
        !same(manifest.derived.map(({sourceSha256,output,...recipe})=>recipe),expectedDerived)){
      throw new Error('Derived image inventory/settings changed; '+refresh);
    }
    for(const image of manifest.derived){
      const original=sources.get(image.source),profile=DERIVED_PROFILES[image.profile];
      if(!original||image.sourceSha256!==original.sha256||image.output?.path!==image.destination){
        throw new Error('Derived image source/recipe changed: '+image.id+'; '+refresh);
      }
      let bytes;
      try{bytes=await fs.readFile(assetFile(image.destination));}
      catch(error){if(error.code!=='ENOENT')throw error;throw new Error('Prepared UI image is missing: '+image.id+'; '+refresh);}
      const m=await imageMetadata(bytes);
      if(bytes.length!==image.output.bytes||imageHash(bytes)!==image.output.sha256||!same(m,image.output.metadata)||
          m.codec!=='webp'||m.width!==profile.width||m.height!==profile.height){
        throw new Error('Prepared UI image mismatch: '+image.id+'; '+refresh);
      }
      derivedBytes.set(image.id,bytes);
    }
  }
  return {manifest,
    read(source){const bytes=bytesByPath.get(source);if(!bytes)throw new Error('Unregistered image: '+source);return bytes;},
    readDerived(id){const bytes=derivedBytes.get(id);if(!bytes)throw new Error('Unregistered prepared UI image: '+id);return bytes;},
  };
}

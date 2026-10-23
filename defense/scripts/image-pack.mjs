import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {gameRoot,assetFile} from './local-inputs.mjs';
import {imageInputs,IMAGE_PROFILES,DERIVED_PROFILES} from './image-policy.mjs';

export const imageManifestFile=path.join(gameRoot,'docs/ASSET_OPTIMIZATION.json');
export const imageHash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const imageMetadata=async bytes=>{
  const m=await sharp(bytes).metadata();
  return {width:m.width,height:m.height,hasAlpha:Boolean(m.hasAlpha),codec:m.format==='heif'&&m.compression==='av1'?'avif':m.format};
};

export async function loadImagePack(){
  const manifest=JSON.parse(await fs.readFile(imageManifestFile,'utf8'));
  const expected=imageInputs();
  if(manifest.schema!==1||JSON.stringify(manifest.profiles)!==JSON.stringify(IMAGE_PROFILES)||JSON.stringify(manifest.derivedProfiles)!==JSON.stringify(DERIVED_PROFILES)||
      JSON.stringify(manifest.images.map(({id,source,profile,uses})=>({id,source,profile,uses})))!==JSON.stringify(expected.map(({id,source,profile,uses})=>({id,source,profile,uses})))){
    throw new Error('Image inventory/settings changed; run node defense/scripts/optimize-images.mjs and commit its outputs.');
  }
  const bytesByPath=new Map();
  for(const image of manifest.images){
    const original=await fs.readFile(assetFile(image.source));
    if(original.length!==image.original.bytes||imageHash(original)!==image.original.sha256)throw new Error('Preserved image changed; refresh optimization: '+image.source);
    bytesByPath.set(image.source,original);
    if(!image.output)continue;
    if(image.output.path!==image.source&&!image.output.path.startsWith('./assets/optimized/'))throw new Error('Optimized image must remain separate: '+image.id);
    const bytes=image.output.path===image.source?original:await fs.readFile(assetFile(image.output.path));
    if(bytes.length!==image.output.bytes||imageHash(bytes)!==image.output.sha256||bytes.length>original.length||
        JSON.stringify(await imageMetadata(bytes))!==JSON.stringify(image.output.metadata))throw new Error('Optimized image mismatch: '+image.id);
    const m=image.output.metadata,originalMeta=image.original.metadata,profile=IMAGE_PROFILES[image.profile];
    const retained=image.output.path===image.source;
    if(m.width!==(!retained&&profile.width||originalMeta.width)||m.height!==(!retained&&profile.height||originalMeta.height)||m.hasAlpha!==originalMeta.hasAlpha||m.codec!==originalMeta.codec)throw new Error('Optimized dimensions, codec or alpha changed: '+image.id);
    bytesByPath.set(image.source,bytes);
  }
  return {manifest,read(source){const bytes=bytesByPath.get(source);if(!bytes)throw new Error('Unregistered image: '+source);return bytes;}};
}

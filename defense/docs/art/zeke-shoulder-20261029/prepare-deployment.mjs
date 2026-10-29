// Prepare only this changed static atlas. Unchanged inventory entries are retained.
import fs from'node:fs/promises';import path from'node:path';import sharp from'sharp';
import{imageInputs,IMAGE_PROFILES}from'../../../scripts/image-policy.mjs';
import{imageManifestFile,imageHash,imageMetadata}from'../../../scripts/image-pack.mjs';
import{assetFile}from'../../../scripts/local-inputs.mjs';
const manifest=JSON.parse(await fs.readFile(imageManifestFile,'utf8')),input=imageInputs().find(i=>i.id==='atlas:unit-zeke');
if(input.source!=='./assets/cast-v2/zeke-shoulder.webp')throw Error('Unexpected selected Zeke');
const source=await fs.readFile(assetFile(input.source)),profile=IMAGE_PROFILES[input.profile],{codec,width,height,...options}=profile;
const bytes=await sharp(source).resize(width,height)[codec](options).toBuffer(),destination=input.source.replace('./assets/','./assets/optimized/');
await fs.mkdir(path.dirname(assetFile(destination)),{recursive:true});await fs.writeFile(assetFile(destination),bytes);
const record={...input,original:{bytes:source.length,sha256:imageHash(source),metadata:await imageMetadata(source)},output:{path:destination,bytes:bytes.length,sha256:imageHash(bytes),metadata:await imageMetadata(bytes)},decision:'Separate smaller encoding; source preserved.'};
const index=manifest.images.findIndex(i=>i.id===input.id);if(index<0)throw Error('Missing prior manifest row');manifest.images[index]=record;
Object.assign(manifest.totals,manifest.images.reduce((s,i)=>({sourceBytes:s.sourceBytes+i.original.bytes,deployableSourceBytes:s.deployableSourceBytes+(i.output?i.original.bytes:0),outputBytes:s.outputBytes+(i.output?.bytes||0),optimizedFiles:s.optimizedFiles+Number(Boolean(i.output&&i.output.path!==i.source))}),{sourceBytes:0,deployableSourceBytes:0,outputBytes:0,optimizedFiles:0}));
await fs.writeFile(imageManifestFile,JSON.stringify(manifest,null,2)+'\n');console.log({original:source.length,optimized:bytes.length});


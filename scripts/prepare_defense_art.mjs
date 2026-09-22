import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ASSET_MANIFEST } from '../defense/js/content/assets.js';

const root=fileURLToPath(new URL('../defense/',import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');
const CACHE_VERSION=1;

async function processorFingerprint() {
  // Text normalization permits reuse after Windows/Linux Git checkout.
  const policyFiles=['prepare_defense_art.mjs','import_defense_sprite.mjs','pack_defense_poses.mjs','pack_defense_bosses.mjs'];
  const sources=await Promise.all(policyFiles.map(async file=>(await readFile(new URL(file,import.meta.url),'utf8')).replace(/\r\n/g,'\n')));
  const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
  const sharpVersion=lock.packages['node_modules/sharp'].version;
  return hash(JSON.stringify({version:CACHE_VERSION,sharp:sharpVersion,sources}));
}

async function inspectAlpha(input) {
  const {default:sharp}=await import('sharp');
  const metadata=await sharp(input).metadata();
  const stats=await sharp(input).stats();
  return {hasAlpha:Boolean(metadata.hasAlpha),minimumAlpha:stats.channels[3]?.min??255,
    width:metadata.width,height:metadata.height};
}

function insideRoot(appRoot,relative) {
  const file=path.resolve(appRoot,relative), rel=path.relative(appRoot,file);
  if(rel==='..' || rel.startsWith('..'+path.sep) || path.isAbsolute(rel)) throw new Error('Asset escapes defense: '+relative);
  return file;
}

// Prepared WebPs already live in Git. Cache their validated content hashes,
// never a second copy of the same binary or a runtime background-removal result.
export async function prepareArt({appRoot=root,manifest=ASSET_MANIFEST,
  cachePath=path.join(appRoot,'assets','prepared-manifest.json'),
  processorHash=null,checkOnly=false,force=false,inspect=inspectAlpha,quiet=false}={}) {
  processorHash??=await processorFingerprint();
  let previous=null;
  try { previous=JSON.parse(await readFile(cachePath,'utf8')); }
  catch(error) { if(error.code!=='ENOENT' && !(error instanceof SyntaxError)) throw error; }
  const reusable=!force && previous?.version===CACHE_VERSION && previous.processorHash===processorHash;
  const files={}; let checked=0,reused=0,decoded=0;
  const entries=[...manifest].sort((a,b)=>a.path.localeCompare(b.path,'en'));
  for(const entry of entries) {
    const input=await readFile(insideRoot(appRoot,entry.path));
    const sourceHash=hash(input), old=previous?.files?.[entry.path];
    const record={sourceHash,bytes:input.length,requiresAlpha:Boolean(entry.hasAlpha)};
    if(entry.hasAlpha) {
      checked++;
      if(reusable && old?.sourceHash===sourceHash && old.requiresAlpha===true
        && old.hasAlpha===true && old.minimumAlpha===0 && old.width>0 && old.height>0) {
        Object.assign(record,{hasAlpha:true,minimumAlpha:0,width:old.width,height:old.height}); reused++;
      } else {
        const result=await inspect(input,entry); decoded++;
        if(!result.hasAlpha || result.minimumAlpha!==0) throw new Error('Unprepared opaque release asset: '+entry.id+'. Author a reviewed transparent asset; do not key white hair.');
        Object.assign(record,result);
      }
    }
    files[entry.path]=record;
  }
  const sourceHash=hash(JSON.stringify(Object.entries(files).map(([file,record])=>[file,record.sourceHash,record.requiresAlpha])));
  const next={version:CACHE_VERSION,sourceHash,processorHash,fileCount:entries.length,files};
  const serialized=JSON.stringify(next,null,2)+'\n';
  const changed=JSON.stringify(previous)!==JSON.stringify(next);
  if(changed && !checkOnly) {
    await mkdir(path.dirname(cachePath),{recursive:true});
    const temporary=cachePath+'.'+randomUUID()+'.tmp';
    try { await writeFile(temporary,serialized); await rename(temporary,cachePath); }
    finally { await unlink(temporary).catch(error=>{if(error.code!=='ENOENT') throw error;}); }
  }
  if(!quiet) console.log('Defense alpha assets: '+checked+' checked; '+reused+' reused, '+decoded+' decoded');
  return {checked,reused,decoded,sourceHash,processorHash,cacheChanged:changed};
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  await prepareArt({checkOnly:process.argv.includes('--check'),force:process.argv.includes('--force')});

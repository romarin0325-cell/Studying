import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ASSET_MANIFEST } from '../defense/js/content/assets.js';
const root = fileURLToPath(new URL('../defense/', import.meta.url));

// Release validation never edits artwork. Opaque sprites must go through reviewed authoring.
export async function prepareArt() {
  let checked=0;
  for(const entry of ASSET_MANIFEST.filter(e=>e.hasAlpha)){
    const file=path.resolve(root,entry.path);
    const input=await readFile(file), metadata=await sharp(input).metadata();
    const stats=await sharp(input).stats();
    if(metadata.hasAlpha && stats.channels[3]?.min===0){checked++;continue;}
    throw new Error('Unprepared opaque release asset: '+entry.id+'. Author a reviewed transparent asset; do not key white hair.');
  }
  console.log('Defense alpha assets: '+checked+' checked');
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  await prepareArt({checkOnly:process.argv.includes('--check')});
}

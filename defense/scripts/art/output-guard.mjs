// Where the SD packers may write. Everything under defense/assets is a committed original (unit atlases and
// their manifest.json, gifts.webp, greenhouse.webp, ...) or a generated deployment pack, and the packers write
// <id>.webp, manifest.json, source.png and proof PNGs by fixed names. Pack into a review directory
// (defense/test-results/... or a temp folder), check it, then copy deliberately (pack-sd.mjs --install).
// No sharp import here, so the unit test runs without installed dependencies.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const PROTECTED_DIR=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../assets');

// Real path of the deepest existing ancestor plus the part mkdir would create: a symlink or junction anywhere
// in the path is followed, so a link that leads into assets/ is caught before anything is written.
function realTarget(dir){
  let existing=path.resolve(dir);const tail=[];
  for(;;){
    try{return path.join(fs.realpathSync.native(existing),...tail);}
    catch(error){
      if(error.code!=='ENOENT')throw error;
      let dangling=false;try{fs.lstatSync(existing);dangling=true;}catch{}
      if(dangling)throw new Error(`Refusing to write through ${existing}: it is a link whose target does not exist.`);
      const parent=path.dirname(existing);
      if(parent===existing)throw error;
      tail.unshift(path.basename(existing));existing=parent;
    }
  }
}

export function assertSafeOutputDir(dir,label='output'){
  if(typeof dir!=='string'||!dir)throw new Error(`An ${label} directory is required.`);
  const target=realTarget(dir),protectedDir=fs.realpathSync.native(PROTECTED_DIR);
  const rel=path.relative(protectedDir,target);
  if(rel===''||(!rel.startsWith('..')&&!path.isAbsolute(rel)))throw new Error(`Refusing to write the ${label} into ${target}: defense/assets holds committed originals and deployment packs. Pack into a review directory (for example defense/test-results/sd-pack) and copy after review.`);
  return target;
}

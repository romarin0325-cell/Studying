import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Offline authoring only. Both source trios use equal square cells and the same
// painted head scale. Preserve those scales instead of auto-fitting each body.
const [temples,wilds,root='defense/assets']=process.argv.slice(2);
if(!temples || !wilds) throw new Error('Usage: pack_defense_bosses temples-keyed wilds-keyed [asset-root]');
const ids=['artificial_demon','love_iris','curse_iris','flora','poseidon','beelzebub'];
const layers=[];
for(const [row,input] of [temples,wilds].entries()) {
  const meta=await sharp(input).metadata();
  if(meta.width!==meta.height*3 || !meta.hasAlpha) throw new Error('Boss source must contain three alpha square cells');
  for(let column=0;column<3;column++) {
    const cell=await sharp(input).extract({left:column*meta.height,top:0,width:meta.height,height:meta.height})
      .resize(512,512).webp({quality:94,alphaQuality:100}).toBuffer();
    layers.push({input:cell,left:column*512,top:row*512});
    const folder=path.join(root,'bosses',ids[row*3+column]);
    await mkdir(folder,{recursive:true});
    const fallback=await sharp(cell).resize(256,256).webp({quality:90,alphaQuality:100}).toBuffer();
    for(const direction of ['front','back','left','right']) await writeFile(path.join(folder,direction+'.webp'),fallback);
  }
}
await mkdir(path.join(root,'moonlit'),{recursive:true});
await sharp({create:{width:1536,height:1024,channels:4,background:'#00000000'}})
  .composite(layers).webp({quality:94,alphaQuality:100}).toFile(path.join(root,'moonlit','realm-bosses.webp'));
console.log('Packed six bosses with one source-cell scale and 24 idle-direction fallbacks.');

import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const DEFENSE=path.resolve(HERE,'../..');
const SOURCE_DIR=path.join(DEFENSE,'docs/art/expansion-vfx-20261123/sources');
const OUTPUT_DIR=path.join(DEFENSE,'assets/merge');
const TIERS=['ur','sr','r','c'];
const SOURCE_CELL=444;
const CELL=256;
const ROW_CUT=340;

function alphaBounds(data,width,height,threshold=24){
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(data[(y*width+x)*4+3]<threshold)continue;
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  if(right<left||bottom<top)throw new Error('empty VFX frame after alpha threshold');
  return {left,top,width:right-left+1,height:bottom-top+1};
}

async function frameLayer(source,row,column){
  // The generated glow can intentionally bridge the invisible row line. Split
  // at a quiet band, then derive each motif's alpha bounds so attack and
  // ultimate art can never leak into one another's atlas frame.
  const regionTop=row===0?0:ROW_CUT;
  const regionHeight=row===0?ROW_CUT:SOURCE_CELL*2-ROW_CUT;
  const region=await sharp(source)
    .extract({left:column*SOURCE_CELL,top:regionTop,width:SOURCE_CELL,height:regionHeight})
    .png().toBuffer();
  const {data,info}=await sharp(region).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const bounds=alphaBounds(data,info.width,info.height);
  const maxWidth=row===0?224:220;
  const maxHeight=row===0?144:220;
  const cropped=await sharp(region).extract(bounds)
    .resize({width:maxWidth,height:maxHeight,fit:'inside',kernel:sharp.kernel.lanczos3})
    .png().toBuffer();
  const meta=await sharp(cropped).metadata();
  return {
    input:cropped,
    left:column*CELL+Math.round((CELL-meta.width)/2),
    top:row*CELL+Math.round((CELL-meta.height)/2),
  };
}

for(const tier of TIERS){
  const sourcePath=path.join(SOURCE_DIR,`${tier}-source.png`);
  // Image generation emits a precise 2:1 sheet at 1774×887. Normalize the
  // half-pixel grid once so every source frame has an integer 444×444 crop.
  const source=await sharp(sourcePath).resize(1776,888,{fit:'fill',kernel:sharp.kernel.lanczos3}).png().toBuffer();
  const layers=[];
  for(let row=0;row<2;row++)for(let column=0;column<4;column++)layers.push(await frameLayer(source,row,column));
  await sharp({create:{width:CELL*4,height:CELL*2,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
    .composite(layers)
    .webp({quality:94,alphaQuality:100,effort:6,smartSubsample:true})
    .toFile(path.join(OUTPUT_DIR,`effects-card-expansion-${tier}.webp`));
}

console.log(`built ${TIERS.length} expansion VFX atlases (${CELL*4}x${CELL*2}, 4x2)`);

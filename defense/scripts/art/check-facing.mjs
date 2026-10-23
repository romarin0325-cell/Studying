// Checks that every unit atlas faces outward: the LEFT cell (index 2) must face the viewer's left, the RIGHT cell (index 3) the right.
//   node defense/scripts/art/check-facing.mjs [--fix id,id] [--mirror id,id]
// Check 1 (reversedUnits): the score is the skin-tone centroid minus the head centroid in the upper half of the figure (negative = faces left):
// the face sits on the front side of a profile head and the hair behind it. Characters whose face is hidden (bangs) or frontal give weak
// scores; they are listed in CHECKED_BY_EYE after looking at them one by one.
// Check 2 (notMirrored): needs no skin tones. The RIGHT cell must match the mirrored LEFT cell at least as well as the unmirrored one
// (a prop held in one hand may differ, so only the order is tested). This catches a sheet whose two profile views face the same way, which
// the first check cannot see for a character whose face is hidden (Antropy).
// --fix swaps the left and right cells of the named atlases; --mirror rebuilds the RIGHT cell as the mirror image of the LEFT cell.
import sharp from 'sharp';
sharp.cache(false); // Windows keeps cached files open and the rename then fails with EPERM
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ASSET_PATHS} from '../../src/content.js';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
// Follow the actual game's atlas inventory, including transformations. Retained
// pre-pass paintings may no longer be the installed art and must not be checked instead.
const UNIT_FILES=new Map(Object.entries(ASSET_PATHS).filter(([id])=>id.startsWith('unit-')).map(([id,source])=>[id.slice(5),path.resolve(repo,'defense',source)]));
export const CHECKED_BY_EYE=Object.freeze(['behemoth','queen','toffee_apple','venom']);
const skin=(r,g,b)=>r>190&&g>130&&b>100&&r-b>28&&r-b<110&&r>=g&&g>=b-12;
const cell=n=>({left:(n%2)*512,top:Math.floor(n/2)*512,width:512,height:512});
const ids=()=>[...UNIT_FILES.keys()].sort();
const rgba=async(id,n)=>sharp(UNIT_FILES.get(id)).extract(cell(n)).ensureAlpha().raw().toBuffer();
export async function facingScore(id,n){
  const data=await rgba(id,n);
  let top=512,bottom=0;
  for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(data[(y*512+x)*4+3]>40){top=Math.min(top,y);bottom=Math.max(bottom,y);}
  const limit=top+Math.round((bottom-top)*.5);let sx=0,sn=0,hx=0,hn=0;
  for(let y=top;y<limit;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4;if(data[i+3]<40)continue;hx+=x;hn++;if(skin(data[i],data[i+1],data[i+2])){sx+=x;sn++;}}
  return sn>60?sx/sn-hx/hn:null;
}
export async function reversedUnits(){
  const out=[];
  for(const id of ids()){if(CHECKED_BY_EYE.includes(id))continue;const l=await facingScore(id,2),r=await facingScore(id,3);if((l!==null&&l>1.5)||(r!==null&&r<-1.5))out.push({id,l,r});}
  return out;
}
export async function notMirrored(){
  const out=[];
  for(const id of ids()){
    const L=await rgba(id,2),R=await rgba(id,3);let same=0,mirror=0,total=0;
    for(let y=0;y<512;y+=2)for(let x=0;x<512;x+=2){const a=L[(y*512+x)*4+3]>40,b=R[(y*512+x)*4+3]>40,c=R[(y*512+(511-x))*4+3]>40;if(a||b){total++;if(a===b)same++;if(a===c)mirror++;}}
    if(mirror<same)out.push({id,same:same/total,mirror:mirror/total});
  }
  return out;
}
async function rebuild(id,cells){
  const file=UNIT_FILES.get(id);if(!file)throw new Error('Unknown installed unit '+id);
  const base=await sharp({create:{width:1024,height:1024,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(cells.map((input,n)=>({input,left:(n%2)*512,top:Math.floor(n/2)*512}))).png().toBuffer();
  await sharp(base).webp({quality:95,alphaQuality:100,effort:6}).toFile(file+'.tmp');fs.renameSync(file+'.tmp',file);
}
const parts=async id=>Promise.all([0,1,2,3].map(n=>sharp(UNIT_FILES.get(id)).extract(cell(n)).png().toBuffer()));
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const arg=name=>process.argv.includes(name)?process.argv[process.argv.indexOf(name)+1].split(','):[];
  for(const id of arg('--fix')){const [c0,c1,c2,c3]=await parts(id);await rebuild(id,[c0,c1,c3,c2]);console.log('swapped left/right cells of',id);}
  for(const id of arg('--mirror')){const [c0,c1,c2]=await parts(id);await rebuild(id,[c0,c1,c2,await sharp(c2).flop().png().toBuffer()]);console.log('right cell rebuilt as the mirror of the left cell:',id);}
  const bad=await reversedUnits(),unmirrored=await notMirrored();
  if(unmirrored.length){console.log('right cell is not the mirror of the left cell:',unmirrored.map(u=>`${u.id} (same ${u.same.toFixed(2)}, mirror ${u.mirror.toFixed(2)})`).join(', '));process.exitCode=1;}
  if(bad.length){console.log('facing reversed:',bad.map(b=>`${b.id} (L ${b.l?.toFixed(1)}, R ${b.r?.toFixed(1)})`).join(', '));process.exitCode=1;}
  if(!process.exitCode)console.log('every checked unit faces outward');
}

// One-image reference board for image tools that take a single attachment (docs/GPT_IMAGE_SD_BRIEF.md §3).
//   node defense/scripts/art/ref-board.mjs <master id> <original image> <face> <out.png>
// <face> is either a close-up image file or a crop box of the original as fractions "x,y,w,h" (the §3 table).
// LEFT panel = Image 1 (approved unit atlas on flat #FF00FF), MIDDLE = Image 2 (original), RIGHT = Image 3 (face).
// Every panel is 1024 px tall, fitted without cropping on white, with white gaps. No labels: the prompt names panels by position.
import sharp from 'sharp';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const [master,original,face,out]=process.argv.slice(2);
if(!master||!original||!face||!out)throw new Error('Usage: ref-board.mjs <master id> <original> <face file | x,y,w,h> <out.png>');
const H=1024,GAP=48,WHITE={r:255,g:255,b:255,alpha:1};
const atlas=path.join(repo,'defense/assets/merge/units',`${master}.webp`);
async function faceImage(){
  const box=face.split(',').map(Number);
  if(box.length!==4||box.some(n=>!Number.isFinite(n)))return sharp(face).flatten({background:'#ffffff'}).png().toBuffer();
  if(box.some(n=>n<0||n>1))throw new Error('Face box fractions must be between 0 and 1');
  const {width,height}=await sharp(original).metadata();
  const left=Math.round(box[0]*width),top=Math.round(box[1]*height);
  const w=Math.min(width-left,Math.round(box[2]*width)),h=Math.min(height-top,Math.round(box[3]*height));
  return sharp(original).extract({left,top,width:w,height:h}).flatten({background:'#ffffff'}).png().toBuffer();
}
const panels=[
  await sharp(atlas).flatten({background:'#ff00ff'}).resize(H,H).png().toBuffer(),
  await sharp(original).flatten({background:'#ffffff'}).resize({height:H}).png().toBuffer(),
  await sharp(await faceImage()).resize(H,H,{fit:'contain',background:WHITE}).png().toBuffer(),
];
const widths=await Promise.all(panels.map(async p=>(await sharp(p).metadata()).width));
const W=widths.reduce((a,w)=>a+w,0)+GAP*4;
let x=GAP;const layers=panels.map((p,i)=>{const l={input:p,left:x,top:GAP};x+=widths[i]+GAP;return l;});
await sharp({create:{width:W,height:H+GAP*2,channels:3,background:WHITE}}).composite(layers).png().toFile(out);
console.log(out,`${W}x${H+GAP*2}`,'panels',widths.join(','));

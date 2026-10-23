// Packs a generated 2x2 SD sheet (down/up/left/right on flat magenta) into a 1024x1024 unit atlas with the
// repository's anatomical packer: head scaled by front-skull area to 160x150, feet on (256,480), no auto-fit.
//   node defense/scripts/art/pack-sd.mjs <sheet.png|jpg> <outDir> <id> <left,top,right,chin> [--install]
// Feet are measured from the keyed silhouette (lowest painted rows, centre of the soles). After packing, the
// anti-aliased rim is despilled (magenta left by JPEG/keying turns the navy outline purple).
// --install copies the atlas to defense/assets/merge/units/<id>.webp. Always review first (lineup, metrics).
import sharp from 'sharp';
sharp.cache(false); // Windows keeps cached files open and the despill rename then fails with EPERM
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const {packDirections}=await import('./pack_defense_directions.mjs');
const {keySpritePixels}=await import('./import_defense_sprite.mjs');
const {assertSafeOutputDir}=await import('./output-guard.mjs');
const [src,outDir,id,skullArg]=process.argv.slice(2);
if(!src||!outDir||!id||!skullArg)throw new Error('Usage: pack-sd.mjs <sheet> <outDir> <id> <left,top,right,chin> [--install]');
assertSafeOutputDir(outDir); // before any write: outDir (also the proof dir) must stay outside defense/assets
await fs.mkdir(outDir,{recursive:true});
// Exact magenta corners: the packer refuses painted checkerboards and JPEG noise breaks its corner test.
const {data,info}=await sharp(src).removeAlpha().raw().toBuffer({resolveWithObject:true});
for(let i=0;i<data.length;i+=3){const r=data[i],g=data[i+1],b=data[i+2];if(r>200&&b>200&&g<70&&Math.abs(r-b)<60){data[i]=255;data[i+1]=0;data[i+2]=255;}}
const pngPath=path.join(outDir,'source.png');await sharp(data,{raw:{width:info.width,height:info.height,channels:3}}).png().toFile(pngPath);
const bytes=await fs.readFile(pngPath),sha=createHash('sha256').update(bytes).digest('hex');
const rgba=await sharp(pngPath).ensureAlpha().raw().toBuffer();keySpritePixels(rgba,info.width,info.height);
const W=info.width/2,H=info.height/2,feet=[];
for(let v=0;v<4;v++){const ox=(v%2)*W,oy=Math.floor(v/2)*H;let bottom=-1;
  for(let y=H-1;y>=0&&bottom<0;y--)for(let x=0;x<W;x++)if(rgba[((oy+y)*info.width+ox+x)*4+3]>128){bottom=y;break;}
  let sum=0,n=0;for(let y=bottom-25;y<=bottom;y++)for(let x=0;x<W;x++)if(rgba[((oy+y)*info.width+ox+x)*4+3]>128){sum+=x;n++;}
  feet.push([Math.round(sum/n),bottom]);}
const skull=skullArg.split(',').map(Number);
const entry={id,file:'source.png',sourceSha256:sha,anatomy:{skull,note:'Manual estimate of the front skull excluding hair volume, horns and headgear.'},feet,face:[Math.round((skull[0]+skull[2])/2),Math.round((skull[1]+skull[3])/2)]};
const [packed]=await packDirections({sourceDir:outDir,entries:[entry],outputDir:outDir,proofDir:outDir});
// Rim despill: red and blue both above green next to transparency -> pull red down toward the navy outline.
const atlas=path.join(outDir,`${id}.webp`);
{const {data:px,info:ai}=await sharp(atlas).ensureAlpha().raw().toBuffer({resolveWithObject:true});const w=ai.width,h=ai.height,A=i=>px[i*4+3];
 const near=(x,y)=>{for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h||A(yy*w+xx)<40)return true;}return false;};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!A(i)||!near(x,y))continue;const r=px[i*4],g=px[i*4+1],b=px[i*4+2],lim=g+10;if(r>lim&&b>lim&&b>=r*.8)px[i*4]=Math.round(lim+(r-lim)*.2);}
 await sharp(px,{raw:{width:w,height:h,channels:4}}).webp({quality:95,alphaQuality:100,effort:6}).toFile(atlas+'.tmp');await fs.rename(atlas+'.tmp',atlas);}
await fs.writeFile(path.join(outDir,'entry.json'),JSON.stringify(entry,null,1));
const a=packed.anatomy;console.log(JSON.stringify({head:[a.headWidth,a.headHeight],packedSkull:a.packedSkull,bodyBelowChin:a.bodyBelowChin,portrait:{x:Math.round((a.packedSkull[0]+a.packedSkull[2])/2),y:Math.round((a.packedSkull[1]+a.packedSkull[3])/2),size:250},feet}));
if(process.argv.includes('--install')){await fs.copyFile(atlas,path.join(repo,'defense/assets/merge/units',`${id}.webp`));console.log('installed',id);}

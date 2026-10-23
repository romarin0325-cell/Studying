// Consistency review of one SD unit atlas against the cast (docs/ASSET_PIPELINE.md §3).
//   node defense/scripts/art/review-sd.mjs <atlas.webp> <id> <packedSkull l,t,r,b> <heightClass tall|medium|short> [outDir]
// Prints geometry and style numbers next to the cast range and writes same-scale review sheets:
// lineup-256.png / lineup-96.png (shared baseline, no per-character fitting), heads.png (faces at 1:1).
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const UNITS=path.join(repo,'defense/assets/merge/units');
const [atlas,id,skullArg,cls,outDir=path.join(repo,'defense/test-results/art-review')]=process.argv.slice(2);
if(!atlas||!id||!skullArg||!cls)throw new Error('Usage: review-sd.mjs <atlas.webp> <id> <l,t,r,b> <tall|medium|short> [outDir]');
fs.mkdirSync(outDir,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(repo,'defense/docs/art/units-manifest.json'),'utf8')).frames;
const classes=JSON.parse(fs.readFileSync(path.join(repo,'defense/docs/art/HEAD_PROFILE.json'),'utf8')).heightClasses;
async function measure(file,skull){
  const {data}=await sharp(file).extract({left:0,top:0,width:512,height:512}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const A=i=>data[i*4+3],lum=i=>(.2126*data[i*4]+.7152*data[i*4+1]+.0722*data[i*4+2])/255;let n=0,L=0,S=0,dark=0,edge=0,top=512,ol=[0,0,0],oln=0;
  for(let y=1;y<511;y++)for(let x=1;x<511;x++){const i=y*512+x;if(A(i)<200)continue;n++;top=Math.min(top,y);
    const r=data[i*4]/255,g=data[i*4+1]/255,b=data[i*4+2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;L+=l;S+=mx===mn?0:(mx-mn)/(1-Math.abs(2*l-1));
    if([i-2,i+2,i-1024,i+1024].some(j=>A(j)<40)){ol[0]+=data[i*4];ol[1]+=data[i*4+1];ol[2]+=data[i*4+2];oln++;}
    else{if(l<.16)dark++;if(Math.hypot(lum(i+1)-lum(i-1),lum(i+512)-lum(i-512))>.18)edge++;}}
  const inner=n-oln;
  return {headW:skull[2]-skull[0],headH:skull[3]-skull[1],skullTop:skull[1],body:480-skull[3],silhouette:480-top,lightness:L/n,saturation:S/n,dark:dark/inner,edge:edge/inner,outline:ol.map(v=>Math.round(v/oln))};
}
const rows=[];for(const f of manifest){if(f.id===id||!f.anatomy?.packedSkull||!fs.existsSync(path.join(UNITS,f.id+'.webp')))continue;rows.push({id:f.id,cls:classes[f.id],...await measure(path.join(UNITS,f.id+'.webp'),f.anatomy.packedSkull)});}
const me=await measure(atlas,skullArg.split(',').map(Number));
const fmt=v=>Number.isInteger(v)?String(v):v.toFixed(3);
const line=(k,set)=>{const v=set.map(r=>r[k]),min=Math.min(...v),max=Math.max(...v),avg=v.reduce((a,b)=>a+b,0)/v.length,ok=me[k]>=min&&me[k]<=max;return `${k.padEnd(11)} ${fmt(me[k]).padStart(7)}  cast ${fmt(min)}..${fmt(max)} (avg ${fmt(avg)}) ${ok?'ok':'OUT OF RANGE'}`;};
console.log(`== ${id} · geometry (all cast)`);for(const k of ['headW','headH','silhouette'])console.log(line(k,rows));
console.log(`== geometry within height class "${cls}"`);for(const k of ['skullTop','body'])console.log(line(k,rows.filter(r=>r.cls===cls)));
console.log('== style (all cast)');for(const k of ['lightness','saturation','dark','edge'])console.log(line(k,rows));
console.log(`outline rgb ${me.outline.join(',')} (cast is near-black navy; a purple rim means magenta spill)`);
// Review sheets: same scale, same baseline. Never fit each character to its own cell.
const peers=['zeke','red_dragon','flame_sage','storm_sage','ancient_dragon','rumi','guardian','doom'].filter(p=>p!==id);
for(const px of [256,96]){const layers=[];const all=[atlas,...peers.map(p=>path.join(UNITS,p+'.webp'))];
  for(const [i,f] of all.entries())layers.push({input:await sharp(await sharp(f).extract({left:0,top:0,width:512,height:512}).png().toBuffer()).resize(px,px).png().toBuffer(),left:i*px,top:0});
  const W=all.length*px,y=Math.round(480/512*px);
  await sharp({create:{width:W,height:px,channels:4,background:'#e9e3d6'}}).composite([...layers,{input:Buffer.from(`<svg width="${W}" height="${px}"><line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#ff4d6d"/></svg>`),left:0,top:0}]).png().toFile(path.join(outDir,`${id}-lineup-${px}.png`));}
{const all=[atlas,...peers.slice(0,4).map(p=>path.join(UNITS,p+'.webp'))],layers=[];
  for(const [i,f] of all.entries())layers.push({input:await sharp(await sharp(f).extract({left:0,top:0,width:512,height:512}).png().toBuffer()).extract({left:116,top:60,width:280,height:280}).png().toBuffer(),left:i*280,top:0});
  await sharp({create:{width:all.length*280,height:280,channels:4,background:'#e9e3d6'}}).composite(layers).png().toFile(path.join(outDir,`${id}-heads.png`));}
console.log('review sheets in',outDir);

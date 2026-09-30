import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=process.argv[2],out=fileURLToPath(new URL('../assets/merge/',import.meta.url));
if(!dir)throw new Error('Supply the expansion PNG source directory.');
const hash=b=>createHash('sha256').update(b).digest('hex'),records=[];
async function input(id){const bytes=await readFile(path.join(dir,id+'.png'));return {bytes,meta:await sharp(bytes).metadata(),sourceSha256:hash(bytes)};}
async function save(id,buffer,record){await writeFile(path.join(out,id+'.webp'),buffer);records.push({id,file:id+'.webp',sha256:hash(buffer),bytes:buffer.length,...record});}
const bosses=[
  {id:'thor',skull:[450,284,871,694],feet:[660,1230]},
  {id:'ares',skull:[370,250,825,684],feet:[620,1260]},
  {id:'astea',skull:[424,315,854,740],feet:[643,1190]},
],layers=[];
for(let i=0;i<bosses.length;i++){
  const b=bosses[i],s=await input(b.id),scale=Math.sqrt(160*150/((b.skull[2]-b.skull[0])*(b.skull[3]-b.skull[1])));
  const {data,info}=await sharp(s.bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let p=3;p<data.length;p+=4)if(data[p]>=250)data[p]=255;
  const w=Math.round(info.width*scale),h=Math.round(info.height*scale);
  let resized=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).resize(w,h).png().toBuffer();
  const x=Math.round(256-b.feet[0]*scale),y=Math.round(480-b.feet[1]*scale);
  const l=Math.max(0,-x),t=Math.max(0,-y),r=Math.min(w,512-x),bottom=Math.min(h,512-y);
  const rgba=await sharp(resized).ensureAlpha().raw().toBuffer();
  for(let py=0;py<h;py++)for(let px=0;px<w;px++)if((px<l||px>=r||py<t||py>=bottom)&&rgba[(py*w+px)*4+3]>8)throw new Error(b.id+' would clip; correct padding, never silhouette-fit the head');
  if(l||t||r<w||bottom<h)resized=await sharp(resized).extract({left:l,top:t,width:r-l,height:bottom-t}).png().toBuffer();
  layers.push({input:resized,left:i*512+x+l,top:y+t});
  Object.assign(b,{sourceSha256:s.sourceSha256,scale,headWidth:(b.skull[2]-b.skull[0])*scale,headHeight:(b.skull[3]-b.skull[1])*scale,bodyBelowChin:(b.feet[1]-b.skull[3])*scale});
}
await save('bosses-expansion',await sharp({create:{width:1536,height:512,channels:4,background:'#00000000'}}).composite(layers).webp({quality:94,alphaQuality:100,effort:6}).toBuffer(),{columns:3,rows:1,cell:512,anchor:[256,480],anatomyPolicy:'Manual skull/face estimates exclude hair, twin tails, flames, halo, wings and costume; common uniform cranial scale, never silhouette fit.',frames:bosses});
for(const id of ['effects-expansion','finishers']){
  const s=await input(id),w=s.meta.width/4,parts=[],frames=[];
  // Authored rows are not assumed to be mathematically equal. The finisher
  // sheet's third row begins above 2/3 height; equal slicing cuts its clocks.
  const cuts=id==='finishers'?[0,360,672,s.meta.height]:[0,362,724,s.meta.height];
  if(!Number.isInteger(w))throw new Error(id+' invalid atlas grid');
  for(let i=0;i<12;i++){
    const row=Math.floor(i/4),top=cuts[row],h=cuts[row+1]-top;
    const {data}=await sharp(s.bytes).extract({left:i%4*w,top,width:w,height:h}).removeAlpha().raw().toBuffer({resolveWithObject:true});
    let l=w,t=h,r=0,b=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=(y*w+x)*3;if(Math.max(data[j],data[j+1],data[j+2])>12){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}}
    l=Math.max(0,l-3);t=Math.max(0,t-3);r=Math.min(w-1,r+3);b=Math.min(h-1,b+3);
    const box={left:i%4*w+l,top:top+t,width:r-l+1,height:b-t+1};
    const sprite=await sharp(s.bytes).extract(box).resize(224,224,{fit:'inside'}).removeAlpha().png().toBuffer(),m=await sharp(sprite).metadata();
    parts.push({input:sprite,left:i%4*256+Math.round((256-m.width)/2),top:row*256+Math.round((256-m.height)/2)});frames.push({frame:i,sourceBox:box});
  }
  await save(id,await sharp({create:{width:1024,height:768,channels:3,background:'#000000'}}).composite(parts).removeAlpha().webp({quality:94,effort:6}).toBuffer(),{sourceSha256:s.sourceSha256,columns:4,rows:3,cell:256,gutter:16,blend:'screen',frames});
}
{
  const s=await input('relics-expansion'),w=Math.floor(s.meta.width/2),h=Math.floor(s.meta.height/2),parts=[],cells=[];
  for(let i=0;i<4;i++){
    const {data,info}=await sharp(s.bytes).extract({left:i%2*w,top:Math.floor(i/2)*h,width:w,height:h}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let l=w,t=h,r=0,b=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=(y*w+x)*4+3;if(data[a]>=250)data[a]=255;if(data[a]>8){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}}
    // Relics are whole objects, unlike characters: uniform contain inside a
    // fixed transparent gutter is appropriate for their icon presentation.
    const sprite=await sharp(data,{raw:{width:w,height:h,channels:4}}).extract({left:l,top:t,width:r-l+1,height:b-t+1}).resize(204,204,{fit:'inside'}).png().toBuffer(),m=await sharp(sprite).metadata();
    parts.push({input:sprite,left:i%2*256+Math.round((256-m.width)/2),top:Math.floor(i/2)*256+Math.round((256-m.height)/2)});
    cells.push({id:['tempo_bell','royal_seal','gift_ribbon','broken_clock'][i],cell:[i%2*256,Math.floor(i/2)*256,256,256],sourceBox:[i%2*w+l,Math.floor(i/2)*h+t,r-l+1,b-t+1]});
  }
  await save('relics-expansion',await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}}).composite(parts).webp({quality:94,alphaQuality:100,effort:6}).toBuffer(),{sourceSha256:s.sourceSha256,columns:2,rows:2,cell:256,gutter:26,frames:cells});
}
{
  const s=await input('realms-expansion');
  await save('realms-expansion',await sharp(s.bytes).resize(1536,512).removeAlpha().webp({quality:89,effort:6}).toBuffer(),{sourceSha256:s.sourceSha256,columns:3,rows:1,cell:512});
}
await writeFile(fileURLToPath(new URL('../docs/art/expansion/ATLAS_PACKING.json',import.meta.url)),JSON.stringify({version:1,records},null,2)+'\n');
console.log(records.map(r=>r.id+': '+Math.round(r.bytes/1024)+' KiB').join('\n'));

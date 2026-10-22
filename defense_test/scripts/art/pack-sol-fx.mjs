// Mechanical packing only; painted source images come from built-in image_gen.
// node defense_test/scripts/art/pack-sol-fx.mjs <sweet.png> <twilight.png> [orbit-pair.png]
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {gameRoot} from '../local-inputs.mjs';
const files=process.argv.slice(2);if(files.length<2)throw Error('Need sweet and twilight source PNGs.');
const hash=b=>createHash('sha256').update(b).digest('hex');
const source=async file=>{const bytes=await fs.readFile(file),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {bytes,data,w:info.width,h:info.height};};
function gap(s,axis,lo,hi,from=0,to=axis==='y'?s.w:s.h){
  let best=Infinity,at=0;
  for(let p=Math.floor(lo);p<=Math.ceil(hi);p++){
    let sum=0;for(let q=from;q<to;q++){const x=axis==='x'?p:q,y=axis==='y'?p:q,a=s.data[(y*s.w+x)*4+3];if(a>40)sum+=a;}
    const score=sum+Math.abs(p-(lo+hi)/2)*.05;if(score<best){best=score;at=p;}
  }return at;
}
async function tile(s,rect){
  let buffer=await sharp(s.bytes).extract(rect).ensureAlpha().raw().toBuffer();
  // Retain true alpha, including white/black materials. Only remove imperceptible
  // isolated <4 alpha, then uniformly contain the complete painted tile.
  for(let i=3;i<buffer.length;i+=4)if(buffer[i]<4)buffer[i]=0;
  const png=await sharp(buffer,{raw:{width:rect.width,height:rect.height,channels:4}}).trim({background:'#00000000',threshold:2}).png().toBuffer();
  // Sharp performs only one resize per pipeline. Materialise it before adding
  // the gutter so a later resize cannot silently replace the first operation.
  const contained=await sharp(png).resize(224,224,{fit:'contain',background:'#00000000'}).png().toBuffer();
  return sharp(contained).extend({top:16,bottom:16,left:16,right:16,background:'#00000000'}).png().toBuffer();
}
const records=[];const orbit=files[2]?await source(files[2]):null;
for(const [index,name] of ['effects-sol-sweet','effects-sol-twilight'].entries()){
  const s=await source(files[index]),split=gap(s,'y',s.h*.37,s.h*.49),frames=[],rects=[];
  for(let row=0;row<2;row++){
    const y=row?split:0,bottom=row?s.h:split;
    const xs=[0,...[1,2,3].map(i=>gap(s,'x',s.w*i/4-s.w*.018,s.w*i/4+s.w*.018,y,bottom)),s.w];
    for(let col=0;col<4;col++){
      let rect={left:xs[col],top:y,width:xs[col+1]-xs[col],height:bottom-y},src=s;
      if(index===1&&col===3&&orbit){const sy=gap(orbit,'y',orbit.h*.42,orbit.h*.58);src=orbit;rect={left:0,top:row?sy:0,width:orbit.w,height:row?orbit.h-sy:sy};}
      frames.push(await tile(src,rect));rects.push({frame:row*4+col,source:index===1&&col===3&&orbit?'orbit':name,rect});
    }
  }
  const out=await sharp({create:{width:1024,height:512,channels:4,background:'#00000000'}}).composite(frames.map((input,i)=>({input,left:i%4*256,top:Math.floor(i/4)*256}))).webp({quality:94,alphaQuality:100,effort:6}).toBuffer();
  await fs.writeFile(path.join(gameRoot,'assets/merge',name+'.webp'),out);
  records.push({id:name,sourceName:path.basename(files[index]),sourceSha256:hash(s.bytes),outputSha256:hash(out),bytes:out.length,width:1024,height:512,columns:4,rows:2,frames:rects});
}
if(orbit)records.push({id:'antropy-orbit-refinement',sourceName:path.basename(files[2]),sourceSha256:hash(orbit.bytes),reason:'Reject filled purple disc; retain empty thin orbital halo.'});
await fs.writeFile(path.join(gameRoot,'docs/art/sol-20261023/effects-packing.json'),JSON.stringify({tool:'built-in image_gen',packing:'independent source cells uniformly contained with transparent gutter; no runtime pixel processing',assets:records},null,2)+'\n');
console.log(records.map(r=>r.id+': '+(r.bytes??'refinement')+' bytes').join('\n'));

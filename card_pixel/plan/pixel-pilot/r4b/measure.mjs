import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../../../..');
const assets=path.join(root,'card_pixel/slice/assets');
const ids=['ash','luna','red_dragon','golem','zeke','flame_sage','cherry_prince'];
const meta=JSON.parse(await fs.readFile(path.join(assets,'sprites.json')));
const fringe=JSON.parse(await fs.readFile(path.join(dir,'fringe-counts.json')));
const results=[];
const key=(r,g,b)=>(255-r)**2+g*g+(255-b)**2<105**2 || (r>190&&b>190&&g<90);
const median=a=>{a.sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
for (const [index,id] of ids.entries()) {
  const {data,info}=await sharp(path.join(dir,index<4?'../r4':'',`${id}-strip.png`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const W=info.width,H=info.height,w=Math.floor(W/3),h=H;
  const bg=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return true;const i=(y*W+x)*4;return !data[i+3]||key(data[i],data[i+1],data[i+2]);};
  let y0=h,y1=-1; const colors=new Map(), edges=[[],[],[]];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(bg(x,y))continue;
    y0=Math.min(y0,y);y1=Math.max(y1,y);const i=(y*W+x)*4;
    const c=((data[i]>>3)<<10)|((data[i+1]>>3)<<5)|(data[i+2]>>3);colors.set(c,(colors.get(c)||0)+1);
    if(bg(x-1,y)||bg(x+1,y)||bg(x,y-1)||bg(x,y+1))for(let k=0;k<3;k++)edges[k].push(data[i+k]);
  }
  const runs=[];
  for(const vertical of [false,true]){
    const lines=vertical?w:h,len=vertical?h:w;
    for(let l=0;l<lines;l+=2){let last='',count=0,inside=false;
      for(let p=0;p<=len;p++){
        const x=vertical?l:p,y=vertical?p:l,i=(y*W+x)*4;
        const c=p===len||bg(x,y)?'':`${data[i]>>4},${data[i+1]>>4},${data[i+2]>>4}`;
        if(c!==last){if(inside&&count>=2&&count<=64)runs.push(count);last=c;count=1;inside=!!c;}else count++;
      }
    }
  }
  let grid=2,best=-1;
  for(let g=2;g<=16;g++){let score=0;for(const n of runs)if(Math.abs(n/g-Math.round(n/g))*g<=1)score+=1/Math.sqrt(n);score*=Math.sqrt(g);if(score>best){best=score;grid=g;}}
  const agreement=runs.filter(n=>Math.abs(n/grid-Math.round(n/grid))*grid<=1).length/runs.length;
  const counts=[...colors.values()].sort((a,b)=>b-a), total=counts.reduce((a,b)=>a+b,0);let sum=0,n95=0;
  while(sum<total*.95)sum+=counts[n95++];
  const outline=edges.map(median), distance=Math.hypot(outline[0]-43,outline[1]-33,outline[2]-64);
  const {data:cut,info:ci}=await sharp(path.join(assets,`${id}-idle.png`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let neck=-1,narrow=Infinity;
  for(let y=Math.ceil(ci.height*.25);y<=Math.floor(ci.height*.60);y++){
    let x0=ci.width,x1=-1;for(let x=0;x<ci.width;x++)if(cut[(y*ci.width+x)*4+3]){x0=Math.min(x0,x);x1=Math.max(x1,x);}
    const width=x1>=0?x1-x0+1:0;if(width<narrow){narrow=width;neck=y;}
  }
  const sizes=Object.fromEntries(['idle','attack','hurt'].map(p=>[p,{width:meta[`${id}-${p}.png`].width,height:meta[`${id}-${p}.png`].height}]));
  results.push({id,group:index<4?'A':'B',rawSize:{width:W,height:H},idleHeight:y1-y0+1,idleHeightFraction:(y1-y0+1)/H,gridPeriod:grid,gridAgreement:agreement,colours95:n95,outlineMedian: outline,outlineDistance:distance,headRatioEstimate:neck/ci.height,neckRow:neck,cutSizes:sizes,attackHeightDifference:sizes.attack.height-sizes.idle.height,attackWidthRatio:sizes.attack.width/sizes.idle.width,fringeBeforeRemoval:Object.fromEntries(['idle','attack','hurt'].map(p=>[p,fringe[`${id}-${p}.png`]]))});
}
const metrics=['idleHeight','idleHeightFraction','gridPeriod','gridAgreement','colours95','outlineDistance','headRatioEstimate','attackHeightDifference','attackWidthRatio'];
const groups={};
for(const group of ['A','B']){
  const rows=results.filter(r=>r.group===group);groups[group]={};
  for(const metric of metrics){const a=rows.map(r=>r[metric]);groups[group][metric]={mean:a.reduce((x,y)=>x+y,0)/a.length,min:Math.min(...a),max:Math.max(...a)};}
  for(const p of ['idle','attack','hurt']){
    for(const dimension of ['width','height']){const a=rows.map(r=>r.cutSizes[p][dimension]);groups[group][`${p}_${dimension}`]={mean:a.reduce((x,y)=>x+y,0)/a.length,min:Math.min(...a),max:Math.max(...a)};}
    const a=rows.map(r=>r.fringeBeforeRemoval[p]);groups[group][`${p}_fringe`]={mean:a.reduce((x,y)=>x+y,0)/a.length,min:Math.min(...a),max:Math.max(...a)};
  }
  for(const dimension of ['width','height']){const a=rows.map(r=>r.rawSize[dimension]);groups[group][`raw_${dimension}`]={mean:a.reduce((x,y)=>x+y,0)/a.length,min:Math.min(...a),max:Math.max(...a)};}
  for(let c=0;c<3;c++){const a=rows.map(r=>r.outlineMedian[c]);groups[group][`outline_${'RGB'[c]}`]={mean:a.reduce((x,y)=>x+y,0)/a.length,min:Math.min(...a),max:Math.max(...a)};}
}
await fs.writeFile(path.join(dir,'measurements.json'),JSON.stringify({method:'Idle raw cell; 5-bit RGB; four-neighbour boundary; grid method from snap.mjs; head ratio is a narrowest-row estimate; fringe is counted on downsampled cut pixels before palette quantization.',characters:results,groups},null,2)+'\n');
const fmt=x=>Number(x.toFixed(2));
let table='| Metric | A mean (range) | B mean (range) |\n|---|---:|---:|\n';
for(const k of Object.keys(groups.A)){const f=g=>`${fmt(g.mean)} (${fmt(g.min)}–${fmt(g.max)})`;table+=`| ${k} | ${f(groups.A[k])} | ${f(groups.B[k])} |\n`;}
console.log(table);
await fs.writeFile(path.join(dir,'table.md'),table);

const cellW=420, rowH=380, width=cellW*7,height=rowH*3, layers=[];
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#1b1530"/><g fill="white" font-family="sans-serif" font-size="19" text-anchor="middle">`;
for(let row=0;row<3;row++)for(let col=0;col<ids.length;col++){
  const id=ids[col],pose=['idle','attack','hurt'][row],m=meta[`${id}-${pose}.png`];
  const img=await sharp(path.join(assets,`${id}-${pose}.png`)).resize(m.width*3,m.height*3,{kernel:'nearest'}).png().toBuffer();
  layers.push({input:img,left:Math.round(col*cellW+(cellW-m.width*3)/2),top:row*rowH+325-m.height*3});
  svg+=`<text x="${col*cellW+cellW/2}" y="${row*rowH+355}">${id} ${col<4?'A':'B'} · ${pose}</text>`;
}
svg+='</g></svg>';
await sharp(Buffer.from(svg)).composite(layers).png().toFile(path.join(dir,'contact.png'));

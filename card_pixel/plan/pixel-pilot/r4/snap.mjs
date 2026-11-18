import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const names=['ash-idle','luna-idle','ash-strip'];
const results=[];
for(const name of names){
  const {data,info:{width:w,height:h}}=await sharp(path.join(dir,name+'.png')).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const bg=(i)=>data[i]>220&&data[i+1]<45&&data[i+2]>220;
  // Coarse colour bins suppress compression and edge noise when measuring runs.
  const key=(i)=>`${data[i]>>4},${data[i+1]>>4},${data[i+2]>>4}`;
  const runs=[];
  for(const vertical of [false,true]){
    const lines=vertical?w:h, len=vertical?h:w;
    for(let l=0;l<lines;l+=2){let last='',count=0,inside=false;
      for(let p=0;p<=len;p++){let i=vertical?(p*w+l)*3:(l*w+p)*3;let k=p===len||bg(i)?'':key(i);
        if(k!==last){if(inside&&count>=2&&count<=64)runs.push(count);last=k;count=1;inside=!!k}else count++;
      }
    }
  }
  // Reward short runs near multiples of a candidate period, discounting harmonics.
  let best=2,bestScore=-1;
  for(let g=2;g<=16;g++){let score=0;for(const n of runs){const d=Math.abs(n/g-Math.round(n/g))*g;if(d<=1)score+=1/Math.sqrt(n)} score*=Math.sqrt(g);if(score>bestScore){bestScore=score;best=g}}
  const g=best, W=Math.ceil(w/g), H=Math.ceil(h/g), pixels=Buffer.alloc(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const counts=new Map();for(let yy=y*g;yy<Math.min(h,(y+1)*g);yy++)for(let xx=x*g;xx<Math.min(w,(x+1)*g);xx++){let i=(yy*w+xx)*3;let k=bg(i)?'bg':`${data[i]},${data[i+1]},${data[i+2]}`;counts.set(k,(counts.get(k)||0)+1)}let count=0,winKey='bg';for(const [k,v] of counts)if(v>count){count=v;winKey=k}let o=(y*W+x)*4;if(winKey!=='bg'){let rgb=winKey.split(',').map(Number);for(let c=0;c<3;c++)pixels[o+c]=rgb[c];pixels[o+3]=255}}
  let x0=W,y0=H,x1=-1,y1=-1;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(pixels[(y*W+x)*4+3]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
  if(x1<0)throw Error(`No foreground: ${name}`);
  const trimmed=await sharp(pixels,{raw:{width:W,height:H,channels:4}}).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).png({palette:true,colours:24,dither:0}).toBuffer();
  const meta=await sharp(trimmed).metadata();await fs.writeFile(path.join(dir,name+'-snapped.png'),trimmed);
  await sharp(trimmed).resize(meta.width*4,meta.height*4,{kernel:'nearest'}).png().toFile(path.join(dir,name+'-snapped-4x.png'));
  results.push({name,grid:g,width:meta.width,height:meta.height,runs:runs.length,alignedFraction:runs.filter(n=>Math.abs(n/g-Math.round(n/g))*g<=1).length/runs.length});
}
await fs.writeFile(path.join(dir,'measurements.json'),JSON.stringify(results,null,2)+'\n');
const sheetW=3000, rowH=1320, sheetH=3450, comp=[];
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}"><rect width="100%" height="100%" fill="#ede8ee"/><g font-family="sans-serif" font-size="22" fill="#181326">`;
for(let row=0;row<2;row++){let id=['ash','luna'][row],y=row*rowH;svg+=`<text x="20" y="${y+28}">${id.toUpperCase()} — R2 left / R4 right, 4x nearest</text>`;for(let bg=0;bg<2;bg++){let x=bg*1500;svg+=`<rect x="${x+10}" y="${y+40}" width="1480" height="1270" fill="${bg?'#9ad0c2':'#1b1530'}"/>`;for(let col=0;col<2;col++){let f=col?path.join(dir,id+'-idle-snapped.png'):path.join(dir,'../sprites',id+'-right-R2-64.png');let im=sharp(f),m=await im.metadata(),b=await im.resize(m.width*4,m.height*4,{kernel:'nearest'}).png().toBuffer();comp.push({input:b,left:x+30+col*480,top:y+1290-m.height*4});}}}
svg+=`<text x="20" y="2670">ASH strip — idle / attack / hurt, R4 4x nearest</text><rect x="10" y="2685" width="2980" height="755" fill="#1b1530"/></g></svg>`;
let strip=path.join(dir,'ash-strip-snapped-4x.png'),sm=await sharp(strip).metadata();if(sm.width>2960||sm.height>745)throw Error('Strip exceeds sheet');comp.push({input:await fs.readFile(strip),left:20,top:2690});
await sharp(Buffer.from(svg)).composite(comp).png().toFile(path.join(dir,'r4-sheet.png'));
console.log(JSON.stringify(results,null,2));

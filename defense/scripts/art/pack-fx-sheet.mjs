// Pack a GPT effect sheet painted on pure black into a 256-cell atlas. GPT does not keep an exact grid, so the cuts
// follow the darkest gaps between motifs (row splits, then column splits per row), then each motif is re-centred on its
// bright-pixel box. The black ground becomes alpha (alpha = brightest channel, colour un-premultiplied), so the atlas
// draws with source-over like the original ultimates atlas and reads like a screen blend on dark ground.
// Usage: node defense/scripts/art/pack-fx-sheet.mjs <nodeModulesDir> <in.png> <out.webp> <report.json> [columns rows]
//   [--cell 512] [--shadow <gain> --shadow-frames 0,1 --shadow-color 14,6,24]
// --shadow keeps "black" fire visible (pass 18, Demon King): on the listed frames a dark body is laid under the glow,
// its alpha = (brightest channel - 12) x gain, softly blurred, so dark violet flame stays a dark mass on any ground.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
const argv=process.argv.slice(2),flag=(key,fallback)=>{const i=argv.indexOf('--'+key);return i<0?fallback:argv[i+1];};
const positional=argv.filter((a,i)=>!a.startsWith('--')&&!(i&&argv[i-1].startsWith('--')));
const [modDir,input,output,reportFile,colArg='4',rowArg='2']=positional,COLS=Number(colArg),ROWS=Number(rowArg),CELL=Number(flag('cell',256)),INNER=Math.round(CELL*228/256);
const SHADOW=Number(flag('shadow',0)),SHADOW_FRAMES=new Set(String(flag('shadow-frames','')).split(',').filter(Boolean).map(Number)),SHADOW_COLOR=String(flag('shadow-color','14,6,24')).split(',').map(Number);
const sharp=createRequire(modDir+'/x.js')('sharp');
const base=sharp(input).removeAlpha();const {width,height}=await base.metadata();
const raw=await base.raw().toBuffer(),LUM=30;
const bright=(x,y)=>{const i=(y*width+x)*3;return Math.max(raw[i],raw[i+1],raw[i+2])>LUM;};
const rowCount=(y,x0,x1)=>{let n=0;for(let x=x0;x<x1;x++)n+=bright(x,y);return n;};
const colCount=(x,y0,y1)=>{let n=0;for(let y=y0;y<y1;y++)n+=bright(x,y);return n;};
// Darkest line in a window around the nominal cut; ties go to the line nearest the nominal position.
const darkest=(mid,span,count)=>{let best=mid,v=Infinity;for(let i=mid-span;i<=mid+span;i++){const c=count(i);if(c<v||c===v&&Math.abs(i-mid)<Math.abs(best-mid)){v=c;best=i;}}return [best,v];};
const rowCuts=[0],report={input,width,height,columns:COLS,rows:ROWS,rowCuts:[],cells:[]},tiles=[];
for(let r=1;r<ROWS;r++){const [y,v]=darkest(Math.round(r*height/ROWS),Math.round(height/ROWS*.24),y=>rowCount(y,0,width));rowCuts.push(y);report.rowCuts.push([y,v]);}
rowCuts.push(height);
for(let r=0;r<ROWS;r++){
  const y0=rowCuts[r],y1=rowCuts[r+1],cuts=[0];
  for(let c=1;c<COLS;c++){const [x]=darkest(Math.round(c*width/COLS),Math.round(width/COLS*.24),x=>colCount(x,y0,y1));cuts.push(x);}
  cuts.push(width);
  for(let c=0;c<COLS;c++){
    const x0=cuts[c],x1=cuts[c+1];let minX=x1,minY=y1,maxX=x0,maxY=y0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(bright(x,y)){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
    if(maxX<minX){report.cells.push({cell:r*COLS+c,empty:true});continue;}
    const bw=maxX-minX+1,bh=maxY-minY+1,side=Math.round(Math.max(bw,bh)*1.08);
    // Only this cell's region is pasted, onto a black square centred on the motif box.
    const region=await sharp(input).removeAlpha().extract({left:minX,top:minY,width:bw,height:bh}).toBuffer();
    const square=await sharp({create:{width:side,height:side,channels:3,background:'#000000'}}).composite([{input:region,left:Math.round((side-bw)/2),top:Math.round((side-bh)/2)}]).png().toBuffer();
    tiles.push({input:await sharp(square).resize(INNER,INNER).toBuffer(),left:c*CELL+(CELL-INNER)/2,top:r*CELL+(CELL-INNER)/2});
    report.cells.push({cell:r*COLS+c,cut:[x0,y0,x1,y1],box:[minX,minY,bw,bh],touchesCut:[minX<=x0+1,minY<=y0+1,maxX>=x1-2,maxY>=y1-2]});
  }
}
const W=COLS*CELL,H=ROWS*CELL;
const {data:black,info}=await sharp({create:{width:W,height:H,channels:3,background:'#000000'}}).composite(tiles).removeAlpha().raw().toBuffer({resolveWithObject:true});
const rgba=Buffer.alloc(W*H*4),step=info.channels;
let shade=null;
if(SHADOW>0){
  const mask=Buffer.alloc(W*H);
  for(let p=0;p<W*H;p++){const frame=Math.floor(Math.floor(p/W)/CELL)*COLS+Math.floor(p%W/CELL);if(SHADOW_FRAMES.has(frame))mask[p]=Math.min(255,Math.round(Math.max(0,Math.max(black[p*step],black[p*step+1],black[p*step+2])-12)*SHADOW));}
  // A wide blur closes the near-black holes GPT leaves inside the body (they would read as see-through patches).
  const blur=async sigma=>{const out=await sharp(mask,{raw:{width:W,height:H,channels:1}}).blur(sigma).raw().toBuffer({resolveWithObject:true});return p=>out.data[p*out.info.channels];};
  const fine=await blur(Math.max(.3,CELL/200)),wide=await blur(CELL/40);
  shade=Buffer.alloc(W*H);for(let p=0;p<W*H;p++)shade[p]=Math.max(fine(p),Math.min(255,Math.round(wide(p)*1.6)));
  report.shadow={gain:SHADOW,frames:[...SHADOW_FRAMES],color:SHADOW_COLOR};
}
for(let i=0,j=0,p=0;i<black.length;i+=step,j+=4,p++){
  const glow=Math.max(black[i],black[i+1],black[i+2])/255,body=shade?shade[p]/255*(1-glow):0,a=glow+body;rgba[j+3]=Math.round(a*255);
  if(a>0)for(let c=0;c<3;c++)rgba[j+c]=Math.min(255,Math.round((black[i+c]+SHADOW_COLOR[c]*body)/a));
}
await sharp(rgba,{raw:{width:W,height:H,channels:4}}).webp({lossless:true}).toFile(output);
await fs.writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
console.log('rowCuts',JSON.stringify(report.rowCuts),JSON.stringify(report.cells.map(c=>[c.cell,c.empty?'empty':c.touchesCut.map(Number).join('')])));

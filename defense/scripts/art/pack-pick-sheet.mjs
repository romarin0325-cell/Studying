// Assemble one effect atlas from the best cells of several generated sheets (pass 21, 2026-11-06).
// GPT does not keep an exact grid, so each source cell is cut along the emptiest gap near its nominal border (as in
// pack-fx-sheet.mjs), the motif is re-centred on its box (or sat on the cell floor) and scaled into the cell. Two kinds of source:
//   light   painted on pure black. Alpha comes from brightness; additive light (flashes, rings, mist, dust) is authored this
//           way in every engine. In a "luma" sheet the colour is dropped (white, alpha = brightness) so the game can recolour
//           the piece per hero with a gradient map (ur-vfx.js); in an "alpha" sheet the colour is kept (un-premultiplied).
//   object  generated with the image tool's transparent background (Codex image_gen transparent_background): the native alpha is
//           kept, so painted objects have clean edges on any ground. Alpha >= 248 is treated as opaque and <= 3 as empty.
// Usage: node defense/scripts/art/pack-pick-sheet.mjs <spec.json> <report.json>
// spec: {"nodeModules":"...","out":"...webp","cell":256,"columns":4,"rows":3,"mode":"luma"|"alpha","inner":.9,
//        "cells":[{"name":"blade","src":"a.png","grid":[3,2],"at":[0,0],"anchor":"center"|"bottom","source":"light"|"object"}]}
// In a luma sheet every cell is light; in an alpha sheet cells are objects unless marked "source":"light".
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
const [specFile,reportFile]=process.argv.slice(2);
const spec=JSON.parse(await fs.readFile(specFile,'utf8'));
const sharp=createRequire(spec.nodeModules+'/x.js')('sharp');
const CELL=spec.cell,INNER=Math.round(CELL*(spec.inner??.9)),LUM=30,sources=new Map(),report={spec:specFile,mode:spec.mode,cells:[]};
const kindOf=cell=>spec.mode==='luma'?'light':cell.source||'object';
async function load(file,kind){
  const key=file+'|'+kind;if(sources.has(key))return sources.get(key);
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}),{width,height}=info;
  const filled=kind==='light'?(x,y)=>{const i=(y*width+x)*4;return Math.max(data[i],data[i+1],data[i+2])>LUM;}:(x,y)=>data[(y*width+x)*4+3]>24;
  const src={file,width,height,data,filled};sources.set(key,src);return src;
}
// Emptiest line near a nominal cut; ties go to the line closest to the nominal position.
const emptiest=(mid,span,count)=>{let best=mid,v=Infinity;for(let i=mid-span;i<=mid+span;i++){const c=count(i);if(c<v||c===v&&Math.abs(i-mid)<Math.abs(best-mid)){v=c;best=i;}}return best;};
function region(src,[cols,rows],[c,r]){
  const {width,height,filled}=src;
  const rowCount=(y,x0,x1)=>{let n=0;for(let x=x0;x<x1;x++)n+=filled(x,y);return n;},colCount=(x,y0,y1)=>{let n=0;for(let y=y0;y<y1;y++)n+=filled(x,y);return n;};
  const ys=[0];for(let k=1;k<rows;k++)ys.push(emptiest(Math.round(k*height/rows),Math.round(height/rows*.22),y=>rowCount(y,0,width)));ys.push(height);
  const y0=ys[r],y1=ys[r+1],xs=[0];for(let k=1;k<cols;k++)xs.push(emptiest(Math.round(k*width/cols),Math.round(width/cols*.22),x=>colCount(x,y0,y1)));xs.push(width);
  const x0=xs[c],x1=xs[c+1];let minX=x1,minY=y1,maxX=x0,maxY=y0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(filled(x,y)){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
  if(maxX<minX)throw Error(`empty cell ${c},${r} in ${src.file}`);
  return {cut:[x0,y0,x1,y1],box:[minX,minY,maxX-minX+1,maxY-minY+1],touches:[minX<=x0+1,minY<=y0+1,maxX>=x1-2,maxY>=y1-2]};
}
// One straight-alpha RGBA piece from a source region.
function piece(src,kind,left,top,w,h){
  const out=Buffer.alloc(w*h*4),{data,width}=src;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=((top+y)*width+left+x)*4,o=(y*w+x)*4;let a;
    if(kind==='light'){const v=Math.max(data[i],data[i+1],data[i+2]);a=Math.min(1,Math.max(0,(v-10)/240));
      if(spec.mode==='luma'){out[o]=out[o+1]=out[o+2]=255;}else for(let c=0;c<3;c++)out[o+c]=a>0?Math.min(255,Math.round(data[i+c]/Math.max(a,.05))):0;}
    else{const raw=data[i+3];a=raw>=248?1:raw<=3?0:raw/255;for(let c=0;c<3;c++)out[o+c]=data[i+c];}
    out[o+3]=Math.round(a*255);
  }
  return out;
}
const W=spec.columns*CELL,H=spec.rows*CELL,tiles=[];
for(const [index,cell] of spec.cells.entries()){
  const kind=kindOf(cell),src=await load(cell.src,kind),{cut,box,touches}=region(src,cell.grid,cell.at),[bx,by,bw,bh]=box;
  // Pad a little so soft glow at the box edge is not clipped.
  const pad=Math.round(Math.max(bw,bh)*.04),left=Math.max(cut[0],bx-pad),top=Math.max(cut[1],by-pad),right=Math.min(cut[2],bx+bw+pad),bottom=Math.min(cut[3],by+bh+pad);
  const w=right-left,h=bottom-top,side=Math.max(w,h),scale=INNER/side,sw=Math.max(1,Math.round(w*scale)),sh=Math.max(1,Math.round(h*scale));
  const input=await sharp(piece(src,kind,left,top,w,h),{raw:{width:w,height:h,channels:4}}).resize(sw,sh,{kernel:'lanczos3'}).png().toBuffer();
  const ox=(index%spec.columns)*CELL+Math.round((CELL-sw)/2),margin=Math.round((CELL-INNER)/2);
  const oy=Math.floor(index/spec.columns)*CELL+(cell.anchor==='bottom'?CELL-margin-sh:Math.round((CELL-sh)/2));
  tiles.push({input,left:ox,top:oy});
  report.cells.push({index,name:cell.name,kind,src:cell.src,cut,box,touchesCut:touches,placed:[ox,oy,sw,sh],anchor:cell.anchor||'center'});
}
await sharp({create:{width:W,height:H,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(tiles).webp({lossless:true,effort:6}).toFile(spec.out);
await fs.writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
console.log(spec.out,W+'x'+H,spec.mode,report.cells.map(c=>`${c.name}${c.touchesCut.some(Boolean)?'(edge!)':''}`).join(' '));

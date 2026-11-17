// Pack the relic icon atlas from archived GPT 2x2 sheets (relic restyle, 2026-11-18).
//   node defense/scripts/art/pack-relic-atlas.mjs <spec.json>
// spec: {"out":"defense/assets/merge/relics-v2.webp","cell":512,"columns":6,"fit":0.88,
//        "cells":[{"id":"hourglass","sheet":"defense/docs/art/relic-restyle-20261118/sheets/x.webp","quadrant":0}, ...]}
// Cell i of the atlas is cells[i]; data.js points each relic at its index. Sheets come from Codex image_gen with its
// transparent background option. GPT does not keep an exact grid, so each quadrant is cut along the emptiest column/row
// near the middle. Alpha <= 8 is cleared (the tool leaves a faint coloured haze, about 2% of the canvas) and >= 248 made
// opaque; loose specks under 1.5% of the largest part are dropped while real separate parts (coins, an ink drop) stay.
// Each relic is centred and scaled to fit `fit` of its cell. Output is WebP (spec.webp options, lossless by default); the
// lossless originals stay in the archived sheets. This atlas is a build-only source
// (asset-policy.js); the shipped 240px icons are cut from it by optimize-images.mjs.
import fs from 'node:fs';
import sharp from 'sharp';
const spec=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const CELL=spec.cell,COLS=spec.columns,ROWS=Math.ceil(spec.cells.length/COLS),FIT=Math.round(CELL*(spec.fit??.88));
const loaded=new Map();
async function load(file){
  if(loaded.has(file))return loaded.get(file);
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}),W=info.width,H=info.height;
  for(let i=3;i<data.length;i+=4){if(data[i]<=8)data[i]=0;else if(data[i]>=248)data[i]=255;}
  const on=(x,y)=>data[(y*W+x)*4+3]>24;
  const emptiest=(mid,span,count)=>{let best=mid,v=Infinity;for(let i=mid-span;i<=mid+span;i++){const c=count(i);if(c<v||(c===v&&Math.abs(i-mid)<Math.abs(best-mid))){v=c;best=i;}}return best;};
  const cx=emptiest(W>>1,Math.round(W*.12),x=>{let c=0;for(let y=0;y<H;y++)c+=on(x,y);return c;});
  const rowCut=(x0,x1)=>emptiest(H>>1,Math.round(H*.12),y=>{let c=0;for(let x=x0;x<x1;x++)c+=on(x,y);return c;});
  const cyL=rowCut(0,cx),cyR=rowCut(cx,W);
  const src={data,W,H,on,boxes:[[0,0,cx,cyL],[cx,0,W,cyR],[0,cyL,cx,H],[cx,cyR,W,H]]};loaded.set(file,src);return src;
}
async function cut(file,quadrant){
  const {data,W,on,boxes}=await load(file),[x0,y0,x1,y1]=boxes[quadrant],w=x1-x0,h=y1-y0,label=new Int32Array(w*h),sizes=[0];let n=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(label[y*w+x]||!on(x0+x,y0+y))continue;label[y*w+x]=++n;sizes[n]=0;const st=[y*w+x];
    while(st.length){const p=st.pop(),px=p%w,py=(p-px)/w;sizes[n]++;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=px+dx,ny=py+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const q=ny*w+nx;if(!label[q]&&on(x0+nx,y0+ny)){label[q]=n;st.push(q);}}}}
  const big=Math.max(...sizes),keep=sizes.map(s=>s>=big*.015),buf=Buffer.alloc(w*h*4);let bx0=w,by0=h,bx1=0,by1=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const s=((y0+y)*W+x0+x)*4,d=(y*w+x)*4;
    let ok=label[y*w+x]?keep[label[y*w+x]]:false;
    if(!ok&&data[s+3]>0)for(let dy=-2;dy<=2&&!ok;dy++)for(let dx=-2;dx<=2;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<w&&ny<h){const l=label[ny*w+nx];if(l&&keep[l]){ok=true;break;}}}
    if(!ok)continue;data.copy(buf,d,s,s+4);if(buf[d+3]>24){bx0=Math.min(bx0,x);by0=Math.min(by0,y);bx1=Math.max(bx1,x);by1=Math.max(by1,y);}}
  const bw=bx1-bx0+1,bh=by1-by0+1,sc=FIT/Math.max(bw,bh),rw=Math.round(bw*sc),rh=Math.round(bh*sc);
  return {input:await sharp(buf,{raw:{width:w,height:h,channels:4}}).extract({left:bx0,top:by0,width:bw,height:bh}).resize(rw,rh,{kernel:'lanczos3'}).png().toBuffer(),rw,rh};
}
const comps=[];
for(const [i,c] of spec.cells.entries()){
  const {input,rw,rh}=await cut(c.sheet,c.quadrant);
  comps.push({input,left:(i%COLS)*CELL+((CELL-rw)>>1),top:Math.floor(i/COLS)*CELL+((CELL-rh)>>1)});
}
await sharp({create:{width:COLS*CELL,height:ROWS*CELL,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(comps).webp(spec.webp??{lossless:true,effort:6}).toFile(spec.out);
console.log(spec.out,COLS*CELL+'x'+ROWS*CELL,spec.cells.length,'cells',fs.statSync(spec.out).size,'bytes');

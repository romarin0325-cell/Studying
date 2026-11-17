import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const out = path.join(root, 'card_pixel/slice/assets');
const art = path.join(root, 'card_pixel/art');
const subjects = JSON.parse(await fs.readFile(path.join(art, 'manifest.json'), 'utf8')).filter(subject => subject.status === 'ok');
const written = new Set();
const poses = ['idle', 'attack', 'hurt'];
const meta = {}, fringeCounts = {};
const key = (r, g, b) => (255-r)**2 + g*g + (255-b)**2 < 105**2 || (r>190 && b>190 && g<90);

function bounds(a, w, h) {
  let x0=w, y0=h, x1=-1, y1=-1;
  for (let y=0; y<h; y++) for (let x=0; x<w; x++) if (a[(y*w+x)*4+3]) {
    x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,y); y1=Math.max(y1,y);
  }
  return {x0,y0,x1,y1,w:x1-x0+1,h:y1-y0+1};
}
function crop(a,w,b) {
  const d=Buffer.alloc(b.w*b.h*4);
  for (let y=0;y<b.h;y++) a.copy(d,y*b.w*4,((b.y0+y)*w+b.x0)*4,((b.y0+y)*w+b.x0+b.w)*4);
  return d;
}
function components(a,w,h) {
  const seen=new Uint8Array(w*h), list=[];
  for (let i=0;i<w*h;i++) {
    if (!a[i*4+3] || seen[i]) continue;
    const q=[i], pixels=[]; seen[i]=1;
    for (let k=0;k<q.length;k++) {
      const p=q[k], x=p%w, y=Math.floor(p/w); pixels.push(p);
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
        const xx=x+dx, yy=y+dy, j=yy*w+xx;
        if (xx>=0 && xx<w && yy>=0 && yy<h && !seen[j] && a[j*4+3]) { seen[j]=1; q.push(j); }
      }
    }
    list.push(pixels);
  }
  return list.sort((a,b)=>b.length-a.length);
}
function removeFringe(a,w,h) {
  const changes=[];
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const i=(y*w+x)*4, r=a[i], g=a[i+1], b=a[i+2];
    if (!a[i+3]) continue;
    const touches = x===0 || y===0 || x===w-1 || y===h-1 ||
      !a[i-4+3] || !a[i+4+3] || !a[i-w*4+3] || !a[i+w*4+3];
    const pink = r>g*1.4 && b>g*1.4 && Math.max(r,b)-g>70;
    const mag=(r-255)**2+g*g+(b-255)**2, outline=(r-43)**2+(g-33)**2+(b-64)**2;
    if (touches && pink && mag<outline) changes.push(i);
  }
  for (const i of changes) { a[i]=43; a[i+1]=33; a[i+2]=64; }
  return changes.length;
}

await fs.mkdir(out,{recursive:true});
for (const subject of subjects) {
  const {id, kind, size = kind === 'ally' ? 'ally' : kind === 'boss' ? 'boss' : undefined} = subject;
  const target = kind === 'ally' ? 72 : kind === 'boss' ? 104 : ({small:48,medium:64,large:80})[size];
  if (!target) throw Error(`Invalid kind or size: ${id}`);
  const {data,info} = await sharp(path.join(art,'strips',`${id}-strip.png`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const W=info.width, H=info.height, regions=[];
  for (let p=0;p<3;p++) {
    const l=Math.floor(W*p/3), r=Math.floor(W*(p+1)/3), w=r-l, a=Buffer.alloc(w*H*4);
    for (let y=0;y<H;y++) for (let x=0;x<w;x++) {
      const si=(y*W+l+x)*4, di=(y*w+x)*4;
      if (data[si+3] && !key(data[si],data[si+1],data[si+2])) { data.copy(a,di,si,si+3); a[di+3]=255; }
    }
    regions.push({a,w,h:H});
  }
  const ib=bounds(regions[0].a,regions[0].w,H), scale=target/ib.h, images=[];
  // Estimate torso centre from columns occupied most often in the middle of the idle silhouette.
  // Reuse that position in the attack cell, then translate it into its cropped coordinates.
  const density=new Array(regions[0].w).fill(0);
  for (let y=Math.floor(ib.y0+ib.h*.4);y<Math.floor(ib.y0+ib.h*.75);y++)
    for (let x=0;x<regions[0].w;x++) if (regions[0].a[(y*regions[0].w+x)*4+3]) density[x]++;
  const threshold=Math.max(...density)*.7, dense=density.map((v,x)=>v>=threshold?x:-1).filter(x=>x>=0);
  const torso=(dense[0]+dense.at(-1))/2;
  for (let p=0;p<3;p++) {
    const {a,w,h}=regions[p], b=bounds(a,w,h), ow=Math.ceil(b.w*scale-1e-9), oh=Math.ceil(b.h*scale-1e-9), d=Buffer.alloc(ow*oh*4);
    if (b.x1<0) throw Error(`Empty pose: ${id} ${poses[p]}`);
    for (let yy=0;yy<oh;yy++) for (let xx=0;xx<ow;xx++) {
      const x0=Math.floor(b.x0+xx/scale), x1=Math.min(b.x1+1,Math.floor(b.x0+(xx+1)/scale));
      const y0=Math.floor(b.y0+yy/scale), y1=Math.min(b.y1+1,Math.floor(b.y0+(yy+1)/scale));
      const counts=new Map(); let n=0,total=0;
      for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++) {
        total++; const i=(y*w+x)*4; if (!a[i+3]) continue; n++;
        const c=((a[i]>>3)<<10)|((a[i+1]>>3)<<5)|(a[i+2]>>3); counts.set(c,(counts.get(c)||0)+1);
      }
      if (n>total*.35 && counts.size) {
        const c=[...counts].sort((u,v)=>v[1]-u[1])[0][0], i=(yy*ow+xx)*4;
        d[i]=((c>>10)&31)*8+4; d[i+1]=((c>>5)&31)*8+4; d[i+2]=(c&31)*8+4; d[i+3]=255;
      }
    }
    const parts=components(d,ow,oh), keep=new Uint8Array(ow*oh);
    if (!parts.length) throw Error(`No component: ${id} ${poses[p]}`);
    for (const i of parts[0]) keep[i]=1;
    if (id==='ash' && p===1) {
      const fx=Buffer.alloc(d.length);
      for (const part of parts.slice(1)) if (part.length>=2) for (const i of part) d.copy(fx,i*4,i*4,i*4+4);
      const fb=bounds(fx,ow,oh);
      if (fb.x1>=0) images.push({name:'ash-fx.png',data:crop(fx,ow,fb),w:fb.w,h:fb.h,centerX:(fb.w-1)/2,feetY:fb.h-1,fx:true});
    }
    for (let i=0;i<ow*oh;i++) if (!keep[i]) d[i*4+3]=0;
    const cb=bounds(d,ow,oh), name=`${id}-${poses[p]}.png`, cut=crop(d,ow,cb);
    fringeCounts[name]=removeFringe(cut,cb.w,cb.h);
    let centerX=Math.round((cb.w-1)*((p===1 && (id==='red_dragon'||id==='luna'))?.40:(p===1 && id==='golem')?.58:.5));
    if (p===1 && !['ash','luna','red_dragon','golem'].includes(id)) centerX=Math.max(0,Math.min(cb.w-1,Math.round((torso-b.x0)*scale-cb.x0)));
    images.push({name,data:cut,w:cb.w,h:cb.h,centerX,feetY:cb.h-1});
  }
  const width=Math.max(...images.map(i=>i.w)), height=images.reduce((n,i)=>n+i.h,0), joined=Buffer.alloc(width*height*4);
  let y=0;
  for (const im of images) { for (let yy=0;yy<im.h;yy++) im.data.copy(joined,((y+yy)*width)*4,yy*im.w*4,(yy+1)*im.w*4); im.offset=y; y+=im.h; }
  const quant=await sharp(joined,{raw:{width,height,channels:4}}).png({palette:true,colours:32,dither:0}).toBuffer();
  const q=await sharp(quant).ensureAlpha().raw().toBuffer();
  for (const im of images) {
    const d=Buffer.alloc(im.w*im.h*4);
    for (let yy=0;yy<im.h;yy++) q.copy(d,yy*im.w*4,((im.offset+yy)*width)*4,((im.offset+yy)*width+im.w)*4);
    for (let i=3;i<d.length;i+=4) d[i]=d[i]>=128?255:0;
    await sharp(d,{raw:{width:im.w,height:im.h,channels:4}}).png().toFile(path.join(out,im.name));
    written.add(im.name);
    meta[im.name]={width:im.w,height:im.h,bodyCenterX:im.centerX,feetBaselineY:im.feetY,...(im.fx?{effect:true}:{}),...(im.name===`${id}-idle.png`?{kind,size,facing:subject.facing}:{})};
  }
  console.log(id, images.map(im=>`${im.name}:${im.w}x${im.h}`).join(' '));
}
await fs.writeFile(path.join(out,'sprites.json'),JSON.stringify(meta,null,2)+'\n');
for (const name of await fs.readdir(out)) if (name.endsWith('.png') && !written.has(name)) await fs.unlink(path.join(out,name));

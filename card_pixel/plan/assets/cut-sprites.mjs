import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const out=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(out,'../pixel-pilot/r4');
const names=['ash','luna','red_dragon','golem'], poses=['idle','attack','hurt'], meta={};
function key(r,g,b){return (255-r)**2+g*g+(255-b)**2 < 105**2 || (r>190&&b>190&&g<90);}
function components(a,w,h){let seen=new Uint8Array(w*h), list=[]; for(let i=0;i<w*h;i++){if(!a[i*4+3]||seen[i])continue; let q=[i], pixels=[];seen[i]=1;for(let k=0;k<q.length;k++){let p=q[k],x=p%w,y=Math.floor(p/w);pixels.push(p);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let xx=x+dx,yy=y+dy,j=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!seen[j]&&a[j*4+3]){seen[j]=1;q.push(j)}}}list.push(pixels)}return list.sort((a,b)=>b.length-a.length)}
function bounds(a,w,h){let x0=w,y0=h,x1=-1,y1=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(a[(y*w+x)*4+3]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}return {x0,y0,x1,y1,w:x1-x0+1,h:y1-y0+1}}
function crop(a,w,b){let d=Buffer.alloc(b.w*b.h*4);for(let y=0;y<b.h;y++)a.copy(d,y*b.w*4,((b.y0+y)*w+b.x0)*4,((b.y0+y)*w+b.x0+b.w)*4);return d}
for(const id of names){
 const {data,info}=await sharp(path.join(root,id+'-strip.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});let W=info.width,H=info.height;
 // The strips have three evenly spaced cells; use their empty inter-pose gaps as boundaries.
 let regions=[];for(let p=0;p<3;p++){let l=Math.floor(W*p/3),r=Math.floor(W*(p+1)/3), w=r-l, a=Buffer.alloc(w*H*4);for(let y=0;y<H;y++)for(let x=0;x<w;x++){let si=(y*W+l+x)*4,di=(y*w+x)*4;let R=data[si],G=data[si+1],B=data[si+2];if(!key(R,G,B)){a[di]=R;a[di+1]=G;a[di+2]=B;a[di+3]=255}}regions.push({a,w,h:H})}
 // Measure the body in idle, then apply exactly the same spatial scale to every pose.
 let ib=bounds(regions[0].a,regions[0].w,H), scale=96/ib.h, images=[];
 for(let p=0;p<3;p++){let {a,w,h}=regions[p],b=bounds(a,w,h), ow=Math.ceil(b.w*scale),oh=Math.ceil(b.h*scale), d=Buffer.alloc(ow*oh*4);
 // Each output cell votes from its corresponding source cell; RGB buckets suppress interpolation noise.
 for(let yy=0;yy<oh;yy++)for(let xx=0;xx<ow;xx++){let x0=Math.floor(b.x0+xx/scale),x1=Math.min(b.x1+1,Math.floor(b.x0+(xx+1)/scale)),y0=Math.floor(b.y0+yy/scale),y1=Math.min(b.y1+1,Math.floor(b.y0+(yy+1)/scale)),counts=new Map(),n=0,total=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){total++;let i=(y*w+x)*4;if(!a[i+3])continue;n++;let c=((a[i]>>3)<<10)|((a[i+1]>>3)<<5)|(a[i+2]>>3);counts.set(c,(counts.get(c)||0)+1)}if(n>total*.35&&counts.size){let c=[...counts].sort((u,v)=>v[1]-u[1])[0][0],i=(yy*ow+xx)*4;d[i]=((c>>10)&31)*8+4;d[i+1]=((c>>5)&31)*8+4;d[i+2]=(c&31)*8+4;d[i+3]=255}}
 let parts=components(d,ow,oh), main=parts[0], keep=new Uint8Array(ow*oh);for(const i of main)keep[i]=1;
 // Ash's projectile is detached; preserve it separately, including nearby sparks.
 if(id==='ash'&&p===1){let fx=Buffer.alloc(d.length);for(const part of parts.slice(1))if(part.length>=2)for(const i of part){d.copy(fx,i*4,i*4,i*4+4)}let fb=bounds(fx,ow,oh);if(fb.x1>=0)images.push({name:'ash-fx.png',data:crop(fx,ow,fb),w:fb.w,h:fb.h,centerX:(fb.w-1)/2,feetY:fb.h-1,fx:true})}
 for(let i=0;i<ow*oh;i++)if(!keep[i])d[i*4+3]=0;
 let cb=bounds(d,ow,oh);images.push({name:`${id}-${poses[p]}.png`,data:crop(d,ow,cb),w:cb.w,h:cb.h,centerX:Math.round((cb.w-1)*((p===1&&id==='red_dragon')?0.40:(p===1&&id==='luna')?0.40:(p===1&&id==='golem')?0.58:0.5)),feetY:cb.h-1});
 }
 // Quantize the whole character at once so all frames use one common palette.
 let width=Math.max(...images.map(i=>i.w)), height=images.reduce((n,i)=>n+i.h,0), joined=Buffer.alloc(width*height*4), y=0;for(const im of images){for(let yy=0;yy<im.h;yy++)im.data.copy(joined,((y+yy)*width)*4,yy*im.w*4,(yy+1)*im.w*4);im.offset=y;y+=im.h}
 let quant=await sharp(joined,{raw:{width,height,channels:4}}).png({palette:true,colours:32,dither:0}).toBuffer();let q=await sharp(quant).ensureAlpha().raw().toBuffer();
 for(const im of images){let d=Buffer.alloc(im.w*im.h*4);for(let yy=0;yy<im.h;yy++)q.copy(d,yy*im.w*4,((im.offset+yy)*width)*4,((im.offset+yy)*width+im.w)*4);for(let i=3;i<d.length;i+=4)d[i]=d[i]>=128?255:0;await sharp(d,{raw:{width:im.w,height:im.h,channels:4}}).png().toFile(path.join(out,im.name));meta[im.name]={width:im.w,height:im.h,bodyCenterX:im.centerX,feetBaselineY:im.feetY,...(im.fx?{effect:true}:{})};}
 console.log(id,'source idle height',ib.h,'scale',scale,images.map(x=>`${x.name}:${x.w}x${x.h}`).join(' '));
}
await fs.writeFile(path.join(out,'sprites.json'),JSON.stringify(meta,null,2)+'\n');
const items=Object.entries(meta), cellW=600,cellH=430,cols=3, rows=Math.ceil(items.length/cols);let svg=`<svg width="${cellW*cols}" height="${cellH*rows*2}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="50%" fill="#1b1530"/><rect y="50%" width="100%" height="50%" fill="#9ad0c2"/>`;let layers=[];for(let bg=0;bg<2;bg++)for(let n=0;n<items.length;n++){let [file,m]=items[n],x=n%cols*cellW,y=bg*rows*cellH+Math.floor(n/cols)*cellH;svg+=`<text x="${x+15}" y="${y+28}" fill="${bg?'#1b1530':'white'}" font-family="sans-serif" font-size="20">${file}</text><path d="M${x+10} ${y+370} H${x+cellW-10}" stroke="${bg?'#527f72':'#716880'}"/>`;let img=await sharp(path.join(out,file)).resize(m.width*3,m.height*3,{kernel:'nearest'}).png().toBuffer();layers.push({input:img,left:Math.round(x+cellW/2-m.bodyCenterX*3),top:y+370-m.feetBaselineY*3})}svg+='</svg>';await sharp(Buffer.from(svg)).composite(layers).png().toFile(path.join(out,'contact.png'));


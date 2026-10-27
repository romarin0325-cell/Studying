import fs from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';import{createRequire}from'node:module';
export const root=path.dirname(fileURLToPath(import.meta.url));
export function dependency(name){try{return createRequire(import.meta.url)(name);}catch{return createRequire(process.env.DEFENSE_ART_PACKAGE_JSON||path.resolve(root,'../../work/defense-gpt-20261023/package.json'))(name);}}
export const sharp=dependency('sharp');
export const names=['down','up','left','right'];
export async function segment(file){
 const{data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}),W=info.width,H=info.height,N=W*H,labels=new Int32Array(N),queue=new Int32Array(N),comps=[];let cleaned=0;
 const original=Buffer.from(data);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=y*W+x,a=original[i*4+3];if(a>=250){data[i*4+3]=255;continue;}if(!a)continue;
  let keep=a>=128;
  if(!keep&&a>=8)for(let dy=-3;dy<=3&&!keep;dy++)for(let dx=-3;dx<=3;dx++){let xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<W&&yy<H&&original[(yy*W+xx)*4+3]>=128){keep=true;break;}}
  if(!keep){data[i*4+3]=0;cleaned++;}
 }
 for(let start=0;start<N;start++)if(data[start*4+3]>=128&&!labels[start]){
  let id=comps.length+1,head=0,tail=1;queue[0]=start;labels[start]=id;
  let c={id,count:0,x0:W,y0:H,x1:0,y1:0,sx:0,sy:0};
  while(head<tail){let i=queue[head++],x=i%W,y=(i/W)|0;c.count++;c.sx+=x;c.sy+=y;c.x0=Math.min(c.x0,x);c.y0=Math.min(c.y0,y);c.x1=Math.max(c.x1,x);c.y1=Math.max(c.y1,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let xx=x+dx,yy=y+dy,j=yy*W+xx;if((xx<W/2)!==(x<W/2))continue;if(xx>=0&&yy>=0&&xx<W&&yy<H&&!labels[j]&&data[j*4+3]>=128){labels[j]=id;queue[tail++]=j;}}
  }c.cx=c.sx/c.count;c.cy=c.sy/c.count;c.quadrant=(c.cx>=W/2?1:0)+(c.cy>=H/2?2:0);comps.push(c);
 }
 const mains=names.map((_,q)=>comps.filter(c=>c.quadrant===q).sort((a,b)=>b.count-a.count)[0]);if(mains.some(c=>!c||c.count<10000))throw Error('Four coherent figures not found in '+file);
 const dist=(x,y,c)=>Math.hypot(Math.max(c.x0-x,0,x-c.x1),Math.max(c.y0-y,0,y-c.y1));
 const owner=new Int8Array(comps.length+1);owner.fill(-1);
 for(const c of comps){let best=Infinity,q=-1;for(let v=0;v<4;v++){let d=dist(c.cx,c.cy,mains[v]);if(d<best){best=d;q=v;}}if(c.count>=24||best<=6)owner[c.id]=q;}
 for(let v=0;v<4;v++)owner[mains[v].id]=v;
 const bounds=names.map(()=>[W,H,-1,-1]);const pixels=names.map(()=>Buffer.alloc(data.length));let unmatched=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=y*W+x,a=data[i*4+3];if(!a)continue;let q=labels[i]?owner[labels[i]]:-1;
  if(q<0&&a<128){let best=Infinity;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){let xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=W||yy>=H)continue;let l=labels[yy*W+xx];if(l&&owner[l]>=0&&dx*dx+dy*dy<best){best=dx*dx+dy*dy;q=owner[l];}}}
  if(q<0){unmatched++;continue;}data.copy(pixels[q],i*4,i*4+0,i*4+4);if(a>=32){let b=bounds[q];b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);}
 }
 return{info,pixels,bounds,metadata:{source:[W,H],alphaCleaned:cleaned,unmatchedAlphaPixels:unmatched,majorComponents:mains.map(c=>({pixels:c.count,centroid:[c.cx,c.cy],bounds:[c.x0,c.y0,c.x1,c.y1]})),method:'Native-alpha cleanup then connected-component ownership; no fixed mid-row cut. Every view retains original image coordinates, RGB and pixel scale.'}};
}
export async function reviewSource(id,version){
 const file=path.join(root,'sources',id+'-'+version+'.png'),r=await segment(file),out=path.join(root,'review','source-views');await fs.mkdir(out,{recursive:true});
 const rows=[];
 for(let v=0;v<4;v++){
  const b=r.bounds[v],box={left:b[0],top:b[1],width:b[2]-b[0]+1,height:b[3]-b[1]+1};
  const dest=path.join(out,id+'-'+version+'-'+names[v]+'.png');await sharp(r.pixels[v],{raw:r.info}).extract(box).png().toFile(dest);rows.push({direction:names[v],file:path.relative(root,dest).replaceAll('\\','/'),sourceRect:box});
 }
 await fs.writeFile(path.join(out,id+'-'+version+'.json'),JSON.stringify({...r.metadata,views:rows},null,2));
 return rows;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await reviewSource(process.argv[2],process.argv[3]||'v1')));

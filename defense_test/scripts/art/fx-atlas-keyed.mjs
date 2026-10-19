// Builds a 2-cell FX atlas (512 cells, 1024x512) from two images generated on flat magenta, e.g. effects-applebomb.webp:
// 0 the object that waits on the path, 1 the burst. node defense_test/scripts/art/fx-atlas-keyed.mjs <a.jpg> <b.jpg> <out.webp>
// The background is removed by a border-connected flood fill on the magenta family (high blue AND high red AND low green, so red apples survive),
// the rim is despilled and every image is cropped to its painted bounds and centred in its cell.
import sharp from 'sharp';
sharp.cache(false);
const [a,b,out]=process.argv.slice(2);
const isBg=(r,g,bl)=>r>165&&bl>105&&g<125&&r-g>90&&bl-g>55;
async function keyed(file){
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}),w=info.width,h=info.height;
  const seen=new Uint8Array(w*h),stack=[];
  const push=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return;const i=y*w+x;if(seen[i])return;const p=i*4;if(!isBg(data[p],data[p+1],data[p+2]))return;seen[i]=1;stack.push(i);};
  for(let x=0;x<w;x++){push(x,0);push(x,h-1);}for(let y=0;y<h;y++){push(0,y);push(w-1,y);}
  while(stack.length){const i=stack.pop(),x=i%w,y=(i/w)|0;push(x+1,y);push(x-1,y);push(x,y+1);push(x,y-1);}
  // clear the background, then despill the one-pixel rim next to it (magenta fringe -> pull blue and red toward green)
  for(let i=0;i<w*h;i++)if(seen[i])data[i*4+3]=0;
  const near=(x,y)=>{for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;if(seen[yy*w+xx])return true;}return false;};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(seen[i]||!near(x,y))continue;const p=i*4,r=data[p],g=data[p+1],bl=data[p+2];if(bl>g+25&&r>g+25){data[p+2]=Math.round(g+(bl-g)*.25);data[p]=Math.round(g+(r-g)*.85);}}
  let x0=w,y0=h,x1=-1,y1=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>20){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  return {data,w,h,box:{left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}};
}
async function cell(file,fill=.94,size=512){
  const k=await keyed(file),side=Math.max(k.box.width,k.box.height),s=size*fill/side;
  const png=await sharp(k.data,{raw:{width:k.w,height:k.h,channels:4}}).extract(k.box).resize(Math.max(1,Math.round(k.box.width*s)),Math.max(1,Math.round(k.box.height*s)),{kernel:'lanczos3'}).png().toBuffer();
  const m=await sharp(png).metadata();
  return {input:png,left:Math.round((size-m.width)/2),top:Math.round((size-m.height)/2)};
}
const cells=[await cell(a),await cell(b)];
await sharp({create:{width:1024,height:512,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(cells.map((c,i)=>({...c,left:c.left+i*512}))).webp({quality:92,alphaQuality:100,effort:6}).toFile(out);
console.log(out);

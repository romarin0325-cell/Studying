// Builds a 3x1 FX atlas (256 cells) from three images generated on pure black, e.g. effects-behemoth.webp:
// 0 attack, 1 ultimate emblem, 2 ground decal.   node defense/scripts/art/fx-atlas.mjs <a> <b> <c> <out.webp>
// Black backgrounds -> luminance alpha (border-connected dark region), colours unpremultiplied.
import sharp from 'sharp';
const [atk,ult,crack,out]=process.argv.slice(2);
const raw=async file=>{const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,w:info.width,h:info.height};};
function keyBlack({data,w,h},soft=60){
  const mx=i=>Math.max(data[i*4],data[i*4+1],data[i*4+2]),out=Buffer.from(data);
  // Glow FX: alpha from brightness everywhere (dark interior cracks stay dark only where painted bright around them).
  for(let i=0;i<w*h;i++){const m=mx(i),a=Math.max(0,Math.min(1,(m-8)/(soft-8)));out[i*4+3]=Math.round(a*255);if(a>0&&a<1)for(let c=0;c<3;c++)out[i*4+c]=Math.min(255,Math.round(data[i*4+c]/Math.max(a,.25)));}
  return {data:out,w,h};
}
const bbox=({data,w,h})=>{let x0=w,y0=h,x1=-1,y1=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>20){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return {x0,y0,x1,y1};};
async function cell(file,fill,size=256){
  const k=keyBlack(await raw(file)),b=bbox(k),bw=b.x1-b.x0+1,bh=b.y1-b.y0+1,side=Math.max(bw,bh),s=size*fill/side;
  const crop=await sharp(k.data,{raw:{width:k.w,height:k.h,channels:4}}).extract({left:b.x0,top:b.y0,width:bw,height:bh}).resize(Math.max(1,Math.round(bw*s)),Math.max(1,Math.round(bh*s)),{kernel:'lanczos3'}).png().toBuffer();
  const m=await sharp(crop).metadata();
  return {input:crop,left:Math.round((size-m.width)/2),top:Math.round((size-m.height)/2)};
}
const cells=[await cell(atk,.94),await cell(ult,.94),await cell(crack,.98)];
await sharp({create:{width:768,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(cells.map((c,i)=>({...c,left:c.left+i*256}))).webp({quality:90,alphaQuality:100,effort:6}).toFile(out);
console.log(out);

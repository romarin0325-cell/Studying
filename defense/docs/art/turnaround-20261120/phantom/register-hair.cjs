'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const base = process.argv[2];
const root = process.env.PHANTOM_TRIAL_DIR || __dirname;
const repo = path.resolve(base, '..', '..', '..', '..');
const sharp = require(path.join(repo, 'node_modules', 'sharp'));
const width = 1024;
const argc = process.argv.slice(3);
const variant = argc[0] || 'A';
const offset = Number(argc[1] || 8);
const cap = Number(argc[2] || 237);
const lateral = Number(argc[3] || 0);
const smooth = Number(argc[4] || 2);
const floor = Number(argc[5] || 172);
const gradual = Number(argc[6] || 0);

function pixel(arr,x,y){return ((y*width+x)*4);}
function color(arr,k,c){const a=arr[k+3]/255;return arr[k+c]*a+115*(1-a);}
async function main(){
 const original=await sharp(base).ensureAlpha().raw().toBuffer();
 const useTreatment=variant.startsWith('T');
 const raw=await sharp(path.join(root,useTreatment?'treatment-registered.png':'imagegen-native.png')).resize(width,width).ensureAlpha().raw().toBuffer();
 const mask=await sharp(path.join(root,'mask.png')).greyscale().raw().toBuffer();
 const output=Buffer.from(original);
 const allowed=Buffer.alloc(width*width);
 const seams=[];
 for(const side of [0,1]){
  const x0=512*side;
  const tunex=side?lateral:-lateral;
  const dx=(useTreatment?0:(side?-1:1))+tunex;
  const dy=offset;
  function loss(x,y){
   const i=pixel(original,x+x0,y+512),j=pixel(raw,x+x0-dx,y+512-dy);
   const a=original[i+3],b=raw[j+3];let diff=.45*Math.abs(a-b);
   for(let c=0;c<3;c++) diff+=Math.abs(color(original,i,c)-color(raw,j,c))*.45;
   const a0=pixel(original,x+x0,511+y),b0=pixel(raw,x+x0-dx,511+y-dy);
   const a2=pixel(original,x+x0,513+y),b2=pixel(raw,x+x0-dx,513+y-dy);
   const g=(Math.abs(color(original,a2,1)-color(original,a0,1))+Math.abs(color(raw,b2,1)-color(raw,b0,1)))*.12;
   return diff+g+Math.abs(y-218)*.10;
  }
  const minx=125,maxx=388,miny=floor,maxy=cap,wx=maxx-minx+1,hy=maxy-miny+1;
  const cost=new Float64Array(wx*hy);const previous=new Int16Array(wx*hy);
  for(let xx=0;xx<wx;xx++)for(let yy=0;yy<hy;yy++){
   const k=xx*hy+yy,x=xx+minx,y=yy+miny;
   let newCost=0,bb=yy;
   if(xx){newCost=Infinity;for(let kk=-2;kk<=2;kk++){const old=yy+kk;if(old<0||old>=hy)continue;const c=cost[(xx-1)*hy+old]+Math.abs(kk)*.98;if(c<newCost){newCost=c;bb=old;}}}
   cost[k]=newCost+loss(x,y);previous[k]=bb;
  }
  let best=0;for(let y=1;y<hy;y++)if(cost[(wx-1)*hy+y]<cost[(wx-1)*hy+best])best=y;
  const seam=Array(wx);for(let xx=wx-1;xx>=0;xx--){seam[xx]=best+miny;best=previous[xx*hy+best];}
  seams.push(seam);
  for(let x=minx;x<=maxx;x++)for(let y=72;y<=250;y++){
   const py=y+512,px=x+x0,i=pixel(original,px,py),j=pixel(raw,px-dx,py-dy);
   if(!mask[py*width+px])continue;
   if((!side&&x>=189&&x<283&&y>=233)||(side&&x>=236&&x<328&&y>=235)||y>=246)continue;
   let z=Math.min(1,Math.max(0,(seam[x-minx]-y+smooth)/(2*smooth)));
   if (gradual) {
    const t = Math.max(0, Math.min(1, (233-y)/gradual));
    z *= t*t*(3-2*t);
   }
   if(z===0)continue;
   const z0=original[i+3]/255*(1-z),z1=raw[j+3]/255*z,alpha=z0+z1;
   if(z===1){raw.copy(output,i,j,j+4);}else{for(let c=0;c<3;c++)output[i+c]=alpha?Math.round((original[i+c]*z0+raw[j+c]*z1)/alpha):0;output[i+3]=Math.round(alpha*255);}
   allowed[py*width+px]=Math.round(z*255);
  }
 }
 const outDir=path.join(root,'registration-studies');fs.mkdirSync(outDir,{recursive:true});
 await sharp(output,{raw:{width,height:width,channels:4}}).png().toFile(path.join(outDir,variant+'.png'));
 await sharp(allowed,{raw:{width,height:width,channels:1}}).png().toFile(path.join(outDir,variant+'-weights.png'));
 const diffs=[0,0,0,0];let outside=0;for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){const k=(y*1024+x)*4;if(!output.subarray(k,k+4).equals(original.subarray(k,k+4))){diffs[(y>=512?2:0)+(x>=512?1:0)]++;if(!allowed[y*1024+x])outside++;}}
 fs.writeFileSync(path.join(outDir,variant+'.json'),JSON.stringify({algorithm:'New upper hair and hair-tip painting from built-in ImageGen; whole-canvas isotropic registration, small integer translations, donor-to-original edge-aware dynamic-programming graph seam within fixed binary permission, alpha transition, immutable face and lower forms.',variant,offset,lateral,cap,smooth,floor,diffs,outside,seams},null,2));
 console.log(JSON.stringify({variant,diffs,outside,ends:seams.map(v=>[Math.min(...v),Math.max(...v)])}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

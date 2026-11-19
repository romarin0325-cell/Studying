const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const repo = path.resolve(__dirname,'../../../../..');
const outputDirectory = path.resolve(process.argv[2]);
fs.mkdirSync(outputDirectory,{recursive:false});
const sharp = createRequire(path.join(repo, 'package.json'))('sharp');
const source = path.join(repo, 'defense/assets/cast-v2/lightning_sage.png');
const sha = b => createHash('sha256').update(b).digest('hex');
const clamp = t => Math.max(0, Math.min(1, t));
const at = (view, x, y) => 4 * ((512 + y) * 1024 + view * 512 + x);
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
function readBilinearY(im,view,x,y){
  const yi=Math.floor(y),frac=y-yi,a=at(view,x,yi),b=at(view,x,yi+1),wa=(1-frac)*im[a+3]/255,wb=frac*im[b+3]/255,cov=wa+wb;
  return [0,1,2].map(k=>cov?(wa*im[a+k]+wb*im[b+k])/cov:0).concat(cov*255);
}
function mixRGBA(a,b,z){
  const wa=(1-z)*a[3]/255,wb=z*b[3]/255,cov=wa+wb;
  return [0,1,2].map(k=>cov?Math.round((wa*a[k]+wb*b[k])/cov):0).concat(Math.round(cov*255));
}

function findCapSeam(base, native, view, dx, dy) {
  const from = 170, to = 213, n = to-from+1;
  const back = new Int16Array(512*n);
  let prior = new Float64Array(n);
  const pix = (b,i,c) => b[i+c]*b[i+3]/255+105*(1-b[i+3]/255);
  for(let x=119;x<390;x++) {
    const cost=new Float64Array(n);
    for(let y=from;y<=to;y++){
      const a=at(view,x,y), b=at(view,x-dx,y-dy);
      let e=Math.abs(base[a+3]-native[b+3])*0.7+Math.abs(y-193)*0.25;
      for(let c=0;c<3;c++)e+=Math.abs(pix(base,a,c)-pix(native,b,c))/4;
      let best=Infinity, bestJ=y-from;
      for(let j=Math.max(0,y-from-2);j<=Math.min(n-1,y-from+2);j++){
        const v=prior[j]+2*Math.abs(j-y+from);
        if(v<best){best=v;bestJ=j;}
      }
      cost[y-from]=e+best;back[x*n+y-from]=bestJ;
    }
    prior=cost;
  }
  let pos=0; for(let j=1;j<n;j++)if(prior[j]<prior[pos])pos=j;
  const seq=new Array(512).fill(193);
  for(let x=389;x>=119;x--){seq[x]=from+pos;pos=back[x*n+pos];}
  return seq;
}

async function make() {
  const tb=await sharp(source).ensureAlpha().raw().toBuffer();
  const nativeFile=path.join(__dirname,'native.png');
  const native=await sharp(nativeFile).resize(1024,1024,{kernel:'lanczos3'}).ensureAlpha().raw().toBuffer();
  const pre=await sharp(path.join(__dirname,'allowed-mask.png')).greyscale().raw().toBuffer();
  const registered=Buffer.from(tb), mask=Buffer.alloc(1024*1024);
  const transforms=[[-6,14],[5,14]];
  const jawTransforms=[[0,5],[-1,5]];
  const seams=[];
  for(let view=0;view<2;view++){
    const [dx,dy]=transforms[view];const seam=findCapSeam(tb,native,view,dx,dy);seams.push(seam);
    const jawStart=new Array(512),oldFloor=new Array(512),generatedFloor=new Array(512);
    for(let x=0;x<512;x++){
      const X=view?512-x:x;
      const floors=[];
      for(const [im,mx,my] of [[tb,0,0],[native,...jawTransforms[view]]]){
        let seen=false,floor;
        for(let y=268;y<316;y++){
          const al=im[at(view,x-mx,y-my)+3];
          if(al>=190)seen=true;
          if(al<=40&&seen){floor=y-1;break;}
        }
        floors.push(floor);
      }
      const fallback=view?297-.36*Math.max(0,X-239):300-.35*Math.max(0,X-232);
      oldFloor[x]=floors[0]??fallback;generatedFloor[x]=floors[1]??oldFloor[x];
      jawStart[x]=Math.max(view?277:282,oldFloor[x]-6);
    }
    for(let y=87;y<=315;y++)for(let x=125;x<388;x++){
      const t=at(view,x,y), [mx,my]=y>260?jawTransforms[view]:[dx,dy], s=at(view,x-mx,y-my);
      if(!pre[t/4])continue;
      const X=view?512-x:x;
      let w=0,outerJoin=null;
      if(y<217){
        const minX=view?Math.max(160,167+.49*(y-137)):Math.max(158,147+.54*(y-132));
        const sides=smooth((X-minX)/6)*smooth((376-X)/7);
        w=sides*smooth((seam[x]+4-y)/8);
      } else if(y>276) {
        const end=view?239:233,begin=view?216:210;
        if(X>=end)continue;
        const nearSpear=view?201+7*smooth((y-295)/15):190+8*smooth((y-295)/15);
        if(X<=nearSpear||X>267)continue;
        const sides=smooth((X-nearSpear)/4)*smooth((268-X)/11);
        w=sides*smooth((y-jawStart[x])/3);
        if(X>begin){
          const z=1-smooth((X-begin)/(end-begin)),dy=generatedFloor[x]-oldFloor[x];
          const old=readBilinearY(tb,view,x,y-z*dy),fresh=readBilinearY(native,view,x-mx,y-my+(1-z)*dy);
          outerJoin=mixRGBA(old,fresh,z);
        }
      }
      const m=Math.round(w*255);if(!m)continue;
      mask[t/4]=m;
      if(outerJoin)outerJoin.forEach((c,k)=>registered[t+k]=c);else native.copy(registered,t,s,s+4);
    }
  }
  const softened=await sharp(mask,{raw:{width:1024,height:1024,channels:1}}).png().toBuffer();
  const regPng=await sharp(registered,{raw:{width:1024,height:1024,channels:4}}).png().toBuffer();
  fs.writeFileSync(path.join(outputDirectory,'registered-native.png'),regPng);
  fs.writeFileSync(path.join(outputDirectory,'registration-mask.png'),softened);
  const out=Buffer.from(tb); let changes=0,locked=0;
  for(let j=0;j<mask.length;j++){const i=j*4,m=mask[j]/255;if(!m)continue;
    const a0=tb[i+3]/255,a1=registered[i+3]/255,a=(1-m)*a0+m*a1;
    for(let c=0;c<3;c++)out[i+c]=a?Math.round(((1-m)*a0*tb[i+c]+m*a1*registered[i+c])/a):0;
    out[i+3]=Math.round(a*255);
    if(!tb.subarray(i,i+4).equals(out.subarray(i,i+4)))changes++;
  }
  for(let j=0;j<pre.length;j++)if(!pre[j]&&!tb.subarray(4*j,4*j+4).equals(out.subarray(4*j,4*j+4)))locked++;
  if(locked)throw Error('Protected pixel mutation '+locked);
  const png=await sharp(out,{raw:{width:1024,height:1024,channels:4}}).png().toBuffer();
  fs.writeFileSync(path.join(outputDirectory,'candidate-working.png'),png);
  const digest=sha(png),record={sourceHash:sha(fs.readFileSync(source)),nativeHash:sha(fs.readFileSync(nativeFile)),nativeSize:1254,registeredCanvas:1024,crownTranslationsNativeToBase:transforms,jawTranslationsNativeToBase:jawTransforms,method:'Isotropic native atlas normalization, then integer translation of two disconnected patches per side. Low-gradient hair seams and cheek coverage stay in the frozen aperture. A 23-pixel wide contact interval toward the existing collar co-registers just the two translucent jaw outlines by their sampled lower alpha edge before mixing. No skull, face or whole-view rescaling. Ocular band, upper two views, hands, cloak and feet are locked.',contactIntervals:{leftFaceX:[210,233],rightFaceX:[273,296],originalRightCoordinateReflectedAround:512},originalSource:source,preMaskSha256:sha(fs.readFileSync(path.join(__dirname,'allowed-mask.png'))),registeredNativeSha256:sha(regPng),weightedMaskSha256:sha(softened),candidateSha256:digest,changedPixels:changes,changedOutsideFrozenMask:locked};
  fs.writeFileSync(path.join(outputDirectory,'registration.json'),JSON.stringify(record,null,2)+'\n');
  const before=await sharp(source).png().toBuffer();const parts=[];
  for(let r=0;r<2;r++)for(let v=0;v<2;v++){let pic=await sharp(r?png:before).extract({left:128+v*512,top:602,width:255,height:246}).flatten({background:'#657385'}).png().toBuffer();parts.push({input:pic,left:255*v,top:246*r});}
  await sharp({create:{width:510,height:492,channels:3,background:'#657385'}}).composite(parts).png().toFile(path.join(outputDirectory,'registration-side-review.png'));
  console.log(record);
}
make().catch(err=>{console.error(err);process.exitCode=1});

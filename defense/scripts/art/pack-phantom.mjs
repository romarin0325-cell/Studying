// Reproduce the reviewed correction from its preserved generation and landmarks.
// It writes sibling pajama assets; never overwrites the prior Phantom master.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {gameRoot} from '../local-inputs.mjs';
const dir=path.join(gameRoot,'docs/art/phantom-20261024'),source=await fs.readFile(path.join(dir,'generation.png'));
const spec=JSON.parse(await fs.readFile(path.join(dir,'landmarks.json'),'utf8'));
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
if(info.width!==1254||info.height!==1254)throw Error('Recheck landmarks for this source size');
const before=Buffer.from(data);let alphaCleaned=0;
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  const i=(y*info.width+x)*4,a=before[i+3];if(a>=250){data[i+3]=255;continue;}if(!a)continue;
  let keep=a>=128;
  if(!keep&&a>=8)for(let dy=-3;dy<=3&&!keep;dy++)for(let dx=-3;dx<=3;dx++){
    const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<info.width&&yy<info.height&&before[(yy*info.width+xx)*4+3]>=128){keep=true;break;}
  }
  if(!keep){data[i+3]=0;alphaCleaned++;}
}
const scale=Math.sqrt(160*150/(spec.ellipses[0][2]*spec.ellipses[0][3])),layers=[],frames=[];
for(const [v,direction] of ['down','up','left','right'].entries()){
  const rect=spec.rects[v],qx=rect.left,qy=rect.top,sole=spec.feet[v],e=spec.ellipses[v],chin=spec.chins[v];
  const raw=await sharp(data,{raw:info}).extract(rect).resize(Math.round(rect.width*scale),Math.round(rect.height*scale)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const left=Math.round(256-(sole[0]-qx)*scale),top=Math.round(480-(sole[1]-qy)*scale);let paintedClipping=0;
  for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++)if((x+left<0||x+left>=512||y+top<0||y+top>=512)&&raw.data[(y*raw.info.width+x)*4+3]>=32)paintedClipping++;
  if(paintedClipping)throw Error(direction+' painted clipping; do not silhouette-fit');
  const x0=Math.max(0,-left),y0=Math.max(0,-top);
  const piece=await sharp(raw.data,{raw:raw.info}).extract({left:x0,top:y0,width:Math.min(raw.info.width-x0,512-Math.max(0,left)),height:Math.min(raw.info.height-y0,512-Math.max(0,top))}).png().toBuffer();
  layers.push({input:piece,left:v%2*512+Math.max(0,left),top:Math.floor(v/2)*512+Math.max(0,top)});
  const transform=p=>[256+(p[0]-sole[0])*scale,480+(p[1]-sole[1])*scale].map(n=>+n.toFixed(2));
  frames.push({direction,sourceEllipse:e,sourceChin:chin,sourceSole:sole,sourceRect:rect,commonScale:scale,placement:[left,top],ellipse:[...transform(e),+(e[2]*scale).toFixed(2),+(e[3]*scale).toFixed(2),e[4]],chin:transform(chin),sole:[256,480],belowChin:+((sole[1]-chin[1])*scale).toFixed(2),paintedClipping});
}
const png=await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
const webp=await sharp(png).webp({quality:95,alphaQuality:100,effort:6}).toBuffer(),hash=b=>createHash('sha256').update(b).digest('hex');
const assets=path.join(gameRoot,'assets/cast-v2');
await fs.writeFile(path.join(assets,'phantom-pajamas-guided.png'),png);await fs.writeFile(path.join(assets,'phantom-pajamas-guided.webp'),webp);
await fs.writeFile(path.join(dir,'packing.json'),JSON.stringify({id:'phantom',version:'pajamas-guided-v2',sourceSha256:hash(source),commonScale:scale,method:spec.method,alphaCleaned,uncertaintySourcePixels:spec.uncertaintySourcePixels,measurementUncertaintyPacked:18*scale,
  sourcePng:{file:'defense/assets/cast-v2/phantom-pajamas-guided.png',bytes:png.length,sha256:hash(png)},sourceWebp:{file:'defense/assets/cast-v2/phantom-pajamas-guided.webp',bytes:webp.length,sha256:hash(webp)},frames},null,2)+'\n');
console.log(JSON.stringify({head:frames[0].ellipse,belowChin:frames.map(f=>f.belowChin),bytes:webp.length,alphaCleaned}));

// Manual art preparation, following Sol Cast V2's anatomical scale/translation recipe.
// Sources, prompts and manual landmarks are preserved next to the packing manifest.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {gameRoot} from '../local-inputs.mjs';
import {segment} from './source-views.mjs';
const dir=path.join(gameRoot,'docs/art/demon-miracle'),out=path.join(gameRoot,'assets/cast-v2');
const spec=JSON.parse(await fs.readFile(path.join(dir,'landmarks.json'),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const records=[];
await fs.mkdir(out,{recursive:true});
for(const item of spec.assets){
  const source=await fs.readFile(path.join(dir,item.id+'-generation.png'));
  const segmented=await segment(path.join(dir,item.id+'-generation.png')),info=segmented.info;
  if(info.width!==1254||info.height!==1254)throw Error('Recheck source landmarks: '+item.id);
  const alphaCleaned=segmented.metadata.alphaCleaned;
  const scale=Math.sqrt(160*150/(item.ellipses[0][2]*item.ellipses[0][3])),layers=[],frames=[];
  for(const [i,direction] of ['down','up','left','right'].entries()){
    const b=segmented.bounds[i],rect={left:b[0],top:b[1],width:b[2]-b[0]+1,height:b[3]-b[1]+1};
    const sole=item.feet[i],ellipse=item.ellipses[i],chin=item.chins[i];
    const raw=await sharp(segmented.pixels[i],{raw:info}).extract(rect).resize(Math.round(rect.width*scale),Math.round(rect.height*scale)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const left=Math.round(256-(sole[0]-rect.left)*scale),top=Math.round(480-(sole[1]-rect.top)*scale);
    let clipped=0;
    for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++)if((x+left<0||x+left>=512||y+top<0||y+top>=512)&&raw.data[(y*raw.info.width+x)*4+3]>=32)clipped++;
    if(clipped)throw Error(item.id+' '+direction+' painted clipping: '+clipped+'; do not silhouette-fit');
    const x0=Math.max(0,-left),y0=Math.max(0,-top);
    const piece=await sharp(raw.data,{raw:raw.info}).extract({left:x0,top:y0,width:Math.min(raw.info.width-x0,512-Math.max(0,left)),height:Math.min(raw.info.height-y0,512-Math.max(0,top))}).png().toBuffer();
    layers.push({input:piece,left:i%2*512+Math.max(0,left),top:Math.floor(i/2)*512+Math.max(0,top)});
    const transform=p=>[256+(p[0]-sole[0])*scale,480+(p[1]-sole[1])*scale].map(n=>+n.toFixed(2));
    frames.push({direction,sourceRect:rect,sourceEllipse:ellipse,sourceChin:chin,sourceSole:sole,commonScale:scale,ellipse:[...transform(ellipse),+(ellipse[2]*scale).toFixed(2),+(ellipse[3]*scale).toFixed(2),ellipse[4]],chin:transform(chin),sole:[256,480],belowChin:+((sole[1]-chin[1])*scale).toFixed(2),paintedClipping:clipped});
  }
  const png=await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
  const webp=await sharp(png).webp({quality:95,alphaQuality:100,effort:6}).toBuffer();
  await fs.writeFile(path.join(out,item.id+'.png'),png);await fs.writeFile(path.join(out,item.id+'.webp'),webp);
  records.push({id:item.id,group:item.group,sourceSha256:hash(source),commonScale:scale,alphaCleaned,segmentation:segmented.metadata,measurementUncertaintyPacked:18*scale,sourcePng:{file:'defense/assets/cast-v2/'+item.id+'.png',bytes:png.length,sha256:hash(png)},sourceWebp:{file:'defense/assets/cast-v2/'+item.id+'.webp',bytes:webp.length,sha256:hash(webp)},frames});
}
await fs.writeFile(path.join(dir,'packing.json'),JSON.stringify({method:spec.method,uncertaintySourcePixels:spec.uncertaintySourcePixels,assets:records},null,2)+'\n');
console.log(JSON.stringify(records.map(r=>({id:r.id,scale:r.commonScale,belowChin:r.frames.map(f=>f.belowChin),clipped:r.frames.some(f=>f.paintedClipping)}))));

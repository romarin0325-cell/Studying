import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const dir=path.dirname(fileURLToPath(import.meta.url));
process.env.DEFENSE_ART_PACKAGE_JSON=path.join(path.resolve(process.argv[2]),'package.json');
const {sharp,segment,names}=await import('./source-views.mjs');
const spec=JSON.parse(await fs.readFile(path.join(dir,'landmarks.json')));
const source=await fs.readFile(path.join(dir,'generation.png')),r=await segment(path.join(dir,'generation.png'));
const scale=Math.sqrt(160*150/(spec.ellipses[0][2]*spec.ellipses[0][3]));
const layers=[],frames=[],hash=b=>createHash('sha256').update(b).digest('hex');
await fs.mkdir(path.join(dir,'directions'),{recursive:true});
for(let v=0;v<4;v++){
 const b=r.bounds[v],rect={left:b[0],top:b[1],width:b[2]-b[0]+1,height:b[3]-b[1]+1};
 const raw=await sharp(r.pixels[v],{raw:r.info}).extract(rect).resize({width:Math.round(rect.width*scale)}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const left=Math.round(256+(b[0]-spec.feet[v][0])*scale),top=Math.round(480+(b[1]-spec.feet[v][1])*scale);let clipping=0;
 for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++)if((x+left<0||x+left>=512||y+top<0||y+top>=512)&&raw.data[(y*raw.info.width+x)*4+3]>=32)clipping++;
 if(clipping)throw Error(names[v]+' painted pixels clipped; do not shrink to fit ornaments');
 const cx=Math.max(0,-left),cy=Math.max(0,-top);
 const paint=await sharp(raw.data,{raw:raw.info}).extract({left:cx,top:cy,width:Math.min(raw.info.width-cx,512-Math.max(0,left)),height:Math.min(raw.info.height-cy,512-Math.max(0,top))}).png().toBuffer();
 layers.push({input:paint,left:v%2*512+Math.max(0,left),top:Math.floor(v/2)*512+Math.max(0,top)});
 const point=p=>[256+(p[0]-spec.feet[v][0])*scale,480+(p[1]-spec.feet[v][1])*scale].map(x=>+x.toFixed(2)),e=spec.ellipses[v];
 frames.push({direction:names[v],sourceRect:rect,sourceEllipse:e,sourceChin:spec.chins[v],sourceSole:spec.feet[v],commonScale:scale,
  placement:[left,top],resampledDimensions:[raw.info.width,raw.info.height],ellipse:[...point(e),+(e[2]*scale).toFixed(2),+(e[3]*scale).toFixed(2),e[4]],
  chin:point(spec.chins[v]),sole:[256,480],belowChin:+((spec.feet[v][1]-spec.chins[v][1])*scale).toFixed(2),paintedClipping:clipping});
}
const png=await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
const outputs=new Map([
 ['gold_dragon.png',png],
 ['gold_dragon.webp',await sharp(png).webp({quality:95,alphaQuality:100,effort:6}).toBuffer()],
 ['gold_dragon-mobile.webp',await sharp(png).resize(512).webp({quality:94,alphaQuality:100,effort:6}).toBuffer()],
 ['gold_dragon-runtime.webp',await sharp(png).resize(640).webp({quality:90,alphaQuality:100,effort:6}).toBuffer()],
]);
for(const [file,bytes] of outputs)await fs.writeFile(path.join(dir,file),bytes);
for(let v=0;v<4;v++)await sharp(png).extract({left:v%2*512,top:Math.floor(v/2)*512,width:512,height:512}).png().toFile(path.join(dir,'directions',names[v]+'.png'));
const p={x:Math.round(frames[0].ellipse[0]),y:Math.round(frames[0].ellipse[1]),size:250};
await sharp(png).extract({left:Math.round(p.x-p.size/2),top:Math.round(p.y-p.size/2),width:p.size,height:p.size}).resize(240).webp({quality:84,alphaQuality:100,effort:6}).toFile(path.join(dir,'portrait-preview.webp'));
const record={id:'gold_dragon',status:'New four-direction asset, not installed in the game',version:'guided-gold-v2-20261028',
 sourceSha256:hash(source),commonScale:scale,uncertaintySourcePixels:spec.uncertaintySourcePixels,measurementUncertaintyPacked:18*scale,
 structure:{type:'feminine',height:'tall',targetSkull:[160,150],targetBelowChin:200},portrait:p,
 alpha:r.metadata,frames,files:Object.fromEntries([...outputs].map(([f,b])=>[f,{bytes:b.length,sha256:hash(b)}]))};
await fs.writeFile(path.join(dir,'packing.json'),JSON.stringify(record,null,2)+'\n');
const v1=await fs.readFile(path.join(dir,'generation-v1.png'));
await fs.writeFile(path.join(dir,'selection.json'),JSON.stringify({selected:'generation.png',selectedSha256:hash(source),
 v1:{file:'generation-v1.png',sha256:hash(v1),prompt:'prompt-v1.txt',reason:'Front tail appeared on a different anatomical side from the back view.'},
 v2:{file:'generation.png',prompt:'refinement-prompt-v2.txt',target:'generation-v1.png',targetSha256:hash(v1),
  note:'Target file preserved before editing; this SHA recorded after the edit. V2 corrects the front tail to screen-left; back stays screen-right. No frame-level manual art repainting or equipment mirroring.'},
 limitations:['Rear costume construction is inferred from the frontal original.','Separate 2D views from a structural reference, not a fully rigged 3D character.']},null,2)+'\n');
console.log(JSON.stringify({scale,head:frames[0].ellipse,body:frames.map(f=>f.belowChin),files:record.files},null,2));

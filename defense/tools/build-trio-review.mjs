import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url)),doc=path.join(root,'defense/docs/art/trio'),out=path.join(doc,'review');
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile(path.join(root,'defense/assets/merge/units/manifest.json'),'utf8'));
const entries=JSON.parse(await readFile(path.join(doc,'LANDMARKS.json'),'utf8')),ids=entries.map(e=>e.id);
const svg=(w,h,s)=>Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'">'+s+'</svg>');
const label=(x,y,s,size=13,color='#dce9eb')=>'<text x="'+x+'" y="'+y+'" font-family="Arial, Malgun Gothic" font-size="'+size+'" fill="'+color+'">'+s+'</text>';
async function cell(id,d,size){return sharp(path.join(root,'defense/assets/merge/units',id+'.webp')).extract({left:d%2*512,top:Math.floor(d/2)*512,width:512,height:512}).resize(size,size).png().toBuffer();}
const compare=['zeke','rumi','night_rabbit','mushroom_king','lightning_sage',...ids];
for(const size of [64,96])for(const light of [false,true]){
  const w=compare.length*140,h=480,layers=[],labels=[];
  for(let row=0;row<4;row++)for(let i=0;i<compare.length;i++){
    const id=compare[i],x=i*140+(140-size)/2,y=30+row*107;
    layers.push({input:await cell(id,row,size),left:x,top:y});
    labels.push('<path d="M'+(i*140+8)+' '+(y+size*480/512)+'h124" stroke="#a9cbb34d"/>');
    labels.push(label(i*140+6,y+size+16,id,10,light?'#254351':'#dce9eb'));
  }
  await sharp({create:{width:w,height:h,channels:3,background:light?'#ece7d9':'#213d49'}}).composite([{input:svg(w,h,labels.join('')),left:0,top:0},...layers]).png().toFile(path.join(out,'common-floor-'+size+(light?'-light':'')+'.png'));
}
const rows=Math.ceil(manifest.frames.length/7),allW=7*145,allH=rows*140,layers=[];
for(let i=0;i<manifest.frames.length;i++){
  const id=manifest.frames[i].id,x=i%7*145,y=Math.floor(i/7)*140;
  layers.push({input:await cell(id,0,96),left:x+24,top:y+4},{input:svg(145,140,label(5,124,id,11)),left:x,top:y});
}
await sharp({create:{width:allW,height:allH,channels:3,background:'#213d49'}}).composite(layers).png().toFile(path.join(out,'all-31-forms.png'));
const measurements=[];
for(const e of entries){
  const m=manifest.frames.find(f=>f.id===e.id),marks=[],dir=[];
  for(let i=0;i<4;i++){
    const [a,b,c,d]=e.anatomy.directionSkulls[i],[fx,fy]=e.feet[i],dx=i%2*627,dy=Math.floor(i/2)*627;
    marks.push('<rect x="'+(dx+a)+'" y="'+(dy+b)+'" width="'+(c-a)+'" height="'+(d-b)+'" fill="none" stroke="#f4d574" stroke-width="2"/>');
    marks.push('<path d="M'+(dx+fx-24)+' '+(dy+fy)+'h48 M'+(dx+fx)+' '+(dy+fy-10)+'v20" stroke="#a6f8e1" stroke-width="3"/>');
    marks.push(label(dx+15,dy+26,['DOWN','UP','LEFT','RIGHT'][i]+' | skull estimate / feet',16));
    dir.push({direction:['down','up','left','right'][i],skullWidth:+((c-a)*m.source.scale).toFixed(1),skullHeight:+((d-b)*m.source.scale).toFixed(1),chinToFoot:+((fy-d)*m.source.scale).toFixed(1),uncertaintyPxPacked:+(10*m.source.scale).toFixed(1)});
  }
  await sharp(path.join(doc,'sources',e.file)).flatten({background:'#294957'}).composite([{input:svg(1254,1254,marks.join(''))}]).png().toFile(path.join(out,e.id+'-landmarks.png'));
  measurements.push({id:e.id,sourceSha256:e.sourceSha256,atlasSha256:m.sha256,uniformScale:m.source.scale,front:m.anatomy,directions:dir});
}
await writeFile(path.join(out,'measurements.json'),JSON.stringify({method:'Manual reconstructed anatomy, not hair silhouette; estimates have roughly +/- 10 source-pixel uncertainty. One uniform scale per character and no direction-specific scaling.',measurements},null,2)+'\n');
if(process.argv[2]){
  const refs=[['frost_witch','혹한의마녀.png'],['harmonious','하모니어스.png'],['aurora','퍼펙트아우로라.png']],layers=[],referenceHashes=[];
  for(let i=0;i<refs.length;i++){const [id,file]=refs[i],bytes=await readFile(path.join(process.argv[2],file));
    referenceHashes.push({id,file,sha256:createHash('sha256').update(bytes).digest('hex')});
    layers.push({input:await sharp(bytes).resize(220,420,{fit:'contain',background:'#213d49'}).png().toBuffer(),left:i*480,top:35});
    layers.push({input:await cell(id,0,256),left:i*480+220,top:118});
    layers.push({input:svg(480,480,label(12,22,id+' | original / SD',17)),left:i*480,top:0});
  }
  await sharp({create:{width:1440,height:480,channels:3,background:'#213d49'}}).composite(layers).png().toFile(path.join(out,'costume-reference.png'));
  await writeFile(path.join(doc,'REFERENCE_HASHES.json'),JSON.stringify(referenceHashes,null,2)+'\n');
}
console.log(JSON.stringify(measurements.map(x=>({id:x.id,head:[x.front.headWidth,x.front.headHeight],body:x.front.bodyBelowChin,directions:x.directions})),null,2));

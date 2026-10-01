import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {HERO} from '../merge/content.js';

const base=fileURLToPath(new URL('../',import.meta.url)),out=path.join(base,'docs/art/expansion/review');
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile(path.join(base,'assets/merge/units/manifest.json'),'utf8'));
const names=['down','up','left','right'],frames=manifest.frames;
const review=[];
for(const m of frames){
  const bytes=await readFile(path.join(base,'assets/merge/units',m.file));
  if(createHash('sha256').update(bytes).digest('hex')!==m.sha256)throw new Error(m.id+' review source changed');
  const boxes=m.source.anatomy.directionSkulls?.map((box,i)=>box.map((n,j)=>m.anchor[j%2]+(n-m.source.feet[i][j%2])*m.source.scale));
  review.push({id:m.id,name:HERO[m.id]?.name||'트라우마',sha256:m.sha256,boxes:boxes||[m.anatomy.packedSkull],
    headWidth:m.anatomy.headWidth,headHeight:m.anatomy.headHeight,body:m.anatomy.bodyBelowChin,
    uncertainty:m.anatomy.uncertainty,allDirectionsEstimated:!!boxes});
}
// Every atlas is sampled at the SAME scale. Never trim or fit a silhouette.
for(let d=0;d<4;d++)for(const guided of [false,true]){
  const w=1120,h=800,layers=[];let labels='';
  for(let n=0;n<frames.length;n++){
    const f=frames[n],r=review[n],x=n%7*160,y=Math.floor(n/7)*200;
    layers.push({input:await sharp(path.join(base,'assets/merge/units',f.file)).extract({left:d%2*512,top:Math.floor(d/2)*512,width:512,height:512}).resize(160,160).png().toBuffer(),left:x,top:y+24});
    labels+=`<text x="${x+80}" y="${y+20}" text-anchor="middle">${r.name}</text><path d="M${x+4} ${y+174}h152" stroke="#d6b374" opacity=".45"/>`;
    if(guided&&r.boxes[d]){const [l,t,rr,b]=r.boxes[d],k=160/512;labels+=`<ellipse cx="${x+(l+rr)/2*k}" cy="${y+24+(t+b)/2*k}" rx="${(rr-l)/2*k}" ry="${(b-t)/2*k}" fill="none" stroke="#72dfce" stroke-width="1.2"/>`;}
  }
  layers.push({input:Buffer.from(`<svg width="${w}" height="${h}"><g font-family="Malgun Gothic,Arial" font-size="14" fill="#eee7d4">${labels}</g></svg>`)});
  await sharp({create:{width:w,height:h,channels:4,background:'#263f4c'}}).composite(layers).png().toFile(path.join(out,names[d]+(guided?'-landmarks':'')+'.png'));
}
// Actual small-cell comparison, with both dark and light ground. 64px is
// close to the ~126 logical px sprite shown on a portrait phone arena.
for(const size of [64,96]){
  const w=7*(size+20),rh=size+30,h=rh*8,layers=[];let labels='';
  for(let n=0;n<frames.length;n++)for(let theme=0;theme<2;theme++){
    const x=n%7*(size+20)+10,y=Math.floor(n/7)*rh+theme*rh*4;
    layers.push({input:await sharp(path.join(base,'assets/merge/units',frames[n].file)).extract({left:0,top:0,width:512,height:512}).resize(size,size).png().toBuffer(),left:x,top:y+20});
    labels+=`<text x="${x+size/2}" y="${y+14}" text-anchor="middle" fill="${theme?'#243d4a':'#eee7d4'}">${review[n].name}</text>`;
  }
  layers.unshift({input:Buffer.from(`<svg width="${w}" height="${h}"><rect y="${rh*4}" width="${w}" height="${rh*4}" fill="#ebe5d6"/></svg>`)});
  layers.push({input:Buffer.from(`<svg width="${w}" height="${h}"><g font-family="Malgun Gothic,Arial" font-size="10">${labels}</g></svg>`)});
  await sharp({create:{width:w,height:h,channels:4,background:'#263f4c'}}).composite(layers).png().toFile(path.join(out,'phone-'+size+'.png'));
}
await writeFile(path.join(out,'measurements.json'),JSON.stringify({note:'Manual anatomical estimates, not automatic detections. Front size is normalized by construction, not independent visual approval. Existing art is unchanged; only new forms have fresh four-view estimates. No fitting to hair/ears/outfits.',frames:review},null,2)+'\n');
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>28종 SD 비율 검수</title><style>*{box-sizing:border-box}body{background:#263f4c;color:#eee7d4;font:14px/1.6 system-ui;padding:20px}header{position:sticky;top:0;padding:12px;background:inherit;z-index:1}h1{font-size:22px}button,select{padding:9px;font:inherit;margin:5px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}article{border:1px solid #7895a150;border-radius:10px;text-align:center;padding:8px}canvas{display:block;margin:auto}small{display:block}.light{background:#ebe5d6;color:#263f4c}</style><header><h1>27명 + 트라우마 · 같은 배율 / 같은 발 기준</h1><p>머리는 두개부와 얼굴. 귀·모자·헤어 부피 제외. 추정선은 가려진 해부 경계의 수동 추정이며 자동 합격 표시가 아닙니다.</p><select id="direction"><option value="0">정면</option><option value="1">후면</option><option value="2">좌측</option><option value="3">우측</option></select><select id="size"><option>64</option><option>96</option><option selected>160</option><option>256</option></select><label><input id="guide" type="checkbox">두개부 추정선</label><button id="theme">배경 전환</button></header><main></main><script>const rows=${JSON.stringify(review)};const images=new Map();const main=document.querySelector('main');for(const row of rows){const a=document.createElement('article');a.innerHTML='<b>'+row.name+'</b><canvas></canvas><small>정면 추정 '+row.headWidth+' × '+row.headHeight+'</small><small>턱 아래 '+row.body+' px</small>';a.dataset.id=row.id;main.append(a);const img=new Image();images.set(row.id,img);img.onload=draw;img.src='../../../../assets/merge/units/'+row.id+'.webp';}function draw(){const d=+document.querySelector('#direction').value,s=+document.querySelector('#size').value;for(const a of main.children){const row=rows.find(r=>r.id===a.dataset.id),cv=a.querySelector('canvas'),ctx=cv.getContext('2d'),img=images.get(row.id);cv.width=cv.height=s*2;cv.style.width=cv.style.height=s+'px';if(!img?.naturalWidth)continue;ctx.drawImage(img,d%2*512,Math.floor(d/2)*512,512,512,0,0,s*2,s*2);const k=s*2/512;ctx.strokeStyle='#c99f66';ctx.beginPath();ctx.moveTo(0,480*k);ctx.lineTo(s*2,480*k);ctx.stroke();if(document.querySelector('#guide').checked&&row.boxes[d]){const[l,t,r,b]=row.boxes[d];ctx.strokeStyle='#4dd8bd';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse((l+r)/2*k,(t+b)/2*k,(r-l)/2*k,(b-t)/2*k,0,0,Math.PI*2);ctx.stroke();}}}for(const e of document.querySelectorAll('select,input'))e.onchange=draw;document.querySelector('#theme').onclick=()=>document.body.classList.toggle('light');</script></html>`;
await writeFile(path.join(out,'index.html'),html);
console.log('Wrote four-direction / 64px / 96px comparisons for '+frames.length+' forms.');

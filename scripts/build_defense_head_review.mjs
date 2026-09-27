import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {HEROES} from '../defense/merge/content.js';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function validBox(box){return Array.isArray(box)&&box.length===4&&box.every(Number.isFinite)&&box[2]>box[0]&&box[3]>box[1];}
export function previousSkullBox(previous,annotation){
  const skull=previous.source?.anatomy?.skull;
  if(skull!==undefined){
    const feet=previous.source.feet?.[0],anchor=previous.anchor,scale=previous.source.scale;
    if(!validBox(skull)||!feet?.every(Number.isFinite)||feet.length!==2||!anchor?.every(Number.isFinite)||anchor.length!==2||!Number.isFinite(scale)||scale<=0)throw new Error(`${previous.id}: invalid previous skull transform`);
    return skull.map((n,i)=>anchor[i%2]+(n-feet[i%2])*scale);
  }
  // Legacy snapshots contain no anatomical annotations. Use an explicitly
  // recorded estimate on that old atlas, never landmarks from the current art.
  if(annotation?.id!==previous.id||annotation.atlasSha256!==previous.sha256||!validBox(annotation.packedSkull))throw new Error(`${previous.id}: previous skull landmarks missing; supply a hash-bound annotation of the previous atlas`);
  return [...annotation.packedSkull];
}

export async function buildHeadReview({beforeDir,out,beforeLandmarksPath}){
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!beforeDir||!out)throw new Error('Usage: node scripts/build_defense_head_review.mjs BEFORE_ATLAS_DIRECTORY OUTPUT_DIRECTORY [BEFORE_LANDMARKS_JSON]');
await mkdir(out,{recursive:true});
const currentDir=path.join(root,'defense/assets/merge/units');
const now=JSON.parse(await readFile(path.join(currentDir,'manifest.json'),'utf8'));
const old=JSON.parse(await readFile(path.join(beforeDir,'manifest.json'),'utf8'));
const annotations=beforeLandmarksPath?JSON.parse(await readFile(beforeLandmarksPath,'utf8')).frames:[];
const data=[];
for(const hero of HEROES){
  const m=now.frames.find(f=>f.id===hero.id),prev=old.frames.find(f=>f.id===hero.id);
  if(!m||!prev)throw new Error(`${hero.id}: missing before/after manifest entry`);
  const a=m.anatomy;
  const before=await readFile(path.join(beforeDir,prev.file)),after=await readFile(path.join(currentDir,m.file));
  if(sha(before)!==prev.sha256||sha(after)!==m.sha256)throw new Error(`${hero.id}: atlas differs from its recorded snapshot hash`);
  const oldBox=previousSkullBox(prev,annotations.find(e=>e.id===hero.id));
  const oldBoxProvenance=prev.source.anatomy?.skull!==undefined?'previous source skull landmarks':'manual estimate on hash-bound previous atlas; legacy source had no anatomy record';
  data.push({id:hero.id,name:hero.name,before:`data:image/webp;base64,${before.toString('base64')}`,after:`data:image/webp;base64,${after.toString('base64')}`,oldBox,oldBoxProvenance,box:a.packedSkull,width:a.headWidth,height:a.headHeight,body:a.bodyBelowChin,oldBytes:before,newBytes:after});
}
async function sheet(items,file,{guide=false,both=false,cols=7}={}){
  const cw=256,ch=310,rows=Math.ceil(items.length/cols),half=rows*ch,height=both?half*2+48:half+44;
  const layers=[];let marks='';
  for(let n=0;n<items.length;n++){
    const item=items[n];
    for(let phase=0;phase<(both?2:1);phase++){
      const isOld=both&&phase===0,x=n%cols*cw,y=Math.floor(n/cols)*ch+phase*(half+24);
      const bytes=isOld?item.oldBytes:item.newBytes,box=isOld?item.oldBox:item.box;
      const frame=await sharp(bytes).extract({left:0,top:0,width:512,height:512}).resize(256,256).png().toBuffer();
      layers.push({input:frame,left:x,top:y+24});
      marks+=`<text x="${x+128}" y="${y+22}" text-anchor="middle">${item.name}${both?(isOld?' · 이전':' · 교정'):''}</text><path d="M${x+12} ${y+264}H${x+244}" stroke="#ddb76f" stroke-opacity=".45"/>`;
      if(guide){const [l,t,r,b]=box;marks+=`<ellipse cx="${x+(l+r)/4}" cy="${y+24+(t+b)/4}" rx="${(r-l)/4}" ry="${(b-t)/4}" fill="none" stroke="#85ead9" stroke-width="1.5"/>`;}
      marks+=`<text x="${x+128}" y="${y+297}" text-anchor="middle" font-size="13" fill="#abc7c9">${guide?'추정 두개부 ':''}${Math.round(box[2]-box[0])} × ${Math.round(box[3]-box[1])}</text>`;
    }
  }
  marks+=`<text x="${cols*cw/2}" y="${height-14}" text-anchor="middle" font-size="14">동일한 발 기준 · 귀/뿔/모자/머리카락 부피 제외 · 두개부 좌표는 수동 추정</text>`;
  await sharp({create:{width:cols*cw,height,channels:4,background:'#243d4a'}}).composite([...layers,{input:Buffer.from(`<svg width="${cols*cw}" height="${height}"><g fill="#eee5d2" font-family="Malgun Gothic,Arial" font-size="17">${marks}</g></svg>`)}]).png().toFile(path.join(out,file));
}
const five=['zeke','night_rabbit','rumi','mushroom_king','lightning_sage'].map(id=>data.find(h=>h.id===id));
await sheet(five,'five-before-after.png',{both:true,cols:5});
await sheet(five,'five-before-after-anatomy.png',{both:true,cols:5,guide:true});
await sheet(data,'all-21-fronts.png');
await sheet(data,'all-21-anatomy.png',{guide:true});
const clean=data.map(({oldBytes,newBytes,...rest})=>rest);
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ASTRA 머리 크기 비교</title><style>
*{box-sizing:border-box}body{margin:0;padding:24px;background:#142f3d;color:#f2ead7;font:15px/1.6 system-ui,sans-serif}main{max-width:1600px;margin:auto}h1{font-size:25px;margin:0 0 10px}p{max-width:950px}nav{display:flex;gap:12px;flex-wrap:wrap;align-items:center;position:sticky;top:0;background:inherit;padding:12px 0;z-index:2}button,select{font:inherit;color:inherit;background:#294653;border:1px solid #66818c;border-radius:8px;padding:7px 12px}label{cursor:pointer}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:14px}.card{background:#203d4b;border:1px solid #476470;border-radius:12px;text-align:center;padding:12px}.pair{display:flex;flex-wrap:wrap;justify-content:center;align-items:end;gap:12px}.pair small{display:block;color:#bdd3d3}canvas{display:block;max-width:100%;margin:auto}h2{font-size:18px;margin:0 0 8px}.metric{font-size:13px;color:#bbd0d0}.light{background:#eae4d6;color:#203d4b}.light .card{background:#f5f0e6}.light small,.light .metric{color:#506d79}.light nav{background:#eae4d6}nav{background:#142f3d}
</style><main><h1>21명 · 두개부 기준 크기 교정</h1><p>이전/교정은 같은 크기의 프레임과 같은 발 기준으로 표시됩니다. 귀·뿔·모자·헤어스타일의 부피를 제외하고 머리 자체를 추정했습니다. 추정선은 정면에만 표시되며 정답이나 자동 승인 표시가 아닙니다. 키 등급을 전체 배율로 추가 적용하지 않았습니다.</p><nav><label>방향 <select id="dir"><option value="0">하 · 정면</option><option value="1">상 · 후면</option><option value="2">좌측</option><option value="3">우측</option></select></label><label>프레임 <select id="size"><option>48</option><option>64</option><option>96</option><option selected>192</option></select> px</label><label><input id="guide" type="checkbox"> 두개부 추정선</label><button id="theme">밝은/어두운 배경</button></nav><div class="grid" id="grid"></div></main><script>
const heroes=${JSON.stringify(clean)};const grid=document.getElementById('grid'),dir=document.getElementById('dir'),size=document.getElementById('size'),guide=document.getElementById('guide');const images=new Map();
for(const h of heroes){const el=document.createElement('section');el.className='card';el.innerHTML='<h2>'+h.name+'</h2><div class="pair"><div><canvas data-id="'+h.id+'" data-phase="before"></canvas><small>이전</small></div><div><canvas data-id="'+h.id+'" data-phase="after"></canvas><small>교정</small></div></div><p class="metric">추정 머리 '+h.width+' × '+h.height+' · 턱 아래 '+h.body+' px</p>';grid.appendChild(el);for(const phase of ['before','after']){const img=new Image();images.set(h.id+phase,img);img.onload=render;img.src=h[phase];}}
function render(){for(const canvas of document.querySelectorAll('canvas')){const h=heroes.find(h=>h.id===canvas.dataset.id),phase=canvas.dataset.phase,img=images.get(h.id+phase),d=+dir.value,s=+size.value;canvas.width=canvas.height=s*2;canvas.style.width=canvas.style.height=s+'px';const ctx=canvas.getContext('2d');if(!img?.naturalWidth)continue;ctx.drawImage(img,d%2*512,Math.floor(d/2)*512,512,512,0,0,s*2,s*2);ctx.strokeStyle='#cc9d53';ctx.beginPath();ctx.moveTo(0,480/512*s*2);ctx.lineTo(s*2,480/512*s*2);ctx.stroke();if(guide.checked&&d===0){const [l,t,r,b]=phase==='before'?h.oldBox:h.box,k=s*2/512;ctx.strokeStyle='#52d8c3';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse((l+r)/2*k,(t+b)/2*k,(r-l)/2*k,(b-t)/2*k,0,0,Math.PI*2);ctx.stroke();}}}
for(const el of [dir,size,guide])el.addEventListener('change',render);document.getElementById('theme').onclick=()=>document.body.classList.toggle('light');
</script></html>`;
await writeFile(path.join(out,'head-review.html'),html);
await writeFile(path.join(out,'head-measurements.json'),JSON.stringify(now.frames.map(({id,anatomy,source})=>({id,anatomy,sourceSha256:source.sha256,before:{atlasSha256:old.frames.find(f=>f.id===id).sha256,packedSkull:data.find(f=>f.id===id).oldBox,provenance:data.find(f=>f.id===id).oldBoxProvenance}})),null,2)+'\n');
console.log(`Head comparison artifacts written to ${out}`);
return {heroes:data.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const [beforeDir,out,beforeLandmarksPath]=process.argv.slice(2);
  await buildHeadReview({beforeDir,out,beforeLandmarksPath});
}

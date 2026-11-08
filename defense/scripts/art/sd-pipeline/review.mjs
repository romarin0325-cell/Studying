import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {policy} from './policy.mjs';
import {sha,json,ref,setArtifact,receipt,requirePrevious,policyHash} from './core.mjs';
import {sharp,require} from './runtime.mjs';

const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const directions=['정면 ↓','후면 ↑','왼쪽 ←','오른쪽 →'];
const eyeY=m=>{const a=[m.eyeLeft,m.eyeRight].filter(Boolean);return a.length?a.reduce((s,p)=>s+p[1],0)/a.length:null;};
export function geometryReport(pack,heightClass){
 const f=pack.views[0],h=f.skullEllipse[3],limits=policy.warningLimits;
 const rows=pack.views.map((v,i)=>{
  const eyes=eyeY(v.marks),frontEyes=eyeY(f.marks),head=v.skullEllipse;
  const diffs={headHeight:head[3]-h,eye:eyes===null?null:eyes-frontEyes,chin:v.marks.chin[1]-f.marks.chin[1],shoulders:v.marks.shoulders[1]-f.marks.shoulders[1],hips:v.marks.hips[1]-f.marks.hips[1],sole:v.marks.sole[1]-480};
  const warnings=[];
  for(const [key,limit]of [['eye',limits.eyeY],['chin',limits.chinY],['shoulders',limits.shouldersY],['hips',limits.hipsY],['sole',limits.soleY]])if(diffs[key]!==null&&Math.abs(diffs[key])>limit)warnings.push(key+' Δ'+diffs[key].toFixed(1)+'px');
  if(Math.abs(diffs.headHeight)>limits.headHeightPx)warnings.push('skull height');
  if(Math.abs(v.headBody-policy.frame.bodyBelowChin[heightClass]/150)>limits.bodyRatio)warnings.push('head/body ratio');
  return{direction:directions[i],headWidth:head[2],headHeight:head[3],eyeY:eyes,chinY:v.marks.chin[1],shouldersY:v.marks.shoulders[1],hipsY:v.marks.hips[1],headBody:v.headBody,torso:v.torso,legs:v.legs,diffs,warnings};
 });
 return{rows,normalizationIsIndependentProof:false,meaning:'Measured/inferred geometry can warn; numeric normalization and these estimates cannot automatically pass anatomical head or appearance.'};
}
export async function buildReview(run,state){
 await requirePrevious(state,'review');
 const brief=JSON.parse(await readFile(state.artifacts.brief.file,'utf8')),pack=JSON.parse(await readFile(state.artifacts.packing.file,'utf8'));
 const anatomy=JSON.parse(await readFile(state.artifacts.anatomy.file,'utf8'));
 assert.ok(state.artifacts.auditReport,'Independent imgutils/ONNX audit is required before the review book');
 const audit=JSON.parse(await readFile(state.artifacts.auditReport.file,'utf8'));
 assert.equal(audit.files[0].sourceSha256,state.artifacts.atlas.sha256,'Independent audit is for different pixels');
 const out=path.dirname(state.artifacts.packing.file),images={},imageSources=[];
 async function add(id,file){
  const buffer=await readFile(file),meta=await sharp(buffer).metadata();
  images[id]='data:image/webp;base64,'+(await sharp(buffer).resize(1024,1024,{fit:'fill'}).webp({lossless:true}).toBuffer()).toString('base64');
  imageSources.push({id,file,sha256:sha(buffer),originalDimensions:[meta.width,meta.height],preview:'whole square canvas resampled to1024; no accessory-bounds fitting'});
 }
 await add('new',state.artifacts.atlas.file);await add('baseline',brief.baseline);await add('style',brief.style);await add('structure',brief.structure);
 for(const peer of brief.peers)await add('peer-'+peer.id,peer.file);
 const originalBytes=await readFile(brief.original);
 images.original='data:image/webp;base64,'+(await sharp(originalBytes).resize({width:600,height:700,fit:'inside'}).webp({quality:92}).toBuffer()).toString('base64');
 images.portrait='data:image/webp;base64,'+(await readFile(state.artifacts.portrait.file)).toString('base64');
 const probes={};
 for(const [id,file,marks]of [['style',brief.style,brief.styleSamples],['new',state.artifacts.atlas.file,pack.views[0].marks]]){
  assert.ok(marks?.chin&&marks.outerSleeve&&marks.outerFoot,'Explicit outline sample positions required');
  const image=await sharp(file).resize(1024,1024).png().toBuffer();probes[id]=[];
  for(const [key,label]of [['chin','턱'],['outerSleeve','소매·팔'],['outerFoot','발·신발']]){
   const [x,y]=marks[key],rect={left:Math.round(x)-16,top:Math.round(y)-16,width:32,height:32};
   const pid='probe-'+id+'-'+key;images[pid]='data:image/webp;base64,'+(await sharp(image).extract(rect).webp({lossless:true}).toBuffer()).toString('base64');probes[id].push({id:pid,label,rect});
  }
 }
 const geo=geometryReport(pack,brief.heightClass),tile=(id,d,size=160,overlay=false,head=false)=>`<div class="tile${head?' head':''}" style="--s:${size}px"><div class="sprite${head?' crop':''}"><img data-image="${id}" alt="${esc(id)} ${directions[d]}" style="left:${-100*(d%2)}%;top:${-100*Math.floor(d/2)}%"></div>${overlay?marks(d):''}</div>`;
 function marks(d){const v=pack.views[d],e=v.skullEllipse,m=v.marks;return`<svg viewBox="0 0 512 512" class="marks" aria-hidden="true"><line x1="0" y1="480" x2="512" y2="480"/><ellipse cx="${e[0]}" cy="${e[1]}" rx="${e[2]/2}" ry="${e[3]/2}" transform="rotate(${e[4]} ${e[0]} ${e[1]})"/>${Object.entries(m).filter(([k])=>['eyeLeft','eyeRight','chin','shoulders','hips','sole'].includes(k)).map(([k,[x,y]])=>`<circle cx="${x}" cy="${y}" r="4"/>`).join('')}</svg>`;}
 const pairSection=(head=false)=>`<div class="horizontal"><div class="directions">${directions.map((label,d)=>`<article><b>${label}</b><div class="pair"><figure>${tile('baseline',d,head?192:160,false,head)}<figcaption>기존 비교본</figcaption></figure><figure>${tile('new',d,head?192:160,!head,head)}<figcaption>현재 후보</figcaption></figure></div></article>`).join('')}</div></div>`;
 const castIds=[['new','현재 후보'],['baseline','기존 동료'],...brief.peers.map(p=>['peer-'+p.id,p.name])];
 const castSection=(size,theme)=>`<article class="cast-theme ${theme}"><b>${size}px · ${theme==='night'?'어두운':'밝은'} 바닥 · 실제 크기</b>${directions.map((label,d)=>`<div class="cast-row"><span>${label}</span><div class="horizontal"><div class="strip">${castIds.map(([id,name])=>`<figure style="--s:${size}px;width:${size}px">${tile(id,d,size)}<figcaption>${esc(name)}</figcaption></figure>`).join('')}</div></div></div>`).join('')}</article>`;
 const fmt=n=>n===null?'가려짐':n.toFixed(1);
 const rawRows=anatomy.views.map((v,i)=>`<tr><th>${directions[i]}</th><td>${v.skullEllipse[2]}×${v.skullEllipse[3]}</td><td>${pack.views[i].skullEllipse[2]}×${pack.views[i].skullEllipse[3]}</td><td>${v.skullEllipse[4]}°</td></tr>`).join('');
 const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(brief.name)} · 누적 검수책</title><style>
*{box-sizing:border-box}body{margin:0;background:#f1f1e9;color:#293d35;font:14px/1.6 'Segoe UI','Malgun Gothic',sans-serif}main{max-width:1440px;margin:auto;padding:22px 12px 50px}h1,h2,p,figure{margin:0}h1{font-size:30px;letter-spacing:-.04em}h2{font-size:20px;margin-bottom:8px}p{margin:6px 0}a{color:#176750}section{padding:13px;border:1px solid #cdd7cb;border-radius:10px;margin:14px 0;background:#fffef8;min-width:0}.note{font-size:12px;color:#586d60}.warning{background:#fff0d5;padding:9px;border-left:3px solid #bd8745}.horizontal{overflow-x:auto;max-width:100%}.directions{display:flex;gap:8px;width:max-content}.directions article{padding:6px;border:1px solid #d0d8cd;border-radius:7px}.pair,.strip{display:flex;gap:5px;width:max-content}.pair figure,.strip figure{text-align:center;flex:none}.tile{width:var(--s);height:var(--s);position:relative;overflow:hidden;background:#efe6d1}.tile::after{content:'';position:absolute;left:0;right:0;top:93.75%;border-top:1px solid #478f7a66;pointer-events:none}.sprite{position:absolute;width:100%;height:100%;overflow:hidden}.sprite>img{position:absolute;width:200%;max-width:none;image-rendering:auto}.head .crop{width:200%;height:200%;left:-50%;top:-43.75%}.head::after{display:none}.marks{position:absolute;inset:0;width:100%;height:100%;fill:none;stroke:#ef3d70;stroke-width:1.5;opacity:.8}.marks circle{fill:#fff7b9;stroke:#a83c72}.hide-marks .marks{display:none}.strip figcaption{max-width:var(--s);font-size:11px;line-height:1.35}.cast-row{display:flex;align-items:center;gap:5px;margin:7px 0}.cast-row>span{width:52px;flex:none;font-size:11px}.cast-theme{padding:8px;border-radius:8px;margin-top:8px}.night{background:#1e293e;color:#e9eff8}.night .tile{background:#1e293e}.night .tile::after{border-color:#b5d8c477}.refs{display:flex;gap:10px;flex-wrap:wrap}.refs figure{width:230px;max-width:100%;overflow-wrap:anywhere}.refs img{width:100%;height:280px;object-fit:contain;background:#e9e3d5}.refs figcaption{font-size:11px}table{border-collapse:collapse;white-space:nowrap;width:100%;font-size:12px}th,td{text-align:left;padding:6px;border-bottom:1px solid #d4ddce;font-variant-numeric:tabular-nums}.caution{color:#8b511d;background:#fff1dc}.probes{display:flex;gap:9px;flex-wrap:wrap}.probes img{width:128px;height:128px;image-rendering:pixelated;background:#efe6d1}.probes figure{text-align:center}.portrait img{width:96px;height:96px;background:#efe6d1;border-radius:8px}.portrait{display:flex;gap:12px;align-items:center}details{margin:9px 0}summary{font-weight:700;cursor:pointer}.contract{display:grid;gap:6px}.contract article{border:1px solid #d4dfd1;border-radius:5px;padding:6px}.contract b{display:block}.contract p{font-size:12px;margin:2px 0}code{font-size:11px;overflow-wrap:anywhere}nav{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}@media(max-width:500px){h1{font-size:25px}.cast-row{display:block}.cast-row>span{display:block}section{padding:9px}.refs figure{width:180px}}
</style></head><body><main><header><p class="note">고정된 공정 · 동일한 검수 항목 · ${state.mode==='audit'?'과거 후보의 읽기 전용 감사':'제작 실행'}</p><h1>${esc(brief.name)} — 머리부터 전신까지 함께 검수</h1><p class="warning">이 검수책을 생성했다는 사실은 합격이 아닙니다. 필수16항목의 판정과 현재 파일 지문이 모두 유효해야 다음 단계로 갑니다.</p><nav><a href="#head">실제 머리</a><a href="#body">네 방향·전신</a><a href="#cast">캐스트·실제 크기</a><a href="#lines">선·재질</a><a href="#contract">누적 필수 검수</a></nav></header>
<section id="originals"><h2>원화·동결 화풍·구조</h2><div class="refs">${[['original','원본 일러스트'],['style','동결된 공통 SD 화풍'],['structure','체형 마네킹 / 구조 참고']].map(([id,label])=>`<figure><img data-image="${id}" alt="${label}"><figcaption><b>${label}</b></figcaption></figure>`).join('')}</div><p>${esc(brief.identityNotes)}</p><p class="note">${esc(brief.equipmentNotes)}</p></section>
<section id="head"><h2>1 · 실제 머리 크기·얼굴 형태 — 독립 필수 검수</h2><p class="note">같은512px 좌표에서(128,112)~(384,368) 영역을 같은 배율로 확대합니다. 얼굴마다 자동 확대·정렬하지 않습니다. 머리카락·모자·뿔은 두개골이 아닙니다.</p>${pairSection(true)}<div class="horizontal"><table><thead><tr><th>방향</th><th>생성 원본의 추정 두개골 W×H</th><th>패킹 후 W×H</th><th>고개 기울기</th></tr></thead><tbody>${rawRows}</tbody></table></div><p class="warning">위 수치는 제작에 사용한 수동 추정입니다. 정규화 면적이 같아지는 것은 공식의 결과이며 독립 검증이 아닙니다. 별도로 눈 간격·눈~턱·볼·턱선과 동료 옆의 인상을 보고 판정해야 합니다. 불확실성: ${esc(JSON.stringify(anatomy.uncertainty))}</p></section>
<section id="body"><h2>2 · 전신·네 방향·몸의 비율</h2><label><input id="marks-toggle" type="checkbox" checked> 추정 두개골·눈·턱·어깨·골반·발 기준 표시</label>${pairSection()}<div class="horizontal"><table><thead><tr><th>방향</th><th>눈Y</th><th>턱Y</th><th>어깨Y</th><th>골반Y</th><th>턱 아래÷머리</th><th>몸통÷머리</th><th>골반~발÷머리</th><th>기하 경고</th></tr></thead><tbody>${geo.rows.map(r=>`<tr class="${r.warnings.length?'caution':''}"><th>${r.direction}</th><td>${fmt(r.eyeY)}</td><td>${fmt(r.chinY)}</td><td>${fmt(r.shouldersY)}</td><td>${fmt(r.hipsY)}</td><td>${r.headBody.toFixed(2)}</td><td>${r.torso.toFixed(2)}</td><td>${r.legs.toFixed(2)}</td><td>${r.warnings.length?esc(r.warnings.join(' / ')):'数値内 · 시각 판정 별도'}</td></tr>`).join('')}</tbody></table></div><p class="note">발Y480·전신 공통배율 ${pack.commonScale.toFixed(4)}. 몸통·다리는 가려진 관절의 투영 추정이며 정밀 해부 실측이 아닙니다. 경고가 없어도 시각 검수를 대신하지 않습니다.</p></section>
<section id="cast"><h2>3 · 같은 체형 동료·체감 크기·64/96px</h2><p class="note">모든 그림은 같은 셀과 바닥선입니다. 실제 눈·볼 크기와 머리카락/모자의 체감 부피를 구분해서 봅니다. 좁은 화면에서는 이 줄만 옆으로 움직입니다.</p>${[64,96].map(size=>`<div id="sizes-${size}">${castSection(size,'light')}${castSection(size,'night')}</div>`).join('')}</section>
<section id="lines"><h2>4 · 외곽선·명암·재질</h2><p class="note">원본32×32px를 공통4배로 확대합니다. 검은 머리·의상의 그림자·속눈썹을 자동 선 두께로 세지 않습니다.</p>${Object.entries(probes).map(([id,rows])=>`<h3>${id==='style'?'동결 화풍':'현재 후보'}</h3><div class="probes">${rows.map(r=>`<figure><img data-image="${r.id}" alt="${r.label}"><figcaption>${r.label}</figcaption></figure>`).join('')}</div>`).join('')}</section>
<section id="portrait"><h2>5 · 초상화의 시각적 중심</h2><div class="portrait"><img data-image="portrait" alt="96px 초상화"><div><p>크롭 ${pack.portrait.crop.width}px · 중심 ${pack.portrait.center.join(', ')}</p><p class="note">실제 머리 크기와 별도로 판단합니다. 편성·쌍성·목록 등 게임 UI 사용처 확인은 실제 적용 단계이며 여기에서 완료로 처리하지 않습니다.</p></div></div></section>
<section id="contract"><h2>6 · 누적 필수 검수 — 생략 불가</h2><div class="contract">${policy.checks.map((c,i)=>`<article data-check="${c.id}"><b>${String(i+1).padStart(2,'0')} · ${c.title}</b><p>${esc(c.task)}</p><code>${c.id}</code></article>`).join('')}</div><p class="note">새 지시는 이 목록에 추가합니다. 기존 항목 제거·미검토 항목 생략·기존 판정의 변경 이미지 재사용은 공정에서 거부합니다.</p></section>
<script id="images" type="application/json">${JSON.stringify(images).replaceAll('<','\\u003c')}</script><script>const data=JSON.parse(document.getElementById('images').textContent);for(const img of document.querySelectorAll('[data-image]'))img.src=data[img.dataset.image];document.getElementById('marks-toggle').onchange=e=>document.body.classList.toggle('hide-marks',!e.target.checked);window.sdReviewReady=true;</script></main></body></html>`;
 const a=audit.files[0],face=a.derived.face_height,delta=a.derived.face_top_diff_vs_front;
 const auditSection=`<section id="audit"><h2>7 · 독립 검사 — 기존 도구 유지</h2><p>imgutils/ONNX 얼굴·머리 검출, LPIPS·SSIM·CCIP의 실제 실행 결과입니다. ${audit.cacheReuse?'현재 파일·검사 코드·환경이 같은 기존 측정을 재사용했습니다.':'이 파일을 새로 측정했습니다.'}</p><div class="horizontal"><table><thead><tr><th>얼굴 박스 높이 정면/좌/우</th><th>측면 박스 윗선 차이 좌/우</th><th>LPIPS</th><th>SSIM</th></tr></thead><tbody><tr><td>${face.front} / ${face.sideA} / ${face.sideB}</td><td>${delta.sideA} / ${delta.sideB}px</td><td>${a.mirror.face.lpips?.toFixed(3)}</td><td>${a.mirror.face.ssim?.toFixed(3)}</td></tr></tbody></table></div><p class="warning">검출 박스는 두개골이 아닙니다. 원시 경고: ${esc(a.review_reasons.length?a.review_reasons.join(' / '):'이 기준에서 경고 없음')}. 경고 없음도 머리·화풍 합격을 의미하지 않습니다.</p><p class="note">패키지 ${esc(JSON.stringify(audit.packages))} · 기준 분포 ${audit.referenceDistribution.count}종 / ${esc(audit.referenceDistribution.generatedAt)}. 최신 전체 캐스트 재검사라고 표시하지 않습니다.</p></section>`;
 const finalHtml=html.replace('</style>','.directions{display:grid;grid-template-columns:repeat(2,max-content);gap:8px;width:max-content}p,figcaption{overflow-wrap:anywhere}</style>').replaceAll('数値内','수치 내').replaceAll('필수16항목','필수'+policy.checks.length+'항목').replace('<section id="contract">',auditSection+'<section id="contract">');
 const file=path.join(out,'review.html');await writeFile(file,finalHtml);await setArtifact(state,'reviewHtml',file);
 const screenshots=await captureReview(file,out);
 for(const shot of screenshots.files)await setArtifact(state,'capture:'+shot.section,shot.file);
 const groups={originals:['originals'],style:['originals','lines'],head:['head'],measurements:['body','head'],cast:['sizes-64','sizes-96'], 'four-views':['body'],sizes:['sizes-64','sizes-96'],'line-samples':['lines'],portrait:['portrait'],'independent-audit':['audit'],provenance:[],package:[]};
 const evidence={policySha256:policyHash(policy),atlasSha256:state.artifacts.atlas.sha256,packingSha256:state.artifacts.packing.sha256,html:await ref(file),imageSources,probes,geometry:geo,groups:Object.fromEntries(Object.entries(groups).map(([key,sections])=>[key,{sections,screenshots:screenshots.files.filter(r=>sections.includes(r.section)),boundFiles:sections.length?[state.artifacts.atlas,state.artifacts.packing]:key==='provenance'?[state.artifacts.inputs,state.artifacts.job,state.artifacts.generation]:[state.artifacts.packing,state.artifacts.webp]}])),browser:screenshots.verification};
 const evidenceFile=path.join(out,'evidence.json');await writeFile(evidenceFile,json(evidence));await setArtifact(state,'reviewEvidence',evidenceFile);await receipt(state,'review',{detail:{screenshots:screenshots.files.length,externalRequests:0,pageErrors:0}});return evidence;
}

export async function captureReview(file,out){
 const {chromium}=require('playwright');
 const browser=await chromium.launch({headless:true}),errors=[],external=[],files=[],checks=[];
 try{
  for(const width of [390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:1000},offline:true}),page=await ctx.newPage();
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
   await page.goto(pathToFileURL(file).href);await page.waitForFunction(()=>window.sdReviewReady);
   await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,'No document overflow');
   assert.equal(await page.locator('[data-check]').count(),policy.checks.length);
   for(const size of [64,96])assert.ok((await page.locator('#sizes-'+size+' .tile').evaluateAll(a=>a.map(e=>e.getBoundingClientRect().width))).every(w=>w===size),'Unshrunk actual-size cells');
   const gaps=await page.locator('.strip').evaluateAll(strips=>strips.flatMap(s=>[...s.querySelectorAll('.tile')].slice(1).map((e,i)=>e.getBoundingClientRect().left-s.querySelectorAll('.tile')[i].getBoundingClientRect().right)));
   assert.ok(gaps.every(g=>Math.abs(g-5)<.1),'Cast cells remain5px apart, regardless of long labels');
   if(width===1280){
    for(const section of ['originals','head','body','sizes-64','sizes-96','lines','portrait','audit']){
     const loc=page.locator('#'+section);await loc.scrollIntoViewIfNeeded();const b=await loc.boundingBox(),sy=await page.evaluate(()=>scrollY),sx=await page.evaluate(()=>scrollX);
     const png=await page.screenshot({fullPage:true}),meta=await sharp(png).metadata(),left=Math.max(0,Math.floor(b.x+sx)),top=Math.max(0,Math.floor(b.y+sy)),dest=path.join(out,'capture-'+section+'.png');
     await sharp(png).extract({left,top,width:Math.min(Math.ceil(b.width),meta.width-left),height:Math.min(Math.ceil(b.height),meta.height-top)}).toFile(dest);files.push({section,...await ref(dest)});
    }
   }
   checks.push({width,offline:true,unshrunk64and96:true,allMandatoryChecksVisible:true});await ctx.close();
  }
 }finally{await browser.close();}
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 return{files,verification:{checks,errors,external,meaning:'Desktop Chromium CSS viewport checks, not a physical mobile device or automatic artistic approval'}};
}

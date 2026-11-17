import {Art,Renderer} from '../../../src/combat/render.js';
import {HERO,HEROES} from '../../../src/content.js';
import {KIT3} from '../../../src/combat/ur-vfx.js';
import {ENTRIES,reviewScene} from '../ur-vfx-20261106/scene.js';

const $=id=>document.getElementById(id),DATA=window.PENDING_DECISION_DATA;
const CINDERELLA_ENTRY=ENTRIES.find(e=>e.key==='cinderella');
const MOMENTS=[0.80,1.25,1.45,1.85,2.25];
const FRAME=1/60;

const CUTIN_SAMPLES={
  cinderella:{tag:'UR · 자정의 기적 (시안)',quote:'열두 시의 종이 울려도, 이 순간의 마법은 멈추지 않아요.',expr:'0.3초: 미소 → 결의의 윙크·반짝임 (시안)'},
  siren:{tag:'C · 세이렌의 노래 (시안)',quote:'라-♪ 박자에 맞춰, 모두의 목소리를 하나로 잇죠!',expr:'0.3초: 미소 → 윙크 표정 그림 교체 (VFX_DIRECTION_PLAN §2.4)'},
  cherry_prince:{tag:'UR · 왕자의 일격 (시안)',quote:'이미 베었습니다. 벚꽃이 지기 전에 끝내지요.',expr:'0.3초: 눈 감은 미소 → 뜬 눈 발도 표정 (VFX_DIRECTION_PLAN §2.1)'},
  luna:{tag:'UR · 제노사이드 스텝 (시안)',quote:'달빛이 닿는 자리엔 그림자도 남기지 않아.',expr:'0.3초: 무표정 → 차가운 시선 교체 (시안)'},
  frost_witch:{tag:'UR · 빙궁의 칙령 (시안)',quote:'움직이지 마라. 이 성에 봄은 허락하지 않는다.',expr:'0.3초: 정면 응시 → 서릿발 시선 (시안)'},
  time_magician:{tag:'SR · 트라우마 (시안)',quote:'거꾸로 도는 바늘 끝에서, 깨진 약속을 되돌릴게.',expr:'0.3초: 소년 미소 → 트라우마 표정 전환 (시안)'},
};

const KIT3_INFO=[
  {key:'butterfly',label:'나비',user:'베놈',kind:'빛'},
  {key:'flame',label:'불꽃',user:'레드드래곤',kind:'빛'},
  {key:'breath',label:'불 숨결',user:'레드드래곤',kind:'빛'},
  {key:'meteor',label:'별똥별',user:'별똥별소년',kind:'빛'},
  {key:'mirror',label:'손거울',user:'아우로라',kind:'빛'},
  {key:'cracks',label:'유리 균열',user:'아우로라',kind:'빛'},
  {key:'sun',label:'해',user:'루미 꿈',kind:'빛'},
  {key:'crescent',label:'초승달',user:'루미 꿈',kind:'빛'},
  {key:'star',label:'별',user:'신데렐라·루미',kind:'빛'},
  {key:'bell',label:'종',user:'신데렐라',kind:'빛'},
  {key:'lily',label:'피안화',user:'베놈',kind:'물체'},
  {key:'envelope',label:'봉투(미사용)',user:'둠 폐기',kind:'물체',unused:true},
  {key:'dagger',label:'단검',user:'둠',kind:'물체'},
  {key:'root',label:'뿌리',user:'베놈',kind:'물체'},
];

const HERO_SPECIFIC_VFX={
  zeke:['zeke-ragnarok','zeke-cone','zeke-spin'],
  luna:['luna-blade'],
  ash:['ash-armageddon'],
  behemoth:['effects-behemoth'],
  underdog:['effects-bigshow'],
  toffee_apple:['effects-applebomb','effects-chaos-sun'],
  demon_king:['effects-demon-miracle','effects-deathhand'],
  miracle_larva:['effects-demon-miracle','effects-eclose'],
  joker:['effects-joker-sun','effects-chaos-sun'],
  sunflower:['effects-joker-sun','effects-chaos-sun'],
  ancient_dragon:['ancient-cross'],
  gold_dragon:['gold-breath'],
  harmonious:['ur-sweets'],
  time_magician:['ur-kit2'],
  jasmine:['ur-kit2'],
  queen:['ur-kit2'],
  galaxy_whale:['ur-kit2'],
  time_ruler:['ur-kit2'],
  cinderella:['ur-kit2','ur-kit3'],
  rumi:['ur-kit2','ur-kit3'],
  aurora:['ur-kit2','ur-kit3'],
  venom:['ur-kit3'],
  doom:['ur-kit2','ur-kit3'],
  red_dragon:['ur-kit3'],
  star_boy:['ur-kit3'],
};

const NON_COMBAT_UI_IDS=new Set(['summon-altar','greenhouse','greenhouse-beds','greenhouse-dawn','greenhouse-beds-dawn','gifts']);

function loadImage(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error('Missing texture'));
    img.src=src;
  });
}

function seeded(seed,fn){
  const old=Math.random;let n=seed>>>0||1;
  Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  try{return fn();}finally{Math.random=old;}
}

function cutinBand(item){
  const h=HERO[CINDERELLA_ENTRY.hero],dur=1.6,top=.05,tall=.26,age=item.frames/60;
  if(age>dur)return;
  const k=age<dur*.16?age/(dur*.16):age>dur*.8?1-(age-dur*.8)/(dur*.2):1;
  const ctx=item.renderer.ctx,y0=780*top,y1=780*(top+tall),sk=Math.tan(7*Math.PI/180);
  ctx.save();ctx.setTransform(item.renderer.dpr,0,0,item.renderer.dpr,0,0);
  ctx.globalAlpha=.88*k;ctx.fillStyle='#080a1e';
  ctx.beginPath();ctx.moveTo(-90,y0+sk*450);ctx.lineTo(810,y0-sk*450);ctx.lineTo(810,y1-sk*450);ctx.lineTo(-90,y1+sk*450);ctx.closePath();ctx.fill();
  ctx.globalAlpha=k;ctx.strokeStyle='#ffe08a';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#ffffff';ctx.font='700 26px system-ui';ctx.textAlign='center';
  ctx.fillText(h.skill.name,400,(y0+y1)/2+8);ctx.restore();
}

async function main(){
  const images={};
  await Promise.all(Object.entries(DATA.images).map(async([id,src])=>{images[id]=await loadImage(src);}));
  const makeArt=theme=>{
    const a=Object.create(Art.prototype);
    a.images={...images};
    if(theme==='bright')a.images.garden=images['bright-garden'];
    a.failed=[];a.ready=Promise.resolve();
    return a;
  };

  // --- 1. 신데렐라 유리구두 vs 소원의 별 실시간 비교 ---
  const canvases=[$('before'),$('after')];
  let config={theme:'night',speed:1,cutin:true,hold:true,hitstop:true,kills:true,reduced:false,phone:false};
  let runners=[],time=0,playhead=0,playing=true,last=0;

  function runnersFor(c,targets=canvases){
    return ['slipper','miracle'].map((emblem,i)=>{
      const canvas=targets[i],renderer=new Renderer(canvas,makeArt(c.theme));
      const fixture=reviewScene(CINDERELLA_ENTRY,{kills:c.kills,moving:true,chapter:c.theme==='dawn'?45:0});
      renderer.reduced=c.reduced;renderer.shake=0;renderer.hold=c.hold;
      renderer.fx.palette='v2';renderer.fx.cinderellaEmblem=emblem;
      const item={renderer,fixture,frames:0,slowmo:0,stopped:0,emblem};
      seeded(1,()=>renderer.draw(fixture.state,0));
      const initial=fixture.cast();
      if(c.cutin&&!c.reduced)item.slowmo=.5;
      seeded(1,()=>initial.forEach(e=>renderer.event(e)));
      return item;
    });
  }

  function advance(items,dt,c=config){
    for(const item of items){
      const r=item.renderer;
      let sim=dt*c.speed*(item.slowmo>0?.3:1);
      item.slowmo=Math.max(0,item.slowmo-dt);
      if(c.hitstop&&r.hitstop>0){r.hitstop=Math.max(0,r.hitstop-dt);sim=0;item.stopped+=dt;}
      else if(!c.hitstop)r.hitstop=0;
      const events=sim>0?item.fixture.advance(sim):[];
      seeded(++item.frames,()=>events.forEach(e=>r.event(e)));
      seeded(item.frames,()=>r.draw(item.fixture.state,dt));
      if(c.cutin)cutinBand(item);
    }
  }

  function report(){
    $('clock').textContent=time.toFixed(2)+'초';
    $('seek').value=String(Math.min(CINDERELLA_ENTRY.duration,time));
    $('play').textContent=playing?'일시정지':'재생';
    const r=runners[1];
    $('stop').textContent=r?`히트스톱 누적 ${(r.stopped*1000).toFixed(0)}ms · 보류 중 숫자 ${r.renderer.releases?.length||0} · 잔상 ${r.renderer.ghosts?.length||0}`:'';
  }
  function reset(){runners=runnersFor(config);time=0;playhead=0;advance(runners,0);report();}
  function seek(t){if(t<time-.0001)reset();while(time+FRAME<=t+1e-8){advance(runners,FRAME);time+=FRAME;}report();}
  function applyConfig(next){
    config={...config,...next};
    for(const id of ['theme','speed'])$(id).value=String(config[id]);
    for(const id of ['cutin','hold','hitstop','kills','reduced','phone'])$(id).checked=!!config[id];
    document.body.classList.toggle('phone',config.phone);
    reset();
  }

  for(const [label,at] of [['0.95초 12시 종',0.95],['1.12초 꽃잎 개방',1.12],['1.45초 상징 등장',1.45],['1.85초 상승/착지',1.85],['2.25초 마무리',2.25]]){
    const btn=document.createElement('button');btn.textContent=label;
    btn.onclick=()=>{playing=false;seek(at);playhead=time;};
    $('moment-buttons').append(btn);
  }
  $('theme').onchange=()=>applyConfig({theme:$('theme').value});
  $('speed').onchange=()=>applyConfig({speed:Number($('speed').value)});
  for(const id of ['cutin','hold','hitstop','kills','reduced','phone'])$(id).onchange=()=>applyConfig({[id]:$(id).checked});
  $('play').onclick=()=>{playing=!playing;playhead=time;report();};
  $('restart').onclick=reset;
  $('seek').oninput=()=>{playing=false;seek(Number($('seek').value));playhead=time;};
  $('rate').onchange=()=>{last=0;};
  applyConfig({});

  function animate(now){
    const dt=Math.min(.05,(now-(last||now))/1000)*Number($('rate').value);
    last=now;
    if(playing){playhead+=dt;if(playhead>CINDERELLA_ENTRY.duration)reset();else seek(Math.min(CINDERELLA_ENTRY.duration,playhead));}
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // 핵심 시점 정지 비교표
  const stripDefs=[['현재 · 유리구두 (slipper)',0],['제안 · 소원의 별 (miracle)',1]];
  for(const [title,col] of stripDefs){
    const row=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td'),strip=document.createElement('div');
    th.textContent=title;strip.className='strip';
    for(const t of MOMENTS){
      const cA=document.createElement('canvas'),cB=document.createElement('canvas');
      const snapConfig={...config,theme:'night',speed:1,cutin:true,hold:true,hitstop:true,kills:true,reduced:false};
      const item=runnersFor(snapConfig,[cA,cB])[col];
      let cur=0;advance([item],0,snapConfig);while(cur+FRAME<=t+1e-8){advance([item],FRAME,snapConfig);cur+=FRAME;}
      const fig=document.createElement('figure'),img=document.createElement('img'),cap=document.createElement('figcaption');
      img.src=(col===0?cA:cB).toDataURL('image/webp',.84);img.alt=`${title} ${t}초`;
      cap.textContent=`${t.toFixed(2)}초`;
      fig.onclick=()=>{playing=false;seek(t);playhead=t;$('sec-cinderella').scrollIntoView({behavior:'smooth',block:'start'});};
      fig.append(img,cap);strip.append(fig);
    }
    td.append(strip);row.append(th,td);$('cinderella-rows').append(row);
  }

  // --- 2. 컷인 표정 그림 & 필살기 대사 비교 ---
  const cutinIds=Object.keys(CUTIN_SAMPLES).filter(id=>DATA.figures[id]);
  let cutinSwapped=false,cutinTimer=0;
  for(const id of cutinIds){
    const opt=document.createElement('option');opt.value=id;opt.textContent=`${HERO[id].name} (${HERO[id].rarity})`;
    $('cutin-hero').append(opt);
  }
  function renderCutinCompare(swapped=cutinSwapped){
    cutinSwapped=swapped;
    const id=$('cutin-hero').value,h=HERO[id],sample=CUTIN_SAMPLES[id],fig=DATA.figures[id];
    const ur=h.hidden||h.rarity==='UR',showQ=$('cutin-show-quote').checked,showE=$('cutin-show-expr').checked;
    const band=(isProp)=>`<div class="cutin-band ${ur?'ur':''}" style="--c:${h.color}">
      <div class="cutin-lines"></div>
      <div class="cutin-art ${isProp&&showE&&swapped?'swapped':''}"><img src="${fig}" alt="${h.name}"></div>
      <div class="cutin-text">
        <small>${ur?'ULTIMATE':'필살기'} · ${h.name}</small>
        <b>${h.skill.name}</b>
        ${isProp&&showQ?`<div class="cutin-quote">“${sample.quote}”</div>`:''}
      </div>
    </div>${isProp&&showE?`<div class="cutin-expr-tag">${swapped?sample.expr:'0.0초: 기본 표정'}</div>`:''}`;
    $('cutin-now').innerHTML=band(false);
    $('cutin-prop').innerHTML=band(true);
  }
  function playCutinSwap(){
    clearTimeout(cutinTimer);renderCutinCompare(false);
    cutinTimer=setTimeout(()=>renderCutinCompare(true),300);
  }
  $('cutin-hero').onchange=playCutinSwap;
  $('cutin-show-quote').onchange=()=>renderCutinCompare();
  $('cutin-show-expr').onchange=()=>renderCutinCompare();
  $('cutin-replay').onclick=playCutinSwap;
  playCutinSwap();

  // --- 3. 덱 기준 이미지 디코딩 절감 비교 ---
  const metaList=DATA.assetsMeta,metaById=Object.fromEntries(metaList.map(m=>[m.id,m]));
  const totalDecoded=metaList.reduce((n,m)=>n+m.decodedBytes,0);
  $('total-count').textContent=String(metaList.length);
  let selectedDeck=['cinderella','jasmine','siren','queen','zeke'];
  const PRESETS={
    cinderella:['cinderella','jasmine','siren','queen','zeke'],
    transform:['time_magician','miracle_larva','cinderella','siren','star_boy'],
    heavy:['zeke','luna','ash','behemoth','demon_king'],
    starter:['star_boy','snow_rabbit','night_rabbit','siren','great_detective'],
  };
  const allSpecificVfx=new Set(Object.values(HERO_SPECIFIC_VFX).flat());
  const selects=[];
  for(let i=0;i<5;i++){
    const sel=document.createElement('select');sel.setAttribute('aria-label',`덱 슬롯 ${i+1}`);
    for(const h of HEROES){const o=document.createElement('option');o.value=h.id;o.textContent=`${h.name} (${h.rarity})`;sel.append(o);}
    sel.value=selectedDeck[i];
    sel.onchange=()=>{selectedDeck[i]=sel.value;renderDecode();};
    selects.push(sel);$('deck-selects').append(sel);
  }
  document.querySelectorAll('[data-preset]').forEach(btn=>{
    btn.onclick=()=>{selectedDeck=[...PRESETS[btn.dataset.preset]];selectedDeck.forEach((id,i)=>{selects[i].value=id;});renderDecode();};
  });
  $('exclude-ui').onchange=renderDecode;

  function renderDecode(){
    const deckSet=new Set(selectedDeck),excludeUi=$('exclude-ui').checked;
    const neededUnits=new Set(selectedDeck.map(id=>HERO[id].art.atlas));
    if(deckSet.has('time_magician'))neededUnits.add('unit-trauma');
    if(deckSet.has('miracle_larva'))['unit-miracle_cocoon','unit-miracle_wing','unit-abyss_wing'].forEach(x=>neededUnits.add(x));
    const neededSpecific=new Set();
    for(const id of deckSet)for(const atlas of HERO_SPECIFIC_VFX[id]||[])neededSpecific.add(atlas);

    const loaded=[],skipped=[];
    for(const m of metaList){
      if(m.id.startsWith('unit-')){
        if(neededUnits.has(m.id))loaded.push(m);else skipped.push(m);
      }else if(excludeUi&&NON_COMBAT_UI_IDS.has(m.id)){
        skipped.push(m);
      }else if(allSpecificVfx.has(m.id)&&!neededSpecific.has(m.id)){
        skipped.push(m);
      }else loaded.push(m);
    }
    const propDecoded=loaded.reduce((n,m)=>n+m.decodedBytes,0),saved=totalDecoded-propDecoded,pct=(saved/totalDecoded*100);
    const toMiB=b=>(b/1048576).toFixed(2)+' MiB';
    $('decode-now-mib').textContent=toMiB(totalDecoded);
    $('decode-now-sub').textContent=`총 ${metaList.length}장 일괄 디코딩 (원본 압축 합계 ${toMiB(metaList.reduce((n,m)=>n+m.fileBytes,0))})`;
    $('decode-prop-mib').textContent=`${toMiB(propDecoded)} (−${pct.toFixed(1)}%)`;
    $('decode-prop-sub').textContent=`${loaded.length}장 로드 · ${skipped.length}장 생략 (절감 ${toMiB(saved)})`;
    $('decode-prop-bar').style.width=`${(propDecoded/totalDecoded*100).toFixed(1)}%`;

    $('decode-now-list').innerHTML=metaList.slice().sort((a,b)=>b.decodedBytes-a.decodedBytes).map(m=>`<div class="asset-row"><span>${m.id} (${m.width}×${m.height})</span><b>${toMiB(m.decodedBytes)}</b></div>`).join('');
    $('decode-prop-list').innerHTML=`<div class="asset-row"><strong>제외되는 에셋 (${skipped.length}장)</strong><b>−${toMiB(saved)}</b></div>`+
      skipped.slice().sort((a,b)=>b.decodedBytes-a.decodedBytes).map(m=>`<div class="asset-row"><span>${m.id} (${m.width}×${m.height})</span><span>−${toMiB(m.decodedBytes)}</span></div>`).join('');
  }
  renderDecode();

  // --- 4. ur-kit3 미사용 봉투 칸 비교 ---
  const kit3Img=images['ur-kit3'],kit3Meta=metaById['ur-kit3'];
  function renderKit3(){
    const hideUnused=$('kit3-hide-unused').checked;
    $('kit3-now-meta').textContent=`${kit3Img.naturalWidth}×${kit3Img.naturalHeight} · ${(kit3Meta.fileBytes/1024).toFixed(1)} KB (배포본) · 사용 13 + 미사용 1 (11번 봉투)`;
    $('kit3-prop-meta').textContent=hideUnused?'11번 봉투 칸 제거 미리보기 (13칸 사용 · 둠은 ur-kit2 금화 + ur-kit3 단검 사용)':'재패킹 시 11번 봉투 칸을 제거하고 13칸으로 재배치 (4×4 중 3슬롯 공백)';
    const drawGrid=(target,isProp)=>{
      target.innerHTML='';
      const cw=kit3Img.naturalWidth/4;
      for(let i=0;i<16;i++){
        const info=KIT3_INFO[i]||null,cell=document.createElement('div');
        cell.className='kit-cell'+(info?.kind==='물체'?' object':'')+(info?.unused?(isProp&&hideUnused?' removed':' unused'):'');
        const cv=document.createElement('canvas');cv.width=128;cv.height=128;
        const ctx=cv.getContext('2d');
        if(!(isProp&&hideUnused&&info?.unused)){
          ctx.drawImage(kit3Img,(i%4)*cw,Math.floor(i/4)*cw,cw,cw,0,0,128,128);
        }
        cell.append(cv);
        const meta=document.createElement('div');meta.className='kit-meta';
        meta.innerHTML=info?`<span>#${i} ${info.label}</span><small>${info.unused&&isProp&&hideUnused?'제거됨':info.user}</small>`:`<span>#${i} 빈 칸</span><small>-</small>`;
        cell.append(meta);
        target.append(cell);
      }
    };
    drawGrid($('kit3-now-grid'),false);
    drawGrid($('kit3-prop-grid'),true);
  }
  $('kit3-hide-unused').onchange=renderKit3;
  renderKit3();

  window.PENDING_REVIEW={
    get state(){return {ready:true,time,config:{...config},emblems:runners.map(r=>r.emblem),decodeText:$('decode-prop-mib').textContent};},
    select(next={},t=1.45){playing=false;applyConfig(next);seek(t);return this.state;},
    KIT3,
  };
}

main();

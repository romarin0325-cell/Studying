import {HERO,HEROES,ARTIFACT,ARTIFACTS,RARITY,RARITIES,DEFAULT_DECK,CHAPTERS,BOSSES,BOSS_ORDER,BLESSING,TUNING as T,QUOTES} from './content.js';
import {calendar,duplicateCost,enhanceMultiplier,specialMultiplier,levelCost,heroMultiplier,combatPower,dispatchSlots,dispatchReward,relicTier,relicThreshold,relicRates,idleReward,HOUR} from './economy.js';
import {ProfileStore,available,away,teamPower} from './profile.js';
import {createBattle,resumeBattle,autoPlay,clearedRounds} from './battle.js';
import * as E from './combat/engine.js';
import {Art,Renderer} from './combat/render.js';
import {Sound} from './combat/audio.js';
import {icon} from './icons.js';
import {currentRecord,monthlyReward} from './monthly.js';
import {RenderClock,RunSaveQueue} from './runtime.js';
import {TEAM_SIZE,SOLO,SAVE_KEY} from './team-config.js';
import {MEMORIAL_STORIES} from './memorial.js';

const $=id=>document.getElementById(id),storage={getItem:k=>window.localStorage.getItem(k),setItem:(k,v)=>window.localStorage.setItem(k,v)};
const store=new ProfileStore(storage),art=new Art(),sound=new Sound();
const p=()=>store.value,now=()=>Math.max(Date.now(),p().clockAt),fmt=n=>Number.isFinite(n)?n>=100000?new Intl.NumberFormat('ko-KR',{notation:'compact',maximumFractionDigits:1}).format(n):Math.floor(n).toLocaleString('ko-KR'):'—';
const pct=n=>(n*100).toFixed(n<.001?3:2)+'%';
let screen='home',collection='hero',rarity='all',ownedOnly=false,banner='normal',mode='main',cycle=Math.floor(p().cleared/9),
  modal=null,modalInfo=null,previousFocus=null,toastTimer,run=null,renderer=null,speed=1,paused=false,saveBlocked=false,selected=-1,pointer=null,
  lastFrame=0,accumulator=0,autoIn=0,uiIn=0,previousPhase='',lastResult=null,hud=null;
const renderClock=new RenderClock(),performanceStats={renders:0,steps:0};
const saves=new RunSaveQueue(()=>!run||store.saveRun(E.serialize(run)),{
  request:cb=>window.requestIdleCallback?window.requestIdleCallback(cb,{timeout:1200}):setTimeout(cb,80),
  cancel:id=>window.cancelIdleCallback?window.cancelIdleCallback(id):clearTimeout(id),failed:storagePause,
});
const media=window.__GARDEN_MEDIA__||{};
let memorialImage=null,memorialGeneration=0,memorialHero=null,memorialPage=0;
const escapeText=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fallback=id=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><circle cx="64" cy="64" r="40" fill="${HERO[id]?.color||'#abc8b4'}"/><text x="64" y="80" text-anchor="middle" fill="#fff" font-size="38">✦</text></svg>`);
const picture=(id,full=false)=>media[(full?'figure:':'portrait:')+id]||media['relic:'+id]||fallback(id);
const image=(id,full=false,cls='')=>`<img class="${cls}" src="${picture(id,full)}" alt="${HERO[id]?.name||ARTIFACT[id]?.name||'별빛'}" draggable="false">`;
const badge=(r,cls='')=>`<span class="badge ${cls}" data-rarity="${r}">${r}</span>`;
const gem=(n,short=false)=>`<span class="cost ${short?'short':''}">${icon('gem')}<b>${fmt(n)}</b></span>`;
const cpOf=id=>fmt(combatPower(id,p().heroes[id]));
const chips=list=>list.filter(Boolean).map(t=>`<span class="chip">${t}</span>`).join('');
const stageLabel=n=>String(n).padStart(2,'0');
const monthNo=c=>`${Number(String(c.month).slice(-2))}월`;
const bossOf=stage=>BOSSES[CHAPTERS[stage-1].bosses[0]];
const portrait=(id,extra='')=>`<span class="portrait ${extra}" data-rarity="${HERO[id].rarity}">${image(id)}</span>`;
function toast(text){if(!text)return;clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,2800);}
function settings(){sound.enabled=p().settings.sound;sound.music=p().settings.sound;sound.setVolume(.2);$('app').dataset.reduced=String(p().settings.reduced||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);if(renderer){renderer.reduced=$('app').dataset.reduced==='true';renderer.setQuality(p().settings.quality);}}
function wallet(){const profile=p();$('dreams').textContent=fmt(profile.dreams);$('dust').textContent=fmt(profile.dust);$('save-warning').hidden=!store.broken&&!store.conflict;$('save-warning').textContent=store.warning||'다른 창에서 저장 내용이 바뀌었습니다. 이 창을 새로고침하세요.';settings();}
function act(action,args={},showToast=true){const result=store.transact(action,args,now());wallet();if(!result.ok||showToast)toast(result.message);return result;}
function nav(){
  const profile=p(),c=calendar(now()),daily=profile.daily.day===c.day?profile.daily:{claimed:[]};
  const dots={dispatch:profile.dispatches.some(d=>d.end<=now()),home:['combat','draw','dispatch'].some(id=>daily[id]&&!daily.claimed.includes(id))};
  $('navigation').innerHTML=[['home','홈'],['collection','동료'],['adventure','모험'],['summon','소환'],['dispatch','파견']].map(([id,name])=>`<button class="nav-item" data-nav="${id}" ${screen===id?'aria-current="page"':''}>${icon(id)}<span>${name}</span>${dots[id]?'<i class="dot"></i>':''}</button>`).join('');
  $('navigation').hidden=screen==='battle'||screen==='draft';
}
function render(){$('app').dataset.screen=screen;document.body.dataset.battle=String(screen==='battle');wallet();nav();$('content').scrollTop=0;if(screen==='battle')return renderBattle();if(screen==='draft')return renderDraft();const templates={home:home,collection:renderCollection,adventure:adventure,summon:renderSummon,dispatch:renderDispatch};$('content').innerHTML=(templates[screen]||home)();}
const heading=(title,right='',sub='')=>`<div class="page-heading"><div><h1>${title}</h1>${sub?`<p>${sub}</p>`:''}</div>${right}</div>`;
function five(ids,edit=false){
  return `<div class="five-line" style="--team-size:${TEAM_SIZE}">${Array.from({length:TEAM_SIZE},(_,i)=>ids[i]
    ?`<button class="team-slot" ${edit?'data-team-pick':'data-hero'}="${ids[i]}" aria-label="${HERO[ids[i]].name} ${edit?'편성 해제':'정보'}"><span class="portrait" data-rarity="${HERO[ids[i]].rarity}">${image(ids[i])}${badge(HERO[ids[i]].rarity)}</span><small>${HERO[ids[i]].name}</small></button>`
    :`<button class="team-slot" data-action="${edit?'focus-team':'team'}" aria-label="${i+1}번째 동료 선택"><span class="portrait empty-slot">${icon('plus')}</span><small>비어 있음</small></button>`).join('')}</div>`;
}
function home(){
  const profile=p(),hero=HERO[profile.partner],c=calendar(now()),bond=profile.heroes[hero.id].bond,quotes=QUOTES[hero.id]||['출격 준비 완료.','다음 스테이지로 가볼까요?'],quote=quotes[bond%quotes.length],stage=Math.min(45,profile.cleared+1),idle=idleReward(profile,now()),
    daily=profile.daily.day===c.day?profile.daily:{claimed:[]},claimable=['combat','draw','dispatch'].some(id=>daily[id]&&!daily.claimed.includes(id)),owned=HEROES.filter(h=>profile.heroes[h.id].owned).length,active=profile.active,petDone=profile.petDay===c.day;
  const depart=active
    ?{title:'이어하기',sub:active.mode==='weekly'?'주간 드래프트 진행 중':active.mode==='monthly'?'월간 보스전 진행 중':`스테이지 ${stageLabel(active.stage)} 진행 중`,num:icon('play')}
    :{title:profile.cleared===45?'다시 도전':'출격',sub:`스테이지 ${stageLabel(stage)} · ${bossOf(stage).name}`,num:stageLabel(stage)};
  return `<section class="scene" aria-label="${hero.name} 파트너 화면">
    <button class="season-chip" data-action="season">${icon('crown')}<span><small>${monthNo(c)} 이달의 수호자</small><b>${HERO[c.guardian].name}</b></span>${badge('UR')}</button>
    ${image(hero.id,true,'scene-partner')}
    <div class="nameplate"><div class="np-top">${badge(hero.rarity)}<strong>${hero.name}</strong></div><small>${hero.title}</small><button class="bond bond-button" data-memorial="${hero.id}" aria-label="${hero.name}의 인연 이야기">${icon('heart')}호감도 ${bond}<span>기억 ${icon('chevron')}</span></button><p class="quote">${quote}</p></div>
    <div class="scene-actions">
      <button class="round ${petDone?'done':''}" data-action="pet">${icon('heart')}<span>인사</span><em>${petDone?'완료':'+40'}</em></button>
      <button class="round" data-action="partner" aria-label="파트너 변경">${icon('swap')}<span>변경</span></button>
    </div>
  </section>
  <section class="home-body">
    <button class="primary depart" data-action="${active?'resume':'prepare'}" data-stage="${stage}"><span class="depart-num">${depart.num}</span><span class="depart-text"><b>${depart.title}</b><small>${depart.sub}</small></span>${icon('chevron')}</button>
    <div class="panel"><div class="panel-head"><h3>출전 팀</h3><span class="power">전투력 <b>${fmt(teamPower(profile))}</b></span><button class="link" data-action="team">편성 변경</button></div>${five(profile.deck)}</div>
    <div class="panel idle"><span class="idle-icon">${icon('dust')}</span><div class="idle-info"><div class="idle-line"><strong>방치 보상</strong><b class="idle-amount" id="idle-total">${fmt(idle)}</b></div><div class="progress"><span id="idle-progress" style="width:${Math.min(100,(now()-profile.idleAt)/(20*HOUR)*100)}%"></span></div><small>시간당 ${14+profile.cleared*2} · 최대 20시간</small></div><button class="secondary" data-action="idle" ${idle<1?'disabled':''}>수령</button></div>
    <div class="tiles">
      <button class="tile" data-action="daily">${icon('scroll')}<span><b>일일 임무</b><small>수령 ${daily.claimed.length}/3</small></span>${claimable?'<i class="dot"></i>':''}</button>
      <button class="tile" data-action="go-collection">${icon('book')}<span><b>동료 도감</b><small>${owned}/${HEROES.length} 수집</small></span></button>
    </div>
  </section>`;
}
function card(id,kind='hero',receipt=null){
  const h=kind==='hero'?HERO[id]:ARTIFACT[id],e=kind==='hero'?p().heroes[id]:p().relics[id],need=duplicateCost(e.enhance),ready=e.owned&&e.copies>=need,gone=kind==='hero'&&away(p(),id);
  const tag=receipt?(receipt.fresh?'NEW':'중복 +1'):e.owned&&e.enhance>0?`+${e.enhance}`:'';
  const sub=receipt?(receipt.fresh?'신규 획득':'강화 재료'):!e.owned?(h.hidden?'시즌 한정':'미획득'):gone?'파견 중':kind==='hero'?`Lv.${e.level} · ${cpOf(id)}`:`중복 ${e.copies}/${need}`;
  return `<button class="hero-card ${!e.owned?'locked':''} ${ready?'can-enhance':''} ${gone?'is-away':''}" data-${kind==='hero'?'hero':'relic'}="${id}" data-rarity="${h.rarity}" aria-label="${h.name}, ${h.rarity}, ${e.owned?'보유':'미보유'}${ready?', 강화 가능':''}">${badge(h.rarity)}${tag?`<span class="tag ${receipt?.fresh?'new':''}">${tag}</span>`:''}<span class="art">${image(id)}${!e.owned?icon('lock','lock'):''}</span><strong>${h.name}</strong><small>${sub}</small>${e.owned&&!receipt?`<span class="dup" aria-hidden="true"><i style="width:${Math.min(100,e.copies/need*100)}%"></i>${ready?icon('up'):''}</span>`:''}</button>`;
}
function renderCollection(){
  const list=collection==='hero'?HEROES:ARTIFACTS,table=collection==='hero'?p().heroes:p().relics,filtered=list.filter(h=>(rarity==='all'||h.rarity===rarity)&&(!ownedOnly||table[h.id].owned)),count=list.filter(h=>table[h.id].owned).length;
  const total=(kind,l,t)=>`${l.filter(h=>t[h.id].owned).length}/${l.length}`;
  return `<section class="page">${heading(collection==='hero'?'동료':'유물',`<span class="count"><b>${count}</b> / ${list.length}</span>`)}
    <div class="segmented"><button data-collection="hero" aria-pressed="${collection==='hero'}">동료 ${total('hero',HEROES,p().heroes)}</button><button data-collection="relic" aria-pressed="${collection==='relic'}">유물 ${total('relic',ARTIFACTS,p().relics)} · 장착 ${p().equipped.length}/3</button></div>
    <div class="filters">${['all',...RARITIES].map(r=>`<button data-filter="${r}" data-rarity="${r==='all'?'':r}" aria-pressed="${rarity===r}">${r==='all'?'전체':r}</button>`).join('')}<button class="owned-toggle" data-action="owned" aria-pressed="${ownedOnly}">보유만</button></div>
    <div class="collection-grid">${filtered.map(h=>card(h.id,collection)).join('')||'<p class="empty">조건에 맞는 항목이 없습니다.</p>'}</div>
    <p class="fineprint" style="text-align:center">중복으로 얻은 동료·유물은 강화 재료로 자동 저장됩니다.</p></section>`;
}
function heroDetail(id){
  const h=HERO[id],e=p().heroes[id];if(!h)return;
  const mult=heroMultiplier(e),enh=duplicateCost(e.enhance),lvl=levelCost(e.level),isAway=away(p(),id),roles=h.role.split(' · '),special=((specialMultiplier(e.enhance)-1)*100).toFixed(1);
  show(h.name,'동료',`<div class="detail-hero" data-rarity="${h.rarity}"><div class="detail-art">${image(id,true)}</div><div class="detail-meta">${badge(h.rarity)}<h3>${h.title}</h3><div class="chips">${chips([...roles,h.hidden?'시즌 한정':'',isAway?'파견 중':''])}</div></div></div>
    <div class="metrics"><div class="metric"><small>전투력</small><b>${e.owned?cpOf(id):'—'}</b></div><div class="metric"><small>레벨</small><b>${e.owned?e.level:'—'}</b></div><div class="metric"><small>강화</small><b>+${e.enhance}</b></div></div>
    <button class="memory-entry" data-memorial="${id}"><span class="memory-seal">${icon(e.owned&&e.bond>=10?'heart':'lock')}</span><span><small>인연 이야기 · 호감도 ${e.bond}/10</small><strong>${escapeText(MEMORIAL_STORIES[id].title)}</strong></span>${icon('chevron')}</button>
    <div class="ability"><span class="ability-tag">기본 공격 · 특성</span><h3>${roles[1]||roles[0]} · 위력 ${e.owned?(h.damage*mult).toFixed(1):h.damage}</h3><p>${h.trait.text}</p></div>
    <div class="ability"><span class="ability-tag skill">필살기 · 별빛 ${h.skill.cost}${h.skill.goldCost?` · ${h.skill.goldCost} G`:''}</span><h3>${h.skill.name}</h3><p>${h.skill.text}</p></div>
    ${e.owned?`<div class="growth"><div><strong>레벨업</strong><small>Lv.${e.level} → ${e.level+1} · 기본 위력 +4%</small></div><button class="primary" data-level="${id}" ${p().dust<lvl||p().active?'disabled':''}><b>레벨업</b><small>${icon('dust')}${fmt(lvl)}</small></button></div>
    <div class="growth"><div><strong>강화 +${e.enhance} → +${e.enhance+1}</strong><small>중복 ${fmt(e.copies)} / ${fmt(enh)} · 기본 위력 +10%</small><div class="progress"><span style="width:${Math.min(100,e.copies/enh*100)}%"></span></div></div><button class="secondary" data-enhance="${id}" ${e.copies<enh||p().active?'disabled':''}>강화</button></div>
    <details class="more"><summary>수치 상세</summary><p>현재 위력 배율 ${mult.toFixed(2)}배. 강화 1회마다 기본 위력이 10% 증가합니다. 제어·지원 효과는 별도로 +${special}%(최대 15%) 보정을 받으며, 범위와 발동 조건은 변하지 않습니다.</p></details>
    ${p().active?'<p class="note">원정 진행 중에는 성장할 수 없습니다.</p>':''}`
    :`<p class="empty">${h.hidden?`${monthNo(calendar(now()))} 시즌 소환에서만 획득할 수 있습니다.<br>이달의 수호자: ${HERO[calendar(now()).guardian].name}`:`${h.rarity} 등급 · 일반 소환에서 획득할 수 있습니다.`}</p>`}`,
    e.owned?`<div class="dialog-buttons"><button class="secondary" data-set-partner="${id}">${p().partner===id?'현재 파트너':'파트너 지정'}</button><button class="primary" data-action="team" ${isAway?'disabled':''}>편성 확인</button></div>`:`<button class="primary wide" data-action="go-summon">소환하러 가기</button>`,'hero',id);
}
function relicDetail(id){
  const a=ARTIFACT[id],e=p().relics[id],cost=duplicateCost(e.enhance),equipped=p().equipped.includes(id);
  show(a.name,'유물',`<div class="detail-hero" data-rarity="${a.rarity}"><div class="detail-art">${image(id)}</div><div class="detail-meta">${badge(a.rarity)}<h3>${a.name}</h3><div class="chips">${chips([equipped?'장착 중':'',`강화 +${e.enhance}`])}</div></div></div>
    <div class="ability"><span class="ability-tag skill">원정 효과</span><p>${a.text}</p></div>
    ${e.owned?`<div class="growth"><div><strong>강화 +${e.enhance} → +${e.enhance+1}</strong><small>중복 ${e.copies} / ${cost} · 원정 위력 +${(e.enhance*2).toFixed(0)}% → +${((e.enhance+1)*2).toFixed(0)}%</small><div class="progress"><span style="width:${Math.min(100,e.copies/cost*100)}%"></span></div></div><button class="secondary" data-enhance-relic="${id}" ${e.copies<cost||p().active?'disabled':''}>강화</button></div>
    <details class="more"><summary>수치 상세</summary><p>장착한 유물만 강화 보정을 줍니다. 고유 효과는 유지되며, 강화 1회마다 원정 전체 위력이 2% 증가합니다. 등급별 수치는 추후 조정될 수 있습니다.</p></details>`
    :'<p class="empty">유물 소환에서 획득할 수 있습니다.<br>소환 횟수가 쌓이면 높은 등급 확률이 올라갑니다.</p>'}`,
    e.owned?`<button class="primary wide" data-equip="${id}" ${p().active?'disabled':''}>${equipped?'장착 해제':'장착'} (${p().equipped.length}/3)</button>`:`<button class="primary wide" data-action="go-relic-summon">유물 소환하러 가기</button>`,'relic',id);
}
function adventure(){
  const profile=p(),next=Math.min(45,profile.cleared+1);cycle=Math.min(4,Math.max(0,cycle));
  const rows=CHAPTERS.slice(cycle*9,cycle*9+9).map(c=>{const done=c.stage<=profile.cleared,cur=c.stage===next,lock=c.stage>profile.cleared+1;
    return `<button class="stage-row ${cur?'current':''} ${done?'done':''}" data-prepare-stage="${c.stage}" ${lock?'disabled':''}><span class="node">${stageLabel(c.stage)}</span><span class="stage-info"><strong>${BOSSES[c.bosses[0]].name}</strong><small>${c.name} · 6웨이브</small></span><span class="stage-status">${done?`${icon('check')}클리어`:cur?'도전':`${icon('lock')}잠김`}</span></button>`;}).join('');
  const nextSlot=profile.cleared<36?`스테이지 ${9*(Math.floor(profile.cleared/9)+1)} 클리어 시<br>파견 슬롯 +1`:'파견 슬롯 모두 해금';
  return `<section class="page">${heading('모험',`<button class="secondary small" data-action="records">기록</button>`)}
    <div class="segmented">${[['main','메인 스테이지'],['weekly','주간 드래프트'],['monthly','월간 보스전']].map(([id,name])=>`<button data-mode="${id}" aria-pressed="${mode===id}">${name}</button>`).join('')}</div>
    ${mode==='main'?`<div class="progress-banner"><div><small>클리어</small><h2>${profile.cleared}<span> / 45</span></h2><p>파견 보상 +${profile.cleared*5}%</p></div><div class="banner-next">${icon('dispatch')}<span>${nextSlot}</span></div><div class="progress"><span style="width:${profile.cleared/45*100}%"></span></div></div>
    <div class="cycle-tabs">${Array.from({length:5},(_,i)=>`<button data-cycle="${i}" aria-pressed="${cycle===i}">${i*9+1}–${i*9+9}</button>`).join('')}</div>
    <div class="stage-list">${rows}</div>`:modeCard(mode)}</section>`;
}
function modeCard(kind,withAction=true){
  if(kind==='monthly')return monthlyCard(withAction);
  const weekly=true,profile=p(),used=profile.weekly===calendar(now()).week,unlocked=profile.cleared>=3;
  const label=!unlocked?'스테이지 3 클리어 시 해금':used?'이번 기간 입장 완료':weekly?'드래프트 준비':'도전 준비';
  return `<div class="mode-card ${kind}"><div><span class="tag">${weekly?'주 1회 · 월요일 00:00 초기화':'월 1회 · 매월 1일 00:00 초기화'}</span><h2>${weekly?'주간 드래프트':'월간 보스전'}</h2><p>${weekly?'보유한 모든 동료 중 2택 1을 ${TEAM_SIZE}번 반복해 팀을 꾸리고, 점점 강해지는 적을 돌파합니다.':'매 웨이브 보스 1체만 등장합니다. 단일 대상 화력과 약화 효과가 핵심입니다.'}</p></div>
    <div class="stat-chips"><div><small>입장</small><b>${used?'소진':'1회 가능'}</b></div><div><small>적 HP / 라운드</small><b>×${weekly?'1.85':'1.72'}</b></div><div><small>라운드 보상</small>${gem(weekly?60:50)}</div></div>
    <ul class="notes"><li>제한 시간 ${weekly?35:30}초 / 라운드</li><li>기본 보상 ${weekly?120:150} + ${weekly?'클리어 라운드':'격파 보스'}당 ${weekly?60:50}</li><li>파견 중인 동료는 참여할 수 없습니다.</li><li>중단해도 같은 입장으로 이어할 수 있습니다.</li></ul>
    ${withAction?`<button class="primary wide" data-action="prepare-mode" ${!unlocked||used||profile.active?'disabled':''}>${label}</button>`:''}
    <details class="more"><summary>운영 규칙</summary><p>기간은 한국·일본 시간(UTC+9) 기준입니다. 입장하면 이번 기간의 1회가 소진됩니다.</p></details></div>`;
}
function monthlyRecordPanel(){
  const record=currentRecord(p(),now()),claimed=p().monthly===calendar(now()).month,all=p().monthlyLifetime;
  return `<div class="monthly-record"><span class="eyebrow">${monthNo(calendar(now()))} 최고 기록</span><div class="record-score"><b>${record?record.round:'—'}</b><span>보스 격파</span>${record?'<span class="record-stamp">BEST</span>':''}</div><p>${record?`${record.token.startsWith('legacy-')?'피해 기록 없음':`총 피해 ${fmt(record.damage)}`} · ${calendar(record.at).day}`:'도전을 마치면 최고 기록이 이곳에 남습니다.'}</p>
    ${record?`<div class="record-team"><small>기록 당시 편성</small>${record.deck.map(id=>portrait(id)).join('')}</div>`:''}
    <div class="record-payout"><span>${claimed?'이번 달 확정 보상':'이 기록으로 받을 보상'}</span>${claimed?p().monthlyClaim?gem(monthlyReward(p().monthlyClaim)):'<b>수령 완료</b>':record?gem(monthlyReward(record)):'<b>기록 대기</b>'}</div>
    ${claimed?'<p class="record-note">보상 확정 완료 · 기록 갱신과 재도전은 계속 가능합니다.</p>':record?'<button class="secondary wide" data-action="monthly-claim">이 기록으로 보상 받기</button>':''}
    ${all?`<div class="lifetime-record">역대 최고 <strong>${all.round}보스</strong><small>${all.period} · 총 피해 ${fmt(all.damage)}</small></div>`:''}</div>`;
}
function monthlyCard(withAction=true){
  return `<div class="mode-card monthly"><span class="tag">입장 무제한 · 보상은 월 1회 확정</span><h2>월간 보스전</h2><p>최적의 편성을 찾아 보스 연전을 돌파하세요. 더 좋은 기록을 세운 뒤 이번 달 보상을 확정할 수 있습니다.</p>
    ${monthlyRecordPanel()}<div class="stat-chips"><div><small>입장</small><b>무제한</b></div><div><small>적 HP / 라운드</small><b>×1.72</b></div><div><small>제한 시간</small><b>30초</b></div></div>
    <ul class="notes"><li>보스 격파 수 우선, 같은 격파 수에서는 총 피해로 최고 기록을 판정합니다.</li><li>꿈의결정 150 + 격파 보스당 50. 수령 후 더 높은 기록을 세워도 추가 지급되지 않습니다.</li><li>파견 중인 동료는 참여할 수 없습니다.</li></ul>
    ${withAction?`<button class="primary wide" data-action="prepare-mode" ${p().cleared<3||p().active?'disabled':''}>${p().cleared<3?'스테이지 3 클리어 시 해금':'보스전 도전'}</button>`:''}
    <details class="more"><summary>월간 기록 규칙</summary><p>UTC+9 기준 매월 1일 초기화됩니다. 월을 넘겨 마친 도전은 종료한 달의 기록이 됩니다. 역대 최고 기록은 유지됩니다. 보상 수령 전 확인 화면의 기록과 금액을 확정합니다.</p></details></div>`;
}
function confirmMonthlyClaim(){
  const record=currentRecord(p(),now());if(!record||p().monthly===record.period){toast('이번 달 보상 상태를 확인하세요.');return;}
  show('이 기록으로 보상을 확정할까요?',`${record.period} 월간 보스전`,`<div class="claim-score"><b>${record.round}</b><span>보스 격파</span></div><div class="reward-box"><span>확정할 보상</span>${gem(monthlyReward(record))}</div><p class="subtext">이번 달 보상은 한 번만 받을 수 있습니다. 기록을 더 올리고 싶다면 재도전한 뒤 수령하세요. 확정 후에도 최고 기록은 계속 갱신됩니다.</p>`,
    `<div class="dialog-buttons"><button class="secondary" data-action="close">더 도전하기</button><button class="primary" data-confirm-monthly="${record.token}">보상 확정</button></div>`,'monthly-claim');
}
function renderSummon(){
  const c=calendar(now()),featured=banner==='season'?c.guardian:banner==='relic'?'broken_clock':'snow_rabbit',tier=relicTier(p().relicDraws),remaining=relicThreshold(tier+1)-p().relicDraws,cost=banner==='relic'?T.relicDrawCost:T.heroDrawCost,rateList=banner==='relic'?relicRates(p().relicDraws):T.heroRates,dreams=p().dreams;
  const copy={
    normal:{tag:'상시',title:'동료 소환',desc:'C~UR 동료 24명 중 한 명을 만납니다. 중복은 강화 재료가 됩니다.'},
    season:{tag:`시즌 한정 · ${monthNo(c)}`,title:HERO[c.guardian].name,desc:'이달의 수호자는 이 소환에서만 만날 수 있습니다.'},
    relic:{tag:'유물',title:'유물 소환',desc:`누적 ${fmt(p().relicDraws)}회 · ${tier}단계. 단계가 오를수록 높은 등급 확률이 상승합니다.`}}[banner];
  return `<section class="page">${heading('소환')}
    <div class="segmented">${[['normal','일반'],['season','시즌'],['relic','유물']].map(([id,name])=>`<button data-banner="${id}" aria-pressed="${banner===id}">${name}</button>`).join('')}</div>
    <div class="summon-banner ${banner}"><span class="banner-tag">${copy.tag}</span><h2>${copy.title}</h2><p>${copy.desc}</p>${image(featured,banner!=='relic','banner-figure')}<div class="rate-chips">${RARITIES.map((r,i)=>`<span class="rate">${badge(r)}${pct(rateList[i])}</span>`).join('')}</div></div>
    ${banner==='relic'?`<div class="relic-tier"><div><span>유물 단계 <b>${tier}</b></span><span>다음 단계까지 ${fmt(remaining)}회</span></div><div class="progress"><span style="width:${100*(p().relicDraws-relicThreshold(tier))/(relicThreshold(tier+1)-relicThreshold(tier))}%"></span></div></div>`:''}
    <div class="summon-actions"><button class="secondary" data-draw="1"><b>1회 소환</b>${gem(cost,dreams<cost)}</button><button class="primary" data-draw="10"><b>10회 소환</b>${gem(cost*10,dreams<cost*10)}</button></div>
    <div class="summon-links"><button class="link" data-action="rates">확률 안내</button><button class="link" data-action="history">소환 기록 ${Math.min(50,p().history.length)}</button></div></section>`;
}
function rates(){
  const c=calendar(now()),list=banner==='relic'?relicRates(p().relicDraws):T.heroRates;
  let rows=RARITIES.map((r,i)=>`<div class="rate-row"><span>${badge(r)} ${RARITY[r].name}</span><b>${pct(list[i])}</b></div>`).join('');
  if(banner==='season')rows+=`<div class="rate-row"><span>일반 UR 6종 합계</span><b>0.100%</b></div><div class="rate-row"><span>UR · ${HERO[c.guardian].name}</span><b>0.100%</b></div>`;
  const price=banner==='relic'?T.relicDrawCost:T.heroDrawCost;
  show('소환 확률',banner==='relic'?'유물':banner==='season'?'시즌':'일반',`<p class="subtext">${banner==='relic'?`유물 ${relicTier(p().relicDraws)}단계 · 누적 ${fmt(p().relicDraws)}회`:'1회 소환 기준 · 같은 등급 안에서는 동일 확률'}</p>${rows}
    <ul class="notes" style="margin-top:14px"><li>${banner==='season'?'UR 총 0.2% = 일반 UR 0.1% + 이달의 수호자 0.1%. 다른 달 수호자는 등장하지 않습니다.':'일반 소환에는 시즌 수호자가 등장하지 않습니다.'}</li><li>1회와 10회의 확률은 같습니다. 확정·천장은 없습니다.</li>${banner==='relic'?'<li>10회 소환 중 단계가 오르면 다음 1회부터 새 확률이 적용됩니다.</li>':''}<li>1회 ${price} 꿈의결정. 중복은 강화 재료로 저장됩니다.</li></ul>
    <details class="more"><summary>등급별 획득 대상</summary>${(banner==='relic'?ARTIFACTS:HEROES.filter(h=>!h.hidden||banner==='season'&&h.id===c.guardian)).map(h=>`<div class="rate-row"><span>${h.name}</span>${badge(h.rarity)}</div>`).join('')}</details>`,`<button class="primary wide" data-action="close">확인</button>`,'rates');
}
function draw(count){
  const result=act('draw',{banner,count},false);if(!result.ok)return;render();
  const best=result.items.reduce((a,b)=>RARITIES.indexOf((HERO[b.id]||ARTIFACT[b.id]).rarity)>RARITIES.indexOf((HERO[a.id]||ARTIFACT[a.id]).rarity)?b:a),top=(HERO[best.id]||ARTIFACT[best.id]).rarity;
  show('소환 결과',`최고 등급 ${top}`,`<p class="reveal-caption">신규 ${result.items.filter(i=>i.fresh).length}종 · 꿈의결정 ${fmt(result.cost)} 사용</p><div class="reveal-grid ${count===1?'single':''}">${result.items.map((item,i)=>card(item.id,banner==='relic'?'relic':'hero',item).replace('class="hero-card',`style="animation-delay:${i*.035}s" class="hero-card`)).join('')}</div>`,
    `<div class="dialog-buttons"><button class="secondary" data-action="go-collection">${banner==='relic'?'유물 보기':'도감 보기'}</button><button class="primary" data-action="close">확인</button></div>`,'draw');
}
function renderDispatch(){
  const profile=p(),count=dispatchSlots(profile.cleared);
  const cards=Array.from({length:4},(_,slot)=>{
    const d=profile.dispatches.find(x=>x.slot===slot),n=slot+1;
    if(slot>=count)return `<div class="dispatch-card locked"><span class="slot-no">${n}</span><div class="slot-body"><strong>슬롯 ${n}</strong><small>스테이지 ${9*(slot+1)} 클리어 시 해금</small></div>${icon('lock')}</div>`;
    if(!d)return `<div class="dispatch-card"><div class="slot-head"><span class="slot-no">${n}</span><div class="slot-body"><strong>슬롯 ${n} · 대기 중</strong><small>동료 1명 · 20시간 · 전투 참여 불가</small></div></div><button class="secondary wide" data-dispatch-slot="${slot}" ${profile.active?'disabled':''}>${icon('plus')}동료 선택</button></div>`;
    const done=d.end<=now();
    return `<div class="dispatch-card ${done?'ready':'running'}"><div class="slot-head"><span class="slot-no">${n}</span>${portrait(d.hero)}<div class="slot-body"><strong>${HERO[d.hero].name}</strong>${gem(d.reward)}</div><span class="timer" data-timer="${d.end}">${timerText(d.end)}</span></div><div class="progress"><span style="width:${Math.min(100,(now()-d.start)/(d.end-d.start)*100)}%"></span></div><button class="${done?'primary':'secondary'} wide" data-claim-dispatch="${slot}" ${!done||profile.active?'disabled':''}>${done?'보상 수령':'파견 중'}</button></div>`;}).join('');
  return `<section class="page">${heading('파견')}
    <div class="chips"><span class="chip">${icon('dispatch')}슬롯 ${count}/4</span><span class="chip">보상 보너스 +${profile.cleared*5}%</span></div>
    <p class="subtext" style="margin-top:10px">동료를 20시간 파견해 꿈의결정을 획득합니다. 앱을 닫아도 시간이 흐르며, 파견 중에는 전투에 참여할 수 없습니다.</p>
    <div class="dispatch-list">${cards}</div>
    <p class="fineprint">스테이지 9·18·27·36 클리어 시 슬롯이 하나씩 열립니다. 보상은 출발 시점의 전투력과 클리어 수로 확정됩니다.</p></section>`;
}
function duration(ms){const seconds=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
function timerText(end){return end<=now()?'귀환 완료':duration(end-now());}
function chooseDispatch(slot){
  const free=available(p());
  show('파견 동료 선택','20시간 파견',`<p class="subtext">파견 중인 동료는 전투에 참여할 수 없습니다. 편성된 동료는 남은 동료로 자동 교체됩니다.</p><div class="choose-list" style="margin-top:14px">${free.map(id=>`<button class="choose-row" data-send="${id}" data-slot="${slot}" ${free.length<=TEAM_SIZE?'disabled':''}>${portrait(id)}<div><strong>${HERO[id].name}${badge(HERO[id].rarity)}</strong><small>전투력 ${cpOf(id)}</small></div>${gem(dispatchReward(combatPower(id,p().heroes[id]),p().cleared))}${icon('chevron')}</button>`).join('')}</div>${free.length<=TEAM_SIZE?`<p class="fineprint">전투 가능한 동료가 ${TEAM_SIZE}명뿐입니다. 소환으로 동료를 더 모으세요.</p>`:''}`,`<button class="secondary wide" data-action="close">취소</button>`,'dispatch',slot);
}
let editingDeck=[],teamReturn=null;
function team(edit=false){
  if(!edit){teamReturn=modal==='prepare'?modalInfo:null;editingDeck=[...p().deck];}
  show('팀 편성',`출전 ${editingDeck.length}/${TEAM_SIZE}`,`${five(editingDeck,true)}<p class="fineprint" style="margin-top:10px">서로 다른 동료 ${TEAM_SIZE}명이 필요합니다. 편성된 동료를 누르면 해제됩니다.</p><div class="choose-list" style="margin-top:14px">${HEROES.filter(h=>p().heroes[h.id].owned).map(h=>`<button class="choose-row" data-team-pick="${h.id}" aria-pressed="${editingDeck.includes(h.id)}" ${away(p(),h.id)||p().active?'disabled':''}>${portrait(h.id)}<div><strong>${h.name}${badge(h.rarity)}</strong><small>${away(p(),h.id)?'파견 중 · 귀환 후 편성 가능':`${h.role} · 전투력 ${cpOf(h.id)}`}</small></div><span class="mark">${editingDeck.includes(h.id)?icon('check'):icon('plus')}</span></button>`).join('')}</div>`,
    `<button class="primary wide" data-action="save-team" ${editingDeck.length!==TEAM_SIZE||p().active?'disabled':''}>편성 확정 (${editingDeck.length}/${TEAM_SIZE})</button>`,'team');
}
function partners(){
  show('파트너 변경','홈 화면',`<div class="collection-grid">${HEROES.filter(h=>p().heroes[h.id].owned).map(h=>`<button class="hero-card ${p().partner===h.id?'current':''}" data-set-partner="${h.id}" data-rarity="${h.rarity}">${badge(h.rarity)}<span class="art">${image(h.id)}</span><strong>${h.name}</strong><small>${p().partner===h.id?'현재 파트너':'지정'}</small></button>`).join('')}</div>`,`<button class="secondary wide" data-action="close">취소</button>`,'partners');
}
function prepare(stage=Math.min(45,p().cleared+1),kind='main'){
  if(p().active){toast('진행 중인 원정이 있습니다. 먼저 이어하세요.');return;}
  const c=CHAPTERS[stage-1],boss=BOSSES[c.bosses[0]];
  show(kind==='main'?`스테이지 ${stageLabel(stage)}`:kind==='weekly'?'주간 드래프트':'월간 보스전','출격 준비',`${kind==='main'?`<div class="boss-banner"><small>${c.name}</small><h2>${boss.name}</h2><p>6웨이브 · 3·6웨이브에 보스 등장</p><span class="reward-chip">${stage>p().cleared?`첫 클리어 ${gem(160+10*stage)}`:'반복 클리어 · 별가루 보상'}</span></div>`:`<div style="margin-bottom:12px">${modeCard(kind,false)}</div>`}
    <div class="panel-head"><h3>${kind==='weekly'?'드래프트: 보유 동료 전체':'출전 팀'}</h3><span class="power">전투력 <b>${fmt(teamPower(p()))}</b></span></div>${five(p().deck)}
    <p class="fineprint">장착 유물: ${p().equipped.map(id=>ARTIFACT[id].name).join(', ')||'없음'}</p>${kind==='weekly'?`<p class="fineprint" style="margin-top:4px">2택 1을 총 ${TEAM_SIZE}번 선택합니다. 남은 후보가 한 명이면 같은 동료의 전술 2종 중에서 고릅니다.</p>`:''}`,
    `<div class="dialog-buttons"><button class="secondary" data-action="team">편성 변경</button><button class="primary" data-begin="${kind}" data-stage="${stage}" ${p().deck.length!==TEAM_SIZE?'disabled':''}>${kind==='main'?'출격':'입장하기'}</button></div>`,'prepare',{stage,kind});
}
function begin(kind,stage){const result=act('begin',{mode:kind,stage},false);if(!result.ok)return;close();if(kind==='weekly'){screen='draft';render();}else startBattle();}
function renderDraft(){
  const a=p().active;if(a?.mode!=='weekly'){screen='home';render();return;}if(a.draft.length===TEAM_SIZE){startBattle();return;}
  $('content').innerHTML=`<section class="page">${heading('주간 드래프트',`<span class="count"><b>${a.draft.length+1}</b> / ${TEAM_SIZE}</span>`,'둘 중 한 명을 선택하세요.')}
    <div class="draft-selected">${Array.from({length:TEAM_SIZE},(_,i)=>a.draft[i]?image(a.draft[i]):`<span class="draft-dot">${i+1}</span>`).join('')}</div>
    <div class="draft-options">${a.offers.map((o,i)=>`<button class="draft-card" data-draft="${i}" data-rarity="${HERO[o.id].rarity}">${badge(HERO[o.id].rarity)}<span class="art">${image(o.id,true)}</span><h3>${HERO[o.id].name}</h3><small>${HERO[o.id].role}</small><span class="cpline">전투력 ${cpOf(o.id)}</span><span class="boon">${o.boon==='focus'?'집중 전술 · 위력 +5%':'별빛 전술 · 시작 별빛 +4'}</span></button>`).join('')}</div>
    <p class="draft-help">선택은 자동 저장되어 나중에 이어할 수 있습니다.<br>후보가 한 명뿐이면 같은 동료의 전술 2종 중에서 고릅니다.</p></section>`;
}
function resume(){close();const a=p().active;if(!a)return;if(a.mode==='weekly'&&a.draft.length<TEAM_SIZE){screen='draft';render();}else startBattle(true);}
function startBattle(resume=false){clearTimeout(toastTimer);$('toast').hidden=true;const saved=resume?resumeBattle(p()):null;if(resume&&p().active.run&&!saved){toast('원정 저장을 복원할 수 없습니다. 백업을 확인하세요.');return;}run=saved||createBattle(p());if(!run)return;screen='battle';paused=false;saveBlocked=false;selected=-1;pointer=null;accumulator=0;autoIn=0;uiIn=0;lastFrame=0;renderClock.reset();saves.reset();previousPhase='';close();render();saves.mark();saves.flush();sound.unlock();}
function renderBattle(){
  if(!run)return;
  const title=run.mode==='main'?`스테이지 ${stageLabel(run.chapter+1)} · ${CHAPTERS[run.chapter].name}`:run.mode==='weekly'?'주간 드래프트':'월간 보스전';
  $('content').innerHTML=`<section class="battle">
    <div class="battle-top"><div class="battle-title"><strong>${title}</strong><small id="wave-label"></small></div><button class="chip-btn" data-action="speed" aria-label="전투 속도">${icon('speed')}<b>${speed}×</b></button><button class="icon-btn" id="pause-button" data-action="pause" aria-label="전투 일시정지">${icon('pause')}</button><button class="icon-btn" data-action="leave" aria-label="저장하고 나가기">${icon('exit')}</button></div>
    <div class="hud"><span class="hud-item hp">${icon('heart')}<b id="health"></b></span><span class="hud-item">${icon('coin')}<b id="gold"></b></span><span class="hud-gauge">${icon('star')}<span class="gauge-bar"><i id="gauge-fill"></i></span><b id="gauge"></b><small>/${E.GAUGE_MAX}</small></span><span id="battle-time" class="hud-time"></span></div>
    <div class="arena-wrap"><canvas id="arena" tabindex="0" aria-label="5행 5열 전장. 드래그로만 이동·합성합니다. 탭 또는 방향키와 Enter는 동료 정보 확인입니다."></canvas><p id="battle-notice" class="battle-notice" hidden></p></div>
    <div class="skills" style="--team-size:${TEAM_SIZE}">${run.deck.map(id=>`<button class="skill-button" data-skill="${id}" aria-label="${HERO[id].name}의 ${HERO[id].skill.name}">${image(id)}<small>${icon('star')}${HERO[id].skill.cost}${HERO[id].skill.goldCost?` · ${HERO[id].skill.goldCost}G`:''}</small><span class="skill-duration" hidden></span></button>`).join('')}</div>
    <div class="battle-controls"><button class="primary" data-action="summon-battle">${icon('plus')}<span>동료 소환</span><b id="summon-cost"></b></button><button class="secondary" data-action="training">${icon('up')}훈련</button><button class="secondary toggle-auto" data-action="auto" aria-pressed="${p().settings.auto}"><span>자동</span><b>${p().settings.auto?'ON':'OFF'}</b></button></div>
    <div id="unit-panel" class="unit-panel" hidden></div>
    <p class="battle-hint">드래그: 이동·합성 · 탭: 동료 정보</p></section>`;
  hud=Object.fromEntries(['health','gold','gauge','gauge-fill','battle-time','wave-label','summon-cost','pause-button','battle-notice'].map(id=>[id,$(id)]));
  hud.skills=[...document.querySelectorAll('[data-skill]')].map(node=>({node,id:node.dataset.skill,timer:node.querySelector('.skill-duration')}));
  renderer=new Renderer($('arena'),art);settings();bindArena();updateBattle();
}
const changedText=(node,value)=>{value=String(value);if(node.textContent!==value)node.textContent=value;};
function updateBattle(){
  if(screen!=='battle'||!run)return;
  changedText(hud.health,run.health);changedText(hud.gold,fmt(run.gold));changedText(hud.gauge,Math.floor(run.gauge));changedText(hud['battle-time'],duration(run.time*1000));
  const fill=`scaleX(${Math.min(1,run.gauge/E.GAUGE_MAX).toFixed(3)})`;if(hud['gauge-fill'].style.transform!==fill)hud['gauge-fill'].style.transform=fill;
  changedText(hud['wave-label'],run.mode==='main'?`웨이브 ${run.wave}/6${run.wave===3||run.wave===6?' · 보스 웨이브':''}`:`라운드 ${run.wave} · 클리어 ${clearedRounds(run)} · 남은 ${Math.max(0,Math.ceil((run.mode==='monthly'?30:35)-run.waveTime))}초`);
  changedText(hud['summon-cost'],E.summonCost(run)?E.summonCost(run)+' G':'무료');
  const pauseButton=$('pause-button'),pauseState=paused?'play':'pause';if(pauseButton.dataset.state!==pauseState){pauseButton.dataset.state=pauseState;pauseButton.innerHTML=icon(pauseState);pauseButton.setAttribute('aria-label',paused?'전투 재개':'전투 일시정지');}
  for(const {node:b,id,timer} of hud.skills){const {cost,goldCost=0}=HERO[id].skill,ready=run.gauge>=cost&&run.gold>=goldCost&&!!E.bestUnit(run,id),active=E.activeSkill(run,id);b.disabled=!ready||paused||run.phase!=='combat';b.classList.toggle('ready',ready);b.classList.toggle('active-skill',!!active);timer.hidden=!active;if(active)changedText(timer,`${active.remaining.toFixed(1)}초`);const fill=Math.min(1,run.gauge/cost).toFixed(2);if(b.style.getPropertyValue('--fill')!==fill)b.style.setProperty('--fill',fill);b.setAttribute('aria-label',`${HERO[id].name}의 ${HERO[id].skill.name}${goldCost?` · ${goldCost}골드 소모${run.gold<goldCost?' · 골드 부족':''}`:''}${active?` · 발동 중 ${active.remaining.toFixed(1)}초`:''}`);}
  const notice=hud['battle-notice'],boss=run.enemies.find(e=>e.boss&&e.hp>0);notice.hidden=!run.telegraph&&!boss;changedText(notice,run.telegraph?.text||(boss?`${BOSSES[boss.boss].name} · 체력 ${Math.ceil(boss.hp/boss.maxHp*100)}%`:''));updateUnit();
}
function updateUnit(){
  const panel=$('unit-panel');if(!panel)return;const u=run.board[selected];panel.hidden=!u;renderer.selected=u?selected:-1;
  if(!u){delete panel.dataset.sig;return;}
  const stat=E.combatStats(run,u,selected),trait=E.personalTrait(run,u,selected),h=HERO[u.hero],flame=u.hero==='flame_sage',traitText=u.hero==='lightning_sage'?`${trait.size}연결 · 위력 +${Math.round((trait.damageMultiplier-1)*100)}% · 체인 ${Math.round(trait.chainRatio*100)}%${trait.extraChain?' · 추가 대상 +1':''}`:flame?`경로 화염장 · 0.5초당 ${(stat.damage*trait.zoneDamageMultiplier*.22).toFixed(1)} · 반경 ${stat.radius.toFixed(1)} · ${(3*trait.zoneDurationMultiplier*(E.has(run,'roots')?1.5:1)).toFixed(2).replace(/0$/,'')}초`:trait.label,sig=`${u.uid}:${u.rank}:${u.priority}:${stat.damage.toFixed(1)}:${stat.interval.toFixed(2)}:${selected}:${traitText}`;
  if(panel.dataset.sig===sig)return;
  panel.dataset.sig=sig;
  panel.innerHTML=`<div class="unit-panel-top"><div><strong>${h.name}</strong><small>${flame?`장판 위력 ${(stat.damage*trait.zoneDamageMultiplier).toFixed(1)}`:`위력 ${fmt(stat.damage)}`} · 공격 주기 ${stat.interval.toFixed(2)}초</small></div><span class="rank">${icon('star')}${u.rank}</span></div>${traitText?`<p class="unit-trait ${trait.active?'active':''}"><span>${trait.active?'특성 발동':'특성 상태'}</span>${traitText}</p>`:''}<div class="unit-actions">${E.targetingLocked(u.hero)?`<span class="fixed-target">목표: ${u.hero==='flame_sage'?'경로 위':'무작위 적'}</span>`:`<button data-action="target">목표: ${({first:'선두',boss:'보스',strong:'강적',last:'후미'})[u.priority]}</button>`}<button data-skill-detail="${u.hero}">스킬 상세</button><button data-sell="${selected}">회수 +${Math.round(6*Math.pow(1.7,u.rank-1))} G</button><button data-action="deselect">선택 해제</button></div>`;
}
function battleCommand(result){if(!result?.ok)toast(result?.reason);else saves.mark();updateBattle();}
function bindArena(){
  const canvas=$('arena'),point=e=>{const b=canvas.getBoundingClientRect();return {x:(e.clientX-b.left)*720/b.width,y:(e.clientY-b.top)*780/b.height};};
  const release=()=>{pointer=null;renderer.drag=null;renderer.hover=-1;};
  canvas.addEventListener('pointerdown',e=>{if(paused||modal||pointer||e.button!==0)return;const at=point(e),index=E.cellAt(at.x,at.y);pointer={id:e.pointerId,at,index,uid:run.board[index]?.uid,drag:false};try{canvas.setPointerCapture(e.pointerId);}catch{}e.preventDefault();sound.unlock();});
  canvas.addEventListener('pointermove',e=>{if(pointer?.id!==e.pointerId)return;const at=point(e),u=run.board[pointer.index];if(u?.uid===pointer.uid&&(pointer.drag||Math.hypot(at.x-pointer.at.x,at.y-pointer.at.y)>12)){pointer.drag=true;renderer.drag={hero:u.hero,uid:u.uid,x:at.x,y:at.y,form:E.unitForm(run,u)};renderer.hover=E.cellAt(at.x,at.y);}});
  canvas.addEventListener('pointerup',e=>{if(pointer?.id!==e.pointerId)return;const at=point(e),index=E.cellAt(at.x,at.y);if(!paused&&!modal&&index>=0){if(pointer.drag&&run.board[pointer.index]?.uid===pointer.uid){const result=E.move(run,pointer.index,index);battleCommand(result);if(result.ok)selected=index;}else if(!pointer.drag)activate(index);}release();updateUnit();});
  canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',()=>{if(pointer)release();});
  let keyboard=12;canvas.addEventListener('keydown',e=>{if(paused||modal)return;const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-5,ArrowDown:5}[e.key];if(delta){e.preventDefault();keyboard=Math.max(0,Math.min(24,keyboard+delta));renderer.selected=keyboard;toast(`${Math.floor(keyboard/5)+1}행 ${keyboard%5+1}열 · ${run.board[keyboard]?HERO[run.board[keyboard].hero].name:'빈칸'}`);}if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(keyboard);}});
}
function activate(index){selected=selected===index?-1:index;updateUnit();}
function training(){
  show('훈련','이번 원정 한정',`<p class="subtext">이번 원정에서만 적용됩니다. 1회당 위력 +28%, 최대 5회.</p><div class="choose-list" style="margin-top:14px">${run.deck.map(id=>`<button class="choose-row" data-train="${id}" ${run.upgrades[id]>=5||run.gold<E.upgradeCost(run,id)?'disabled':''}>${portrait(id)}<div><strong>${HERO[id].name}</strong><small>훈련 ${run.upgrades[id]}/5</small></div><b>${run.upgrades[id]>=5?'최대':E.upgradeCost(run,id)+' G'}</b></button>`).join('')}</div>`,`<button class="primary wide" data-action="close">전투로 돌아가기</button>`,'training');
}
function reward(){
  show('축복 선택',`웨이브 ${run.wave} 클리어`,`<p class="subtext">다음 웨이브에 적용할 축복을 하나 고르세요.</p><div class="reward-options" style="margin-top:14px">${run.reward.map(id=>`<button class="reward-option" data-reward="${id}"><strong>${BLESSING[id].name}</strong><small>${BLESSING[id].text}</small></button>`).join('')}</div>`,'','reward');
}
function settle(abandon=false){if(!run||!p().active)return;const snapshot={won:!abandon&&run.phase==='victory',round:clearedRounds(run),stage:run.chapter+1,mode:run.mode,damage:run.stats.damage,kills:run.stats.kills,seconds:run.time,byHero:{...run.stats.byHero}};const result=act('settle',{token:p().active.token,won:snapshot.won,round:snapshot.round,damage:snapshot.damage,seconds:snapshot.seconds},false);if(!result.ok){storagePause();return;}saves.reset();lastResult={...snapshot,reward:result.reward,newBest:result.newBest};run=null;renderer=null;screen='adventure';mode=snapshot.mode;cycle=Math.min(4,Math.floor(p().cleared/9));close();render();showResult(lastResult);}
function showResult(r){
  const mvp=Object.entries(r.byHero).sort((a,b)=>b[1]-a[1])[0],label=r.mode==='main'?`스테이지 ${stageLabel(r.stage)}`:r.mode==='weekly'?'주간 드래프트':'월간 보스전';
  show(r.won?'스테이지 클리어':r.mode==='main'?'스테이지 실패':'도전 종료',label,`<div class="battle-result ${r.won?'win':'lose'}"><span class="result-mark">${icon(r.won?'check':'close')}</span><b>${r.won?'승리':r.mode==='main'?'패배':`${r.round}라운드`}</b></div>
    ${r.mode==='monthly'?`<p class="record-result">${r.newBest?'이번 달 최고 기록 갱신':'도전 기록 저장'} · 이번 도전 ${r.round}보스</p>${monthlyRecordPanel()}`:`<div class="reward-box"><span>획득 보상</span><span class="cost">${icon('gem')}<b>+${fmt(r.reward)}</b></span></div>`}
    <div class="result-stat"><span>처치</span><b>${fmt(r.kills)}</b></div><div class="result-stat"><span>총 피해</span><b>${fmt(r.damage)}</b></div><div class="result-stat"><span>전투 시간</span><b>${duration(r.seconds*1000)}</b></div>
    ${mvp?`<div class="result-mvp">${image(mvp[0],true)}<div><p class="mvp-tag">MVP</p><strong>${HERO[mvp[0]].name}</strong><small>기여 피해 ${fmt(mvp[1])} (${Math.round(mvp[1]/Math.max(1,r.damage)*100)}%)</small></div></div>`:''}
    <p class="subtext">${r.won?`파견 보상 +${p().cleared*5}%${p().cleared%9===0&&p().cleared<=36?' · 파견 슬롯이 해금되었습니다.':''}`:r.mode==='main'?'동료를 육성하거나 편성·배치를 바꿔 다시 도전하세요.':'동료와 유물을 키워 더 높은 라운드에 도전하세요.'}</p>`,
    `<div class="dialog-buttons"><button class="secondary" data-action="${r.mode==='monthly'?'close':'go-collection'}">${r.mode==='monthly'?'기록 확인':'동료 강화'}</button><button class="primary" data-action="${r.mode==='monthly'?'monthly-retry':'close'}">${r.mode==='monthly'?'다시 도전':'확인'}</button></div>`,'result');
}
function storagePause(){paused=true;saveBlocked=true;toast('저장에 실패해 전투를 일시정지했습니다. 저장 공간을 확인한 뒤 재개하세요.');wallet();if(run&&hud)updateBattle();}
function syncBattlePhase(){
  if(!run)return false;
  if(run.phase!==previousPhase){
    saves.mark();if(!saves.flush())return false;
    // A failed checkpoint leaves this transition pending for resume.
    previousPhase=run.phase;
    if(run.phase==='reward')autoIn=-.5;
  }
  if(!saveBlocked&&!modal&&run.phase==='reward'&&run.reward.length&&!p().settings.auto)reward();
  return true;
}
function releaseMemorial(){
  memorialGeneration++;if(memorialImage){memorialImage.removeAttribute('src');memorialImage.remove();memorialImage=null;}
  memorialHero=null;memorialPage=0;$('sheet')?.classList.remove('memory-art-only');
}
function memorialAlbum(){
  const sorted=[...HEROES].sort((a,b)=>Number(p().heroes[b.id].owned&&p().heroes[b.id].bond>=10)-Number(p().heroes[a.id].owned&&p().heroes[a.id].bond>=10));
  const unlocked=HEROES.filter(h=>p().heroes[h.id].owned&&p().heroes[h.id].bond>=10).length;
  show('함께한 기억','인연 이야기',`<div class="memory-intro"><span>${icon('heart')}</span><div><h3>당신과 동료의 작은 순간들</h3><p>호감도 10에서 특별한 그림과 이야기가 열립니다.</p></div></div><p class="memory-count">열린 기억 <b>${unlocked}</b> / ${HEROES.length}</p><div class="choose-list memory-list">${sorted.map(h=>{const e=p().heroes[h.id],open=e.owned&&e.bond>=10;return `<button class="choose-row ${open?'memory-open':''}" data-memorial="${h.id}">${portrait(h.id)}<div><strong>${h.name}</strong><small>${escapeText(MEMORIAL_STORIES[h.id].title)}</small><span class="memory-condition">${open?'이야기 감상':e.owned?`호감도 ${e.bond}/10`:'동료 획득 후 호감도 10'}</span></div>${icon(open?'chevron':'lock')}</button>`;}).join('')}</div>`,`<button class="secondary wide" data-action="close">돌아가기</button>`,'memorial-album');
}
function openMemorial(id){
  const story=MEMORIAL_STORIES[id],e=p().heroes[id],h=HERO[id];if(!story||!e||!h)return;
  if(!e.owned||e.bond<story.unlockBond){
    show(h.name,'아직 펼치지 않은 기억',`<div class="memory-locked">${image(id,true)}<span class="memory-seal">${icon('lock')}</span><h3>${escapeText(story.title)}</h3><p>호감도 ${story.unlockBond}에서<br>함께한 순간을 다시 만날 수 있습니다.</p><div class="memory-bond"><span>${icon('heart')}현재 호감도 <b>${e.bond}</b></span><div class="progress"><span style="width:${e.owned?Math.min(100,e.bond/story.unlockBond*100):0}%"></span></div></div>${!e.owned?'<small>먼저 이 동료를 만나 주세요.</small>':''}</div>`,`<button class="secondary wide" data-action="memorial-album">기억 목록</button>`,'memorial-locked',id);return;
  }
  show(h.name,'인연 이야기',`<div class="memory-reader"><div class="memory-art" id="memory-art" aria-busy="true"><div class="memory-loading" id="memory-loading" role="status">함께한 순간을 펼치는 중…</div></div><div class="memory-title"><span>${icon('heart')}호감도 ${e.bond}</span><h3>${escapeText(story.title)}</h3><button class="link" data-action="memorial-art" aria-pressed="false">그림만 보기</button></div><div class="memory-narrative" id="memory-narrative"><div class="memory-reading-progress"><span id="memory-progress">0% 읽음</span><i id="memory-progress-fill"></i></div><div class="memory-text" id="memory-text" tabindex="0">${story.paragraphs.map(t=>`<p class="${/^["“]/.test(t)?'dialogue':''}">${escapeText(t)}</p>`).join('')}</div></div></div>`,`<div class="memory-controls"><button class="secondary wide" data-action="memorial-album" aria-label="기억 목록">${icon('book')} 목록</button></div>`,'memorial',id);
  memorialHero=id;memorialPage=p().memories[id]?.page||0;bindMemorialScroll();
  const generation=memorialGeneration,img=new Image();memorialImage=img;img.dataset.memorial='1';img.decoding='async';img.width=720;img.height=1080;img.alt=`${h.name} · ${story.title}`;
  const src=window.__MEMORIAL_MEDIA__?.[id];if(!src){$('memory-loading').textContent='그림을 불러올 수 없습니다. 기억을 다시 열어 주세요.';$('memory-art').setAttribute('aria-busy','false');return;}
  img.src=src;
  (async()=>{
    try{try{await img.decode();}catch(error){
      if(generation!==memorialGeneration||modal!=='memorial')return;
      const fallback=window.__MEMORIAL_FALLBACK__?.[id];if(!fallback)throw error;img.src=fallback;await img.decode();
    }
    if(generation!==memorialGeneration||modal!=='memorial'||memorialHero!==id)return;$('memory-art').replaceChildren(img);$('memory-art').setAttribute('aria-busy','false');
    }catch{if(generation!==memorialGeneration||modal!=='memorial')return;$('memory-loading').textContent='그림을 불러오지 못했습니다. 기억을 다시 열어 주세요.';$('memory-art').setAttribute('aria-busy','false');}
  })();
}
function bindMemorialScroll(){
  const story=MEMORIAL_STORIES[memorialHero],text=$('memory-text');if(!story||!text||modal!=='memorial')return;
  const update=()=>{
    const max=text.scrollHeight-text.clientHeight,ratio=max<=1?1:Math.min(1,text.scrollTop/max),page=Math.min(story.paragraphs.length-1,Math.round(ratio*(story.paragraphs.length-1)));
    memorialPage=page;$('memory-progress').textContent=`${Math.round(ratio*100)}% 읽음`;$('memory-progress-fill').style.width=`${ratio*100}%`;
    if(p().memories[memorialHero]?.page!==page)act('memory',{id:memorialHero,page},false);
  };
  text.addEventListener('scroll',update,{passive:true});
  const saved=p().memories[memorialHero]?.page||0;
  if(saved>0){const max=text.scrollHeight-text.clientHeight;text.scrollTop=max*saved/(story.paragraphs.length-1);}
  update();
}
function skillDetail(id){
  const preview=E.castPreview(run,id),h=HERO[id];if(!preview||!h){toast('전장에 이 동료가 있어야 합니다.');return;}
  const selectedUnit=run.board[selected],lower=selectedUnit&&selectedUnit.hero===id&&selectedUnit.rank<preview.rank;
  show(h.skill.name,`${preview.rank}성 발동`,`${lower?`<p class="fineprint">선택한 ${selectedUnit.rank}성이 아니라, 전장에서 가장 높은 ${preview.rank}성이 스킬을 사용합니다.</p>`:''}<div class="ability"><span class="ability-tag skill">지금 누르면</span>${preview.lines.map(line=>`<p>${escapeText(line)}</p>`).join('')}</div><details class="more"><summary>스킬 설명</summary><p>${escapeText(preview.text)}</p></details>`,`<button class="primary wide" data-action="close">전투로 돌아가기</button>`,'skill-detail',id);
}
function resumeCombat(){if(saveBlocked){saves.mark();if(!saves.flush())return;saveBlocked=false;}paused=false;syncBattlePhase();updateBattle();}
function leave(){
  paused=true;show('전투를 중단할까요?','일시정지',`<p class="subtext">현재 배치와 웨이브를 저장하고 홈으로 나갑니다. 주간·월간 원정은 같은 입장으로 이어할 수 있습니다.</p><button class="danger-link" data-action="retire">이번 원정 포기</button>`,`<div class="dialog-buttons"><button class="secondary" data-action="return-battle">계속 전투</button><button class="primary" data-action="save-leave">저장 후 나가기</button></div>`,'leave');
}
function retireSheet(){
  show('도전을 종료할까요?','확인',`<p class="subtext">완료한 ${clearedRounds(run)}라운드까지 ${run.mode==='monthly'?'기록합니다. 월간 보상은 기록 화면에서 직접 확정하며, 언제든 다시 도전할 수 있습니다.':run.mode==='weekly'?'정산합니다. 이번 주 입장 횟수는 돌아오지 않습니다.':'정산합니다. 첫 클리어 보상은 받을 수 없습니다.'}</p>`,`<div class="dialog-buttons"><button class="secondary" data-action="return-battle">계속 전투</button><button class="primary" data-action="confirm-retire">종료하고 ${run.mode==='monthly'?'기록':'정산'}</button></div>`,'retire');
}
function showSettings(){
  show('설정','',`${[['sound','사운드','음악과 효과음'],['auto','자동 전투','소환·합성·훈련·스킬을 보조합니다. 직접 조작도 가능합니다.'],['reduced','연출 줄이기','화면 흔들림과 배경 움직임을 줄입니다. 위험 예고는 유지됩니다.']].map(([id,title,text])=>`<div class="settings-row"><div><strong>${title}</strong><small>${text}</small></div><button class="switch" data-setting="${id}" aria-pressed="${p().settings[id]}" aria-label="${title}"></button></div>`).join('')}
    <div class="settings-row"><div><strong>전장 화질</strong><small>기본은 선명도와 전력 사용의 균형을 맞춥니다.</small></div><select id="quality-select" aria-label="전장 화질">${[['standard','기본'],['high','고화질'],['low','절전']].map(([id,text])=>`<option value="${id}" ${p().settings.quality===id?'selected':''}>${text}</option>`).join('')}</select></div>
    <div class="settings-actions"><button class="secondary" data-action="export">백업 저장</button><button class="secondary" data-action="import">백업 불러오기</button></div>
    <p class="fineprint">진행 데이터는 이 기기의 브라우저에 저장됩니다. 기기를 옮길 때는 백업 파일을 사용하세요.</p>
    <details class="more"><summary>알아두기</summary><p>같은 저장 공간을 두 창에서 동시에 수정하면 변경을 감지한 창이 멈춥니다. 오프라인 테스트 버전의 시간은 기기 시계를 사용합니다.</p></details>`,`<button class="primary wide" data-action="close">확인</button>`,'settings');
}
function daily(){
  const c=calendar(now()),d=p().daily.day===c.day?p().daily:{claimed:[],combat:false,draw:false,dispatch:false};
  show('일일 임무','매일 00:00 초기화 (UTC+9)',[['combat','원정 1회 완료',60],['draw','동료 또는 유물 소환 1회',30],['dispatch','파견 보상 수령',30]].map(([id,name,value])=>`<div class="daily-row"><div><strong>${name}</strong>${gem(value)}</div><button class="${d[id]&&!d.claimed.includes(id)?'primary':'secondary'}" data-daily="${id}" ${!d[id]||d.claimed.includes(id)?'disabled':''}>${d.claimed.includes(id)?'완료':d[id]?'수령':'진행 중'}</button></div>`).join(''),`<button class="secondary wide" data-action="close">확인</button>`,'daily');
}
function show(title,kicker,body,footer='',kind='generic',info=null){if(run&&kind!=='reward'){saves.mark();saves.flush();}const scroll=modal===kind&&modalInfo===info?$('sheet-body').scrollTop:0;if(!modal)previousFocus=document.activeElement;releaseMemorial();modal=kind;modalInfo=info;$('sheet').dataset.kind=kind;$('sheet-title').textContent=title;$('sheet-kicker').textContent=kicker;$('sheet-body').innerHTML=body;$('sheet-footer').innerHTML=footer;$('overlay').hidden=false;$('app').setAttribute('aria-hidden','true');if('inert' in $('app'))$('app').inert=true;$('sheet-body').scrollTop=scroll;$('sheet').focus();}
function close(){if(!modal)return;const wasLeave=modal==='leave';releaseMemorial();modal=null;modalInfo=null;if(wasLeave&&!saveBlocked)paused=false;$('overlay').hidden=true;$('app').removeAttribute('aria-hidden');if('inert' in $('app'))$('app').inert=false;if(previousFocus?.isConnected)previousFocus.focus();else $('content').focus();}
function history(){
  show('소환 기록','최근 50회',p().history.map(h=>`<div class="history-row">${image(h.id)}<div><strong>${(HERO[h.id]||ARTIFACT[h.id]).name}</strong><small>${h.fresh?'신규':'중복 · 강화 재료'} · ${h.banner==='normal'?'일반':h.banner==='season'?'시즌':'유물'} · ${calendar(h.at).day}</small></div>${badge((HERO[h.id]||ARTIFACT[h.id]).rarity)}</div>`).join('')||'<p class="empty">아직 소환 기록이 없습니다.</p>',`<button class="secondary wide" data-action="close">확인</button>`,'history');
}
function records(){
  show('모험 기록','최근 결과',monthlyRecordPanel()+(p().results.map(r=>`<div class="rate-row"><span style="display:block">${r.mode==='main'?`스테이지 ${stageLabel(r.stage)}`:r.mode==='weekly'?'주간 드래프트':'월간 보스전'}<br><small>${calendar(r.at).day} · ${r.won?'클리어':r.round+'라운드'}</small></span>${r.mode==='monthly'?'<span class="chip">기록 저장</span>':gem(r.reward)}</div>`).join('')||'<p class="empty">아직 모험 기록이 없습니다.</p>'),`<button class="secondary wide" data-action="close">확인</button>`,'records');
}
function exportBackup(){const blob=new Blob([JSON.stringify(p(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`StarGarden-${calendar(now()).day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('백업 파일을 저장했습니다.');}
document.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button||button.disabled)return;const d=button.dataset;sound.click();
  if(d.nav){if(screen==='battle'){leave();return;}close();screen=d.nav;render();return;}
  if(d.hero){heroDetail(d.hero);return;}if(d.relic){relicDetail(d.relic);return;}
  if(d.memorial){openMemorial(d.memorial);return;}if(d.memoryStep){updateMemorialPage(Number(d.memoryStep));return;}
  if(d.collection){collection=d.collection;rarity='all';render();return;}if(d.filter){rarity=d.filter;render();return;}
  if(d.banner){banner=d.banner;render();return;}if(d.mode){mode=d.mode;render();return;}if(d.cycle){cycle=Number(d.cycle);render();return;}
  if(d.prepareStage){prepare(Number(d.prepareStage));return;}if(d.begin){begin(d.begin,Number(d.stage));return;}
  if(d.draw){draw(Number(d.draw));return;}if(d.level){if(act('level',{id:d.level}).ok){render();heroDetail(d.level);}return;}
  if(d.enhance||d.enhanceRelic){const id=d.enhance||d.enhanceRelic;if(act('enhance',{id,kind:d.enhance?'hero':'relic'}).ok){render();(d.enhance?heroDetail:relicDetail)(id);}return;}
  if(d.equip){if(act('equip',{id:d.equip}).ok)relicDetail(d.equip);return;}
  if(d.setPartner){if(act('partner',{id:d.setPartner},false).ok){close();if(screen==='home')render();toast(`파트너 변경 · ${HERO[d.setPartner].name}`);}return;}
  if(d.teamPick){const i=editingDeck.indexOf(d.teamPick);if(i>=0)editingDeck.splice(i,1);else if(editingDeck.length<TEAM_SIZE)editingDeck.push(d.teamPick);else{toast(`편성은 ${TEAM_SIZE}명입니다. 먼저 한 명을 해제하세요.`);return;}team(true);return;}
  if(d.dispatchSlot){chooseDispatch(Number(d.dispatchSlot));return;}if(d.send){if(act('dispatch',{id:d.send,slot:Number(d.slot)}).ok){close();render();}return;}
  if(d.claimDispatch){if(act('claimDispatch',{slot:Number(d.claimDispatch)}).ok)render();return;}if(d.draft){if(act('draft',{index:Number(d.draft)},false).ok)render();return;}
  if(d.skill){battleCommand(E.cast(run,d.skill));return;}if(d.skillDetail){skillDetail(d.skillDetail);return;}if(d.train){battleCommand(E.upgrade(run,d.train));training();return;}if(d.sell){battleCommand(E.sell(run,Number(d.sell)));return;}if(d.reward){battleCommand(E.chooseReward(run,d.reward));close();previousPhase='';return;}
  if(d.setting){if(act('setting',{id:d.setting,value:!p().settings[d.setting]},false).ok)showSettings();return;}if(d.daily){if(act('daily',{id:d.daily}).ok)daily();return;}
  if(d.confirmMonthly){if(act('claimMonthly',{token:d.confirmMonthly}).ok){close();render();}return;}
  const actions={close:()=>{if(modal==='reward')return;close();},settings:showSettings,partner:partners,team:()=>team(),'focus-team':()=>document.querySelector('#sheet-body .choose-list')?.scrollIntoView({behavior:'smooth',block:'start'}),rates,history,records,daily,
    'memorial-album':memorialAlbum,'memorial-art':()=>{const artOnly=$('sheet').classList.toggle('memory-art-only');button.setAttribute('aria-pressed',String(artOnly));button.textContent=artOnly?'이야기 보기':'그림만 보기';},
    owned:()=>{ownedOnly=!ownedOnly;render();},pet:()=>{if(act('pet').ok)render();},idle:()=>{if(act('idle').ok)render();},
    season:()=>{banner='season';screen='summon';render();},prepare:()=>prepare(Number(d.stage)),
    'prepare-mode':()=>prepare(Math.min(45,p().cleared+1),mode),resume,
    'save-team':()=>{if(act('deck',{ids:editingDeck}).ok){const back=teamReturn;teamReturn=null;close();render();if(back)prepare(back.stage,back.kind);}},
    'go-summon':()=>{close();screen='summon';banner='normal';render();},'go-relic-summon':()=>{close();screen='summon';banner='relic';render();},
    'go-collection':()=>{close();screen='collection';render();},'monthly-claim':confirmMonthlyClaim,'monthly-retry':()=>{close();prepare(Math.min(45,p().cleared+1),'monthly');},speed:()=>{speed=speed===1?2:1;button.querySelector('b').textContent=speed+'×';},pause:()=>{if(paused)resumeCombat();else{paused=true;saves.mark();saves.flush();updateBattle();}},
    'summon-battle':()=>battleCommand(E.summon(run)),training,auto:()=>{if(act('setting',{id:'auto',value:!p().settings.auto},false).ok){button.querySelector('b').textContent=p().settings.auto?'ON':'OFF';button.setAttribute('aria-pressed',p().settings.auto);syncBattlePhase();}},
    target:()=>{E.cycleTarget(run,selected);battleCommand({ok:true});},deselect:()=>{selected=-1;updateUnit();},leave,
    retire:retireSheet,'confirm-retire':()=>settle(true),'return-battle':()=>{close();resumeCombat();},'save-leave':()=>{saves.mark();if(saves.flush()){saves.reset();close();screen='home';run=null;renderer=null;render();}},
    export:exportBackup,import:()=>{if(run&&p().active){toast('진행 중인 전투를 저장하고 홈에서 불러오세요.');return;}$('backup-input').click();},
  };actions[d.action]?.();
});
document.addEventListener('change',e=>{if(e.target.id==='quality-select')act('setting',{id:'quality',value:e.target.value},false);});
$('backup-input').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>2*1024*1024){toast('백업 파일은 2MB 이하만 가능합니다.');return;}try{const raw=await file.text();if(!JSON.parse(raw)){toast('올바른 백업 파일이 아닙니다.');return;}show('백업을 복원할까요?','데이터',`<p class="subtext">현재 진행 데이터가 선택한 백업으로 교체됩니다. 필요하면 먼저 현재 데이터를 백업하세요.</p>`,`<div class="dialog-buttons"><button class="secondary" data-action="export">현재 데이터 백업</button><button id="confirm-import" class="primary">복원</button></div>`,'import');$('confirm-import').onclick=()=>{const result=store.import(raw);toast(result.ok?'백업을 복원했습니다.':result.message);if(result.ok){close();screen='home';run=null;render();}};}catch{toast('백업 파일을 읽을 수 없습니다.');}});
document.addEventListener('keydown',e=>{if(!modal)return;if(e.key==='Escape'){if(modal!=='reward'){close();}e.preventDefault();}if(e.key==='Tab'){const buttons=Array.from($('sheet').querySelectorAll('button:not(:disabled),summary,[tabindex="0"]')).filter(b=>b.offsetParent!==null),first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('sheet'))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===$('sheet'))){e.preventDefault();first?.focus();}}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(run){saves.mark();saves.flush();}sound.suspend();lastFrame=0;accumulator=0;renderClock.reset();}else{lastFrame=0;renderClock.reset();if(!paused)sound.unlock();}});
window.addEventListener('pagehide',()=>{if(run){saves.mark();saves.flush();}});
window.addEventListener('storage',e=>{if(e.key===SAVE_KEY&&e.newValue!==store.raw){store.conflict=true;paused=true;wallet();}});
function frame(time){
  const dt=lastFrame?Math.min(.1,(time-lastFrame)/1000):0;lastFrame=time;
  if(run&&screen==='battle'&&!document.hidden){
    if(!paused&&!modal){
      accumulator+=dt*speed;let ticks=0;
      while(accumulator>=.05&&ticks++<5){const before=run.phase;E.step(run,.05);performanceStats.steps++;if(before!=='reward'&&run.phase==='reward')autoIn=-.5;autoIn+=.05;if(p().settings.auto&&!pointer&&autoIn>=.32){autoPlay(run);autoIn=0;}accumulator-=.05;}
      if(ticks)saves.mark();uiIn+=dt;
      for(const e of run.events.splice(0)){renderer.event(e);sound.event(e);}
      saves.schedule();if(uiIn>.18){uiIn=0;updateBattle();}sound.battle=true;sound.boss=run.enemies.some(e=>e.boss);
      syncBattlePhase();
      if(run&&!paused&&['victory','defeat'].includes(run.phase))settle();
    }
    const renderDt=renderClock.next(time,paused||!!modal);if(run&&renderDt!==null){renderer.draw(run,renderDt);performanceStats.renders++;}
  }else sound.battle=false;
  requestAnimationFrame(frame);
}
setInterval(()=>{if(screen==='dispatch'&&!modal){const ended=p().dispatches.some(d=>d.end<=now()&&document.querySelector(`[data-claim-dispatch="${d.slot}"]`)?.disabled);if(ended)render();else for(const node of document.querySelectorAll('[data-timer]'))node.textContent=timerText(Number(node.dataset.timer));}if(screen==='home'&&!modal&&$('idle-total')){$('idle-total').textContent=fmt(idleReward(p(),now()));$('idle-progress').style.width=Math.min(100,(now()-p().idleAt)/(20*HOUR)*100)+'%';const button=document.querySelector('[data-action="idle"]');if(button)button.disabled=idleReward(p(),now())<1;}},1000);
for(const img of document.querySelectorAll('img'))img.onerror=()=>{img.src=fallback('star_boy');};
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement&&!e.target.dataset.memorial&&!e.target.dataset.fallback){e.target.dataset.fallback='1';e.target.src=fallback('star_boy');}},true);
document.documentElement.style.setProperty('--garden',`url("${window.__ASTRA_ASSETS__?.garden||'./assets/merge/garden.webp'}")`);
art.ready.then(()=>{if(art.failed.length)toast('일부 그림을 불러오지 못해 대체 이미지로 표시합니다.');});
$('app').dataset.solo=String(SOLO);render();requestAnimationFrame(frame);
// Read-only diagnostics for offline QA. Mutations use real buttons or fixtures
// written to isolated browser storage before boot, never a production cheat UI.
window.STAR_GARDEN={get profile(){return p();},get battle(){return run;},get screen(){return screen;},get performance(){return {...performanceStats,saveWrites:saves.writes,saveFailures:saves.failures,savePending:saves.pending!==null,quality:p().settings.quality,dpr:renderer?.dpr||0,particles:renderer?.particles.length||0,impacts:renderer?.fx.impacts.length||0};}};

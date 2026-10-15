import {CHALLENGE_WAVES,TIERS,TIER_IDS,HERO,HEROES,HIDDEN,ARTIFACT,ARTIFACTS,RARITY,RARITIES,DEFAULT_DECK,CHAPTERS,BOSSES,BOSS_ORDER,BLESSING,ROSTER,TUNING as T} from './content.js';
import {talkLines,greetLine} from './lines.js';
import {relicLevel,relicCost,relicPhase,relicScale,relicPoints,collectionPoints,collectionBonus,COLLECTION_WEIGHT,COLLECTION_OWN_BONUS,COLLECTION_POINTS_PER_PERCENT} from './economy.js';
import {calendar,duplicateCost,enhanceMultiplier,specialMultiplier,heroMultiplier,combatPower,bedCost,bedOpen,BED_IDS,roseAttack,springGauge,seedGold,dispatchSlots,dispatchReward,relicTier,relicThreshold,relicRates,idleReward,HOUR} from './economy.js';
import {ProfileStore,available,away,teamPower,DAILY_MISSIONS,missionDone,weeklyStage,metBosses,basketState} from './profile.js';
import {GIFTS,GIFT_IDS,FAVORITE,FAVORITE_LINES,BOND_MAX,bondNeed,giftPoints} from './bond.js';
import {COURSE} from './course.js';
import {questionOf,pickQuestion,lectureById,termById,lectureQuestions,termQuestions,KIND_NAME} from './quiz.js';
import {CONSTELLATIONS,LIBRARY_ART,LIBRARY_STARS} from './library.js';
import {TUTOR_MODELS,tutorSettings,saveTutorSettings,explainWithRumi,tutorHtml} from './tutor.js';
import {createBattle,resumeBattle,autoPlay as helperAuto,clearedRounds} from './battle.js';
import {smartAutoPlay} from './smart-auto.js';
import * as E from './combat/engine.js';
import {Art,Renderer} from './combat/render.js';
import {Sound} from './combat/audio.js';
import {icon} from './icons.js';
import {currentRecord,monthlyReward,weeklyReward} from './monthly.js';
import {RenderClock,RunSaveQueue} from './runtime.js';
import {TEAM_SIZE,SOLO,SAVE_KEY,UNLOCKED} from './team-config.js';
// The unlocked test build plays auto with the simulation player model; the release keeps the light helper.
const autoPlay=UNLOCKED?smartAutoPlay:helperAuto;
import {MEMORIAL_STORIES} from './memorial.js';
import {burst,tapSpark,hearts,centerOf,floatText} from './fx.js';

const $=id=>document.getElementById(id),storage={getItem:k=>window.localStorage.getItem(k),setItem:(k,v)=>window.localStorage.setItem(k,v)};
const store=new ProfileStore(storage),art=new Art(),sound=new Sound();
const p=()=>store.value,now=()=>Math.max(Date.now(),p().clockAt),fmt=n=>Number.isFinite(n)?n>=100000?new Intl.NumberFormat('ko-KR',{notation:'compact',maximumFractionDigits:1}).format(n):Math.floor(n).toLocaleString('ko-KR'):'—';
const pct=n=>(n*100).toFixed(n<.001?3:2)+'%';
let challengeTier='easy',screen='home',collection='hero',rarity='all',ownedOnly=false,banner='normal',mode='main',cycle=Math.floor(p().cleared/9),
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
const dispatchGain=({dust=0,dreams})=>`<span class="dispatch-gain">${dust?`<span class="cost dust">${icon('dust')}<b>${fmt(dust)}</b></span>`:''}${gem(dreams)}</span>`;
const cpOf=id=>fmt(combatPower(id,p().heroes[id],p().beds,collectionBonus(p().relics)));
const pctPts=points=>`+${(points/COLLECTION_POINTS_PER_PERCENT).toFixed(2)}%`;
const scaleToken=(token,level)=>{const t=typeof token==='string'?token:token.t,int=typeof token==='object'&&token.int,m=t.match(/^(\d+(?:\.\d+)?)(.*)$/);if(!m)return [t,t];const v=Number(m[1])*relicScale(level);return [t,`${int?Math.round(v):Number(v.toFixed(1))}${m[2]}`];};
const relicTokens=(id,level)=>(ARTIFACT[id].scale||[]).map(t=>scaleToken(t,level));
const relicText=(id,level)=>liveText(ARTIFACT[id].text,relicTokens(id,level));
const chips=list=>list.filter(Boolean).map(t=>`<span class="chip">${t}</span>`).join('');
const stageLabel=n=>String(n).padStart(2,'0');
const monthNo=c=>`${Number(String(c.month).slice(-2))}월`;
// Hidden heroes rotate as the season guardian (one per month, six-month cycle).
function guardianNote(id){
  const c=calendar(now()),month=Number(String(c.month).slice(-2))-1,slot=HIDDEN.indexOf(id),wait=(slot-month%6+6)%6,next=(month+wait)%12+1;
  return wait===0?`지금 시즌 소환에서 획득할 수 있습니다.<br>${monthNo(c)} 이달의 수호자입니다.`:`이달의 수호자로 등장하는 달에만 시즌 소환에서 획득할 수 있습니다.<br>다음 등장: ${next}월 (${next>6?next-6:next+6}월에도 등장)`;
}
const bossOf=stage=>BOSSES[CHAPTERS[stage-1].bosses[0]];
const giftArt=(gift,cls='')=>`<i class="gift-art ${cls}" data-gift="${gift}" aria-hidden="true"></i>`;
const heartsOf=bond=>Array.from({length:5},(_,i)=>`<i class="${bond>=(i+1)*2?'on':bond>=i*2+1?'half':''}"></i>`).join('');
const bondRatio=e=>e.bond>=BOND_MAX?1:(e.bondXp||0)/bondNeed(e.bond);
const giftTotal=()=>GIFT_IDS.reduce((n,g)=>n+p().gifts[g],0);
const lobbyMemorial=profile=>profile.lobby&&profile.lobby===profile.partner&&profile.heroes[profile.lobby]?.bond>=BOND_MAX&&window.__MEMORIAL_MEDIA__?.[profile.lobby]?profile.lobby:null;
const portrait=(id,extra='')=>`<span class="portrait ${extra}" data-rarity="${HERO[id].rarity}">${image(id)}</span>`;
// How each attack shape reads to a player (battle info and ability panels).
const SHAPE_TEXT={single:'단일',splash:'범위',beam:'관통',chain:'연쇄',bounce:'도탄',cleave:'부채꼴',pulse:'원형',cross:'십자',zone:'장판'};
const RANK_TEXT={first:'선두',boss:'보스',strong:'강적',last:'후미'};
// Each companion has its own lobby lines (src/lines.js); the close line joins from six hearts.
const partnerLines=hero=>talkLines(hero.id,p().heroes[hero.id].bond);
let talkIndex=0,skillHold=null,skillHeld=false,tipFor=null,revealTimers=[];
const todayDaily=()=>{const d=p().daily;return d.day===calendar(now()).day?d:{combat:false,merges:0,idle:false,free:false,accel:false,claimed:[]};};
const dailyClaimable=d=>DAILY_MISSIONS.some(m=>missionDone(d,m.id)&&!d.claimed.includes(m.id));
const roseBonus=level=>Math.round(roseAttack(level)*100);
// Dream greenhouse: each bed is a plant whose art grows through four stages.
// "만개" (bloom) marks the soft cap: after it the cost climbs much faster.
const BED_UI={
  rose:{name:'용기의 장미',effect:'모든 동료 위력',row:0,order:2,color:'#ff9aae',value:l=>`+${roseBonus(l)}%`,line:'보유한 모든 동료의 위력이 오릅니다.'},
  spring:{name:'별이슬 샘',effect:'최대 별빛',row:1,order:1,color:'#8fdcff',value:l=>String(springGauge(l)),line:'전투에서 모을 수 있는 별빛이 늘어납니다.'},
  seed:{name:'황금 씨앗',effect:'시작 골드',row:2,order:3,color:'#ffd36a',value:l=>`+${seedGold(l)}`,line:'모든 원정을 더 많은 골드로 시작합니다.'},
};
// Art stage only (sprout → bud → bloom → starlit); it follows the cost knees without saying so.
const bedStage=(id,level)=>{const b=T.beds[id],k=b.knee;return level>=(b.knee2??k+5)?3:level>=k?2:level>=Math.ceil(k*.35)?1:0;};
const bedReady=(profile,id)=>bedOpen(id,profile.cleared)&&!profile.active&&profile.dust>=bedCost(id,profile.beds[id]);
let bedFocus='rose';
// Shooting stars pile up on the lobby floor with the idle reward (max 9 shards).
const SHARD_SPOTS=[[62,74],[80,68],[44,58],[88,56],[70,60],[26,54],[56,66],[14,47],[86,44]];
function shardsMarkup(){
  const profile=p(),elapsed=Math.min(20*HOUR,Math.max(0,now()-profile.idleAt)),count=idleReward(profile,now())<1?0:Math.max(1,Math.min(9,Math.ceil(elapsed/(20*HOUR)*9)));
  return SHARD_SPOTS.slice(0,count).map(([x,y],i)=>`<button class="shard" data-action="idle-shard" style="left:${x}%;top:${y}%;--i:${i}" aria-label="별똥별 수집"></button>`).join('');
}
function toast(text){if(!text)return;clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,2800);}
function settings(){sound.enabled=p().settings.sound;sound.music=p().settings.sound;sound.setVolume(.2);$('app').dataset.reduced=String(p().settings.reduced||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);if(renderer){renderer.reduced=$('app').dataset.reduced==='true';renderer.setQuality(p().settings.quality);}}
function wallet(){const profile=p();$('dreams').textContent=fmt(profile.dreams);$('dust').textContent=fmt(profile.dust);$('save-warning').hidden=!store.broken&&!store.conflict;$('save-warning').textContent=store.warning||'다른 창에서 저장 내용이 바뀌었습니다. 이 창을 새로고침하세요.';settings();}
function act(action,args={},showToast=true){const result=store.transact(action,args,now());wallet();if(!result.ok||showToast)toast(result.message);return result;}
// Growth changes numbers on the screen under a sheet; redraw it without losing the scroll position.
function refreshBehind(){const c=$('content'),y=c.scrollTop;render();c.scrollTop=y;}
const heading=(title,right='',sub='')=>`<div class="page-heading"><div><h1>${title}</h1>${sub?`<p>${sub}</p>`:''}</div>${right}</div>`;
function five(ids,edit=false){
  return `<div class="five-line" style="--team-size:${TEAM_SIZE}">${Array.from({length:TEAM_SIZE},(_,i)=>ids[i]
    ?`<button class="team-slot" ${edit?'data-team-pick':'data-hero'}="${ids[i]}" aria-label="${HERO[ids[i]].name} ${edit?'편성 해제':'정보'}"><span class="portrait" data-rarity="${HERO[ids[i]].rarity}">${image(ids[i])}${badge(HERO[ids[i]].rarity)}</span><small>${HERO[ids[i]].name}</small></button>`
    :`<button class="team-slot" data-action="${edit?'focus-team':'team'}" aria-label="${i+1}번째 동료 선택"><span class="portrait empty-slot">${icon('plus')}</span><small>비어 있음</small></button>`).join('')}</div>`;
}
function card(id,kind='hero',receipt=null,full=false){
  const h=kind==='hero'?HERO[id]:ARTIFACT[id],e=kind==='hero'?p().heroes[id]:p().relics[id],need=kind==='hero'?duplicateCost(e.enhance):relicCost(h.rarity,e.enhance),ready=e.owned&&e.copies>=need,gone=kind==='hero'&&away(p(),id);
  const worn=kind==='relic'&&!receipt&&p().equipped.includes(id),tag=receipt?(receipt.fresh?'NEW':'중복 +1'):kind==='relic'&&e.owned?`Lv.${relicLevel(e)}`:e.owned&&e.enhance>0?`+${e.enhance}`:'';
  const sub=receipt?(receipt.fresh?'신규 획득':'강화 재료'):!e.owned?(h.hidden?'시즌 한정':'미획득'):gone?'파견 중':kind==='hero'?`전투력 ${cpOf(id)}`:`수집 ${pctPts(relicPoints(id,e))}`;
  return `<button class="hero-card ${!e.owned?'locked':''} ${ready?'can-enhance':''} ${gone?'is-away':''} ${worn?'equipped':''}" data-${kind==='hero'?'hero':'relic'}="${id}" data-rarity="${h.rarity}" aria-label="${h.name}, ${h.rarity}, ${e.owned?'보유':'미보유'}${ready?', 강화 가능':''}">${badge(h.rarity)}${tag?`<span class="tag ${receipt?.fresh?'new':''}">${tag}</span>`:''}${worn?`<span class="worn-mark">${icon('check')}장착</span>`:''}<span class="art">${image(id,full)}${!e.owned?icon('lock','lock'):''}</span><strong>${h.name}</strong><small>${sub}</small>${e.owned&&!receipt?`<span class="dup" aria-hidden="true"><i style="width:${Math.min(100,e.copies/need*100)}%"></i>${ready?icon('up'):''}</span>`:''}</button>`;
}
// The three relic slots: what is equipped now, tap to open it.
function relicSlots(compact=false){
  const worn=p().equipped;
  return `<div class="relic-slots ${compact?'compact':''}">${compact?'':`<div class="relic-slots-head"><b>장착 중인 유물 ${worn.length}/3</b><small>장착한 유물의 효과가 원정에 적용됩니다</small></div>`}<div class="relic-slot-row">${[0,1,2].map(i=>{const id=worn[i];return id?`<button class="relic-slot filled" data-relic="${id}" data-rarity="${ARTIFACT[id].rarity}">${image(id)}<span><b>${ARTIFACT[id].name}</b>${compact?'':`<small>Lv.${relicLevel(p().relics[id])}</small>`}</span></button>`:`<span class="relic-slot empty">${icon('plus')}<small>빈 칸</small></span>`;}).join('')}</div></div>`;
}
// Puts the current value of each enhancement-scaled number into the (escaped) description, coloured.
const liveText=(text,tokens)=>{let out=escapeText(text),pos=0;for(const [from,to] of tokens){const f=escapeText(from),at=out.indexOf(f,pos);if(at<0)continue;const mark=`<em class="scaled">${escapeText(to)}</em>`;out=out.slice(0,at)+mark+out.slice(at+f.length);pos=at+mark.length;}return out;};
let bedHold=null;
function stopBedHold(){if(bedHold){clearTimeout(bedHold.timer);clearInterval(bedHold.repeat);bedHold.done=true;}}
document.addEventListener('pointerdown',e=>{
  const button=e.target.closest('[data-bed-grow]');if(!button||button.disabled)return;stopBedHold();
  const id=button.dataset.bedGrow,hold={held:false,done:false};bedHold=hold;
  hold.timer=setTimeout(()=>{hold.held=true;if(!growBed(id))return stopBedHold();hold.repeat=setInterval(()=>{if(hold.done||!growBed(id))stopBedHold();},150);},420);
});
for(const type of ['pointerup','pointercancel'])document.addEventListener(type,()=>{if(bedHold&&!bedHold.held)clearTimeout(bedHold.timer);if(bedHold?.held)stopBedHold();});

const weeklyChapter=()=>weeklyStage(p(),now())-1;
function weeklyBosses(){return Array.from({length:CHALLENGE_WAVES/3},(_,i)=>E.weeklyBoss(weeklyChapter(),(i+1)*3,metBosses(p())));}
const tierName=r=>(TIERS[r?.tier||'easy']||TIERS.easy).name;
function monthlyRecordPanel(){
  const record=currentRecord(p(),now()),claimed=p().monthly===calendar(now()).month,all=p().monthlyLifetime;
  return `<div class="monthly-record"><span class="eyebrow">${monthNo(calendar(now()))} 최고 기록${record?` · ${tierName(record)}`:''}</span><div class="record-score"><b>${record?record.round:'—'}</b><span>/ ${CHALLENGE_WAVES} 보스 격파</span>${record?'<span class="record-stamp">BEST</span>':''}</div><p>${record?`${record.token.startsWith('legacy-')?'피해 기록 없음':`총 피해 ${fmt(record.damage)}`} · ${calendar(record.at).day}`:'도전을 마치면 최고 기록이 이곳에 남습니다.'}</p>
    ${record?`<div class="record-team"><small>기록 당시 편성</small>${record.deck.map(id=>portrait(id)).join('')}</div>`:''}
    <div class="record-payout"><span>${claimed?'이번 달 확정 보상':'이 기록으로 받을 보상'}</span>${claimed?p().monthlyClaim?gem(monthlyReward(p().monthlyClaim)):'<b>수령 완료</b>':record?gem(monthlyReward(record)):'<b>기록 대기</b>'}</div>
    ${claimed?'<p class="record-note">보상 확정 완료 · 기록 갱신과 재도전은 계속 가능합니다.</p>':record?'<button class="secondary wide" data-action="monthly-claim">이 기록으로 보상 받기</button>':''}
    ${all?`<div class="lifetime-record">역대 최고 <strong>${tierName(all)} ${all.round}보스</strong><small>${all.period} · 총 피해 ${fmt(all.damage)}</small></div>`:''}</div>`;
}
function confirmMonthlyClaim(){
  const record=currentRecord(p(),now());if(!record||p().monthly===record.period){toast('이번 달 보상 상태를 확인하세요.');return;}
  show('이 기록으로 보상을 확정할까요?',`${record.period} 월간 보스전`,`<div class="claim-score"><b>${record.round}</b><span>${tierName(record)} · 보스 격파</span></div><div class="reward-box"><span>확정할 보상</span>${gem(monthlyReward(record))}</div><p class="subtext">이번 달 보상은 한 번만 받을 수 있습니다. 기록을 더 올리고 싶다면 재도전한 뒤 수령하세요. 확정 후에도 최고 기록은 계속 갱신됩니다.</p>`,
    `<div class="dialog-buttons"><button class="secondary" data-action="close">더 도전하기</button><button class="primary" data-confirm-monthly="${record.token}">보상 확정</button></div>`,'monthly-claim');
}
// Summon reveal: a falling star in the best rarity's colour, a burst, then the
// cards deal in face-down and flip one by one. Tapping the stage shows all.
// A correct star quiz boosts a 10-pull (UR ×2); a lucky one adds a bonus 10-pull revealed after the first.
let bonusItems=null;
function draw(count,free=false,boost=false){
  const result=act('draw',{banner,count,free,...(boost?{boost:true}:{})},false);if(!result.ok)return false;render();
  bonusItems=result.bonus?.length?result.bonus:null;
  reveal(result.items,{count,cost:result.cost,boost});return true;
}
function showBonus(){
  const items=bonusItems;bonusItems=null;if(!items)return;reveal(items,{count:items.length,lucky:true});
  // Luck confetti: pink and gold bursts around the stage before the cards deal.
  if($('app').dataset.reduced!=='true')[[.2,.3],[.8,.26],[.5,.18],[.3,.62],[.72,.6]].forEach(([x,y],i)=>revealTimers.push(setTimeout(()=>{if(modal==='draw')burst(innerWidth*x,innerHeight*y,{count:14,spread:90,size:12,duration:1000,color:i%2?'#ffe08a':'#ffb3e0'});},250+i*140)));
}
function reveal(items,{count,cost=0,boost=false,lucky=false}){
  for(const t of revealTimers)clearTimeout(t);revealTimers=[];
  const rarityOf=item=>(HERO[item.id]||ARTIFACT[item.id]).rarity,rank=item=>RARITIES.indexOf(rarityOf(item));
  const best=items.reduce((a,b)=>rank(b)>rank(a)?b:a),top=rarityOf(best),kind=banner==='relic'?'relic':'hero',price=banner==='relic'?T.relicDrawCost:T.heroDrawCost;
  const cards=items.map((item,i)=>`<div class="reveal-card" data-rarity="${rarityOf(item)}" style="--i:${i}">${card(item.id,kind,item,count===1)}${item.pity?'<span class="pity-tag">천장 확정</span>':''}<span class="card-back" aria-hidden="true"><i></i></span></div>`).join(''),fresh=items.filter(i=>i.fresh).length;
  show(lucky?'행운의 소환':'소환 결과',`최고 등급 ${top}`,`<div class="reveal-stage ${lucky?'lucky':''}" data-top="${top}" data-count="${count}">${lucky?'<span class="lucky-banner" aria-hidden="true">행운의 보너스!</span>':''}<span class="reveal-meteor" aria-hidden="true"></span><span class="reveal-flash" aria-hidden="true"></span><span class="reveal-ring" aria-hidden="true"></span><div class="reveal-grid ${count===1?'single':''}">${cards}</div><p class="reveal-caption">${lucky?`행운의 보너스 ${items.length}회 · 신규 ${fresh}종`:`신규 ${fresh}종 · 꿈의결정 ${fmt(cost)} 사용${boost?' · 별빛 퀴즈 UR 2배':''}`}</p><button class="reveal-skip" data-action="reveal-skip">모두 보기</button></div>`,
    bonusItems&&!lucky?`<button class="primary wide shine lucky-next" data-action="bonus-reveal">${icon('summon')}<b>행운이 찾아왔어요!</b></button>`
      :`<div class="dialog-buttons"><button class="secondary" data-draw-again="${count}"><b>${count}회 더</b>${gem(price*count,p().dreams<price*count)}</button><button class="primary" data-action="close">확인</button></div>`,'draw');
  sound.reveal?.(top);
  // Sparkle bursts follow each high-rarity flip (timings mirror the CSS).
  const flipAt=i=>(count===1?1250:1150+i*120);
  document.querySelectorAll('#sheet .reveal-card').forEach((node,i)=>{const r=node.dataset.rarity;if(r==='SR'||r==='UR')revealTimers.push(setTimeout(()=>{if(modal!=='draw'||!node.isConnected||node.closest('.skip'))return;const c=centerOf(node);burst(c.x,c.y,{count:r==='UR'?18:11,spread:r==='UR'?110:70,size:r==='UR'?14:11,duration:900,color:r==='UR'?'#ffe08a':'#d4b4ff'});},flipAt(i)+180));});
}
function skipReveal(){const stage=document.querySelector('#sheet .reveal-stage');if(stage)stage.classList.add('skip');for(const t of revealTimers)clearTimeout(t);revealTimers=[];}
function duration(ms){const seconds=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
function timerText(end){return end<=now()?'귀환 완료':duration(end-now());}
let editingDeck=[],teamReturn=null;
function team(edit=false){
  if(!edit){teamReturn=modal==='prepare'?modalInfo:null;editingDeck=[...p().deck];}
  show('팀 편성',`출전 ${editingDeck.length}/${TEAM_SIZE}`,`${five(editingDeck,true)}<p class="fineprint" style="margin-top:10px">서로 다른 동료 ${TEAM_SIZE}명이 필요합니다. 편성된 동료를 누르면 해제됩니다.</p><div class="choose-list" style="margin-top:14px">${HEROES.filter(h=>p().heroes[h.id].owned).map(h=>`<button class="choose-row" data-team-pick="${h.id}" aria-pressed="${editingDeck.includes(h.id)}" ${away(p(),h.id)||p().active?'disabled':''}>${portrait(h.id)}<div><strong>${h.name}${badge(h.rarity)}</strong><small>${away(p(),h.id)?'파견 중 · 귀환 후 편성 가능':`${h.role} · 전투력 ${cpOf(h.id)}`}</small></div><span class="mark">${editingDeck.includes(h.id)?icon('check'):icon('plus')}</span></button>`).join('')}</div>`,
    `<button class="primary wide" data-action="save-team" ${editingDeck.length!==TEAM_SIZE||p().active?'disabled':''}>편성 확정 (${editingDeck.length}/${TEAM_SIZE})</button>`,'team');
}
function begin(kind,stage){const result=act('begin',{mode:kind,stage:kind==='weekly'?weeklyChapter()+1:stage,...(kind==='main'?{}:{tier:challengeTier})},false);if(!result.ok)return;close();if(kind==='weekly'){screen='draft';render();}else startBattle();}
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
  const name=run.mode==='main'?CHAPTERS[run.chapter].name:`${run.mode==='weekly'?'주간 드래프트':'월간 보스전'} · ${(TIERS[run.tier]||TIERS.easy).name}`,tag=run.mode==='main'?`<small>STAGE</small><b>${stageLabel(run.chapter+1)}</b>`:`<b>${run.mode==='weekly'?'주간':'월간'}</b>`;
  $('content').innerHTML=`<section class="battle" id="battle">
    <div class="battle-top"><div class="battle-title"><span class="stage-tag" data-mode="${run.mode}">${tag}</span><div class="battle-name"><strong>${name}</strong><small id="wave-label"></small></div></div><button class="chip-btn" data-action="speed" aria-label="전투 속도">${icon('speed')}<b>${speed}×</b></button><button class="icon-btn" id="pause-button" data-action="pause" aria-label="전투 일시정지">${icon('pause')}</button><button class="icon-btn" data-action="leave" aria-label="저장하고 나가기">${icon('exit')}</button></div>
    <div class="hud"><span class="hud-item hp">${icon('heart')}<b id="health"></b></span><span class="hud-item">${icon('coin')}<b id="gold"></b></span><span class="hud-gauge">${icon('star')}<span class="gauge-bar"><i id="gauge-fill"></i></span><b id="gauge"></b><small>/${E.gaugeCap(run)}</small></span><span id="battle-time" class="hud-time"></span></div>
    <div class="battle-stage"><div class="arena-wrap"><div class="aura-chips" id="aura-chips" aria-label="지속 중인 필살기"></div><canvas id="arena" tabindex="0" aria-label="5행 5열 전장. 드래그로만 이동·합성합니다. 탭 또는 방향키와 Enter는 동료 정보 확인입니다."></canvas><p id="battle-notice" class="battle-notice" hidden></p></div></div>
    <div class="battle-dock">
    <div class="battle-slot" id="battle-slot"><div class="wave-strip"><div class="wave-row"><span class="wave-pips" id="wave-pips"></span><span class="wave-left" id="wave-left"></span></div><div class="boss-line" id="boss-line" hidden><span class="boss-mark">${icon('crown')}</span><div class="boss-main"><div class="boss-head"><b id="boss-name"></b><em id="boss-state"></em></div><span class="boss-bar"><i id="boss-fill"></i></span><small id="boss-trait"></small></div></div>${p().cleared<3?'<p class="battle-hint">드래그: 이동·합성 · 탭: 동료 정보 · 필살기 길게: 설명</p>':''}</div><div id="unit-panel" class="unit-panel" hidden></div></div>
    <div class="skills" style="--team-size:${TEAM_SIZE}">${run.deck.map(id=>`<button class="skill-button" data-skill="${id}" aria-label="${HERO[id].name}의 ${HERO[id].skill.name}">${image(id)}<small>${icon('star')}${HERO[id].skill.cost}${HERO[id].skill.goldCost?` · ${HERO[id].skill.goldCost}G`:''}</small><span class="skill-duration" hidden></span><span class="skill-rank" hidden></span></button>`).join('')}</div>
    <div class="battle-controls"><button class="primary" data-action="summon-battle">${icon('plus')}<span>동료 소환</span><b id="summon-cost"></b></button><button class="secondary" data-action="training">${icon('up')}훈련</button><button class="secondary toggle-auto" data-action="auto" aria-pressed="${p().settings.auto}"><span>자동</span><b>${p().settings.auto?'ON':'OFF'}</b></button></div>
    </div></section>`;
  hud=Object.fromEntries(['health','gold','gauge','gauge-fill','battle-time','wave-label','summon-cost','pause-button','battle-notice','battle','battle-slot','wave-pips','wave-left','boss-line','boss-name','boss-state','boss-fill','boss-trait'].map(id=>[id,$(id)]));
  hud.skills=[...document.querySelectorAll('[data-skill]')].map(node=>({node,id:node.dataset.skill,timer:node.querySelector('.skill-duration'),rank:node.querySelector('.skill-rank')}));
  for(const {node,id} of hud.skills){
    node.addEventListener('pointerdown',()=>{clearTimeout(skillHold);skillHeld=false;node.classList.add('holding');skillHold=setTimeout(()=>{if(node.disabled||!node.isConnected)return;skillHeld=true;node.classList.remove('holding');window.getSelection?.()?.removeAllRanges();navigator.vibrate?.(12);skillTip(node,id);},380);});
    for(const type of ['pointerup','pointerleave','pointercancel'])node.addEventListener(type,()=>{clearTimeout(skillHold);node.classList.remove('holding');hideSkillTip();});
    node.addEventListener('contextmenu',e=>e.preventDefault());node.addEventListener('selectstart',e=>e.preventDefault());
  }
  renderer=new Renderer($('arena'),art);settings();bindArena();fitBattle();updateBattle();
}
// Tall phones keep a slot under the arena for the wave strip and the unit card, so neither covers
// the board. When that slot would shrink the arena below 90% width, the card overlays the dock instead.
function fitBattle(){
  const el=hud?.battle;if(!el||!el.isConnected)return;el.classList.remove('compact');
  const stage=el.querySelector('.battle-stage'),w=stage.clientWidth,h=stage.clientHeight;el.classList.toggle('compact',h*720/780<w*.9);
}
let fitFrame=0;window.addEventListener('resize',()=>{if(screen!=='battle')return;cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(()=>{fitBattle();updateBattle();});});
const changedText=(node,value)=>{value=String(value);if(node.textContent!==value)node.textContent=value;};
function updateBattle(){
  if(screen!=='battle'||!run)return;
  changedText(hud.health,run.health);changedText(hud.gold,fmt(run.gold));changedText(hud.gauge,Math.floor(run.gauge));changedText(hud['battle-time'],duration(run.time*1000));
  const fill=`scaleX(${Math.min(1,run.gauge/E.gaugeCap(run)).toFixed(3)})`;if(hud['gauge-fill'].style.transform!==fill)hud['gauge-fill'].style.transform=fill;
  changedText(hud['wave-label'],run.mode==='main'?`웨이브 ${run.wave}/6${run.wave===3||run.wave===6?' · 보스 웨이브':''}`:run.mode==='monthly'?`보스 ${Math.min(run.wave,CHALLENGE_WAVES)}/${CHALLENGE_WAVES} · 코어에 닿으면 종료`:`웨이브 ${Math.min(run.wave,CHALLENGE_WAVES)}/${CHALLENGE_WAVES}${run.wave%3===0?' · 보스 웨이브':''}`);
  changedText(hud['summon-cost'],E.summonCost(run)?E.summonCost(run)+' G':'무료');
  const pauseButton=$('pause-button'),pauseState=paused?'play':'pause';if(pauseButton.dataset.state!==pauseState){pauseButton.dataset.state=pauseState;pauseButton.innerHTML=icon(pauseState);pauseButton.setAttribute('aria-label',paused?'전투 재개':'전투 일시정지');}
  updateAuraChips();
  for(const {node:b,id,timer,rank} of hud.skills){const top=topRank(id);if(rank.dataset.rank!==String(top)){rank.dataset.rank=String(top);rank.hidden=!top;rank.textContent=top?`${top}성`:'';}const {cost,goldCost=0}=HERO[id].skill,lock=E.castLock(run,id),active=lock||E.activeSkill(run,id),ready=run.gauge>=cost&&run.gold>=goldCost&&!!E.bestUnit(run,id)&&!lock;b.disabled=!ready||paused||run.phase!=='combat';if(b.disabled&&tipFor===id)hideSkillTip();b.classList.toggle('ready',ready);b.classList.toggle('active-skill',!!active);timer.hidden=!active;if(active)changedText(timer,`${active.remaining.toFixed(1)}초`);const fill=Math.min(1,run.gauge/cost).toFixed(2);if(b.style.getPropertyValue('--fill')!==fill)b.style.setProperty('--fill',fill);b.setAttribute('aria-label',`${HERO[id].name}의 ${HERO[id].skill.name}${goldCost?` · ${goldCost}골드 소모${run.gold<goldCost?' · 골드 부족':''}`:''}${active?` · 발동 중 ${active.remaining.toFixed(1)}초`:''}`);}
  const notice=hud['battle-notice'],boss=run.enemies.find(e=>e.boss&&e.hp>0),compact=hud.battle.classList.contains('compact');notice.hidden=!run.telegraph&&!(compact&&boss);notice.classList.toggle('warn',!!run.telegraph);changedText(notice,run.telegraph?.text||(boss?`${BOSSES[boss.boss].name} · 체력 ${Math.ceil(boss.hp/boss.maxHp*100)}%`:''));
  if(!compact)updateStrip(boss);updateUnit();
}
function updateStrip(boss){
  const done=w=>w<run.wave||w===run.wave&&['reward','intermission','victory'].includes(run.phase),key=run.mode==='main'?`${run.wave}:${done(run.wave)}`:`r${run.wave}`;
  if(hud['wave-pips'].dataset.key!==key){hud['wave-pips'].dataset.key=key;hud['wave-pips'].innerHTML=run.mode==='main'?`<small>WAVE</small>${Array.from({length:6},(_,i)=>{const w=i+1;return `<i class="${w%3===0?'boss':''} ${done(w)?'done':w===run.wave?'current':''}">${w%3===0?icon('crown'):''}</i>`;}).join('')}`:`<small>${run.mode==='monthly'?'BOSS':'WAVE'}</small><b>${Math.min(run.wave,CHALLENGE_WAVES)}</b><span class="round-of">/ ${CHALLENGE_WAVES}</span><span class="round-bar"><i style="width:${Math.min(1,(run.wave-1)/CHALLENGE_WAVES)*100}%"></i></span>`;}
  const left=run.enemies.filter(e=>e.hp>0).length+run.queue.length;
  changedText(hud['wave-left'],run.phase==='intermission'?`다음 웨이브 ${Math.max(0,run.breakTime).toFixed(1)}초`:run.phase==='reward'?'축복 선택':`남은 적 ${left}`);
  const queued=run.queue.some(q=>q.kind==='boss'),next=boss?run.wave:queued?run.wave:run.mode==='main'?(run.wave<3?3:run.wave<6?6:0):0,id=boss?.boss||(next&&(run.mode==='main'?CHAPTERS[run.chapter].bosses[0]:null));
  const line=hud['boss-line'];line.hidden=!id;if(!id)return;line.classList.toggle('live',!!boss);
  changedText(hud['boss-name'],BOSSES[id].name);changedText(hud['boss-state'],boss?`${Math.ceil(boss.hp/boss.maxHp*100)}%`:next===run.wave?'곧 등장':`${next}웨이브 등장`);changedText(hud['boss-trait'],BOSSES[id].trait||BOSSES[id].warning||'');
  const fill=`scaleX(${boss?Math.max(0,boss.hp/boss.maxHp).toFixed(3):1})`;if(hud['boss-fill'].style.transform!==fill)hud['boss-fill'].style.transform=fill;
}
// Tapping a unit opens its live sheet: current numbers, trait state, the
// ultimate (and which copy actually casts it) and every bonus applied now.
function updateUnit(){
  const panel=$('unit-panel');if(!panel)return;const u=run.board[selected];panel.hidden=!u;hud['battle-slot']?.classList.toggle('inspecting',!!u);renderer.selected=u?selected:-1;
  if(!u){delete panel.dataset.sig;return;}
  const detail=E.combatStats(run,u,selected,true),trait=E.personalTrait(run,u,selected),h=HERO[u.hero],flame=u.hero==='flame_sage',traitText=u.hero==='lightning_sage'?`${trait.size}연결 · 위력 +${Math.round((trait.damageMultiplier-1)*100)}% · 체인 ${Math.round(trait.chainRatio*100)}%${trait.extraChain?' · 추가 대상 +1':''}`:flame?`경로 화염장 · 0.5초당 ${(detail.damage*trait.zoneDamageMultiplier*.22).toFixed(1)} · 반경 ${detail.radius.toFixed(1)} · ${(3*trait.zoneDurationMultiplier*(E.has(run,'roots')?1.5:1)).toFixed(2).replace(/0$/,'')}초`:trait.label;
  const caster=E.bestUnit(run,u.hero),casts=caster?.uid===u.uid,{cost,goldCost=0}=h.skill,ready=run.gauge>=cost&&run.gold>=goldCost&&!E.castLock(run,u.hero),bonuses=detail.bonuses.filter(b=>b!==trait.label);
  const sig=`${u.uid}:${u.rank}:${u.priority}:${detail.damage.toFixed(1)}:${detail.interval.toFixed(2)}:${selected}:${traitText}:${casts}:${caster?.rank}:${ready}:${run.upgrades[u.hero]}:${bonuses.join('|')}`;
  if(panel.dataset.sig===sig)return;
  panel.dataset.sig=sig;panel.dataset.rarity=h.rarity;
  // A compact card in the slot under the arena (over the dock on short screens). Two blocks only:
  // who (name, stats and the live trait as three short lines beside the portrait) and what to do
  // (ultimate, target, sell). Everything else lives behind the ⓘ sheet.
  const line=traitText||h.role;
  panel.innerHTML=`<div class="unit-card-head"><span class="unit-face portrait" data-rarity="${h.rarity}">${image(u.hero)}</span><div class="unit-id"><span class="unit-name"><strong>${h.name}</strong><span class="rank" aria-label="${u.rank}성">${icon('star')}${u.rank}</span></span><small class="unit-stats-line">${flame?'장판':'위력'} <b>${flame?(detail.damage*trait.zoneDamageMultiplier).toFixed(1):fmt(detail.damage)}</b><i></i><b>${detail.interval.toFixed(2)}</b>초${run.upgrades[u.hero]?`<i></i>훈련 <b>${run.upgrades[u.hero]}</b>`:''}</small><small class="unit-trait-line ${trait.active?'active':''}" title="${escapeText(line)}">${escapeText(line)}</small></div><div class="unit-head-actions"><button class="unit-icon" data-action="unit-info" aria-label="${h.name} 자세히">i</button><button class="unit-icon" data-action="deselect" aria-label="선택 해제">${icon('close')}</button></div></div>
    <div class="unit-card-row"><button class="unit-skill ${casts?'casts':''} ${ready?'ready':''}" data-skill-info="${u.hero}"><span class="unit-skill-tag">${icon('star')}${cost}${goldCost?` · ${goldCost}G`:''}</span><b>${h.skill.name}</b><small>${casts?'이 동료가 씁니다':`${icon('star')}${caster?.rank??u.rank} 동료가 씁니다`}</small></button>
    <div class="unit-actions">${E.targetingLocked(u.hero)?`<span class="fixed-target">목표: ${u.hero==='flame_sage'?'경로 위':'무작위 적'}</span>`:`<button data-action="target">목표: ${RANK_TEXT[u.priority]}</button>`}<button data-sell="${selected}">회수 +${Math.round(6*Math.pow(1.7,u.rank-1))} G</button></div></div>`;
}
// Holding an ultimate button peeks at it: a small card above the button with the live numbers.
// Releasing closes it and does not cast. The full sheet stays one tap away in the unit panel.
function skillTip(node,id){
  hideSkillTip();if(!run)return;tipFor=id;
  const h=HERO[id],caster=E.bestUnit(run,id),preview=caster&&E.castPreview(run,id),{cost,goldCost=0}=h.skill,ur=h.hidden||h.rarity==='UR';
  const tip=document.createElement('div');tip.className='skill-tip';tip.id='skill-tip';tip.dataset.rarity=ur?'UR':h.rarity;tip.style.setProperty('--c',h.color);tip.setAttribute('role','tooltip');
  tip.innerHTML=`<div class="skill-tip-head"><b>${preview?.name||h.skill.name}</b>${boostChip(preview?.boost)}<span>${icon('star')}${h.skill.type==='starfall'?`${cost}+`:cost}${goldCost?` · ${goldCost}G`:''}</span></div>${(preview?preview.lines.slice(0,2):[h.skill.text]).map(line=>`<p>${escapeText(line)}</p>`).join('')}${boostHint(preview?.boost)}<small>${caster?`${icon('star')}${caster.rank} ${h.name}이(가) 발동 · 놓으면 닫힘`:'전장에 이 동료가 없어 쓸 수 없어요'}</small>`;
  document.body.appendChild(tip);
  const r=node.getBoundingClientRect(),w=tip.offsetWidth,hgt=tip.offsetHeight,left=Math.max(8,Math.min(window.innerWidth-w-8,r.left+r.width/2-w/2));
  tip.style.left=left+'px';tip.style.top=Math.max(8,r.top-hgt-12)+'px';tip.style.setProperty('--ax',(r.left+r.width/2-left)+'px');
}
// Live boost state of a conditional ultimate (castPreview().boost): a lit chip when boosted now.
const boostChip=b=>b?`<em class="skill-boost" data-on="${b.on}">${escapeText(b.label)}</em>`:'';
const boostHint=b=>b?.hint?`<p class="skill-hint">${escapeText(b.hint)}</p>`:'';
function hideSkillTip(){tipFor=null;document.getElementById('skill-tip')?.remove();}
// A button that turns disabled or is re-rendered mid-hold (the stage clears, the gauge drops) never
// sees its own pointerup, so a release anywhere closes the peek too.
for(const type of ['pointerup','pointercancel'])document.addEventListener(type,()=>{clearTimeout(skillHold);document.querySelector('.skill-button.holding')?.classList.remove('holding');hideSkillTip();},true);
// ⓘ on the unit card: every number and text for the selected companion.
function unitInfo(){
  const u=run?.board[selected];if(!u)return;const given=E.givenEffects(run,u,selected),detail=E.combatStats(run,u,selected,true),trait=E.personalTrait(run,u,selected),h=HERO[u.hero],flame=u.hero==='flame_sage',bonuses=detail.bonuses.filter(b=>b!==trait.label);
  show(h.name,`${u.rank}성 · 전투 정보`,`<div class="unit-stats"><span><small>${flame?'장판 위력':'위력'}</small><b>${flame?(detail.damage*trait.zoneDamageMultiplier).toFixed(1):fmt(detail.damage)}</b></span><span><small>공격 주기</small><b>${detail.interval.toFixed(2)}초</b></span><span><small>사거리</small><b>${h.range}</b></span><span><small>방식</small><b>${SHAPE_TEXT[h.shape]||''}</b></span></div>
    <div class="ability"><span class="ability-tag">특성</span><p>${h.trait.text}</p></div><div class="ability"><span class="ability-tag skill">필살기 · ${h.skill.name}</span><p>${h.skill.text}</p></div>
    ${given.length?`<div class="unit-buffs given"><em>이 동료가 주는 효과</em>${given.map(b=>`<span class="chip">${b}</span>`).join('')}</div>`:''}
    <div class="unit-buffs"><em>지금 받는 효과</em>${bonuses.length?bonuses.map(b=>`<span class="chip">${b}</span>`).join(''):'<span class="unit-none">없음</span>'}</div><p class="fineprint">훈련 ${run.upgrades[u.hero]}/5 · ${h.role}</p>`,
    `<button class="primary wide" data-action="close">전투로 돌아가기</button>`,'unit-info',u.uid);
}
// The unit card's ultimate row opens the full detail sheet.
function skillInfo(id){
  const h=HERO[id],caster=run&&E.bestUnit(run,id),preview=caster&&E.castPreview(run,id),{cost,goldCost=0}=h.skill,ready=!!run&&!!caster&&run.gauge>=cost&&run.gold>=goldCost&&run.phase==='combat'&&!E.castLock(run,id);
  show(h.skill.name,`${h.name} · 필살기`,`<div class="skill-sheet" data-rarity="${h.rarity}"><span class="portrait" data-rarity="${h.rarity}">${image(id)}</span><div><span class="ability-tag skill">별빛 ${h.skill.type==='starfall'?`${cost} 이상`:cost}${goldCost?` · 골드 ${goldCost}`:''}</span><p>${h.skill.text}</p><small>${caster?`가장 높은 ${caster.rank}성 ${h.name}이(가) 사용합니다.`:'전장에 이 동료가 없어 사용할 수 없습니다.'}</small></div></div>${preview?`<div class="skill-now"><div class="skill-now-head"><span class="ability-tag skill">지금 누르면 · ${icon('star')}${preview.rank}</span>${boostChip(preview.boost)}</div>${preview.lines.map(line=>`<p>${escapeText(line)}</p>`).join('')}${boostHint(preview.boost)}</div>`:''}`,
    `<div class="dialog-buttons"><button class="secondary" data-action="close">돌아가기</button><button class="primary" data-cast-now="${id}" ${ready?'':'disabled'}>바로 사용</button></div>`,'skill-info',id);
}
// Ultimate cut-in: a slanted band with the companion and the skill name over the top of the
// board. UR casts get a gold frame, a longer hold and a short slow-motion beat (real time only;
// the simulation itself is unchanged). Transform and opacity animations only.
let cutinTimer=0,slowmo=0;
function cutIn(e){
  const wrap=document.querySelector('.arena-wrap'),h=HERO[e.hero];if(!wrap||!h)return;
  const ur=h.hidden||h.rarity==='UR',reduced=p().settings.reduced;
  wrap.querySelector('.cutin')?.remove();clearTimeout(cutinTimer);
  const el=document.createElement('div');el.className='cutin';el.dataset.rarity=ur?'UR':h.rarity;el.dataset.reduced=String(reduced);el.style.setProperty('--c',h.color);el.setAttribute('aria-hidden','true');
  el.innerHTML=`<div class="cutin-band"><span class="cutin-lines"></span><span class="cutin-art">${image(e.hero,true)}</span><span class="cutin-text"><small>${ur?'ULTIMATE':'필살기'} · ${h.name}</small><b>${e.name||h.skill.name}</b></span></div>`;
  wrap.appendChild(el);cutinTimer=setTimeout(()=>el.remove(),reduced?700:ur?1600:1100);
  if(ur&&!reduced)slowmo=.5;
}
// Buff chips: every running ultimate aura with its companion and a countdown ring.
function updateAuraChips(){
  const box=$('aura-chips');if(!box)return;
  const live=Object.entries(E.ACTIVE_SKILLS).flatMap(([id])=>{const a=run.deck.includes(id)&&E.activeSkill(run,id);return a?[[id,a]]:[];});
  for(const node of [...box.children])if(!live.some(([id])=>id===node.dataset.aura))node.remove();
  for(const [id,a] of live){let node=box.querySelector(`[data-aura="${id}"]`);
    if(!node){node=document.createElement('span');node.className='aura-chip';node.dataset.aura=id;node.style.setProperty('--c',HERO[id].color);node.innerHTML=`${image(id)}<b></b>`;box.appendChild(node);}
    node.style.setProperty('--p',(a.remaining/a.total).toFixed(3));node.classList.toggle('ending',a.remaining<2);changedText(node.querySelector('b'),Math.ceil(a.remaining));}
}
// Fullscreen for quick phone testing in Chrome. iOS Safari has no page fullscreen API.
function syncFullscreen(){
  const button=$('fullscreen-button');if(!button)return;const supported=!!document.documentElement.requestFullscreen,active=!!document.fullscreenElement;
  button.hidden=!supported;button.setAttribute('aria-label',active?'전체화면 나가기':'전체화면');button.setAttribute('aria-pressed',String(active));button.querySelector('use')?.setAttribute('href',active?'#i-shrink':'#i-expand');
}
async function toggleFullscreen(){
  try{if(document.fullscreenElement)await document.exitFullscreen();else{try{await document.documentElement.requestFullscreen({navigationUI:'hide'});}catch{await document.documentElement.requestFullscreen();}}}
  catch{toast('전체화면을 열지 못했어요. 브라우저에서 다시 시도해 주세요.');}
  syncFullscreen();
}
document.addEventListener('fullscreenchange',syncFullscreen);
function battleCommand(result){if(!result?.ok)toast(result?.reason);else saves.mark();updateBattle();}
function bindArena(){
  const canvas=$('arena'),point=e=>{const b=canvas.getBoundingClientRect();return {x:(e.clientX-b.left)*720/b.width,y:(e.clientY-b.top)*780/b.height};};
  const release=()=>{pointer=null;renderer.drag=null;renderer.hover=-1;renderer.press=-1;};
  canvas.addEventListener('pointerdown',e=>{if(paused||modal||pointer||e.button!==0)return;const at=point(e),index=E.cellAt(at.x,at.y);pointer={id:e.pointerId,at,index,uid:run.board[index]?.uid,drag:false};renderer.press=run.board[index]?index:-1;try{canvas.setPointerCapture(e.pointerId);}catch{}e.preventDefault();sound.unlock();});
  canvas.addEventListener('pointermove',e=>{if(pointer?.id!==e.pointerId)return;const at=point(e),u=run.board[pointer.index];if(u&&u.uid===pointer.uid&&(pointer.drag||Math.hypot(at.x-pointer.at.x,at.y-pointer.at.y)>9)){pointer.drag=true;renderer.drag={hero:u.hero,uid:u.uid,x:at.x,y:at.y,form:E.unitForm(run,u)};renderer.hover=E.cellAt(at.x,at.y);}});
  canvas.addEventListener('pointerup',e=>{if(pointer?.id!==e.pointerId)return;const at=point(e),index=E.cellAt(at.x,at.y);if(!paused&&!modal&&index>=0){if(pointer.drag&&run.board[pointer.index]?.uid===pointer.uid){const result=E.move(run,pointer.index,index);battleCommand(result);if(result.ok)selected=index;}else if(!pointer.drag)activate(index);}release();updateUnit();});
  canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',()=>{if(pointer)release();});
  let keyboard=12;canvas.addEventListener('keydown',e=>{if(paused||modal)return;const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-5,ArrowDown:5}[e.key];if(delta){e.preventDefault();keyboard=Math.max(0,Math.min(24,keyboard+delta));renderer.selected=keyboard;toast(`${Math.floor(keyboard/5)+1}행 ${keyboard%5+1}열 · ${run.board[keyboard]?HERO[run.board[keyboard].hero].name:'빈칸'}`);}if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(keyboard);}});
}
function activate(index){selected=selected===index?-1:index;updateUnit();}
// Best star of a companion on the board (time ruler and cinderella included as they stand).
const topRank=id=>run?run.board.reduce((n,u)=>u?.hero===id?Math.max(n,u.rank):n,0):0;
function training(){
  show('훈련','이번 원정 한정',`<p class="subtext">이번 원정에서만 적용됩니다. 1회당 위력 +25%, 최대 5회. 일부 동료는 오라·감속 같은 역할 수치도 함께 오릅니다.</p><div class="choose-list" style="margin-top:14px">${run.deck.map(id=>`<button class="choose-row" data-train="${id}" ${run.upgrades[id]>=5||run.gold<E.upgradeCost(run,id)?'disabled':''}>${portrait(id)}<div><strong>${HERO[id].name}</strong><small>${topRank(id)?`최고 ${topRank(id)}성 · `:'전장에 없음 · '}훈련 ${run.upgrades[id]}/5${E.trainingBonus(id,run.upgrades[id])?` · ${E.trainingBonus(id,run.upgrades[id])}`:''}</small></div><b>${run.upgrades[id]>=5?'최대':E.upgradeCost(run,id)+' G'}</b></button>`).join('')}</div>`,`<button class="primary wide" data-action="close">전투로 돌아가기</button>`,'training');
}
function reward(){
  show('축복 선택',`웨이브 ${run.wave} 클리어`,`<p class="subtext">다음 웨이브에 적용할 축복을 하나 고르세요.</p><div class="reward-options" style="margin-top:14px">${run.reward.map(id=>`<button class="reward-option" data-reward="${id}"><strong>${BLESSING[id].name}</strong><small>${BLESSING[id].text}</small></button>`).join('')}</div>`,'','reward');
}
function settle(abandon=false){if(!run||!p().active)return;const snapshot={won:!abandon&&run.phase==='victory',round:clearedRounds(run),stage:run.chapter+1,mode:run.mode,tier:run.mode==='main'?null:run.tier,damage:run.stats.damage,kills:run.stats.kills,seconds:run.time,byHero:{...run.stats.byHero}};const result=act('settle',{token:p().active.token,won:snapshot.won,round:snapshot.round,damage:snapshot.damage,seconds:snapshot.seconds,merges:Math.min(999,run.stats.merges)},false);if(!result.ok){storagePause();return;}saves.reset();lastResult={...snapshot,reward:result.reward,newBest:result.newBest};run=null;renderer=null;screen='adventure';mode=snapshot.mode;cycle=Math.min(4,Math.floor(p().cleared/9));close();render();showResult(lastResult);}
function showResult(r){
  const mvp=Object.entries(r.byHero).sort((a,b)=>b[1]-a[1])[0],label=r.mode==='main'?`스테이지 ${stageLabel(r.stage)}`:`${r.mode==='weekly'?'주간 드래프트':'월간 보스전'} · ${(TIERS[r.tier]||TIERS.easy).name}`;
  show(r.won?'스테이지 클리어':r.mode==='main'?'스테이지 실패':'도전 종료',label,`<div class="battle-result ${r.won?'win':'lose'}"><span class="result-rays" aria-hidden="true"></span><span class="result-mark">${icon(r.won?'check':'close')}</span><b>${r.won?(r.mode==='main'?'승리':'완주'):r.mode==='main'?'패배':r.mode==='monthly'?`보스 ${r.round}체 격파`:`${r.round}웨이브`}</b>${!r.won&&r.mode==='monthly'?'<small>보스가 코어에 닿아 도전이 끝났습니다</small>':''}</div>
    ${r.mode==='monthly'?`<p class="record-result">${r.newBest?'이번 달 최고 기록 갱신':'도전 기록 저장'} · 이번 도전 ${r.round}보스</p>${monthlyRecordPanel()}`:`<div class="reward-box"><span>획득 보상</span><span class="cost">${icon('gem')}<b class="count-up" data-to="${r.reward}">+${fmt(r.reward)}</b></span></div>`}
    <div class="result-stat"><span>처치</span><b>${fmt(r.kills)}</b></div><div class="result-stat"><span>총 피해</span><b>${fmt(r.damage)}</b></div><div class="result-stat"><span>전투 시간</span><b>${duration(r.seconds*1000)}</b></div>
    ${mvp?`<div class="result-mvp">${image(mvp[0],true)}<div><p class="mvp-tag">MVP</p><strong>${HERO[mvp[0]].name}</strong><small>기여 피해 ${fmt(mvp[1])} (${Math.round(mvp[1]/Math.max(1,r.damage)*100)}%)</small></div></div>`:''}
    <p class="subtext">${r.won?`파견 보상 +${p().cleared*5}%${p().cleared%9===0&&p().cleared<=36?' · 파견 슬롯이 해금되었습니다.':''}`:r.mode==='main'?'동료를 육성하거나 편성·배치를 바꿔 다시 도전하세요.':'동료와 유물을 키워 더 높은 라운드에 도전하세요.'}</p>`,
    `<div class="dialog-buttons"><button class="secondary" data-action="${r.mode==='monthly'?'close':'go-collection'}">${r.mode==='monthly'?'기록 확인':'동료 강화'}</button><button class="primary" data-action="${r.mode==='monthly'?'monthly-retry':'close'}">${r.mode==='monthly'?'다시 도전':'확인'}</button></div>`,'result');
  // Rewards count up; a win bursts gold stars over the result mark.
  const node=document.querySelector('#sheet .count-up'),to=Number(node?.dataset.to)||0,start=performance.now();
  if(node&&to>0&&$('app').dataset.reduced!=='true'&&!navigator.webdriver){const tick=t=>{const k=Math.min(1,(t-start)/900);node.textContent='+'+fmt(Math.round(to*(1-Math.pow(1-k,3))));if(k<1&&node.isConnected)requestAnimationFrame(tick);};node.textContent='+0';requestAnimationFrame(tick);}
  if(r.won){const mark=document.querySelector('#sheet .result-mark');if(mark)setTimeout(()=>{const c=centerOf(mark);burst(c.x,c.y,{count:16,spread:110,size:13,duration:1000,color:'#ffe08a'});},180);}
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
  memorialHero=null;memorialPage=0;$('sheet')?.classList.remove('memory-art-only','mv-reading');
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
    ${tutorPanel()}
    <div class="settings-actions"><button class="secondary" data-action="export">백업 저장</button><button class="secondary" data-action="import">백업 불러오기</button></div>
    <p class="fineprint">진행 데이터는 이 기기의 브라우저에 저장됩니다. 기기를 옮길 때는 백업 파일을 사용하세요.</p>
    <details class="more"><summary>알아두기</summary><p>같은 저장 공간을 두 창에서 동시에 수정하면 변경을 감지한 창이 멈춥니다. 오프라인 테스트 버전의 시간은 기기 시계를 사용합니다.</p></details>`,`<button class="primary wide" data-action="close">확인</button>`,'settings');
}
function show(title,kicker,body,footer='',kind='generic',info=null){hideSkillTip();if(run&&kind!=='reward'){saves.mark();saves.flush();}const scroll=modal===kind&&modalInfo===info?$('sheet-body').scrollTop:0;if(!modal)previousFocus=document.activeElement;releaseMemorial();modal=kind;modalInfo=info;$('sheet').dataset.kind=kind;$('sheet-title').textContent=title;$('sheet-kicker').textContent=kicker;$('sheet-body').innerHTML=body;$('sheet-footer').innerHTML=footer;$('overlay').hidden=false;$('app').setAttribute('aria-hidden','true');if('inert' in $('app'))$('app').inert=true;$('sheet-body').scrollTop=scroll;$('sheet').focus();}
function close(){if(!modal)return;tutorAbort?.abort();const wasLeave=modal==='leave';releaseMemorial();modal=null;modalInfo=null;if(wasLeave&&!saveBlocked)paused=false;$('overlay').hidden=true;$('app').removeAttribute('aria-hidden');if('inert' in $('app'))$('app').inert=false;if(previousFocus?.isConnected)previousFocus.focus();else $('content').focus();}
function history(){
  show('소환 기록','최근 50회',p().history.map(h=>`<div class="history-row">${image(h.id)}<div><strong>${(HERO[h.id]||ARTIFACT[h.id]).name}</strong><small>${h.fresh?'신규':'중복 · 강화 재료'} · ${h.banner==='normal'?'일반':h.banner==='season'?'시즌':'유물'} · ${calendar(h.at).day}</small></div>${badge((HERO[h.id]||ARTIFACT[h.id]).rarity)}</div>`).join('')||'<p class="empty">아직 소환 기록이 없습니다.</p>',`<button class="secondary wide" data-action="close">확인</button>`,'history');
}
function records(){
  show('모험 기록','최근 결과',monthlyRecordPanel()+(p().results.map(r=>`<div class="rate-row"><span style="display:block">${r.mode==='main'?`스테이지 ${stageLabel(r.stage)}`:`${r.mode==='weekly'?'주간 드래프트':'월간 보스전'}${r.tier?` · ${TIERS[r.tier].name}`:''}`}<br><small>${calendar(r.at).day} · ${r.won?(r.mode==='main'?'클리어':'완주'):r.round+(r.mode==='main'?'라운드':'웨이브')}</small></span>${r.mode==='monthly'?'<span class="chip">기록 저장</span>':gem(r.reward)}</div>`).join('')||'<p class="empty">아직 모험 기록이 없습니다.</p>'),`<button class="secondary wide" data-action="close">확인</button>`,'records');
}
function exportBackup(){const blob=new Blob([JSON.stringify(p(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`StarGarden-${calendar(now()).day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('백업 파일을 저장했습니다.');}
// ───────── Shell ─────────
// Five tabs. The garden gathers the idle loops (greenhouse, dispatch, gift basket); the library opens from home.
const NAV=[['home','홈'],['collection','동료'],['adventure','모험'],['summon','소환'],['garden','정원']];
const TITLES={home:'별빛 정원',collection:'동료',adventure:'모험',summon:'소환',garden:'정원',library:'별의 서재',draft:'주간 드래프트'};
const greetOpen=()=>p().petDay!==calendar(now()).day;
const gardenDot=()=>p().dispatches.some(d=>d.end<=now())||basketState(p(),now()).ready>0;
const summonDot=()=>!todayDaily().free||['normal','season'].some(b=>p().pity[b]>=T.pity[b]);
function nav(){
  const dots={home:dailyClaimable(todayDaily())||greetOpen()||libraryDot(),summon:summonDot(),garden:gardenDot()};
  const current=screen==='library'?'home':screen;
  $('navigation').innerHTML=NAV.map(([id,name])=>`<button class="nav-item" data-nav="${id}" ${current===id?'aria-current="page"':''}>${icon(id)}<span>${name}</span>${dots[id]?'<i class="dot"></i>':''}</button>`).join('');
  $('navigation').hidden=screen==='battle'||screen==='draft';
}
// Dots change without a re-render (a claim, a greeting, a timer).
function navDots(){
  const dots={home:dailyClaimable(todayDaily())||greetOpen()||libraryDot(),summon:summonDot(),garden:gardenDot()};
  for(const b of document.querySelectorAll('#navigation .nav-item')){const on=!!dots[b.dataset.nav],dot=b.querySelector('.dot');if(on&&!dot)b.insertAdjacentHTML('beforeend','<i class="dot"></i>');else if(!on&&dot)dot.remove();}
}
function render(){
  const entering=$('app').dataset.screen!==screen;$('app').dataset.screen=screen;document.body.dataset.battle=String(screen==='battle');wallet();nav();
  const title=$('screen-title');if(title)title.textContent=TITLES[screen]||'';
  if(screen==='battle')return renderBattle();if(screen==='draft')return renderDraft();
  const templates={home,collection:renderCollection,adventure,summon:renderSummon,garden:renderGarden,library:renderLibrary};
  const c=$('content');if(entering){c.scrollTop=0;lobbyView=false;giftTray=false;}
  c.innerHTML=(templates[screen]||home)();
  const lobbyArt=$('lobby-memorial');if(lobbyArt)lobbyArt.onerror=()=>{const id=p().lobby,fallback=window.__MEMORIAL_FALLBACK__?.[id];if(fallback&&lobbyArt.src!==fallback)lobbyArt.src=fallback;else lobbyArt.remove();};
  // Only a change of screen fades in; refreshes in place stay still.
  if(entering){c.classList.remove('enter');void c.offsetWidth;c.classList.add('enter');}
}

// ───────── Home ─────────
// The partner fills the stage. Lines appear as a subtitle above the name plate and fade; nothing sits on the face.
// First touch of the day is the greeting (a heart floats over the partner until then). The eye hides every control.
let lobbyView=false,giftTray=false,subtitleTimer=0;
function home(){
  const profile=p(),hero=HERO[profile.partner],e=profile.heroes[hero.id],c=calendar(now()),stage=Math.min(45,profile.cleared+1),active=profile.active,memorial=lobbyMemorial(profile),idle=idleReward(profile,now());
  const depart=active?{title:'이어하기',sub:active.mode==='weekly'?'주간 드래프트':active.mode==='monthly'?'월간 보스전':`스테이지 ${stageLabel(active.stage)}`,num:icon('play')}
    :{title:profile.cleared===45?'다시 도전':'출격',sub:`${bossOf(stage).name} · 전투력 ${fmt(teamPower(profile))}`,num:stageLabel(stage)};
  return `<div class="home">
  <section class="lb ${memorial?'has-memorial':''} ${giftTray?'tray-open':''}" id="lobby" data-rarity="${hero.rarity}" style="--hero:${hero.color}" aria-label="${hero.name}와 함께하는 정원">
    ${memorial?`<img class="lb-memorial" id="lobby-memorial" data-fallback="1" src="${window.__MEMORIAL_MEDIA__[memorial]}" alt="" draggable="false">`:''}
    <div class="lb-sky" aria-hidden="true">${Array.from({length:7},(_,i)=>`<i class="twinkle" style="--i:${i}"></i>`).join('')}</div>
    <div class="shards" id="shards">${memorial?'':shardsMarkup()}</div>
    <div class="lb-partner">${memorial?'':`<span class="lb-spot" aria-hidden="true"></span>${image(hero.id,true,'scene-partner')}`}</div>
    <button class="lb-touch" data-action="talk" aria-label="${hero.name}에게 말 걸기"></button>
    ${greetOpen()?`<span class="greet-cue" id="greet-cue" aria-hidden="true">${icon('heart')}</span>`:''}
    <div class="lb-chrome">
      <button class="lb-season" data-action="season"><span class="lb-season-face">${image(c.guardian)}</span><span><small>${monthNo(c)} 수호자</small><b>${HERO[c.guardian].name}</b></span></button>
      <div class="lb-side">
        <button class="lb-btn" data-action="daily">${icon('scroll')}<span>임무</span>${dailyClaimable(todayDaily())?'<i class="dot"></i>':''}</button>
        <button class="lb-btn" data-action="library">${icon('library')}<span>서재</span>${libraryDot()?'<i class="dot"></i>':''}</button>
      </div>
      <button class="lb-view" data-action="lobby-view" aria-label="감상 모드">${icon('eye')}</button>
      <p class="lb-sub" id="subtitle" role="status"><b>${hero.name}</b><span id="subtitle-text"></span></p>
      <div class="lb-tray" id="gift-tray" ${giftTray?'':'hidden'}>${trayMarkup(hero.id)}</div>
      <div class="lb-bar">
        <button class="lb-name" data-action="bond" aria-label="${hero.name} · 호감도 ${e.bond} · 인연">${badge(hero.rarity)}<span class="lb-name-main"><strong>${hero.name}</strong><span class="bond-hearts" id="np-hearts" aria-hidden="true">${heartsOf(e.bond)}</span></span><i class="bond-xp" aria-hidden="true"><b id="np-xp" style="width:${Math.round(bondRatio(e)*100)}%"></b></i></button>
        <button class="lb-gift" data-action="gift-tray" aria-expanded="${giftTray}" aria-label="선물 주기">${giftArt('bouquet','side')}<b id="gift-count">${giftTotal()}</b></button>
      </div>
    </div>
  </section>
  <section class="lb-dock">
    <button class="primary shine lb-depart" data-action="${active?'resume':'prepare'}" data-stage="${stage}"><span class="lb-depart-num">${depart.num}</span><span class="lb-depart-text"><b>${depart.title}</b><small>${depart.sub}</small></span>${icon('chevron')}</button>
    <button class="lb-jar" data-action="idle" id="idle-claim" ${idle<1?'disabled':''} aria-label="별똥별 수집"><span class="lb-jar-ring" id="idle-ring" style="--fill:${idleFill()}">${icon('star')}</span><span class="lb-jar-text"><small>별똥별</small><b id="idle-total">${fmt(idle)}</b></span></button>
  </section></div>`;
}
const idleFill=()=>Math.min(1,(now()-p().idleAt)/(T.idleHours*HOUR)).toFixed(3);
function trayMarkup(id){
  const e=p().heroes[id],max=e.bond>=BOND_MAX;
  return GIFT_IDS.map(g=>{const n=p().gifts[g],fav=FAVORITE[id]===g;return `<button class="tray-gift ${fav?'fav':''}" data-give="${g}" data-to="${id}" ${n<1||max?'disabled':''} aria-label="${GIFTS[g].name} · ${n}개${fav?' · 좋아하는 선물':''}">${giftArt(g)}<b>${n}</b>${fav?`<i class="fav-heart">${icon('heart')}</i>`:''}</button>`;}).join('')
    +`<button class="tray-more" data-action="go-garden" aria-label="선물 바구니로">${icon('garden')}</button>`;
}
function say(text,name=HERO[p().partner].name){
  const box=$('subtitle'),line=$('subtitle-text');if(!box||!line)return;
  box.querySelector('b').textContent=name;line.textContent=text;box.classList.remove('show');void box.offsetWidth;box.classList.add('show');
  clearTimeout(subtitleTimer);subtitleTimer=setTimeout(()=>box.classList.remove('show'),5200);
}
function hopPartner(){const art=document.querySelector('.scene-partner');if(art){art.classList.remove('hop');void art.offsetWidth;art.classList.add('hop');}}
const partnerPoint=()=>{const n=document.querySelector('.scene-partner')||document.querySelector('.lb-touch');if(!n)return {x:innerWidth/2,y:innerHeight/2};const r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height*.32};};
// Updates the lobby in place after a greeting, a gift or a claim.
function refreshLobby(){
  if(screen!=='home')return;const id=p().partner,e=p().heroes[id];
  const h=$('np-hearts');if(h)h.innerHTML=heartsOf(e.bond);const xp=$('np-xp');if(xp)xp.style.width=`${Math.round(bondRatio(e)*100)}%`;
  const count=$('gift-count');if(count)count.textContent=giftTotal();const tray=$('gift-tray');if(tray&&!tray.hidden)tray.innerHTML=trayMarkup(id);
  if(!greetOpen())$('greet-cue')?.remove();
  for(const [action,on] of [['daily',dailyClaimable(todayDaily())],['library',libraryDot()]]){const b=document.querySelector(`.lb-btn[data-action="${action}"]`);if(!b)continue;const dot=b.querySelector('.dot');if(on&&!dot)b.insertAdjacentHTML('beforeend','<i class="dot"></i>');else if(!on&&dot)dot.remove();}
  navDots();
}
function talk(){
  if(lobbyView){setLobbyView(false);return;}
  const hero=HERO[p().partner],c=partnerPoint();
  if(greetOpen()){const before=p().heroes[hero.id].bond,result=act('pet',{},false);if(result.ok){hearts(c.x,c.y);floatText(c.x,c.y-30,'+40',`#8fd8ff`);say(greetLine(hero.id,calendar(now()).day));hopPartner();refreshLobby();bondUp(hero.id,before);return;}}
  talkIndex++;const lines=partnerLines(hero);say(lines[(p().heroes[hero.id].bond+talkIndex)%lines.length]);hopPartner();hearts(c.x,c.y,4);
}
function setLobbyView(on){
  lobbyView=on;$('app').classList.toggle('lobby-viewing',on);
  if(on){$('subtitle')?.classList.remove('show');giftTray=false;const t=$('gift-tray');if(t)t.hidden=true;$('lobby')?.classList.remove('tray-open');}
}
function toggleTray(button){
  giftTray=!giftTray;const tray=$('gift-tray');if(!tray)return;tray.innerHTML=trayMarkup(p().partner);tray.hidden=!giftTray;button?.setAttribute('aria-expanded',String(giftTray));$('lobby')?.classList.toggle('tray-open',giftTray);
  if(giftTray&&giftTotal()===0)say('선물은 정원의 선물 바구니에 8시간마다 하나씩 생겨요.','루미');
}
// Gifts: from the lobby tray (the partner) or a companion's bond sheet. A heart level shows a small celebration.
function giveGift(id,gift,button){
  const before=p().heroes[id].bond,result=act('gift',{id,gift},false);if(!result.ok){toast(result.message);return;}
  const reply=result.line||'고마워요.',c=button?centerOf(button):partnerPoint();
  floatText(c.x,c.y-24,`호감 +${result.points}`,result.favorite?'#ff9ec0':'#ffe39a');
  if(modal==='bond'&&modalInfo===id){bondSheet(id,reply);}
  else if(screen==='home'&&id===p().partner){const pc=partnerPoint();hearts(pc.x,pc.y,result.favorite?9:5);say(reply);hopPartner();refreshLobby();}
  bondUp(id,before);
}
function bondUp(id,before){
  const e=p().heroes[id];if(e.bond<=before)return;
  if(e.bond>=BOND_MAX){toast(`${HERO[id].name}과(와)의 인연의 기억이 열렸어요!`);const c=partnerPoint();burst(c.x,c.y,{count:26,spread:150,size:14,duration:1200,color:'#ff9ec0'});if(screen==='home'&&modal!=='bond')setTimeout(()=>{if(!modal)openMemorial(id);},900);}
  else toast(`${HERO[id].name} 호감도 ${e.bond}`);
}
// Bond sheet: hearts, the favourite gift, giving gifts, and the memory this bond opens.
function bondSheet(id,reply=null){
  const h=HERO[id],e=p().heroes[id];if(!h||!e?.owned)return;const max=e.bond>=BOND_MAX,left=bondNeed(e.bond)-(e.bondXp||0),story=MEMORIAL_STORIES[id],open=e.bond>=story.unlockBond;
  show(h.name,'인연',`<div class="bond-head" data-rarity="${h.rarity}"><span class="bond-face">${image(id,true)}</span><div class="bond-meter"><small>${h.title}</small><span class="bond-hearts big" aria-hidden="true">${heartsOf(e.bond)}</span><b>호감도 ${e.bond}<em>/${BOND_MAX}</em></b><div class="progress"><span style="width:${Math.round(bondRatio(e)*100)}%"></span></div><small>${max?'가장 가까운 사이예요':`다음 하트까지 ${left}`}</small></div></div>
    <p class="bond-reply ${reply?'show':''}" role="status">${escapeText(reply||(max?'함께한 기억이 열려 있어요.':`${GIFTS[FAVORITE[id]].name}을(를) 가장 좋아해요.`))}</p>
    <div class="bond-gifts">${GIFT_IDS.map(g=>{const n=p().gifts[g],fav=FAVORITE[id]===g;return `<button class="tray-gift ${fav?'fav':''}" data-give="${g}" data-to="${id}" ${n<1||max?'disabled':''}>${giftArt(g)}<b>${n}</b><small>+${giftPoints(id,g)}</small>${fav?`<i class="fav-heart">${icon('heart')}</i>`:''}</button>`;}).join('')}</div>
    <button class="bond-memory ${open?'open':''}" data-memorial="${id}"><span class="bond-memory-art">${open&&window.__MEMORIAL_THUMBS__?.[id]?`<img src="${window.__MEMORIAL_THUMBS__[id]}" alt="" draggable="false">`:icon('lock')}</span><span><small>인연의 기억</small><strong>${escapeText(story.title)}</strong><em>${open?'감상하기':`호감도 ${story.unlockBond}에서 열려요`}</em></span>${icon('chevron')}</button>`,
    `<div class="dialog-buttons">${id===p().partner?'<button class="secondary" data-action="partner">파트너 바꾸기</button>':`<button class="secondary" data-set-partner="${id}">파트너로</button>`}<button class="primary" data-action="close">닫기</button></div>`,'bond',id);
}
function partners(){
  show('파트너','함께 정원에 설 동료',`<div class="cards">${HEROES.filter(h=>p().heroes[h.id].owned).map(h=>`<button class="cc ${p().partner===h.id?'current':''}" data-set-partner="${h.id}" data-rarity="${h.rarity}"><span class="cc-art">${image(h.id)}</span>${badge(h.rarity)}<span class="cc-hearts bond-hearts" aria-hidden="true">${heartsOf(p().heroes[h.id].bond)}</span><strong>${h.name}</strong></button>`).join('')}</div>`,'','partners');
}
// Collecting shooting stars: shards fly to the dust counter and the jar empties.
function collectStars(){
  const shards=[...document.querySelectorAll('.shard')].map(n=>centerOf(n)),jar=$('idle-ring'),from=shards.length?shards:jar?[centerOf(jar)]:[],target=$('dust')?.closest('.pill');
  const result=act('idle',{},false);if(!result.ok){toast(result.message);return;}
  const end=target?centerOf(target):{x:innerWidth-80,y:24},reduced=$('app').dataset.reduced==='true';
  $('shards').innerHTML='';const total=$('idle-total');if(total)total.textContent='0';if(jar)jar.style.setProperty('--fill','0');const b=$('idle-claim');if(b)b.disabled=true;
  if(!reduced){const layer=document.querySelector('.fx-layer')||document.body;
    from.forEach((s,i)=>{const el=document.createElement('i');el.className='fx-spark star-fly';el.style.cssText=`left:${s.x}px;top:${s.y}px;width:18px;height:18px;--c:#ffe39a`;layer.appendChild(el);
      el.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(calc(-50% + ${(end.x-s.x)*.4}px),calc(-50% + ${(end.y-s.y)*.4-60}px)) scale(1.3)`,opacity:1,offset:.45},{transform:`translate(calc(-50% + ${end.x-s.x}px),calc(-50% + ${end.y-s.y}px)) scale(.4)`,opacity:.2}],{duration:720+i*60,easing:'cubic-bezier(.4,0,.2,1)'}).onfinish=()=>el.remove();});
    setTimeout(()=>{if(target){target.classList.remove('gain');void target.offsetWidth;target.classList.add('gain');}burst(end.x,end.y,{count:10,spread:40,size:9,color:'#ffe39a'});},760);}
  floatText(end.x-30,end.y+28,result.message,'#ffe39a');refreshLobby();
}

// ───────── Collection: companions, relics, memories ─────────
// Owned cards are in full colour; missing ones are silhouettes with their names, so the book shows what is left.
function bookCard(id){
  const h=HERO[id],e=p().heroes[id],ready=e.owned&&e.copies>=duplicateCost(e.enhance)&&!p().active,gone=away(p(),id);
  return `<button class="cc ${e.owned?'':'unowned'} ${ready?'ready':''}" data-hero="${id}" data-rarity="${h.rarity}" aria-label="${h.name}, ${h.rarity}${e.owned?'':', 미보유'}${ready?', 강화 가능':''}"><span class="cc-art">${image(id)}</span>${badge(h.rarity)}${e.owned&&e.enhance?`<span class="cc-plus">+${e.enhance}</span>`:''}${ready?`<span class="cc-up">${icon('up')}</span>`:''}${gone?'<span class="cc-away">파견</span>':''}<strong>${h.name}</strong></button>`;
}
function relicCard(id){
  const a=ARTIFACT[id],e=p().relics[id],ready=e.owned&&e.copies>=relicCost(a.rarity,e.enhance)&&!p().active,worn=p().equipped.includes(id);
  return `<button class="cc relic ${e.owned?'':'unowned'} ${ready?'ready':''} ${worn?'worn':''}" data-relic="${id}" data-rarity="${a.rarity}" aria-label="${a.name}${e.owned?` Lv.${relicLevel(e)}`:', 미보유'}${worn?', 장착 중':''}"><span class="cc-art">${image(id)}</span>${badge(a.rarity)}${e.owned?`<span class="cc-plus">Lv.${relicLevel(e)}</span>`:''}${ready?`<span class="cc-up">${icon('up')}</span>`:''}${worn?`<span class="cc-worn">${icon('check')}</span>`:''}<strong>${a.name}</strong></button>`;
}
const memoryOpen=id=>p().heroes[id].owned&&p().heroes[id].bond>=MEMORIAL_STORIES[id].unlockBond;
function renderCollection(){
  const owned=HEROES.filter(h=>p().heroes[h.id].owned).length,relics=ARTIFACTS.filter(a=>p().relics[a.id].owned).length,memories=HEROES.filter(h=>memoryOpen(h.id)).length+p().study.library.unlocked.length;
  const tabs=[['hero','동료',`${owned}/${HEROES.length}`],['relic','유물',`${relics}/${ARTIFACTS.length}`],['album','기억',`${memories}/${HEROES.length+CONSTELLATIONS.length}`]];
  return `<section class="book">
    <div class="tabbar">${tabs.map(([id,name,count])=>`<button data-collection="${id}" aria-pressed="${collection===id}"><b>${name}</b><small>${count}</small></button>`).join('')}</div>
    ${collection==='album'?albumView():collection==='relic'?relicView():heroView()}</section>`;
}
function rarityFilter(list,table){
  return `<div class="rare-filter">${RARITIES.map(r=>{const all=list.filter(x=>x.rarity===r),have=all.filter(x=>table[x.id].owned).length;return `<button data-filter="${r}" data-rarity="${r}" aria-pressed="${rarity===r}">${badge(r)}<span>${have}/${all.length}</span>${have===all.length?`<i class="done">${icon('check')}</i>`:''}</button>`;}).join('')}</div>`;
}
function heroView(){
  const list=HEROES.filter(h=>rarity==='all'||h.rarity===rarity).sort((a,b)=>Number(p().heroes[b.id].owned)-Number(p().heroes[a.id].owned)||RARITIES.indexOf(b.rarity)-RARITIES.indexOf(a.rarity));
  return `${rarityFilter(HEROES,p().heroes)}<div class="cards">${list.map(h=>bookCard(h.id)).join('')}</div>`;
}
function relicView(){
  const worn=p().equipped,bonus=collectionBonus(p().relics),list=ARTIFACTS.filter(a=>rarity==='all'||a.rarity===rarity).sort((a,b)=>Number(p().relics[b.id].owned)-Number(p().relics[a.id].owned)||RARITIES.indexOf(b.rarity)-RARITIES.indexOf(a.rarity));
  return `<div class="relic-top"><div class="equip-row">${[0,1,2].map(i=>{const id=worn[i];return id?`<button class="equip-slot filled" data-relic="${id}" data-rarity="${ARTIFACT[id].rarity}">${image(id)}<small>${ARTIFACT[id].name}</small></button>`:`<span class="equip-slot">${icon('plus')}<small>빈 칸</small></span>`;}).join('')}</div>
    <button class="relic-bonus" data-action="relic-info"><small>수집 보너스</small><b>+${(bonus*100).toFixed(1)}%</b><span>모든 동료 위력 ${icon('info')}</span></button></div>
    ${rarityFilter(ARTIFACTS,p().relics)}<div class="cards relics">${list.map(a=>relicCard(a.id)).join('')}</div>`;
}
function relicInfo(){
  const relics=p().relics,points=collectionPoints(relics);
  show('유물 수집 보너스','유물',`<div class="info-hero"><b>+${(collectionBonus(relics)*100).toFixed(1)}%</b><span>모든 동료 위력 · 장착하지 않아도 적용</span></div>
    <ul class="notes"><li>유물을 모으고 레벨을 올릴수록 보너스가 커져요.</li><li>높은 등급일수록 많이 올라요.</li><li>장착한 3개는 고유 효과도 원정에 더해요.</li></ul>
    <details class="more"><summary>계산 방식</summary><p>유물 1개의 점수 = 등급 가중(C ${COLLECTION_WEIGHT.C} · R ${COLLECTION_WEIGHT.R} · SR ${COLLECTION_WEIGHT.SR} · UR ${COLLECTION_WEIGHT.UR}) × (레벨 + ${COLLECTION_OWN_BONUS}). 전체 ${fmt(points)}점, ${COLLECTION_POINTS_PER_PERCENT}점마다 +1%.</p></details>`,`<button class="primary wide" data-action="close">확인</button>`,'info');
}
// Album: memories (bond ten) and the star-library paintings, each in a frame of its own shape.
function albumView(){
  const open=HEROES.filter(h=>memoryOpen(h.id)).length,arts=p().study.library.unlocked.length;
  const tiles=[...HEROES].sort((a,b)=>Number(memoryOpen(b.id))-Number(memoryOpen(a.id))||p().heroes[b.id].bond-p().heroes[a.id].bond).map(h=>{const e=p().heroes[h.id],on=memoryOpen(h.id),thumb=window.__MEMORIAL_THUMBS__?.[h.id];
    return `<button class="mem-tile ${on?'open':''}" data-memorial="${h.id}" aria-label="${h.name} · ${on?escapeText(MEMORIAL_STORIES[h.id].title):`호감도 ${e.bond}/10`}">${on&&thumb?`<img src="${thumb}" alt="" draggable="false" loading="lazy">`:`<span class="mem-shade">${image(h.id)}</span>`}<span class="mem-cap">${on?`<b>${h.name}</b>`:`<span class="bond-hearts" aria-hidden="true">${heartsOf(e.owned?e.bond:0)}</span>`}</span></button>`;}).join('');
  return `<div class="album-sec"><div class="album-head"><h3>인연의 기억</h3><span>${open}/${HEROES.length}</span></div><p class="album-note">호감도 10이 되면 그 동료와의 그림과 이야기가 열려요.</p><div class="mem-grid">${tiles}</div></div>
    <div class="album-sec"><div class="album-head"><h3>별자리 그림</h3><span>${arts}/${CONSTELLATIONS.length}</span></div><p class="album-note">루미의 별의 서재에서 별자리를 완성하면 걸려요.</p>${frameWall(true)}</div>`;
}

// ───────── Companion and relic sheets ─────────
// What a player checks: art, power, how to grow, what the companion does. Numbers in depth sit behind "능력치 자세히".
function heroDetail(id){
  const h=HERO[id],e=p().heroes[id];if(!h)return;
  const beds=p().beds,mult=heroMultiplier(e,beds),need=duplicateCost(e.enhance),ready=e.owned&&e.copies>=need&&!p().active,isAway=away(p(),id),scaled=E.scaledTokens(id,e.owned?specialMultiplier(e.enhance):1),story=MEMORIAL_STORIES[id];
  show(h.name,h.title,`<div class="hd-stage" data-rarity="${h.rarity}"><span class="hd-rays" aria-hidden="true"></span><div class="hd-art">${image(id,true)}</div>
      <div class="hd-meta">${badge(h.rarity)}<span class="hd-roles">${h.role.split(' · ').map(r=>`<i>${r}</i>`).join('')}</span>${e.owned?`<div class="hd-power"><small>전투력</small><b>${cpOf(id)}</b></div>`:`<p class="hd-get">${h.hidden?guardianNote(h.id):'일반 소환에서 만날 수 있어요'}</p>`}</div></div>
    ${e.owned?`<div class="hd-grow ${ready?'ready':''}"><div class="hd-grow-top"><b>강화 +${e.enhance}</b>${icon('chevron')}<b class="next">+${e.enhance+1}</b><small>중복 ${fmt(e.copies)}/${fmt(need)}</small></div><div class="progress"><span style="width:${Math.min(100,e.copies/need*100)}%"></span></div><button class="${ready?'primary shine':'secondary'}" data-enhance="${id}" ${ready?'':'disabled'}>강화</button></div>`:''}
    <div class="hd-skill"><span class="hd-tag">필살기 · 별빛 ${h.skill.type==='starfall'?`${h.skill.cost}+`:h.skill.cost}</span><h3>${h.skill.name}</h3><p>${liveText(h.skill.text,scaled.skill)}</p></div>
    <div class="hd-skill trait"><span class="hd-tag">특성</span><p>${liveText(h.trait.text,scaled.trait)}</p></div>
    ${e.owned?`<button class="bond-row" data-action="bond" data-id="${id}"><span class="bond-hearts" aria-hidden="true">${heartsOf(e.bond)}</span><span><small>호감도 ${e.bond}</small><strong>${escapeText(story.title)}</strong></span>${icon('chevron')}</button>`:''}
    <details class="more"><summary>능력치 자세히</summary><div class="stat-line"><span><small>위력</small><b>${e.owned?(h.damage*mult*(1+collectionBonus(p().relics))).toFixed(1):h.damage}</b></span><span><small>공격 주기</small><b>${(h.interval+E.ATTACK_WINDUP).toFixed(2)}초</b></span><span><small>사거리</small><b>${h.range}</b></span><span><small>공격</small><b>${SHAPE_TEXT[h.shape]||h.shape}</b></span></div>${e.owned?powerBreakdown(id):''}
      <p class="fineprint">강화마다 기본 위력 +5%, 5단계마다 색으로 표시된 수치 +10%. 전투 중에는 성급·훈련·오라·유물 효과가 더해져요.</p></details>`,
    e.owned?`<div class="dialog-buttons"><button class="secondary" data-set-partner="${id}" ${p().partner===id?'disabled':''}>${p().partner===id?'지금 파트너':'파트너로'}</button><button class="primary" data-action="team" ${isAway?'disabled':''}>${isAway?'파견 중':'편성'}</button></div>`:`<button class="primary wide" data-action="go-summon">소환하러 가기</button>`,'hero',id);
}
function powerBreakdown(id){
  const h=HERO[id],e=p().heroes[id],beds=p().beds,bonus=collectionBonus(p().relics),enh=enhanceMultiplier(e.enhance),rose=1+roseAttack(beds.rose);
  const row=(label,value)=>`<div class="pb-row"><span>${label}</span><em>${value}</em></div>`;
  return `<div class="power-break">${row('기본 위력',h.damage)}${row(`강화 +${e.enhance}`,`×${enh.toFixed(2)}`)}${row(`용기의 장미 Lv.${beds.rose}`,`×${rose.toFixed(2)}`)}${row('유물 수집 보너스',`×${(1+bonus).toFixed(3)}`)}<div class="pb-row total"><span>원정 시작 위력</span><b>${(h.damage*enh*rose*(1+bonus)).toFixed(1)}</b></div></div>`;
}
function relicDetail(id){
  const a=ARTIFACT[id],e=p().relics[id],L=e.owned?relicLevel(e):1,equipped=p().equipped.includes(id);
  const now=relicTokens(id,L),next=relicTokens(id,L+1),cost=relicCost(a.rarity,e.enhance),ready=e.owned&&e.copies>=cost&&!p().active;
  show(a.name,'유물',`<div class="hd-stage relic" data-rarity="${a.rarity}"><span class="hd-rays" aria-hidden="true"></span><div class="hd-art">${image(id)}</div><div class="hd-meta">${badge(a.rarity)}${e.owned?`<div class="hd-power"><small>레벨</small><b>Lv.${L}</b></div>${equipped?'<span class="hd-worn">장착 중</span>':''}`:'<p class="hd-get">유물 소환에서 얻을 수 있어요</p>'}</div></div>
    <div class="hd-skill"><span class="hd-tag">장착 효과</span><p>${relicText(id,L)}</p>${e.owned&&now.length?`<small class="next-line">Lv.${L+1} · ${now.map(([,v],i)=>`${escapeText(v)} → <em class="scaled">${escapeText(next[i][1])}</em>`).join(' · ')}</small>`:''}</div>
    ${e.owned?`<div class="hd-grow ${ready?'ready':''}"><div class="hd-grow-top"><b>Lv.${L}</b>${icon('chevron')}<b class="next">Lv.${L+1}</b><small>중복 ${e.copies}/${cost}</small></div><div class="progress"><span style="width:${Math.min(100,e.copies/cost*100)}%"></span></div><button class="${ready?'primary shine':'secondary'}" data-enhance-relic="${id}" ${ready?'':'disabled'}>강화</button></div>`:''}`,
    e.owned?`<button class="primary wide" data-equip="${id}" ${p().active||(!equipped&&p().equipped.length>=3)?'disabled':''}>${equipped?'장착 해제':p().equipped.length>=3?'장착 칸이 가득 찼어요':'장착'}</button>`:`<button class="primary wide" data-action="go-relic-summon">유물 소환하러 가기</button>`,'relic',id);
}

// ───────── Memories ─────────
// The painting fills the screen first; the story opens over it on request and remembers where reading stopped.
function openMemorial(id){
  const story=MEMORIAL_STORIES[id],e=p().heroes[id],h=HERO[id];if(!story||!e||!h)return;
  if(!memoryOpen(id)){
    show(h.name,'아직 열리지 않은 기억',`<div class="mem-locked">${image(id,true)}<h3>${escapeText(story.title)}</h3><span class="bond-hearts big" aria-hidden="true">${heartsOf(e.owned?e.bond:0)}</span><p>${e.owned?`호감도 ${story.unlockBond}에서 함께한 순간이 열려요. 지금 ${e.bond}`:'먼저 이 동료를 만나 주세요.'}</p></div>`,
      e.owned?`<button class="primary wide" data-action="bond" data-id="${id}">선물하러 가기</button>`:'<button class="secondary wide" data-action="close">닫기</button>','memorial-locked',id);return;
  }
  show(h.name,story.title,`<div class="mv"><div class="mv-art" id="memory-art" aria-busy="true"><div class="memory-loading" id="memory-loading" role="status">기억을 펼치는 중…</div></div>
      <div class="mv-story" id="memory-narrative"><div class="memory-reading-progress"><span id="memory-progress">0%</span><i id="memory-progress-fill"></i></div><div class="memory-text" id="memory-text" tabindex="0">${story.paragraphs.map(t=>`<p${/^["“]/.test(t)?' class="dialogue"':''}>${escapeText(t)}</p>`).join('')}</div></div></div>`,
    `<div class="mv-controls"><button class="secondary" data-action="memorial-story" aria-pressed="false">${icon('book')}<span>이야기</span></button><button class="secondary" data-lobby="${id}" aria-pressed="${p().lobby===id}">${icon('home')}<span>${p().lobby===id?'로비에서 내리기':'로비에 걸기'}</span></button><button class="primary" data-action="close">닫기</button></div>`,'memorial',id);
  memorialHero=id;memorialPage=p().memories[id]?.page||0;bindMemorialScroll();
  const generation=memorialGeneration,img=new Image();memorialImage=img;img.dataset.memorial='1';img.decoding='async';img.width=720;img.height=1080;img.alt=`${h.name} · ${story.title}`;
  const src=window.__MEMORIAL_MEDIA__?.[id];if(!src){$('memory-loading').textContent='그림을 불러올 수 없습니다.';$('memory-art').setAttribute('aria-busy','false');return;}
  img.src=src;
  (async()=>{
    try{try{await img.decode();}catch(error){if(generation!==memorialGeneration||modal!=='memorial')return;const fallback=window.__MEMORIAL_FALLBACK__?.[id];if(!fallback)throw error;img.src=fallback;await img.decode();}
      if(generation!==memorialGeneration||modal!=='memorial'||memorialHero!==id)return;$('memory-art').replaceChildren(img);$('memory-art').setAttribute('aria-busy','false');
    }catch{if(generation!==memorialGeneration||modal!=='memorial')return;$('memory-loading').textContent='그림을 불러오지 못했습니다.';$('memory-art').setAttribute('aria-busy','false');}
  })();
}
function bindMemorialScroll(){
  const story=MEMORIAL_STORIES[memorialHero],text=$('memory-text');if(!story||!text||modal!=='memorial')return;
  const last=story.paragraphs.length-1,update=()=>{
    const max=text.scrollHeight-text.clientHeight,ratio=max<=1?1:Math.min(1,text.scrollTop/max),page=Math.round(ratio*last);
    memorialPage=page;$('memory-progress').textContent=`${Math.round(ratio*100)}%`;$('memory-progress-fill').style.width=`${ratio*100}%`;
    if(p().memories[memorialHero]?.page!==page)act('memory',{id:memorialHero,page},false);
  };
  text.addEventListener('scroll',update,{passive:true});
  // Restore the reading position the first time the story panel opens (it has no size while hidden).
  text.dataset.restore=String(memorialPage);
}
function toggleStory(button){
  const sheet=$('sheet'),on=!sheet.classList.contains('mv-reading');sheet.classList.toggle('mv-reading',on);button.setAttribute('aria-pressed',String(on));
  const text=$('memory-text'),story=MEMORIAL_STORIES[memorialHero];
  if(on&&text&&text.dataset.restore){const page=Number(text.dataset.restore),last=story.paragraphs.length-1;delete text.dataset.restore;requestAnimationFrame(()=>{if(page>0&&last>0)text.scrollTop=(text.scrollHeight-text.clientHeight)*page/last;text.dispatchEvent(new Event('scroll'));});}
}

// ───────── Adventure ─────────
const CHAPTER_NAMES=['달빛 정원','별무리 숲','은하 사원','시간의 탑','창조의 끝'];
function adventure(){
  const tabs=[['main','메인'],['weekly','주간 드래프트'],['monthly','월간 보스전']];
  return `<section class="adv"><div class="tabbar">${tabs.map(([id,name])=>`<button data-mode="${id}" aria-pressed="${mode===id}"><b>${name}</b></button>`).join('')}</div>${mode==='main'?mainStages():modeCard(mode)}</section>`;
}
function mainStages(){
  const profile=p(),next=Math.min(45,profile.cleared+1);cycle=Math.min(4,Math.max(0,cycle));
  const groups=Array.from({length:5},(_,i)=>{const cleared=Math.max(0,Math.min(9,profile.cleared-i*9)),open=i*9<=profile.cleared;return `<button class="chap ${cleared===9?'done':''}" data-cycle="${i}" aria-pressed="${cycle===i}" ${open?'':'disabled'}><b>${i+1}장</b><small>${open?`${cleared}/9`:icon('lock')}</small></button>`;}).join('');
  const rows=CHAPTERS.slice(cycle*9,cycle*9+9).map(c=>{const done=c.stage<=profile.cleared,cur=c.stage===next,lock=c.stage>profile.cleared+1;
    return `<button class="stage ${cur?'current':''} ${done?'done':''}" data-prepare-stage="${c.stage}" ${lock?'disabled':''}><span class="stage-no">${stageLabel(c.stage)}</span><span class="stage-info"><strong>${BOSSES[c.bosses[0]].name}</strong><small>${c.name}</small></span><span class="stage-state">${done?icon('check'):cur?'<b>도전</b>':icon('lock')}</span></button>`;}).join('');
  return `<div class="chap-tabs">${groups}</div><div class="chap-head"><b>${cycle+1}장 · ${CHAPTER_NAMES[cycle]}</b><button class="link" data-action="records">기록</button></div><div class="stage-list">${rows}</div>`;
}
// Tier picker shared by both challenges: locked tiers show their stage requirement.
function tierPicker(kind,withAction=true){
  const cleared=p().cleared;if(!TIERS[challengeTier]||cleared<TIERS[challengeTier].unlock)challengeTier='easy';
  return `<div class="tier-picker" role="radiogroup" aria-label="난이도">${TIER_IDS.map(id=>{const t=TIERS[id],open=cleared>=t.unlock,on=challengeTier===id;return `<button class="tier ${id}" ${withAction?`data-tier="${id}"`:''} role="radio" aria-checked="${on}" ${open?'':'disabled'}><b>${t.name}</b><small>${open?`보상 ×${t.reward}`:`${icon('lock')}${t.unlock}`}</small></button>`;}).join('')}</div>`;
}
function modeCard(kind){
  const profile=p(),unlocked=profile.cleared>=3,t=TIERS[challengeTier]||TIERS.easy;
  if(kind==='monthly'){
    const record=currentRecord(profile,now()),claimed=profile.monthly===calendar(now()).month;
    return `<div class="mode monthly"><div class="mode-top"><span class="mode-tag">${monthNo(calendar(now()))} · 입장 무제한</span><button class="info-btn" data-action="mode-info" data-kind="monthly" aria-label="규칙">${icon('info')}</button></div>
      <h2>월간 보스전</h2><p>${CHALLENGE_WAVES}연전으로 이어지는 보스와 싸워 이번 달 최고 기록을 남겨요.</p>${tierPicker('monthly')}
      <div class="mode-record"><div><small>이번 달 최고</small><b>${record?`${record.round}<em>/${CHALLENGE_WAVES}</em>`:'—'}</b>${record?`<span>${tierName(record)}</span>`:''}</div>${claimed?`<span class="mode-claimed">${icon('check')}보상 받음</span>`:record?`<button class="secondary" data-action="monthly-claim">${gem(monthlyReward(record))}<span>받기</span></button>`:`<span class="mode-hint">완주 ${gem(monthlyReward({round:CHALLENGE_WAVES,tier:challengeTier}))}</span>`}</div>
      <button class="primary wide shine" data-action="prepare-mode" ${!unlocked||profile.active?'disabled':''}>${!unlocked?'스테이지 3 클리어 후 열려요':`${t.name} 도전`}</button></div>`;
  }
  const used=profile.weekly===calendar(now()).week;
  return `<div class="mode weekly"><div class="mode-top"><span class="mode-tag">주 1회 · 월요일 초기화</span><button class="info-btn" data-action="mode-info" data-kind="weekly" aria-label="규칙">${icon('info')}</button></div>
    <h2>주간 드래프트</h2><p>둘 중 한 명을 ${TEAM_SIZE}번 골라 팀을 꾸리고 ${CHALLENGE_WAVES}웨이브를 넘어요.</p>${tierPicker('weekly')}
    <div class="boss-route">${weeklyBosses().map((id,i)=>`<span><em>${(i+1)*3}</em>${BOSSES[id].name.replace('의 여신 ','의 ')}</span>`).join('')}</div>
    <div class="mode-record"><div><small>완주 보상</small><b>${gem(weeklyReward(challengeTier,CHALLENGE_WAVES,true))}</b></div><span class="mode-hint">${used?'이번 주 입장 완료':'이번 주 1회 남음'}</span></div>
    <button class="primary wide shine" data-action="prepare-mode" ${!unlocked||used||profile.active?'disabled':''}>${!unlocked?'스테이지 3 클리어 후 열려요':used?'다음 주에 다시 열려요':`${t.name} 드래프트 시작`}</button></div>`;
}
function modeInfo(kind){
  const t=TIERS[challengeTier]||TIERS.easy;
  const weekly=`<ul class="notes"><li>생명력이 0이 되면 끝나고, 넘긴 웨이브만큼 보상을 받아요. 웨이브당 ${gem(Math.round(25*t.reward))}.</li><li>3웨이브마다 이번 주의 보스가 나와요.${metBosses(p())<9?` 메인 스테이지에서 만난 보스 ${metBosses(p())}종만 나와요.`:''}</li><li>어려움은 스테이지 ${TIERS.hard.unlock}, 심연은 스테이지 ${TIERS.abyss.unlock} 클리어 후 열려요.</li><li>중단해도 같은 입장으로 이어할 수 있어요. 파견 중인 동료는 참여할 수 없어요.</li><li>기간은 한국·일본 시간(UTC+9) 기준이에요.</li></ul>`;
  const monthly=`<ul class="notes"><li>제한 시간은 없고, 보스가 코어에 닿으면 끝나요.</li><li>난이도가 높을수록, 같은 난이도에서는 격파 수와 총 피해가 클수록 좋은 기록이에요.</li><li>보상은 꿈의결정 100 + 격파 보스당 35, 완주 시 +150에 난이도 배율(×${t.reward})을 곱해요. 한 달에 한 번, 원하는 때에 확정해요.</li><li>매월 1일(UTC+9) 초기화되고 역대 최고 기록은 남아요.</li></ul>${monthlyRecordPanel()}`;
  show(kind==='weekly'?'주간 드래프트':'월간 보스전','규칙',kind==='weekly'?weekly:monthly,`<button class="primary wide" data-action="close">확인</button>`,'info');
}
function prepare(stage=Math.min(45,p().cleared+1),kind='main'){
  if(p().active){toast('진행 중인 원정이 있어요. 먼저 이어하세요.');return;}
  const c=CHAPTERS[stage-1],boss=BOSSES[c.bosses[0]],t=TIERS[challengeTier]||TIERS.easy;
  const head=kind==='main'?`<div class="prep-boss"><small>${c.name} · 6웨이브</small><h2>${boss.name}</h2>${boss.trait?`<p>${boss.trait}</p>`:''}<span class="prep-reward">${stage>p().cleared?`첫 클리어 ${gem(160+10*stage)}`:'반복 클리어 · 별가루'}</span></div>`
    :`<div class="prep-boss"><small>${t.name}</small><h2>${kind==='weekly'?'주간 드래프트':'월간 보스전'}</h2><p>${kind==='weekly'?`보유 동료 중에서 ${TEAM_SIZE}명을 골라요.`:`${CHALLENGE_WAVES}연전`}</p></div>`;
  show(kind==='main'?`스테이지 ${stageLabel(stage)}`:kind==='weekly'?'주간 드래프트':'월간 보스전','출격 준비',`${head}
    ${kind==='weekly'?'':`<div class="panel-head"><h3>출전 팀</h3><span class="power">전투력 <b>${fmt(teamPower(p()))}</b></span></div>${five(p().deck)}`}
    <div class="panel-head"><h3>장착 유물</h3><button class="link" data-action="go-relics">변경</button></div>${relicSlots(true)}`,
    `<div class="dialog-buttons">${kind==='weekly'?'':'<button class="secondary" data-action="team">편성</button>'}<button class="primary shine" data-begin="${kind}" data-stage="${stage}" ${p().deck.length!==TEAM_SIZE?'disabled':''}>${kind==='main'?'출격':'입장'}</button></div>`,'prepare',{stage,kind});
}

// ───────── Summon ─────────
// Banner art first; two buttons at the thumb. The daily free summon is the 1-pull itself; pity is an exchange gauge.
function renderSummon(){
  const c=calendar(now()),featured=banner==='season'?c.guardian:banner==='relic'?'broken_clock':c.pickup,cost=banner==='relic'?T.relicDrawCost:T.heroDrawCost,dreams=p().dreams,free=banner==='normal'&&!todayDaily().free;
  const copy={normal:{tag:'이번 주 픽업',title:HERO[c.pickup].name,desc:'UR이 나오면 절반은 이번 주 픽업이에요.'},
    season:{tag:`${monthNo(c)} 한정`,title:HERO[c.guardian].name,desc:'이달의 수호자는 이 소환에서만 만나요.'},
    relic:{tag:'유물',title:'유물 소환',desc:'많이 소환할수록 높은 등급이 잘 나와요.'}}[banner];
  return `<section class="sm" data-banner="${banner}">
    <div class="tabbar sm-tabs">${[['normal','일반'],['season','시즌'],['relic','유물']].map(([id,name])=>`<button data-banner="${id}" aria-pressed="${banner===id}"><b>${name}</b>${id==='normal'&&!todayDaily().free?'<i class="dot"></i>':''}</button>`).join('')}</div>
    <div class="sm-stage"><span class="sm-halo" aria-hidden="true"></span>${image(featured,banner!=='relic','sm-figure')}
      <div class="sm-copy"><span class="sm-tag">${copy.tag}</span><h2>${copy.title}</h2><p>${copy.desc}</p></div>
      <div class="sm-tools"><button class="sm-tool" data-action="rates">${icon('info')}<span>확률</span></button><button class="sm-tool" data-action="history">${icon('clock')}<span>기록</span></button></div>
      ${banner==='relic'?relicTierChip():pityChip()}</div>
    <div class="sm-actions"><button class="secondary sm-one" data-draw="1">${free?`<b>무료 소환</b><small>오늘 1회</small>`:`<b>1회 소환</b>${gem(cost,dreams<cost)}`}</button><button class="primary shine sm-ten" data-draw="10"><b>10회 소환</b>${gem(cost*10,dreams<cost*10)}${banner==='relic'?'':'<small class="sm-boost">퀴즈 정답 시 UR 2배</small>'}</button></div></section>`;
}
function pityChip(){
  const n=p().pity[banner],max=T.pity[banner],full=n>=max;
  return `<button class="pity-chip ${full?'full':''}" data-action="pity" aria-label="교환 ${n}/${max}"><span class="pity-ring" style="--p:${Math.min(1,n/max).toFixed(3)}">${icon('star')}</span><span><small>${full?'교환할 수 있어요':'교환'}</small><b>${Math.min(n,max)}<em>/${max}</em></b></span></button>`;
}
function relicTierChip(){
  const draws=p().relicDraws,tier=relicTier(draws),from=relicThreshold(tier),to=relicThreshold(tier+1);
  return `<button class="pity-chip" data-action="rates" aria-label="유물 단계 ${tier}"><span class="pity-ring" style="--p:${((draws-from)/(to-from)).toFixed(3)}"><b class="pity-tier">${tier}</b></span><span><small>유물 단계</small><b>${fmt(to-draws)}<em>회 남음</em></b></span></button>`;
}
let pityPick=null;
function pitySheet(){
  const which=banner==='relic'?'normal':banner,n=p().pity[which],max=T.pity[which],c=calendar(now()),pool=which==='season'?[c.guardian]:[c.pickup,...ROSTER.UR.filter(id=>id!==c.pickup)];
  if(!pool.includes(pityPick))pityPick=pool[0];const full=n>=max;
  show('교환',which==='season'?'시즌 소환':'일반 소환',`<div class="pity-meter"><span class="pity-ring big" style="--p:${Math.min(1,n/max).toFixed(3)}">${icon('star')}</span><div><b>${n}<em>/${max}</em></b><p>유료 소환 1회마다 1이 쌓여요. ${max}가 되면 원하는 동료 한 명을 데려올 수 있어요. UR이 나와도 줄지 않아요.</p></div></div>
    <div class="pity-pool">${pool.map(id=>`<button class="pity-pick ${pityPick===id?'on':''}" data-pity-pick="${id}" data-rarity="UR">${image(id)}<b>${HERO[id].name}</b>${id===c.pickup&&which==='normal'?'<small>이번 주 픽업</small>':''}${p().heroes[id].owned?`<small class="have">보유 +${p().heroes[id].enhance}</small>`:''}</button>`).join('')}</div>`,
    `<button class="primary wide shine" data-action="pity-claim" ${full?'':'disabled'}>${full?`${HERO[pityPick].name} 데려오기`:`${max-n}회 더 소환하면 교환할 수 있어요`}</button>`,'pity');
}
function claimPity(){
  const which=banner==='relic'?'normal':banner,result=act('pityClaim',{banner:which,id:pityPick},false);if(!result.ok){toast(result.message);return;}
  render();bonusItems=null;reveal([result.item],{count:1,cost:0});
}
function rates(){
  const c=calendar(now()),list=banner==='relic'?relicRates(p().relicDraws):T.heroRates;
  let rows=RARITIES.map((r,i)=>`<div class="rate-row"><span>${badge(r)} ${RARITY[r].name}</span><b>${pct(list[i])}</b></div>`).join('');
  if(banner==='season'){const half=(T.heroRates[3]/2*100).toFixed(3)+"%";rows+=`<div class="rate-row"><span>UR · ${HERO[c.guardian].name}</span><b>${half}</b></div><div class="rate-row"><span>일반 UR 6종 합계</span><b>${half}</b></div>`;}
  if(banner==='normal')rows+=`<div class="rate-row"><span>UR · 픽업 ${HERO[c.pickup].name}</span><b>${pct(T.heroRates[3]*.5+T.heroRates[3]*.5/6)}</b></div><div class="rate-row"><span>UR · 나머지 5종 각각</span><b>${pct(T.heroRates[3]*.5/6)}</b></div>`;
  show('소환 확률',banner==='relic'?`유물 ${relicTier(p().relicDraws)}단계`:banner==='season'?'시즌':'일반',`${rows}
    <ul class="notes">${banner==='relic'?`<li>누적 ${fmt(p().relicDraws)}회. 단계가 오를수록 높은 등급 확률이 올라가고, 10회 중 단계가 오르면 다음 1회부터 적용돼요.</li>`
      :`<li>${banner==='season'?'UR의 절반은 이달의 수호자예요. 다른 달 수호자는 나오지 않아요.':'UR의 절반은 이번 주 픽업, 절반은 일반 UR 6종(픽업 포함) 중 하나예요. 픽업은 매주 월요일에 바뀌어요.'}</li><li>교환: 유료 소환 ${T.pity[banner]}회마다 ${banner==='season'?'이달의 수호자':'일반 UR 6종 중 원하는 한 명'}을(를) 데려올 수 있어요. UR이 나와도 초기화되지 않고 시즌이 바뀌어도 이어져요.</li><li>10회 소환 전 별빛 퀴즈를 맞히면 그 10회의 UR 확률이 2배가 돼요. 가끔 행운이 찾아올 수도 있어요.</li>`}<li>1회와 10회의 확률은 같아요. 중복은 강화 재료가 돼요.</li></ul>
    <details class="more"><summary>얻을 수 있는 대상</summary>${(banner==='relic'?ARTIFACTS:HEROES.filter(h=>!h.hidden||banner==='season'&&h.id===c.guardian)).map(h=>`<div class="rate-row"><span>${h.name}</span>${badge(h.rarity)}</div>`).join('')}</details>`,`<button class="primary wide" data-action="close">확인</button>`,'rates');
}

// ───────── Garden: greenhouse, dispatch, gift basket ─────────
function renderGarden(){
  return `<section class="gd"><div class="gd-house">${bedRow()}${bedPanel(bedFocus)}</div>
    <div class="gd-sec" id="dispatch-sec">${dispatchMarkup()}</div>
    <div class="gd-sec basket-sec" id="basket-sec">${basketMarkup()}</div></section>`;
}
function bedRow(){
  const profile=p();
  return `<div class="bed-row">${BED_IDS.map(id=>{const u=BED_UI[id],unlocked=bedOpen(id,profile.cleared),lv=profile.beds[id];
    return `<button class="bed ${bedFocus===id?'focus':''} ${unlocked?'':'locked'}" data-bed="${id}" style="--bed-row:${u.row};--bed-stage:${bedStage(id,lv)};--bed-color:${u.color};order:${u.order}" aria-pressed="${bedFocus===id}"><span class="bed-art"></span>${unlocked?`<span class="bed-level">Lv.${lv}</span>`:`<span class="bed-lock">${icon('lock')}</span>`}${bedReady(profile,id)?'<i class="dot"></i>':''}<b class="bed-name">${u.name}</b><small class="bed-sub">${unlocked?`${u.effect} ${u.value(lv)}`:`스테이지 ${T.beds[id].unlock}`}</small></button>`;}).join('')}</div>`;
}
function bedPanel(id){
  const profile=p(),u=BED_UI[id],lv=profile.beds[id],unlocked=bedOpen(id,profile.cleared),cost=bedCost(id,lv);
  return `<div class="bed-panel" style="--bed-color:${u.color}"><div class="bed-panel-info"><small>${u.effect}</small><b>${unlocked?`${u.value(lv)} ${icon('chevron')} <em>${u.value(lv+1)}</em>`:'잠김'}</b></div>
    <button class="primary bed-grow ${bedReady(profile,id)?'shine':''}" data-bed-grow="${id}" ${bedReady(profile,id)?'':'disabled'}>${unlocked?`${icon('drop')}<b>물 주기</b><span class="cost dust">${icon('dust')}<b>${fmt(cost)}</b></span>`:`${icon('lock')}<b>스테이지 ${T.beds[id].unlock}</b>`}</button></div>`;
}
function refreshGarden(){
  if(screen!=='garden')return;const house=document.querySelector('.gd-house');if(house)house.innerHTML=bedRow()+bedPanel(bedFocus);
  const d=$('dispatch-sec');if(d)d.innerHTML=dispatchMarkup();const b=$('basket-sec');if(b)b.innerHTML=basketMarkup();navDots();
}
function growBed(id){
  const before=bedStage(id,p().beds[id]),result=act('bed',{id},false);if(!result.ok){toast(result.message);return false;}
  const house=document.querySelector('.gd-house');if(house){const row=house.querySelector('.bed-row');for(const node of row.querySelectorAll('.bed[data-bed]')){const k=node.dataset.bed,u=BED_UI[k],lv=p().beds[k];node.style.setProperty('--bed-stage',bedStage(k,lv));const level=node.querySelector('.bed-level');if(level)level.textContent=`Lv.${lv}`;const sub=node.querySelector('.bed-sub');if(sub&&bedOpen(k,p().cleared))sub.textContent=`${u.effect} ${u.value(lv)}`;const ready=bedReady(p(),k),dot=node.querySelector('.dot');if(ready&&!dot)node.insertAdjacentHTML('beforeend','<i class="dot"></i>');else if(!ready&&dot)dot.remove();}
    const panel=house.querySelector('.bed-panel');if(panel)panel.outerHTML=bedPanel(bedFocus);}
  const art=document.querySelector(`.bed[data-bed="${id}"] .bed-art`);if(!art)return true;
  const c=centerOf(art),stage=bedStage(id,result.level),u=BED_UI[id];art.classList.remove('grow');void art.offsetWidth;art.classList.add('grow');
  floatText(c.x,c.y-30,`Lv.${result.level}`,u.color);
  if(stage>before){burst(c.x,c.y,{count:18,spread:100,size:12,color:u.color});sound.reveal?.(stage>=2);}else burst(c.x,c.y-10,{count:5,spread:40,size:8,color:u.color});
  return true;
}
function dispatchMarkup(){
  const profile=p(),count=dispatchSlots(profile.cleared),d=todayDaily(),running=profile.dispatches.some(x=>x.end>now()),ready=profile.dispatches.filter(x=>x.end<=now()).length;
  const tiles=Array.from({length:4},(_,slot)=>{const x=profile.dispatches.find(y=>y.slot===slot);
    if(slot>=count)return `<button class="slot locked" disabled>${icon('lock')}<small>스테이지 ${9*(slot+1)}</small></button>`;
    if(!x)return `<button class="slot empty" data-dispatch-slot="${slot}" ${profile.active?'disabled':''}>${icon('plus')}<small>보내기</small></button>`;
    const done=x.end<=now(),ratio=Math.min(1,(now()-x.start)/(x.end-x.start));
    return `<button class="slot ${done?'ready':'running'}" data-dispatch-slot="${slot}" data-rarity="${HERO[x.hero].rarity}" ${done&&profile.active?'disabled':''}><span class="slot-ring" style="--p:${ratio.toFixed(3)}">${image(x.hero)}</span><small data-timer="${x.end}">${done?'받기!':timerText(x.end)}</small></button>`;}).join('');
  return `<div class="sec-head"><h3>파견</h3><span class="sec-sub">${count}/4</span><span class="grow"></span><button class="chip-btn" data-action="accel" ${d.accel||!running?'disabled':''}>${icon('clock')}${d.accel?'가속 완료':'−4시간 퀴즈'}</button>${ready>1&&!profile.active?'<button class="chip-btn gold" data-action="claim-all">모두 받기</button>':''}<button class="info-btn" data-action="dispatch-info" aria-label="파견 안내">${icon('info')}</button></div><div class="slot-row">${tiles}</div>`;
}
function dispatchInfo(){
  show('파견','정원',`<ul class="notes"><li>동료 한 명을 ${T.dispatchHours}시간 동안 보내 별가루와 꿈의결정을 모아요. 앱을 닫아도 시간은 흘러요.</li><li>보상은 출발할 때의 전투력과 클리어한 스테이지 수로 정해져요. 지금 보너스 +${p().cleared*5}%.</li><li>파견 중인 동료는 전투에 나갈 수 없어요. 전투에 남을 동료 ${TEAM_SIZE}명은 꼭 남겨야 해요.</li><li>슬롯은 스테이지 9·18·27·36을 클리어하면 하나씩 열려요.</li><li>하루 한 번, 용어 퀴즈를 맞히면 파견 중인 동료가 모두 4시간 빨리 돌아와요.</li></ul>`,`<button class="primary wide" data-action="close">확인</button>`,'info');
}
function dispatchTap(slot){
  const x=p().dispatches.find(y=>y.slot===slot);if(!x){chooseDispatch(slot);return;}
  if(x.end>now()){toast(`${HERO[x.hero].name} · ${timerText(x.end)} 후 귀환 · 별가루 ${fmt(x.dust||0)} · 꿈의결정 ${fmt(x.reward)}`);return;}
  claimDispatches([slot]);
}
function claimDispatches(slots){
  let dust=0,dreams=0;const points=slots.map(s=>{const n=document.querySelector(`[data-dispatch-slot="${s}"]`);return n?centerOf(n):null;});
  for(const slot of slots){const r=act('claimDispatch',{slot},false);if(!r.ok){toast(r.message);break;}dust+=r.dust||0;dreams+=r.reward;}
  points.forEach(c=>{if(c)burst(c.x,c.y,{count:10,spread:60,size:9,color:'#ffe39a'});});
  if(dust||dreams){const c=points.find(Boolean)||{x:innerWidth/2,y:innerHeight/2};floatText(c.x,c.y-30,`${dust?`별가루 +${fmt(dust)} `:''}꿈의결정 +${fmt(dreams)}`,'#ffe39a');}
  refreshGarden();
}
function chooseDispatch(slot){
  const free=available(p()),few=free.length<=TEAM_SIZE;
  show('파견 보내기',`${T.dispatchHours}시간`,`${few?`<p class="empty">전투에 남을 동료 ${TEAM_SIZE}명이 필요해요. 동료를 더 모으면 보낼 수 있어요.</p>`:''}<div class="choose-list">${free.sort((a,b)=>combatPower(b,p().heroes[b],p().beds)-combatPower(a,p().heroes[a],p().beds)).map(id=>`<button class="choose-row" data-send="${id}" data-slot="${slot}" ${few?'disabled':''}>${portrait(id)}<div><strong>${HERO[id].name}${badge(HERO[id].rarity)}</strong><small>전투력 ${cpOf(id)}${p().deck.includes(id)?' · 편성 중':''}</small></div>${dispatchGain(dispatchReward(combatPower(id,p().heroes[id],p().beds),p().cleared))}</button>`).join('')}</div>`,'','dispatch',slot);
}
const hm=ms=>{const m=Math.max(0,Math.ceil(ms/60000));return m>=60?`${Math.floor(m/60)}시간 ${m%60}분`:`${m}분`;};
function basketMarkup(){
  const st=basketState(p(),now());
  return `<div class="basket"><span class="basket-art">${giftArt(GIFT_IDS[st.next])}</span><div class="basket-info"><b>선물 바구니</b><small>${st.full?'가득 찼어요. 받아야 다음 선물이 자라요':`다음 선물까지 ${hm(st.nextIn)}`}</small>
    <div class="basket-slots">${[0,1,2].map(i=>`<i class="${i<st.ready?'on':''}">${i<st.ready?giftArt(GIFT_IDS[(st.next+i)%3],'inline'):''}</i>`).join('')}</div></div>
    <button class="${st.ready?'primary shine':'secondary'}" data-action="basket" ${st.ready?'':'disabled'}>받기</button></div>
    <div class="gift-stock">${GIFT_IDS.map(g=>`<span>${giftArt(g,'inline')}<b>${p().gifts[g]}</b></span>`).join('')}<button class="link" data-action="go-home-gift">파트너에게 주기 ${icon('chevron')}</button></div>`;
}
function claimBasket(button){
  const c=button?centerOf(button):{x:innerWidth/2,y:innerHeight/2},result=act('basket',{},false);if(!result.ok){toast(result.message);return;}
  result.gifts.forEach((g,i)=>setTimeout(()=>{burst(c.x-40+i*40,c.y-10,{count:8,spread:50,size:9,color:GIFTS[g].color});floatText(c.x-40+i*40,c.y-30,`${GIFTS[g].name} +1`,GIFTS[g].color);},i*160));
  refreshGarden();
}

// ───────── Daily missions ─────────
function daily(){
  const d=todayDaily(),left=DAILY_MISSIONS.filter(m=>missionDone(d,m.id)&&!d.claimed.includes(m.id)).length;
  show('일일 임무','매일 00:00 (UTC+9) 초기화',`${DAILY_MISSIONS.map(m=>{const done=missionDone(d,m.id),claimed=d.claimed.includes(m.id),progress=m.goal?`${Math.min(m.goal,d.merges)}/${m.goal}`:done?'1/1':'0/1';
      return `<div class="mission ${claimed?'claimed':done?'ready':''}"><span class="mission-check">${claimed?icon('check'):''}</span><div><strong>${m.name}</strong><small>${progress}</small></div>${gem(m.reward)}<button class="${done&&!claimed?'primary':'secondary'}" data-daily="${m.id}" ${!done||claimed?'disabled':''}>${claimed?'완료':done?'받기':'진행'}</button></div>`;}).join('')}
    <div class="mission bonus ${d.claimed.length===DAILY_MISSIONS.length?'claimed':''}"><span class="mission-check">${d.claimed.length===DAILY_MISSIONS.length?icon('check'):icon('star')}</span><div><strong>모두 완료 보너스</strong><small>${d.claimed.length}/${DAILY_MISSIONS.length}</small></div>${gem(T.dailyBonus)}</div>`,
    left>1?`<button class="primary wide" data-action="daily-all">모두 받기</button>`:`<button class="secondary wide" data-action="close">닫기</button>`,'daily');
}
function claimDaily(ids){let total=0;for(const id of ids){const r=act('daily',{id},false);if(r.ok)total+=r.reward;}if(total)toast(`꿈의결정 +${total}`);refreshLobby();daily();}

// ───────── Study: star quiz (summon), acceleration quiz (dispatch), Rumi's star library ─────────
// Lecture questions guard the 10-pull boost and term questions the daily dispatch acceleration (quiz.js over course.js).
// A question once shown stays held until it is answered, so closing the sheet never rerolls it.
let libraryTab='gallery',quizState=null,justLit=false,tutorAbort=null;
const quizHold={gacha:null,accel:null},tutorCache=new Map(),heard=new Set(),LETTERS='①②③④⑤⑥';
const libraryArt=id=>window.__LIBRARY_MEDIA__?.[id]||LIBRARY_ART[id];
const libraryToday=()=>p().study.library.day===calendar(now()).day;
const libraryDone=()=>p().study.library.index>=CONSTELLATIONS.length;
function litStars(){const l=p().study.library;return CONSTELLATIONS.slice(0,l.index).reduce((n,c)=>n+c.stars.length,0)+(libraryDone()?0:l.stars);}
const libraryDot=()=>!libraryDone()&&!libraryToday()&&p().study.wrong.length>0;
const wrongEntry=(kind,id)=>p().study.wrong.find(w=>w.kind===kind&&w.id===id)||null;
const solved=(kind,id)=>p().study.solved.includes(`${kind}:${id}`);
function tutorPanel(){
  const t=tutorSettings();
  return `<div class="tutor-panel"><strong>루미의 설명 · AI</strong><small>별의 서재에서 틀린 문제를 루미가 자세히 설명해 줘요. Google Gemini API 키가 필요해요.</small>
    <input id="tutor-key" type="password" autocomplete="off" spellcheck="false" placeholder="Gemini API 키 붙여넣기" value="${escapeText(t.key)}" aria-label="Gemini API 키">
    <div class="tutor-row"><select id="tutor-model" aria-label="해설 모델">${TUTOR_MODELS.map(m=>`<option value="${m.id}" ${t.model===m.id?'selected':''}>${m.label}</option>`).join('')}</select><button class="secondary" data-action="tutor-save">저장</button>${t.key?'<button class="secondary" data-action="tutor-clear">지우기</button>':''}</div>
    <p class="fineprint">${t.key?'키가 저장되어 있어요. ':''}키는 이 기기의 브라우저에만 저장되고 백업 파일에는 들어가지 않아요. 설명을 요청하면 문제와 강의 내용이 Google로 전송돼요.</p></div>`;
}
// Shared question markup: choices are buttons until answered, then ✓ marks the answer and ✗ the pick.
function questionBlock(q,chosen=-1,answered=true){
  return `<div class="quiz-q"><div class="quiz-meta"><span class="kind-chip ${q.kind}">${KIND_NAME[q.kind]}</span>${q.source?`<small>${escapeText(q.source)}</small>`:''}</div><p class="quiz-prompt">${escapeText(q.prompt)}</p><div class="quiz-choices">${q.choices.map((c,i)=>{const state=!answered?'':i===q.answer?'right':i===chosen?'wrong':'';
    return `<button class="quiz-choice ${state}" ${answered?'disabled':`data-quiz-choice="${i}"`}><span class="mark">${LETTERS[i]}</span><span class="text">${escapeText(c)}</span>${state==='right'?icon('check'):state==='wrong'?icon('close'):''}</button>`;}).join('')}</div></div>`;
}
const lectureBody=l=>`<p class="lec-core">${escapeText(l.core)}</p><p class="lec-analogy"><b>오늘의 이야기</b> ${escapeText(l.analogy)}</p>${l.body.map(t=>t.startsWith('## ')?`<h4 class="lec-h">${escapeText(t.slice(3))}</h4>`:`<p>${escapeText(t)}</p>`).join('')}
  ${l.principles.length?`<div class="lec-box"><b>루미의 핵심 정리</b><ol>${l.principles.map(t=>`<li>${escapeText(t)}</li>`).join('')}</ol></div>`:''}${l.confusion?`<div class="lec-box warn"><b>헷갈림 주의</b><p>${escapeText(l.confusion)}</p></div>`:''}
  ${l.point?`<div class="lec-box point"><b>시험에선 이렇게 나와</b><p>${escapeText(l.point)}</p></div>`:''}<p class="lec-one"><b>출근길 한 줄</b> ${escapeText(l.oneLine)}</p>`;
const termBody=t=>`<p class="term-ja" lang="ja">${escapeText(t.termJa)}</p>${t.explain.split('\n').map(x=>`<p>${escapeText(x)}</p>`).join('')}${t.hint?`<div class="lec-box point"><b>시험 힌트</b><p>${escapeText(t.hint)}</p></div>`:''}`;
function studyPeek(q){
  if(q.kind==='concept'){const l=lectureById(q.lecture);return l?`<details class="lecture-peek"><summary>관련 강의 · 제${l.no}강 ${escapeText(l.title)}</summary><div class="lecture">${lectureBody(l)}</div></details>`:'';}
  const t=termById(q.term);return t?`<details class="lecture-peek"><summary>용어 카드 · ${escapeText(t.termKo)}</summary><div class="lecture">${termBody(t)}</div></details>`:'';
}
function openQuiz(state){quizState={chosen:-1,score:0,...state};renderQuiz();}
function renderQuiz(){
  const s=quizState,q=s.question,answered=s.chosen>=0,correct=answered&&s.chosen===q.answer,last=!s.queue||s.index>=s.queue.length-1;
  const title={gacha:'별빛 퀴즈',accel:'오늘의 가속',practice:`${KIND_NAME[q.kind]} 문제`}[s.mode];
  const kicker={gacha:'맞히면 이번 10회 소환의 UR 확률 2배',accel:'맞히면 파견 중인 동료가 모두 4시간 빨리 귀환',practice:s.queue?`${s.index+1} / ${s.queue.length}`:COURSE.title}[s.mode];
  const note=s.mode==='accel'&&answered?`<small class="quiz-result">${escapeText(s.result?.message||'')}</small>`:s.mode==='gacha'&&answered&&correct?'<small class="quiz-result">UR 확률 2배! 가끔은 행운이 찾아올 수도 있어요.</small>':s.mode==='practice'&&answered&&last&&s.queue?.length>1?`<small class="quiz-result">${s.queue.length}문제 중 ${s.score}문제를 맞혔어요.</small>`:'';
  const verdict=answered?`<div class="quiz-verdict ${correct?'right':'wrong'}"><b>${correct?'정답이에요!':'아쉬워요'}</b><p>${escapeText(q.explain)}</p>${note}${correct?'':'<small>이 문제는 별의 서재 오답 노트에 담았어요.</small>'}</div>`:'';
  const footer=s.mode==='gacha'?(answered?`<button class="primary wide shine" data-action="quiz-go">${icon('summon')}<b>${correct?'UR 2배로 10회 소환':'10회 소환'}</b></button>`:'<button class="link quiz-skip" data-action="quiz-skip">퀴즈 없이 10회 소환</button>')
    :s.mode==='accel'?`<button class="${answered?'primary':'secondary'} wide" data-action="close">${answered?'확인':'나중에 풀기'}</button>`
    :answered&&!last?'<button class="primary wide" data-action="quiz-next">다음 문제</button>':`<button class="${answered?'primary':'secondary'} wide" data-action="close">${answered?'완료':'닫기'}</button>`;
  show(title,kicker,questionBlock(q,s.chosen,answered)+verdict+studyPeek(q),footer,'quiz',s.mode);
}
function answerQuiz(choice,button){
  const s=quizState;if(!s||s.chosen>=0||modal!=='quiz')return;const q=s.question,correct=choice===q.answer;s.chosen=choice;if(correct)s.score++;
  act('answer',{kind:q.kind,id:q.id,choice},false);
  if(s.mode==='accel'){quizHold.accel=null;s.result=act('accelerate',{correct},false);refreshGarden();}
  if(s.mode==='gacha')quizHold.gacha={banner:s.banner,question:q,chosen:choice};
  const c=centerOf(button);renderQuiz();if(correct)burst(c.x,c.y,{count:14,spread:80,size:11,color:'#ffe9a8'});
  if(correct&&s.mode==='accel'&&s.result?.ok)sound.reveal?.('SR');
  if(screen==='library')refreshBehind();
}
function tenPull(){
  if(banner==='relic'||p().dreams<T.heroDrawCost*10){draw(10);return;}
  const held=quizHold.gacha;if(held&&held.banner===banner){openQuiz({mode:'gacha',banner,question:held.question,chosen:held.chosen});return;}
  const q=held?.question||pickQuestion('concept');if(!q){draw(10);return;}quizHold.gacha={banner,question:q,chosen:-1};
  openQuiz({mode:'gacha',banner,question:q});
}
function accelQuiz(){if(todayDaily().accel)return;const q=quizHold.accel||pickQuestion('term');if(!q)return;quizHold.accel=q;openQuiz({mode:'accel',question:q});}
function startPractice(kind,id){
  const list=kind==='concept'?lectureQuestions(id):termQuestions(id);if(!list.length)return;
  openQuiz({mode:'practice',queue:list.map(q=>q.id),kind,index:0,question:list[0]});
}
function nextPractice(){const s=quizState;if(!s?.queue||s.index>=s.queue.length-1)return;s.index++;s.question=questionOf(s.kind,s.queue[s.index]);s.chosen=-1;renderQuiz();}

// Library: a gallery wall of seven frames, each shaped like its painting. The frame being earned shows its
// constellation; every explained wrong answer lights one star. Lectures and terms sit in their own tabs.
function skyMarkup(c,lit,{fit='meet'}={}){
  const on=i=>i<lit;
  return `<svg class="sky" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid ${fit}" role="img" aria-label="${c.name} · 별 ${lit}/${c.stars.length}">
    ${c.lines.map(([a,b])=>`<line x1="${c.stars[a][0]}" y1="${c.stars[a][1]}" x2="${c.stars[b][0]}" y2="${c.stars[b][1]}" class="${on(a)&&on(b)?'on':''}"/>`).join('')}
    ${c.stars.map(([x,y],i)=>`<g class="star-dot ${on(i)?'on':i===lit?'next':''} ${justLit&&i===lit-1?'just':''}" transform="translate(${x} ${y})">${on(i)?'<circle class="glow" r="5.5"/>':''}<circle class="core" r="${on(i)?2.4:1.5}"/></g>`).join('')}</svg>`;
}
function frameWall(album=false){
  const l=p().study.library;
  return `<div class="frame-wall ${album?'album':''}">${CONSTELLATIONS.map((k,i)=>{const open=l.unlocked.includes(k.id),current=i===l.index&&!album;
    return `<button class="frame ${open?'open':current?'current':'veiled'} ${k.ratio>1.1?'wide':''}" style="--ratio:${k.ratio}" ${open?`data-library-art="${k.id}"`:current?'data-action="today-star"':'disabled'} aria-label="${open?k.title:current?`${k.name} · 별 ${l.stars}/${k.stars.length}`:'아직 걸리지 않은 그림'}">
      <span class="frame-canvas">${open?`<img src="${libraryArt(k.id)}" alt="" draggable="false" loading="lazy">`:current?skyMarkup(k,l.stars):`<span class="frame-veil">${icon('star')}</span>`}</span>
      <span class="frame-plate">${open?k.title:current?`${k.name} <em>${l.stars}/${k.stars.length}</em>`:i===l.index?k.name:'???'}</span></button>`;}).join('')}</div>`;
}
function renderLibrary(){
  const tabs=[['gallery','별의 회랑'],['lecture','강의'],['term','용어']];
  const body=libraryTab==='lecture'?lectureList():libraryTab==='term'?termList():galleryTab();justLit=false;
  return `<section class="lib"><div class="lib-top"><button class="icon-button lib-back" data-nav="home" aria-label="홈으로">${icon('chevron')}</button><div class="tabbar">${tabs.map(([id,name])=>`<button data-library-tab="${id}" aria-pressed="${libraryTab===id}"><b>${name}</b>${id==='gallery'&&libraryDot()?'<i class="dot"></i>':''}</button>`).join('')}</div></div>${body}</section>`;
}
function galleryTab(){
  const s=p().study,done=libraryDone(),wrong=s.wrong.length,today=libraryToday();
  const label=done?'일곱 그림을 모두 걸었어요':today?'오늘의 별을 밝혔어요':wrong?'오늘의 별 밝히기':'오답이 생기면 별을 밝힐 수 있어요';
  return `<p class="lib-lead">${done?'루미의 회랑이 완성되었어요. 그림은 언제든 다시 볼 수 있어요.':'틀린 문제를 하나 골라 루미의 설명을 들으면 별이 하나 켜져요. 별자리가 이어지면 그 자리에 루미의 그림이 걸려요.'}</p>
    ${frameWall()}
    <div class="lib-cta"><button class="primary wide ${!done&&!today&&wrong?'shine':''}" data-action="today-star" ${done||today||!wrong?'disabled':''}>${icon('star')}<b>${label}</b>${!done&&!today&&wrong?`<small>오답 ${wrong}</small>`:''}</button>${!wrong&&!done?'<button class="link" data-library-tab="lecture">강의 문제 풀러 가기</button>':''}</div>`;
}
const dots=(kind,list)=>`<span class="q-dots">${list.map(q=>`<i class="${solved(kind,q.id)?'on':''}"></i>`).join('')}</span>`;
function lectureList(){
  return `<div class="lec-list">${COURSE.lectures.map(l=>`<button class="lec-row" data-lecture="${l.id}"><span class="lec-no">${l.no}</span><span class="lec-info"><b>${escapeText(l.title)}</b><small lang="ja">${escapeText(l.titleJa)}</small></span>${dots('concept',l.quizzes)}</button>`).join('')}</div><p class="lib-foot">${escapeText(COURSE.subject)}</p>`;
}
function termList(){
  const groups=[...new Set(COURSE.terms.map(t=>t.category))];
  return groups.map(g=>`<h3 class="term-group">${escapeText(g)}</h3><div class="lec-list">${COURSE.terms.filter(t=>t.category===g).map(t=>`<button class="lec-row term" data-term="${t.id}"><span class="lec-info"><b>${escapeText(t.termKo)}</b><small lang="ja">${escapeText(t.termJa)}</small></span>${dots('term',t.quizzes)}</button>`).join('')}</div>`).join('');
}
function lectureSheet(id){
  const l=lectureById(id);if(!l)return;const done=l.quizzes.filter(q=>solved('concept',q.id)).length;
  show(`제${l.no}강 ${l.title}`,`${l.category} · ${l.minutes}분`,`<article class="lecture"><p class="lec-ja" lang="ja">${escapeText(l.titleJa)}</p>${l.subtitle?`<p class="lec-sub">${escapeText(l.subtitle)}</p>`:''}${lectureBody(l)}</article>`,`<button class="primary wide" data-practice="concept:${id}">강의 문제 풀기 <small>${done}/${l.quizzes.length}</small></button>`,'lecture',id);
}
function termSheet(id){
  const t=termById(id);if(!t)return;const done=t.quizzes.filter(q=>solved('term',q.id)).length;
  show(t.termKo,t.category,`<article class="lecture">${termBody(t)}</article>`,`<button class="primary wide" data-practice="term:${id}">용어 문제 풀기 <small>${done}/${t.quizzes.length}</small></button>`,'lecture',id);
}
// Today's star: pick a wrong answer, hear Rumi (or read the built-in explanation without a key), light one star.
function todayStar(){
  const s=p().study;if(libraryDone()||libraryToday())return;
  if(!s.wrong.length){show('오늘의 별','루미의 별의 서재','<p class="empty">아직 오답이 없어요. 강의 문제나 별빛 퀴즈에서 틀린 문제가 여기로 모여요.</p>','<button class="primary wide" data-library-tab="lecture">강의 문제 풀기</button>','info');return;}
  show('오늘의 별','어떤 문제를 다시 볼까요?',`<div class="wrong-list">${s.wrong.slice().reverse().map(w=>{const q=questionOf(w.kind,w.id);return q?`<button class="wrong-row" data-review="${w.kind}:${w.id}"><span class="kind-chip ${w.kind}">${KIND_NAME[w.kind]}</span><span class="wrong-text">${escapeText(q.prompt)}</span>${icon('chevron')}</button>`:'';}).join('')}</div>`,'','wrong');
}
const starReady=key=>!!tutorSettings().key?heard.has(key):true;
function reviewSheet(kind,id){
  const q=questionOf(kind,id);if(!q)return;const w=wrongEntry(kind,id),key=`${kind}:${id}`,cached=tutorCache.get(key),hasKey=!!tutorSettings().key;
  const blocked=libraryDone()?'모든 그림을 걸었어요':libraryToday()?'오늘의 별은 밝혔어요':!w?'오답 노트에 없는 문제예요':'';
  const intro=hasKey?'<p class="rumi-hint">루미가 이 문제를 자세히 설명해 줄 거예요. 설명을 들으면 오늘의 별을 밝힐 수 있어요.</p>'
    :'<p class="rumi-hint">설정에서 Gemini API 키를 넣으면 루미가 자세히 설명해 줘요. 지금은 위의 해설을 읽고 별을 밝힐 수 있어요.</p><button class="link" data-action="settings">설정에서 키 넣기</button>';
  show('오답 복습',`${KIND_NAME[kind]} 문제`,`${questionBlock(q,w?w.choice:-1)}<div class="explain-box"><b>해설</b><p>${escapeText(q.explain)}</p></div>${studyPeek(q)}
    <div class="rumi-box" id="rumi-answer"><div class="rumi-head"><span class="rumi-face">${image('rumi')}</span><b>루미의 설명</b></div><div class="rumi-text">${cached?tutorHtml(cached,escapeText):intro}</div></div>`,
    `<div class="dialog-buttons">${hasKey&&!cached?`<button class="secondary" data-rumi="${key}">루미에게 설명 듣기</button>`:''}<button class="primary" data-light-star="${key}" ${blocked||!starReady(key)?'disabled':''}>${icon('star')}<b>${blocked||'별 하나 밝히기'}</b></button></div>`,'review',key);
}
async function askRumi(key,button){
  const [kind,id]=key.split(':'),q=questionOf(kind,id),w=wrongEntry(kind,id),box=document.querySelector('#rumi-answer .rumi-text');if(!q||!box)return;
  tutorAbort?.abort();const ctrl=new AbortController();tutorAbort=ctrl;button.disabled=true;button.textContent='루미가 생각하는 중…';
  box.innerHTML='<p class="rumi-wait"><i></i><i></i><i></i>루미가 책장을 넘기는 중이에요…</p>';
  let text=null,error=null;
  try{text=await explainWithRumi(q,w?w.choice:-1,{signal:ctrl.signal});}catch(e){error=e;}
  if(tutorAbort===ctrl)tutorAbort=null;if(error?.name==='AbortError')return;
  heard.add(key);if(text)tutorCache.set(key,text);
  if(modal!=='review'||modalInfo!==key||!box.isConnected)return;
  if(text){box.innerHTML=tutorHtml(text,escapeText);button.remove();}
  else{box.innerHTML=`<p class="rumi-error">${escapeText(error?.message||'설명을 받지 못했어요.')}</p><p class="rumi-hint">위의 해설을 읽었다면 오늘의 별은 밝힐 수 있어요.</p>`;button.disabled=false;button.textContent='다시 물어보기';}
  const star=document.querySelector('#sheet [data-light-star]');if(star&&!libraryToday()&&!libraryDone()&&wrongEntry(kind,id))star.disabled=false;
}
function lightStar(key,button){
  const [kind,id]=key.split(':');if(!starReady(key))return;const c=centerOf(button),result=act('libraryStar',{kind,id},false);if(!result.ok){toast(result.message);return;}
  burst(c.x,c.y,{count:18,spread:100,size:12,color:'#ffe9a8'});sound.reveal?.('SR');
  if(result.completed){close();screen='library';libraryTab='gallery';render();artSheet(result.completed,true);return;}
  close();screen='library';libraryTab='gallery';justLit=true;render();toast(result.message);
  const frame=document.querySelector('.frame.current');if(frame){frame.scrollIntoView({block:'center',behavior:'smooth'});const fc=centerOf(frame);setTimeout(()=>burst(fc.x,fc.y,{count:14,spread:80,size:11,color:'#ffe9a8'}),450);}
}
// A finished constellation: its painting appears in the frame, full screen, with Rumi's line.
function artSheet(id,fresh=false){
  const i=CONSTELLATIONS.findIndex(k=>k.id===id),k=CONSTELLATIONS[i],next=CONSTELLATIONS[i+1];if(!k)return;
  show(k.title,fresh?`${k.name} 완성!`:k.name,`<figure class="art-reveal ${fresh?'fresh':''}" style="--ratio:${k.ratio}"><span class="art-frame"><img src="${libraryArt(k.id)}" alt="${k.title}" draggable="false"></span><figcaption>“${escapeText(k.line)}”<small>— 루미</small></figcaption></figure>${fresh?`<p class="art-next">${next?`다음은 <b>${next.name}</b>예요.`:'일곱 그림이 모두 걸렸어요. 고마워, 형아!'}</p>`:''}`,
    `<button class="primary wide" data-action="${fresh?'library-back':'close'}">${fresh?'회랑으로':'닫기'}</button>`,'library-art',id);
  if(fresh){const img=document.querySelector('#sheet .art-frame');if(img){const c=centerOf(img);setTimeout(()=>burst(c.x,c.y,{count:30,spread:160,size:14,duration:1200,color:'#ffe08a'}),300);}}
}

document.addEventListener('click',e=>{
  const button=e.target.closest('button');
  if(lobbyView){if(!button||button.dataset.action!=='lobby-view'){setLobbyView(false);return;}}
  if(!button||button.disabled)return;const d=button.dataset;sound.click();
  if(d.nav){if(screen==='battle'){leave();return;}close();if(d.nav===screen&&d.nav!=='home'){$('content').scrollTo({top:0,behavior:'smooth'});return;}screen=d.nav;render();return;}
  if(d.hero){heroDetail(d.hero);return;}if(d.relic){relicDetail(d.relic);return;}
  if(d.memorial){openMemorial(d.memorial);return;}
  if(d.give){giveGift(d.to,d.give,button);return;}
  if(d.lobby){const on=p().lobby!==d.lobby;if(act('lobby',{id:on?d.lobby:null},false).ok){button.querySelector('span').textContent=on?'로비에서 내리기':'로비에 걸기';button.setAttribute('aria-pressed',String(on));refreshBehind();toast(on?`${HERO[d.lobby].name}의 기억을 로비에 걸었어요.`:'로비를 정원으로 되돌렸어요.');}return;}
  if(d.collection){collection=d.collection;rarity='all';render();return;}if(d.filter){rarity=rarity===d.filter?'all':d.filter;render();return;}
  if(d.banner){banner=d.banner;render();return;}if(d.mode){mode=d.mode;render();return;}if(d.tier){challengeTier=d.tier;render();return;}if(d.cycle){cycle=Number(d.cycle);render();return;}
  if(d.prepareStage){prepare(Number(d.prepareStage));return;}if(d.begin){begin(d.begin,Number(d.stage));return;}
  if(d.bed){bedFocus=d.bed;refreshGarden();return;}if(d.bedGrow){if(bedHold?.held){bedHold=null;return;}growBed(d.bedGrow);return;}
  if(d.libraryTab){close();libraryTab=d.libraryTab;if(screen!=='library'){screen='library';render();}else{render();$('content').scrollTop=0;}return;}
  if(d.review){reviewSheet(...d.review.split(':'));return;}if(d.rumi){askRumi(d.rumi,button);return;}if(d.lightStar){lightStar(d.lightStar,button);return;}
  if(d.libraryArt){artSheet(d.libraryArt);return;}if(d.lecture){lectureSheet(d.lecture);return;}if(d.term){termSheet(d.term);return;}
  if(d.practice){startPractice(...d.practice.split(':'));return;}if(d.quizChoice){answerQuiz(Number(d.quizChoice),button);return;}
  if(d.pityPick){pityPick=d.pityPick;pitySheet();return;}
  if(d.draw||d.drawAgain){const n=Number(d.draw||d.drawAgain);if(n===10)tenPull();else draw(1,banner==='normal'&&!todayDaily().free);return;}
  if(d.castNow){close();battleCommand(E.cast(run,d.castNow));return;}if(d.skillInfo){skillInfo(d.skillInfo);return;}
  if(d.enhance||d.enhanceRelic){const id=d.enhance||d.enhanceRelic,c=centerOf(button);if(act('enhance',{id,kind:d.enhance?'hero':'relic'},false).ok){refreshBehind();(d.enhance?heroDetail:relicDetail)(id);burst(c.x,c.y,{count:14,spread:80,size:11,color:'#ffe39a'});}return;}
  if(d.equip){if(act('equip',{id:d.equip},false).ok){refreshBehind();relicDetail(d.equip);}return;}
  if(d.setPartner){if(act('partner',{id:d.setPartner},false).ok){close();if(screen==='home')render();toast(`파트너 · ${HERO[d.setPartner].name}`);}return;}
  if(d.teamPick){const i=editingDeck.indexOf(d.teamPick);if(i>=0)editingDeck.splice(i,1);else if(editingDeck.length<TEAM_SIZE)editingDeck.push(d.teamPick);else{toast(`편성은 ${TEAM_SIZE}명이에요. 먼저 한 명을 빼 주세요.`);return;}team(true);return;}
  if(d.dispatchSlot){dispatchTap(Number(d.dispatchSlot));return;}
  if(d.send){if(act('dispatch',{id:d.send,slot:Number(d.slot)},false).ok){close();refreshGarden();toast(`${HERO[d.send].name} 파견 출발 · ${T.dispatchHours}시간`);}return;}
  if(d.draft){if(act('draft',{index:Number(d.draft)},false).ok)render();return;}
  if(d.skill){if(skillHeld){skillHeld=false;return;}battleCommand(E.cast(run,d.skill));return;}if(d.train){battleCommand(E.upgrade(run,d.train));training();return;}if(d.sell){battleCommand(E.sell(run,Number(d.sell)));return;}if(d.reward){battleCommand(E.chooseReward(run,d.reward));close();previousPhase='';return;}
  if(d.setting){if(act('setting',{id:d.setting,value:!p().settings[d.setting]},false).ok)showSettings();return;}if(d.daily){claimDaily([d.daily]);return;}
  if(d.confirmMonthly){if(act('claimMonthly',{token:d.confirmMonthly}).ok){close();render();}return;}
  const actions={close:()=>{if(modal==='reward')return;if(modal==='draw'&&bonusItems){showBonus();return;}close();},settings:showSettings,partner:partners,team:()=>team(),'focus-team':()=>document.querySelector('#sheet-body .choose-list')?.scrollIntoView({behavior:'smooth',block:'start'}),rates,history,records,daily,
    'daily-all':()=>claimDaily(DAILY_MISSIONS.filter(m=>missionDone(todayDaily(),m.id)&&!todayDaily().claimed.includes(m.id)).map(m=>m.id)),
    bond:()=>bondSheet(d.id||p().partner),'gift-tray':()=>toggleTray(button),talk,'lobby-view':()=>setLobbyView(!lobbyView),idle:collectStars,'idle-shard':collectStars,
    'memorial-story':()=>toggleStory(button),fullscreen:toggleFullscreen,'unit-info':unitInfo,'reveal-skip':skipReveal,
    season:()=>{banner='season';screen='summon';render();},prepare:()=>prepare(Number(d.stage)),'prepare-mode':()=>prepare(Math.min(45,p().cleared+1),mode),resume,
    'save-team':()=>{if(act('deck',{ids:editingDeck}).ok){const back=teamReturn;teamReturn=null;close();render();if(back)prepare(back.stage,back.kind);}},
    'go-summon':()=>{close();screen='summon';banner='normal';render();},'go-relic-summon':()=>{close();screen='summon';banner='relic';render();},
    'go-collection':()=>{close();screen='collection';collection='hero';render();},'go-relics':()=>{close();screen='collection';collection='relic';rarity='all';render();},
    'go-garden':()=>{close();screen='garden';render();},'go-home-gift':()=>{close();screen='home';giftTray=true;render();giftTray=true;const t=$('gift-tray');if(t){t.innerHTML=trayMarkup(p().partner);t.hidden=false;}},
    'monthly-claim':confirmMonthlyClaim,'monthly-retry':()=>{close();prepare(Math.min(45,p().cleared+1),'monthly');},
    speed:()=>{speed=speed===1?2:1;button.querySelector('b').textContent=speed+'×';},pause:()=>{if(paused)resumeCombat();else{paused=true;saves.mark();saves.flush();updateBattle();}},
    'summon-battle':()=>battleCommand(E.summon(run)),training,auto:()=>{if(act('setting',{id:'auto',value:!p().settings.auto},false).ok){button.querySelector('b').textContent=p().settings.auto?'ON':'OFF';button.setAttribute('aria-pressed',p().settings.auto);syncBattlePhase();}},
    target:()=>{E.cycleTarget(run,selected);battleCommand({ok:true});},deselect:()=>{selected=-1;updateUnit();},leave,
    retire:retireSheet,'confirm-retire':()=>settle(true),'return-battle':()=>{close();resumeCombat();},'save-leave':()=>{saves.mark();if(saves.flush()){saves.reset();close();screen='home';run=null;renderer=null;render();}},
    export:exportBackup,import:()=>{if(run&&p().active){toast('진행 중인 전투를 저장하고 홈에서 불러오세요.');return;}$('backup-input').click();},
    library:()=>{close();screen='library';render();},'library-back':()=>{close();screen='library';libraryTab='gallery';render();},'bonus-reveal':showBonus,accel:accelQuiz,
    'quiz-go':()=>{const s=quizState;if(!s||s.mode!=='gacha'||s.chosen<0)return;banner=s.banner;if(draw(10,false,s.chosen===s.question.answer)){quizHold.gacha=null;quizState=null;}},
    'quiz-skip':()=>{const s=quizState;if(!s||s.chosen>=0)return;banner=s.banner;if(draw(10)){quizHold.gacha=null;quizState=null;}},'quiz-next':nextPractice,
    'tutor-save':()=>{const ok=saveTutorSettings({key:$('tutor-key')?.value,model:$('tutor-model')?.value});toast(ok?'AI 설명 설정을 저장했어요.':'이 브라우저에 저장할 수 없어요.');showSettings();},
    'tutor-clear':()=>{saveTutorSettings({key:'',model:tutorSettings().model});tutorCache.clear();toast('API 키를 지웠어요.');showSettings();},
    'today-star':todayStar,pity:pitySheet,'pity-claim':claimPity,basket:()=>claimBasket(button),'claim-all':()=>claimDispatches(p().dispatches.filter(x=>x.end<=now()).map(x=>x.slot)),
    'relic-info':relicInfo,'mode-info':()=>modeInfo(d.kind),'dispatch-info':dispatchInfo,
  };actions[d.action]?.();
});
// Every press gets a small sparkle; the summon stage skips to the full result.
document.addEventListener('pointerdown',e=>{
  const b=e.target.closest?.('.primary,.secondary,.nav-item,.lb-btn,.cc,.skill-button,.tabbar button,.slot,.frame,.tray-gift');
  if(b&&!b.disabled)tapSpark(e.clientX,e.clientY,b.classList.contains('primary')?'#ffe39a':'#cfe2ff');
  if(e.target.closest?.('.reveal-stage')&&!e.target.closest('button'))skipReveal();
},{passive:true});
document.addEventListener('change',e=>{if(e.target.id==='quality-select')act('setting',{id:'quality',value:e.target.value},false);});
$('backup-input').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>2*1024*1024){toast('백업 파일은 2MB 이하만 가능합니다.');return;}try{const raw=await file.text();if(!JSON.parse(raw)){toast('올바른 백업 파일이 아닙니다.');return;}show('백업을 복원할까요?','데이터',`<p class="subtext">현재 진행 데이터가 선택한 백업으로 교체됩니다. 필요하면 먼저 현재 데이터를 백업하세요.</p>`,`<div class="dialog-buttons"><button class="secondary" data-action="export">현재 데이터 백업</button><button id="confirm-import" class="primary">복원</button></div>`,'import');$('confirm-import').onclick=()=>{const result=store.import(raw);toast(result.ok?'백업을 복원했습니다.':result.message);if(result.ok){close();screen='home';run=null;render();}};}catch{toast('백업 파일을 읽을 수 없습니다.');}});
document.addEventListener('keydown',e=>{if(lobbyView&&e.key==='Escape'){setLobbyView(false);e.preventDefault();return;}if(!modal)return;if(e.key==='Escape'){if(modal!=='reward'){close();}e.preventDefault();}if(e.key==='Tab'){const buttons=Array.from($('sheet').querySelectorAll('button:not(:disabled),summary,input,select,[tabindex="0"]')).filter(b=>b.offsetParent!==null),first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('sheet'))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===$('sheet'))){e.preventDefault();first?.focus();}}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(run){saves.mark();saves.flush();}sound.suspend();lastFrame=0;accumulator=0;renderClock.reset();}else{lastFrame=0;renderClock.reset();if(!paused)sound.unlock();}});
window.addEventListener('pagehide',()=>{if(run){saves.mark();saves.flush();}});
window.addEventListener('storage',e=>{if(e.key===SAVE_KEY&&e.newValue!==store.raw){store.conflict=true;paused=true;wallet();}});
function frame(time){
  const dt=lastFrame?Math.min(.1,(time-lastFrame)/1000):0;lastFrame=time;
  if(run&&screen==='battle'&&!document.hidden){
    if(!paused&&!modal){
      accumulator+=dt*speed*(slowmo>0?.3:1);slowmo=Math.max(0,slowmo-dt);let ticks=0;
      while(accumulator>=.05&&ticks++<5){const before=run.phase;E.step(run,.05);performanceStats.steps++;if(before!=='reward'&&run.phase==='reward')autoIn=-.5;autoIn+=.05;if(p().settings.auto&&!pointer&&autoIn>=.32){autoPlay(run);autoIn=0;}accumulator-=.05;}
      if(ticks)saves.mark();uiIn+=dt;
      for(const e of run.events.splice(0)){renderer.event(e);sound.event(e);if(e.type==='skill')cutIn(e);}
      saves.schedule();if(uiIn>.18){uiIn=0;updateBattle();}sound.battle=true;sound.boss=run.enemies.some(e=>e.boss);
      syncBattlePhase();
      if(run&&!paused&&['victory','defeat'].includes(run.phase))settle();
    }
    const renderDt=renderClock.next(time,paused||!!modal);if(run&&renderDt!==null){renderer.draw(run,renderDt);performanceStats.renders++;}
  }else sound.battle=false;
  requestAnimationFrame(frame);
}
// Timers tick in place: dispatch and basket countdowns in the garden, the shooting-star jar at home.
let lastBasket=-1;
setInterval(()=>{
  if(screen==='garden'&&!modal){const st=basketState(p(),now()),ended=p().dispatches.some(d=>d.end<=now()&&document.querySelector(`.slot.running[data-dispatch-slot="${d.slot}"]`));
    if(ended||st.ready!==lastBasket){lastBasket=st.ready;refreshGarden();}else{for(const node of document.querySelectorAll('[data-timer]'))node.textContent=timerText(Number(node.dataset.timer));const b=$('basket-sec')?.querySelector('.basket-info small');if(b&&!st.full)b.textContent=`다음 선물까지 ${hm(st.nextIn)}`;}}
  if(screen==='home'&&$('idle-total')){const idle=idleReward(p(),now());$('idle-total').textContent=fmt(idle);$('idle-ring')?.style.setProperty('--fill',idleFill());const button=$('idle-claim');if(button)button.disabled=idle<1;
    const box=$('shards');if(box&&!p().lobby){const markup=shardsMarkup();if(box.childElementCount!==(markup.match(/class="shard"/g)||[]).length)box.innerHTML=markup;}}
  if(screen!=='battle'&&screen!=='draft')navDots();
},1000);
for(const img of document.querySelectorAll('img'))img.onerror=()=>{img.src=fallback('star_boy');};
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement&&!e.target.dataset.memorial&&!e.target.dataset.fallback){e.target.dataset.fallback='1';e.target.src=fallback('star_boy');}},true);
document.documentElement.style.setProperty('--garden',`url("${window.__ASTRA_ASSETS__?.garden||'./assets/merge/garden.webp'}")`);
for(const [name,id,path] of [['--greenhouse','greenhouse','./assets/merge/greenhouse.webp'],['--beds','greenhouse-beds','./assets/merge/greenhouse-beds.webp'],['--gifts','gifts','./assets/merge/gifts.webp']])document.documentElement.style.setProperty(name,`url("${window.__ASTRA_ASSETS__?.[id]||path}")`);
document.documentElement.style.setProperty('--altar',`url("${window.__ASTRA_ASSETS__?.['summon-altar']||'./assets/merge/summon-altar.webp'}")`);
art.ready.then(()=>{if(art.failed.length)toast('일부 그림을 불러오지 못해 대체 이미지로 표시합니다.');});
// Title: a quiet garden at night and the logo. The first touch enters (and unlocks sound, which needs a gesture).
// Automated browsers (screenshots, QA) skip it.
{const splash=$('splash');
  if(navigator.webdriver)splash?.remove();
  else if(splash){Promise.race([art.ready,new Promise(r=>setTimeout(r,1400))]).then(()=>setTimeout(()=>splash.classList.add('ready'),250));
    splash.addEventListener('click',()=>{if(!splash.classList.contains('ready')||splash.classList.contains('out'))return;sound.unlock();splash.classList.add('out');setTimeout(()=>splash.remove(),650);
      if(screen==='home')setTimeout(()=>{const hero=HERO[p().partner];say(partnerLines(hero)[0]);},700);});}}
$('app').dataset.solo=String(SOLO);syncFullscreen();render();requestAnimationFrame(frame);
// Read-only diagnostics for offline QA. Mutations use real buttons or fixtures
// written to isolated browser storage before boot, never a production cheat UI.
window.STAR_GARDEN={get profile(){return p();},get battle(){return run;},get screen(){return screen;},get performance(){return {...performanceStats,saveWrites:saves.writes,saveFailures:saves.failures,savePending:saves.pending!==null,quality:p().settings.quality,dpr:renderer?.dpr||0,particles:renderer?.particles.length||0,impacts:renderer?.fx.impacts.length||0};}};

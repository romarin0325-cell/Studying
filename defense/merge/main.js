import {HERO,HEROES,DEFAULT_DECK,ARTIFACT,ARTIFACTS,BLESSING,BLESSINGS,validArtifacts,CHAPTERS,BOSSES} from './content.js';
import {newRun,step,summon,move,sell,cast,upgrade,upgradeCost,summonCost,dividend,cycleTarget,bestUnit,cellAt,cellPoint,chooseReward,continueEndless,serialize,restore,validDeck,harvestIncome,ATTACK_WINDUP} from './engine.js';
import {Art,Renderer} from './render.js';
import {Sound} from './audio.js';
import {tutorialPage,mountTutorial} from './tutorial.js';
import {inspection,attackDescription,skillDescription,trainingPreview,number} from './unit-info.js';
import {bindFullscreen} from './fullscreen.js';

const $=id=>document.getElementById(id),art=new Art(),sound=new Sound(),renderer=new Renderer($('arena'),art);
const PROFILE_KEY='astra.confluence.profile.v1',RUN_KEY='astra.confluence.run.v1';
const defaults={deck:[...DEFAULT_DECK],artifacts:[],chapter:0,cleared:[],best:0,volume:.35,music:true,sound:true,reduced:false};
let profile={...defaults},state=null,saved=null,screen='home',paused=false,speed=1,selected=-1,preferred=-1,modalKind=null,toastTimer,bannerTimer,cutinTimer,lastFrame=0,accumulator=0,saveTime=0,uiTime=0,lastPhase='',lastUnit='',lastFocus=null,editingDeck=null;
const portraits={},figures={},icons={};let deckFocus=DEFAULT_DECK[0],editingArtifacts=[];
function storageGet(key){try{return localStorage.getItem(key);}catch{return null;}}
function storageSet(key,value){try{localStorage.setItem(key,value);return true;}catch{$('save-notice').hidden=false;return false;}}
try{const v=JSON.parse(storageGet(PROFILE_KEY)||'null');if(v){profile={...defaults,...v};if(!validDeck(profile.deck))profile.deck=[...DEFAULT_DECK];profile.chapter=Math.max(0,Math.min(3,Number(profile.chapter)||0));if(!Array.isArray(profile.cleared))profile.cleared=[];profile.volume=Math.max(0,Math.min(1,Number(profile.volume)||0));}}catch{}
if(!validArtifacts(profile.artifacts))profile.artifacts=[];
const storedRun=storageGet(RUN_KEY);saved=restore(storedRun);if(saved&&['victory','defeat'].includes(saved.phase))saved=null;
try{if(JSON.parse(storedRun)?.version===1)$('rules-update').hidden=false;}catch{}
function saveProfile(){storageSet(PROFILE_KEY,JSON.stringify(profile));}
function saveRun(){if(state){storageSet(RUN_KEY,serialize(state));saved=['victory','defeat'].includes(state.phase)?null:restore(serialize(state));}}
function applySettings(){sound.enabled=profile.sound;sound.music=profile.music;sound.setVolume(profile.volume);renderer.reduced=profile.reduced||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;$('app').dataset.reduced=String(!!renderer.reduced);}
applySettings();
function toast(message){if(!message)return;clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,2300);}
function command(result){if(result?.ok===false&&result.reason)toast(result.reason);updateUI(true);saveRun();return result;}
function pic(id,kind='portrait'){return kind==='figure'?figures[id]||portraits[id]||'':portraits[id]||'';}
function portrait(id,attrs=''){return `<img src="${pic(id)}" alt="${HERO[id].name}" ${attrs}>`;}
function preparePortraits(){
  for(const h of HEROES){const c=document.createElement('canvas'),p=h.art.portrait;c.width=p?.size||256;c.height=c.width;const cx=c.getContext('2d'),img=art.images[h.art.atlas];cx.imageSmoothingQuality='high';if(img&&p)cx.drawImage(img,p.x-p.size/2,p.y-p.size/2,p.size,p.size,0,0,c.width,c.height);else art.hero(cx,h.id,c.width/2,c.height*1.18,c.width*1.4);portraits[h.id]=c.toDataURL('image/png');c.width=384;c.height=422;art.hero(c.getContext('2d'),h.id,192,405,422);figures[h.id]=c.toDataURL('image/png');}
  for(const [atlas,list,cols,rows] of [['relics',ARTIFACTS,5,4],['blessings',BLESSINGS,3,2]])for(const item of list){const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d'),img=art.images[atlas];ctx.imageSmoothingQuality='high';if(img){const w=img.naturalWidth/cols,h=img.naturalHeight/rows,scale=230/Math.max(w,h);ctx.drawImage(img,item.icon%cols*w,Math.floor(item.icon/cols)*h,w,h,(256-w*scale)/2,(256-h*scale)/2,w*scale,h*scale);}else{ctx.fillStyle='#d6c499';ctx.font='bold 90px serif';ctx.textAlign='center';ctx.fillText(item.name[0],128,164);}icons[item.id]=c.toDataURL('image/png');}
}
function itemIcon(id){return `<img class="item-art" src="${icons[id]||''}" alt="" aria-hidden="true">`;}
function updateHome(){
  const c=CHAPTERS[profile.chapter];$('chapter-number').textContent=`CHAPTER 0${profile.chapter+1}`;$('chapter-name').textContent=c.name;$('chapter-caption').textContent=c.caption;
  $('home-deck').innerHTML=profile.deck.map(id=>`<button class="portrait-button" data-hero="${id}" aria-label="${HERO[id].name} 정보">${portrait(id)}</button>`).join('');
  $('home-relics').innerHTML=Array.from({length:3},(_,i)=>`<button class="relic-slot ${profile.artifacts[i]?'equipped':''}" data-action="loadout" aria-label="${profile.artifacts[i]?ARTIFACT[profile.artifacts[i]].name:'빈 유물 칸'}">${profile.artifacts[i]?itemIcon(profile.artifacts[i]):'<span>＋</span>'}</button>`).join('');
  $('resume').hidden=!saved;if(saved)$('resume').textContent=`${CHAPTERS[saved.chapter].name} · ${saved.wave}번째 물결 이어가기`;
  $('record').textContent=profile.cleared.includes(profile.chapter)?'수호 완료 ✦':profile.best?`최고 ${profile.best}번째 물결`:'새로운 이야기';
}
function showHome(){saveRun();screen='home';paused=false;state=null;selected=-1;renderer.selected=-1;closeModal();$('battle').hidden=true;$('home').hidden=false;sound.battle=false;sound.boss=false;updateHome();window.scrollTo(0,0);}
function start(resume=false){sound.unlock();state=resume&&saved?restore(serialize(saved)):newRun({deck:profile.deck,chapter:profile.chapter,artifacts:profile.artifacts});screen='battle';paused=false;speed=1;selected=-1;preferred=-1;renderer.selected=-1;renderer.effects=[];renderer.particles=[];renderer.floats=[];renderer.fx.impacts=[];renderer.fx.footprints=[];renderer.skill=null;renderer.drag=null;pointer=null;$('rules-update').hidden=true;lastPhase='';lastUnit='';accumulator=0;closeModal();$('home').hidden=true;$('battle').hidden=false;$('speed').textContent='1×';buildSkills();updateUI(true);saveRun();window.scrollTo(0,0);fitArena();}
function buildSkills(){
  $('skills').innerHTML=state.deck.map(id=>`<button class="skill-button" data-skill="${id}" aria-label="${HERO[id].name}: ${HERO[id].skill.name}, 별빛 ${HERO[id].skill.cost}" title="${HERO[id].skill.text}">${portrait(id)}<span class="skill-cost">✦ ${HERO[id].skill.cost}</span></button>`).join('');
  $('cell-access').innerHTML=Array.from({length:25},(_,i)=>{const p=cellPoint(i);return `<button data-cell="${i}" style="left:${(p.x-45)/720*100}%;top:${(p.y-45)/780*100}%;width:12.5%;height:${90/780*100}%" aria-label="${Math.floor(i/5)+1}행 ${i%5+1}열 빈칸"></button>`;}).join('');
}
function select(index){selected=index;renderer.selected=index;lastUnit='';updateUnit();}
function activateCell(index){
  if(!state||paused||modalKind||!['combat','intermission'].includes(state.phase))return;
  sound.unlock();select(state.board[index]?index:-1);preferred=state.board[index]?-1:index;
}
function updateUnit(){
  const u=state?.board[selected],panel=$('unit-panel');$('combat-overview').hidden=!!u;if(!u){panel.hidden=true;return;}
  const {stats}=inspection(state,u.hero,u),description=attackDescription(state,u,stats);
  const hash=JSON.stringify([u.uid,u.rank,u.priority,state.upgrades[u.hero],stats,description,u.disabled>0]);if(hash===lastUnit)return;lastUnit=hash;
  const h=HERO[u.hero],label={first:'선두',boss:'보스',strong:'강한 적',last:'후미'}[u.priority];panel.hidden=false;
  const focused=panel.contains(document.activeElement)?document.activeElement.dataset.unit:null;
  panel.innerHTML=`<div class="unit-top">${portrait(u.hero)}<strong>${h.name}</strong><span class="unit-rank">${u.rank}성 · 강화 ${state.upgrades[u.hero]}</span><button class="close-unit" data-unit="close" aria-label="영웅 선택 닫기">×</button></div><div class="unit-metrics"><span>타격 <b>${number(stats.damage)}</b></span><span>주기 <b>${stats.interval.toFixed(2)}초</b></span><span>사거리 <b>${h.range}</b></span>${u.disabled>0?'<em>봉인 중</em>':''}</div><p>${description}</p><div class="unit-actions"><button data-unit="target">목표 · ${label}</button><button data-unit="info">능력 상세</button><button data-unit="sell">회수 +${Math.round(6*Math.pow(1.7,u.rank-1))} G</button></div>`;
  if(focused)panel.querySelector(`[data-unit="${focused}"]`)?.focus({preventScroll:true});
}
function updateUI(force=false){
  if(!state||screen!=='battle')return;
  $('wave-label').textContent=`WAVE ${String(state.wave).padStart(2,'0')} ${state.endless?'· ENDLESS':'/ 12'}`;
  const total=state.waveTotal,left=state.queue.length+state.enemies.length;
  $('wave-progress').firstElementChild.style.width=`${Math.max(0,100-left/total*100)}%`;
  $('gold').textContent=Math.floor(state.gold);$('health').textContent=state.health;$('gauge').textContent=Math.floor(state.gauge);$('gauge-fill').style.width=state.gauge+'%';
  $('summon-price').innerHTML=state.freeSummons?`무료 <small>${state.freeSummons}회</small>`:`${summonCost(state)} <small>G</small>`;$('summon').disabled=state.gold<summonCost(state)||state.board.every(Boolean)||!['combat','intermission'].includes(state.phase);
  $('economy-note').textContent=state.reserves.length?`합류 대기 ${state.reserves.length}명`:dividend(state)?`다음 장미 배당 +${dividend(state)} G`:state.surgeWave===state.wave?'새벽검 · 공격 +25%':`영구 공격 +${Math.round(state.globalAttack*100)}%`;$('artifact-count').textContent=state.artifacts.length;
  for(const b of $('skills').children){const id=b.dataset.skill,live=!!bestUnit(state,id),ready=live&&state.gauge>=HERO[id].skill.cost&&state.phase==='combat'&&state.enemies.some(e=>e.hp>0);b.classList.toggle('ready',ready);b.classList.toggle('unavailable',!live);b.setAttribute('aria-disabled',String(!ready));}
  updateForecast();
  for(let i=0;i<25;i++){const u=state.board[i],b=$('cell-access').children[i];b?.setAttribute('aria-label',`${Math.floor(i/5)+1}행 ${i%5+1}열 ${u?`${HERO[u.hero].name} ${u.rank}성`:'빈칸'}`);}
  $('arena').dataset.wave=state.wave;$('arena').dataset.phase=state.phase;$('arena').dataset.units=state.board.filter(Boolean).length;$('arena').dataset.merges=state.stats.merges;
  $('boss-warning').hidden=!state.telegraph;
  if(state.telegraph){const source=state.enemies.find(e=>e.uid===state.telegraph.uid),warning=BOSSES[source?.boss]?.warning||state.telegraph.pattern;$('boss-warning').textContent=`${warning} · ${Math.max(0,state.telegraph.ends-state.time).toFixed(1)}초`;}
  updateCombatOverview();
  updateUnit();
  if(lastPhase!==state.phase){lastPhase=state.phase;saveRun();if(state.phase==='reward')showReward();else if(state.phase==='victory'||state.phase==='defeat')showResult();}
  sound.battle=state.phase==='combat'&&!paused;sound.boss=state.enemies.some(e=>e.boss);
}
function updateCombatOverview(){
  const allies=state.board.filter(Boolean),alive=state.enemies.filter(e=>e.hp>0),boss=alive.find(e=>e.boss);
  $('remaining-enemies').textContent=alive.length+state.queue.length;
  $('enemy-status').textContent=`진입 ${alive.length} · 대기 ${state.queue.length}`;
  $('deployed-count').innerHTML=`${allies.length}<small> / 25</small>`;
  const buffNames={echo:'메아리',haste:'아리아',awaken:'태고의 약속',march:'은빛 행진'};
  $('active-buffs').textContent=Object.entries(state.buffs).filter(([,n])=>n>0).map(([id,n])=>`${buffNames[id]||id} ${Math.ceil(n)}초`).join(' · ')||`최고 ${Math.max(...allies.map(u=>u.rank),0)}성`;
  const mushrooms=allies.filter(u=>u.hero==='mushroom_king'),next=mushrooms.sort((a,b)=>a.harvest-b.harvest)[0],payout=dividend(state);
  $('income-label').textContent=payout?'물결 보상 + 배당':'물결 보상';
  $('next-income').innerHTML=`+${20+Math.floor(state.wave/2)+payout}<small> G</small>`;
  $('income-status').textContent=next?`수확 +${harvestIncome(next.rank,state.upgrades.mushroom_king)}G · ${Math.max(1,Math.ceil(next.harvest))}초`:payout?`배당 ${payout}G 포함`:'종료 시 지급';
  $('boss-health').hidden=!boss;
  if(boss){const percent=Math.max(0,Math.min(100,boss.hp/boss.maxHp*100));$('boss-name').textContent=BOSSES[boss.boss].name;$('boss-percent').textContent=`${Math.ceil(percent)}%`;$('boss-health').querySelector('i').style.width=percent+'%';$('boss-health').querySelector('[role=progressbar]').setAttribute('aria-valuenow',String(Math.ceil(percent)));}
}
function updateForecast(){
  const bossWave=Math.ceil(state.wave/4)*4,boss=BOSSES[CHAPTERS[state.chapter].bosses[Math.min(2,Math.floor((bossWave-1)/4))]];
  $('forecast-kicker').textContent=state.wave===bossWave?'이번 물결의 보스':'다가오는 보스';
  $('forecast-name').textContent=boss.name;
  const pattern={seal:'행 봉인',heal:'체력 회복',drain:'별빛 침식',rush:'적 전진'}[boss.pattern];
  $('forecast-detail').textContent=`${bossWave}번째 물결 · ${pattern}`;
  if(!$('journey-dots').children.length)$('journey-dots').innerHTML=Array.from({length:12},(_,i)=>`<i class="${(i+1)%4===0?'boss-mark':''}">${(i+1)%4===0?'✦':''}</i>`).join('');
  for(let i=0;i<12;i++){const dot=$('journey-dots').children[i],w=(state.wave-1)%12+1;dot.classList.toggle('passed',i+1<w);dot.classList.toggle('current',i+1===w);}
  $('journey-dots').title='매 물결 축복 · ✦ 보스';
}
function processEvents(){for(const e of state.events){renderer.event(e);sound.event(e);
  if(e.type==='wave'){banner(`WAVE ${String(e.wave).padStart(2,'0')}`);}
  if(e.type==='clear'){banner(`물결을 막았습니다 · +${e.base+e.dividend} G`);}
  if(e.type==='blessing')toast(`${BLESSING[e.id].name}의 축복`);
  if(e.type==='phoenix')toast('돌아오는 새벽 · 결계 피해 방어');
  if(e.type==='boss')banner(e.name);
  if(e.type==='skill'){
    const cutin=$('skill-cutin');cutin.hidden=true;void cutin.offsetWidth;cutin.querySelector('img').src=pic(e.hero);cutin.querySelector('small').textContent=HERO[e.hero].name;cutin.querySelector('strong').textContent=e.name;cutin.hidden=false;clearTimeout(cutinTimer);cutinTimer=setTimeout(()=>cutin.hidden=true,700);
  }
}state.events.length=0;}
function banner(message){clearTimeout(bannerTimer);$('wave-banner').textContent=message;$('wave-banner').classList.add('visible');bannerTimer=setTimeout(()=>$('wave-banner').classList.remove('visible'),1700);}

function showModal(kind,body,{close=true}={}){
  const same=modalKind===kind,scroll=same?$('modal-root').querySelector('.modal-scroll')?.scrollTop||0:0;
  const focus=same?document.activeElement?.dataset:null;
  if(!modalKind)lastFocus=document.activeElement;modalKind=kind;paused=screen==='battle';
  $('modal-root').innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">${close?'<button class="modal-close" data-action="close-modal" aria-label="닫기">×</button>':''}${body}</section>`;$('modal-root').hidden=false;
  const modal=$('modal-root').firstElementChild,header=modal.querySelector('.modal-header'),preview=modal.querySelector('.companion-preview'),footer=modal.querySelector('.roster-toolbar')||[...modal.querySelectorAll('.modal-actions')].pop(),scroller=document.createElement('div');scroller.className='modal-scroll';
  for(const child of [...modal.children])if(child!==header&&child!==preview&&child!==footer&&!child.classList.contains('modal-close'))scroller.append(child);
  modal.append(scroller);if(footer)modal.append(footer);scroller.scrollTop=scroll;
  const key=focus&&Object.keys(focus)[0],target=key?[...modal.querySelectorAll('button,input')].find(el=>el.dataset[key]===focus[key]):null;
  (target||modal.querySelector('button,input'))?.focus({preventScroll:true});
}
function closeModal(){modalKind=null;$('modal-root').hidden=true;$('modal-root').innerHTML='';paused=false;if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
function modalHeader(eyebrow,title,description=''){return `<div class="modal-header"><span class="eyebrow">${eyebrow}</span><h2 id="modal-title">${title}</h2>${description?`<p>${description}</p>`:''}</div>`;}
function showPause(){saveRun();showModal('pause',modalHeader('PAUSED','일시정지',`${CHAPTERS[state.chapter].name} · ${state.wave}번째 물결`)+`<div class="modal-actions"><button class="secondary-button" data-action="settings">설정</button><button class="secondary-button" data-action="help">조작 연습</button></div><div class="modal-actions"><button class="primary-button" data-action="close-modal">전투 계속하기</button></div><div class="modal-actions"><button class="text-button" data-action="home">저장하고 나가기</button></div>`);}
function showSettings(){showModal('settings',modalHeader('SOUND & COMFORT','나에게 맞게')+`<label class="settings-row">소리 사용<input type="checkbox" data-setting="sound" ${profile.sound?'checked':''}></label><label class="settings-row">배경 음악<input type="checkbox" data-setting="music" ${profile.music?'checked':''}></label><label class="settings-row">음량<input type="range" min="0" max="100" value="${Math.round(profile.volume*100)}" data-setting="volume" aria-label="음량"></label><label class="settings-row">화면 흔들림·섬광 줄이기<input type="checkbox" data-setting="reduced" ${profile.reduced?'checked':''}></label><p class="settings-note">전투는 자동으로 저장됩니다. 다른 화면으로 이동하면 전투가 멈춥니다.</p><div class="modal-actions"><button class="primary-button" data-action="close-modal">적용</button></div>`);}
function showHelp(lesson=0){const page=tutorialPage(lesson,portrait);showModal('help',modalHeader('PRACTICE',`조작 연습 · ${lesson+1} / 4`,'연습은 원정의 골드·배치·기록에 영향을 주지 않습니다.')+page.html);mountTutorial($('modal-root'),page,showHelp);}
function heroSummary(id){const h=HERO[id];return `<span class="role-tag">${h.role}</span><p>${h.trait.text}</p><small>1성 · 타격 ${h.damage} · 주기 ${(h.interval+ATTACK_WINDUP).toFixed(2)}초 · 사거리 ${h.range}</small>`;}
function trainingDetail(id){const p=trainingPreview(state,id);return `<b>${p.deployed?`배치 ${p.rank}성`:'미배치 · 1성'} · 타격 ${number(p.damage)}${p.nextDamage!==undefined?` → ${number(p.nextDamage)}`:''}</b>${p.bonus?`<br>${p.bonus}${p.nextBonus?`<br>다음: ${p.nextBonus}`:''}`:''}`;}
function showHero(id){
  const h=HERO[id],live=screen==='battle'&&state?inspection(state,id,state.board[selected]):null;
  const summary=live?`<span class="role-tag">${h.role}</span><p>${live.unit.rank}성 · 강화 ${state.upgrades[id]||0}${live.deployed?'':' · 미배치'}</p>`:heroSummary(id);
  const metrics=live?`<div class="hero-metrics"><span>현재 타격<b>${number(live.stats.damage)}</b></span><span>공격 주기<b>${live.stats.interval.toFixed(2)}초</b></span><span>사거리<b>${h.range}</b></span></div><div class="detail-rule">${attackDescription(state,live.unit,live.stats)}</div>${live.stats.bonuses.length?`<div class="live-bonuses">${live.stats.bonuses.map(b=>`<span>${b}</span>`).join('')}</div>`:''}`:'';
  const caster=live&&bestUnit(state,id);
  showModal('hero',modalHeader('COMPANION',h.name)+`<div class="hero-detail-top">${portrait(id)}<div><h3>${h.title}</h3>${summary}</div></div>${metrics}<div class="detail-rule"><strong>${h.skill.name} · 별빛 ${h.skill.cost}${caster?` · 배치 최고 ${caster.rank}성`:''}</strong>${live?skillDescription(state,id):h.skill.text}</div>${live?'<p class="stats-note">성급·강화·현재 지원 효과를 반영한 수치입니다. 적의 방어와 상태에 따라 최종 피해가 달라집니다.</p>':''}<div class="modal-actions"><button class="primary-button" data-action="close-modal">돌아가기</button></div>`);
}
function showDeck(){editingDeck=[...profile.deck];deckFocus=editingDeck[0];renderDeck();}
function renderDeck(){const h=HERO[deckFocus];showModal('deck',modalHeader('CHOOSE YOUR SIX','이번 원정의 동행','동료를 눌러 능력을 확인하고 6명을 편성하세요.')+`<div class="companion-preview">${portrait(h.id)}<div><strong>${h.name}</strong>${heroSummary(h.id)}<p class="preview-skill"><b>${h.skill.name} · ${h.skill.cost}✦</b> ${h.skill.text}</p></div></div><div class="roster-grid">${HEROES.map(h=>`<div class="roster-card ${editingDeck.includes(h.id)?'picked':''} ${deckFocus===h.id?'inspected':''}"><button class="roster-inspect" data-inspect="${h.id}" aria-label="${h.name} 능력 확인">${portrait(h.id)}<strong>${h.name}</strong><small>${h.role.split(' · ')[0]}</small></button><button class="roster-pick" data-pick="${h.id}" aria-label="${h.name} ${editingDeck.includes(h.id)?'편성 해제':'편성 추가'}" aria-pressed="${editingDeck.includes(h.id)}">${editingDeck.includes(h.id)?'동행 중 ✓':'＋ 동행'}</button></div>`).join('')}</div><div class="roster-toolbar"><p>${editingDeck.length} / 6명 선택</p><button class="primary-button" data-action="save-deck" ${editingDeck.length!==6?'disabled':''}>함께 떠나기</button></div>`);}
function showTraining(){showModal('training',modalHeader('TRAINING','동행 강화',`보유 ${Math.floor(state.gold)} G${state.trainingDiscount?` · 비용 ${Math.round(state.trainingDiscount*100)}% 할인`:''}`)+`<div class="training-list">${state.deck.map(id=>{const h=HERO[id],level=state.upgrades[id];return `<div class="training-item">${portrait(id)}<div><strong>${h.name} <em>${level} / 5</em></strong><span>${h.role}</span><small>${trainingDetail(id)}</small></div><button data-upgrade="${id}" ${level>=5||state.gold<upgradeCost(state,id)?'disabled':''}>${level>=5?'완료':upgradeCost(state,id)+' G'}</button></div>`;}).join('')}</div><div class="modal-actions"><button class="primary-button" data-action="close-modal">전장으로</button></div>`);}
const rarityName={common:'일반',rare:'레어',epic:'에픽'};
function artifactCard(id,attrs='',picked=false){const a=ARTIFACT[id];return `<button class="artifact-card rarity-${a.rarity} ${picked?'equipped':''}" ${attrs}>${itemIcon(id)}<div><small class="rarity-label">${rarityName[a.rarity]}${picked?' · 장착 중':''}</small><h3>${a.name}</h3><p>${a.text}</p></div>${picked?'<span class="equip-check">✓</span>':''}</button>`;}
function settlement(){const p=state.settlement;if(!p)return '';return `<div class="settlement"><span><b>+${p.base} G</b>물결 보상</span>${p.dividend?`<span><b>+${p.dividend} G</b>장미 배당</span>`:''}<span><b>${state.wave} / 12</b>물결 완료</span></div>`;}
function showReward(){showModal('reward',modalHeader('A BLESSING FOR THE ROAD','별빛의 축복','하나를 골라 다음 물결을 준비하세요.')+settlement()+`<div class="artifact-list blessing-list">${state.reward.map(id=>{const b=BLESSING[id];return `<button class="artifact-card blessing-card" data-reward="${id}">${itemIcon(id)}<div><small class="rarity-label">${b.category}</small><h3>${b.name}</h3><p>${b.text}</p></div><span class="choice-arrow">›</span></button>`;}).join('')}</div>`,{close:false});}
function showLoadout(){editingArtifacts=[...profile.artifacts];renderLoadout();}
function renderLoadout(){showModal('loadout',modalHeader('PACK A LITTLE WONDER','원정의 유물','조합에 맞춰 최대 3개. 모든 유물은 처음부터 선택할 수 있습니다.')+`<div class="artifact-list">${ARTIFACTS.map(a=>artifactCard(a.id,`data-relic="${a.id}" aria-pressed="${editingArtifacts.includes(a.id)}"`,editingArtifacts.includes(a.id))).join('')}</div><div class="roster-toolbar"><p>${editingArtifacts.length} / 3개 선택 · 일반 10 · 레어 6 · 에픽 4</p><button class="primary-button" data-action="save-loadout">이 유물로 준비하기</button></div>`);}
function showArtifacts(){showModal('artifacts',modalHeader('RELICS & BLESSINGS','함께하는 힘',`영구 공격 +${Math.round(state.globalAttack*100)}% · 강화 할인 ${Math.round(state.trainingDiscount*100)}%`)+`<div class="artifact-list">${state.artifacts.length?state.artifacts.map(id=>artifactCard(id,'tabindex="-1"')).join(''):'<p class="empty-note">이번에는 유물 없이 출발했습니다.<br>다음 원정에서 조합을 준비해 보세요.</p>'}</div><p class="blessing-record">받은 축복 ${state.blessings.length}개${state.blessings.length?' · '+state.blessings.map(id=>BLESSING[id].name).join(', '):''}</p><div class="modal-actions"><button class="primary-button" data-action="close-modal">전장으로</button></div>`);}
function showResult(){
  const won=state.phase==='victory';profile.best=Math.max(profile.best,state.wave);if(won&&!profile.cleared.includes(state.chapter))profile.cleared.push(state.chapter);saveProfile();saveRun();
  const ranked=Object.entries(state.stats.byHero).sort((a,b)=>b[1]-a[1]),top=ranked[0]?.[0]||state.deck[0],max=ranked[0]?.[1]||1;
  showModal('result',modalHeader(won?'THE STARS REMEMBER':'UNTIL THE NEXT DAWN',won?'별을 지켜냈습니다':'다시, 별을 모을 시간',won?'이 동행이 지켜낸 정원에 새벽이 찾아옵니다.':`${state.wave}번째 물결까지 함께 버텼습니다.`)+`<img class="result-hero" src="${pic(top,'figure')}" alt="${HERO[top].name}"><div class="result-stats"><div><strong>${state.stats.kills}</strong><span>막아낸 적</span></div><div><strong>${state.stats.merges}</strong><span>별의 합성</span></div><div><strong>${state.stats.skills}</strong><span>필살기</span></div></div>${ranked.filter(([id])=>state.deck.includes(id)).slice(0,4).map(([id,value])=>`<div class="damage-bar"><span>${HERO[id].name}</span><div><i style="width:${value/max*100}%"></i></div><b>${Math.round(value).toLocaleString()}</b></div>`).join('')}<div class="modal-actions"><button class="secondary-button" data-action="home">편성으로</button><button class="primary-button" data-action="${won?'endless':'retry'}">${won?'끝없는 수호':'다시 도전'}</button></div>`,{close:false});
}

document.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button||button.disabled)return;
  const data=button.dataset;
  if(data.action||data.skill||data.pick||data.inspect||data.relic||data.reward||data.upgrade)sound.click();
  if(data.action==='settings')showSettings();
  if(data.action==='pause'&&state)showPause();
  if(data.action==='close-modal')closeModal();
  if(data.action==='home')showHome();
  if(data.action==='deck')showDeck();
  if(data.action==='loadout')showLoadout();
  if(data.action==='save-loadout'){profile.artifacts=[...editingArtifacts];saveProfile();closeModal();updateHome();}
  if(data.action==='help')showHelp();
  if(data.action==='save-deck'&&editingDeck.length===6){profile.deck=[...editingDeck];saveProfile();closeModal();updateHome();}
  if(data.action==='endless'){closeModal();continueEndless(state);saveRun();updateUI(true);}
  if(data.action==='retry'){const deck=[...state.deck],chapter=state.chapter;profile.deck=deck;profile.chapter=chapter;start();}
  if(data.hero)showHero(data.hero);
  if(data.inspect){deckFocus=data.inspect;renderDeck();}
  if(data.pick){const idx=editingDeck.indexOf(data.pick);if(idx>=0)editingDeck.splice(idx,1);else if(editingDeck.length<6)editingDeck.push(data.pick);else{toast('먼저 한 명을 선택 해제하세요.');return;}deckFocus=data.pick;renderDeck();}
  if(data.relic){const idx=editingArtifacts.indexOf(data.relic);if(idx>=0)editingArtifacts.splice(idx,1);else if(editingArtifacts.length<3)editingArtifacts.push(data.relic);else{toast('유물은 최대 3개입니다. 하나를 해제해 주세요.');return;}renderLoadout();}
  if(data.skill&&state&&!paused){const r=command(cast(state,data.skill));if(r.ok){button.classList.remove('used');void button.offsetWidth;button.classList.add('used');select(-1);}}
  if(data.cell!==undefined)activateCell(Number(data.cell));
  if(data.upgrade){command(upgrade(state,data.upgrade));showTraining();}
  if(data.reward){const r=chooseReward(state,data.reward);if(r.ok){closeModal();command(r);}}
  if(data.unit==='close')select(-1);
  if(data.unit==='target'){cycleTarget(state,selected);lastUnit='';updateUnit();saveRun();}
  if(data.unit==='info'&&state.board[selected])showHero(state.board[selected].hero);
  if(data.unit==='sell'){command(sell(state,selected));select(-1);}
});
document.addEventListener('input',e=>{const name=e.target.dataset.setting;if(!name)return;profile[name]=name==='volume'?Number(e.target.value)/100:e.target.checked;sound.unlock();applySettings();saveProfile();});
$('play').addEventListener('click',()=>{sound.click();if(saved)showModal('new-run',modalHeader('A NEW JOURNEY','새 원정을 시작할까요?')+'<p class="confirm-text">진행하던 원정 대신 새 동행으로 출발합니다.</p><div class="modal-actions"><button class="secondary-button" data-action="close-modal">돌아가기</button><button class="primary-button" id="confirm-start">새 원정 시작</button></div>');else start();});
document.addEventListener('click',e=>{if(e.target.closest('#confirm-start'))start();});
$('resume').addEventListener('click',()=>start(true));
$('chapter-prev').addEventListener('click',()=>{profile.chapter=(profile.chapter+3)%4;sound.click();saveProfile();updateHome();});
$('chapter-next').addEventListener('click',()=>{profile.chapter=(profile.chapter+1)%4;sound.click();saveProfile();updateHome();});
$('summon').addEventListener('click',()=>{if(!state||paused)return;sound.unlock();const r=command(summon(state,preferred));if(r.ok){preferred=-1;select(-1);}});
$('training').addEventListener('click',()=>{if(state){sound.click();showTraining();}});
$('artifacts-button').addEventListener('click',()=>{if(state)showArtifacts();});
$('speed').addEventListener('click',()=>{speed=speed===1?1.5:1;$('speed').textContent=speed+'×';sound.click();});
let pointer=null;
function point(e){const box=$('arena').getBoundingClientRect();return {x:(e.clientX-box.left)/box.width*720,y:(e.clientY-box.top)/box.height*780};}
$('arena').addEventListener('pointerdown',e=>{if(!state||paused||modalKind||pointer||e.button!==0)return;const p=point(e),i=cellAt(p.x,p.y);pointer={id:e.pointerId,start:p,index:i,dragged:false};try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}sound.unlock();});
$('arena').addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;const p=point(e),u=state?.board[pointer.index];if(u&&(pointer.dragged||Math.hypot(p.x-pointer.start.x,p.y-pointer.start.y)>12)){pointer.dragged=true;renderer.drag={hero:u.hero,uid:u.uid,x:p.x,y:p.y};renderer.hover=cellAt(p.x,p.y);renderer.selected=pointer.index;$('unit-panel').hidden=true;}});
$('arena').addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;const p=point(e),to=cellAt(p.x,p.y);if(!paused&&!modalKind&&pointer.dragged&&to>=0){const r=command(move(state,pointer.index,to));if(r.ok)select(to);}else if(!paused&&!modalKind&&!pointer.dragged&&to>=0)activateCell(to);pointer=null;renderer.drag=null;renderer.hover=-1;renderer.selected=selected;lastUnit='';updateUnit();});
$('arena').addEventListener('pointercancel',()=>{pointer=null;renderer.drag=null;renderer.hover=-1;renderer.selected=selected;lastUnit='';updateUnit();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(modalKind&&!['reward','result'].includes(modalKind))closeModal();else if(state&&!modalKind)showPause();return;}
  if(modalKind){if(e.key==='Tab'){const nodes=[...$('modal-root').querySelectorAll('button:not(:disabled),input')].filter(x=>x.tabIndex>=0),first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}return;}
  if(!state||paused||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  if(e.code==='Space'){e.preventDefault();command(summon(state,preferred));}else if(/^[1-6]$/.test(e.key)){command(cast(state,state.deck[Number(e.key)-1]));}else if(e.key.toLowerCase()==='p')showPause();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){saveRun();sound.suspend();if(state&&!modalKind)showPause();}lastFrame=0;accumulator=0;});
window.addEventListener('pagehide',saveRun);
function fitArena(){if(screen!=='battle')return;const battle=$('battle'),header=battle.querySelector('.battle-header'),controls=battle.querySelector('.battle-controls'),dock=battle.querySelector('.inspection-dock'),padding=parseFloat(getComputedStyle(battle).paddingTop)||0;const available=battle.clientHeight-header.offsetHeight-controls.offsetHeight-dock.offsetHeight-padding;$('arena').parentElement.style.width=Math.max(180,Math.min(battle.clientWidth,available*720/780))+'px';}
window.addEventListener('resize',()=>{renderer.resize();fitArena();});
window.visualViewport?.addEventListener('resize',fitArena);
bindFullscreen({toast,onChange:()=>{renderer.resize();fitArena();}});

function drawHome(time){const ctx=$('home-art').getContext('2d');ctx.clearRect(0,0,720,510);ctx.save();const glow=ctx.createRadialGradient(360,295,10,360,295,290);glow.addColorStop(0,'#a4ccc91c');glow.addColorStop(1,'#a4ccc900');ctx.fillStyle=glow;ctx.fillRect(0,0,720,510);ctx.fillStyle='#061c2855';ctx.beginPath();ctx.ellipse(360,445,237,21,0,0,Math.PI*2);ctx.fill();art.hero(ctx,profile.deck[2],175,428+Math.sin(time)*2,270,{flip:false});art.hero(ctx,profile.deck[4],558,428+Math.sin(time+1)*2,285,{direction:'down'});art.hero(ctx,profile.deck[0],366,462+Math.sin(time+.4)*2,359);for(let i=0;i<16;i++){const x=80+(i*71)%580,y=(i*57-time*6+3000)%500;ctx.fillStyle=i%3===0?'#f5daa58a':'#bfdce555';ctx.fillRect(x,y,i%3===0?2:1,i%3===0?2:1);}ctx.restore();}
function frame(now){const dt=lastFrame?Math.min((now-lastFrame)/1000,.1):0;lastFrame=now;if(!document.hidden){
  if(screen==='home')drawHome(now/1000);
  else if(state){
    if(!paused&&!modalKind){const dilation=renderer.skill?.life>1.38&&!renderer.reduced? .4:1;accumulator+=dt*speed*dilation;let ticks=0;while(accumulator>=1/60&&ticks++<10){step(state,1/60);accumulator-=1/60;}saveTime+=dt;if(saveTime>2){saveRun();saveTime=0;}}
    processEvents();renderer.draw(state,dt);uiTime+=dt;if(uiTime>.1){updateUI();uiTime=0;}
  }
}requestAnimationFrame(frame);}
art.ready.then(()=>{preparePortraits();updateHome();if(state)buildSkills();if(modalKind==='deck')renderDeck();if(modalKind==='loadout')renderLoadout();if(art.failed.length)console.warn('Art fallbacks:',art.failed.join(', '));});
updateHome();requestAnimationFrame(frame);

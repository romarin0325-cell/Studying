import {HERO,HEROES,DEFAULT_DECK,ARTIFACT,CHAPTERS,BOSSES} from './content.js';
import {newRun,step,summon,move,sell,cast,upgrade,upgradeCost,summonCost,interest,dividend,cycleTarget,bestUnit,cellAt,cellPoint,BOARD,buy,rerollShop,chooseReward,nextWave,continueEndless,serialize,restore,validDeck,power} from './engine.js';
import {Art,Renderer} from './render.js';
import {Sound} from './audio.js';

const $=id=>document.getElementById(id),art=new Art(),sound=new Sound(),renderer=new Renderer($('arena'),art);
const PROFILE_KEY='astra.confluence.profile.v1',RUN_KEY='astra.confluence.run.v1';
const defaults={deck:[...DEFAULT_DECK],chapter:0,cleared:[],best:0,volume:.35,music:true,sound:true,reduced:false};
let profile={...defaults},state=null,saved=null,screen='home',paused=false,speed=1,selected=-1,preferred=-1,modalKind=null,toastTimer,bannerTimer,cutinTimer,lastFrame=0,accumulator=0,saveTime=0,uiTime=0,lastPhase='',lastUnit='',lastFocus=null,editingDeck=null;
const portraits={},figures={};
function storageGet(key){try{return localStorage.getItem(key);}catch{return null;}}
function storageSet(key,value){try{localStorage.setItem(key,value);return true;}catch{$('save-notice').hidden=false;return false;}}
try{const v=JSON.parse(storageGet(PROFILE_KEY)||'null');if(v){profile={...defaults,...v};if(!validDeck(profile.deck))profile.deck=[...DEFAULT_DECK];profile.chapter=Math.max(0,Math.min(3,Number(profile.chapter)||0));if(!Array.isArray(profile.cleared))profile.cleared=[];profile.volume=Math.max(0,Math.min(1,Number(profile.volume)||0));}}catch{}
saved=restore(storageGet(RUN_KEY));if(saved&&['victory','defeat'].includes(saved.phase))saved=null;
function saveProfile(){storageSet(PROFILE_KEY,JSON.stringify(profile));}
function saveRun(){if(state){storageSet(RUN_KEY,serialize(state));saved=['victory','defeat'].includes(state.phase)?null:restore(serialize(state));}}
function applySettings(){sound.enabled=profile.sound;sound.music=profile.music;sound.setVolume(profile.volume);renderer.reduced=profile.reduced||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
applySettings();
function toast(message){if(!message)return;clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,2300);}
function command(result){if(result?.ok===false&&result.reason)toast(result.reason);updateUI(true);saveRun();return result;}
function pic(id,kind='portrait'){return kind==='figure'?figures[id]||portraits[id]||'':portraits[id]||'';}
function portrait(id,attrs=''){return `<img src="${pic(id)}" alt="${HERO[id].name}" ${attrs}>`;}
function preparePortraits(){for(const h of HEROES){const c=document.createElement('canvas');c.width=128;c.height=128;const cx=c.getContext('2d'),img=art.images[h.art.atlas],p=h.art.portrait;if(img&&p)cx.drawImage(img,p.x-p.size/2,p.y-p.size/2,p.size,p.size,0,0,128,128);else art.hero(cx,h.id,64,150,180);portraits[h.id]=c.toDataURL('image/png');c.width=300;c.height=330;art.hero(c.getContext('2d'),h.id,150,316,330);figures[h.id]=c.toDataURL('image/png');}}
function updateHome(){
  const c=CHAPTERS[profile.chapter];$('chapter-number').textContent=`CHAPTER 0${profile.chapter+1}`;$('chapter-name').textContent=c.name;$('chapter-caption').textContent=c.caption;
  $('home-deck').innerHTML=profile.deck.map(id=>`<button class="portrait-button" data-hero="${id}" aria-label="${HERO[id].name} 정보">${portrait(id)}</button>`).join('');
  $('resume').hidden=!saved;if(saved)$('resume').textContent=`${CHAPTERS[saved.chapter].name} · ${saved.wave}번째 물결 이어가기`;
  $('record').textContent=profile.cleared.includes(profile.chapter)?'수호 완료 ✦':profile.best?`최고 ${profile.best}번째 물결`:'새로운 이야기';
}
function showHome(){saveRun();screen='home';paused=false;state=null;selected=-1;renderer.selected=-1;closeModal();$('battle').hidden=true;$('home').hidden=false;sound.battle=false;sound.boss=false;updateHome();window.scrollTo(0,0);}
function start(resume=false){sound.unlock();state=resume&&saved?restore(serialize(saved)):newRun({deck:profile.deck,chapter:profile.chapter});screen='battle';paused=false;speed=1;selected=-1;preferred=-1;renderer.selected=-1;renderer.effects=[];renderer.particles=[];renderer.floats=[];lastPhase='';lastUnit='';accumulator=0;closeModal();$('home').hidden=true;$('battle').hidden=false;$('speed').textContent='1×';buildSkills();updateUI(true);saveRun();window.scrollTo(0,0);}
function buildSkills(){
  $('skills').innerHTML=state.deck.map(id=>`<button class="skill-button" data-skill="${id}" aria-label="${HERO[id].name}: ${HERO[id].skill.name}, 별빛 ${HERO[id].skill.cost}" title="${HERO[id].skill.text}">${portrait(id)}<span class="skill-cost">✦ ${HERO[id].skill.cost}</span></button>`).join('');
  $('cell-access').innerHTML=Array.from({length:25},(_,i)=>{const p=cellPoint(i);return `<button data-cell="${i}" style="left:${(p.x-45)/720*100}%;top:${(p.y-45)/780*100}%;width:12.5%;height:${90/780*100}%" aria-label="${Math.floor(i/5)+1}행 ${i%5+1}열 빈칸"></button>`;}).join('');
}
function select(index){selected=index;renderer.selected=index;lastUnit='';updateUnit();}
function activateCell(index){
  if(!state||paused||modalKind||!['combat','intermission'].includes(state.phase))return;
  sound.unlock();if(selected>=0&&selected!==index&&state.board[selected]){const result=command(move(state,selected,index));if(result.ok)select(index);}
  else if(selected===index)select(-1);else{select(state.board[index]?index:-1);preferred=index;}
}
function updateUnit(){
  const u=state?.board[selected],panel=$('unit-panel');if(!u){panel.hidden=true;return;}
  const hash=`${u.uid}-${u.rank}-${u.priority}-${state.upgrades[u.hero]}`;if(hash===lastUnit)return;lastUnit=hash;
  const h=HERO[u.hero],label={first:'선두',strong:'강한 적',last:'후미'}[u.priority];panel.hidden=false;
  panel.innerHTML=`<div class="unit-top"><strong>${h.name}</strong><span class="unit-rank">${'✦'.repeat(u.rank)}</span><button class="close-unit" data-unit="close" aria-label="영웅 선택 닫기">×</button></div><p>${h.trait.text}</p><div class="unit-actions"><button data-unit="target">목표 · ${label}</button><button data-unit="info">능력 보기</button><button data-unit="sell">회수 +${Math.round(6*Math.pow(1.7,u.rank-1))} G</button></div>`;
}
function updateUI(force=false){
  if(!state||screen!=='battle')return;
  $('wave-label').textContent=`WAVE ${String(state.wave).padStart(2,'0')} ${state.endless?'· ENDLESS':'/ 12'}`;
  const total=12+state.wave*2+(state.wave%4===0?1:0),left=state.queue.length+state.enemies.length;
  $('wave-progress').firstElementChild.style.width=`${Math.max(0,100-left/total*100)}%`;
  $('gold').textContent=Math.floor(state.gold);$('health').textContent=state.health;$('gauge').textContent=Math.floor(state.gauge);$('gauge-fill').style.width=state.gauge+'%';
  $('summon-price').innerHTML=`${summonCost(state)} <small>G</small>`;$('summon').disabled=state.gold<summonCost(state)||state.board.every(Boolean)||!['combat','intermission'].includes(state.phase);
  $('interest').textContent=`다음 이자 +${interest(state)}${dividend(state)?` · 배당 +${dividend(state)}`:''}`;$('artifact-count').textContent=state.artifacts.length;
  for(const b of $('skills').children){const id=b.dataset.skill,live=!!bestUnit(state,id),ready=live&&state.gauge>=HERO[id].skill.cost&&state.phase==='combat'&&state.enemies.some(e=>e.hp>0);b.classList.toggle('ready',ready);b.classList.toggle('unavailable',!live);b.setAttribute('aria-disabled',String(!ready));}
  updateForecast();
  for(let i=0;i<25;i++){const u=state.board[i],b=$('cell-access').children[i];b?.setAttribute('aria-label',`${Math.floor(i/5)+1}행 ${i%5+1}열 ${u?`${HERO[u.hero].name} ${u.rank}성`:'빈칸'}`);}
  $('arena').dataset.wave=state.wave;$('arena').dataset.phase=state.phase;$('arena').dataset.units=state.board.filter(Boolean).length;$('arena').dataset.merges=state.stats.merges;
  $('boss-warning').hidden=!state.telegraph;if(state.telegraph)$('boss-warning').textContent=state.telegraph.text;
  const hints=['같은 영웅을 겹치면 더 강해집니다','루미는 같은 등급의 동료와 합성할 수 있어요','아래 영웅의 얼굴을 눌러 필살기를 사용하세요','골드를 남기면 물결이 끝날 때 이자를 받습니다'];
  $('hint').textContent=hints[Math.min(3,state.tutorial)];$('hint').style.opacity=state.wave<=2&&selected<0?'1':'0';
  updateUnit();
  if(lastPhase!==state.phase){lastPhase=state.phase;saveRun();if(state.phase==='shop')showShop();else if(state.phase==='reward')showReward();else if(state.phase==='victory'||state.phase==='defeat')showResult();}
  sound.battle=state.phase==='combat'&&!paused;sound.boss=state.enemies.some(e=>e.boss);
}
function updateForecast(){
  const bossWave=Math.ceil(state.wave/4)*4,boss=BOSSES[CHAPTERS[state.chapter].bosses[Math.min(2,Math.floor((bossWave-1)/4))]];
  $('forecast-kicker').textContent=state.wave===bossWave?'이번 물결의 보스':'다가오는 보스';
  $('forecast-name').textContent=boss.name;
  const pattern={seal:'봉인될 칸에서 이동',heal:'집중 공격으로 치유 저지',drain:'침식 전에 별빛 사용',rush:'감속으로 해일 저지'}[boss.pattern];
  $('forecast-detail').textContent=`${bossWave}번째 물결 · ${pattern}`;
  if(!$('journey-dots').children.length)$('journey-dots').innerHTML=Array.from({length:12},(_,i)=>`<i class="${(i+1)%4===0?'boss-mark':(i+1)%3===0?'shop-mark':''}">${(i+1)%4===0?'✦':(i+1)%3===0?'◇':''}</i>`).join('');
  for(let i=0;i<12;i++){const dot=$('journey-dots').children[i],w=(state.wave-1)%12+1;dot.classList.toggle('passed',i+1<w);dot.classList.toggle('current',i+1===w);}
  $('journey-dots').title='◇ 상점 · ✦ 보스';
}
function processEvents(){for(const e of state.events){renderer.event(e);sound.event(e);
  if(e.type==='wave'){banner(`WAVE ${String(e.wave).padStart(2,'0')}`);}
  if(e.type==='clear'){banner(`물결을 막았습니다 · +${e.base+e.interest+e.dividend} G`);}
  if(e.type==='boss')banner(e.name);
  if(e.type==='skill'){
    const cutin=$('skill-cutin');cutin.hidden=true;void cutin.offsetWidth;cutin.querySelector('img').src=pic(e.hero);cutin.querySelector('small').textContent=HERO[e.hero].name;cutin.querySelector('strong').textContent=e.name;cutin.hidden=false;clearTimeout(cutinTimer);cutinTimer=setTimeout(()=>cutin.hidden=true,700);
  }
}state.events.length=0;}
function banner(message){clearTimeout(bannerTimer);$('wave-banner').textContent=message;$('wave-banner').classList.add('visible');bannerTimer=setTimeout(()=>$('wave-banner').classList.remove('visible'),1700);}

function showModal(kind,body,{close=true}={}){
  if(!modalKind)lastFocus=document.activeElement;modalKind=kind;paused=screen==='battle';
  $('modal-root').innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">${close?'<button class="modal-close" data-action="close-modal" aria-label="닫기">×</button>':''}${body}</section>`;$('modal-root').hidden=false;
  $('modal-root').querySelector('button,input')?.focus({preventScroll:true});
}
function closeModal(){modalKind=null;$('modal-root').hidden=true;$('modal-root').innerHTML='';paused=false;if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
function modalHeader(eyebrow,title,description=''){return `<div class="modal-header"><span class="eyebrow">${eyebrow}</span><h2 id="modal-title">${title}</h2>${description?`<p>${description}</p>`:''}</div>`;}
function showPause(){saveRun();showModal('pause',modalHeader('A MOMENT OF STILLNESS','잠시, 숨을 고르다',`${CHAPTERS[state.chapter].name} · ${state.wave}번째 물결`)+`<div class="modal-actions"><button class="secondary-button" data-action="settings">설정</button><button class="secondary-button" data-action="help">플레이 방법</button></div><div class="modal-actions"><button class="primary-button" data-action="close-modal">수호 계속하기</button></div><div class="modal-actions"><button class="text-button" data-action="home">저장하고 나가기</button></div>`);}
function showSettings(){showModal('settings',modalHeader('SOUND & COMFORT','나에게 맞게')+`<label class="settings-row">소리 사용<input type="checkbox" data-setting="sound" ${profile.sound?'checked':''}></label><label class="settings-row">배경 음악<input type="checkbox" data-setting="music" ${profile.music?'checked':''}></label><label class="settings-row">음량<input type="range" min="0" max="100" value="${Math.round(profile.volume*100)}" data-setting="volume" aria-label="음량"></label><label class="settings-row">화면 흔들림·섬광 줄이기<input type="checkbox" data-setting="reduced" ${profile.reduced?'checked':''}></label><p class="settings-note">전투는 자동으로 저장됩니다. 다른 화면으로 이동하면 전투가 멈춥니다.</p><div class="modal-actions"><button class="primary-button" data-action="close-modal">적용</button></div>`);}
function showHelp(){showModal('help',modalHeader('HOW TO KEEP THE STARS','작은 선택, 다른 전투')+`<ol class="help-list"><li><strong>소환</strong>하면 편성한 6명 중 한 명이 등장합니다. 빈칸을 먼저 누르면 그곳에 소환합니다.</li><li><strong>같은 영웅·같은 등급</strong>을 겹치면 등급이 오릅니다. 루미는 다른 영웅의 합성 재료가 될 수 있습니다.</li><li>끌어 놓거나 두 칸을 차례로 누르면 <strong>이동·교환·합성</strong>합니다. 세이렌과 에인션트드래곤은 상하좌우 동료를 돕습니다.</li><li>아래 얼굴을 누르면 <strong>공유 별빛</strong>으로 필살기를 씁니다. 전장에 없는 동료는 사용할 수 없습니다.</li><li>남은 골드의 10%를 물결마다 <strong>이자</strong>로 받습니다. 기본 상한은 8골드입니다.</li><li>3·6·9번째 물결 뒤에는 상점, 4·8번째 보스 뒤에는 무료 유물이 기다립니다.</li></ol><div class="modal-actions"><button class="primary-button" data-action="close-modal">알겠어요</button></div>`);}
function showHero(id){const h=HERO[id];showModal('hero',modalHeader('COMPANION',h.name)+`<div class="hero-detail-top">${portrait(id)}<div><h3>${h.title}</h3><p>기본 공격력 ${h.damage}<br>공격 간격 ${h.interval}초</p></div></div><div class="detail-rule"><strong>전투 특성</strong>${h.trait.text}</div><div class="detail-rule"><strong>${h.skill.name} · 별빛 ${h.skill.cost}</strong>${h.skill.text}</div><div class="modal-actions"><button class="primary-button" data-action="close-modal">돌아가기</button></div>`);}
function showDeck(){editingDeck=[...profile.deck];renderDeck();}
function renderDeck(){showModal('deck',modalHeader('CHOOSE YOUR SIX','이번 원정의 동행','21명 중 6명을 선택하세요. 소환은 이 동료들 안에서만 나옵니다.')+`<div class="roster-grid">${HEROES.map(h=>`<button class="roster-card ${editingDeck.includes(h.id)?'picked':''}" data-pick="${h.id}" aria-pressed="${editingDeck.includes(h.id)}">${portrait(h.id)}<strong>${h.name}</strong><small>${h.skill.name}</small></button>`).join('')}</div><div class="roster-toolbar"><p>${editingDeck.length} / 6명 선택 · 모든 영웅은 기본 공격을 합니다</p><button class="primary-button" data-action="save-deck" ${editingDeck.length!==6?'disabled':''}>함께 떠나기</button></div>`);}
function showTraining(){showModal('training',modalHeader('GROW TOGETHER','동행 강화','이 원정에서 같은 영웅 모두의 공격력이 28%씩 증가합니다.')+`<div class="shop-balance">${state.gold} G</div><div class="training-list">${state.deck.map(id=>{const h=HERO[id],level=state.upgrades[id];return `<div class="training-item">${portrait(id)}<div><strong>${h.name} · ${level}단계</strong><small>공격력 +${level*28}% → +${(level+1)*28}%</small></div><button data-upgrade="${id}" ${level>=5||state.gold<upgradeCost(state,id)?'disabled':''}>${level>=5?'완료':upgradeCost(state,id)+' G'}</button></div>`;}).join('')}</div><div class="modal-actions"><button class="primary-button" data-action="close-modal">전장으로</button></div>`);}
const glyphs={hourglass:'⌛',coin:'◈',flame:'♨',snow:'❄',banner:'⚑',note:'♫',lantern:'✧',moon:'☾',leaf:'❧',feather:'⌁',star:'✦',crown:'♛'};
function artifactCard(id,attrs='',price=''){const a=ARTIFACT[id];return `<button class="artifact-card" ${attrs}><span class="artifact-icon" style="color:${a.color}">${glyphs[a.icon]}</span><div><h3>${a.name}</h3><p>${a.text}</p></div>${price?`<span class="price">${price}</span>`:''}</button>`;}
function settlement(){const p=state.settlement;if(!p)return '';return `<div class="settlement"><span><b>+${p.base}</b>수호 보상</span><span><b>+${p.interest}</b>저축 이자</span><span><b>+${p.dividend}</b>장미 배당</span></div>`;}
function showShop(){const shop=state.shop;showModal('shop',modalHeader('THE TRAVELLING MERCHANT','별빛을 싣고 온 상인','필요한 것을 고르거나, 다음 물결을 위해 골드를 남기세요.')+settlement()+`<div class="shop-balance">${state.gold} G <small>보유 골드</small></div><div class="artifact-list">${shop.items.map((item,i)=>item.kind==='artifact'?artifactCard(item.artifact,`data-buy="${i}" ${item.sold?'disabled':''}`,item.sold?'품절':`${item.price} G`):`<button class="artifact-card" data-buy="${i}" ${item.sold?'disabled':''}>${portrait(item.hero)}<div><h3>${HERO[item.hero].name} ✦✦</h3><p>2등급 동료가 곧바로 전장에 합류합니다.</p></div><span class="price">${item.sold?'합류':item.price+' G'}</span></button>`).join('')}</div><button class="shop-reroll" data-action="reroll">다른 물건 보기 · ${8+shop.rerolls*4} G</button><div class="modal-actions"><button class="primary-button" data-action="leave-shop">다음 물결로</button></div>`,{close:false});}
function showReward(){if(!state.reward.length){nextWave(state);return;}showModal('reward',modalHeader('A GIFT FROM THE STARS','별이 남긴 선물','이번 원정에 함께할 유물 하나를 고르세요.')+settlement()+`<div class="artifact-list">${state.reward.map(id=>artifactCard(id,`data-reward="${id}"`)).join('')}</div>`,{close:false});}
function showArtifacts(){showModal('artifacts',modalHeader('RELICS OF THIS JOURNEY','함께하는 유물')+`<div class="artifact-list">${state.artifacts.length?state.artifacts.map(id=>artifactCard(id,'tabindex="-1"')).join(''):'<p class="empty-note">상점과 보스 보상에서 유물을 얻습니다.<br>유물은 이번 원정이 끝날 때까지 함께합니다.</p>'}</div><div class="modal-actions"><button class="primary-button" data-action="close-modal">전장으로</button></div>`);}
function showResult(){
  const won=state.phase==='victory';profile.best=Math.max(profile.best,state.wave);if(won&&!profile.cleared.includes(state.chapter))profile.cleared.push(state.chapter);saveProfile();saveRun();
  const ranked=Object.entries(state.stats.byHero).sort((a,b)=>b[1]-a[1]),top=ranked[0]?.[0]||state.deck[0],max=ranked[0]?.[1]||1;
  showModal('result',modalHeader(won?'THE STARS REMEMBER':'UNTIL THE NEXT DAWN',won?'별을 지켜냈습니다':'다시, 별을 모을 시간',won?'이 동행이 지켜낸 정원에 새벽이 찾아옵니다.':`${state.wave}번째 물결까지 함께 버텼습니다.`)+`<img class="result-hero" src="${pic(top,'figure')}" alt="${HERO[top].name}"><div class="result-stats"><div><strong>${state.stats.kills}</strong><span>막아낸 적</span></div><div><strong>${state.stats.merges}</strong><span>별의 합성</span></div><div><strong>${state.stats.skills}</strong><span>필살기</span></div></div>${ranked.filter(([id])=>state.deck.includes(id)).slice(0,4).map(([id,value])=>`<div class="damage-bar"><span>${HERO[id].name}</span><div><i style="width:${value/max*100}%"></i></div><b>${Math.round(value).toLocaleString()}</b></div>`).join('')}<div class="modal-actions"><button class="secondary-button" data-action="home">편성으로</button><button class="primary-button" data-action="${won?'endless':'retry'}">${won?'끝없는 수호':'다시 도전'}</button></div>`,{close:false});
}

document.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button||button.disabled)return;
  const data=button.dataset;
  if(data.action||data.skill||data.pick||data.buy||data.reward||data.upgrade)sound.click();
  if(data.action==='settings')showSettings();
  if(data.action==='pause'&&state)showPause();
  if(data.action==='close-modal')closeModal();
  if(data.action==='home')showHome();
  if(data.action==='deck')showDeck();
  if(data.action==='help')showHelp();
  if(data.action==='save-deck'&&editingDeck.length===6){profile.deck=[...editingDeck];saveProfile();closeModal();updateHome();}
  if(data.action==='leave-shop'){closeModal();nextWave(state);saveRun();updateUI(true);}
  if(data.action==='reroll'){command(rerollShop(state));showShop();}
  if(data.action==='endless'){closeModal();continueEndless(state);saveRun();updateUI(true);}
  if(data.action==='retry'){const deck=[...state.deck],chapter=state.chapter;profile.deck=deck;profile.chapter=chapter;start();}
  if(data.hero)showHero(data.hero);
  if(data.pick){const idx=editingDeck.indexOf(data.pick);if(idx>=0)editingDeck.splice(idx,1);else if(editingDeck.length<6)editingDeck.push(data.pick);else{toast('먼저 한 명을 선택 해제하세요.');return;}const scroll=$('modal-root').querySelector('.modal').scrollTop;renderDeck();$('modal-root').querySelector('.modal').scrollTop=scroll;}
  if(data.skill&&state&&!paused){const r=command(cast(state,data.skill));if(r.ok){button.classList.remove('used');void button.offsetWidth;button.classList.add('used');select(-1);}}
  if(data.cell!==undefined)activateCell(Number(data.cell));
  if(data.upgrade){command(upgrade(state,data.upgrade));showTraining();}
  if(data.buy!==undefined){command(buy(state,Number(data.buy)));showShop();}
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
$('arena').addEventListener('pointerdown',e=>{if(!state||paused||modalKind)return;const p=point(e),i=cellAt(p.x,p.y);pointer={id:e.pointerId,start:p,index:i,dragged:false};try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}sound.unlock();});
$('arena').addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;const p=point(e),u=state?.board[pointer.index];if(u&&(pointer.dragged||Math.hypot(p.x-pointer.start.x,p.y-pointer.start.y)>12)){pointer.dragged=true;renderer.drag={hero:u.hero,uid:u.uid,x:p.x,y:p.y};renderer.hover=cellAt(p.x,p.y);renderer.selected=pointer.index;$('unit-panel').hidden=true;}});
$('arena').addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;const p=point(e),to=cellAt(p.x,p.y);if(pointer.dragged&&to>=0){const r=command(move(state,pointer.index,to));if(r.ok)select(to);}else if(!pointer.dragged&&to>=0)activateCell(to);pointer=null;renderer.drag=null;renderer.hover=-1;renderer.selected=selected;updateUnit();});
$('arena').addEventListener('pointercancel',()=>{pointer=null;renderer.drag=null;renderer.hover=-1;renderer.selected=selected;lastUnit='';updateUnit();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(modalKind&&!['shop','reward','result'].includes(modalKind))closeModal();else if(state&&!modalKind)showPause();return;}
  if(modalKind){if(e.key==='Tab'){const nodes=[...$('modal-root').querySelectorAll('button:not(:disabled),input')].filter(x=>x.tabIndex>=0),first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}return;}
  if(!state||paused||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  if(e.code==='Space'){e.preventDefault();command(summon(state,preferred));}else if(/^[1-6]$/.test(e.key)){command(cast(state,state.deck[Number(e.key)-1]));}else if(e.key.toLowerCase()==='p')showPause();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){saveRun();sound.suspend();if(state&&!modalKind)showPause();}lastFrame=0;accumulator=0;});
window.addEventListener('pagehide',saveRun);
window.addEventListener('resize',()=>renderer.resize());

function drawHome(time){const ctx=$('home-art').getContext('2d');ctx.clearRect(0,0,720,510);ctx.save();const glow=ctx.createRadialGradient(360,295,10,360,295,290);glow.addColorStop(0,'#a4ccc91c');glow.addColorStop(1,'#a4ccc900');ctx.fillStyle=glow;ctx.fillRect(0,0,720,510);ctx.fillStyle='#061c2855';ctx.beginPath();ctx.ellipse(360,445,237,21,0,0,Math.PI*2);ctx.fill();art.hero(ctx,profile.deck[2],175,428+Math.sin(time)*2,270,{flip:false});art.hero(ctx,profile.deck[4],558,428+Math.sin(time+1)*2,285,{direction:'down'});art.hero(ctx,profile.deck[0],366,462+Math.sin(time+.4)*2,359);for(let i=0;i<16;i++){const x=80+(i*71)%580,y=(i*57-time*6+3000)%500;ctx.fillStyle=i%3===0?'#f5daa58a':'#bfdce555';ctx.fillRect(x,y,i%3===0?2:1,i%3===0?2:1);}ctx.restore();}
function frame(now){const dt=lastFrame?Math.min((now-lastFrame)/1000,.1):0;lastFrame=now;if(!document.hidden){
  if(screen==='home')drawHome(now/1000);
  else if(state){
    if(!paused&&!modalKind){const dilation=renderer.skill?.life>1.38&&!renderer.reduced? .4:1;accumulator+=dt*speed*dilation;let ticks=0;while(accumulator>=1/60&&ticks++<10){step(state,1/60);accumulator-=1/60;}saveTime+=dt;if(saveTime>2){saveRun();saveTime=0;}}
    processEvents();renderer.draw(state,dt);uiTime+=dt;if(uiTime>.1){updateUI();uiTime=0;}
  }
}requestAnimationFrame(frame);}
art.ready.then(()=>{preparePortraits();updateHome();if(state)buildSkills();if(art.failed.length)console.warn('Art fallbacks:',art.failed.join(', '));});
updateHome();requestAnimationFrame(frame);

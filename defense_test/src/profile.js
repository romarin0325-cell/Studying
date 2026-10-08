import {HERO,HEROES,ARTIFACT,ARTIFACTS,DEFAULT_DECK,TUNING} from './content.js';
import {calendar,duplicateCost,levelCost,dispatchSlots,dispatchReward,combatPower,stageReward,idleReward,drawCharacter,drawRelic,HOUR} from './economy.js';
import {resumeBattle,battleMeta} from './battle.js';
import {migrateMonthly,validRecord,betterRecord,currentRecord,monthlyReward} from './monthly.js';
import {TEAM_SIZE,SAVE_KEY} from './team-config.js';
import {MEMORIAL_STORIES} from './memorial.js';

export {SAVE_KEY};
const entry=owned=>({owned,level:1,enhance:0,copies:0,bond:0});
export function createProfile(now=Date.now()){
  return {version:1,revision:0,dreams:600,dust:180,cleared:0,garden:1,deck:DEFAULT_DECK.slice(0,TEAM_SIZE),partner:'star_boy',
    heroes:Object.fromEntries(HEROES.map(h=>[h.id,entry(DEFAULT_DECK.includes(h.id))])),
    relics:Object.fromEntries(ARTIFACTS.map(a=>[a.id,{owned:false,enhance:0,copies:0}])),equipped:[],dispatches:[],
    draws:0,relicDraws:0,rng:0x13579bdf,history:[],idleAt:now,clockAt:now,petDay:'',memories:{},weekly:null,monthly:null,
    monthlyBest:null,monthlyLifetime:null,monthlyClaim:null,
    daily:freshDaily(now),settings:{sound:true,auto:true,reduced:false,quality:'standard'},active:null,results:[]};
}
const integer=(n,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
// Daily missions are things any player does just by playing (UI part 2):
// finish an expedition, merge five times, collect the shooting stars. A free
// single summon replaces the old "spend gems to earn gems" mission.
export const DAILY_MISSIONS=Object.freeze([{id:'combat',name:'원정 1회 완료',reward:60},{id:'merge',name:'전투에서 합성 5회',reward:30,goal:5},{id:'idle',name:'별똥별 수집',reward:30}]);
export function freshDaily(now){return {day:calendar(now).day,combat:false,merges:0,idle:false,free:false,claimed:[]};}
export const missionDone=(daily,id)=>id==='merge'?daily.merges>=5:!!daily[id];
export function validateProfile(p){
  if(!p||p.version!==1||!integer(p.revision)||!integer(p.dreams)||!integer(p.dust)||!integer(p.garden)||p.garden<1||!integer(p.cleared,45)||!integer(p.rng,0xffffffff)||!p.rng||!integer(p.draws)||!integer(p.relicDraws))return false;
  if(!p.heroes||!p.relics||HEROES.some(h=>{const e=p.heroes[h.id];return !e||typeof e.owned!=='boolean'||!integer(e.level)||e.level<1||!integer(e.enhance)||!integer(e.copies)||!integer(e.bond);}))return false;
  if(ARTIFACTS.some(a=>{const e=p.relics[a.id];return !e||typeof e.owned!=='boolean'||!integer(e.enhance)||!integer(e.copies);}))return false;
  if(!p.memories||typeof p.memories!=='object'||Array.isArray(p.memories)||Object.entries(p.memories).some(([id,m])=>!MEMORIAL_STORIES[id]||!p.heroes[id]?.owned||p.heroes[id].bond<10||!m||!integer(m.page,MEMORIAL_STORIES[id].paragraphs.length-1)||typeof m.read!=='boolean'))return false;
  if(!Array.isArray(p.deck)||p.deck.length!==TEAM_SIZE||new Set(p.deck).size!==TEAM_SIZE||p.deck.some(id=>!p.heroes[id]?.owned)||!p.heroes[p.partner]?.owned)return false;
  if(!Array.isArray(p.equipped)||p.equipped.length>3||new Set(p.equipped).size!==p.equipped.length||p.equipped.some(id=>!p.relics[id]?.owned))return false;
  if(!Array.isArray(p.dispatches)||p.dispatches.length>dispatchSlots(p.cleared)||new Set(p.dispatches.map(d=>d.hero)).size!==p.dispatches.length||new Set(p.dispatches.map(d=>d.slot)).size!==p.dispatches.length)return false;
  if(p.dispatches.some(d=>!p.heroes[d.hero]?.owned||!integer(d.slot,3)||d.slot>=dispatchSlots(p.cleared)||!integer(d.start)||!integer(d.end)||d.end-d.start!==TUNING.dispatchHours*HOUR||!integer(d.reward)||d.dust!==undefined&&!integer(d.dust)))return false;
  if(p.deck.some(id=>p.dispatches.some(d=>d.hero===id)))return false;
  if(!integer(p.idleAt)||!integer(p.clockAt)||typeof p.petDay!=='string'||!p.daily||typeof p.daily.day!=='string'||!Array.isArray(p.daily.claimed)||p.daily.claimed.some(id=>!DAILY_MISSIONS.some(m=>m.id===id))||new Set(p.daily.claimed).size!==p.daily.claimed.length)return false;
  if(['combat','idle','free'].some(k=>typeof p.daily[k]!=='boolean')||!integer(p.daily.merges,9999)||!p.settings||['sound','auto','reduced'].some(k=>typeof p.settings[k]!=='boolean'))return false;
  if(!['standard','high','low'].includes(p.settings.quality)||!['monthlyBest','monthlyLifetime','monthlyClaim'].every(k=>validRecord(p[k])))return false;
  if(p.monthlyClaim&&p.monthlyClaim.period!==p.monthly)return false;
  if(!Array.isArray(p.history)||p.history.length>50||p.history.some(h=>!integer(h.at)||!['normal','season','relic'].includes(h.banner)||!(HERO[h.id]||ARTIFACT[h.id])||typeof h.fresh!=='boolean'))return false;
  if(!Array.isArray(p.results)||p.results.length>30||p.results.some(r=>!integer(r.at)||!['main','weekly','monthly'].includes(r.mode)||!integer(r.stage,45)||!integer(r.round)||!integer(r.reward)||typeof r.won!=='boolean'))return false;
  for(const k of ['weekly','monthly'])if(p[k]!==null&&(typeof p[k]!=='string'||!/^\d{4}-\d{2}(?:-\d{2})?$/.test(p[k])))return false;
  if(p.active!==null&&(!p.active||typeof p.active!=='object'||!['main','weekly','monthly'].includes(p.active.mode)||!Array.isArray(p.active.deck)||p.active.deck.length!==TEAM_SIZE||new Set(p.active.deck).size!==TEAM_SIZE||p.active.deck.some(id=>!p.heroes[id]?.owned||p.dispatches.some(d=>d.hero===id))||!integer(p.active.stage,45)||p.active.stage<1||!integer(p.active.started)||typeof p.active.token!=='string'||!integer(p.active.boon,TEAM_SIZE)))return false;
  const a=p.active;
  if(a){
    if(a.stage>p.cleared+1||!integer(a.seed,0xffffffff)||!a.seed||a.token.length>100||a.run!==null&&(typeof a.run!=='string'||a.run.length>2*1024*1024))return false;
    if(a.mode==='weekly'){
      if(!Array.isArray(a.draftPool)||a.draftPool.length<TEAM_SIZE||a.draftPool.length>HEROES.length||new Set(a.draftPool).size!==a.draftPool.length||a.draftPool.some(id=>!p.heroes[id]?.owned||p.dispatches.some(d=>d.hero===id)))return false;
      if(!Array.isArray(a.draft)||a.draft.length>TEAM_SIZE||new Set(a.draft).size!==a.draft.length||a.draft.some(id=>!a.draftPool.includes(id))||a.boon>a.draft.length)return false;
      if(!Array.isArray(a.offers)||a.offers.length!==(a.draft.length===TEAM_SIZE?0:2)||a.offers.some(o=>!o||!a.draftPool.includes(o.id)||a.draft.includes(o.id)||!['focus','spark'].includes(o.boon)))return false;
      if(a.draft.length<TEAM_SIZE&&a.draftPool.length-a.draft.length>1&&a.offers[0].id===a.offers[1].id)return false;
      if(a.draft.length===TEAM_SIZE&&a.deck.join()!==a.draft.join()||a.draft.length<TEAM_SIZE&&a.run!==null||p.weekly!==calendar(a.started).week)return false;
    }else if(a.boon!==0)return false;
    if(a.run!==null&&!resumeBattle(p))return false;
  }
  return true;
}
// Stat renewal: per-companion levels become one shared garden level. Dust
// already spent on companion levels is re-spent on garden levels (old cost
// 18×1.14^(L-1)); the remainder is refunded. An in-progress run keeps going
// with the renewed permanent multipliers.
const legacyLevelCost=level=>Math.ceil(18*1.14**(level-1));
export function migrateGarden(p){
  if(p.garden!==undefined||!p.heroes||typeof p.heroes!=='object')return;
  let spent=0;
  for(const e of Object.values(p.heroes))if(e&&Number.isSafeInteger(e.level))for(let l=1;l<e.level;l++)spent+=legacyLevelCost(l);
  p.garden=1;while(spent>=levelCost(p.garden)){spent-=levelCost(p.garden);p.garden++;}
  if(Number.isSafeInteger(p.dust))p.dust+=spent;
  for(const e of Object.values(p.heroes))if(e&&Number.isSafeInteger(e.level))e.level=1;
  const a=p.active;
  if(a?.run&&typeof a.run==='string'&&Array.isArray(a.deck)&&a.deck.every(id=>p.heroes[id])){try{const run=JSON.parse(a.run);run.meta=battleMeta(p,a.deck);a.run=JSON.stringify(run);}catch{}}
}
export function parseProfile(raw){try{const p=typeof raw==='string'?JSON.parse(raw):structuredClone(raw);if(p?.version===1){migrateMonthly(p);migrateGarden(p);migrateDaily(p);if(p.memories===undefined)p.memories={};if(p.settings&&p.settings.quality===undefined)p.settings.quality='standard';}return validateProfile(p)?p:null;}catch{return null;}}
export function random(p){let x=p.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;p.rng=x>>>0||1;return p.rng/4294967296;}
export const away=(p,id)=>p.dispatches.some(d=>d.hero===id);
export const available=p=>HEROES.filter(h=>p.heroes[h.id].owned&&!away(p,h.id)).map(h=>h.id);
export const teamPower=p=>p.deck.reduce((sum,id)=>sum+combatPower(id,p.heroes[id],p.garden),0);
function draftOffers(p){
  const a=p.active,pool=a.draftPool.filter(id=>!a.draft.includes(id));
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random(p)*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool.length===1?[{id:pool[0],boon:'focus'},{id:pool[0],boon:'spark'}]:pool.slice(0,2).map(id=>({id,boon:random(p)<.5?'focus':'spark'}));
}
export function safeNow(p,now){return Math.max(p.clockAt,Math.floor(now));}
function rollDay(p,now){if(p.daily.day!==calendar(now).day)p.daily=freshDaily(now);}
// Old saves kept draw/dispatch missions; keep today's finished expedition only.
export function migrateDaily(p){
  const d=p.daily;if(!d||typeof d!=='object'||d.merges!==undefined)return;
  p.daily={day:typeof d.day==='string'?d.day:'',combat:d.combat===true,merges:0,idle:false,free:false,claimed:Array.isArray(d.claimed)?d.claimed.filter(id=>id==='combat'):[]};
}
function receive(table,id){const e=table[id],fresh=!e.owned;if(fresh)e.owned=true;else e.copies++;return fresh;}
export function command(p,action,args={},now=Date.now()){
  now=safeNow(p,now);rollDay(p,now);
  const no=message=>({ok:false,message});
  if(action==='memory'){
    const story=MEMORIAL_STORIES[args.id],e=p.heroes[args.id];if(!story||!e?.owned||e.bond<story.unlockBond||!integer(args.page,story.paragraphs.length-1))return no('호감도 10에서 인연 이야기가 열립니다.');
    p.memories[args.id]={page:args.page,read:!!p.memories[args.id]?.read||args.page===story.paragraphs.length-1};return {ok:true};
  }
  if(action==='draw'){
    const banner=args.banner,count=args.count,free=args.free===true;if(!['normal','season','relic'].includes(banner)||![1,10].includes(count))return no('소환 정보를 확인하세요.');
    if(free&&(banner!=='normal'||count!==1||p.daily.free))return no('오늘의 무료 소환은 이미 사용했습니다.');
    const cost=free?0:(banner==='relic'?TUNING.relicDrawCost:TUNING.heroDrawCost)*count;if(p.dreams<cost)return no(`꿈의결정이 부족합니다. (${cost} 필요)`);if(free)p.daily.free=true;
    p.dreams-=cost;const items=[];
    for(let i=0;i<count;i++){
      const id=banner==='relic'?drawRelic(()=>random(p),p.relicDraws):drawCharacter(()=>random(p),banner==='season',calendar(now).guardian);
      const fresh=receive(banner==='relic'?p.relics:p.heroes,id),item={id,fresh,banner,at:now};items.push(item);p.history.unshift(item);
      if(banner==='relic')p.relicDraws++;else p.draws++;
    }p.history=p.history.slice(0,50);return {ok:true,items,cost,free};
  }
  if(action==='level'){
    if(p.active)return no('원정 종료 후 성장할 수 있습니다.');const cost=levelCost(p.garden);if(!Number.isSafeInteger(cost)||p.dust<cost)return no('별가루가 부족합니다.');
    p.dust-=cost;p.garden++;return {ok:true,message:`정원 Lv.${p.garden} 달성 · 모든 동료 위력 +4%`};
  }
  if(action==='enhance'){
    const table=args.kind==='relic'?p.relics:p.heroes,e=table[args.id];if(!e?.owned||p.active)return no('원정 종료 후 강화할 수 있습니다.');const cost=duplicateCost(e.enhance);if(!Number.isSafeInteger(cost)||e.copies<cost)return no(`중복 ${args.kind==='relic'?'유물':'동료'}이 ${cost}개 필요합니다.`);e.copies-=cost;e.enhance++;return {ok:true,message:`강화 +${e.enhance} 달성`};
  }
  if(action==='partner'){if(!p.heroes[args.id]?.owned)return no('아직 획득하지 못한 동료입니다.');p.partner=args.id;return {ok:true};}
  if(action==='pet'){const day=calendar(now).day;if(p.petDay===day)return no('오늘 인사는 이미 완료했습니다.');p.petDay=day;p.heroes[p.partner].bond++;p.dreams+=40;return {ok:true,message:'인사 완료 · 꿈의결정 +40'};}
  if(action==='deck'){
    const ids=args.ids;if(p.active||!Array.isArray(ids)||ids.length!==TEAM_SIZE||new Set(ids).size!==TEAM_SIZE||ids.some(id=>!p.heroes[id]?.owned||away(p,id)))return no(`파견 중이 아닌 서로 다른 동료 ${TEAM_SIZE}명을 선택하세요.`);p.deck=[...ids];return {ok:true,message:'편성을 저장했습니다.'};
  }
  if(action==='equip'){
    if(p.active||!p.relics[args.id]?.owned)return no('보유한 유물만 장착할 수 있습니다.');const at=p.equipped.indexOf(args.id);if(at>=0)p.equipped.splice(at,1);else if(p.equipped.length<3)p.equipped.push(args.id);else return no('유물은 최대 3개까지 장착할 수 있습니다.');return {ok:true};
  }
  if(action==='dispatch'){
    if(p.active||!integer(args.slot,3)||args.slot>=dispatchSlots(p.cleared)||p.dispatches.some(d=>d.slot===args.slot))return no('사용 가능한 파견 슬롯을 선택하세요.');
    if(!p.heroes[args.id]?.owned||away(p,args.id)||available(p).length<=TEAM_SIZE)return no(`전투에 남을 동료 ${TEAM_SIZE}명이 필요합니다. 먼저 동료를 더 모으세요.`);
    const {dust,dreams}=dispatchReward(combatPower(args.id,p.heroes[args.id],p.garden),p.cleared);p.dispatches.push({slot:args.slot,hero:args.id,start:now,end:now+TUNING.dispatchHours*HOUR,reward:dreams,dust});
    p.deck=p.deck.filter(id=>id!==args.id);for(const id of available(p))if(p.deck.length<TEAM_SIZE&&!p.deck.includes(id))p.deck.push(id);return {ok:true,message:'파견 출발 · 20시간 후 귀환'};
  }
  if(action==='claimDispatch'){
    if(p.active)return no('원정 종료 후 파견 보상을 받을 수 있습니다.');const d=p.dispatches.find(d=>d.slot===args.slot);if(!d||d.end>now)return no('아직 파견 중입니다.');// Dispatches sent before dust rewards keep the crystals they promised.
    const dust=d.dust||0;p.dreams+=d.reward;p.dust+=dust;p.dispatches=p.dispatches.filter(x=>x!==d);return {ok:true,reward:d.reward,dust,message:`파견 보상 수령 · ${dust?`별가루 +${dust} · `:''}꿈의결정 +${d.reward}`};
  }
  if(action==='idle'){const reward=idleReward(p,now);if(reward<1)return no('아직 모인 별똥별이 없습니다.');p.dust+=reward;p.idleAt=now;p.daily.idle=true;return {ok:true,reward,message:`별똥별 수집 · 별가루 +${reward}`};}
  if(action==='daily'){
    const mission=DAILY_MISSIONS.find(m=>m.id===args.id);if(!mission||!missionDone(p.daily,mission.id)||p.daily.claimed.includes(mission.id))return no('아직 받을 수 없는 보상입니다.');p.daily.claimed.push(mission.id);const reward=mission.reward;p.dreams+=reward;return {ok:true,message:`일일 임무 보상 · 꿈의결정 +${reward}`};
  }
  if(action==='begin'){
    if(p.active)return no('진행 중인 원정을 먼저 이어하세요.');const mode=args.mode;if(!['main','weekly','monthly'].includes(mode))return no('원정 종류를 확인하세요.');
    const ids=args.deck||p.deck;if(!Array.isArray(ids)||ids.length!==TEAM_SIZE||new Set(ids).size!==TEAM_SIZE||ids.some(id=>!p.heroes[id]?.owned||away(p,id)))return no(`파견 중이 아닌 동료 ${TEAM_SIZE}명이 필요합니다.`);
    const c=calendar(now),stage=args.stage||Math.min(45,p.cleared+1);if(!integer(stage,45)||stage<1||stage>p.cleared+1)return no('이전 스테이지를 먼저 클리어하세요.');
    if(mode!=='main'&&p.cleared<3)return no('스테이지 3 클리어 시 해금됩니다.');
    if(mode==='weekly'&&p.weekly===c.week)return no('이번 주의 입장 횟수를 모두 사용했습니다.');
    if(mode==='weekly')p.weekly=c.week;
    random(p);
    p.active={mode,stage,deck:[...ids],started:now,seed:p.rng,token:`${now}-${p.rng}-${p.revision}`,boon:0,run:null};
    if(mode==='weekly'){p.active.draftPool=available(p);p.active.draft=[];p.active.offers=draftOffers(p);}return {ok:true};
  }
  if(action==='draft'){
    const a=p.active;if(a?.mode!=='weekly'||a.draft?.length>=TEAM_SIZE||!integer(args.index,1))return no('제시된 두 후보 중에서 선택하세요.');
    const choice=a.offers?.[args.index];if(!choice||a.draft.includes(choice.id)||away(p,choice.id))return no('선택할 수 없는 동료입니다.');
    a.draft.push(choice.id);if(choice.boon==='focus')a.boon++;
    if(a.draft.length===TEAM_SIZE){a.deck=[...a.draft];a.offers=[];}else a.offers=draftOffers(p);return {ok:true};
  }
  if(action==='settle'){
    const a=p.active;if(!a||a.token!==args.token||!integer(args.round))return no('이미 정산한 원정입니다.');let reward=0;
    if(a.mode==='main'){
      if(args.won&&a.stage===p.cleared+1){p.cleared=a.stage;reward=stageReward(a.stage);}
      p.dust+=args.won?40+a.stage*8:12;
    }else if(a.mode==='weekly')reward=120+args.round*60;
    let record=null,newBest=false;
    if(a.mode==='monthly'){
      record={period:calendar(now).month,token:a.token,round:args.round,damage:args.damage??0,seconds:args.seconds??0,at:now,deck:[...a.deck]};
      if(!validRecord(record))return no('전투 기록을 확인하세요.');
      newBest=betterRecord(record,currentRecord(p,now));if(newBest)p.monthlyBest=record;
      if(betterRecord(record,p.monthlyLifetime))p.monthlyLifetime=record;
    }
    p.dreams+=reward;p.daily.combat=true;if(integer(args.merges,999))p.daily.merges=Math.min(9999,p.daily.merges+args.merges);p.results.unshift({at:now,mode:a.mode,stage:a.stage,round:args.round,reward,won:!!args.won});p.results=p.results.slice(0,30);p.active=null;return {ok:true,reward,record,newBest};
  }
  if(action==='claimMonthly'){
    const record=currentRecord(p,now);if(p.active||!record||record.token!==args.token)return no('현재 월간 최고 기록을 확인하세요.');
    if(p.monthly===record.period)return no('이번 달 기록 보상은 이미 확정했습니다.');
    const reward=monthlyReward(record);p.dreams+=reward;p.monthly=record.period;p.monthlyClaim=structuredClone(record);
    return {ok:true,reward,message:`월간 기록 보상 확정 · 꿈의결정 +${reward}`};
  }
  if(action==='setting'){if(args.id==='quality'){if(!['standard','high','low'].includes(args.value))return no('화질을 확인하세요.');}else if(!['sound','auto','reduced'].includes(args.id)||typeof args.value!=='boolean')return no('설정 값을 확인하세요.');p.settings[args.id]=args.value;return {ok:true};}
  return no('사용할 수 없는 동작입니다.');
}
// Every command commits the entire profile, wallet and receipt together.
// A failed storage write never commits a draw, an entry ticket or a reward.
export class ProfileStore{
  constructor(storage,now=Date.now()){
    this.storage=storage;this.broken=false;this.conflict=false;this.warning='';let raw=null;
    try{raw=storage.getItem(SAVE_KEY);this.value=raw?parseProfile(raw):createProfile(now);if(!this.value){this.broken=true;this.warning='저장 데이터가 손상되었습니다. 백업을 불러오세요.';this.value=createProfile(now);}}catch{this.broken=true;this.warning='저장 공간을 사용할 수 없습니다. 브라우저 저장 권한을 확인하세요.';this.value=createProfile(now);}
    this.raw=raw;
  }
  transact(action,args={},now=Date.now()){
    if(this.broken||this.conflict)return {ok:false,message:this.warning||'다른 창에서 저장 내용이 바뀌었습니다. 이 창을 새로고침하세요.'};
    try{
      const disk=this.storage.getItem(SAVE_KEY);if(disk!==this.raw){this.conflict=true;return {ok:false,message:'다른 창에서 저장 내용이 바뀌었습니다. 이 창을 새로고침하세요.'};}
      const next=JSON.parse(JSON.stringify(this.value)),result=command(next,action,args,now);if(!result.ok)return result;
      next.revision++;next.clockAt=safeNow(next,now);if(!validateProfile(next))throw new Error('invalid transaction');
      const raw=JSON.stringify(next);this.storage.setItem(SAVE_KEY,raw);this.raw=raw;this.value=next;return result;
    }catch{return {ok:false,message:'저장하지 못해 동작을 취소했습니다. 저장 공간을 확인하세요.'};}
  }
  saveRun(run){
    if(!this.value.active)return true;
    try{if(this.storage.getItem(SAVE_KEY)!==this.raw){this.conflict=true;return false;}const next=JSON.parse(JSON.stringify(this.value));next.active.run=run;next.revision++;if(!validateProfile(next))return false;const raw=JSON.stringify(next);this.storage.setItem(SAVE_KEY,raw);this.raw=raw;this.value=next;return true;}catch{return false;}
  }
  import(raw){const p=parseProfile(raw);if(!p)return {ok:false,message:'올바른 백업 파일이 아닙니다.'};try{const text=JSON.stringify(p);this.storage.setItem(SAVE_KEY,text);this.raw=text;this.value=p;this.broken=false;this.conflict=false;this.warning='';return {ok:true};}catch{return {ok:false,message:'백업을 저장할 공간이 부족합니다.'};}}
}

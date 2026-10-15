import {HERO,HEROES,ARTIFACT,ARTIFACTS,DEFAULT_DECK,TUNING,TIERS,CHALLENGE_WAVES,ROSTER} from './content.js';
import {calendar,duplicateCost,relicCost,relicLevel,collectionBonus,levelCost,bedCost,bedOpen,BED_IDS,dispatchSlots,dispatchReward,combatPower,stageReward,idleReward,drawCharacter,drawRelic,HOUR} from './economy.js';
import {resumeBattle,battleMeta} from './battle.js';
import {migrateMonthly,validRecord,betterRecord,currentRecord,monthlyReward,weeklyReward} from './monthly.js';
import {TEAM_SIZE,SAVE_KEY,UNLOCKED} from './team-config.js';
import {unlockProfile,topUpUnlocked} from './test-unlock.js';
import {MEMORIAL_STORIES} from './memorial.js';
import {BOND_MAX,GIFT_IDS,GREETING_POINTS,FAVORITE,FAVORITE_LINES,GIFT_LINES,GIFTS,addBond,bondNeed,giftPoints} from './bond.js';
import {questionOf} from './quiz.js';
import {CONSTELLATIONS} from './library.js';

export {SAVE_KEY};
const entry=owned=>({owned,level:1,enhance:0,copies:0,bond:0,bondXp:0});
export function createProfile(now=Date.now()){
  return (UNLOCKED?unlockProfile:p=>p)({version:1,revision:0,dreams:600,dust:180,cleared:0,beds:{rose:0,spring:0,seed:0},bedRev:3,relicRev:2,deck:DEFAULT_DECK.slice(0,TEAM_SIZE),partner:'star_boy',
    heroes:Object.fromEntries(HEROES.map(h=>[h.id,entry(DEFAULT_DECK.includes(h.id))])),
    relics:Object.fromEntries(ARTIFACTS.map(a=>[a.id,{owned:false,enhance:0,copies:0}])),equipped:[],dispatches:[],
    draws:0,relicDraws:0,pity:{normal:0,season:0},rng:0x13579bdf,history:[],idleAt:now,clockAt:now,petDay:'',memories:{},weekly:null,monthly:null,gifts:{candy:0,letter:0,bouquet:0},basket:{at:now,next:0},lobby:null,
    monthlyBest:null,monthlyLifetime:null,monthlyClaim:null,
    daily:freshDaily(now),study:freshStudy(),settings:{sound:true,auto:true,reduced:false,quality:'standard'},active:null,results:[]});
}
const integer=(n,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
// Daily missions are things any player does just by playing (UI part 2):
// finish an expedition, merge five times, collect the shooting stars. A free
// single summon replaces the old "spend gems to earn gems" mission.
export const DAILY_MISSIONS=Object.freeze([{id:'combat',name:'원정 1회 완료',reward:60},{id:'merge',name:'전투에서 합성 5회',reward:30,goal:5},{id:'idle',name:'별똥별 수집',reward:30}]);
export function freshDaily(now){return {day:calendar(now).day,combat:false,merges:0,idle:false,free:false,bouquet:false,accel:false,claimed:[]};}
// Study (루미의 별의 서재): wrong answers wait in a notebook (latest pick kept); one a day becomes a star.
// Finishing a constellation unlocks its illustration and opens the next one.
export const WRONG_MAX=60;
export const freshStudy=()=>({wrong:[],solved:[],library:{index:0,stars:0,unlocked:[],day:''}});
function validStudy(s){
  if(!s||typeof s!=='object'||!Array.isArray(s.wrong)||s.wrong.length>WRONG_MAX||!s.library||typeof s.library!=='object')return false;
  const keys=new Set();
  for(const w of s.wrong){if(!w||!['concept','term'].includes(w.kind)||typeof w.id!=='string'||w.id.length>40||!(w.choice===-1||integer(w.choice,9))||!integer(w.at))return false;const key=w.kind+':'+w.id;if(keys.has(key))return false;keys.add(key);}
  if(!Array.isArray(s.solved)||s.solved.length>2000||new Set(s.solved).size!==s.solved.length||s.solved.some(k=>typeof k!=='string'||k.length>60))return false;
  const l=s.library;if(!integer(l.index,CONSTELLATIONS.length)||!integer(l.stars)||typeof l.day!=='string'||!Array.isArray(l.unlocked))return false;
  if(l.index<CONSTELLATIONS.length?l.stars>=CONSTELLATIONS[l.index].stars.length:l.stars!==0)return false;
  return l.unlocked.length===l.index&&l.unlocked.every((id,i)=>CONSTELLATIONS[i].id===id);
}
// Saves from before the library get an empty one; entries whose question left the course (a new subject) are dropped.
export function migrateStudy(p){
  if(p.study===undefined)p.study=freshStudy();
  if(Array.isArray(p.study?.wrong))p.study.wrong=p.study.wrong.filter(w=>w&&questionOf(w.kind,w.id));
  if(p.study&&typeof p.study==='object'){if(p.study.solved===undefined)p.study.solved=[];if(Array.isArray(p.study.solved))p.study.solved=p.study.solved.filter(k=>typeof k==='string'&&questionOf(...k.split(':')));}
}
// Gift basket: the clock starts when an old save first opens (nothing is owed for the time before).
export function migrateBasket(p){if(p.basket===undefined)p.basket={at:integer(p.clockAt)?p.clockAt:0,next:0};}
const BASKET_MS=TUNING.basketHours*HOUR;
export function basketState(p,now){const elapsed=Math.max(0,now-p.basket.at),ready=Math.min(TUNING.basketMax,Math.floor(elapsed/BASKET_MS));return {ready,full:ready>=TUNING.basketMax,nextIn:ready>=TUNING.basketMax?0:BASKET_MS-elapsed%BASKET_MS,next:p.basket.next};}
export const missionDone=(daily,id)=>id==='merge'?daily.merges>=5:!!daily[id];
export function validateProfile(p){
  if(!p||p.version!==1||!integer(p.revision)||!integer(p.dreams)||!integer(p.dust)||!p.beds||typeof p.beds!=='object'||Object.keys(p.beds).sort().join()!=='rose,seed,spring'||!BED_IDS.every(id=>integer(p.beds[id]))||p.bedRev!==3||p.relicRev!==2||!integer(p.cleared,45)||!integer(p.rng,0xffffffff)||!p.rng||!integer(p.draws)||!integer(p.relicDraws))return false;
  if(!p.pity||!integer(p.pity.normal)||!integer(p.pity.season))return false;
  if(!p.heroes||!p.relics||HEROES.some(h=>{const e=p.heroes[h.id];return !e||typeof e.owned!=='boolean'||!integer(e.level)||e.level<1||!integer(e.enhance)||!integer(e.copies)||!integer(e.bond,BOND_MAX)||!integer(e.bondXp)||e.bondXp>=Math.max(1,bondNeed(e.bond));}))return false;
  if(!p.gifts||typeof p.gifts!=='object'||Object.keys(p.gifts).sort().join()!=='bouquet,candy,letter'||!GIFT_IDS.every(id=>integer(p.gifts[id],999)))return false;
  if(p.lobby!==null&&!(MEMORIAL_STORIES[p.lobby]&&p.heroes[p.lobby]?.owned&&p.heroes[p.lobby].bond>=BOND_MAX))return false;
  if(ARTIFACTS.some(a=>{const e=p.relics[a.id];return !e||typeof e.owned!=='boolean'||!integer(e.enhance)||!integer(e.copies);}))return false;
  if(!p.memories||typeof p.memories!=='object'||Array.isArray(p.memories)||Object.entries(p.memories).some(([id,m])=>!MEMORIAL_STORIES[id]||!p.heroes[id]?.owned||p.heroes[id].bond<10||!m||!integer(m.page,MEMORIAL_STORIES[id].paragraphs.length-1)||typeof m.read!=='boolean'))return false;
  if(!Array.isArray(p.deck)||p.deck.length!==TEAM_SIZE||new Set(p.deck).size!==TEAM_SIZE||p.deck.some(id=>!p.heroes[id]?.owned)||!p.heroes[p.partner]?.owned)return false;
  if(!Array.isArray(p.equipped)||p.equipped.length>3||new Set(p.equipped).size!==p.equipped.length||p.equipped.some(id=>!p.relics[id]?.owned))return false;
  if(!Array.isArray(p.dispatches)||p.dispatches.length>dispatchSlots(p.cleared)||new Set(p.dispatches.map(d=>d.hero)).size!==p.dispatches.length||new Set(p.dispatches.map(d=>d.slot)).size!==p.dispatches.length)return false;
  if(p.dispatches.some(d=>!p.heroes[d.hero]?.owned||!integer(d.slot,3)||d.slot>=dispatchSlots(p.cleared)||!integer(d.start)||!integer(d.end)||d.end-d.start!==TUNING.dispatchHours*HOUR||!integer(d.reward)||d.dust!==undefined&&!integer(d.dust)))return false;
  if(p.deck.some(id=>p.dispatches.some(d=>d.hero===id)))return false;
  if(!integer(p.idleAt)||!integer(p.clockAt)||typeof p.petDay!=='string'||!p.daily||typeof p.daily.day!=='string'||!Array.isArray(p.daily.claimed)||p.daily.claimed.some(id=>!DAILY_MISSIONS.some(m=>m.id===id))||new Set(p.daily.claimed).size!==p.daily.claimed.length)return false;
  if(['combat','idle','free','bouquet','accel'].some(k=>typeof p.daily[k]!=='boolean')||!integer(p.daily.merges,9999)||!p.settings||['sound','auto','reduced'].some(k=>typeof p.settings[k]!=='boolean'))return false;
  if(!validStudy(p.study))return false;
  if(!p.basket||!integer(p.basket.at)||!integer(p.basket.next,GIFT_IDS.length-1))return false;
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
    if(a.mode!=='main'&&a.tier!==undefined&&!TIERS[a.tier])return false;
    if(a.relicAttack!==undefined&&!(Number.isFinite(a.relicAttack)&&a.relicAttack>=0&&a.relicAttack<=10))return false;
    if(a.relicLevels!==undefined&&(!a.relicLevels||typeof a.relicLevels!=='object'||Array.isArray(a.relicLevels)||Object.keys(a.relicLevels).length!==p.equipped.length||Object.keys(a.relicLevels).some(id=>!p.equipped.includes(id)||!integer(a.relicLevels[id])||a.relicLevels[id]<1)))return false;
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
  if(p.garden!==undefined||p.beds!==undefined||!p.heroes||typeof p.heroes!=='object')return;
  let spent=0;
  for(const e of Object.values(p.heroes))if(e&&Number.isSafeInteger(e.level))for(let l=1;l<e.level;l++)spent+=legacyLevelCost(l);
  p.garden=1;while(spent>=levelCost(p.garden)){spent-=levelCost(p.garden);p.garden++;}
  if(Number.isSafeInteger(p.dust))p.dust+=spent;
  for(const e of Object.values(p.heroes))if(e&&Number.isSafeInteger(e.level))e.level=1;
  migrateBeds(p);const a=p.active;
  if(a?.run&&typeof a.run==='string'&&Array.isArray(a.deck)&&a.deck.every(id=>p.heroes[id])){try{const run=JSON.parse(a.run);run.meta=battleMeta(p,a.deck);a.run=JSON.stringify(run);}catch{}}
}
export function migrateRelics(p){
  if(p.relicRev!==undefined)return;
  p.relicRev=2;const a=p.active;
  if(a?.run&&typeof a.run==='string'){try{const run=JSON.parse(a.run);run.relicAttack=collectionBonus(p.relics);run.relicLevels=Object.fromEntries((Array.isArray(p.equipped)?p.equipped:[]).map(id=>[id,relicLevel(p.relics?.[id])]));a.run=JSON.stringify(run);}catch{}}
}
export function migrateDispatch(p){
  if(!Array.isArray(p.dispatches))return;
  for(const d of p.dispatches)if(d&&integer(d.start)&&integer(d.end)&&d.end-d.start===20*HOUR)d.start=d.end-TUNING.dispatchHours*HOUR;
}
export function migratePity(p){
  if(p.pity===undefined)p.pity={normal:0,season:0};
  else if(p.pity&&typeof p.pity==='object'&&!Array.isArray(p.pity)){if(p.pity.normal===undefined)p.pity.normal=0;if(p.pity.season===undefined)p.pity.season=0;}
}
export function migrateRelicSnapshot(p){
  const a=p.active;if(!a||typeof a!=='object'||a.relicAttack!==undefined&&a.relicLevels!==undefined)return;
  let run=null;if(typeof a.run==='string'){try{run=JSON.parse(a.run);}catch{}}
  const equipped=Array.isArray(p.equipped)?p.equipped:[];
  if(a.relicAttack===undefined)a.relicAttack=Number.isFinite(run?.relicAttack)?run.relicAttack:collectionBonus(p.relics);
  if(a.relicLevels===undefined){const from=run?.relicLevels&&typeof run.relicLevels==='object'&&!Array.isArray(run.relicLevels)?run.relicLevels:null;a.relicLevels=Object.fromEntries(equipped.map(id=>[id,from&&Number.isInteger(from[id])?from[id]:relicLevel(p.relics?.[id])]));}
}
export function parseProfile(raw){try{const p=typeof raw==='string'?JSON.parse(raw):structuredClone(raw);if(p?.version===1){migrateMonthly(p);migrateGarden(p);migrateBeds(p);migrateDaily(p);migrateBond(p);migrateRelics(p);migrateStudy(p);migrateBasket(p);migrateDispatch(p);migratePity(p);migrateRelicSnapshot(p);if(p.memories===undefined)p.memories={};if(p.settings&&p.settings.quality===undefined)p.settings.quality='standard';}return validateProfile(p)?p:null;}catch{return null;}}
const fmtN=n=>Math.floor(n).toLocaleString('ko-KR');
export function random(p){let x=p.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;p.rng=x>>>0||1;return p.rng/4294967296;}
export const away=(p,id)=>p.dispatches.some(d=>d.hero===id);
export const available=p=>HEROES.filter(h=>p.heroes[h.id].owned&&!away(p,h.id)).map(h=>h.id);
// Greenhouse saves keep their exact power. Rose is +1% per level (bed revision 2): one old
// garden level (+4%) is four rose levels, one revision-1 rose level (+2%) is two.
// Revision 3 keeps spring/seed effect: spring 3*min(L,10)+max(0,L-10), seed 2*min(L,10)+max(0,L-10).
export function migrateBeds(p){
  if(p.beds===undefined&&integer(p.garden)&&p.garden>=1){p.beds={rose:4*(p.garden-1),spring:0,seed:0};delete p.garden;p.bedRev=2;}
  if(p.beds&&typeof p.beds==='object'&&p.bedRev===undefined&&integer(p.beds.rose)){p.beds.rose*=2;p.bedRev=2;}
  if(p.beds&&typeof p.beds==='object'&&p.bedRev===2&&integer(p.beds.spring)&&integer(p.beds.seed)){p.beds.spring=3*Math.min(p.beds.spring,10)+Math.max(0,p.beds.spring-10);p.beds.seed=2*Math.min(p.beds.seed,10)+Math.max(0,p.beds.seed-10);p.bedRev=3;}
}
export const teamPower=p=>p.deck.reduce((sum,id)=>sum+combatPower(id,p.heroes[id],p.beds,collectionBonus(p.relics)),0);
function draftOffers(p){
  const a=p.active,pool=a.draftPool.filter(id=>!a.draft.includes(id));
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random(p)*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool.length===1?[{id:pool[0],boon:'focus'},{id:pool[0],boon:'spark'}]:pool.slice(0,2).map(id=>({id,boon:random(p)<.5?'focus':'spark'}));
}
export function safeNow(p,now){return Math.max(p.clockAt,Math.floor(now));}
function rollDay(p,now){if(p.daily.day!==calendar(now).day)p.daily=freshDaily(now);}
// Old saves kept draw/dispatch missions; keep today's finished expedition only.
export function migrateDaily(p){
  const d=p.daily;if(!d||typeof d!=='object')return;
  if(d.merges===undefined){p.daily={day:typeof d.day==='string'?d.day:'',combat:d.combat===true,merges:0,idle:false,free:false,bouquet:false,accel:false,claimed:Array.isArray(d.claimed)?d.claimed.filter(id=>id==='combat'):[]};return;}
  if(d.accel===undefined)d.accel=false;
}
// Bond v2: hearts are filled by points. Old saves keep their hearts (old greetings had no cap).
export function migrateBond(p){
  if(p.heroes&&typeof p.heroes==='object')for(const e of Object.values(p.heroes))if(e&&typeof e==='object'){if(e.bondXp===undefined)e.bondXp=0;if(Number.isSafeInteger(e.bond)&&e.bond>BOND_MAX)e.bond=BOND_MAX;if(e.bond===BOND_MAX)e.bondXp=0;}
  if(p.gifts===undefined)p.gifts={candy:0,letter:0,bouquet:0};if(p.lobby===undefined)p.lobby=null;
  if(p.daily&&typeof p.daily==='object'&&p.daily.bouquet===undefined)p.daily.bouquet=false;
}
// Bosses a player has met: the weekly and monthly lineups only use these (stage k has boss k).
export const metBosses=p=>Math.min(9,p.cleared);
export const weeklyStage=(p,now)=>calendar(now).weekNo%Math.max(1,metBosses(p))+1;
function receive(table,id){const e=table[id],fresh=!e.owned;if(fresh)e.owned=true;else e.copies++;return fresh;}
export function command(p,action,args={},now=Date.now()){
  now=safeNow(p,now);rollDay(p,now);
  const no=message=>({ok:false,message});
  if(action==='memory'){
    const story=MEMORIAL_STORIES[args.id],e=p.heroes[args.id];if(!story||!e?.owned||e.bond<story.unlockBond||!integer(args.page,story.paragraphs.length-1))return no('호감도 10에서 인연 이야기가 열립니다.');
    p.memories[args.id]={page:args.page,read:!!p.memories[args.id]?.read||args.page===story.paragraphs.length-1};return {ok:true};
  }
  if(action==='draw'){
    const banner=args.banner,count=args.count,free=args.free===true,boost=args.boost===true;if(!['normal','season','relic'].includes(banner)||![1,10].includes(count))return no('소환 정보를 확인하세요.');
    if(free&&(banner!=='normal'||count!==1||p.daily.free))return no('오늘의 무료 소환은 이미 사용했습니다.');
    if(boost&&(free||count!==10||banner==='relic'))return no('부스트는 일반·시즌 10회 소환에서만 사용할 수 있습니다.');
    const cost=free?0:(banner==='relic'?TUNING.relicDrawCost:TUNING.heroDrawCost)*count;if(p.dreams<cost)return no(`꿈의결정이 부족합니다. (${cost} 필요)`);if(free)p.daily.free=true;
    p.dreams-=cost;const c=calendar(now),urMult=boost?2:1,paidHero=banner!=='relic'&&!free;
    const pull=bonus=>{
      if(paidHero&&!bonus)p.pity[banner]=Math.min(9999,p.pity[banner]+1);
      const id=banner==='relic'?drawRelic(()=>random(p),p.relicDraws):drawCharacter(()=>random(p),banner==='season',c.guardian,c.pickup,urMult);
      const item={id,fresh:receive(banner==='relic'?p.relics:p.heroes,id),banner,at:now};if(bonus)item.bonus=true;
      p.history.unshift(item);if(banner==='relic')p.relicDraws++;else p.draws++;return item;
    };
    const items=Array.from({length:count},()=>pull(false)),bonus=boost&&random(p)<.1?Array.from({length:10},()=>pull(true)):[];
    p.history=p.history.slice(0,50);return {ok:true,items,bonus,cost,free,pity:{normal:p.pity.normal,season:p.pity.season}};
  }
  if(action==='bed'){
    const id=args.id;if(!BED_IDS.includes(id))return no('알 수 없는 화단입니다.');if(p.active)return no('원정 종료 후 성장할 수 있습니다.');
    if(!bedOpen(id,p.cleared))return no(`스테이지 ${TUNING.beds[id].unlock} 클리어 후 열립니다.`);const cost=bedCost(id,p.beds[id]);
    if(!Number.isSafeInteger(cost)||p.dust<cost)return no('별가루가 부족합니다.');p.dust-=cost;p.beds[id]++;return {ok:true,level:p.beds[id]};
  }
  if(action==='enhance'){
    const table=args.kind==='relic'?p.relics:p.heroes,e=table[args.id];if(!e?.owned||p.active)return no('원정 종료 후 강화할 수 있습니다.');const cost=args.kind==='relic'?relicCost(ARTIFACT[args.id].rarity,e.enhance):duplicateCost(e.enhance);if(!Number.isSafeInteger(cost)||e.copies<cost)return no(`중복 ${args.kind==='relic'?'유물':'동료'}이 ${cost}개 필요합니다.`);e.copies-=cost;e.enhance++;return {ok:true,message:`강화 +${e.enhance} 달성`};
  }
  if(action==='partner'){if(!p.heroes[args.id]?.owned)return no('아직 획득하지 못한 동료입니다.');p.partner=args.id;return {ok:true};}
  if(action==='pet'){const day=calendar(now).day;if(p.petDay===day)return no('오늘 인사는 이미 완료했습니다.');p.petDay=day;const hearts=addBond(p.heroes[p.partner],GREETING_POINTS);p.dreams+=40;return {ok:true,hearts,message:`인사 완료 · 꿈의결정 +40${hearts?' · 호감도 상승!':''}`};}
  if(action==='gift'){
    const e=p.heroes[args.id],gift=args.gift;if(!e?.owned||!GIFT_IDS.includes(gift))return no('선물할 수 없습니다.');if(p.gifts[gift]<1)return no(`${GIFTS[gift].name}이(가) 없습니다.`);if(e.bond>=BOND_MAX)return no('호감도가 이미 최고예요.');
    p.gifts[gift]--;const points=giftPoints(args.id,gift),hearts=addBond(e,points),favorite=FAVORITE[args.id]===gift;return {ok:true,points,hearts,favorite,line:favorite?FAVORITE_LINES[args.id]:GIFT_LINES[args.id]||null};
  }
  if(action==='lobby'){if(args.id===null){p.lobby=null;return {ok:true};}const e=p.heroes[args.id];if(!MEMORIAL_STORIES[args.id]||!e?.owned||e.bond<BOND_MAX)return no('호감도 10에서 메모리얼을 메인 화면으로 쓸 수 있습니다.');p.lobby=args.id;p.partner=args.id;return {ok:true};}
  if(action==='deck'){
    const ids=args.ids;if(p.active||!Array.isArray(ids)||ids.length!==TEAM_SIZE||new Set(ids).size!==TEAM_SIZE||ids.some(id=>!p.heroes[id]?.owned||away(p,id)))return no(`파견 중이 아닌 서로 다른 동료 ${TEAM_SIZE}명을 선택하세요.`);p.deck=[...ids];return {ok:true,message:'편성을 저장했습니다.'};
  }
  if(action==='equip'){
    if(p.active||!p.relics[args.id]?.owned)return no('보유한 유물만 장착할 수 있습니다.');const at=p.equipped.indexOf(args.id);if(at>=0)p.equipped.splice(at,1);else if(p.equipped.length<3)p.equipped.push(args.id);else return no('유물은 최대 3개까지 장착할 수 있습니다.');return {ok:true};
  }
  if(action==='dispatch'){
    if(p.active||!integer(args.slot,3)||args.slot>=dispatchSlots(p.cleared)||p.dispatches.some(d=>d.slot===args.slot))return no('사용 가능한 파견 슬롯을 선택하세요.');
    if(!p.heroes[args.id]?.owned||away(p,args.id)||available(p).length<=TEAM_SIZE)return no(`전투에 남을 동료 ${TEAM_SIZE}명이 필요합니다. 먼저 동료를 더 모으세요.`);
    const {dust,dreams}=dispatchReward(combatPower(args.id,p.heroes[args.id],p.beds,collectionBonus(p.relics)),p.cleared);p.dispatches.push({slot:args.slot,hero:args.id,start:now,end:now+TUNING.dispatchHours*HOUR,reward:dreams,dust});
    p.deck=p.deck.filter(id=>id!==args.id);for(const id of available(p))if(p.deck.length<TEAM_SIZE&&!p.deck.includes(id))p.deck.push(id);return {ok:true,message:'파견 출발 · 24시간 후 귀환'};
  }
  if(action==='claimDispatch'){
    if(p.active)return no('원정 종료 후 파견 보상을 받을 수 있습니다.');const d=p.dispatches.find(d=>d.slot===args.slot);if(!d||d.end>now)return no('아직 파견 중입니다.');// Dispatches sent before dust rewards keep the crystals they promised.
    const dust=d.dust||0;p.dreams+=d.reward;p.dust+=dust;p.dispatches=p.dispatches.filter(x=>x!==d);return {ok:true,reward:d.reward,dust,message:`파견 보상 · ${dust?`별가루 +${fmtN(dust)} · `:''}꿈의결정 +${fmtN(d.reward)}`};
  }
  if(action==='accelerate'){
    if(p.daily.accel)return no('오늘의 가속은 이미 사용했습니다.');
    const running=p.dispatches.filter(d=>d.end>now);if(!running.length)return no('진행 중인 파견이 없습니다.');
    p.daily.accel=true;if(args.correct!==true)return {ok:true,shifted:0,message:'오늘의 가속은 내일 다시 할 수 있습니다.'};
    for(const d of running){const delta=Math.min(4*HOUR,d.end-now);d.start-=delta;d.end-=delta;}
    return {ok:true,shifted:running.length,hours:4,message:`정답입니다. 진행 중인 파견 ${running.length}건을 최대 4시간 앞당겼습니다.`};
  }
  if(action==='idle'){const reward=idleReward(p,now);if(reward<1)return no('아직 모인 별똥별이 없습니다.');p.dust+=reward;p.idleAt=now;p.daily.idle=true;return {ok:true,reward,message:`별가루 +${fmtN(reward)}`};}
  if(action==='basket'){
    const {ready,full,next}=basketState(p,now);if(ready<1)return no('아직 선물이 준비되지 않았어요.');
    const got=Array.from({length:ready},(_,i)=>GIFT_IDS[(next+i)%GIFT_IDS.length]);for(const g of got)p.gifts[g]=Math.min(999,p.gifts[g]+1);
    p.basket.next=(next+ready)%GIFT_IDS.length;p.basket.at=full?now:p.basket.at+ready*BASKET_MS;
    return {ok:true,gifts:got,message:`선물 ${ready}개를 받았어요`};
  }
  if(action==='pityClaim'){
    const banner=args.banner;if(!['normal','season'].includes(banner))return no('교환할 수 없는 소환입니다.');
    if(p.pity[banner]<TUNING.pity[banner])return no(`소환 ${TUNING.pity[banner]}회마다 교환할 수 있어요.`);
    const c=calendar(now),pool=banner==='season'?[c.guardian]:ROSTER.UR;if(!pool.includes(args.id))return no('교환할 수 있는 동료를 골라 주세요.');
    p.pity[banner]-=TUNING.pity[banner];const item={id:args.id,fresh:receive(p.heroes,args.id),banner,at:now,pity:true};p.history.unshift(item);p.history=p.history.slice(0,50);
    return {ok:true,item,message:`${HERO[args.id].name}을(를) 데려왔어요`};
  }
  if(action==='daily'){
    const mission=DAILY_MISSIONS.find(m=>m.id===args.id);if(!mission||!missionDone(p.daily,mission.id)||p.daily.claimed.includes(mission.id))return no('아직 받을 수 없는 보상입니다.');p.daily.claimed.push(mission.id);const all=p.daily.claimed.length===DAILY_MISSIONS.length,reward=mission.reward+(all?TUNING.dailyBonus:0);p.dreams+=reward;return {ok:true,all,reward,message:`꿈의결정 +${reward}${all?' · 모두 완료 보너스 포함':''}`};
  }
  if(action==='begin'){
    if(p.active)return no('진행 중인 원정을 먼저 이어하세요.');const mode=args.mode;if(!['main','weekly','monthly'].includes(mode))return no('원정 종류를 확인하세요.');
    const ids=args.deck||p.deck;if(!Array.isArray(ids)||ids.length!==TEAM_SIZE||new Set(ids).size!==TEAM_SIZE||ids.some(id=>!p.heroes[id]?.owned||away(p,id)))return no(`파견 중이 아닌 동료 ${TEAM_SIZE}명이 필요합니다.`);
    const c=calendar(now),stage=mode==='weekly'&&p.cleared>=3?weeklyStage(p,now):args.stage||Math.min(45,p.cleared+1);if(!integer(stage,45)||stage<1||stage>p.cleared+1)return no('이전 스테이지를 먼저 클리어하세요.');
    if(mode!=='main'&&p.cleared<3)return no('스테이지 3 클리어 시 해금됩니다.');
    const tier=mode==='main'?null:args.tier||'easy';if(mode!=='main'&&(!TIERS[tier]||p.cleared<TIERS[tier].unlock))return no(`${TIERS[tier]?.name||'난이도'}는 스테이지 ${TIERS[tier]?.unlock||3} 클리어 후 열립니다.`);
    if(mode==='weekly'&&p.weekly===c.week)return no('이번 주의 입장 횟수를 모두 사용했습니다.');
    if(mode==='weekly')p.weekly=c.week;
    random(p);
    p.active={mode,stage,deck:[...ids],started:now,seed:p.rng,token:`${now}-${p.rng}-${p.revision}`,boon:0,run:null,relicAttack:collectionBonus(p.relics),relicLevels:Object.fromEntries(p.equipped.map(id=>[id,relicLevel(p.relics[id])])),...(tier?{tier}:{})};
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
    }else if(a.mode==='weekly')reward=weeklyReward(a.tier||'easy',Math.min(CHALLENGE_WAVES,args.round),!!args.won);
    let record=null,newBest=false;
    if(a.mode==='monthly'){
      record={period:calendar(now).month,token:a.token,round:args.round,damage:args.damage??0,seconds:args.seconds??0,at:now,deck:[...a.deck],tier:a.tier||'easy'};
      if(!validRecord(record))return no('전투 기록을 확인하세요.');
      newBest=betterRecord(record,currentRecord(p,now));if(newBest)p.monthlyBest=record;
      if(betterRecord(record,p.monthlyLifetime))p.monthlyLifetime=record;
    }
    p.dreams+=reward;p.daily.combat=true;if(integer(args.merges,999))p.daily.merges=Math.min(9999,p.daily.merges+args.merges);p.results.unshift({at:now,mode:a.mode,stage:a.stage,round:args.round,reward,won:!!args.won,...(a.tier?{tier:a.tier}:{})});p.results=p.results.slice(0,30);p.active=null;return {ok:true,reward,record,newBest};
  }
  if(action==='claimMonthly'){
    const record=currentRecord(p,now);if(p.active||!record||record.token!==args.token)return no('현재 월간 최고 기록을 확인하세요.');
    if(p.monthly===record.period)return no('이번 달 기록 보상은 이미 확정했습니다.');
    const reward=monthlyReward(record);p.dreams+=reward;p.monthly=record.period;p.monthlyClaim=structuredClone(record);
    return {ok:true,reward,message:`월간 기록 보상 확정 · 꿈의결정 +${reward}`};
  }
  if(action==='answer'){
    const q=questionOf(args.kind,args.id);if(!q||!integer(args.choice,q.choices.length-1))return no('문제를 확인하세요.');
    const correct=args.choice===q.answer,s=p.study,key=`${q.kind}:${q.id}`;
    if(correct&&!s.solved.includes(key))s.solved.push(key);
    if(!correct){const at=s.wrong.findIndex(w=>w.kind===q.kind&&w.id===q.id);if(at>=0)s.wrong.splice(at,1);s.wrong.push({kind:q.kind,id:q.id,choice:args.choice,at:now});if(s.wrong.length>WRONG_MAX)s.wrong.shift();}
    return {ok:true,correct};
  }
  if(action==='libraryStar'){
    const s=p.study,l=s.library,day=calendar(now).day,at=s.wrong.findIndex(w=>w.kind===args.kind&&w.id===args.id);
    if(l.index>=CONSTELLATIONS.length)return no('일곱 별자리를 모두 완성했어요.');if(l.day===day)return no('오늘의 별은 이미 밝혔어요. 내일 다시 만나요.');
    if(at<0)return no('오답 노트에 있는 문제만 복습할 수 있어요.');
    s.wrong.splice(at,1);l.day=day;l.stars++;const c=CONSTELLATIONS[l.index];let completed=null;
    if(l.stars>=c.stars.length){l.unlocked.push(c.id);l.index++;l.stars=0;completed=c.id;}
    return {ok:true,completed,message:completed?`${c.name} 완성! 루미의 그림이 열렸어요.`:`별 하나가 켜졌어요 · ${c.name} ${l.stars}/${c.stars.length}`};
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
    this.raw=raw;if(UNLOCKED&&!this.broken)topUpUnlocked(this.value);
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

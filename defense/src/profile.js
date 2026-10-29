import {HERO,HEROES,ARTIFACT,ARTIFACTS,DEFAULT_DECK,TUNING,TIERS,TIER_IDS,CHALLENGE_WAVES,ROSTER,MAIN_STAGES,PART_STAGES,CLEAR_UNLOCKS,LATE_COMPANIONS,LATE_UNLOCK_STAGE,HIDDEN,MAX_RANK} from './content.js';
import {lateOpen,heroPool,calendar,duplicateCost,relicCost,relicLevel,collectionBonus,levelCost,bedCost,bedOpen,BED_IDS,dispatchSlots,dispatchReward,dispatchDust,combatPower,stageReward,PERFECT_REWARD,idleReward,drawCharacter,drawRelic,HOUR} from './economy.js';
import {resumeBattle,battleMeta} from './battle.js';
import {migrateMonthly,validRecord,betterRecord,currentRecord,monthlyReward,weeklyReward} from './monthly.js';
import {TEAM_SIZE,SAVE_KEY,UNLOCKED} from './team-config.js';
import {unlockProfile,topUpUnlocked,testGrant} from './test-unlock.js';
import {MEMORIAL_STORIES} from './memorial.js';
import {BOND_MAX,GIFT_IDS,GREETING_POINTS,FAVORITE,FAVORITE_LINES,GIFT_LINES,GIFTS,addBond,bondNeed,giftPoints} from './bond.js';
import {questionOf} from './quiz.js';
import {CONSTELLATIONS} from './library.js';
import {season} from './preview/season.js';
import {oathConflict,oathDeckProblem,oathScore,oathBandsReached,oathState,oathChapter,OATH_BANDS} from './preview/oath.js';
import {twinParty,twinPartyProblem,twinLocks,twinState,twinBandReward,TWIN_BANDS,TWIN_WAVES,TWIN_SIDES,TWIN_SIDE} from './preview/twin.js';
import {REQUEST_MAX,REQUEST_GAP_MIN,REQUEST_GAP_SPAN,REQUEST_FLAGS,REQUEST,requestState,requestGoal} from './preview/requests.js';
import {REQUEST_HEROES,REQUEST_REWARD} from './preview/requests-data.js';

export {SAVE_KEY};
const entry=owned=>({owned,level:1,enhance:0,copies:0,bond:0,bondXp:0});
export function createProfile(now=Date.now()){
  return (UNLOCKED?unlockProfile:p=>p)({version:1,revision:0,dreams:600,dust:180,cleared:0,beds:{rose:0,spring:0,seed:0,crit:0,critDamage:0,stardust:0},bedRev:4,relicRev:2,deck:DEFAULT_DECK.slice(0,TEAM_SIZE),partner:'star_boy',
    heroes:Object.fromEntries(HEROES.map(h=>[h.id,entry(DEFAULT_DECK.includes(h.id))])),
    relics:Object.fromEntries(ARTIFACTS.map(a=>[a.id,{owned:false,enhance:0,copies:0}])),equipped:[],dispatches:[],
    draws:0,relicDraws:0,pity:{normal:0,season:0},rng:0x13579bdf,history:[],idleAt:now,clockAt:now,petDay:'',memories:{},weekly:null,monthly:null,gifts:{candy:0,letter:0,bouquet:0},basket:{at:now,next:0},lobby:null,noticeLate:[],perfect:[],
    monthlyBest:null,monthlyLifetime:null,monthlyClaim:null,
    daily:freshDaily(now),study:freshStudy(),settings:{sound:true,auto:true,reduced:false,cutin:true,quality:'standard'},active:null,results:[]});
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
// Late companions (see LATE_COMPANIONS) the player has already been told about by the stage 45 announcement.
export function migrateNotices(p){if(!Array.isArray(p.noticeLate))p.noticeLate=[];}
// The newly joined companions the announcement has not shown yet. Behemoth is a guardian and arrives through its own reveal.
export const lateNoticeIds=p=>lateOpen(p.cleared)?LATE_COMPANIONS.filter(id=>!HIDDEN.includes(id)&&!(p.noticeLate||[]).includes(id)):[];
export function migrateBasket(p){if(p.basket===undefined)p.basket={at:integer(p.clockAt)?p.clockAt:0,next:0};}
const BASKET_MS=TUNING.basketHours*HOUR;
export function basketState(p,now){const elapsed=Math.max(0,now-p.basket.at),ready=Math.min(TUNING.basketMax,Math.floor(elapsed/BASKET_MS));return {ready,full:ready>=TUNING.basketMax,nextIn:ready>=TUNING.basketMax?0:BASKET_MS-elapsed%BASKET_MS,next:p.basket.next};}
export const missionDone=(daily,id)=>id==='merge'?daily.merges>=5:!!daily[id];
export function validateProfile(p){
  if(!p||p.version!==1||!integer(p.revision)||!integer(p.dreams)||!integer(p.dust)||!p.beds||typeof p.beds!=='object'||Object.keys(p.beds).sort().join()!==[...BED_IDS].sort().join()||!BED_IDS.every(id=>integer(p.beds[id]))||p.bedRev!==4||p.relicRev!==2||!integer(p.cleared,MAIN_STAGES)||!integer(p.rng,0xffffffff)||!p.rng||!integer(p.draws)||!integer(p.relicDraws))return false;
  if(!p.pity||!integer(p.pity.normal)||!integer(p.pity.season))return false;
  if(!p.heroes||!p.relics||HEROES.some(h=>{const e=p.heroes[h.id];return !e||typeof e.owned!=='boolean'||!integer(e.level)||e.level<1||!integer(e.enhance)||!integer(e.copies)||!integer(e.bond,BOND_MAX)||!integer(e.bondXp)||e.bondXp>=Math.max(1,bondNeed(e.bond));}))return false;
  if(!p.gifts||typeof p.gifts!=='object'||Object.keys(p.gifts).sort().join()!=='bouquet,candy,letter'||!GIFT_IDS.every(id=>integer(p.gifts[id],999)))return false;
  if(!Array.isArray(p.noticeLate)||p.noticeLate.length>60||p.noticeLate.some(id=>!HERO[id]))return false;
  if(p.lobby!==null&&!(MEMORIAL_STORIES[p.lobby]&&p.heroes[p.lobby]?.owned&&p.heroes[p.lobby].bond>=BOND_MAX))return false;
  if(ARTIFACTS.some(a=>{const e=p.relics[a.id];return !e||typeof e.owned!=='boolean'||!integer(e.enhance)||!integer(e.copies);}))return false;
  if(!p.memories||typeof p.memories!=='object'||Array.isArray(p.memories)||Object.entries(p.memories).some(([id,m])=>!MEMORIAL_STORIES[id]||!p.heroes[id]?.owned||p.heroes[id].bond<10||!m||!integer(m.page,MEMORIAL_STORIES[id].paragraphs.length-1)||m.of!==undefined&&m.of!==MEMORIAL_STORIES[id].paragraphs.length||typeof m.read!=='boolean'))return false;
  if(!Array.isArray(p.deck)||p.deck.length!==TEAM_SIZE||new Set(p.deck).size!==TEAM_SIZE||p.deck.some(id=>!p.heroes[id]?.owned)||!p.heroes[p.partner]?.owned)return false;
  if(!Array.isArray(p.equipped)||p.equipped.length>3||new Set(p.equipped).size!==p.equipped.length||p.equipped.some(id=>!p.relics[id]?.owned))return false;
  if(!Array.isArray(p.dispatches)||p.dispatches.length>dispatchSlots(p.cleared)||new Set(p.dispatches.map(d=>d.hero)).size!==p.dispatches.length||new Set(p.dispatches.map(d=>d.slot)).size!==p.dispatches.length)return false;
  if(p.dispatches.some(d=>!p.heroes[d.hero]?.owned||!integer(d.slot,3)||d.slot>=dispatchSlots(p.cleared)||!integer(d.start)||!integer(d.end)||d.end-d.start!==TUNING.dispatchHours*HOUR||!integer(d.reward)||d.dust!==undefined&&!integer(d.dust)))return false;
  if(p.deck.some(id=>p.dispatches.some(d=>d.hero===id)))return false;
  if(!integer(p.idleAt)||!integer(p.clockAt)||typeof p.petDay!=='string'||!p.daily||typeof p.daily.day!=='string'||!Array.isArray(p.daily.claimed)||p.daily.claimed.some(id=>!DAILY_MISSIONS.some(m=>m.id===id))||new Set(p.daily.claimed).size!==p.daily.claimed.length)return false;
  if(['combat','idle','free','bouquet','accel'].some(k=>typeof p.daily[k]!=='boolean')||!integer(p.daily.merges,9999)||!p.settings||['sound','auto','reduced','cutin'].some(k=>typeof p.settings[k]!=='boolean'))return false;
  if(!validStudy(p.study))return false;
  if(!p.basket||!integer(p.basket.at)||!integer(p.basket.next,GIFT_IDS.length-1))return false;
  if(!Array.isArray(p.perfect)||p.perfect.length>MAIN_STAGES||new Set(p.perfect).size!==p.perfect.length||p.perfect.some((n,i)=>(i&&n<=p.perfect[i-1])||!integer(n,MAIN_STAGES)||n<1||n>p.cleared))return false;
  if(!['standard','high','low'].includes(p.settings.quality)||!['monthlyBest','monthlyLifetime','monthlyClaim'].every(k=>validRecord(p[k])))return false;
  if(p.monthlyClaim&&p.monthlyClaim.period!==p.monthly)return false;
  if(!Array.isArray(p.history)||p.history.length>50||p.history.some(h=>!integer(h.at)||!['normal','season','relic'].includes(h.banner)||!(HERO[h.id]||ARTIFACT[h.id])||typeof h.fresh!=='boolean'))return false;
  if(!Array.isArray(p.results)||p.results.length>30||p.results.some(r=>!integer(r.at)||!['main','weekly','monthly','oath','twin'].includes(r.mode)||!integer(r.stage,MAIN_STAGES)||!integer(r.round)||!integer(r.reward)||typeof r.won!=='boolean'))return false;
  for(const k of ['weekly','monthly'])if(p[k]!==null&&(typeof p[k]!=='string'||!/^\d{4}-\d{2}(?:-\d{2})?$/.test(p[k])))return false;
  if(p.active!==null&&(!p.active||typeof p.active!=='object'||!['main','weekly','monthly','oath','twin'].includes(p.active.mode)||!Array.isArray(p.active.deck)||p.active.deck.length!==TEAM_SIZE||new Set(p.active.deck).size!==TEAM_SIZE||p.active.deck.some(id=>!p.heroes[id]?.owned||p.dispatches.some(d=>d.hero===id))||!integer(p.active.stage,MAIN_STAGES)||p.active.stage<1||!integer(p.active.started)||typeof p.active.token!=='string'||!integer(p.active.boon,TEAM_SIZE)))return false;
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
    if(a.mode==='oath'&&(oathConflict(a.oaths)||oathDeckProblem(a.oaths,a.deck)||!TIERS[a.tier]))return false;
    if(a.mode==='twin'&&(!TWIN_SIDES.includes(a.side)||!TIERS[a.tier]||!Array.isArray(a.relics)||a.relics.length>3||new Set(a.relics).size!==a.relics.length||a.relics.some(id=>!p.relics[id]?.owned)))return false;
    if(a.mode!=='main'&&a.tier!==undefined&&!TIERS[a.tier])return false;
    if(a.relicAttack!==undefined&&!(Number.isFinite(a.relicAttack)&&a.relicAttack>=0&&a.relicAttack<=10))return false;
    const relicKeys=a.mode==='twin'?a.relics||[]:p.equipped;
    if(a.relicLevels!==undefined&&(!a.relicLevels||typeof a.relicLevels!=='object'||Array.isArray(a.relicLevels)||Object.keys(a.relicLevels).length!==relicKeys.length||Object.keys(a.relicLevels).some(id=>!relicKeys.includes(id)||!integer(a.relicLevels[id])||a.relicLevels[id]<1)))return false;
    if(a.run!==null&&!resumeBattle(p))return false;
  }
  if(!validOath(p)||!validTwin(p)||!validRequests(p))return false;
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
// Memorial reading progress is a scroll position quantised to the story's paragraph count, saved with that count ("of").
// Pass 18 re-broke 18 stories into reading paragraphs (same words); saves from before it map the position by the old count.
const MEMORIAL_LAYOUT_BEFORE_PASS18=Object.freeze({miracle_larva:6,silver_rabbit:1,night_rabbit:9,guardian:13,santa:9,aurora:1,galaxy_whale:1,cinderella:7,frost_witch:1,behemoth:13,toffee_apple:11,underdog:12,joker:13,sunflower:12,antropy:12,cure_master:12,ash:12,venom:12});
export function migrateMemories(p){
  if(!p.memories||typeof p.memories!=='object'||Array.isArray(p.memories))return;
  for(const [id,m] of Object.entries(p.memories)){
    const story=MEMORIAL_STORIES[id];if(!story||!m||typeof m!=='object'||!Number.isSafeInteger(m.page))continue;
    const now=story.paragraphs.length,was=Number.isSafeInteger(m.of)&&m.of>0?m.of:MEMORIAL_LAYOUT_BEFORE_PASS18[id]??now;
    if(was!==now)m.page=was>1?Math.min(now-1,Math.max(0,Math.round(m.page/(was-1)*(now-1)))):0;
    m.of=now;
  }
}
// Twin-star used to keep one shared "set" for the current party. Records are per side now; the old field cannot be read.
export function migrateTwin(p){
  if(p?.twin&&typeof p.twin==='object'&&!Array.isArray(p.twin)&&Object.hasOwn(p.twin,'set'))delete p.twin.set;
}
export function parseProfile(raw){try{const p=typeof raw==='string'?JSON.parse(raw):structuredClone(raw);if(p?.version===1){migrateNotices(p);migrateMonthly(p);migrateGarden(p);migrateBeds(p);migrateDaily(p);migrateBond(p);migrateRelics(p);migrateStudy(p);migrateBasket(p);migrateDispatch(p);migratePity(p);migrateRelicSnapshot(p);migrateMemories(p);migrateTwin(p);if(Number.isSafeInteger(p.cleared)&&p.heroes&&typeof p.heroes==='object'&&!Array.isArray(p.heroes))grantClearUnlocks(p);if(p.relics&&typeof p.relics==='object')for(const a of ARTIFACTS)if(!p.relics[a.id])p.relics[a.id]={owned:false,enhance:0,copies:0};if(p.heroes&&typeof p.heroes==='object'&&!Array.isArray(p.heroes))for(const h of HEROES)if(!p.heroes[h.id])p.heroes[h.id]=entry(false);if(p.perfect===undefined)p.perfect=[];if(p.memories===undefined)p.memories={};if(p.settings&&p.settings.quality===undefined)p.settings.quality='standard';if(p.settings&&p.settings.cutin===undefined)p.settings.cutin=true;}return validateProfile(p)?p:null;}catch{return null;}}
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
  // Revision 4: the dawn garden's three beds (crit chance, crit damage, stardust) start empty.
  if(p.beds&&typeof p.beds==='object'&&p.bedRev===3){for(const id of ['crit','critDamage','stardust'])if(p.beds[id]===undefined)p.beds[id]=0;p.bedRev=4;}
}
// Companions that join when a stage has been cleared. Returns the ones that were new to this profile.
export function grantClearUnlocks(p){
  const fresh=[];
  for(const [stage,ids] of Object.entries(CLEAR_UNLOCKS))if(p.cleared>=Number(stage))for(const id of ids){const e=p.heroes?.[id];if(e&&!e.owned){e.owned=true;fresh.push(id);}}
  return fresh;
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
function validOathRecord(r){
  if(!r||typeof r!=='object'||typeof r.period!=='string'||!/^S-?\d+$/.test(r.period)||typeof r.token!=='string'||!r.token||r.token.length>100||!integer(r.at)||season(r.at).id!==r.period||!TIERS[r.tier])return false;
  return !oathConflict(r.oaths)&&Array.isArray(r.deck)&&r.deck.length===TEAM_SIZE&&new Set(r.deck).size===r.deck.length&&r.deck.every(id=>HERO[id])&&!oathDeckProblem(r.oaths,r.deck)&&r.score===oathScore(r.tier,r.oaths);
}
function validOath(p){
  if(p.oath===undefined)return true;
  const o=p.oath;if(!o||typeof o!=='object'||Array.isArray(o)||typeof o.period!=='string'||!/^S-?\d+$/.test(o.period))return false;
  if(o.best!==null&&!validOathRecord(o.best))return false;
  if(o.best===null){if(o.paid!==0)return false;}else if(o.best.period!==o.period||!integer(o.paid,OATH_BANDS.length)||o.paid>oathBandsReached(o.best.score))return false;
  if(o.lifetime!==null&&!validOathRecord(o.lifetime))return false;
  return !(o.best&&o.lifetime&&o.lifetime.score<o.best.score);
}
function validTwinResult(s){return !!s&&typeof s==='object'&&integer(s.round,TWIN_WAVES)&&Number.isFinite(s.damage)&&s.damage>=0&&s.damage<1e15;}
function validTwinEntry(e){return !!e&&validTwinResult(e.left)&&validTwinResult(e.right)&&e.total===e.left.round+e.right.round&&integer(e.at);}
function validTwinRecord(p,r){
  if(!r||typeof r!=='object'||Array.isArray(r)||!integer(r.round,TWIN_WAVES)||!Number.isFinite(r.damage)||r.damage<0||r.damage>=1e15||!integer(r.at))return false;
  if(!Array.isArray(r.deck)||r.deck.length!==TEAM_SIZE||new Set(r.deck).size!==r.deck.length||r.deck.some(id=>!p.heroes?.[id]?.owned))return false;
  return Array.isArray(r.relics)&&r.relics.length<=3&&new Set(r.relics).size===r.relics.length&&r.relics.every(id=>p.relics?.[id]?.owned);
}
function twinRecordsDisjoint(a,b){
  if(!a||!b)return true;
  const heroes=[...a.deck,...b.deck],relics=[...a.relics,...b.relics];
  return new Set(heroes).size===heroes.length&&new Set(relics).size===relics.length;
}
function validTwin(p){
  if(p.twin===undefined)return true;
  const t=p.twin;if(!t||typeof t!=='object'||Array.isArray(t))return false;
  if(t.period!==undefined&&(typeof t.period!=='string'||!/^S-?\d+$/.test(t.period)))return false;
  if(t.party!==undefined){
    if(!t.party||typeof t.party!=='object')return false;
    for(const side of TWIN_SIDES){
      const deck=t.party[side]?.deck,relics=t.party[side]?.relics;
      if(!Array.isArray(deck)||deck.length!==TEAM_SIZE||new Set(deck).size!==deck.length||deck.some(id=>!p.heroes[id]?.owned))return false;
      if(!Array.isArray(relics)||relics.length>3||new Set(relics).size!==relics.length||relics.some(id=>!p.relics[id]?.owned))return false;
    }
    const heroes=[...t.party.left.deck,...t.party.right.deck],relics=[...t.party.left.relics,...t.party.right.relics];
    if(new Set(heroes).size!==heroes.length||new Set(relics).size!==relics.length)return false;
  }
  const progress=t.records||t.lifetime||t.best&&TIER_IDS.some(id=>t.best[id])||t.paid&&TIER_IDS.some(id=>t.paid[id]);
  if(progress&&!/^S-?\d+$/.test(t.period||''))return false;
  if(t.records!==undefined&&t.records!==null){
    if(typeof t.records!=='object'||Array.isArray(t.records))return false;
    for(const tier of TIER_IDS){
      const row=t.records[tier];if(!row||typeof row!=='object'||Array.isArray(row))return false;
      for(const side of TWIN_SIDES)if(row[side]!=null&&!validTwinRecord(p,row[side]))return false;
      if(!twinRecordsDisjoint(row.left,row.right))return false;
    }
  }
  if(t.best!==undefined&&t.best!==null){if(typeof t.best!=='object')return false;for(const tier of TIER_IDS)if(t.best[tier]!=null&&!validTwinEntry(t.best[tier]))return false;}
  if(t.paid!==undefined&&t.paid!==null){
    if(typeof t.paid!=='object')return false;
    for(const tier of TIER_IDS){
      if(t.paid[tier]===undefined)continue;
      if(!integer(t.paid[tier],TWIN_BANDS.length))return false;
      const best=t.best?.[tier],reached=best?TWIN_BANDS.filter(b=>best.total>=b.total).length:0;
      if(t.paid[tier]>reached)return false;
    }
  }
  return !(t.lifetime!==undefined&&t.lifetime!==null&&(!TIERS[t.lifetime.tier]||!integer(t.lifetime.total,TWIN_WAVES*2)||!integer(t.lifetime.at)));
}
function validRequests(p){
  if(p.requests===undefined)return true;
  const r=p.requests;if(!r||typeof r!=='object'||Array.isArray(r)||!integer(r.next)||!Array.isArray(r.active)||r.active.length>REQUEST_MAX||!Array.isArray(r.claimed)||!Array.isArray(r.after)||!Array.isArray(r.read))return false;
  const heroes=new Set(),ids=new Set(),orders={};
  for(const e of r.active){
    const req=REQUEST[e?.id],target=requestGoal(e?.id);if(!req||ids.has(e.id)||heroes.has(req.hero)||!integer(e.at)||typeof e.seen!=='boolean'||!integer(e.count,target)||typeof e.done!=='boolean'||e.done!==(e.count>=target))return false;
    ids.add(e.id);heroes.add(req.hero);
  }
  for(const id of r.claimed){const req=REQUEST[id];if(!req||ids.has(id))return false;(orders[req.hero]||=[]).push(req.order);}
  for(const list of Object.values(orders)){const sorted=[...list].sort((a,b)=>a-b);if(new Set(sorted).size!==sorted.length||sorted.some((n,i)=>n!==i+1))return false;}
  for(const e of r.active)if(REQUEST[e.id].order!==(orders[REQUEST[e.id].hero]?.length||0)+1)return false;
  if(new Set(r.after).size!==r.after.length||r.after.some(id=>!REQUEST_HEROES.includes(id)))return false;
  for(const hero of REQUEST_HEROES){const all=Object.values(REQUEST).filter(q=>q.hero===hero);if(r.after.includes(hero)!==all.every(q=>r.claimed.includes(q.id)))return false;}
  return new Set(r.read).size===r.read.length&&r.read.every(id=>r.after.includes(id));
}
function validFeats(feats){
  if(!feats||typeof feats!=='object'||Array.isArray(feats)||typeof feats.won!=='boolean'||!feats.casts||typeof feats.casts!=='object'||Array.isArray(feats.casts)||!integer(feats.bosses)||!Array.isArray(feats.flags))return false;
  if(Object.entries(feats.casts).some(([id,n])=>!HERO[id]||!integer(n))||feats.flags.some(f=>!REQUEST_FLAGS.includes(f)))return false;
  if(feats.ranks!==undefined){
    if(!feats.ranks||typeof feats.ranks!=='object'||Array.isArray(feats.ranks))return false;
    if(Object.entries(feats.ranks).some(([id,n])=>!HERO[id]||!integer(n,MAX_RANK)||n<1))return false;
  }
  return true;
}
function applyRequestProgress(p,deck,feats){
  const list=p.requests?.active;if(!Array.isArray(list))return [];
  const done=[];
  for(const e of list){
    if(!e||e.done||!REQUEST[e.id])continue;
    const goal=REQUEST[e.id].goal,target=requestGoal(e.id);let add=0;
    if(goal.type==='clear'){
      const withIds=goal.with==null?[]:Array.isArray(goal.with)?goal.with:[goal.with];
      if(feats.won&&withIds.every(id=>deck.includes(id))&&(!goal.rarities||deck.every(id=>goal.rarities.includes(HERO[id]?.rarity))))add=1;
    }
    else if(goal.type==='casts')add=feats.casts[goal.hero]||0;
    else if(goal.type==='bosses'){if(deck.includes(goal.with))add=feats.bosses;}
    else if(goal.type==='flag'&&feats.flags.includes(goal.flag))add=1;
    else if(goal.type==='rank'&&(feats.ranks?.[goal.hero]||0)>=goal.n)add=1;
    if(!add)continue;
    e.count=Math.min(target,e.count+add);if(e.count>=target){e.done=true;done.push(e.id);}
  }
  return done;
}
function settleOath(p,a,args,now){
  const st=oathState(p,now);
  if(!args.won){p.oath={period:st.period,best:st.best,paid:st.best?st.paid:0,lifetime:st.lifetime};return {record:null,newBest:false,score:0,bands:[],pay:0};}
  const tier=a.tier||'easy',oaths=[...(a.oaths||[])],score=oathScore(tier,oaths);
  const record={period:st.period,token:a.token,score,tier,oaths,deck:[...a.deck],at:now};
  const newBest=!st.best||score>st.best.score,best=newBest?record:st.best,reached=oathBandsReached(best.score),bands=[];
  for(let i=st.paid;i<reached;i++)bands.push({score:OATH_BANDS[i].score,reward:OATH_BANDS[i].reward});
  p.oath={period:st.period,best,paid:reached,lifetime:!st.lifetime||score>st.lifetime.score?record:st.lifetime};
  return {record,newBest,score,bands,pay:bands.reduce((n,b)=>n+b.reward,0)};
}
function settleTwin(p,a,args,now){
  const st=twinState(p,now),tier=a.tier||'easy',side=a.side,round=Math.max(0,Math.min(TWIN_WAVES,args.round));
  const raw=args.damage??0,damage=Number.isFinite(raw)&&raw>0?raw:0,records=st.records;
  const deck=[...a.deck],relics=[...(a.relics||[])];
  records[tier]={...records[tier],[side]:{round,damage,deck,relics,at:now}};
  const total=(records[tier].left?.round||0)+(records[tier].right?.round||0),prevBest=st.best[tier];
  const newBest=!prevBest||total>prevBest.total;
  const snap=name=>({round:records[tier][name]?.round||0,damage:records[tier][name]?.damage||0});
  const entry=newBest?{total,left:snap('left'),right:snap('right'),at:now}:prevBest;
  const reached=TWIN_BANDS.filter(b=>(entry?.total||0)>=b.total).length,bands=[];
  for(let i=st.paid[tier]||0;i<reached;i++)bands.push({total:TWIN_BANDS[i].total,reward:twinBandReward(tier,i)});
  const rank=id=>TIER_IDS.indexOf(id);let lifetime=st.lifetime;
  if(!lifetime||rank(tier)>rank(lifetime.tier)||rank(tier)===rank(lifetime.tier)&&total>lifetime.total)lifetime={tier,total,at:now};
  p.twin={period:st.period,party:st.party,records,best:{...st.best,[tier]:entry},paid:{...st.paid,[tier]:reached},lifetime};
  return {newBest,side,round,total,bands,pay:bands.reduce((n,b)=>n+b.reward,0)};
}
function beginPreview(p,mode,args,now){
  if(p.cleared<TIERS.easy.unlock)return {ok:false,message:`스테이지 ${TIERS.easy.unlock} 클리어 시 해금됩니다.`};
  const tier=args.tier||'easy';if(!TIERS[tier]||p.cleared<TIERS[tier].unlock)return {ok:false,message:`${TIERS[tier]?.name||'난이도'}는 스테이지 ${TIERS[tier]?.unlock??TIERS.easy.unlock} 클리어 후 열립니다.`};
  const stage=oathChapter(season(now).index,p.cleared)+1;
  if(mode==='oath'){
    const ids=args.deck||p.deck;if(!Array.isArray(ids)||ids.length!==TEAM_SIZE||new Set(ids).size!==TEAM_SIZE||ids.some(id=>!p.heroes[id]?.owned||away(p,id)))return {ok:false,message:`파견 중이 아닌 동료 ${TEAM_SIZE}명이 필요합니다.`};
    const conflict=oathConflict(args.oaths);if(conflict)return {ok:false,message:conflict};
    const problem=oathDeckProblem(args.oaths,ids);if(problem)return {ok:false,message:problem};
    random(p);
    p.active={mode,stage,deck:[...ids],started:now,seed:p.rng,token:`${now}-${p.rng}-${p.revision}`,boon:0,run:null,relicAttack:collectionBonus(p.relics),relicLevels:Object.fromEntries(p.equipped.map(id=>[id,relicLevel(p.relics[id])])),tier,oaths:[...args.oaths]};
    return {ok:true};
  }
  if(!TWIN_SIDES.includes(args.side))return {ok:false,message:'별길을 확인하세요.'};
  const party=twinParty(p),problem=twinPartyProblem(p,party);if(problem)return {ok:false,message:problem};
  const locked=twinLocks(p,now,tier,args.side),mine=party[args.side];
  if(mine.deck.some(id=>locked.heroes.includes(id))||mine.relics.some(id=>locked.relics.includes(id))){
    const name=TWIN_SIDE[args.side==='left'?'right':'left'].name;
    return {ok:false,message:`${name} 기록에 쓴 동료·유물은 이 별길에 쓸 수 없어요. ${name}을 다시 도전하면 풀려요.`};
  }
  const relics=party[args.side].relics;random(p);
  p.active={mode,stage,deck:[...party[args.side].deck],started:now,seed:p.rng,token:`${now}-${p.rng}-${p.revision}`,boon:0,run:null,relicAttack:collectionBonus(p.relics),relicLevels:Object.fromEntries(relics.map(id=>[id,relicLevel(p.relics[id])])),tier,side:args.side,relics:[...relics]};
  return {ok:true};
}
export const weeklyStage=(p,now)=>calendar(now).weekNo%Math.max(1,metBosses(p))+1;
function receive(table,id){const e=table[id],fresh=!e.owned;if(fresh)e.owned=true;else e.copies++;return fresh;}
export function command(p,action,args={},now=Date.now()){
  now=safeNow(p,now);rollDay(p,now);
  const no=message=>({ok:false,message});
  if(action==='memory'){
    const story=MEMORIAL_STORIES[args.id],e=p.heroes[args.id];if(!story||!e?.owned||e.bond<story.unlockBond||!integer(args.page,story.paragraphs.length-1))return no('호감도 10에서 인연 이야기가 열립니다.');
    p.memories[args.id]={page:args.page,of:story.paragraphs.length,read:!!p.memories[args.id]?.read||args.page===story.paragraphs.length-1};return {ok:true};
  }
  if(action==='draw'){
    const banner=args.banner,count=args.count,free=args.free===true,boost=args.boost===true;if(!['normal','season','relic'].includes(banner)||![1,10].includes(count))return no('소환 정보를 확인하세요.');
    if(free&&(banner!=='normal'||count!==1||p.daily.free))return no('오늘의 무료 소환은 이미 사용했습니다.');
    if(boost&&(free||count!==10||banner==='relic'))return no('부스트는 일반·시즌 10회 소환에서만 사용할 수 있습니다.');
    const cost=free?0:(banner==='relic'?TUNING.relicDrawCost:TUNING.heroDrawCost)*count;if(p.dreams<cost)return no(`꿈의결정이 부족합니다. (${cost} 필요)`);if(free)p.daily.free=true;
    p.dreams-=cost;const c=calendar(now),urMult=boost?2:1,paidHero=banner!=='relic'&&!free;
    const pull=bonus=>{
      if(paidHero&&!bonus)p.pity[banner]=Math.min(9999,p.pity[banner]+1);
      const id=banner==='relic'?drawRelic(()=>random(p),p.relicDraws):drawCharacter(()=>random(p),banner==='season',c.guardian,c.pickup,urMult,lateOpen(p.cleared));
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
  if(action==='noticeLate'){p.noticeLate=[...new Set([...p.noticeLate,...lateNoticeIds(p)])];return {ok:true};}
  if(action==='lobby'){if(args.id===null){p.lobby=null;return {ok:true};}const e=p.heroes[args.id];if(!MEMORIAL_STORIES[args.id]||!e?.owned||e.bond<BOND_MAX)return no('호감도 10에서 메모리얼을 메인 화면으로 쓸 수 있습니다.');p.lobby=args.id;p.partner=args.id;return {ok:true};}
  if(action==='deck'){
    const ids=args.ids;if(p.active||!Array.isArray(ids)||ids.length!==TEAM_SIZE||new Set(ids).size!==TEAM_SIZE||ids.some(id=>!p.heroes[id]?.owned||away(p,id)))return no(`파견 중이 아닌 서로 다른 동료 ${TEAM_SIZE}명을 선택하세요.`);p.deck=[...ids];return {ok:true,message:'편성을 저장했습니다.'};
  }
  if(action==='relics'){
    const ids=args.ids;if(p.active||!Array.isArray(ids)||ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>!p.relics[id]?.owned))return no('보유한 서로 다른 유물을 3개까지 장착할 수 있습니다.');p.equipped=[...ids];return {ok:true,message:'유물 장착을 저장했습니다.'};
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
    const dust=dispatchDust(d.dust||0,p.beds,p.cleared);p.dreams+=d.reward;p.dust+=dust;p.dispatches=p.dispatches.filter(x=>x!==d);return {ok:true,reward:d.reward,dust,message:`파견 보상 · ${dust?`별가루 +${fmtN(dust)} · `:''}꿈의결정 +${fmtN(d.reward)}`};
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
    const c=calendar(now),pool=banner==='season'?[c.guardian]:heroPool('UR',lateOpen(p.cleared));if(!pool.includes(args.id))return no('교환할 수 있는 동료를 골라 주세요.');
    // A late companion (Behemoth in its guardian month) cannot be taken through the exchange before stage 45 either.
    if(LATE_COMPANIONS.includes(args.id)&&!lateOpen(p.cleared))return no(`${HERO[args.id].name}은(는) 스테이지 ${LATE_UNLOCK_STAGE} 클리어 후에 교환할 수 있어요.`);
    p.pity[banner]-=TUNING.pity[banner];const item={id:args.id,fresh:receive(p.heroes,args.id),banner,at:now,pity:true};p.history.unshift(item);p.history=p.history.slice(0,50);
    return {ok:true,item,message:`${HERO[args.id].name}을(를) 데려왔어요`};
  }
  if(action==='daily'){
    const mission=DAILY_MISSIONS.find(m=>m.id===args.id);if(!mission||!missionDone(p.daily,mission.id)||p.daily.claimed.includes(mission.id))return no('아직 받을 수 없는 보상입니다.');p.daily.claimed.push(mission.id);const all=p.daily.claimed.length===DAILY_MISSIONS.length,reward=mission.reward+(all?TUNING.dailyBonus:0);p.dreams+=reward;return {ok:true,all,reward,message:`꿈의결정 +${reward}${all?' · 모두 완료 보너스 포함':''}`};
  }
  if(action==='begin'){
    if(p.active)return no('진행 중인 원정을 먼저 이어하세요.');const mode=args.mode;
    if(mode==='oath'||mode==='twin')return beginPreview(p,mode,args,now);
    if(!['main','weekly','monthly'].includes(mode))return no('원정 종류를 확인하세요.');
    const ids=args.deck||p.deck;if(!Array.isArray(ids)||ids.length!==TEAM_SIZE||new Set(ids).size!==TEAM_SIZE||ids.some(id=>!p.heroes[id]?.owned||away(p,id)))return no(`파견 중이 아닌 동료 ${TEAM_SIZE}명이 필요합니다.`);
    const c=calendar(now),stage=mode==='weekly'&&p.cleared>=TIERS.easy.unlock?weeklyStage(p,now):args.stage||Math.min(MAIN_STAGES,p.cleared+1);if(!integer(stage,MAIN_STAGES)||stage<1||stage>p.cleared+1)return no('이전 스테이지를 먼저 클리어하세요.');
    if(mode!=='main'&&p.cleared<TIERS.easy.unlock)return no(`스테이지 ${TIERS.easy.unlock} 클리어 시 해금됩니다.`);
    const tier=mode==='main'?null:args.tier||'easy';if(mode!=='main'&&(!TIERS[tier]||p.cleared<TIERS[tier].unlock))return no(`${TIERS[tier]?.name||'난이도'}는 스테이지 ${TIERS[tier]?.unlock??TIERS.easy.unlock} 클리어 후 열립니다.`);
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
    const a=p.active;if(!a||a.token!==args.token||!integer(args.round))return no('이미 정산한 원정입니다.');let reward=0,clearReward=0,firstPerfect=false,unlocked=[],partOpened=false;if(!Array.isArray(p.perfect))p.perfect=[];
    if(a.mode==='main'){
      if(args.won&&a.stage===p.cleared+1){p.cleared=a.stage;clearReward=stageReward(a.stage);reward=clearReward;unlocked=grantClearUnlocks(p);partOpened=a.stage===PART_STAGES;}
      p.dust+=args.won?40+a.stage*8:12;
    }else if(a.mode==='weekly')reward=weeklyReward(a.tier||'easy',Math.min(CHALLENGE_WAVES,args.round),!!args.won);
    let record=null,newBest=false,score=0,bands=[],side=null,total=0,shownRound=0;
    if(a.mode==='monthly'){
      record={period:calendar(now).month,token:a.token,round:args.round,damage:args.damage??0,seconds:args.seconds??0,at:now,deck:[...a.deck],tier:a.tier||'easy'};
      if(!validRecord(record))return no('전투 기록을 확인하세요.');
      newBest=betterRecord(record,currentRecord(p,now));if(newBest)p.monthlyBest=record;
      if(betterRecord(record,p.monthlyLifetime))p.monthlyLifetime=record;
    }
    if(a.mode==='oath'){const out=settleOath(p,a,args,now);record=out.record;newBest=out.newBest;score=out.score;bands=out.bands;reward+=out.pay;}
    if(a.mode==='twin'){const out=settleTwin(p,a,args,now);newBest=out.newBest;side=out.side;total=out.total;shownRound=out.round;bands=out.bands;reward+=out.pay;}
    const perfect=a.mode==='main'&&!!args.won&&args.perfect===true;
    if(perfect&&a.stage<=p.cleared&&!p.perfect.includes(a.stage)){p.perfect.push(a.stage);p.perfect.sort((x,y)=>x-y);reward+=PERFECT_REWARD;firstPerfect=true;}
    const requestsDone=args.feats!==undefined?validFeats(args.feats)?applyRequestProgress(p,a.deck,args.feats):[]:undefined;
    p.dreams+=reward;p.daily.combat=true;if(integer(args.merges,999))p.daily.merges=Math.min(9999,p.daily.merges+args.merges);p.results.unshift({at:now,mode:a.mode,stage:a.stage,round:args.round,reward,won:!!args.won,...(a.tier?{tier:a.tier}:{}),...(perfect?{perfect:true}:{})});p.results=p.results.slice(0,30);p.active=null;
    return {ok:true,reward,record,newBest,perfect,firstPerfect,clearReward,unlocked,partOpened,...(a.mode==='oath'?{score,bands}:{}),...(a.mode==='twin'?{side,round:shownRound,total,bands}:{}),...(requestsDone!==undefined?{requestsDone}:{})};
  }
  if(action==='claimMonthly'){
    const record=currentRecord(p,now);if(p.active||!record||record.token!==args.token)return no('현재 만월 토벌전 최고 기록을 확인하세요.');
    if(p.monthly===record.period)return no('이번 달 기록 보상은 이미 확정했습니다.');
    const reward=monthlyReward(record);p.dreams+=reward;p.monthly=record.period;p.monthlyClaim=structuredClone(record);
    return {ok:true,reward,message:`만월 토벌전 기록 보상 확정 · 꿈의결정 +${reward}`};
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
  if(action==='setting'){if(args.id==='quality'){if(!['standard','high','low'].includes(args.value))return no('화질을 확인하세요.');}else if(!['sound','auto','reduced','cutin'].includes(args.id)||typeof args.value!=='boolean')return no('설정 값을 확인하세요.');p.settings[args.id]=args.value;return {ok:true};}
  if(action==='twinParty'){
    if(p.active?.mode==='twin')return no('진행 중인 쌍성 원정을 먼저 마치세요.');
    const party={left:{deck:args.left?.deck,relics:args.left?.relics},right:{deck:args.right?.deck,relics:args.right?.relics}};
    const problem=twinPartyProblem(p,party);if(problem)return no(problem);
    const next={left:{deck:[...party.left.deck],relics:[...party.left.relics]},right:{deck:[...party.right.deck],relics:[...party.right.relics]}};
    const cur=p.twin&&typeof p.twin==='object'&&!Array.isArray(p.twin)?p.twin:{};
    const nextTwin={...cur,party:next};delete nextTwin.set;p.twin=nextTwin;
    return {ok:true};
  }
  if(action==='requestArrive'){
    const state=requestState(p,now);if(!(now>=state.next)||state.active.length>=REQUEST_MAX)return {ok:true,arrived:[]};
    const claimed=new Set(state.claimed),busy=new Set(state.active.map(e=>REQUEST[e.id]?.hero)),candidates=[];
    for(const hero of REQUEST_HEROES){
      if(!p.heroes[hero]?.owned||busy.has(hero))continue;
      const next=Object.values(REQUEST).filter(r=>r.hero===hero&&!claimed.has(r.id)).sort((a,b)=>a.order-b.order)[0];
      if(next)candidates.push(next.id);
    }
    if(!candidates.length)return {ok:true,arrived:[]};
    const id=candidates[Math.floor(random(p)*candidates.length)];
    p.requests={next:now+REQUEST_GAP_MIN+Math.floor(random(p)*REQUEST_GAP_SPAN),active:[...state.active,{id,at:now,seen:false,count:0,done:false}],claimed:state.claimed,after:state.after,read:state.read};
    return {ok:true,arrived:[id]};
  }
  if(action==='requestSeen'){
    const e=p.requests?.active?.find(x=>x.id===args.id);if(!e)return no('부탁을 찾을 수 없습니다.');e.seen=true;return {ok:true};
  }
  if(action==='requestDecline'){
    const e=p.requests?.active?.find(x=>x.id===args.id);if(!e)return no('부탁을 찾을 수 없습니다.');if(e.done)return no('이미 끝낸 부탁은 거절할 수 없습니다.');
    p.requests.active=p.requests.active.filter(x=>x!==e);return {ok:true};
  }
  if(action==='requestThank'){
    const e=p.requests?.active?.find(x=>x.id===args.id);if(!e)return no('부탁을 찾을 수 없습니다.');if(!e.done)return no('아직 끝나지 않은 부탁입니다.');
    const hero=REQUEST[e.id].hero,gift=FAVORITE[hero];p.gifts[gift]=Math.min(999,p.gifts[gift]+REQUEST_REWARD.gifts);addBond(p.heroes[hero],REQUEST_REWARD.bond);
    p.requests.active=p.requests.active.filter(x=>x!==e);p.requests.claimed.push(e.id);
    const afterword=Object.values(REQUEST).filter(r=>r.hero===hero).every(r=>p.requests.claimed.includes(r.id));
    if(afterword&&!p.requests.after.includes(hero))p.requests.after.push(hero);
    return {ok:true,hero,gift,points:REQUEST_REWARD.bond,afterword};
  }
  if(action==='requestAfterRead'){
    if(!Array.isArray(p.requests?.after)||!p.requests.after.includes(args.hero))return no('아직 후기를 볼 수 없습니다.');
    if(!p.requests.read.includes(args.hero))p.requests.read.push(args.hero);return {ok:true};
  }
  if(action==='testGrant'){if(!UNLOCKED)return no('사용할 수 없는 동작입니다.');const message=testGrant(p,args.kind);if(!message)return no('알 수 없는 테스트 도구입니다.');return {ok:true,message};}
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

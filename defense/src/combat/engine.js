import { HERO, BLESSINGS, BLESSING, validArtifacts, BOSSES, BOSS_ORDER, CHAPTERS, DEFAULT_DECK, VERSION, GRID, MAX_RANK ,TIERS,CHALLENGE_WAVES} from '../content.js';
import { TEAM_SIZE } from '../team-config.js';
import {oathMods,oathConflict,OATH_WAVES} from '../preview/oath.js';
import {TWIN_WAVES,TWIN_STAGE} from '../preview/twin.js';
import { RELIC_LEVEL_STEP } from '../economy.js';
import {MIRACLE_FORMS} from '../new-companions.js';
export {MIRACLE_FORMS} from '../new-companions.js';
export const miracleForm=u=>u?.hero==='miracle_larva'?(u.form||'miracle_larva'):null;
export const unitHero=(s,u)=>u.hero==='miracle_larva'?{...HERO[u.hero],...MIRACLE_FORMS[miracleForm(u)]}:HERO[u.hero];
const shotHero=shot=>shot.hero==='miracle_larva'?{...HERO[shot.hero],...MIRACLE_FORMS[shot.form||'miracle_larva']}:HERO[shot.hero];
export const pendingMiracles=s=>s.board.filter(u=>u?.hero==='miracle_larva'&&!u.cursed&&['miracle_larva','miracle_cocoon'].includes(miracleForm(u)));
export const DEATHHAND=Object.freeze({base:4,perDebuff:4,radius:180,critDamage:.5});
const castCrits=new WeakMap();
export function unitCrit(s,u,index=s.board.indexOf(u)){
  if(!s.crit)return null;
  const strength=index<0?0:neighbors(index).reduce((best,i)=>{const a=s.board[i];return a&&!a.cursed&&miracleForm(a)==='miracle_wing'?Math.max(best,.2*rankSupport(a.rank)*special(s,'miracle_larva')):best;},0);
  const aura=strength*(u.hero==='behemoth'&&!u.cursed&&!(u.disabled>0)?2:1);
  return {chance:clamp(s.crit.chance+aura,0,1),damage:s.crit.damage+(u.hero==='demon_king'&&!u.cursed?DEATHHAND.critDamage:0)};
}
// Forked from active Confluence at d4c32cf. Its geometry and authored attacks
// remain shared in meaning; Star Garden owns pacing and persistent growth.
export const MAIN_WAVES=6;
export const special=(s,id)=>(s.meta?.[id]?.special||1);

export const PATH = [[76,142],[644,142],[644,684],[76,684],[76,142]];
export const PATH_LENGTH = 2220;
export const BALANCE_REVISION = 3;
export const BOSS_HEALTH_SCALE = .65;
// Renewal v1 raised average roster damage by about 36%. Main-stage health uses
// base 100 and stage slope 2.5 (was 76 and 2.05) so a no-growth starter deck
// keeps its stage 1–3 pace (docs/archive/STAT_SIMULATION.md). Weekly and monthly health
// use challengeBase and TIERS; boss health is then scaled by BOSS_HEALTH_SCALE.
export const WAVE_BASE_HEALTH = 100;
export const ATTACK_WINDUP = .13;
export const GAUGE_MAX = 120;
export const FINISHER_DELAY = .3;
export const STATUS_REVISION=1;
export const POISON_CAP=40;
export const DIVINE_CAP=3;
export const DAMAGE_TAKEN_CAP=.8;
// Merge growth (docs/archive/STAT_RENEWAL.md §2): attack ×2.35 per rank. Support auras
// are +20% per rank. Control seconds, skill buffs, and basic-attack slow amounts
// are +10% per rank (rankControl). Slows still cap at 80% for every enemy.
export const rankSupport=rank=>1+.2*(rank-1);
export const rankControl=rank=>1+.1*(rank-1);
export const TRAINING_STEP=.25;
// Field-wide ultimate buffs. They multiply with placement auras, so they stay modest.
export const ULT_BUFF=Object.freeze({haste:{speed:.3,seconds:10},awaken:{power:.35,seconds:10},march:{speed:.2,seconds:8},festive:{speed:.2,seconds:6},radiance:{power:.5,seconds:8},harmony:{power:.22,speed:.22,seconds:10},echo:{ratio:.65,seconds:8}});
export const STARFALL_FACTOR=.5,THUNDER_FACTOR=8;
// Divine marks feed starlight when the marked enemy falls (per remaining stack).
export const DIVINE_GAUGE=.5,DIVINE_BOSS_GAUGE=3;
// Bosses take half stun/freeze duration and half knockback/pull, then 2 s of control immunity.
export const BOSS_CONTROL_SCALE=.5,BOSS_CONTROL_IMMUNITY=2,BOSS_PUSH_SCALE=.5;
export const FROST_RELOCK=3;
export const ZONE_CAP=75;
// One poison stack deals 1.5 per second for an 11-power caster (renewal v1).
export const POISON_POWER_RATIO=1.5/11;
// Independent ground fields retain their authored ticks. A small cadence
// correction limits the increase from replacing refreshes with overlapping hits.
export const ZONE_CADENCE=1.15;
export const zoneCadence=id=>HERO[id]?.shape==='zone'&&id!=='flame_sage'?ZONE_CADENCE:1;
// Rumi's hidden dream form: a 5★ Rumi casts it instead of the echo (same starlight). Sun, moon and star
// strike the whole field in turn, then imagination becomes real. Not in the hero sheet; the battle peek shows it.
export const QUAKE_FACTOR=2.4;
export const WINTER_EXPOSURE=.15;
// Burn from basic attacks (trait, venom, red joker, flame floor) and from ultimates. The ember relic spread keeps its own 3 s.
export const BURN=Object.freeze({attack:.3,attackSeconds:4,skill:.7,skillSeconds:7});
// Time Magician trauma form: fixed power and speed while the buff lasts.
export const TRAUMA=Object.freeze({power:1.5,speed:.35});
export const SNOW_RABBIT=Object.freeze({slow:.35,trainingSlow:.02,freeze:2,skillSlow:.5,seconds:6});
export const WINTER_COURT=Object.freeze({slow:.5,seconds:6,killFreeze:.8});
// Both additions are percentage points: +0.1% per rank after 1★ and per enhancement milestone.
export const stormExecuteChance=(s,rank=1)=>Math.min(1,.01+.001*(rank-1)+.01*(special(s,'storm_sage')-1));
export const winterDuration=(s,u)=>skillDuration(s,WINTER_COURT.seconds*special(s,'frost_witch')*rankControl(u.rank));
// Behemoth: three 6x shocks, half a second apart, around one random enemy.
// queue: how many casts' worth of pending shocks a save may hold (each cast queues three). Casting is not locked,
// so plenty of starlight (high spring bed, test builds, smart auto) can stack several casts inside 1.25 s.
export const CRUSH=Object.freeze({factor:6,radius:112.5,trainingRadius:.05,hits:3,first:.25,gap:.5,queue:24});
// Opening artillery: charge on the actual body, then read live power/targets at release.
// Flight is presentation travel, not another five-second damage snapshot.
export const GOLD_DRAGON=Object.freeze({opening:10,bonus:1,charge:5,factor:22,radius:180,flight:.62});
export const goldOpening=s=>s.phase==='combat'&&s.waveTime<GOLD_DRAGON.opening-1e-9;
export const charging=(s,u)=>!!u&&s.phase==='combat'&&s.goldCharge?.wave===s.wave&&s.goldCharge.source===u.uid;
// Forecast only the known timer changes for the skill peek/auto. Real release always reads real combatStats.
export function goldBreathPower(s,u,delay=GOLD_DRAGON.charge){
  const board=s.board.map(a=>a?{...a,disabled:Math.max(0,a.disabled-delay),...(a.uid===u.uid?{cursed:false}:{})}:a),future={...s,board,waveTime:s.waveTime+delay,buffs:Object.fromEntries(Object.entries(s.buffs).map(([k,v])=>[k,Math.max(0,v-delay)]))};
  return combatStats(future,board.find(a=>a?.uid===u.uid)||u).damage;
}
export function goldBreathTarget(s,u){
  const alive=s.enemies.filter(e=>e.hp>0),bosses=u.priority==='boss'?alive.filter(e=>e.boss):[],pool=bosses.length?bosses:alive;
  return pool.reduce((a,b)=>!a?b:u.priority==='strong'?(a.hp>=b.hp?a:b):u.priority==='last'?(a.progress<=b.progress?a:b):(a.progress>=b.progress?a:b),null);
}
export const crushRadius=s=>CRUSH.radius*(1+(s.upgrades.behemoth||0)*CRUSH.trainingRadius);
// Galaxy whale harvests divine marks into the blast (8x, +100% per mark, 3 marks = 32x) and does not stun.
export const WHALE=Object.freeze({factor:8,perMark:1});
export const RUMI_DREAM=Object.freeze({rank:5,name:'꿈의 형태',phases:Object.freeze([{at:.45,factor:12},{at:1,factor:12},{at:1.55,factor:12},{at:2.3,factor:14}])});
export const rumiDream=(s,u=bestUnit(s,'rumi'))=>!!u&&u.hero==='rumi'&&u.rank>=RUMI_DREAM.rank;
export const ACTIVE_SKILLS=Object.freeze({rumi:'echo',siren:'haste',ancient_dragon:'awaken',silver_rabbit:'march',santa:'festive',jasmine:'radiance',time_magician:'trauma',harmonious:'harmony',cinderella:'midnight',frost_witch:'winter',venom:'venom'});
const buffScale=(s,key)=>s.buffScale?.[key]||1;
// Core health: 20 in stages and drafts, 7 in the monthly boss rush (one boss leak ends it).
// Zeke's crisis reads "below half" of that, so a full monthly core is never a crisis.
export const MONTHLY_HEALTH=7;
export const coreHealthMax=s=>s.mode==='monthly'?MONTHLY_HEALTH:(s.oathMods?.core||20);
export const coreCrisis=s=>s.health<coreHealthMax(s)/2;
// Zeke's trait: an enemy alive in the last quarter of the path (next to the core) raises his attack by 40%.
export const zekeFury=s=>s.enemies.some(e=>e.hp>0&&e.progress>=PATH_LENGTH*.75);
export function activeSkill(s,id){const key=ACTIVE_SKILLS[id],remaining=s.buffs[key]||0;return remaining>0?{key,remaining,total:Math.max(remaining,s.buffTotals?.[key]||remaining)}:null;}
// Running ultimates that refuse a second press: a pure buff would only restart its timer, and the
// dream form keeps one sequence of phases. Damage-and-buff hybrids
// (glassfall, gift, goddess, trauma, ice court, crush, venomplague) stay recastable because the hit is the point.
export const PURE_BUFFS=new Set(['echo','haste','awaken','march','harmony']);
export function castLock(s,id){
  if(id==='gold_dragon'&&s.goldCharge)return {kind:'charge',reason:'별빛을 모으는 중입니다.',remaining:Math.max(0,s.goldCharge.ends-s.time),total:GOLD_DRAGON.charge};
  if(id==='miracle_larva'&&!pendingMiracles(s).length)return {kind:'evolution',reason:'우화할 라바·코쿤이 없습니다.'};
  const u=bestUnit(s,id);if(!u)return null;
  if(rumiDream(s,u)){const remaining=(s.volleys||[]).reduce((m,v)=>v.kind==='dream'?Math.max(m,v.life):m,0);return remaining>0?{kind:'dream',remaining,total:RUMI_DREAM.phases.at(-1).at}:null;}
  const active=PURE_BUFFS.has(HERO[id].skill.type)&&activeSkill(s,id);return active?{kind:'buff',...active}:null;
}
export const BOARD = {x:135,y:212,cell:90};
export const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
export function attackDirection(from,to){const dx=to.x-from.x,dy=to.y-from.y;return Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';}
export function cellPoint(i){return {x:BOARD.x+(i%GRID+.5)*BOARD.cell,y:BOARD.y+(Math.floor(i/GRID)+.5)*BOARD.cell};}
export function cellAt(x,y){const c=Math.floor((x-BOARD.x)/BOARD.cell),r=Math.floor((y-BOARD.y)/BOARD.cell);return c>=0&&c<GRID&&r>=0&&r<GRID?r*GRID+c:-1;}
export function pathPoint(distance){
  let d=clamp(distance,0,PATH_LENGTH);
  for(let i=1;i<PATH.length;i++){
    const [ax,ay]=PATH[i-1],[bx,by]=PATH[i],l=Math.hypot(bx-ax,by-ay);
    if(d<=l) return {x:ax+(bx-ax)*d/l,y:ay+(by-ay)*d/l,angle:Math.atan2(by-ay,bx-ax)};
    d-=l;
  }
  return {x:76,y:142,angle:-Math.PI/2};
}
export function random(s){let x=s.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
// Critical hits (the dawn garden): chance and total damage multiplier, rolled on a stream of their own so the
// other randomness of a run (summons, rewards, targets) is the same with or without them.
const critSeed=seed=>((seed>>>0)^0x9e3779b9)>>>0||1;
function cleanCrit(c){return c&&Number.isFinite(c.chance)&&Number.isFinite(c.damage)&&c.chance>0?{chance:clamp(c.chance,0,1),damage:clamp(c.damage,1,10)}:null;}
function critRoll(s,chance){let x=s.critRng|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.critRng=x>>>0||1;return s.critRng/4294967296<chance;}
function shuffle(s,values){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function validDeck(deck){return Array.isArray(deck)&&deck.length===TEAM_SIZE&&new Set(deck).size===TEAM_SIZE&&deck.every(id=>HERO[id]);}
export function event(s,type,data={}){s.events.push({type,time:s.time,...data});if(s.events.length>200)s.events.shift();}
export function has(s,id){return s.artifacts.includes(id);}
// Relic numbers at level 1 (relicScaleIn multiplies them per level). One place for tuning; texts live in data.js.
export const RELIC_VALUES=Object.freeze({
  // Relic pass 7 (docs/archive/RELIC_PASS7.md): lantern refunds a share and hourglass adds a little per merge, so no ultimate
  // or merge loop can feed itself; outliers above ~1.3x of their budget came down; constellation rewards a real mosaic.
  hourglass:{starlight:10,store:60},ember:{burn:.7},frost:{slowed:.22},banner:{power:.21},chorus:{speed:.35,count:3},lantern:{refund:.2},lens:{boss:.3},seed:{poison:.4},
  feather:{base:6,perWave:3,cap:60},crown:{power:.16},sprout:{power:.2,discount:2},amulet:{near:.35,starlight:15,uses:1},
  meteor:{hit:1.1},prism:{chain:.9},tide:{splash:.22},roots:{life:.15,radius:.06},guild:{power:.25},phoenix:{taken:.2,uses:1},
  twin:{echo:1},constellation:{three:.32,four:.5},alchemy:{power:.5,waves:2},orbit:{tick:.05},tempo_bell:{perWave:.04,cap:.36},chalice:{taken:.6,poison:5},
  royal_seal:{starlight:30,boss:.4},gift_ribbon:{chance:.25},broken_clock:{duration:1},
});
const RV=RELIC_VALUES;
export const relicScaleIn=(s,id)=>1+RELIC_LEVEL_STEP*((s.relicLevels?.[id]||1)-1);
export function summonCost(s){return s.freeSummons>0?0:Math.max(8,10+s.paidSummons*2-(has(s,'sprout')?RV.sprout.discount:0));}
// Doom's merge refund is flat per material rank, so merging never waits on training.
export const DOOM_REFUND=40;
export const doomRefund=rank=>DOOM_REFUND*rank;
export const waveIncome=wave=>56+Math.floor(wave);
// Starlight favours time in combat over merge volume; bosses still pay 30G.
export const MERGE_STARLIGHT=4,STARLIGHT_PER_SECOND=2,BOSS_GOLD=30;
const CLOCK_BUFFS=['haste','awaken','march','festive','radiance','harmony','echo','trauma'];
export const skillDuration=(s,seconds,key)=>seconds*(CLOCK_BUFFS.includes(key)&&has(s,'broken_clock')?1+RV.broken_clock.duration*relicScaleIn(s,'broken_clock'):1);
export const unitForm=(s,u)=>miracleForm(u)||(u.hero==='time_magician'&&s.buffs.trauma>0?'trauma':null);
export function highestMaxHp(s){return s.enemies.filter(e=>e.hp>0).reduce((a,b)=>!a||b.maxHp>a.maxHp||b.maxHp===a.maxHp&&b.uid<a.uid?b:a,null);}
export const queenIncome=(rank,wave,level=0)=>6+rank*6+Math.floor((wave-1)/3)+level*3;
export const QUEEN_CAP=90;
// Immediate gold from the Queen's ultimate. +50% of this wave's base income is edictWave, once per wave.
export const QUEEN_TAX=20;
// Doom's black market: 7x base (+1x per training level), +1x for every 40 gold left after paying, up to +5x.
export const fortuneFactor=(goldAfter,level=0)=>7+level+Math.min(5,Math.floor(Math.max(0,goldAfter)/40));
export const executeThresholdFor=k=>Math.min(.5,.4+(k-1)*.2);
export const executeThreshold=(e,s=null)=>executeThresholdFor(s?special(s,'luna'):1);
export function dividend(s){return Math.min(QUEEN_CAP,s.board.reduce((n,u)=>n+(u?.hero==='queen'?queenIncome(u.rank,s.wave,s.upgrades.queen):0),0));}
export function upgradeCost(s,id){return Math.ceil((28+(s.upgrades[id]||0)*24)*(1-s.trainingDiscount));}
export function neighbors(index){const x=index%5,y=Math.floor(index/5);return [x>0?index-1:-1,x<4?index+1:-1,y>0?index-5:-1,y<4?index+5:-1].filter(i=>i>=0);}
// Invincibility (Cure Master's own passive, Lemonade, or her aura on four orthogonal neighbours) blocks
// debuffs and removal alike: Thor's judgement and Ash's Armageddon.
export function invincible(s,index){
  const u=s.board[index];if(!u)return false;
  if(charging(s,u)||u.hero==='cure_master'||(u.invincible||0)>0)return true;
  return neighbors(index).some(i=>{const n=s.board[i];return n?.hero==='cure_master'&&!n.cursed&&!(n.disabled>0);});
}
// Debuff immunity: stuns, seals and curses from enemies or allies. Antropy always has it. Removal is not a debuff,
// so Antropy alone does not stop judgement or Armageddon.
export function immune(s,index){
  const u=s.board[index];if(!u)return false;
  return u.hero==='antropy'||invincible(s,index);
}
const wardHero=(s,i)=>charging(s,s.board[i])?'gold_dragon':invincible(s,i)?'cure_master':'antropy';
export function stunUnit(s,index,seconds){const u=s.board[index];if(!u||immune(s,index))return;u.disabled=Math.max(u.disabled||0,seconds);}
export const targetingLocked=id=>id==='avalanche_maid'||id==='flame_sage';
export const GROUND_BOUNDS=Object.freeze({left:24,right:696,top:72,bottom:734});
export const skillGoldCost=id=>HERO[id]?.skill.goldCost||0;
// The highest-rank Cinderella carries the solo bonus; ties keep the oldest.
// The true Cinderella (highest rank, then oldest) carries the clock. Every attack moves it one hour
// (three during the ultimate); the twelfth strikes the midnight bell on the boss, or on the target.
export const CINDERELLA=Object.freeze({top:1.5,bell:10,splash:3,radius:150,ult:3,haste:.5});
export function topCinderella(s){return s.board.filter(u=>u?.hero==='cinderella'&&!u.cursed).reduce((a,b)=>!a||b.rank>a.rank||b.rank===a.rank&&b.uid<a.uid?b:a,null);}
function syncTimeRuler(s){
  const rulers=s.board.filter(u=>u?.hero==='time_ruler');
  if(!rulers.length){s.timeRulerUid=null;return null;}
  const rank=Math.max(...rulers.map(u=>u.rank)),top=rulers.filter(u=>u.rank===rank);
  const unit=top.find(u=>u.uid===s.timeRulerUid)||top.reduce((a,b)=>a.uid<b.uid?a:b);
  s.timeRulerUid=unit.uid;return unit;
}
// Underdog (노멀 덱 다크호스) and Toffee Apple (저축 폭탄): numbers from docs/plans/UPCOMING_BALANCE.md.
export const UNDERDOG=Object.freeze({bonus:.8,factor:10,stun:2});
export const APPLEBOMB=Object.freeze({factor:18,max:5,trigger:80,stun:3,radius:200});
// Sunflower: one shared stack (0..3) of sunlight, +1 when a wave ends while a sunflower stands on the board. Its basic
// attack bursts around the target with the radius of the current stack; Solar Flare spends the whole stack.
export const SUNFLOWER=Object.freeze({max:3,radius:Object.freeze([0,30,60,90]),base:2,per:4});
export const sunRadius=s=>SUNFLOWER.radius[Math.min(SUNFLOWER.max,s.sunlight||0)];
// Five colours, including the initial red, unlock Chaos for the rest of this run.
export const JOKER=Object.freeze({colors:Object.freeze(['red','blue','green','white','black']),all:31,chaosCost:100,roulette:3,burn:.3,slow:.2,exposure:.06});
export const JOKER_NAMES=Object.freeze({red:'빨강 · 화상',blue:'파랑 · 감속',green:'초록 · 중독',white:'하양 · 성광',black:'검정 · 노출',chaos:'카오스 룰렛'});
export const jokerChaos=s=>s.jokerColor==='chaos';
export const skillCost=(s,id)=>(id==='joker'&&jokerChaos(s)?JOKER.chaosCost:HERO[id]?.skill.cost||0)+(s?.oathMods?.skillCost||0);
export const skillName=(s,id)=>id==='joker'&&jokerChaos(s)?JOKER_NAMES.chaos:HERO[id]?.skill.name;
const jokerBit=color=>1<<JOKER.colors.indexOf(color);
// The roulette picks a new colour at random among the four it is not showing, so every cast changes the colour.
export const pickJokerColor=(s,color)=>{const others=JOKER.colors.filter(c=>c!==color);return others[Math.min(others.length-1,Math.floor(random(s)*others.length))];};
export const REQUIEM=Object.freeze({factor:8});
export const LEMONADE=Object.freeze({seconds:4});
// Ash burns the lowest other ally (an immune pick is guarded, not skipped), then hits the densest pack inside the radius.
export const ARMAGEDDON=Object.freeze({factor:22,radius:180});
// Venom Plague strikes for 3x, stacks poison, then burn and poison ticks deal double (1+amp) for the buff.
export const VENOM_PLAGUE=Object.freeze({factor:3,stacks:3,seconds:10,amp:1});
export function personalTrait(s,u,index=s.board.indexOf(u)){
  const trait={damageMultiplier:1,speedBonus:0,chainRatio:.65,extraChain:0,key:null,active:false,label:''};
  if(u.hero==='gold_dragon'){const blocked=u.cursed&&!charging(s,u),active=!blocked&&goldOpening(s);Object.assign(trait,{key:'gold-opening',active,damageMultiplier:active?1+GOLD_DRAGON.bonus:1,label:blocked?'저주 · 특성 무효':active?'강화 · 공격력 +100%':'개전 강화 종료'});}
  if(u.hero==='demon_king')Object.assign(trait,{key:'critDamage',active:!u.cursed,label:u.cursed?'저주 · 특성 무효':'치명타 피해 +50%p'});
  if(u.hero==='miracle_larva'){
    const form=miracleForm(u),wing=form==='miracle_wing',abyss=form==='abyss_wing';
    Object.assign(trait,{key:'evolution',form,active:!u.cursed&&(wing||abyss),label:u.cursed?'저주 · 특성 무효':wing?`인접 치명타 +${pctText(.2*rankSupport(u.rank)*special(s,u.hero))}p`:abyss?`감속 ${pctText(Math.min(.8,.25*rankControl(u.rank)*special(s,u.hero)))} · 중독 1중첩`:'우화 대기'});
  }
  if(u.hero==='lightning_sage'){
    const seen=new Set(),pending=index>=0&&s.board[index]?.uid===u.uid?[index]:[];
    while(pending.length){const cell=pending.pop();if(seen.has(cell)||s.board[cell]?.hero!=='lightning_sage')continue;seen.add(cell);for(const n of neighbors(cell))if(!seen.has(n)&&s.board[n]?.hero==='lightning_sage')pending.push(n);}
    const size=seen.size;Object.assign(trait,{key:'lightning',size,active:size>=2,label:size>=2?`번개 연결 ${size}기 · 공격력 +${size===2?20:size===3?40:60}%`:'번개 연결 대기'});
    if(size>=2){trait.damageMultiplier=size===2?1.20:size===3?1.40:1.60;trait.chainRatio=size===2?.70:size===3?.75:.80;trait.extraChain=size>=4?1:0;}
  }else if(u.hero==='star_boy'||u.hero==='time_ruler'){
    const age=Math.max(0,s.wave-(u.birthWave??s.wave)),star=u.hero==='star_boy';
    trait.damageMultiplier=star?(age===0?1.5:age===1?1:.75):(age===0?.75:age===1?1:1.25);
    Object.assign(trait,{key:'wave-age',age,active:age!==1,label:`${star?'별의 주기':'시간의 흐름'} · ${age===0?'등장':age===1?'다음':'이후'} 웨이브 ${Math.round(trait.damageMultiplier*100)}%`});
  }else if(u.hero==='aurora'){
    const count=s.board.filter(unit=>unit?.hero==='aurora').length,active=count>=2&&count%2===0;
    Object.assign(trait,{key:'even-formation',count,active,damageMultiplier:active?1.5:1,label:active?`아우로라 ${count}기 · 공격력 +50%`:`아우로라 ${count}기 · 짝수 보너스 대기`});
  }else if(u.hero==='cinderella'){
    const top=topCinderella(s),active=top?.uid===u.uid,clock=u.clock||0,step=s.buffs.midnight>0?3:1;
    Object.assign(trait,{key:'cinderella',uid:top?.uid??null,active,clock,damageMultiplier:active?CINDERELLA.top:1,label:active?`진짜 신데렐라 · 공격력 +50% · 자정의 종까지 ${Math.ceil((12-clock)/step)}회`:`진짜 신데렐라 ${top?.rank??''}성이 따로 있어요`});
  }else if(u.hero==='zeke'){
    const active=zekeFury(s);
    Object.assign(trait,{key:'last-quarter',active,damageMultiplier:active?1.4:1,label:active?'광폭 · 공격력 +40%':'광폭 대기'});
  }else if(u.hero==='flame_sage')Object.assign(trait,{key:'wildfire',active:true,zoneDamageMultiplier:1.3,zoneRadiusMultiplier:1.3,zoneDurationMultiplier:1.3,label:'경로 위 무작위 · 화염장 +30%'});
  else if(u.hero==='avalanche_maid')Object.assign(trait,{key:'random-target',active:true,label:'무작위 표적 고정 · 기본 공격력 +50%'});
  else if(u.hero==='storm_sage')Object.assign(trait,{key:'storm-execute',active:true,executeChance:stormExecuteChance(s,u.rank),label:`일반 적 명중마다 즉사 ${pctText(stormExecuteChance(s,u.rank))}`});
  else if(u.hero==='underdog'){const active=s.deck.every(id=>HERO[id].rarity==='C'&&!HERO[id].hidden);Object.assign(trait,{key:'underdog',active,damageMultiplier:active?1+UNDERDOG.bonus:1,label:active?`노멀 덱 · 공격력 +${Math.round(UNDERDOG.bonus*100)}%`:'노멀 덱 대기'});}
  else if(u.hero==='sunflower'){const n=Math.min(SUNFLOWER.max,s.sunlight||0);Object.assign(trait,{key:'sunlight',active:n>0,sunlight:n,radius:SUNFLOWER.radius[n],label:n?`햇빛 ${n}/${SUNFLOWER.max} · 폭발 반경 ${SUNFLOWER.radius[n]}`:`햇빛 0/${SUNFLOWER.max} · 폭발 없음`});}
  else if(u.hero==='joker'){const color=s.jokerColor||'red';Object.assign(trait,{key:'joker',active:true,color,label:jokerChaos(s)?'카오스 · 일반 공격 시 화상·감속·중독·성광·노출':`${JOKER_NAMES[color]} · ${JOKER.colors.filter(c=>(s.jokerSeen||1)&jokerBit(c)).length}/5색`});}
  else if(u.hero==='antropy')Object.assign(trait,{key:'antropy',active:true,label:'디버프 무효'});
  else if(u.hero==='cure_master'){
    const n=index<0?0:neighbors(index).filter(i=>s.board[i]).length,active=!u.cursed&&!(u.disabled>0);
    Object.assign(trait,{key:'cure',active:true,label:active&&n?`자체 무적 · 오라 ${n}명`:'자체 무적'});
  }
  return trait;
}
export function harmonyAt(s,index){return index<0?0:new Set(neighbors(index).map(i=>s.board[i]?.hero).filter(id=>id&&id!=='harmonious')).size;}
export function nightRabbitTargetCount(s){return 9+2*new Set(s.board.filter(u=>u&&['snow_rabbit','silver_rabbit'].includes(u.hero)).map(u=>u.hero)).size;}
export function harmonyStrength(s,index){
  const count=harmonyAt(s,index),level=s.upgrades.harmonious||0,scale=special(s,'harmonious')*rankSupport(s.board[index]?.rank||1);
  return {count,damage:count*(.06+level*.005)*scale,speed:count*(.05+level*.002)*scale};
}
// Dessert Ensemble spreads the harmony aura to the whole field for its duration.
export function harmonyField(s){
  if(!(s.buffs.harmony>0))return {damage:0,speed:0};
  const level=s.upgrades.harmonious||0,scale=special(s,'harmonious')*buffScale(s,'harmony');
  return {damage:(ULT_BUFF.harmony.power+level*.02)*scale,speed:(ULT_BUFF.harmony.speed+level*.02)*scale};
}
export function bestUnit(s,id){
  if(id==='gold_dragon'&&s.goldCharge){const caster=s.board.find(u=>charging(s,u));if(caster)return caster;}
  return id==='time_ruler'?syncTimeRuler(s):id==='cinderella'?topCinderella(s)||undefined:s.board.filter(u=>u?.hero===id&&(id==='gold_dragon'||!u.cursed)).sort((a,b)=>b.rank-a.rank)[0];
}
export function power(s,u){return unitHero(s,u).damage*Math.pow(2.35,u.rank-1)*(1+(s.upgrades[u.hero]||0)*TRAINING_STEP)*(s.meta?.[u.hero]?.power||1)*(1+(s.relicAttack||0))*(1+s.globalAttack)*(s.surgeWave===s.wave?1.25:1)*personalTrait(s,u).damageMultiplier;}
export function trainingBonus(id,level){
  if(id==='frost_witch')return `감속 대상 빙결 ${(.6+level*.06).toFixed(2)}초 · 보스 절반`;
  if(id==='harmonious')return `조화 1종당 공격력 +${6+level*.5}% · 공속 +${Number((5+level*.2).toFixed(1))}% · 앙상블 +${Math.round(ULT_BUFF.harmony.power*100)+level*2}%`;
  if(id==='aurora')return `환영탄 공격력 ${75+level*3}%`;
  const extra={doom:`필살기 기본 ${7+level}배`,queen:`1성 배당 ${queenIncome(1,1,level)}G`,siren:`인접 공속 +${15+level*3}%`,ancient_dragon:`인접 공격 +${20+level*3}%`,snow_rabbit:`감속 ${Math.round((SNOW_RABBIT.slow+level*SNOW_RABBIT.trainingSlow)*100)}%`,guardian:`세 번째 공격 기절 ${(.7+level*.05).toFixed(2)}초`,great_detective:`일반 노출 +${8+level*2}% · 보스 +${15+level*2}%`,time_ruler:`장판 감속 ${25+level*3}%`,santa:`선물 폭탄 공격력 ${200+level*20}%`,time_magician:`인접 추가 공격 공격력 ${60+level*5}%`,behemoth:`오라 2배 · 필살기 범위 +${Math.round(level*CRUSH.trainingRadius*100)}%`};
  return extra[id]||'';
}
// Base-power comparison excludes rank, relics and temporary buffs; it never
// claims a compounding +25% increase over the previous upgrade.
export const trainingPower=(id,level)=>Number((HERO[id].damage*(1+level*TRAINING_STEP)).toFixed(2));
const pctText=v=>`${Number((v*100).toFixed(1))}%`,secText=v=>`${Number(v.toFixed(1))}초`;
// Numbers in the hero sheet text that grow with enhancement milestones (special): [as written for a 1-star unit, current value].
// Ultimate durations, control times and ultimate slows grow too.
export function scaledTokens(id,k){
  const pctK=v=>pctText(v*k),slow=v=>pctText(Math.min(.8,v*k)),sec=v=>secText(v*k);
  const trait={snow_rabbit:[['35%',slow(SNOW_RABBIT.slow)]],siren:[['15%',pctK(.15)]],great_detective:[['8%',pctK(.08)],['15%',pctK(.15)]],guardian:[['0.7초',sec(.7)]],ancient_dragon:[['20%',pctK(.2)]],phantom:[['25%',slow(.25)]],
    luna:[['40%',pctText(executeThresholdFor(k))]],time_magician:[['60%',pctK(.6)]],time_ruler:[['25%',slow(.25)]],galaxy_whale:[['40%',slow(.4)]],harmonious:[['+6%','+'+pctK(.06)],['+5%','+'+pctK(.05)]],frost_witch:[['40%',slow(.4)],['0.6초',sec(.6)]],storm_sage:[['1%',pctText(.01*k)]],joker:[['20%',slow(.2)]]}[id]||[];
  const skill={great_detective:[['35%',pctText(Math.min(DAMAGE_TAKEN_CAP,.35*k))]],aurora:[['50%',pctText(Math.min(1,.5*k))]],snow_rabbit:[['2초',sec(2)],['50%',slow(.5)]],frost_witch:[['6초 동안',sec(6)+' 동안'],['50%',slow(.5)]],
    storm_sage:[['1.5초',sec(1.5)],['60%',slow(.6)]],guardian:[['1.5초',sec(1.5)],['3초',sec(3)]],lightning_sage:[['1.2초',sec(1.2)]],time_ruler:[['6초 전',sec(6)+' 전'],['2초',sec(2)]],
    siren:[['10초',sec(10)]],ancient_dragon:[['10초',sec(10)]],silver_rabbit:[['8초',sec(8)]],santa:[['6초',sec(ULT_BUFF.festive.seconds)]],jasmine:[['8초',sec(8)]],time_magician:[['10초',sec(10)]],harmonious:[['10초',sec(10)]],rumi:[['8초',sec(8)]],cinderella:[['10초',sec(10)]],
    luna:[['40%',pctText(executeThresholdFor(k))]],phantom:[['25%',pctText(Math.min(DAMAGE_TAKEN_CAP,.25*k))]],cure_master:[['4초',sec(4)]],venom:[['10초',sec(10)]]}[id]||[];
  return {trait,skill};
}
// The trait text's growing numbers as this unit has them now (rank, training, enhancement), for the battle ⓘ sheet.
// Same formulas as the attack code; the text keeps every condition and only the numbers change.
export function liveTraitTokens(s,u){
  const level=s.upgrades[u.hero]||0,k=special(s,u.hero),sup=rankSupport(u.rank),ctl=rankControl(u.rank);
  if(miracleForm(u)==='miracle_wing')return [['20%p',pctText(.2*k*sup)+'p']];
  if(miracleForm(u)==='abyss_wing')return [['25%',pctText(Math.min(.8,.25*k*ctl))]];
  const slow=v=>pctText(Math.min(.8,v)),taken=v=>pctText(Math.min(DAMAGE_TAKEN_CAP,v)),num=v=>Number(v.toFixed(2));
  return ({
    snow_rabbit:[['35%',slow((SNOW_RABBIT.slow+level*SNOW_RABBIT.trainingSlow)*ctl*k)]],
    siren:[['15%',pctText((.15+level*.03)*k*sup)]],
    great_detective:[['8%',taken((.08+level*.02)*k*ctl)],['15%',taken((.15+level*.02)*k*ctl)]],
    guardian:[['0.7초',secText((.7+level*.05)*k*ctl)]],
    ancient_dragon:[['20%',pctText((.2+level*.03)*k*sup)]],
    phantom:[['25%',slow(.25*ctl*k)]],
    luna:[['40%',pctText(executeThreshold(null,s))]],
    time_magician:[['60%',pctText((.6+level*.05)*sup*k)]],
    time_ruler:[['25%',slow((.25+level*.03)*ctl*k)]],
    galaxy_whale:[['40%',slow(.4*ctl*k)]],
    harmonious:[['+6%','+'+pctText((.06+level*.005)*k*sup)],['+5%','+'+pctText((.05+level*.002)*k*sup)]],
    frost_witch:[['40%',slow(.4*ctl*k)],['0.6초',secText((.6+level*.06)*k*ctl)]],
    storm_sage:[['1%',pctText(stormExecuteChance(s,u.rank))]],
    joker:[['20%',slow(JOKER.slow*k)]],
    aurora:[['75%',pctText(.75+level*.03)]],
    santa:[['범위와 공격력이 두 배','범위가 두 배, 공격력이 '+num(2+level*.2)+'배']],
  })[u.hero]||[];
}
// What this unit gives the board right now (the ⓘ sheet), with live rank, training and enhancement.
export function givenEffects(s,u,index){
  const level=s.upgrades[u.hero]||0,k=special(s,u.hero),near=neighbors(index).filter(i=>s.board[i]&&!s.board[i].cursed).length,out=[];if(u.cursed)return ['저주받아 효과 없음'];
  if(u.hero==='siren')out.push(`인접 ${near}명 공속 +${pctText((.15+level*.03)*k*rankSupport(u.rank))}`);
  else if(u.hero==='ancient_dragon')out.push(`인접 ${near}명 공격력 +${pctText((.2+level*.03)*k*rankSupport(u.rank))}`);
  else if(u.hero==='harmonious'){const h=harmonyStrength(s,index);out.push(`인접 ${near}명 · 조화 ${h.count}종 · 공격력 +${pctText(h.damage)} · 공속 +${pctText(h.speed)}`);}
  else if(u.hero==='time_magician')out.push(`인접 ${near}명 · 3타마다 추가 공격 ${pctText((.6+level*.05)*rankSupport(u.rank)*k)}`);
  else if(u.hero==='great_detective')out.push(`맞은 적 받는 피해 +${pctText(Math.min(DAMAGE_TAKEN_CAP,(.08+level*.02)*k*rankControl(u.rank)))} (보스 +${pctText(Math.min(DAMAGE_TAKEN_CAP,(.15+level*.02)*k*rankControl(u.rank)))})`);
  else if(u.hero==='guardian')out.push(`3타마다 기절 ${secText((.7+level*.05)*k*rankControl(u.rank))}`);
  else if(u.hero==='frost_witch')out.push(`감속 ${pctText(Math.min(.8,.4*rankControl(u.rank)*k))} · 느려진 적 빙결 ${secText((.6+level*.06)*k*rankControl(u.rank))}`);
  else if(['snow_rabbit','time_ruler','phantom','galaxy_whale'].includes(u.hero)){const base=u.hero==='time_ruler'?.25+level*.03:u.hero==='phantom'?.25:u.hero==='snow_rabbit'?SNOW_RABBIT.slow+level*SNOW_RABBIT.trainingSlow:.4;out.push(`감속 ${pctText(Math.min(.8,base*rankControl(u.rank)*k))}`);}
  else if(u.hero==='storm_sage')out.push(`일반 적 명중마다 즉사 ${pctText(stormExecuteChance(s,u.rank))}`);
  else if(u.hero==='queen'||u.hero==='doom')out.push(unitEconomy(s,u));
  else if(u.hero==='luna')out.push(`처형 기준 체력 ${pctText(executeThreshold(null,s))}`);
  else if(u.hero==='behemoth')out.push('오라 2배');
  return out;
}
export function unitEconomy(s,u){
  const level=s.upgrades[u.hero]||0;
  if(u.hero==='doom')return `합성 시 ${doomRefund(u.rank)}G 즉시 환급`;
  if(u.hero==='queen')return `이번 웨이브 종료 시 ${queenIncome(u.rank,s.wave,level)}G 배당 · 모든 여왕 합계 최대 ${QUEEN_CAP}G`;
  return unitHero(s,u).trait.text;
}
// The Stardew Spring raises a run's starlight ceiling; older saves keep 120.
export const gaugeCap=s=>s.gaugeMax||GAUGE_MAX;
function addGauge(s,value){s.gauge=clamp(s.gauge+value,0,gaugeCap(s));}
function giveGold(s,value,source){s.gold+=value;s.stats.income[source]=(s.stats.income[source]||0)+value;}
const statusTypes=['poison','burn','exposure','stun','freeze','divine'];
const sourceKey=(kind,hero,uid)=>`${kind}:${hero}:${uid}`;
function legacyStatuses(s,e){
  const effects=[];
  const legacy=(type,amount,duration,owner=null,power)=>{
    if(amount>0&&duration>0)effects.push({type,source:`legacy:${type}`,owner,amount,until:s.time+duration,...(power===undefined?{}:{power})});
  };
  legacy('exposure',Math.min(DAMAGE_TAKEN_CAP,e.exposed||0),e.exposeTime);
  legacy('burn',e.burn,e.burnTime,e.burnOwner||'flame_sage');
  // Old poison was a Mushroom-only effect. Preserve that remaining DPS once;
  // future applications use the actual caster's complete attack snapshot.
  legacy('poison',Math.min(POISON_CAP,e.poison||0),e.poisonTime,'mushroom_king',HERO.mushroom_king.damage*(s.meta?.mushroom_king?.power||1)*(1+(s.relicAttack||0)));
  legacy('stun',1,e.stun);legacy('freeze',1,e.freeze||0);
  legacy('divine',Math.min(DIVINE_CAP,e.divine||0),e.divineTime);
  return effects;
}
function syncStatuses(s,e,at=s.time){
  if(e.statusEffects===undefined)e.statusEffects=legacyStatuses(s,e);
  e.statusEffects=e.statusEffects.filter(effect=>effect.until-at>1e-9);
  e.exposed=0;e.exposeTime=0;e.burn=0;e.burnTime=0;e.burnOwner=null;e.burnCrit=undefined;
  e.poison=0;e.poisonTime=0;e.divine=0;e.divineTime=0;e.frostStacks=0;e.frostTime=0;e.stun=0;e.freeze=0;
  for(const effect of e.statusEffects){
    const remaining=effect.until-at;
    if(effect.type==='exposure'){
      if(effect.amount>e.exposed){e.exposed=effect.amount;e.exposeTime=remaining;}
      else if(effect.amount===e.exposed)e.exposeTime=Math.max(e.exposeTime,remaining);
    }else if(effect.type==='burn'){
      if(effect.amount>e.burn||effect.amount===e.burn&&remaining>e.burnTime){e.burn=effect.amount;e.burnTime=remaining;e.burnOwner=effect.owner;e.burnCrit=effect.crit;}
    }else if(effect.type==='poison'){e.poison=Math.min(POISON_CAP,e.poison+effect.amount);e.poisonTime=Math.max(e.poisonTime,remaining);}
    else if(effect.type==='divine'){e.divine+=effect.amount;e.divineTime=Math.max(e.divineTime,remaining);}
    else e[effect.type]=Math.max(e[effect.type],remaining);
  }
  e.controlTime=Math.max(e.stun,e.freeze);
  // Exposure is the only damage-taken amplifier; divine marks feed starlight.
  e.takenBonus=Math.min(DAMAGE_TAKEN_CAP,e.exposed);
  return e;
}
function activePoison(e){
  let remaining=POISON_CAP;
  return e.statusEffects.filter(effect=>effect.type==='poison').sort((a,b)=>b.power-a.power||b.until-a.until||a.source.localeCompare(b.source)).flatMap(effect=>{
    const stacks=Math.min(remaining,effect.amount);remaining-=stacks;return stacks?[{effect,stacks}]:[];
  });
}
export function statusState(s,e){syncStatuses(s,e);syncSlows(s,e);return {exposure:e.exposed,divine:e.divine,damageTakenBonus:e.takenBonus,burn:e.burn,burnOwner:e.burnOwner,poison:e.poison,poisonDps:activePoison(e).reduce((dps,{effect,stacks})=>dps+stacks*effect.power*POISON_POWER_RATIO,0)*poisonAmp(s),stun:e.stun,freeze:e.freeze,controlTime:e.controlTime,slow:e.slow};}
function capStacks(e,type,cap){
  const effects=e.statusEffects.filter(effect=>effect.type===type).sort((a,b)=>b.until-a.until||a.source.localeCompare(b.source));
  let remaining=cap;
  for(const effect of effects){effect.amount=Math.min(remaining,effect.amount);remaining-=effect.amount;}
  e.statusEffects=e.statusEffects.filter(effect=>effect.amount>0);
}
function addStatus(s,e,type,source,owner,amount,duration,power,crit=castCrits.get(s)){
  if(e.hp<=0||amount<=0||duration<=0)return;
  if(e.boss&&BOSSES[e.boss]?.immune===type)return;
  syncStatuses(s,e);
  const existing=e.statusEffects.find(effect=>effect.type===type&&effect.source===source),until=s.time+duration;
  if(existing){existing.amount=['poison','divine'].includes(type)?existing.amount+amount:amount;if(type==='poison')existing.amount=Math.min(POISON_CAP,existing.amount);existing.until=until;if(power!==undefined)existing.power=power;if(crit!==undefined)existing.crit=crit;}
  else e.statusEffects.push({type,source,owner,amount:type==='poison'?Math.min(POISON_CAP,amount):amount,until,...(power===undefined?{}:{power}),...(crit===undefined?{}:{crit})});
  if(type==='divine')capStacks(e,type,DIVINE_CAP);
  syncStatuses(s,e);
}
function addPoison(s,e,source,owner,stacks,duration,attackPower,crit=castCrits.get(s)){addStatus(s,e,'poison',source,owner,stacks,duration,attackPower,crit);}
const poisonAmp=s=>has(s,'seed')?1+RV.seed.poison*relicScaleIn(s,'seed'):1;
// Bosses: control lasts half, then 2 s of immunity. An ULTIMATE's control ignores that immunity (a timed cast is never
// wasted by a basic attack's stun); a second ultimate control within 2 s after the last one ended lasts half again.
export const ULT_CONTROL_REPEAT=.5;
function addControl(s,e,type,source,owner,duration){
  if(e.boss&&!source.startsWith('interrupt:')){
    const ult=source.startsWith('skill:');
    if(!ult&&(e.ccImmune||0)-s.time>1e-9)return;
    duration*=BOSS_CONTROL_SCALE*(ult&&(e.ultControl||0)-s.time>1e-9?ULT_CONTROL_REPEAT:1);
    e.ccImmune=Math.max(e.ccImmune||0,s.time+duration+BOSS_CONTROL_IMMUNITY);if(ult)e.ultControl=s.time+duration+BOSS_CONTROL_IMMUNITY;
  }
  addStatus(s,e,type,source,owner,1,duration);
}
function pushBack(e,distance){e.progress=Math.max(0,e.progress-distance*(e.boss?BOSS_PUSH_SCALE:1));}
function makeUnit(s,hero,rank=1){return {uid:s.nextId++,hero,rank,...(hero==='miracle_larva'?{form:'miracle_larva'}:{}),cooldown:.25,windup:0,target:null,attacks:0,pose:0,born:s.time,birthWave:s.wave+(['reward','intermission'].includes(s.phase)?1:0),harvest:12,disabled:0,invincible:0,facing:'down',aim:Math.PI/2,idleFor:0,priority:targetingLocked(hero)?'random':HERO[hero].bossDamage||HERO[hero].bossPriority?'boss':'first'};}
function freeCell(s){const order=[17,12,16,18,11,13,7,6,8,21,23,2,10,14,20,24,1,3,5,9,15,19,0,4,22];return order.find(i=>!s.board[i])??-1;}
function place(s,id,rank=1,index=-1){const slot=Number.isInteger(index)&&index>=0&&index<25&&!s.board[index]?index:freeCell(s);if(slot<0)return -1;s.board[slot]=makeUnit(s,id,rank);syncTimeRuler(s);event(s,'summon',{index:slot,hero:id,rank});return slot;}

export function newRun({deck=DEFAULT_DECK,chapter=0,seed=Date.now(),artifacts=[],meta={},relicAttack=0,relicLevels={},mode='main',boon=0,gaugeMax=GAUGE_MAX,startGold=0,tier='easy',met=BOSS_ORDER.length,crit={chance:.05,damage:1.5},oaths=[],side=null,lineup=null}={}){
  const chosen=validDeck(deck)?[...deck]:DEFAULT_DECK.slice(0,TEAM_SIZE),arts=validArtifacts(artifacts)?[...artifacts]:[];
  const levels=Object.fromEntries(arts.filter(id=>Number.isInteger(relicLevels?.[id])&&relicLevels[id]>=1&&relicLevels[id]<=999).map(id=>[id,relicLevels[id]]));
  const s={version:VERSION,balanceRevision:BALANCE_REVISION,statusRevision:STATUS_REVISION,seed:seed>>>0,rng:(seed>>>0)||1,deck:chosen,chapter:clamp(chapter|0,0,CHAPTERS.length-1),phase:'combat',wave:1,time:0,waveTime:0,
    board:Array(25).fill(null),enemies:[],shots:[],finishers:[],volleys:[],zones:[],events:[],critRevision:2,crit:cleanCrit(crit),critRng:critSeed(seed),bombs:[],sunlight:0,jokerColor:'red',jokerSeen:1,gold:70+Math.max(0,startGold|0),gauge:90,gaugeMax:Math.max(GAUGE_MAX,gaugeMax|0),health:20,summons:0,paidSummons:0,freeSummons:3,nextId:1,bag:[],artifacts:arts,upgrades:Object.fromEntries(chosen.map(x=>[x,0])),meta,relicAttack,relicLevels:levels,mode,boon,tier:TIERS[tier]?tier:'easy',met:Math.max(1,Math.min(BOSS_ORDER.length,met|0)),
    buffs:{},buffTotals:{},buffScale:{},goldCharge:null,queue:[],spawnIn:0,breakTime:0,reward:null,endless:false,telegraph:null,settlement:null,trainingDiscount:0,globalAttack:0,surgeWave:0,phoenixUsed:false,reserves:[],blessings:[],waveTotal:0,timeRulerUid:null,edictWave:0,phoenixUses:0,sandStore:0,amuletUsed:0,
    stats:{kills:0,merges:0,summons:0,skills:0,damage:0,income:{},byHero:{},leaks:0},tutorial:0,won:false};
  s.oaths=Array.isArray(oaths)?[...oaths]:[];s.oathMods=oathMods(s.oaths);s.side=side??null;s.lineup=Array.isArray(lineup)?[...lineup]:null;
  const opening=shuffle(s,chosen).slice(0,3);
  const openingCells=TEAM_SIZE===1?[12]:[7,16,18];
  for(const [i,hero] of opening.entries())place(s,hero,1,openingCells[i]);
  beginWave(s,1);if(s.oathMods.gold)s.gold=Math.round(s.gold*s.oathMods.gold);s.health=coreHealthMax(s);return s;
}
// The opening is three distinct random companions from the selected five.
// Later summons sample with replacement: every companion remains 1/5.
// The legacy bag is retained only for save compatibility and is never consumed.
export function drawHero(s){return s.deck[Math.floor(random(s)*s.deck.length)];}
export function summon(s,preferred=-1){
  if(!['combat','intermission'].includes(s.phase))return {ok:false,reason:'전투 중에 소환할 수 있습니다.'};
  if(freeCell(s)<0)return {ok:false,reason:'전장이 가득 찼습니다. 합성하거나 영웅을 회수하세요.'};
  const cost=summonCost(s);if(s.gold<cost)return {ok:false,reason:`골드가 부족합니다. (${cost} 필요)`};
  const paid=s.freeSummons===0;
  s.gold-=cost;if(!paid)s.freeSummons--;else s.paidSummons++;s.summons++;s.stats.summons++;
  const ribbon=has(s,'gift_ribbon')&&random(s)<Math.min(1,RV.gift_ribbon.chance*relicScaleIn(s,'gift_ribbon'));
  const rank=ribbon?2:1,id=drawHero(s),index=place(s,id,rank,preferred);
  if(ribbon&&index>=0)event(s,'ribbon',{index,...cellPoint(index)});
  s.tutorial=Math.max(s.tutorial,1);return {ok:true,index,hero:id,rank};
}
export function canMerge(a,b,s=null){return !!a&&!!b&&a.uid!==b.uid&&a.rank===b.rank&&a.rank<MAX_RANK&&(a.hero===b.hero||a.hero==='rumi'||b.hero==='rumi')&&(!s||!charging(s,a)&&!charging(s,b));}
export function move(s,from,to){
  if(!['combat','intermission'].includes(s.phase)||from===to||!s.board[from]||to<0||to>24)return {ok:false};
  refreshAppleBombs(s);
  const a=s.board[from],b=s.board[to];
  if(charging(s,a)||charging(s,b))return {ok:false,reason:'별빛을 모으는 동료는 옮기거나 합성할 수 없습니다.'};
  if(canMerge(a,b)){
    const id=b.hero==='rumi'?a.hero:b.hero,rank=b.rank+1;
    const refund=HERO[id].trait.type==='sacrifice'?doomRefund(a.rank):0;
    if(refund)giveGold(s,refund,'합성 환급');
    const unit=makeUnit(s,id,rank);if(id==='miracle_larva')unit.form='miracle_cocoon';unit.priority=targetingLocked(id)?'random':(b.hero==='rumi'?a:b).priority;unit.cooldown=.06;unit.mergedWave=s.wave+(['reward','intermission'].includes(s.phase)?1:0);s.board[to]=unit;s.board[from]=null;syncTimeRuler(s);
    if(a.hero==='mushroom_king'||b.hero==='mushroom_king')for(const e of s.enemies)addPoison(s,e,sourceKey('merge',id,unit.uid),id,2,8,power(s,unit));
    s.stats.merges++;if(!s.oathMods?.noMergeStar){const gain=MERGE_STARLIGHT+(has(s,'hourglass')?RV.hourglass.starlight*relicScaleIn(s,'hourglass'):0);if(has(s,'hourglass'))s.sandStore=Math.min(RV.hourglass.store,(s.sandStore||0)+Math.max(0,s.gauge+gain-gaugeCap(s)));addGauge(s,gain);}s.tutorial=Math.max(s.tutorial,2);
    event(s,'merge',{from,to,hero:id,rank,refund});return {ok:true,merged:true,index:to,refund};
  }
  s.board[to]=a;s.board[from]=b;syncTimeRuler(s);event(s,'move',{from,to});return {ok:true,index:to};
}
export function sell(s,index){
  const u=s.board[index];if(!u||!['combat','intermission'].includes(s.phase))return {ok:false};
  if(charging(s,u))return {ok:false,reason:'별빛을 모으는 동안에는 회수할 수 없습니다.'};
  if(s.board.filter(Boolean).length<=1)return {ok:false,reason:'마지막 영웅은 회수할 수 없습니다.'};
  refreshAppleBombs(s);
  const gold=Math.round(6*Math.pow(1.7,u.rank-1));s.board[index]=null;syncTimeRuler(s);giveGold(s,gold,'회수');event(s,'sell',{index,gold});return {ok:true,gold};
}
// Training per companion: 5, or the starlight oath's cap.
export const trainCap=s=>s?.oathMods?.trainCap??5;
export function upgrade(s,id){
  if(!s.deck.includes(id)||!['combat','intermission'].includes(s.phase))return {ok:false};
  if(s.upgrades[id]>=trainCap(s)&&trainCap(s)<5)return {ok:false,reason:trainCap(s)?`별빛 서약: 동료마다 훈련은 ${trainCap(s)}회까지입니다.`:'별빛 서약: 이번 원정에서는 훈련할 수 없습니다.'};
  if(s.upgrades[id]>=5)return {ok:false,reason:'훈련을 모두 마쳤습니다.'};
  const cost=upgradeCost(s,id);if(s.gold<cost)return {ok:false,reason:`골드가 부족합니다. (${cost} 필요)`};
  s.gold-=cost;s.upgrades[id]++;event(s,'upgrade',{hero:id,level:s.upgrades[id]});return {ok:true};
}
export function cycleTarget(s,index){const u=s.board[index];if(!u||targetingLocked(u.hero))return;const values=['first','boss','strong','last'];u.priority=values[(values.indexOf(u.priority)+1)%values.length];}

// Armour carries 1.4× health instead of a hidden 28% damage reduction.
const enemyWeight={grunt:1,armor:3.5,runner:.65,wisp:.9,boss:32};
const enemyKind=(i,wave)=>i%7===6&&wave>=3?'armor':i%5===4&&wave>=2?'runner':i%9===8&&wave>=5?'wisp':'grunt';
// Challenge curve: wave w of 18 maps onto the main twelve-wave curve (old waves 2..12) at a stage that
// climbs through the tier band, plus extra health as the board grows.
// Bend below 1 pulls that climb forward. The old linear stage and quadratic late term (k²)
// left waves 1–15 easy and killed almost every run on wave 17. `lateAt` (default: the bend)
// can park that add-on on the last waves. `weeklyLate` in wavePlan raises a whole weekly wave the same way.
// See docs/archive/2026-10-28-CHALLENGE_RETUNE.md.
const CHALLENGE_BEND=.33;
export function challengeBase(wave,tier='easy'){
  const t=TIERS[tier]||TIERS.easy,k=(Math.min(wave,CHALLENGE_WAVES)-1)/(CHALLENGE_WAVES-1),over=Math.max(0,wave-CHALLENGE_WAVES);
  const bend=Math.pow(k,CHALLENGE_BEND);
  // `lateAt` (default: the same bend) is when the late add-on arrives.
  // A higher power leaves the middle waves alone and raises only the clear.
  const lateK=Math.pow(k,t.lateAt??CHALLENGE_BEND);
  const stage=t.from+(t.to-t.from)*bend,oldWave=2+10*bend;
  return {base:WAVE_BASE_HEALTH*Math.pow(1.34,oldWave-1)*(1+2.5*(stage-1)/8)*(1+t.late*lateK)*Math.pow(1.25,over),oldWave};
}
export function wavePlan(wave,chapter=0,mode='main',tier='easy'){
  if(mode==='monthly'){
    // Monthly: one boss per round. A boss alone carries about a whole wave of the same point on the curve.
    const {base}=challengeBase(wave,tier),hp=Math.round(base*30*(TIERS[tier]||TIERS.easy).monthly);
    return {sequence:[{kind:'boss',hp}],interval:.65,healthBudget:hp};
  }
  if(mode==='twin')return wavePlan(wave,(TWIN_STAGE[tier]||TWIN_STAGE.easy)-1,'main');
  if(mode==='oath'){
    const cw=1+(wave-1)*11/8;
    const {base,oldWave}=challengeBase(cw,tier),oldCount=12+Math.round(oldWave)*2,count=Math.round(oldCount*Math.min(.9,.64+(oldWave/2-1)*.025));
    const sequence=Array.from({length:count},(_,i)=>{const kind=enemyKind(i,Math.ceil(oldWave/2));return {kind,hp:Math.round(base*enemyWeight[kind])};});
    const t=TIERS[tier]||TIERS.easy;
    if(wave%3===0)sequence.splice(Math.min(6,count),0,{kind:'boss',hp:Math.round(base*32*BOSS_HEALTH_SCALE*t.boss)});
    return {sequence,interval:Math.max(.46,1.05-(oldWave-1)*.06),healthBudget:sequence.reduce((n,e)=>n+e.hp,0)};
  }
  if(mode==='weekly'){
    const {base,oldWave}=challengeBase(wave,tier),oldCount=12+Math.round(oldWave)*2,count=Math.round(oldCount*Math.min(.9,.64+(oldWave/2-1)*.025));
    const sequence=Array.from({length:count},(_,i)=>{const kind=enemyKind(i,Math.ceil(oldWave/2));return {kind,hp:Math.round(base*enemyWeight[kind])};});
    const t=TIERS[tier]||TIERS.easy;
    if(wave%3===0)sequence.splice(Math.min(6,count),0,{kind:'boss',hp:Math.round(base*32*BOSS_HEALTH_SCALE*t.boss)});
    // weeklyLate (power 6) raises the whole weekly wave near the end only.
    // It does not change the monthly boss. Early weekly waves stay on the bend.
    const k=(Math.min(wave,CHALLENGE_WAVES)-1)/(CHALLENGE_WAVES-1),grow=1+(t.weeklyLate||0)*Math.pow(k,6);
    if(grow!==1)for(const e of sequence)e.hp=Math.round(e.hp*grow);
    return {sequence,interval:Math.max(.46,1.05-(oldWave-1)*.06),healthBudget:sequence.reduce((n,e)=>n+e.hp,0)};
  }
  // Six waves sample the original twelve-wave curve at 2,4,...,12.
  // Stage nine has the canonical seventh chapter's final enemy statistics.
  const oldWave=wave*2,base=WAVE_BASE_HEALTH*Math.pow(1.34,oldWave-1)*CHAPTERS[chapter].hp,oldCount=12+oldWave*2;
  const budget=Array.from({length:oldCount},(_,i)=>Math.round(base*enemyWeight[enemyKind(i,wave)])).reduce((a,b)=>a+b,0);
  const count=Math.round(oldCount*Math.min(.9,.64+(wave-1)*.025));
  const kinds=Array.from({length:count},(_,i)=>enemyKind(i,wave)),weight=kinds.reduce((sum,k)=>sum+enemyWeight[k],0);let assigned=0;
  const sequence=kinds.map((kind,i)=>{const hp=i===count-1?budget-assigned:Math.round(budget*enemyWeight[kind]/weight);assigned+=hp;return {kind,hp};});
  const bossHp=Math.round(Math.round(base*32)*BOSS_HEALTH_SCALE);
  if(wave===3||wave===6)sequence.splice(Math.min(6,count),0,{kind:'boss',hp:bossHp});
  return {sequence,interval:Math.max(.46,1.05-(oldWave-1)*.06),healthBudget:budget+(wave===3||wave===6?bossHp:0)};
}
// Challenge lineups only use bosses the player has met (`met` = first N of BOSS_ORDER).
export const weeklyBoss=(chapter,wave,met=BOSS_ORDER.length)=>BOSS_ORDER[(chapter+Math.floor(wave/3)-1+BOSS_ORDER.length*9)%Math.max(1,Math.min(met,BOSS_ORDER.length))];
export const monthlyBoss=(wave,met=BOSS_ORDER.length)=>BOSS_ORDER[(wave-1)%Math.max(1,Math.min(met,BOSS_ORDER.length))];
export const lastWave=s=>s.mode==='oath'?OATH_WAVES:s.mode==='twin'?TWIN_WAVES:s.mode==='main'?MAIN_WAVES:CHALLENGE_WAVES;
function beginWave(s,wave){
  s.phase='combat';s.wave=wave;s.waveTime=0;s.spawnIn=wave===1?.65:.4;s.settlement=null;s.telegraph=null;s.zones=[];
  s.queue=wavePlan(wave,s.chapter,s.mode,s.tier).sequence;s.waveTotal=s.queue.length;
  if(s.queue.some(e=>e.kind==='boss'))event(s,'bossApproach',{wave});event(s,'wave',{wave});
}
function spawnEnemy(s,{kind,hp}){
  const wave=s.wave,chapter=CHAPTERS[s.chapter];
  const isBoss=kind==='boss',bossId=isBoss?(s.mode==='monthly'?monthlyBoss(wave,s.met):s.mode==='weekly'?weeklyBoss(s.chapter,wave,s.met):(s.mode==='oath'||s.mode==='twin')&&s.lineup?.[Math.floor(wave/3)-1]||chapter.bosses[0]):null;
  hp=Math.round(hp*(s.oathMods?.hp||1)*(isBoss?s.oathMods?.bossHp||1:1));
  const e={uid:s.nextId++,kind,boss:bossId,hp,maxHp:hp,progress:0,speed:isBoss?34:kind==='runner'?82:kind==='armor'?39:kind==='wisp'?67:49,
    slow:0,slowTime:0,slowEffects:[],statusEffects:[],stun:0,freeze:0,controlTime:0,burn:0,burnTime:0,burnOwner:null,poison:0,poisonTime:0,exposed:0,exposeTime:0,takenBonus:0,hit:0,skillIn:7.5,channel:0,channelHp:0,dotFlash:0,divine:0,divineTime:0,frostStacks:0,frostTime:0,rage:0,shield:0,ccImmune:0,frostLock:0,dawn:0,ultControl:0};
  e.speed*=1.1;if(s.oathMods?.speed)e.speed*=s.oathMods.speed;s.enemies.push(e);if(isBoss){event(s,'boss',{id:bossId,name:BOSSES[bossId].name});if(has(s,'royal_seal'))addGauge(s,RV.royal_seal.starlight*relicScaleIn(s,'royal_seal'));}return e;
}
export function attackGeometry(hero,from,to){return {kind:hero.shape,from,to,range:hero.range,radius:hero.radius,angle:Math.atan2(to.y-from.y,to.x-from.x)};}
export function geometryContains(g,p){
  const dx=p.x-g.from.x,dy=p.y-g.from.y,d=Math.hypot(dx,dy),forward=dx*Math.cos(g.angle)+dy*Math.sin(g.angle),side=-dx*Math.sin(g.angle)+dy*Math.cos(g.angle);
  if(g.kind==='cross')return d<=g.range&&Math.min(Math.abs(dx),Math.abs(dy))<=g.radius/2;
  if(g.kind==='beam')return forward>=0&&forward<=g.range&&Math.abs(side)<=g.radius/2;
  // Cleave: a 90-degree arc band, radius deep, centred on the target's distance (Zeke's attack until pass 18; unused now).
  if(g.kind==='cleave')return d<=g.range&&forward>=0&&Math.abs(side)<=forward&&Math.abs(d-Math.hypot(g.to.x-g.from.x,g.to.y-g.from.y))<=g.radius/2;
  if(g.kind==='pulse')return d<=g.range;
  return Math.hypot(p.x-g.to.x,p.y-g.to.y)<=g.radius;
}
function canTarget(hero,at,p){return Math.hypot(p.x-at.x,p.y-at.y)<=hero.range&&(hero.shape!=='cross'||geometryContains(attackGeometry(hero,at,p),p));}
function chooseTarget(s,u,randomTarget=true){
  const at=cellPoint(s.board.indexOf(u));
  if(u.hero==='flame_sage')return s.enemies.find(e=>e.hp>0)||null;
  const enemies=s.enemies.filter(e=>e.hp>0&&canTarget(unitHero(s,u),at,pathPoint(e.progress)));if(!enemies.length)return null;
  if(u.hero==='avalanche_maid')return enemies[randomTarget?Math.floor(random(s)*enemies.length):0];
  const bosses=u.priority==='boss'?enemies.filter(e=>e.boss):[],pool=bosses.length?bosses:enemies;
  const priority=u.priority==='boss'?(u.hero==='great_detective'?'strong':'first'):u.priority;
  return pool.reduce((a,b)=>priority==='strong'?(a.hp>b.hp?a:b):priority==='last'?(a.progress<b.progress?a:b):(a.progress>b.progress?a:b));
}
const echoMaps=new WeakMap(),emberFresh=new WeakMap();
function beginEmberFrame(s){emberFresh.set(s,new Set());}
function freshSpreads(s){let set=emberFresh.get(s);if(!set)emberFresh.set(s,set=new Set());return set;}
function spreadBurn(s,dead){
  const owner=dead.burnOwner,amount=dead.burn;
  if(!(amount>0)||!HERO[owner]||!s.deck.includes(owner))return;
  const source=`spread:${owner}:${dead.uid}`;
  for(const t of around(s,dead,90)){syncStatuses(s,t);const had=t.burn>0;addStatus(s,t,'burn',source,owner,amount,3);if(!had)freshSpreads(s).add(t.uid);}
}
function noteEcho(s,e,actual,dot,instant){
  if(!echoMaps.has(s)||dot||instant||!(actual>0))return;
  const map=echoMaps.get(s);map.set(e.uid,(map.get(e.uid)||0)+actual);
}
function damage(s,e,value,hero,{dot=false,recordMirror=true,instant=false,statusAt=s.time,gift=false,basic=false,dotType=null,flat=false,crit=undefined}={}){
  if(!e||e.hp<=0)return 0;
  syncStatuses(s,e,statusAt);syncSlows(s,e,statusAt);
  const passive=e.boss?BOSSES[e.boss]:null;
  let amount=instant?e.hp+(e.shield||0):flat?value:value*(1+e.takenBonus*(passive?.exposeScale||1))*(passive?.dotScale?.[dotType]||1)*(basic?passive?.basicScale||1:1)*(e.boss?(HERO[hero]?.bossDamage||1):1)*(e.boss&&has(s,'lens')?1+RV.lens.boss*relicScaleIn(s,'lens'):1)*(e.boss&&has(s,'royal_seal')?1+RV.royal_seal.boss*relicScaleIn(s,'royal_seal'):1)*(e.slowTime>0&&has(s,'frost')?1+RV.frost.slowed*relicScaleIn(s,'frost'):1)*(has(s,'amulet')&&e.progress>=PATH_LENGTH*2/3?1+RV.amulet.near*relicScaleIn(s,'amulet'):1)*(has(s,'chalice')&&e.burn>0&&e.poison>=RV.chalice.poison?1+RV.chalice.taken*relicScaleIn(s,'chalice'):1)*(1+(e.dawn||0));
  if(!instant&&!flat){
    if(e.rage>0&&!dot)amount*=.75;
    if((dotType==='burn'||dotType==='poison')&&s.buffs.venom>0)amount*=1+VENOM_PLAGUE.amp;
  }
  // Every damaging hit, ticks included, can be critical; instant kills and flat amounts cannot.
  let critical=false;
  const criticalStats=crit===undefined?(castCrits.get(s)||s.crit):crit;
  if(criticalStats&&!instant&&!flat&&critRoll(s,criticalStats.chance)){amount*=criticalStats.damage;critical=true;}
  const absorbed=Math.min(e.shield||0,amount);e.shield=Math.max(0,(e.shield||0)-absorbed);
  const actual=Math.min(e.hp,amount-absorbed)+absorbed;e.hp-=amount-absorbed;e.hit=.13;s.stats.damage+=actual;s.stats.byHero[hero]=(s.stats.byHero[hero]||0)+actual;
  // No mirror detonation can feed another recording, even when several marks
  // resolve in this frame. Ordinary resolved damage includes shield absorption.
  if(recordMirror)for(const f of s.finishers||[])if(f.kind==='mirror'&&f.target===e.uid&&f.life>0)f.stored=f.cap!==undefined?Math.min(f.cap/.45,f.stored+actual):f.stored+actual;
  if(!dot&&!instant)event(s,'hit',{uid:e.uid,...pathPoint(e.progress),damage:Math.round(amount),hero,big:amount>100||!!e.boss,...(critical?{crit:true}:{})});
  if(e.hp<=0){
    s.stats.kills++;const gold=e.boss?BOSS_GOLD:e.kind==='armor'?3:2;giveGold(s,gold,'격파');
    if(gift)giveGold(s,1,'선물');
    addGauge(s,(e.boss?15:1.3)+e.divine*(e.boss?DIVINE_BOSS_GAUGE:DIVINE_GAUGE));
    // A frozen enemy that falls spreads the witch's cold; Winter Court freezes nearby foes.
    if(e.freeze>0&&s.board.some(u=>u?.hero==='frost_witch'))for(const t of around(s,e,90))addSlow(s,t,sourceKey('attack','frost_witch',e.uid),.4,2);
    if(s.buffs.winter>0)for(const t of around(s,e,120))if(!t.boss)addControl(s,t,'freeze',sourceKey('skill','frost_witch',e.uid),'frost_witch',WINTER_COURT.killFreeze);
    if(has(s,'ember')&&e.burn>0&&!freshSpreads(s).has(e.uid))spreadBurn(s,e);
    event(s,'kill',{...pathPoint(e.progress),kind:e.kind,boss:e.boss,color:HERO[hero]?.color,divine:e.divine});
  }
  noteEcho(s,e,actual,dot,instant);
  return actual;
}
function normalHit(s,e,value,shot,options={},seen){
  if(shot.hero==='storm_sage'&&shot.proc!==false&&e.hp>0&&!e.boss&&e.kind!=='boss'&&!seen.has(e.uid)){
    seen.add(e.uid);
    if(!deathWarded(s,e)&&random(s)<stormExecuteChance(s,shot.rank)){
      const shieldDamage=e.shield||0,actual=damage(s,e,0,shot.hero,{instant:true});
      event(s,'instantKill',{uid:e.uid,hero:shot.hero,...pathPoint(e.progress),damage:actual,shieldDamage});return actual;
    }
  }
  return damage(s,e,value,shot.hero,{...options,basic:true,crit:shot.crit});
}
function deathWarded(s,e){const p=pathPoint(e.progress);return s.enemies.some(x=>x!==e&&x.hp>0&&BOSSES[x.boss]?.deathWard&&Math.hypot(pathPoint(x.progress).x-p.x,pathPoint(x.progress).y-p.y)<=BOSSES[x.boss].deathWard);}
function around(s,e,radius){const p=pathPoint(e.progress);return s.enemies.filter(x=>x.hp>0&&Math.hypot(pathPoint(x.progress).x-p.x,pathPoint(x.progress).y-p.y)<=radius);}
function makeZone(s,shot,p,orbit=false){
  const h=HERO[shot.hero],flame=shot.hero==='flame_sage'&&!orbit,boost=flame?1.3:1;
  const life=orbit?2:3*boost*(has(s,'roots')?1+RV.roots.life*relicScaleIn(s,'roots'):1),radius=orbit?60:h.radius*boost*(has(s,'roots')?1+RV.roots.radius*relicScaleIn(s,'roots'):1),zoneDamage=shot.damage*boost*(shot.hero==='phantom'?.75:1);
  s.zones.push({uid:s.nextId++,source:shot.source,hero:shot.hero,rank:shot.rank,damage:zoneDamage,crit:shot.crit,x:p.x,y:p.y,radius,life,total:life,tick:0,orbit});
  if(s.zones.length>ZONE_CAP)s.zones.shift();
}
function syncSlows(s,e,at=s.time){
  e.slowEffects=(e.slowEffects||[]).filter(effect=>effect.until-at>1e-9);
  e.slow=0;e.slowTime=0;
  for(const effect of e.slowEffects){
    if(effect.amount>e.slow){e.slow=effect.amount;e.slowTime=effect.until-at;}
    else if(effect.amount===e.slow)e.slowTime=Math.max(e.slowTime,effect.until-at);
  }
}
function addSlow(s,e,source,amount,duration){
  // Cap is 80% for every enemy, including bosses. Control immunity does not block slows.
  const owner=source.split(':')[1];amount=Math.min(.8,amount*special(s,owner));
  // Refresh only this source. A weaker hit never borrows another effect's
  // strength or changes its deadline; equal-strength skills also expire alone.
  syncSlows(s,e);
  const effect=e.slowEffects.find(effect=>effect.source===source),until=s.time+duration;
  if(effect){effect.amount=amount;effect.until=until;}
  else e.slowEffects.push({source,owner,amount,until});
  syncSlows(s,e);
}
function slowTargets(s,targets,hero,amount,point,source,rank=1){
  const level=s.upgrades[hero.id]||0,base=hero.trait.type==='chrono'?.25+level*.03:hero.id==='phantom'?.25:hero.id==='snow_rabbit'?SNOW_RABBIT.slow+level*SNOW_RABBIT.trainingSlow:.4,slow=base*rankControl(rank);
  for(const t of targets)addSlow(s,t,source,slow,2.4);
  if(targets.length&&has(s,'tide')){for(const t of s.enemies)if(t.hp>0&&Math.hypot(pathPoint(t.progress).x-point.x,pathPoint(t.progress).y-point.y)<=80)damage(s,t,amount*RV.tide.splash*relicScaleIn(s,'tide'),hero.id);event(s,'tide',{...point});}
}
function applyHit(s,shot){
  if(shot.ground){
    const point=shot.to,hero=HERO[shot.hero];makeZone(s,shot,point);
    if(has(s,'orbit')&&shot.rank>=3)makeZone(s,shot,point,true);
    if(has(s,'meteor')&&shot.proc!==false&&shot.count%12===0){for(const target of s.enemies)if(target.hp>0&&Math.hypot(pathPoint(target.progress).x-point.x,pathPoint(target.progress).y-point.y)<=100)damage(s,target,shot.damage*RV.meteor.hit*relicScaleIn(s,'meteor'),shot.hero,{crit:shot.crit});event(s,'meteor',{...point,color:'#f6c888'});}
    event(s,'impact',{...point,hero:shot.hero,form:shot.form,angle:Math.atan2(point.y-shot.origin.y,point.x-shot.origin.x),rank:shot.rank,shape:hero.shape,origin:shot.origin,ground:true});return;
  }
  const e=s.enemies.find(x=>x.uid===shot.target&&x.hp>0);if(!e)return;
  if(shot.reflected){const p=pathPoint(e.progress);damage(s,e,shot.damage,shot.hero,{basic:true,crit:shot.crit});if(e.hp>0)addStatus(s,e,'divine',sourceKey('attack',shot.hero,shot.uid),shot.hero,1,6);event(s,'impact',{...p,hero:shot.hero,rank:shot.rank,angle:Math.atan2(p.y-shot.from.y,p.x-shot.from.x),reflected:true});return;}
  const hero=shotHero(shot),type=hero.trait.type,point=pathPoint(e.progress),amount=shot.damage,procTargets=new Set();
  const sunR=hero.id==='sunflower'?sunRadius(s):0;
  const geometry={...attackGeometry(hero,shot.origin,point),...(sunR?{kind:'splash',radius:sunR*(shot.gift?2:1)}:shot.gift?{radius:hero.radius*2}:{})};
  const area=sunR||['cleave','pulse','beam','cross','splash'].includes(hero.shape)?s.enemies.filter(t=>t.hp>0&&geometryContains(geometry,pathPoint(t.progress))):shot.bell?[e,...around(s,e,CINDERELLA.radius).filter(t=>t.uid!==e.uid)]:[e];
  const divineMark=type==='divine'||type==='battery'||s.buffs.march>0&&shot.proc!==false;
  for(const target of area){
    syncStatuses(s,target);syncSlows(s,target);
    let factor=1;
    if(type==='execute'&&target.hp/target.maxHp<=executeThreshold(target,s))factor*=2;
    if(type==='shatter'&&target.slowTime>0)factor*=1.75;
    if(type==='splash'&&target.burnTime>0)factor*=1.4;
    if(type==='miracle'&&shot.bell)factor*=target===e?CINDERELLA.bell:CINDERELLA.splash;
    if(type==='starfall'&&shot.count%5===0)factor*=2.2;
    if(shot.gift)factor*=2+(s.upgrades[hero.id]||0)*.2;
    if(type==='divine'&&target.divine>=3&&target.divineTime>0)factor*=1.65;
    if(type==='regal'&&(target.burnTime>0||target.divine>=3&&target.divineTime>0))factor*=1.6;
    normalHit(s,target,amount*factor,shot,{gift:!!shot.gift},procTargets);
    if(divineMark&&target.hp>0)addStatus(s,target,'divine',sourceKey('attack',hero.id,shot.uid),hero.id,1,6);
    // The witch freezes enemies that are already slowed; each foe re-locks after 3s.
    if(type==='permafrost'&&shot.proc!==false&&target.hp>0&&target.slowTime>0&&(target.frostLock||0)-s.time<=1e-9){
      addControl(s,target,'freeze',sourceKey('attack',hero.id,shot.uid),hero.id,(.6+(s.upgrades[hero.id]||0)*.06)*special(s,hero.id)*rankControl(shot.rank));
      target.frostLock=s.time+FROST_RELOCK;
      event(s,'frostBreak',{...pathPoint(target.progress),hero:hero.id,rank:shot.rank});
    }
  }
  if(type==='refraction'&&shot.proc!==false&&e.hp>0){
    const dx=point.x-shot.origin.x,dy=point.y-shot.origin.y,k=46/(Math.hypot(dx,dy)||1);
    const from={x:clamp(point.x+dx*k,24,696),y:clamp(point.y+dy*k,72,734)};
    s.shots.push({...shot,uid:s.nextId++,proc:false,reflected:true,damage:amount*(.75+(s.upgrades[hero.id]||0)*.03),origin:from,from,to:point,delay:.06,life:.24,total:.24});
  }
  event(s,'impact',{...point,hero:hero.id,form:shot.form,angle:geometry.angle,rank:shot.rank,shape:hero.shape,origin:shot.origin,...(shot.hero==='gold_dragon'?{opening:shot.opening}:{}),...(sunR?{sunR}:{})});
  if(shot.bell)event(s,'bell',{...point,rank:shot.rank,boss:!!e.boss,radius:CINDERELLA.radius});
  // Time Magician: every third pierce lets each neighbour fire one extra shot.
  if(type==='accelerate'&&shot.proc!==false&&shot.count%3===0){
    const index=s.board.findIndex(u=>u?.uid===shot.source),recipients=[];
    const scale=(.6+(s.upgrades[hero.id]||0)*.05)*rankSupport(shot.rank)*special(s,hero.id);
    if(index>=0)for(const n of neighbors(index)){const ally=s.board[n];if(ally&&!(ally.disabled>0)&&attack(s,ally,n,scale))recipients.push({...cellPoint(n),uid:ally.uid});}
    if(recipients.length)event(s,'supportPulse',{hero:hero.id,targets:recipients});
  }
  if(['chain','bounce'].includes(hero.shape)||type==='gust'){
    const ratio=shot.chainRatio??.65,extra=shot.extraChain||0;
    const others=around(s,e,type==='gust'?180:hero.radius).filter(x=>x.uid!==e.uid).sort((a,b)=>Math.abs(a.progress-e.progress)-Math.abs(b.progress-e.progress)).slice(0,(type==='chain'?2:1)+extra);
    const prismHit=has(s,'prism')?1+RV.prism.chain*relicScaleIn(s,'prism'):1;
    let from=point;for(const target of others){normalHit(s,target,amount*ratio*prismHit,shot,{},procTargets);const to=pathPoint(target.progress);event(s,'chain',{from,to,color:hero.color,hero:hero.id});from=to;}
  }
  if(type==='burn')for(const t of area)addStatus(s,t,'burn',sourceKey('attack',hero.id,shot.uid),hero.id,amount*BURN.attack,BURN.attackSeconds,undefined,shot.crit);
  if(type==='venom'&&shot.proc!==false){const src=sourceKey('attack',hero.id,shot.uid);for(const t of area){addPoison(s,t,src,hero.id,1,7,amount,shot.crit);addStatus(s,t,'burn',src,hero.id,amount*BURN.attack,BURN.attackSeconds,undefined,shot.crit);}}
  if(type==='joker'&&shot.proc!==false){
    const color=s.jokerColor||'red',src=sourceKey('attack',hero.id,shot.uid);
    for(const t of area){
      if(color==='red'||jokerChaos(s))addStatus(s,t,'burn',src,hero.id,amount*JOKER.burn,BURN.attackSeconds,undefined,shot.crit);
      if(color==='blue'||jokerChaos(s))addSlow(s,t,src,JOKER.slow,2.4);
      if(color==='green'||jokerChaos(s))addPoison(s,t,src,hero.id,1,7,amount,shot.crit);
      if(color==='white'||jokerChaos(s))addStatus(s,t,'divine',src,hero.id,1,6);
      if(color==='black'||jokerChaos(s))addStatus(s,t,'exposure',src,hero.id,JOKER.exposure,4);
    }
  }
  if(['slow','chrono','gravity','permafrost'].includes(type))slowTargets(s,area,hero,amount,point,sourceKey('attack',hero.id,shot.uid),shot.rank);
  if(type==='poison')addPoison(s,e,sourceKey('attack',hero.id,shot.uid),hero.id,1,7,amount,shot.crit);
  if(type==='abyss'&&shot.proc!==false){const source=sourceKey('attack',hero.id,shot.uid);for(const t of area){addSlow(s,t,source,.25*rankControl(shot.rank),2);addPoison(s,t,source,hero.id,1,8,amount,shot.crit);}}
  if(type==='stun'&&shot.count%3===0)for(const t of area)addControl(s,t,'stun',sourceKey('attack',hero.id,shot.uid),hero.id,(.7+(s.upgrades[hero.id]||0)*.05)*special(s,hero.id)*rankControl(shot.rank));
  if(type==='expose'){
    const exposure=((e.boss ? .15 : .08)+s.upgrades[hero.id]*.02)*special(s,hero.id)*rankControl(shot.rank);
    addStatus(s,e,'exposure',sourceKey('attack',hero.id,shot.uid),hero.id,Math.min(DAMAGE_TAKEN_CAP,exposure),4);
  }
  if(hero.shape==='zone')makeZone(s,shot,point);
  if(has(s,'orbit')&&shot.rank>=3)makeZone(s,shot,point,true);
  if(has(s,'meteor')&&shot.proc!==false&&shot.count%12===0){for(const t of around(s,e,100))damage(s,t,amount*RV.meteor.hit*relicScaleIn(s,'meteor'),hero.id,{crit:shot.crit});event(s,'meteor',{...pathPoint(e.progress),color:'#f6c888'});}
}
// Every shot a unit fires is a basic attack, including Rumi's echo and the Time Magician's extra shot
// (extra>0 is its power ratio): each advances the attack count (Guardian's stun, Santa's gift, Cinderella's
// clock, the meteor relic) and triggers on-hit traits. The exception is the Time Magician itself: an echo or
// extra shot of a magician neither advances its count nor procs, so magicians never feed each other's rhythm.
function attack(s,u,index,extra=0){
  if(charging(s,u))return false;
  const ground=u.hero==='flame_sage';
  if(ground&&!s.enemies.some(e=>e.hp>0))return false;
  const e=ground?null:u.hero==='avalanche_maid'?chooseTarget(s,u):s.enemies.find(x=>x.uid===u.target&&x.hp>0&&canTarget(unitHero(s,u),cellPoint(index),pathPoint(x.progress)))||chooseTarget(s,u);if(!ground&&!e)return false;
  const stats=combatStats(s,u,index),ratio=extra||1;
  const shot=fire(s,u,index,e,ground?pathPoint(random(s)*PATH_LENGTH):null,stats,ratio,extra>0,false);
  event(s,'attack',{index,hero:u.hero,rank:u.rank,from:shot.from,to:shot.to,origin:shot.origin,shape:unitHero(s,u).shape,form:shot.form,attackType:unitHero(s,u).attack,...(shot.gift?{gift:true}:{}),...(extra?{extra:true}:{}),...(u.hero==='gold_dragon'?{opening:goldOpening(s)}:{}),...(u.hero==='zeke'&&zekeFury(s)?{fury:true}:{})});
  if(s.buffs.echo>0)fire(s,u,index,ground?null:s.enemies.find(x=>x.uid===shot.target)||e,ground?shot.to:null,stats,ratio*.65*buffScale(s,'echo'),true,true);
  return true;
}
function fire(s,u,index,e,ground,stats,ratio,bonus,echo){
  const hero=unitHero(s,u),counts=!(bonus&&u.hero==='time_magician');
  const clockStep=counts&&u.hero==='cinderella'&&topCinderella(s)?.uid===u.uid?(s.buffs.midnight>0?3:1):0,bell=clockStep>0&&(u.clock||0)+clockStep>=12;
  if(bell)e=s.enemies.find(x=>x.boss&&x.hp>0)||e;
  const at=cellPoint(index),to=ground||pathPoint(e.progress),angle=Math.atan2(to.y-at.y,to.x-at.x);
  if(!echo){u.aim=angle;u.facing=attackDirection(at,to);}
  const from={x:at.x+Math.cos(angle)*9,y:at.y+5+Math.sin(angle)*6};
  if(counts)u.attacks++;
  if(!bonus)u.pose=.3;
  if(clockStep)u.clock=((u.clock||0)+clockStep)%12;
  const travel=(['cleave','pulse','cross'].includes(hero.shape)?.12:hero.shape==='beam'?.2:Math.hypot(to.x-from.x,to.y-from.y)/(hero.id==='great_detective'?1400:650))+(echo?.14:0);
  const gift=counts&&u.hero==='santa'&&u.attacks%4===0;
  const shot={uid:s.nextId++,source:u.uid,target:e?.uid??null,hero:u.hero,form:unitForm(s,u),proc:counts,damage:stats.damage*ratio,rank:u.rank,count:u.attacks,origin:at,from,to,life:travel,total:travel,...(ground?{ground:true}:{}),...(u.hero==='lightning_sage'?{chainRatio:stats.chainRatio,extraChain:stats.extraChain}:{}),...(gift?{gift:true}:{}),...(u.hero==='gold_dragon'?{opening:goldOpening(s)}:{}),...(bell?{bell:true}:{})};
  shot.crit=unitCrit(s,u,index);s.shots.push(shot);
  return shot;
}
// One source for outgoing attack power, cadence and the live inspection UI.
// Enemy armor/exposure and conditional hit bonuses are applied at impact.
export function combatStats(s,u,index=s.board.indexOf(u),detail=false){
  const h=unitHero(s,u),trait=personalTrait(s,u,index),adjacent=index<0?[]:neighbors(index).map(i=>s.board[i]).filter(Boolean),bonuses=[];
  // Buff families: placement auras, ultimate buffs and run/relic bonuses. Inside a family only the
  // strongest counts (relic bonuses add up); the families multiply. Speed follows the same rule.
  const power_={aura:0,ult:0,relic:0},speed_={aura:0,ult:0,other:trait.speedBonus};
  const damageBonus=(family,name,value)=>{if(family==='relic')power_.relic+=value;else power_[family]=Math.max(power_[family],value);if(detail)bonuses.push(`${name} +${Math.round(value*100)}% 공격력`);};
  const speedBonus=(family,name,value)=>{if(family==='other')speed_.other+=value;else speed_[family]=Math.max(speed_[family],value);if(detail)bonuses.push(`${name} +${Math.round(value*100)}% 공속`);};
  if(detail&&trait.label)bonuses.push(trait.label);
  if(detail&&s.globalAttack)bonuses.push(`원정 축복 +${Math.round(s.globalAttack*100)}% 공격력`);
  if(detail&&s.surgeWave===s.wave)bonuses.push('새벽검 +25% 공격력');
  const bestAdjacentRank=type=>adjacent.filter(a=>!a.cursed&&HERO[a.hero].trait.type===type).reduce((best,a)=>Math.max(best,a.rank),0);
  const dragonRank=bestAdjacentRank('powerAura'),sirenRank=bestAdjacentRank('hasteAura');
  if(dragonRank)damageBonus('aura','고대 용의 가호',(.2+(s.upgrades.ancient_dragon||0)*.03)*special(s,'ancient_dragon')*rankSupport(dragonRank));
  const harmonySources=index<0?[]:neighbors(index).filter(i=>s.board[i]?.hero==='harmonious'&&!s.board[i].cursed).map(i=>harmonyStrength(s,i));
  const harmony=harmonySources.reduce((best,value)=>value.damage>best.damage?value:best,{count:0,damage:0,speed:0});
  if(harmony.count){damageBonus('aura',`조화 ${harmony.count}종`,harmony.damage);speedBonus('aura',`조화 ${harmony.count}종`,harmony.speed);}
  const ensemble=harmonyField(s);if(ensemble.damage){damageBonus('ult','디저트 앙상블',ensemble.damage);speedBonus('ult','디저트 앙상블',ensemble.speed);}
  if(has(s,'guild')&&(harmony.count||adjacent.some(a=>['powerAura','hasteAura'].includes(HERO[a.hero].trait.type))))damageBonus('relic','연대',RV.guild.power*relicScaleIn(s,'guild'));
  {const kinds=new Set(adjacent.map(a=>a.hero)).size;if(has(s,'constellation')&&kinds>=3)damageBonus('relic','별자리',(kinds>=4?RV.constellation.four:RV.constellation.three)*relicScaleIn(s,'constellation'));}
  if(has(s,'banner')&&!adjacent.length&&index>=0)damageBonus('relic','고독한 깃발',RV.banner.power*relicScaleIn(s,'banner'));
  if(has(s,'crown')&&u.rank>=3)damageBonus('relic','왕관',RV.crown.power*relicScaleIn(s,'crown'));
  if(has(s,'sprout')&&u.rank<=2)damageBonus('relic','풋내기 훈장',RV.sprout.power*relicScaleIn(s,'sprout'));
  if(has(s,'alchemy')&&Number.isInteger(u.mergedWave)&&u.mergedWave<=s.wave&&s.wave<u.mergedWave+RV.alchemy.waves)damageBonus('relic','연금',RV.alchemy.power*relicScaleIn(s,'alchemy'));
  if(s.buffs.awaken>0)damageBonus('ult','각성',ULT_BUFF.awaken.power*buffScale(s,'awaken'));
  if(s.buffs.radiance>0)damageBonus('ult','여신강림',.5*buffScale(s,'radiance'));
  if(unitForm(s,u)==='trauma'){damageBonus('ult','트라우마',TRAUMA.power);speedBonus('ult','트라우마',TRAUMA.speed);}
  if(u.hero==='cinderella'&&s.buffs.midnight>0&&topCinderella(s)?.uid===u.uid)speedBonus('ult','자정의 기적',CINDERELLA.haste);
  if(sirenRank)speedBonus('aura','세이렌의 노래',(.15+(s.upgrades.siren||0)*.03)*special(s,'siren')*rankSupport(sirenRank));
  // Placement auras only (dragon, harmony, siren). Ultimate buffs and relics stay single.
  if(u.hero==='behemoth'&&!u.cursed&&!(u.disabled>0)){power_.aura*=2;speed_.aura*=2;if(detail)bonuses.push('오라 2배');}
  if(s.oathMods?.aura){power_.aura*=s.oathMods.aura;speed_.aura*=s.oathMods.aura;}
  if(s.buffs.haste>0)speedBonus('ult','가속',ULT_BUFF.haste.speed*buffScale(s,'haste'));
  if(s.buffs.march>0)speedBonus('ult','은빛 행진',ULT_BUFF.march.speed*buffScale(s,'march'));
  if(s.buffs.festive>0)speedBonus('ult','성야의 선물',.2*buffScale(s,'festive'));
  const tempo=has(s,'tempo_bell')?Math.min(RV.tempo_bell.cap,RV.tempo_bell.perWave*(s.wave-1)*relicScaleIn(s,'tempo_bell')):0;
  if(tempo)speedBonus('other','이어지는 종',tempo);
  if(has(s,'chorus')&&s.board.filter(a=>a?.hero===u.hero).length>=RV.chorus.count)speedBonus('other','합창',RV.chorus.speed*relicScaleIn(s,'chorus'));
  if(u.hero==='night_rabbit'){
    const kinds=new Set(s.board.filter(a=>a?.hero.endsWith('_rabbit')).map(a=>a.hero));kinds.delete(u.hero);
    if(kinds.size)speedBonus('other','토끼 연계',kinds.size*.2);
  }
  const multiplier=(1+power_.aura)*(1+power_.ult)*(1+power_.relic),speed=(1+speed_.other)*(1+speed_.aura)*(1+speed_.ult);
  const cooldown=h.interval*zoneCadence(u.hero)/speed;
  if(detail){const crit=unitCrit(s,u,index);if(crit)bonuses.push(`치명타 ${pctText(crit.chance)} · 피해 ${pctText(crit.damage)}`);}
  return {damage:power(s,u)*multiplier,interval:cooldown+ATTACK_WINDUP,cooldown,range:h.range,radius:h.radius*(trait.zoneRadiusMultiplier||1),chainRatio:trait.chainRatio,extraChain:trait.extraChain,bonuses};
}

export function demonDebuffTypes(s,e){
  const types=new Set(),live=effect=>effect&&effect.amount>0&&effect.until-s.time>1e-9;
  if(Array.isArray(e.statusEffects))for(const effect of e.statusEffects)if(live(effect)&&['exposure','stun','freeze','divine','poison','burn'].includes(effect.type))types.add(effect.type);
  if(!Array.isArray(e.statusEffects)){
    for(const [type,value,time] of [['exposure','exposed','exposeTime'],['stun','stun','stun'],['freeze','freeze','freeze'],['divine','divine','divineTime'],['poison','poison','poisonTime'],['burn','burn','burnTime']])if(e[value]>0&&e[time]>0)types.add(type);
  }
  if(Array.isArray(e.slowEffects)){if(e.slowEffects.some(live))types.add('slow');}
  else if(e.slow>0&&e.slowTime>0)types.add('slow');
  return [...types];
}
export const deathhandFactor=(s,e)=>DEATHHAND.base+DEATHHAND.perDebuff*demonDebuffTypes(s,e).length;
export function deathhandTargets(s){
  const alive=s.enemies.filter(e=>e.hp>0);let best=null,targets=[];
  for(const centre of alive){const p=pathPoint(centre.progress),near=alive.filter(e=>{const q=pathPoint(e.progress);return Math.hypot(p.x-q.x,p.y-q.y)<=DEATHHAND.radius;});if(near.length>targets.length||near.length===targets.length&&(!best||centre.progress>best.progress)){best=centre;targets=near;}}
  return {centre:best,targets};
}
function debuffCount(s,e){
  const live=list=>Array.isArray(list)?list.filter(effect=>effect&&effect.until-s.time>1e-9).length:0;
  if(!Array.isArray(e.statusEffects)&&!Array.isArray(e.slowEffects)){
    let n=0;
    if((e.exposed||0)>0&&(e.exposeTime||0)>0)n++;
    if((e.burn||0)>0&&(e.burnTime||0)>0)n++;
    if((e.poison||0)>0&&(e.poisonTime||0)>0)n++;
    if((e.stun||0)>0)n++;
    if((e.freeze||0)>0)n++;
    if((e.divine||0)>0&&(e.divineTime||0)>0)n++;
    if((e.slow||0)>0&&(e.slowTime||0)>0)n++;
    return n;
  }
  return live(e.statusEffects)+live(e.slowEffects);
}
function clearEnemyDebuffs(s,e){
  const n=(Array.isArray(e.statusEffects)?e.statusEffects.length:0)+(Array.isArray(e.slowEffects)?e.slowEffects.length:0);
  e.statusEffects=[];e.slowEffects=[];
  syncStatuses(s,e);syncSlows(s,e);
  return n;
}
// Lowest other ally by rank, then uid. Immunity is a consume-guard, not a skip.
function reductionTarget(s,u){
  let pick=null;
  for(let i=0;i<s.board.length;i++){const ally=s.board[i];if(!ally||ally.uid===u.uid)continue;if(!pick||ally.rank<pick.ally.rank||ally.rank===pick.ally.rank&&ally.uid<pick.ally.uid)pick={ally,i};}
  return pick;
}
// Update every waiting apple from the highest-rank Toffee Apple, including her
// current training, auras and buffs. Retain the last valid snapshot if none remain.
function refreshAppleBombs(s){
  if(!s.bombs?.length)return;
  const u=s.board.filter(a=>a?.hero==='toffee_apple').sort((a,b)=>b.rank-a.rank)[0];if(!u)return;
  const amount=combatStats(s,u).damage*APPLEBOMB.factor,crit=unitCrit(s,u);
  for(const bomb of s.bombs){bomb.damage=amount;if(crit)bomb.crit={...crit};else delete bomb.crit;}
}
export function cast(s,id){
  if(s.phase!=='combat'||!s.enemies.some(e=>e.hp>0))return {ok:false,reason:'적이 나타나면 사용할 수 있습니다.'};
  const u=bestUnit(s,id),hero=HERO[id];if(!u||!s.deck.includes(id))return {ok:false,reason:'전장에 이 영웅이 있어야 합니다.'};
  const lock=castLock(s,id);if(lock)return {ok:false,reason:lock.reason||(lock.kind==='dream'?'꿈의 형태가 아직 이어지고 있습니다.':`${hero.skill.name}이(가) 지속 중입니다. (${Math.ceil(lock.remaining)}초 남음)`)};
  if(hero.skill.type==='applebomb'&&(s.bombs||[]).length>=APPLEBOMB.max)return {ok:false,reason:'폭탄이 가득 찼습니다.'};
  const goldCost=skillGoldCost(id);if(s.gold<goldCost)return {ok:false,reason:`골드가 부족합니다. (${goldCost} 필요)`};
  const cost=skillCost(s,id),name=skillName(s,id);
  if(s.gauge<cost)return {ok:false,reason:`별빛이 부족합니다. (${cost} 필요)`};
  refreshAppleBombs(s);
  // Wish upon a Star spends the whole gauge; every other skill pays its cost.
  const spent=hero.skill.type==='starfall'?s.gauge:cost;
  s.gold-=goldCost;s.gauge-=spent;if(has(s,'lantern'))addGauge(s,spent*RV.lantern.refund*relicScaleIn(s,'lantern'));if(s.sandStore>0){addGauge(s,s.sandStore);s.sandStore=0;}s.stats.skills++;s.tutorial=Math.max(s.tutorial,3);
  const echoes=has(s,'twin')?new Map():null;if(echoes)echoMaps.set(s,echoes);beginEmberFrame(s);
  // An ultimate hits for the power shown on the unit right now: placement auras, running ultimate buffs and
  // relic power bonuses all count (taken before this cast changes any of them).
  const type=hero.skill.type,base=combatStats(s,u).damage,targets=s.enemies.filter(e=>e.hp>0),control=special(s,id),scale=rankControl(u.rank),dream=rumiDream(s,u);
  castCrits.set(s,unitCrit(s,u));const castStart=s.nextId;
  const source=sourceKey('skill',id,s.nextId++);
  for(const e of targets){syncStatuses(s,e);syncSlows(s,e);}
  let visualTargets=targets,gift,look;
  const before=new Map(targets.map(e=>[e.uid,pathPoint(e.progress)]));
  const strike=factor=>targets.forEach(e=>damage(s,e,base*factor,id));
  if(type==='ultimate_breath'){
    u.windup=0;u.target=null;u.pose=0;
    s.goldCharge={source:u.uid,wave:s.wave,started:s.time,ends:s.time+GOLD_DRAGON.charge};
    visualTargets=[];
  }
  else if(type==='miracle_eclose'){
    const points=[];for(const ally of pendingMiracles(s)){const index=s.board.indexOf(ally);ally.form=random(s)<.5?'miracle_wing':'abyss_wing';points.push({index,uid:ally.uid,form:ally.form,...cellPoint(index)});}
    visualTargets=[];event(s,'eclose',{points});
  }
  else if(type==='deathhand'){
    const cluster=deathhandTargets(s),receipts=cluster.targets.map(e=>({uid:e.uid,count:demonDebuffTypes(s,e).length,factor:deathhandFactor(s,e)}));
    visualTargets=cluster.targets;for(const [i,e] of cluster.targets.entries())damage(s,e,base*receipts[i].factor,id);
    if(cluster.centre)event(s,'deathhandBlast',{...pathPoint(cluster.centre.progress),radius:DEATHHAND.radius,targets:receipts});
  }
  else if(dream)s.volleys.push(...RUMI_DREAM.phases.map((p,phase)=>({uid:s.nextId++,source:u.uid,hero:id,kind:'dream',phase,rank:u.rank,damage:base*p.factor,life:p.at,total:p.at,...(phase===RUMI_DREAM.phases.length-1?{echo:{}}:{})})));
  else if(type==='echo')s.buffs.echo=skillDuration(s,ULT_BUFF.echo.seconds*control,'echo');
  else if(type==='haste')s.buffs.haste=skillDuration(s,ULT_BUFF.haste.seconds*control,'haste');
  else if(type==='awaken')s.buffs.awaken=skillDuration(s,ULT_BUFF.awaken.seconds*control,'awaken');
  else if(type==='march')s.buffs.march=skillDuration(s,ULT_BUFF.march.seconds*control,'march');
  else if(type==='glassfall'){strike(CINDERELLA.ult);s.buffs.midnight=skillDuration(s,10*control);u.clock=0;}
  else if(type==='gift'){const hero=drawHero(s);gift=place(s,hero,1);if(gift<0)s.reserves.push(hero);s.buffs.festive=skillDuration(s,ULT_BUFF.festive.seconds*control,'festive');}
  else if(type==='goddess'){strike(5);s.buffs.radiance=skillDuration(s,8*control,'radiance');for(const ally of s.board)if(ally){ally.disabled=0;ally.cursed=false;}}
  else if(type==='trauma'){strike(4);s.buffs.trauma=skillDuration(s,10*control,'trauma');}
  else if(type==='ice_court'){const winter=winterDuration(s,u);strike(9);for(const e of targets)if(e.hp>0){addSlow(s,e,source,WINTER_COURT.slow*scale,winter);addStatus(s,e,'exposure',source,id,WINTER_EXPOSURE,winter);}s.buffs.winter=winter;}
  else if(type==='harmony')s.buffs.harmony=skillDuration(s,ULT_BUFF.harmony.seconds*control,'harmony');
  else if(type==='royal'||type==='starfall'||type==='mirror'){
    const target=highestMaxHp(s),origin=cellPoint(s.board.indexOf(u)),total=type==='mirror'?5:FINISHER_DELAY;
    visualTargets=[target];
    s.finishers.push({uid:s.nextId++,source:u.uid,hero:id,kind:type,target:target.uid,origin,to:pathPoint(target.progress),damage:base*(type==='royal'?24:type==='mirror'?12:STARFALL_FACTOR*spent),rank:u.rank,life:total,total,...(type==='mirror'?{stored:0,ratio:mirrorRatio(s,u)}:{})});
    event(s,'targetLock',{hero:id,uid:target.uid,...pathPoint(target.progress)});
  }
  else if(type==='freeze'){strike(3);for(const e of targets){addControl(s,e,'freeze',source,id,SNOW_RABBIT.freeze*control*scale);addSlow(s,e,source,SNOW_RABBIT.skillSlow*scale,SNOW_RABBIT.seconds);}}
  else if(type==='avalanche'){for(const e of targets){damage(s,e,base*(e.controlTime>0?12:4),id);addSlow(s,e,source,.5,4);}}
  else if(type==='dragon'){
    // Dragon Breath lands on the densest pack (radius 180) instead of the whole field.
    const near=e=>targets.filter(t=>t.hp>0&&Math.hypot(pathPoint(t.progress).x-pathPoint(e.progress).x,pathPoint(t.progress).y-pathPoint(e.progress).y)<=180);
    const centre=targets.reduce((best,e)=>{const n=near(e).length;return !best||n>best.n||n===best.n&&e.progress>best.e.progress?{e,n}:best;},null)?.e;
    visualTargets=centre?near(centre):[];for(const e of visualTargets){damage(s,e,base*14,id);addStatus(s,e,'burn',source,id,base*BURN.skill,BURN.skillSeconds);}
  }
  else if(type==='inferno'){strike(7*(coreCrisis(s)?2:1));for(const e of targets)addStatus(s,e,'burn',source,id,base*BURN.skill,BURN.skillSeconds);}
  else if(type==='combust'){for(const e of targets){damage(s,e,base*(e.burnTime>0?10:4),id);addStatus(s,e,'burn',source,id,base*BURN.skill,BURN.skillSeconds);}}
  else if(type==='plague'){
    // Enemies already carrying 20+ poison take 30% of the remaining poison at once.
    for(const e of targets){const active=activePoison(e);if(active.reduce((n,a)=>n+a.stacks,0)>=20)damage(s,e,.3*active.reduce((n,{effect,stacks})=>n+stacks*effect.power*POISON_POWER_RATIO*Math.max(0,effect.until-s.time),0)*poisonAmp(s),id);}
    for(const e of targets)addPoison(s,e,source,id,8,12,base);strike(3);
  }
  else if(type==='expose'){strike(3);for(const e of targets)addStatus(s,e,'exposure',source,id,detectiveExposure(s,u),10);}
  else if(type==='quake'){strike(QUAKE_FACTOR);for(const e of targets){const crisis=e.progress>=PATH_LENGTH*2/3;pushBack(e,(crisis?320:160)*control);addControl(s,e,'stun',source,id,(crisis?3:1.5)*control*scale);}}
  else if(type==='nightmare'){strike(4);for(const e of targets){pushBack(e,220*control);addStatus(s,e,'exposure',source,id,Math.min(DAMAGE_TAKEN_CAP,.25*control*scale),6);addPoison(s,e,source,id,4,12,base);}}
  else if(type==='rewind'){for(const e of targets){pushBack(e,e.speed*6*control);addControl(s,e,'stun',source,id,2*control*scale);}strike(3);}
  else if(type==='vortex'||type==='singularity'){
    const front=targets.reduce((max,e)=>Math.max(max,e.progress),0),point=Math.max(120,front-80);
    for(const e of targets){const pull=Math.min(.9,.65*control)*(e.boss?BOSS_PUSH_SCALE:1);e.progress=e.progress*(1-pull)+point*pull;if(type==='vortex')addControl(s,e,'stun',source,id,1.5*control*scale);addSlow(s,e,source,.6,4);}
    if(type==='vortex')strike(5);
    // Harvest spends every divine mark on that enemy before the blast. Singularity does not stun.
    else for(const e of targets){const marks=e.divine;e.statusEffects=e.statusEffects.filter(effect=>effect.type!=='divine');syncStatuses(s,e);damage(s,e,base*WHALE.factor*(1+WHALE.perMark*marks),id);}
  }else if(type==='execute'){
    // Each execution kill carries the step to the next target (up to five more).
    const order=[...targets].sort((a,b)=>Number(!!b.boss)-Number(!!a.boss)||b.maxHp-a.maxHp);visualTargets=[];
    let strikes=5,extra=0;
    for(const e of order){if(strikes<=0)break;strikes--;visualTargets.push(e);const execute=e.hp/e.maxHp<=executeThreshold(e,s);damage(s,e,base*(execute?30:16),id);if(execute&&e.hp<=0&&extra<5){extra++;strikes++;}}
  }else if(type==='flurry'){visualTargets=[...targets].sort((a,b)=>b.progress-a.progress).slice(0,nightRabbitTargetCount(s));for(const e of visualTargets)damage(s,e,base*9,id);}
  else if(type==='thunder'){strike(THUNDER_FACTOR);for(const e of targets)addControl(s,e,'stun',source,id,1.2*control*scale);}
  else if(type==='fortune')strike(fortuneFactor(s.gold,s.upgrades[id]||0));
  else if(type==='dividend'){strike(4);giveGold(s,QUEEN_TAX,'필살기');s.edictWave=s.wave;}
  // Immunity is sampled first: stunning the protector must not strip the aura from allies in the same cast.
  else if(type==='bigshow'){strike(UNDERDOG.factor);const victims=s.board.map((ally,i)=>!!ally&&!immune(s,i));victims.forEach((on,i)=>{if(on)stunUnit(s,i,UNDERDOG.stun);});}
  else if(type==='solarflare'){
    // Spends the whole shared stack: 2x with none, +3x per sunlight (11x at three).
    const n=Math.min(SUNFLOWER.max,s.sunlight||0);strike(SUNFLOWER.base+SUNFLOWER.per*n);s.sunlight=0;look={sunlight:n};
    event(s,'sunSpend',{sunlight:n,points:s.board.flatMap((a,i)=>a?.hero==='sunflower'?[cellPoint(i)]:[])});
  }
  else if(type==='roulette'){
    if(jokerChaos(s))look={chaos:true};
    strike(JOKER.roulette);
    if(!jokerChaos(s)){
      const from=s.jokerColor||'red',color=pickJokerColor(s,from);
      s.jokerSeen=(s.jokerSeen||1)|jokerBit(from)|jokerBit(color);
      s.jokerColor=s.jokerSeen===JOKER.all?'chaos':color;
      event(s,'jokerColor',{from,color:s.jokerColor,points:s.board.flatMap((a,i)=>a?.hero==='joker'?[cellPoint(i)]:[])});
    }
  }
  else if(type==='applebomb'){
    const bomb={uid:s.nextId++,progress:random(s)*PATH_LENGTH,damage:base*APPLEBOMB.factor};
    s.bombs.push(bomb);event(s,'bombSet',{uid:bomb.uid,progress:bomb.progress,damage:bomb.damage,...pathPoint(bomb.progress)});
    stunUnit(s,s.board.indexOf(u),APPLEBOMB.stun);
  }
  else if(type==='crush'){visualTargets=[];const radius=crushRadius(s);for(let i=0;i<CRUSH.hits;i++){const life=CRUSH.first+i*CRUSH.gap;s.volleys.push({uid:s.nextId++,source:u.uid,hero:id,kind:'crush',phase:i,rank:u.rank,radius,damage:base*CRUSH.factor,life,total:life,...(i===CRUSH.hits-1?{echo:{}}:{})});}}
  else if(type==='requiem'){
    const points=targets.filter(e=>e.hp>0).map(e=>({...pathPoint(e.progress),uid:e.uid,cleared:clearEnemyDebuffs(s,e)}));
    strike(REQUIEM.factor);
    event(s,'requiem',{points});
  }
  else if(type==='lemonade'){
    const seconds=skillDuration(s,LEMONADE.seconds*control);
    for(const ally of s.board)if(ally){ally.disabled=0;ally.cursed=false;ally.invincible=seconds;}
  }
  else if(type==='armageddon'){
    const pick=reductionTarget(s,u);
    if(pick){
      if(invincible(s,pick.i))event(s,'ward',{...cellPoint(pick.i),hero:wardHero(s,pick.i)});
      else{s.board[pick.i]=null;syncTimeRuler(s);s.stats.sacrificed=(s.stats.sacrificed||0)+1;event(s,'reduce',{hero:pick.ally.hero,by:'ash',index:pick.i,...cellPoint(pick.i)});}
    }
    const near=e=>targets.filter(t=>t.hp>0&&Math.hypot(pathPoint(t.progress).x-pathPoint(e.progress).x,pathPoint(t.progress).y-pathPoint(e.progress).y)<=ARMAGEDDON.radius);
    const centre=targets.reduce((best,e)=>{const n=near(e).length;return !best||n>best.n||n===best.n&&e.progress>best.e.progress?{e,n}:best;},null)?.e;
    visualTargets=centre?near(centre):[];for(const e of visualTargets)damage(s,e,base*ARMAGEDDON.factor,id);
    if(centre)event(s,'armageddonBlast',{...pathPoint(centre.progress),radius:ARMAGEDDON.radius});
  }
  else if(type==='venomplague'){
    strike(VENOM_PLAGUE.factor);
    for(const e of targets)if(e.hp>0)addPoison(s,e,source,id,VENOM_PLAGUE.stacks,12,base);
    s.buffs.venom=skillDuration(s,VENOM_PLAGUE.seconds*control);
  }
  if(echoes){
    const ratio=RV.twin.echo*relicScaleIn(s,'twin');
    for(const [uid,dealt] of echoes){
      const target=s.enemies.find(e=>e.uid===uid&&e.hp>0);if(!target||!(dealt>0))continue;
      s.finishers.push({uid:s.nextId++,source:u.uid,hero:id,kind:'echo',target:uid,origin:cellPoint(s.board.indexOf(u)),to:pathPoint(target.progress),damage:dealt*ratio,rank:u.rank,life:1.5,total:1.5});
    }
    echoMaps.delete(s);
  }
  for(const delayed of [...s.finishers,...s.volleys,...s.bombs])if(delayed.uid>=castStart)delayed.crit=castCrits.get(s);
  const support=!dream&&['echo','haste','awaken','march','gift','trauma','harmony','lemonade','miracle_eclose'].includes(type);
  const key=ACTIVE_SKILLS[id];if(key&&!dream){s.buffTotals[key]=s.buffs[key];if(!s.buffScale)s.buffScale={};s.buffScale[key]=scale;}
  const points=support?s.board.flatMap((ally,index)=>ally&&(type!=='trauma'||ally.hero==='time_magician')?[{...cellPoint(index),uid:ally.uid}]:[]):visualTargets.map(e=>({...pathPoint(e.progress),uid:e.uid,from:before.get(e.uid)}));
  castCrits.delete(s);event(s,'skill',{hero:id,name:dream?RUMI_DREAM.name:name,kind:dream?'dream':type,rank:u.rank,goldCost,origin:cellPoint(s.board.indexOf(u)),support,locked:['royal','starfall','mirror'].includes(type),targets:points,...(gift!==undefined?{gift}:{}),...look});return {ok:true};
}
// Describes what pressing the ultimate would do right now, with the numbers cast() uses. No side effects.
// The detective's ultimate scales with training and rank like his basic attack, so it never falls behind it.
export const detectiveExposure=(s,u)=>Math.min(DAMAGE_TAKEN_CAP,(.35+(s.upgrades.great_detective||0)*.02)*special(s,'great_detective')*rankControl(u.rank));
// Aurora's mirror echo: 50% at 1★, scaled by rank and enhancement, up to 100%.
export const mirrorRatio=(s,u)=>Math.min(1,.5*rankSupport(u.rank)*special(s,'aurora'));
export function castPreview(s,id){
  const u=bestUnit(s,id);if(!u)return null;
  if(id==='miracle_larva'){const count=pendingMiracles(s).length;return {name:HERO[id].skill.name,rank:u.rank,lines:count?[`라바·코쿤 ${count}기 전부가 각각 우화합니다.`,`미라클윙 50% · 어비스윙 50%. 성급과 훈련은 유지됩니다.`]:['우화할 라바·코쿤이 없습니다.'],boost:{on:count>0,label:count?`우화 ${count}기`:'우화 없음',hint:''}};}
  if(id==='demon_king'){
    const {targets}=deathhandTargets(s),base=combatStats(s,u).damage,hand=n=>DEATHHAND.base+DEATHHAND.perDebuff*n,counts=targets.map(e=>demonDebuffTypes(s,e).length),min=counts.length?Math.min(...counts):0,max=counts.length?Math.max(...counts):0;
    return {name:HERO[id].skill.name,rank:u.rank,lines:[`반경 ${DEATHHAND.radius}의 적 ${targets.length}명 · 디버프 ${min===max?min:`${min}~${max}`}종.`,`공격력 ${hand(min)}${min===max?'':`~${hand(max)}`}배 · ${Math.round(base*hand(min))}${min===max?'':`~${Math.round(base*hand(max))}`} 피해. 디버프는 유지됩니다.`],boost:{on:max>0,label:max?`강화 ${min===max?min:`${min}~${max}`}종`:'강화 대기',hint:max?'':`감속·노출·기절·빙결·성광·중독·화상 각각 1종당 +${DEATHHAND.perDebuff}배.`}};
  }
  const hero=HERO[id],type=hero.skill.type,base=combatStats(s,u).damage,control=special(s,id),scale=rankControl(u.rank),dream=rumiDream(s,u);
  const targets=s.enemies.filter(e=>e.hp>0),lines=[];
  // Boost: an ultimate that grows under a condition reports whether it is boosted right now, and its
  // lines carry the boosted numbers; the hint names the condition only while it is not met.
  let boost=null;
  const num=v=>Math.round(v).toLocaleString('ko-KR');
  const sec=v=>Number(v.toFixed(1))+'초';
  const pct=v=>Math.round(v*100).toLocaleString('ko-KR');
  const dur=(seconds,key)=>sec(skillDuration(s,seconds*control,key));
  const hit=factor=>`${num(base*factor)} 피해`;
  const slowOf=amount=>Math.min(.8,amount*control);
  // Same fields cast() sees after syncStatuses, read from a copy of the effects.
  const snapshot=e=>{
    if(!Array.isArray(e.statusEffects))return {burnTime:e.burnTime||0,controlTime:Math.max(e.controlTime||0,e.stun||0,e.freeze||0),divine:e.divine||0,divineTime:e.divineTime||0};
    let burnTime=0,burn=0,stun=0,freeze=0,divine=0,divineTime=0;
    for(const effect of e.statusEffects){
      const remaining=effect.until-s.time;if(remaining<=1e-9)continue;
      if(effect.type==='burn'){if(effect.amount>burn||effect.amount===burn&&remaining>burnTime){burn=effect.amount;burnTime=remaining;}}
      else if(effect.type==='stun')stun=Math.max(stun,remaining);
      else if(effect.type==='freeze')freeze=Math.max(freeze,remaining);
      else if(effect.type==='divine'){divine+=effect.amount;divineTime=Math.max(divineTime,remaining);}
    }
    return {burnTime,controlTime:Math.max(stun,freeze),divine,divineTime};
  };
  // activePoison after expired effects are dropped. Legacy saves keep the mushroom snapshot.
  const poisonNow=e=>{
    const select=list=>{let remaining=POISON_CAP;return list.filter(effect=>effect.type==='poison').sort((a,b)=>b.power-a.power||b.until-a.until||a.source.localeCompare(b.source)).flatMap(effect=>{const stacks=Math.min(remaining,effect.amount);remaining-=stacks;return stacks?[{effect,stacks}]:[];});};
    if(!Array.isArray(e.statusEffects)){
      if(!(e.poison>0)||!(e.poisonTime>0))return [];
      const power=HERO.mushroom_king.damage*(s.meta?.mushroom_king?.power||1)*(1+(s.relicAttack||0));
      return select([{type:'poison',source:'legacy:poison',amount:Math.min(POISON_CAP,e.poison),until:s.time+e.poisonTime,power}]);
    }
    return select(e.statusEffects.filter(effect=>effect.until-s.time>1e-9));
  };
  const burnPerSecond=num(base*BURN.skill*(has(s,'ember')?1+RV.ember.burn*relicScaleIn(s,'ember'):1));
  const repeat=e=>!!e.boss&&(e.ultControl||0)-s.time>1e-9;

  if(dream){const [sun,,,last]=RUMI_DREAM.phases;lines.push(`해·달·별의 마법이 차례로 적 전체를 칩니다. 한 번에 공격력 ${sun.factor}배, ${hit(sun.factor)}입니다.`);lines.push(`마지막에 상상이 현실이 되어 공격력 ${last.factor}배, ${hit(last.factor)}를 줍니다. 모두 합쳐 공격력 ${RUMI_DREAM.phases.reduce((n,p)=>n+p.factor,0)}배입니다.`);}
  else if(type==='echo')lines.push(`${dur(8,'echo')} 동안 모든 동료의 공격마다 공격력 ${pct(.65*scale)}%의 추가 공격이 한 번 더 나갑니다.`);
  else if(type==='haste')lines.push(`${dur(ULT_BUFF.haste.seconds,'haste')} 동안 모든 동료의 공격 속도가 ${pct(ULT_BUFF.haste.speed*scale)}% 오릅니다.`);
  else if(type==='awaken')lines.push(`${dur(ULT_BUFF.awaken.seconds,'awaken')} 동안 모든 동료의 공격력이 ${pct(ULT_BUFF.awaken.power*scale)}% 오릅니다.`);
  else if(type==='march')lines.push(`${dur(ULT_BUFF.march.seconds,'march')} 동안 모든 동료의 공격이 성광 1중첩을 6초간 남기고, 공격 속도가 ${pct(ULT_BUFF.march.speed*scale)}% 오릅니다.`);
  else if(type==='glassfall'){
    lines.push(`적 전체에게 공격력 ${CINDERELLA.ult}배, ${hit(CINDERELLA.ult)}를 줍니다.`);
    // The haste and the three-hour step are fixed. cast() stores buffScale but never reads it back.
    lines.push(`${dur(10)} 동안 진짜 신데렐라의 공격 속도가 ${pct(CINDERELLA.haste)}% 오르고, 4번째 공격마다 자정의 종이 울립니다.`);
  }else if(type==='gift'){
    lines.push(freeCell(s)<0?'전장이 가득 차 편성된 동료 한 명이 1성으로 대기열에 들어갑니다.':'편성된 동료 한 명이 1성으로 전장에 합류합니다.');
    lines.push(`${dur(ULT_BUFF.festive.seconds,'festive')} 동안 모든 동료의 공격 속도가 ${pct(.2*scale)}% 오릅니다.`);
  }else if(type==='goddess'){
    lines.push(`적 전체에게 공격력 5배, ${hit(5)}를 줍니다.`);
    lines.push(`${dur(8,'radiance')} 동안 모든 동료의 공격력이 ${pct(.5*scale)}% 오릅니다.`);
    lines.push('기절과 저주를 한 번 풉니다.');
  }else if(type==='trauma'){
    lines.push(`적 전체에게 공격력 4배, ${hit(4)}를 줍니다.`);
    // TRAUMA power and speed are fixed. buffScale is stored and not applied.
    lines.push(`${dur(10,'trauma')} 동안 시간의마술사가 변신해 공격력 ${pct(TRAUMA.power)}%, 공격 속도 ${pct(TRAUMA.speed)}%가 오릅니다.`);
  }else if(type==='ice_court'){
    lines.push(`적 전체에게 공격력 9배, ${hit(9)}를 줍니다.`);
    lines.push(`적은 ${sec(winterDuration(s,u))} 동안 ${pctText(slowOf(WINTER_COURT.slow*scale))} 느려집니다.`);
    lines.push(`겨울 동안 적이 받는 피해가 ${pct(WINTER_EXPOSURE)}% 늘어납니다.`);
    lines.push(`겨울은 ${sec(winterDuration(s,u))} 동안 이어지고, 쓰러진 적 주변의 일반 적이 ${sec(WINTER_COURT.killFreeze)} 동안 얼어붙습니다.`);
  }else if(type==='harmony'){
    const level=s.upgrades.harmonious||0,field=control*scale;
    lines.push(`${dur(ULT_BUFF.harmony.seconds,'harmony')} 동안 모든 동료의 공격력 ${pct((ULT_BUFF.harmony.power+level*.02)*field)}%, 공격 속도 ${pct((ULT_BUFF.harmony.speed+level*.02)*field)}%가 오릅니다.`);
    lines.push('각성·가속 같은 다른 필살기 버프와 겹치면 큰 쪽만 적용됩니다.');
  }else if(type==='royal'||type==='starfall'||type==='mirror'){
    if(type==='starfall')lines.push(`별빛 ${Math.floor(s.gauge)}을 모두 써 체력이 가장 높은 적에게 ${hit(STARFALL_FACTOR*s.gauge)}를 줍니다.`);
    else if(type==='mirror'){
      lines.push(`체력이 가장 높은 적에게 5초 동안 거울을 걸고, 끝날 때 공격력 12배인 ${hit(12)}를 줍니다.`);
      lines.push(`그 사이 그 적이 받은 피해의 ${pct(mirrorRatio(s,u))}%가 더해집니다.`);
    }else{
      const target=highestMaxHp(s),view=target?snapshot(target):null,hot=!!view&&(view.burnTime>0||view.divine>=3&&view.divineTime>0);
      const factor=hot?48:24;boost={on:hot,label:hot?'강화':'강화 대기',hint:hot?'':`대상이 불타거나 성광 3중첩이면 강화되어 ${hit(48)}가 됩니다.`};
      lines.push(`체력이 가장 높은 적에게 공격력 ${factor}배, ${hit(factor)}를 줍니다.`);
      if(hot)lines.push('불이 꺼지거나 성광이 흩어지기 전에 맞아야 강화가 유지됩니다.');
    }
  }else if(type==='freeze'){
    const freeze=2*control*scale;
    lines.push(`적 전체에게 공격력 3배, ${hit(3)}를 줍니다.`);
    lines.push(`일반 적은 ${sec(freeze)} 동안 얼고 6초간 ${pctText(slowOf(SNOW_RABBIT.skillSlow*scale))} 느려집니다. 보스는 ${sec(freeze*BOSS_CONTROL_SCALE)} 동안 얼습니다.`);
  }else if(type==='avalanche'){
    const on=targets.filter(e=>snapshot(e).controlTime>0).length;
    if(!targets.length||on===0)lines.push(`적에게 공격력 4배, ${hit(4)}를 줍니다. 기절하거나 얼어 있으면 ${hit(12)}입니다.`);
    else if(on===targets.length)lines.push(`지금 기절·빙결 중인 적에게 공격력 12배, ${hit(12)}를 줍니다.`);
    else lines.push(`기절·빙결 ${on}명에게 ${hit(12)}, 나머지에게 ${hit(4)}를 줍니다.`);
    lines.push(`4초 동안 ${pct(slowOf(.5))}% 느려집니다.`);
  }else if(type==='dragon'){
    const near=e=>targets.filter(t=>Math.hypot(pathPoint(t.progress).x-pathPoint(e.progress).x,pathPoint(t.progress).y-pathPoint(e.progress).y)<=180);
    const centre=targets.reduce((best,e)=>{const n=near(e).length;return !best||n>best.n||n===best.n&&e.progress>best.e.progress?{e,n}:best;},null)?.e;
    const pack=centre?near(centre):[];
    lines.push(pack.length?`가장 밀집한 반경 180 안의 적 ${pack.length}명에게 공격력 14배, ${hit(14)}를 줍니다.`:`반경 180 안에서 가장 밀집한 적에게 공격력 14배, ${hit(14)}를 줍니다.`);
    lines.push(`맞은 적은 ${BURN.skillSeconds}초 동안 초당 ${burnPerSecond}의 화상을 입습니다.`);
  }else if(type==='inferno'){
    const crisis=coreCrisis(s),factor=7*(crisis?2:1);boost={on:crisis,label:crisis?'강화 · 코어 위기':'강화 대기',hint:crisis?'':`코어 생명력이 절반 아래로 내려가면 강화되어 ${hit(14)}가 됩니다.`};
    lines.push(`적 전체에게 공격력 ${factor}배, ${hit(factor)}를 줍니다.`);
    lines.push(`${BURN.skillSeconds}초 동안 초당 ${burnPerSecond}의 화상을 입습니다.`);
  }else if(type==='combust'){
    const burning=targets.filter(e=>snapshot(e).burnTime>0).length;
    if(!targets.length||burning===0)lines.push(`적에게 공격력 4배, ${hit(4)}를 줍니다. 이미 불타면 ${hit(10)}입니다.`);
    else if(burning===targets.length)lines.push(`지금 불타는 적에게 공격력 10배, ${hit(10)}를 줍니다.`);
    else lines.push(`불타는 적 ${burning}명에게 ${hit(10)}, 나머지에게 ${hit(4)}를 줍니다.`);
    lines.push(`${BURN.skillSeconds}초 동안 초당 ${burnPerSecond}의 화상을 입습니다.`);
  }else if(type==='plague'){
    const stacks=8,ready=targets.filter(e=>poisonNow(e).reduce((n,a)=>n+a.stacks,0)>=20);
    lines.push(`적 전체에게 공격력 3배, ${hit(3)}와 12초 동안 독 ${stacks}중첩을 줍니다.`);
    lines.push(`이 독은 중첩당 초당 ${num(base*POISON_POWER_RATIO*poisonAmp(s))} 피해입니다.`);
    if(!ready.length)lines.push('이미 독이 20중첩 이상인 적은 남은 독 피해의 30%를 먼저 받습니다.');
    else{
      const burst=e=>.3*poisonNow(e).reduce((n,{effect,stacks:count})=>n+count*effect.power*POISON_POWER_RATIO*Math.max(0,effect.until-s.time),0)*poisonAmp(s);
      const amounts=ready.map(burst),same=amounts.every(v=>Math.round(v)===Math.round(amounts[0]));
      lines.push(same?`독이 20중첩 이상인 적 ${ready.length}명은 먼저 남은 독의 30%인 ${num(amounts[0])} 피해를 받습니다.`:`독이 20중첩 이상인 적 ${ready.length}명은 각자 남은 독 피해의 30%를 먼저 받습니다.`);
    }
  }else if(type==='expose'){
    const raw=(.35+(s.upgrades.great_detective||0)*.02)*control*rankControl(u.rank),expose=Math.min(DAMAGE_TAKEN_CAP,raw);
    lines.push(`적 전체에게 공격력 3배, ${hit(3)}를 줍니다.`);
    lines.push(`10초 동안 받는 피해가 ${pct(expose)}% 늘어납니다.`+(raw>DAMAGE_TAKEN_CAP?' 상한까지 늘어납니다.':''));
  }else if(type==='quake'){
    const late=e=>e.progress>=PATH_LENGTH*2/3,lateN=targets.filter(late).length,all=lateN>0&&lateN===targets.length;
    const push=crisis=>num((crisis?320:160)*control)+'만큼',stun=crisis=>sec((crisis?3:1.5)*control*scale);
    boost={on:lateN>0,label:all?'강화':lateN?`강화 ${lateN}명`:'강화 대기',hint:lateN?'':`코어 가까이(경로 마지막 3분의 1) 온 적은 강화되어 ${push(true)} 밀려나고 ${stun(true)} 기절합니다.`};
    if(lateN&&!all){lines.push(`적 전체에게 공격력 ${QUAKE_FACTOR}배, ${hit(QUAKE_FACTOR)}를 줍니다.`);lines.push(`강화된 ${lateN}명은 ${push(true)} 밀려나고 ${stun(true)}, 나머지는 ${push(false)} 밀려나고 ${stun(false)} 기절합니다.`);}
    else lines.push(`적 전체에게 공격력 ${QUAKE_FACTOR}배, ${hit(QUAKE_FACTOR)}를 주고 ${push(all)} 밀어내며 ${stun(all)} 기절시킵니다.`);
    lines.push('보스는 절반만 밀려나고 절반 동안 기절합니다.');
  }else if(type==='nightmare'){
    const expose=Math.min(DAMAGE_TAKEN_CAP,.25*control*scale),stacks=4;
    lines.push(`적 전체에게 공격력 4배, ${hit(4)}를 주고 ${num(220*control)}만큼 밀어냅니다.`);
    lines.push(`6초 동안 받는 피해가 ${pct(expose)}% 늘고, 12초 동안 독 ${stacks}중첩이 걸립니다.`);
    lines.push(`독은 중첩당 초당 ${num(base*POISON_POWER_RATIO*poisonAmp(s))} 피해입니다.`);
  }else if(type==='rewind'){
    const stun=2*control*scale;
    if(targets.length===1){
      const e=targets[0],boss=!!e.boss,held=stun*(boss?BOSS_CONTROL_SCALE:1)*(repeat(e)?ULT_CONTROL_REPEAT:1),dist=e.speed*6*control*(boss?BOSS_PUSH_SCALE:1);
      lines.push(`적을 ${num(dist)}만큼 되돌리고 ${sec(held)} 동안 멈춘 뒤 공격력 3배, ${hit(3)}를 줍니다.`);
    }else{
      lines.push(`각 적을 이동 속도로 ${sec(6*control)} 동안 간 거리만큼 되돌리고 공격력 3배, ${hit(3)}를 줍니다.`);
      lines.push(`일반 적은 ${sec(stun)}, 보스는 ${sec(stun*BOSS_CONTROL_SCALE)} 동안 멈춥니다.`);
    }
  }else if(type==='vortex'||type==='singularity'){
    const front=targets.reduce((max,e)=>Math.max(max,e.progress),0),point=Math.max(120,front-80),pull=Math.min(.9,.65*control);
    const stunSec=1.5*control*scale,slow=pct(slowOf(.6));
    lines.push(`적들을 경로 ${num(point)} 쪽으로 ${pct(pull)}% 끌어당깁니다.`);
    if(type==='vortex'){
      lines.push(`공격력 5배, ${hit(5)}를 주고 4초 동안 ${slow}% 느려집니다.`);
      lines.push(`일반 적은 ${sec(stunSec)}, 보스는 ${sec(stunSec*BOSS_CONTROL_SCALE)} 동안 기절합니다.`);
    }else{
      const marks=targets.map(e=>snapshot(e).divine),f=m=>WHALE.factor*(1+WHALE.perMark*m);
      if(!marks.length||marks.every(m=>m===0))lines.push(`성광이 없으면 공격력 ${WHALE.factor}배, ${hit(WHALE.factor)}를 줍니다. 중첩 하나당 ${pct(WHALE.perMark)}%가 더해집니다.`);
      else if(marks.every(m=>m===marks[0]))lines.push(`성광 ${marks[0]}중첩을 모두 거둬 공격력 ${num(f(marks[0]))}배, ${hit(f(marks[0]))}를 줍니다.`);
      else lines.push(`성광을 모두 거둬 공격력 ${WHALE.factor}배에 중첩당 ${pct(WHALE.perMark)}%를 더합니다.`);
      lines.push(`4초 동안 ${slow}% 느려집니다.`);
    }
  }else if(type==='execute'){
    const order=[...targets].sort((a,b)=>Number(!!b.boss)-Number(!!a.boss)||b.maxHp-a.maxHp),first=order.slice(0,5);
    const low=first.filter(e=>e.hp/e.maxHp<=executeThreshold(e,s)),high=first.length-low.length;
    const rate=pct(executeThreshold(null,s));
    if(!first.length){
      lines.push(`보스부터 최대 5명에게 공격력 16배, ${hit(16)}를 줍니다.`);
      lines.push(`체력 ${rate}% 이하면 ${hit(30)}이고, 처치하면 최대 5명에게 더 이어집니다.`);
    }else if(low.length&&!high){
      lines.push(`지금 대상 ${first.length}명은 처형 기준 이하라 공격력 30배, ${hit(30)}를 받습니다.`);
      lines.push('처치하면 다음 대상에게 이어지며, 추가 대상은 최대 5명입니다.');
    }else if(!low.length){
      lines.push(`지금 대상 ${Math.min(5,first.length)}명에게 공격력 16배, ${hit(16)}를 줍니다.`);
      lines.push(`체력 ${rate}% 이하면 ${hit(30)}이고, 처치하면 최대 5명에게 더 이어집니다.`);
    }else{
      lines.push(`처형 기준 이하 ${low.length}명에게 ${hit(30)}, 나머지 ${high}명에게 ${hit(16)}를 줍니다.`);
      lines.push('처치하면 다음 대상에게 이어지며, 추가 대상은 최대 5명입니다.');
    }
  }else if(type==='flurry'){
    const count=nightRabbitTargetCount(s),aimed=Math.min(count,targets.length);
    lines.push(targets.length?`가장 앞선 적 ${aimed}명에게 공격력 9배, ${hit(9)}를 줍니다. 최대 ${count}명입니다.`:`가장 앞선 적에게 공격력 9배, ${hit(9)}를 줍니다. 최대 ${count}명입니다.`);
  }else if(type==='thunder'){
    const stun=1.2*control*scale;
    lines.push(`적 전체에게 공격력 ${THUNDER_FACTOR}배, ${hit(THUNDER_FACTOR)}를 줍니다.`);
    lines.push(`일반 적은 ${sec(stun)}, 보스는 ${sec(stun*BOSS_CONTROL_SCALE)} 동안 기절합니다.`);
  }else if(type==='fortune'){const level=s.upgrades[id]||0,factor=fortuneFactor(s.gold-skillGoldCost(id),level);lines.push(`적 전체에게 공격력 ${factor}배, ${hit(factor)}를 줍니다.`);if(factor<12+level)lines.push(`내고 남은 골드 40마다 +1배 (최대 ${12+level}배).`);}
  else if(type==='dividend'){
    lines.push(`적 전체에게 공격력 4배, ${hit(4)}를 주고 즉시 골드 ${QUEEN_TAX}을 받습니다.`);
    // The edict pays half of this wave's base income once; a second cast in the same wave only adds the tax.
    const edict=Math.round(waveIncome(s.wave)*.5);lines.push(`이번 웨이브 종료 시 추가 골드 +${edict}${s.edictWave===s.wave?' · 적용 중':''}`);
  }else if(type==='crush'){
    const grow=Math.round((s.upgrades.behemoth||0)*CRUSH.trainingRadius*100);
    lines.push(`무작위 적 주변에 ${hit(CRUSH.factor)}를 ${CRUSH.gap}초 간격으로 ${CRUSH.hits}번 줍니다.${grow?` 훈련으로 범위 +${grow}%.`:''}`);
    if(targets.length===1)lines.push(`적이 하나뿐이면 모두 그 적에게 들어갑니다(합계 ${hit(CRUSH.factor*CRUSH.hits)}).`);
  }else if(type==='bigshow'){
    lines.push(`적 전체에게 공격력 ${UNDERDOG.factor}배, ${hit(UNDERDOG.factor)}를 줍니다.`);
    lines.push(`쓰고 나면 아군 전체가 ${UNDERDOG.stun}초 동안 기절합니다.`);
  }else if(type==='solarflare'){
    const n=Math.min(SUNFLOWER.max,s.sunlight||0),f=SUNFLOWER.base+SUNFLOWER.per*n;
    lines.push(`햇빛 ${n}개를 모두 써서 적 전체에게 공격력 ${f}배, ${hit(f)}를 줍니다.`);
  }else if(type==='roulette'){
    const color=s.jokerColor||'red';
    lines.push(jokerChaos(s)?`적 전체에게 공격력 ${JOKER.roulette}배, ${hit(JOKER.roulette)}를 주고 카오스를 유지합니다.`:`적 전체에게 공격력 ${JOKER.roulette}배, ${hit(JOKER.roulette)}를 주고 지금 ${JOKER_NAMES[color].split(' · ')[0]}을 뺀 네 색 중 하나로 무작위로 바꿉니다.`);
    if(jokerChaos(s))lines.push('일반 공격 시 화상·중독·성광·노출·감속을 모두 겁니다.');
  }else if(type==='applebomb'){
    const set=(s.bombs||[]).length;
    lines.push(`경로의 무작위 위치에 사과를 설치합니다(최대 ${APPLEBOMB.max}개, 지금 ${set}개).`);
    lines.push(`적이 가까이 오면 바로 터져 반경 ${APPLEBOMB.radius} 안의 적에게 공격력 ${APPLEBOMB.factor}배, ${hit(APPLEBOMB.factor)}를 줍니다.`);
    lines.push(`피해는 폭발 순간 최고 성급 토피애플의 현재 공격력으로 계산합니다. 토피애플이 없으면 마지막 유효 공격력을 사용합니다.`);
    lines.push(`설치한 토피애플은 ${APPLEBOMB.stun}초 동안 기절합니다.`);
  }else if(type==='requiem'){
    lines.push(`적의 모든 디버프를 지우고 적 전체에게 공격력 ${REQUIEM.factor}배, ${hit(REQUIEM.factor)}를 줍니다.`);
    const n=targets.filter(e=>debuffCount(s,e)>0).length;
    if(n)lines.push(`지금 지워지는 디버프가 걸린 적 ${n}기.`);
  }else if(type==='lemonade'){
    lines.push(`아군 전체의 기절과 저주를 풀고 ${dur(LEMONADE.seconds)} 동안 무적으로 만듭니다.`);
    const n=s.board.filter(a=>a&&(a.disabled>0||a.cursed)).length;
    if(n)lines.push(`지금 행동불능인 동료 ${n}명.`);
  }else if(type==='armageddon'){
    const pick=reductionTarget(s,u);
    lines.push(!pick?'소멸할 동료가 없습니다.':invincible(s,pick.i)?`${HERO[pick.ally.hero].name} ${pick.ally.rank}성은 무적이라 소멸하지 않습니다.`:`지금 소멸하는 동료: ${HERO[pick.ally.hero].name} ${pick.ally.rank}성.`);
    lines.push(`가장 밀집한 반경 ${ARMAGEDDON.radius}의 적에게 공격력 ${ARMAGEDDON.factor}배, ${hit(ARMAGEDDON.factor)}를 줍니다.`);
  }else if(type==='ultimate_breath'){
    const remaining=charging(s,u)?Math.max(0,s.goldCharge.ends-s.time):GOLD_DRAGON.charge;
    const opening=s.waveTime+remaining<GOLD_DRAGON.opening-1e-9,projected=goldBreathPower(s,u,remaining);
    lines.push(`차지 ${sec(remaining)} · 반경 ${GOLD_DRAGON.radius} · 공격력 ${GOLD_DRAGON.factor}배.`);
    lines.push(`현재 배치로 발사 예상 ${num(projected*GOLD_DRAGON.factor)} 피해. 실제 피해는 발사 순간에 정해집니다.`);
    boost={on:opening,label:opening?'강화 발사 예상':'일반 발사 예상',hint:''};
  }else if(type==='venomplague'){
    lines.push(`적 전체에게 공격력 ${VENOM_PLAGUE.factor}배, ${hit(VENOM_PLAGUE.factor)}를 주고 중독을 ${VENOM_PLAGUE.stacks}중첩 쌓습니다.`);
    lines.push(`${dur(VENOM_PLAGUE.seconds)} 동안 적이 받는 화상·중독 피해가 ${1+VENOM_PLAGUE.amp}배가 됩니다.`);
  }else lines.push(hero.skill.text);

  const gold=skillGoldCost(id);
  if(gold>0)lines.push(`골드 ${num(gold)}을 사용합니다.`);
  return {rank:u.rank,lines,...(id==='joker'&&jokerChaos(s)?{name:skillName(s,id),cost:skillCost(s,id)}:{}),...(boost?{boost}:{}),...(dream?{name:RUMI_DREAM.name}:{})};
}

// Boss patterns. Every action is telegraphed (2.6 s, targeted 3.5 s) except the curse, which the user wants unannounced.
// Targets are random: a random row, random occupied cells, or a random companion for the curse.
// Repeat-limited patterns (curse, shuffle) count per boss so one appearance never spams them.
// BOSS_LIMIT.judgement is Astea's judgement (max 2), not Thor's column stun.
const BOSS_LIMIT={curse:1,shuffle:2,judgement:2};
// Targeted patterns (lit cells) give longer to drag the unit out; board-wide ones stay at 2.6 s.
export const TELEGRAPH_TIME=Object.freeze({seal:3.5,storm:3.5,stun1:3.5,judgement:3.5});
function bossCells(s,pattern){
  const occupied=s.board.flatMap((u,i)=>u?[i]:[]),all=Array.from({length:25},(_,i)=>i);
  if(pattern==='seal'){const row=Math.floor(random(s)*5);return Array.from({length:5},(_,i)=>row*5+i);}
  if(pattern==='storm')return [...shuffle(s,occupied),...shuffle(s,all.filter(i=>!occupied.includes(i)))].slice(0,3);
  if(pattern==='stun1'||pattern==='judgement')return occupied.length?[occupied[Math.floor(random(s)*occupied.length)]]:[Math.floor(random(s)*25)];
  if(pattern==='thunder'){const cols=shuffle(s,[0,1,2,3,4]).slice(0,3);return all.filter(i=>cols.includes(i%5));}
  if(pattern==='shuffle')return all;
  return [];
}
function bossResolve(s,e,boss,pattern){
  refreshAppleBombs(s);
  const cells=s.telegraph?.cells||[];
  // Sample immunity before any stun: disabling the aura source must not expose a neighbour later in the same pattern.
  const victims=()=>cells.filter(i=>s.board[i]&&!immune(s,i));
  // An immune unit that a pattern would have hit shows the ward (Antropy's own halo or a cure master's bubble).
  if(['seal','storm','stun1','thunder'].includes(pattern))for(const i of cells)if(s.board[i]&&immune(s,i))event(s,'ward',{...cellPoint(i),hero:wardHero(s,i)});
  if(pattern==='judgement')for(const i of cells)if(s.board[i]&&invincible(s,i))event(s,'ward',{...cellPoint(i),hero:wardHero(s,i)});
  if(pattern==='seal'){for(const i of victims())s.board[i].disabled=Math.max(s.board[i].disabled,boss.sealTime||2.4);event(s,'seal',{cells});}
  else if(pattern==='storm'){for(const i of victims()){s.board[i].disabled=1.8;s.gauge=Math.max(0,s.gauge-5);}event(s,'bossCast',{boss:e.boss,pattern,cells,...pathPoint(e.progress)});}
  else if(pattern==='stun1'){for(const i of victims())s.board[i].disabled=Math.max(s.board[i].disabled,2);event(s,'seal',{cells});}
  else if(pattern==='starlust'){if(s.gauge>=gaugeCap(s)-1e-6){s.gauge=Math.max(0,s.gauge-60);event(s,'drain');}event(s,'bossCast',{boss:e.boss,pattern,...pathPoint(e.progress)});}
  else if(pattern==='thunder'){e.judged=true;e.judging=false;for(const i of victims())s.board[i].disabled=Math.max(s.board[i].disabled,3);event(s,'bossCast',{boss:e.boss,pattern,cells,...pathPoint(e.progress)});}
  else if(pattern==='shuffle'){
    const fixed=s.board.findIndex(u=>charging(s,u)),units=s.board.filter(u=>u&&!charging(s,u)),slots=shuffle(s,Array.from({length:25},(_,i)=>i).filter(i=>i!==fixed)),board=Array(25).fill(null);
    if(fixed>=0)board[fixed]=s.board[fixed];units.forEach((u,i)=>{board[slots[i]]=u;});s.board=board;syncTimeRuler(s);
    event(s,'shuffle',{});event(s,'bossCast',{boss:e.boss,pattern,...pathPoint(e.progress)});
  }else if(pattern==='warp'){
    // Read the end times without syncing, so later enemies keep this frame's DOT segments (as the old rush did).
    for(const t of s.enemies){if(t.hp<=0)continue;const controlled=t.statusEffects.some(effect=>['stun','freeze'].includes(effect.type)&&effect.until-s.time>1e-9),slowed=t.slowEffects.some(effect=>effect.until-s.time>1e-9);if(controlled||slowed)continue;t.progress=Math.min(PATH_LENGTH-1,t.progress+PATH_LENGTH*.15);}
    event(s,'rush');event(s,'bossCast',{boss:e.boss,pattern,...pathPoint(e.progress)});
  }else if(pattern==='judgement'){
    const i=cells[0],u=s.board[i],safe=!u||invincible(s,i);
    if(u&&!safe&&s.board.filter(Boolean).length>1){s.board[i]=null;syncTimeRuler(s);}
    event(s,'judgement',{index:i,hit:!!u&&!safe,...cellPoint(i)});
  }
}
function bossStep(s,e,dt){
  const boss=BOSSES[e.boss];
  if(e.channel>0){
    e.channel-=dt;
    if(e.channel<=0){const pattern=s.telegraph?.pattern||boss.pattern;bossResolve(s,e,boss,pattern);s.telegraph=null;e.skillIn=boss.every||9;}
    return;
  }
  // Thor, once per appearance at the path midpoint: three random columns, telegraphed 3.5 s, lit cells stunned 3 s.
  // A stun on Thor during that channel cancels it (tickEnemyStatuses).
  if(boss.judgement&&!e.judged&&e.progress>=PATH_LENGTH*.5){
    e.channel=3.5;e.judging=true;e.channelHp=e.hp+(e.shield||0);
    s.telegraph={uid:e.uid,pattern:'thunder',text:boss.judgement,cells:bossCells(s,'thunder'),ends:s.time+3.5,total:3.5};event(s,'warning',{text:boss.judgement,cells:s.telegraph.cells,pattern:'thunder'});return;
  }
  e.skillIn-=dt*(s.oathMods?.bossHaste||1);if(e.skillIn>0)return;
  const casts=e.casts||0,pattern=Array.isArray(boss.pattern)?boss.pattern[casts%boss.pattern.length]:boss.pattern;
  if(BOSS_LIMIT[pattern]!==undefined&&casts>=BOSS_LIMIT[pattern]){e.skillIn=99;return;}
  e.casts=casts+1;
  if(pattern==='curse'){
    // Unannounced, once per appearance: one random active companion is sealed until it is merged, sold or cleansed.
    const pool=s.board.flatMap((u,i)=>u&&!u.cursed?[i]:[]);e.skillIn=boss.every||9;
    if(!pool.length)return;
    const i=pool[Math.floor(random(s)*pool.length)];
    if(immune(s,i)){event(s,'ward',{...cellPoint(i),hero:wardHero(s,i)});return;}
    s.board[i].cursed=true;event(s,'curse',{index:i,hero:s.board[i].hero,...cellPoint(i)});return;
  }
  const time=TELEGRAPH_TIME[pattern]||2.6;e.channel=time;e.channelHp=e.hp+(e.shield||0);
  const text=boss.warnings?.[pattern]||boss.warning,cells=bossCells(s,pattern);
  s.telegraph={uid:e.uid,pattern,text,cells,ends:s.time+time,total:time};event(s,'warning',{text,cells,pattern});
}

function completeWave(s){
  const payout={base:waveIncome(s.wave),dividend:dividend(s),edict:s.edictWave===s.wave?Math.round(waveIncome(s.wave)*.5):0};
  giveGold(s,payout.base,'웨이브');giveGold(s,payout.dividend,'배당');if(payout.edict)giveGold(s,payout.edict,'여왕의 칙령');
  if(has(s,'feather'))giveGold(s,Math.round(Math.min(RV.feather.cap,RV.feather.base+RV.feather.perWave*s.wave)*relicScaleIn(s,'feather')),'첫새벽의 깃털');
  s.settlement=payout;s.amuletUsed=0;addGauge(s,8);if(s.oathMods?.carry!==undefined)s.gauge=Math.min(s.gauge,s.oathMods.carry);s.shots=[];s.finishers=[];s.volleys=[];s.zones=[];s.telegraph=null;s.goldCharge=null;
  if((s.sunlight||0)<SUNFLOWER.max&&s.board.some(u=>u?.hero==='sunflower')){s.sunlight=(s.sunlight||0)+1;event(s,'sunCharge',{sunlight:s.sunlight,points:s.board.flatMap((u,i)=>u?.hero==='sunflower'?[cellPoint(i)]:[])});}
  event(s,'clear',{wave:s.wave,...payout});
  if(s.wave===lastWave(s)&&!s.endless){s.reward=null;s.phase='victory';s.won=true;return;}
  s.reward=shuffle(s,BLESSINGS.map(b=>b.id)).slice(0,3);s.phase='reward';
}
export function chooseReward(s,id){
  if(s.phase!=='reward'||!s.reward.includes(id))return {ok:false};
  if(id==='arrival'){const hero=drawHero(s);if(place(s,hero,2)<0)s.reserves.push(hero);}
  if(id==='surge')s.surgeWave=s.wave+1;
  if(id==='training')s.trainingDiscount=Math.min(.5,Math.round((s.trainingDiscount+.1)*10)/10);
  if(id==='oath')s.globalAttack=Math.round((s.globalAttack+.06)*100)/100;
  if(id==='purse')giveGold(s,35,'축복');
  if(id==='mend'){s.health=Math.min(coreHealthMax(s),s.health+3);addGauge(s,20);}
  s.blessings.push(id);s.reward=null;event(s,'blessing',{id});
  if(s.wave===lastWave(s)&&!s.endless){s.phase='victory';s.won=true;}else {s.phase='intermission';s.breakTime=1.4;}
  return {ok:true};
}
export function continueEndless(s){if(s.phase!=='victory')return;s.endless=true;beginWave(s,s.wave+1);}

function tickEnemyStatuses(s,e,start,end){
  syncStatuses(s,e,start);syncSlows(s,e,start);
  // Split a frame at actual deadlines: a strong DOT cannot deal one extra
  // frame after expiry, and an expired exposure cannot amplify the next DOT.
  const boundaries=[...new Set([...e.statusEffects,...e.slowEffects].map(effect=>effect.until).filter(until=>until>start+1e-9&&until<end-1e-9))].sort((a,b)=>a-b);
  let at=start;
  for(const until of [...boundaries,end]){
    const dt=until-at;syncStatuses(s,e,at);syncSlows(s,e,at);
    if(e.burn>0)damage(s,e,e.burn*dt*(has(s,'ember')?1+RV.ember.burn*relicScaleIn(s,'ember'):1),e.burnOwner,{dot:true,statusAt:at,dotType:'burn',crit:e.burnCrit});
    const poisonByOwner=new Map();
    for(const {effect,stacks} of activePoison(e)){const key=effect.owner+':'+JSON.stringify(effect.crit);let group=poisonByOwner.get(key);if(!group)poisonByOwner.set(key,group={owner:effect.owner,crit:effect.crit,dps:0});group.dps+=stacks*effect.power*POISON_POWER_RATIO;}
    for(const {owner,dps,crit} of poisonByOwner.values())damage(s,e,dps*dt*poisonAmp(s),owner,{dot:true,statusAt:at,dotType:'poison',crit});
    if(e.hp<=0)break;
    if(e.controlTime>0){if(e.judging&&s.telegraph?.uid===e.uid&&s.telegraph.pattern==='thunder'){e.judging=false;e.judged=true;e.channel=0;s.telegraph=null;e.skillIn=Math.max(e.skillIn,3);event(s,'interrupt',{name:BOSSES[e.boss].name});}else if(s.telegraph?.uid===e.uid)s.telegraph.ends+=dt;}
    else {e.progress+=e.speed*dt*(e.slowTime>0?1-e.slow:1)*(e.rage>0?1.4:1);if(e.boss)bossStep(s,e,dt);}
    at=until;
  }
  syncStatuses(s,e,end);syncSlows(s,e,end);
}
function releaseGoldBreath(s){
  const charge=s.goldCharge;if(!charge)return;
  const u=s.board.find(u=>u?.uid===charge.source&&u.hero==='gold_dragon');
  if(!u||charge.wave!==s.wave){s.goldCharge=null;return;}
  if(s.time<charge.ends-1e-9)return;
  // No target or damage is banked at the button press. Unit priority is read at release,
  // independently of the basic cross's fixed row/column intersection.
  const target=goldBreathTarget(s,u);
  const origin=cellPoint(s.board.indexOf(u)),opening=goldOpening(s);
  if(target){
    const to=pathPoint(target.progress),life=GOLD_DRAGON.flight;
    s.volleys.push({uid:s.nextId++,source:u.uid,hero:u.hero,kind:'gold_breath',rank:u.rank,origin,to,radius:GOLD_DRAGON.radius,damage:combatStats(s,u).damage*GOLD_DRAGON.factor,crit:unitCrit(s,u),opening,started:s.time,life,total:life,...(has(s,'twin')?{echo:{}}:{})});
    u.aim=Math.atan2(to.y-origin.y,to.x-origin.x);u.facing=attackDirection(origin,to);u.pose=.3;
    event(s,'goldBreathRelease',{hero:u.hero,origin,to,opening,rank:u.rank,radius:GOLD_DRAGON.radius,total:life});
  }else event(s,'goldBreathFizzle',{hero:u.hero,...origin});
  s.goldCharge=null;
}
export function step(s,dt){
  if(!['combat','intermission'].includes(s.phase))return;
  dt=clamp(dt,0,.05);const start=s.time;s.time+=dt;beginEmberFrame(s);
  // A short challenge measures how far this collection can push, without
  // waiting for a nearly invulnerable late-round enemy to circle the arena.
  for(const key of Object.keys(s.buffs))s.buffs[key]=Math.max(0,s.buffs[key]-dt);
  while(s.reserves.length&&freeCell(s)>=0)place(s,s.reserves.shift(),2);
  if(s.phase==='intermission'){s.breakTime-=dt;if(s.breakTime<=0)beginWave(s,s.wave+1);return;}
  s.waveTime+=dt;addGauge(s,dt*STARLIGHT_PER_SECOND*(s.oathMods?.regen??1));
  s.spawnIn-=dt;if(s.spawnIn<=0&&s.queue.length){spawnEnemy(s,s.queue.shift());s.spawnIn=wavePlan(s.wave,s.chapter,s.mode).interval;}
  for(const e of s.enemies){
    if(e.hp<=0)continue;e.hit=Math.max(0,e.hit-dt);e.dotFlash-=dt;
    tickEnemyStatuses(s,e,start,s.time);
    if(e.hp<=0)continue;
    if(e.rage>0)e.rage=Math.max(0,e.rage-dt);
    if(e.progress>=PATH_LENGTH&&e.hp>0){
      // Returning Dawn: once per run the boss walks back to the middle of the path and takes more damage from then on.
      if((e.boss||e.kind==='boss')&&has(s,'phoenix')&&(s.phoenixUses||0)<RV.phoenix.uses){s.phoenixUses=(s.phoenixUses||0)+1;s.phoenixUsed=true;e.progress=PATH_LENGTH/2;e.dawn=RV.phoenix.taken*relicScaleIn(s,'phoenix');event(s,'phoenix');}
      else{e.hp=0;s.health-=e.boss?7:e.kind==='armor'?2:1;s.stats.leaks=(s.stats.leaks||0)+1;event(s,'leak',{boss:e.boss,health:s.health});if(has(s,'amulet')&&(s.amuletUsed||0)<RV.amulet.uses){s.amuletUsed=(s.amuletUsed||0)+1;addGauge(s,RV.amulet.starlight*relicScaleIn(s,'amulet'));}}
    }
  }
  refreshAppleBombs(s);
  // Passing elsewhere on the route does not trigger an apple: an enemy must be nearby.
  if(s.bombs.length)s.bombs=s.bombs.filter(bomb=>{
    const alive=s.enemies.filter(e=>e.hp>0);
    if(!alive.some(e=>Math.abs(e.progress-bomb.progress)<=APPLEBOMB.trigger))return true;
    const origin=pathPoint(bomb.progress);
    const hit=alive.filter(e=>{const p=pathPoint(e.progress);return Math.hypot(p.x-origin.x,p.y-origin.y)<=APPLEBOMB.radius;});
    for(const e of hit)damage(s,e,bomb.damage,'toffee_apple',{crit:bomb.crit});
    // Receipts keep lethal hits after those enemies leave the renderer map.
    // Only enemies inside the blast radius are targets.
    event(s,'bombBlast',{uid:bomb.uid,progress:bomb.progress,damage:bomb.damage,...origin,radius:APPLEBOMB.radius,targets:hit.map(e=>({uid:e.uid,...pathPoint(e.progress)}))});
    return false;
  });
  for(const z of s.zones){
    z.life-=dt;z.tick-=dt;if(z.life<=0||z.tick>0)continue;z.tick+=.5;
    const targets=s.enemies.filter(e=>e.hp>0&&Math.hypot(pathPoint(e.progress).x-z.x,pathPoint(e.progress).y-z.y)<=z.radius),h=HERO[z.hero];
    for(const e of targets){
      // Gravity fields deal +30% per divine stack on the enemy.
      if(z.hero==='galaxy_whale'&&!z.orbit)syncStatuses(s,e);
      damage(s,e,z.damage*(z.orbit?RV.orbit.tick*relicScaleIn(s,'orbit'):.22)*(z.hero==='galaxy_whale'&&!z.orbit?1+.3*e.divine:1),z.hero,{dot:true,crit:z.crit});if(z.orbit)continue;
      if(z.hero==='flame_sage')addStatus(s,e,'burn',sourceKey('zone',z.hero,z.uid),z.hero,z.damage*BURN.attack,BURN.attackSeconds,undefined,z.crit);
      if(z.hero==='mushroom_king')addPoison(s,e,sourceKey('zone',z.hero,z.uid),z.hero,1,7,z.damage,z.crit);
    }
    if(!z.orbit&&['phantom','galaxy_whale','time_ruler'].includes(z.hero))slowTargets(s,targets,h,z.damage,z,sourceKey('zone',z.hero,z.uid),z.rank);
  }
  s.zones=s.zones.filter(z=>z.life>0);
  const chargingUid=s.goldCharge?.source;
  releaseGoldBreath(s);
  for(let i=0;i<s.board.length;i++){
    const u=s.board[i];if(!u)continue;u.pose=Math.max(0,u.pose-dt);
    if(u.invincible>0)u.invincible=Math.max(0,u.invincible-dt);
    if(u.uid===chargingUid){u.cooldown=Math.max(0,u.cooldown-dt);u.disabled=Math.max(0,u.disabled-dt);continue;}
    if(u.disabled>0){u.disabled-=dt;continue;}
    if(u.cursed)continue;
    if(u.windup>0){u.windup-=dt;if(u.windup<=0)attack(s,u,i);continue;}
    u.cooldown-=dt;if(u.cooldown<=0){const target=chooseTarget(s,u,false);if(target){u.idleFor=0;u.target=target.uid;const p=cellPoint(i),t=pathPoint(target.progress);u.aim=Math.atan2(t.y-p.y,t.x-p.x);u.facing=attackDirection(p,t);u.windup=ATTACK_WINDUP;u.cooldown=combatStats(s,u,i).cooldown;}else{u.cooldown=.1;u.idleFor=(u.idleFor||0)+.1;if(u.idleFor>1)u.facing='down';}}
  }
  for(const shot of s.shots){if(shot.delay>0){shot.delay=Math.max(0,shot.delay-dt);continue;}shot.life-=dt;if(shot.life<=0)applyHit(s,shot);}
  const twinEchoes=[];
  for(const f of s.finishers){
    f.life-=dt;const target=s.enemies.find(e=>e.uid===f.target&&e.hp>0);
    if(!target){event(s,'finisherFizzle',{hero:f.hero,kind:f.kind,...f.to});f.life=0;continue;}
    f.to=pathPoint(target.progress);
    if(f.life<=1e-9){
      f.life=0;
      syncStatuses(s,target);syncSlows(s,target);
      const factor=f.kind==='royal'&&(target.burnTime>0||target.divine>=3&&target.divineTime>0)?2:1;
      // Thousand Mirrors has no ceiling; only checkpoints from before the change keep one.
      const echoDamage=f.kind==='mirror'?(f.cap!==undefined?Math.min(f.cap,f.stored*(f.ratio??.45)):f.stored*(f.ratio??.45)):0,before=s.stats.damage;
      const dealt=f.kind==='echo'?damage(s,target,f.damage,f.hero,{flat:true}):damage(s,target,f.damage*factor+echoDamage,f.hero,{recordMirror:f.kind!=='mirror',crit:f.crit});
      event(s,'finisherImpact',{hero:f.hero,kind:f.kind,target:f.target,targetBoss:!!target.boss,...f.to,origin:f.origin,rank:f.rank,damage:s.stats.damage-before,echoDamage});
      if(dealt>0&&target.hp>0&&has(s,'twin')&&(f.kind==='royal'||f.kind==='starfall'||f.kind==='mirror'))twinEchoes.push({uid:s.nextId++,source:f.source,hero:f.hero,kind:'echo',target:target.uid,origin:f.origin,to:pathPoint(target.progress),damage:dealt*RV.twin.echo*relicScaleIn(s,'twin'),rank:f.rank,life:1.5,total:1.5});
    }
  }
  if(twinEchoes.length)s.finishers.push(...twinEchoes);
  s.finishers=s.finishers.filter(f=>f.life>0);
  // Dream form phases: each one strikes every enemy alive at that moment. The twin relic echoes the
  // summed damage once, after the last phase, like any other field ultimate.
  for(const v of s.volleys){
    v.life=v.kind==='gold_breath'?clamp(v.started+v.total-s.time,0,v.total):v.life-dt;if(v.life>1e-9)continue;v.life=0;
    const echoFinisher=(uid,dealt)=>{const target=s.enemies.find(e=>e.uid===Number(uid)&&e.hp>0);if(target&&dealt>0)s.finishers.push({uid:s.nextId++,source:v.source,hero:v.hero,kind:'echo',target:target.uid,origin:pathPoint(target.progress),to:pathPoint(target.progress),damage:dealt*RV.twin.echo*relicScaleIn(s,'twin'),rank:v.rank,life:1.5,total:1.5});};
    if(v.kind==='gold_breath'){
      const points=[];
      for(const e of s.enemies){if(e.hp<=0)continue;const p=pathPoint(e.progress);if(Math.hypot(p.x-v.to.x,p.y-v.to.y)>v.radius)continue;
        const dealt=damage(s,e,v.damage,v.hero,{crit:v.crit});points.push({...p,uid:e.uid});if(v.echo&&dealt>0)v.echo[e.uid]=dealt;
      }
      event(s,'goldBreathImpact',{hero:v.hero,...v.to,origin:v.origin,radius:v.radius,opening:v.opening,rank:v.rank,targets:points});
      if(v.echo&&has(s,'twin'))for(const [uid,dealt] of Object.entries(v.echo))echoFinisher(uid,dealt);
    }else if(v.kind==='crush'){
      const alive=s.enemies.filter(e=>e.hp>0);
      if(alive.length){
        const centre=alive[Math.floor(random(s)*alive.length)],at=pathPoint(centre.progress),echo=s.volleys.find(x=>x.kind==='crush'&&x.source===v.source&&x.echo&&(x===v||x.life>0)),points=[];
        for(const e of alive){const p=pathPoint(e.progress);if(Math.hypot(p.x-at.x,p.y-at.y)>v.radius)continue;const dealt=damage(s,e,v.damage,v.hero,{crit:v.crit});points.push({...p,uid:e.uid});if(echo&&dealt>0)echo.echo[e.uid]=(echo.echo[e.uid]||0)+dealt;}
        event(s,'crushPhase',{hero:v.hero,phase:v.phase,rank:v.rank,x:at.x,y:at.y,radius:v.radius,targets:points});
      }
      if(v.echo&&has(s,'twin'))for(const [uid,dealt] of Object.entries(v.echo))echoFinisher(uid,dealt);
    }else{
      const hit=s.enemies.filter(e=>e.hp>0),last=s.volleys.find(x=>x.source===v.source&&x.echo),points=[];
      for(const e of hit){const dealt=damage(s,e,v.damage,v.hero,{crit:v.crit});points.push({...pathPoint(e.progress),uid:e.uid});if(last&&dealt>0)last.echo[e.uid]=(last.echo[e.uid]||0)+dealt;}
      event(s,'dreamPhase',{hero:v.hero,phase:v.phase,rank:v.rank,targets:points});
      if(v.echo&&has(s,'twin'))for(const [uid,dealt] of Object.entries(v.echo))echoFinisher(uid,dealt);
    }
  }
  s.volleys=s.volleys.filter(v=>v.life>0);
  s.shots=s.shots.filter(shot=>shot.life>0);s.enemies=s.enemies.filter(e=>e.hp>0);
  if(s.telegraph&&!s.enemies.some(e=>e.uid===s.telegraph.uid))s.telegraph=null;
  if(s.health<=0){s.health=0;s.phase='defeat';s.goldCharge=null;event(s,'defeat');}
  else if(!s.enemies.length&&!s.queue.length)completeWave(s);
}

export function serialize(s){const {events,...value}=s;return JSON.stringify(value);}
export function restore(raw){
  try{
    const s=typeof raw==='string'?JSON.parse(raw):raw;
    if(!s||s.version!==VERSION||!validDeck(s.deck)||!Array.isArray(s.board)||s.board.length!==25||!Array.isArray(s.enemies)||!Array.isArray(s.shots)||!Array.isArray(s.queue))return null;
    const numeric=(o,keys)=>o&&keys.every(k=>Number.isFinite(o[k])&&Math.abs(o[k])<1e100);
    const record=o=>o&&typeof o==='object'&&!Array.isArray(o);
    const id=n=>Number.isSafeInteger(n)&&n>0;
    const kinds=['grunt','armor','runner','wisp','boss'];
    if(s.statusRevision!==undefined&&s.statusRevision!==STATUS_REVISION)return null;
    const legacyStatus=s.statusRevision===undefined;
    // Additive migration: an old run keeps its wave, HP, wallet and target
    // priorities. Only future waves use revision 3's pacing.
    if(s.finishers===undefined)s.finishers=[];
    if(s.volleys===undefined)s.volleys=[];
    if(s.goldCharge===undefined)s.goldCharge=null;
    if(s.buffTotals===undefined)s.buffTotals={...s.buffs};
    if(s.buffScale===undefined)s.buffScale={};
    if(s.buffs&&s.buffs.tax!==undefined)delete s.buffs.tax;
    if(s.buffTotals&&s.buffTotals.tax!==undefined)delete s.buffTotals.tax;
    if(s.buffScale&&s.buffScale.tax!==undefined)delete s.buffScale.tax;
    if(s.edictWave===undefined)s.edictWave=0;
    if(s.sunlight===undefined)s.sunlight=0;if(s.jokerColor===undefined)s.jokerColor='red';
    if(!Number.isInteger(s.sunlight)||s.sunlight<0||s.sunlight>SUNFLOWER.max||![...JOKER.colors,'chaos'].includes(s.jokerColor))return null;
    // Older saves can prove only the initial red and the currently displayed colour.
    if(s.jokerSeen===undefined){if(jokerChaos(s))return null;s.jokerSeen=1|jokerBit(s.jokerColor);}
    if(!Number.isInteger(s.jokerSeen)||s.jokerSeen<1||s.jokerSeen>JOKER.all||!(s.jokerSeen&1)||jokerChaos(s)!==(s.jokerSeen===JOKER.all)||!jokerChaos(s)&&!(s.jokerSeen&jokerBit(s.jokerColor)))return null;
    if(s.bombs===undefined)s.bombs=[];if(s.sandStore===undefined)s.sandStore=0;if(s.amuletUsed===undefined)s.amuletUsed=0;delete s.clockBank;if(!Number.isInteger(s.amuletUsed)||s.amuletUsed<0||s.amuletUsed>9)return null;if(!Number.isFinite(s.sandStore)||s.sandStore<0||s.sandStore>1000)return null;
    for(const e of s.enemies)if(e){for(const key of ['divine','divineTime','frostStacks','frostTime','rage','shield','ccImmune','frostLock','dawn','ultControl'])if(e[key]===undefined)e[key]=0;}
    // Frost stacks were retired by the stat renewal; an in-progress run drops them.
    for(const e of s.enemies)if(e){if(Array.isArray(e.statusEffects))e.statusEffects=e.statusEffects.filter(effect=>effect?.type!=='frost');e.frostStacks=0;e.frostTime=0;}
    if(!numeric(s,['gold','gauge','health','time','waveTime','spawnIn','breakTime','summons','paidSummons','freeSummons','trainingDiscount','globalAttack','surgeWave','waveTotal','tutorial','seed'])||s.gold<0||s.time<0||s.health<0||s.health>20||s.gaugeMax!==undefined&&(!Number.isInteger(s.gaugeMax)||s.gaugeMax<GAUGE_MAX||s.gaugeMax>GAUGE_MAX+400)||s.gauge<0||s.gauge>gaugeCap(s)||!Number.isInteger(s.wave)||s.wave<1||s.wave>1000||!Number.isInteger(s.rng)||s.rng<=0||s.rng>0xffffffff||!id(s.nextId))return null;
    if(s.freeSummons<0||s.freeSummons>3||!Number.isInteger(s.freeSummons)||s.paidSummons<0||!Number.isInteger(s.paidSummons)||s.trainingDiscount<0||s.trainingDiscount>.5||s.globalAttack<0||typeof s.phoenixUsed!=='boolean')return null;
    if(s.phoenixUses===undefined)s.phoenixUses=s.phoenixUsed?1:0;if(!Number.isInteger(s.phoenixUses)||s.phoenixUses<0||s.phoenixUses>9)return null;
    if(!['combat','intermission','reward','victory','defeat'].includes(s.phase)||!CHAPTERS[s.chapter])return null;
    // A run saved before critical hits has no `crit`; it stays that way (resumeBattle accepts it) and never rolls.
    if(s.critRevision!==undefined&&s.critRevision!==2)return null;
    if(s.crit!==undefined&&s.crit!==null&&!(numeric(s.crit,['chance','damage'])&&s.crit.chance>0&&s.crit.chance<=1&&s.crit.damage>=1&&s.crit.damage<=10))return null;
    if(!Number.isInteger(s.critRng)||s.critRng<=0)s.critRng=critSeed(s.seed);
    for(const u of s.board)if(u){
      if(u.hero==='miracle_larva'){if(u.form===undefined)u.form='miracle_larva';if(!Object.hasOwn(MIRACLE_FORMS,u.form))return null;}
      else if(u.form!==undefined)return null;
      // An old checkpoint cannot reveal its birth wave. Start its new age
      // effect here once, rather than inventing past waves or changing rank.
      if(u.birthWave===undefined)u.birthWave=s.wave;
      if(u.invincible===undefined)u.invincible=0;
      if(targetingLocked(u.hero)){
        if(!['first','boss','strong','last','random'].includes(u.priority))return null;
        u.priority='random';
      }
    }
    if(s.goldCharge!==null){
      const c=s.goldCharge;
      if(!record(c)||!id(c.source)||!numeric(c,['wave','started','ends'])||s.phase!=='combat'||c.wave!==s.wave||c.started<0||c.started>s.time||c.ends<=s.time||Math.abs(c.ends-c.started-GOLD_DRAGON.charge)>1e-8||!s.board.some(u=>u?.uid===c.source&&u.hero==='gold_dragon'))return null;
    }
    const latestBirthWave=s.wave+(['reward','intermission'].includes(s.phase)?1:0);
    if(s.board.some(u=>u&&(!s.deck.includes(u.hero)||!id(u.uid)||!Number.isInteger(u.rank)||u.rank<1||u.rank>MAX_RANK||!Number.isInteger(u.birthWave)||u.birthWave<1||u.birthWave>latestBirthWave||u.mergedWave!==undefined&&(!Number.isInteger(u.mergedWave)||u.mergedWave<1||u.mergedWave>latestBirthWave)||!numeric(u,['cooldown','windup','attacks','pose','born','harvest','disabled','invincible','aim','idleFor'])||u.invincible<0||u.invincible>10||u.clock!==undefined&&(!Number.isInteger(u.clock)||u.clock<0||u.clock>11)||!['down','up','left','right'].includes(u.facing)||!(targetingLocked(u.hero)?u.priority==='random':['first','boss','strong','last'].includes(u.priority)))))return null;
    if(s.tier===undefined)s.tier='easy';if(!TIERS[s.tier])return null;
    if(s.met===undefined)s.met=BOSS_ORDER.length;if(!Number.isInteger(s.met)||s.met<1||s.met>BOSS_ORDER.length)return null;
    if(s.timeRulerUid===undefined)s.timeRulerUid=null;
    // Time Ruler no longer has a solo bonus; its cached top unit only orders casts.
    if(s.timeRulerUid!==null&&!id(s.timeRulerUid))return null;
    if(!Number.isInteger(s.edictWave)||s.edictWave<0||s.edictWave>1000)return null;
    if(s.timeRulerUid!==null&&!s.board.some(u=>u?.hero==='time_ruler'&&u.uid===s.timeRulerUid))s.timeRulerUid=null;
    syncTimeRuler(s);
    if(s.enemies.length>1000||s.queue.length>2048||s.shots.length>1000||s.queue.some(k=>!kinds.includes(k?.kind)||!numeric(k,['hp'])||k.hp<=0))return null;
    if(s.enemies.some(e=>!id(e?.uid)||!kinds.includes(e.kind)||!numeric(e,['hp','maxHp','progress','speed','slow','slowTime','stun','burn','burnTime','poison','poisonTime','exposed','exposeTime','hit','skillIn','channel','channelHp','dotFlash'])||e.maxHp<=0||e.burn<0||e.exposed<0||!Number.isInteger(e.poison)||e.poison<0||!Number.isInteger(e.divine)||e.divine<0||e.divine>DIVINE_CAP||!Number.isInteger(e.frostStacks)||e.frostStacks<0||e.frostStacks>2||e.progress<0||e.progress>PATH_LENGTH||e.boss&&!BOSSES[e.boss]||e.burnOwner&&!HERO[e.burnOwner]))return null;
    const sourceValid=(effect,type,e)=>{
      if(typeof effect?.source!=='string'||!(effect.owner===null||HERO[effect.owner]))return false;
      if(effect.source===`legacy:${type}`)return type==='poison'?effect.owner==='mushroom_king':type==='burn'?!!HERO[effect.owner]:effect.owner===null;
      if(type==='slow'&&/^legacy:slow:(attack|skill):[a-z_]+$/.test(effect.source))return !!HERO[effect.source.split(':')[3]]&&effect.owner===effect.source.split(':')[3];
      const [kind,hero,rawUid,...extra]=effect.source.split(':'),uid=Number(rawUid);
      if(extra.length||!id(uid)||String(uid)!==rawUid||uid>=s.nextId)return false;
      if(kind==='interrupt')return type==='stun'&&effect.owner===null&&e.boss===hero&&e.uid===uid;
      if(kind==='spread')return type==='burn'&&!!HERO[hero]&&s.deck.includes(hero)&&effect.owner===hero;
      return ['attack','skill','zone','merge'].includes(kind)&&HERO[hero]&&s.deck.includes(hero)&&effect.owner===hero&&(kind!=='merge'||type==='poison'&&hero==='mushroom_king');
    };
    const deadlineValid=effect=>numeric(effect,['amount','until'])&&effect.until>=0&&effect.until<=s.time+30&&effect.amount>0;
    for(const e of s.enemies){
      if(legacyStatus){
        if(e.statusEffects===undefined)e.statusEffects=legacyStatuses(s,e);
        if(e.slowEffects===undefined)e.slowEffects=e.slowTime>0&&e.slow>0?[{source:'legacy',amount:e.slow,until:s.time+e.slowTime}]:[];
        if(!Array.isArray(e.slowEffects))return null;
        for(const effect of e.slowEffects){
          if(effect?.source==='legacy'){effect.source='legacy:slow';effect.owner=null;}
          else if(/^(attack|skill):[a-z_]+$/.test(effect?.source)){effect.owner=effect.source.split(':')[1];effect.source=`legacy:slow:${effect.source}`;}
        }
      }
      if(!Array.isArray(e.statusEffects)||e.statusEffects.length>2048||new Set(e.statusEffects.map(effect=>`${effect?.type}:${effect?.source}`)).size!==e.statusEffects.length)return null;
      if(e.statusEffects.some(effect=>!statusTypes.includes(effect?.type)||!sourceValid(effect,effect.type,e)||!deadlineValid(effect)||
        effect.type==='poison'&&(!Number.isInteger(effect.amount)||effect.amount>POISON_CAP||!numeric(effect,['power'])||effect.power<=0)||
        effect.type==='exposure'&&effect.amount>DAMAGE_TAKEN_CAP||
        ['stun','freeze'].includes(effect.type)&&effect.amount!==1||
        effect.type==='divine'&&(!Number.isInteger(effect.amount)||effect.amount>DIVINE_CAP)||effect.type!=='poison'&&effect.power!==undefined))return null;
      // Poison retains independently expiring suppressed sources. Its active
      // selection is capped at 40 at every integration segment, not on storage.
      for(const [type,cap] of [['divine',DIVINE_CAP]])if(e.statusEffects.filter(effect=>effect.type===type).reduce((sum,effect)=>sum+effect.amount,0)>cap)return null;
      if(!Array.isArray(e.slowEffects)||e.slowEffects.length>2048||new Set(e.slowEffects.map(effect=>effect?.source)).size!==e.slowEffects.length||e.slowEffects.some(effect=>!sourceValid(effect,'slow',e)||!deadlineValid(effect)||effect.amount>.8))return null;
      if(!legacyStatus&&(['poison','poisonTime','burn','burnTime','exposed','exposeTime','stun','divine','divineTime'].some(key=>e[key]<0)||!Number.isInteger(e.poison)||e.poison>POISON_CAP||e.exposed>DAMAGE_TAKEN_CAP))return null;
      syncStatuses(s,e);syncSlows(s,e);
    }
    for(const shot of s.shots)if(shot?.hero==='flame_sage'&&shot.ground===undefined){shot.ground=true;shot.target=null;}
    if(s.shots.some(e=>!id(e?.uid)||!(e.ground===true&&e.hero==='flame_sage'&&e.target===null||e.ground===undefined&&id(e.target))||!id(e.source)||!s.deck.includes(e.hero)||!numeric(e,['damage','rank','count','life','total'])||e.total<=0||!numeric(e.from,['x','y'])||!numeric(e.to,['x','y'])||!numeric(e.origin,['x','y'])))return null;
    if(s.shots.some(e=>e.ground&&(e.to.x<GROUND_BOUNDS.left||e.to.x>GROUND_BOUNDS.right||e.to.y<GROUND_BOUNDS.top||e.to.y>GROUND_BOUNDS.bottom)||((e.chainRatio!==undefined||e.extraChain!==undefined)&&!(e.hero==='lightning_sage'&&[.65,.7,.75,.8].includes(e.chainRatio)&&Number.isInteger(e.extraChain)&&e.extraChain>=0&&e.extraChain<=1))))return null;
    if(s.shots.some(e=>e.form!==undefined&&e.form!==null&&!(e.form==='trauma'&&e.hero==='time_magician'||e.hero==='miracle_larva'&&Object.hasOwn(MIRACLE_FORMS,e.form))||e.proc!==undefined&&typeof e.proc!=='boolean'))return null;
    function validCrit(c){return c===null||c===undefined||numeric(c,['chance','damage'])&&c.chance>=0&&c.chance<=1&&c.damage>=1&&c.damage<=11;}
    if([...s.shots,...s.finishers,...s.volleys,...s.zones,...s.bombs,...s.enemies.flatMap(e=>e.statusEffects)].some(e=>!validCrit(e.crit)))return null;
    if(s.shots.some(e=>e.delay!==undefined&&e.reflected!==true||e.reflected!==undefined&&(e.reflected!==true||e.hero!=='aurora'||e.proc!==false||!numeric(e,['delay'])||e.delay<0||e.delay>.42)))return null;
    if(!Array.isArray(s.finishers)||s.finishers.length>100||s.finishers.some(f=>!id(f?.uid)||!id(f.source)||!id(f.target)||!s.deck.includes(f.hero)||!(f.kind==='echo'||['royal','starfall','mirror'].includes(f.kind)&&HERO[f.hero]?.skill.type===f.kind)||!numeric(f,['damage','rank','life','total'])||f.damage<0||f.kind==='echo'&&!(f.damage>0)||f.total<=0||f.life<=0||f.life>f.total||!numeric(f.origin,['x','y'])||!numeric(f.to,['x','y'])||f.kind==='mirror'&&(!numeric(f,['stored'])||f.stored<0||f.cap!==undefined&&(!numeric(f,['cap'])||f.cap<0||f.stored>f.cap/.45+1e-6))))return null;
    if(s.enemies.some(e=>!numeric(e,['divine','divineTime','rage','shield'])||!Number.isInteger(e.divine)||e.divine<0||e.divine>3||e.shield<0||e.rage<0))return null;
    if(s.enemies.some(e=>!numeric(e,['frostStacks','frostTime','ccImmune','frostLock'])||!Number.isInteger(e.frostStacks)||e.frostStacks<0||e.frostStacks>2||e.frostTime<0||e.ccImmune<0||e.frostLock<0||e.ccImmune>s.time+30||e.frostLock>s.time+30||!Number.isFinite(e.dawn)||e.dawn<0||e.dawn>2||!Number.isFinite(e.ultControl)||e.ultControl<0||e.ultControl>s.time+30))return null;
    if(!Array.isArray(s.zones)||s.zones.length>ZONE_CAP||s.zones.some(z=>!id(z?.uid)||!id(z.source)||z.source>=s.nextId||!s.deck.includes(z.hero)||!numeric(z,['rank','damage','x','y','radius','life','total','tick'])||!Number.isInteger(z.rank)||z.rank<1||z.rank>MAX_RANK||z.damage<0||z.x<GROUND_BOUNDS.left||z.x>GROUND_BOUNDS.right||z.y<GROUND_BOUNDS.top||z.y>GROUND_BOUNDS.bottom||z.radius<=0||z.radius>720||z.total<=0||z.total>30||z.life<=0||z.life>z.total||z.tick<-.05||z.tick>.5+1e-9||typeof z.orbit!=='boolean'))return null;
    const echoOk=v=>v.echo===undefined||!!(v.echo&&typeof v.echo==='object'&&!Array.isArray(v.echo)&&Object.keys(v.echo).length<=200&&Object.entries(v.echo).every(([k,d])=>id(Number(k))&&Number.isFinite(d)&&d>=0));
    const dreamOk=v=>v.hero==='rumi'&&v.kind==='dream'&&Number.isInteger(v.phase)&&v.phase>=0&&v.phase<RUMI_DREAM.phases.length&&Number.isInteger(v.rank)&&v.rank>=RUMI_DREAM.rank&&v.rank<=MAX_RANK&&v.total<=3;
    // Pending pre-patch shocks already committed to their old radius; do not shrink them on resume.
    for(const v of s.volleys||[])if(v?.kind==='crush'&&v.radius===undefined)v.radius=150;
    const crushOk=v=>v.hero==='behemoth'&&v.kind==='crush'&&Number.isInteger(v.phase)&&v.phase>=0&&v.phase<CRUSH.hits&&Number.isInteger(v.rank)&&v.rank>=1&&v.rank<=MAX_RANK&&v.total<=CRUSH.first+2*CRUSH.gap+.01&&[150,...Array.from({length:6},(_,level)=>CRUSH.radius*(1+level*CRUSH.trainingRadius))].some(radius=>Number.isFinite(v.radius)&&Math.abs(radius-v.radius)<1e-8);
    const goldOk=v=>v.hero==='gold_dragon'&&s.deck.includes(v.hero)&&v.kind==='gold_breath'&&Number.isInteger(v.rank)&&v.rank>=1&&v.rank<=MAX_RANK&&v.total===GOLD_DRAGON.flight&&v.radius===GOLD_DRAGON.radius&&typeof v.opening==='boolean'&&numeric(v,['started'])&&v.started>=0&&v.started<=s.time&&Math.abs(v.life-(v.started+v.total-s.time))<1e-8&&numeric(v.origin,['x','y'])&&numeric(v.to,['x','y'])&&v.to.x>=0&&v.to.x<=720&&v.to.y>=0&&v.to.y<=780;
    if(!Array.isArray(s.volleys)||s.volleys.length>RUMI_DREAM.phases.length+CRUSH.hits*CRUSH.queue+1||s.volleys.filter(v=>v?.kind==='dream').length>RUMI_DREAM.phases.length||s.volleys.filter(v=>v?.kind==='gold_breath').length>1||s.volleys.some(v=>!id(v?.uid)||!id(v.source)||!numeric(v,['damage','life','total'])||v.damage<0||v.total<=0||v.life<=0||v.life>v.total||!echoOk(v)||!(dreamOk(v)||crushOk(v)||goldOk(v))))return null;
    if(!Array.isArray(s.bombs)||s.bombs.length>16||s.bombs.some(b=>!id(b?.uid)||!numeric(b,['progress','damage'])||b.progress<0||b.progress>PATH_LENGTH||b.damage<0))return null;
    const ids=[...s.board.filter(Boolean),...s.enemies,...s.shots,...s.finishers,...s.volleys,...s.zones,...s.bombs].map(o=>o.uid);
    if(new Set(ids).size!==ids.length||ids.some(n=>n>=s.nextId))return null;
    if(!Array.isArray(s.bag)||s.bag.length>6||new Set(s.bag).size!==s.bag.length||s.bag.some(h=>!s.deck.includes(h)))return null;
    if(!validArtifacts(s.artifacts)||!Array.isArray(s.reserves)||s.reserves.length>1000||s.reserves.some(h=>!s.deck.includes(h))||!Array.isArray(s.blessings)||s.blessings.length>1000||s.blessings.some(b=>!BLESSING[b]))return null;
    if(s.relicLevels===undefined)s.relicLevels={};
    if(!record(s.relicLevels)||Object.entries(s.relicLevels).some(([id,n])=>!s.artifacts.includes(id)||!Number.isInteger(n)||n<1||n>999))return null;
    if(!record(s.upgrades)||s.deck.some(h=>!Number.isInteger(s.upgrades[h])||s.upgrades[h]<0||s.upgrades[h]>5)||!record(s.buffs)||Object.values(s.buffs).some(n=>!Number.isFinite(n)))return null;
    if(!record(s.buffTotals)||Object.entries(s.buffTotals).some(([k,n])=>!Object.values(ACTIVE_SKILLS).includes(k)||!Number.isFinite(n)||n<0||n>60))return null;
    if(!record(s.buffScale)||Object.entries(s.buffScale).some(([k,n])=>!Object.values(ACTIVE_SKILLS).includes(k)||!Number.isFinite(n)||n<1||n>rankControl(MAX_RANK)+1e-9))return null;
    if(s.oaths===undefined)s.oaths=[];
    if(!Array.isArray(s.oaths)||oathConflict(s.oaths))return null;
    s.oathMods=oathMods(s.oaths);
    if(s.side===undefined)s.side=null;
    if(!(s.side===null||s.side==='left'||s.side==='right'))return null;
    if(s.lineup===undefined)s.lineup=null;
    if(!(s.lineup===null||Array.isArray(s.lineup)&&s.lineup.every(id=>typeof id==='string'&&BOSSES[id])))return null;
    if(s.stats&&s.stats.leaks===undefined)s.stats.leaks=s.health<coreHealthMax(s)?1:0;
    if(!numeric(s.stats,['kills','merges','summons','skills','damage'])||!Number.isInteger(s.stats.leaks)||s.stats.leaks<0||!record(s.stats.income)||!record(s.stats.byHero)||Object.values(s.stats.income).some(n=>!Number.isFinite(n))||Object.entries(s.stats.byHero).some(([h,n])=>!HERO[h]||!Number.isFinite(n)))return null;
    if(s.telegraph&&(!id(s.telegraph.uid)||!numeric(s.telegraph,['ends'])||!['seal','heal','drain','rush','storm','duel','creation','stun1','starlust','thunder','shuffle','warp','judgement'].includes(s.telegraph.pattern)||!Array.isArray(s.telegraph.cells)||s.telegraph.cells.some(n=>!Number.isInteger(n)||n<0||n>24)))return null;
    if(s.settlement){if(s.settlement.edict===undefined)s.settlement.edict=0;if(!numeric(s.settlement,['base','dividend','edict']))return null;}
    if(s.phase==='reward'&&(!Array.isArray(s.reward)||s.reward.length!==3||new Set(s.reward).size!==3||s.reward.some(a=>!BLESSING[a])))return null;
    if(s.balanceRevision!==undefined&&s.balanceRevision!==2&&s.balanceRevision!==BALANCE_REVISION)return null;
    if(s.balanceRevision===undefined){
      // Keep an in-progress v2 expedition and its boss HP ratio. Mark it so
      // repeated saves/resumes cannot apply the 20% reduction again.
      for(const e of s.enemies)if(e.kind==='boss'){
        const maxHp=Math.max(1,Math.round(e.maxHp*BOSS_HEALTH_SCALE)),ratio=maxHp/e.maxHp;
        e.maxHp=maxHp;e.hp*=ratio;e.channelHp*=ratio;
      }
      for(const e of s.queue)if(e.kind==='boss')e.hp=Math.max(1,Math.round(e.hp*BOSS_HEALTH_SCALE));
    }
    s.balanceRevision=BALANCE_REVISION;
    s.statusRevision=STATUS_REVISION;
    s.events=[];return s;
  }catch{return null;}
}

import { HERO, BLESSINGS, BLESSING, validArtifacts, BOSSES, BOSS_ORDER, CHAPTERS, DEFAULT_DECK, VERSION, GRID, MAX_RANK } from '../content.js';
import { TEAM_SIZE } from '../team-config.js';
// Forked from active Confluence at d4c32cf. Its geometry and authored attacks
// remain shared in meaning; Star Garden owns pacing and persistent growth.
export const MAIN_WAVES=6;
export const special=(s,id)=>(s.meta?.[id]?.special||1);

export const PATH = [[76,142],[644,142],[644,684],[76,684],[76,142]];
export const PATH_LENGTH = 2220;
export const BALANCE_REVISION = 3;
export const BOSS_HEALTH_SCALE = .8;
// Renewal v1 raised average roster damage by about 36%. Enemy health follows
// (base 76 → 100, stage slope 2.05 → 2.5, monthly 900 → 1225, weekly 25 → 34)
// so a no-growth starter deck keeps its stage 1–3 pace (docs/STAT_SIMULATION.md).
export const WAVE_BASE_HEALTH = 100;
export const ATTACK_WINDUP = .13;
export const GAUGE_MAX = 120;
export const FINISHER_DELAY = .3;
export const STATUS_REVISION=1;
export const POISON_CAP=40;
export const DIVINE_CAP=3;
export const DAMAGE_TAKEN_CAP=.8;
// Merge growth (docs/STAT_RENEWAL.md §2): attack ×2.35 per rank, support
// values +20% per rank, control seconds and skill buff values +10% per rank.
export const rankSupport=rank=>1+.2*(rank-1);
export const rankControl=rank=>1+.1*(rank-1);
export const TRAINING_STEP=.25;
// Divine marks feed starlight when the marked enemy falls (per remaining stack).
export const DIVINE_GAUGE=.5,DIVINE_BOSS_GAUGE=3;
// Bosses take half control and push, then resist new control briefly.
export const BOSS_CONTROL_SCALE=.5,BOSS_CONTROL_IMMUNITY=2,BOSS_PUSH_SCALE=.5;
export const FROST_RELOCK=3;
export const ZONE_CAP=75;
// One poison stack deals 1.5 per second for an 11-power caster (renewal v1).
export const POISON_POWER_RATIO=1.5/11;
// Independent ground fields retain their authored ticks. A small cadence
// correction limits the increase from replacing refreshes with overlapping hits.
export const ZONE_CADENCE=1.15;
export const zoneCadence=id=>HERO[id]?.shape==='zone'&&id!=='flame_sage'?ZONE_CADENCE:1;
export const ACTIVE_SKILLS=Object.freeze({rumi:'echo',siren:'haste',ancient_dragon:'awaken',silver_rabbit:'march',santa:'festive',jasmine:'radiance',time_magician:'trauma',harmonious:'harmony',queen:'tax',cinderella:'midnight',frost_witch:'winter'});
const buffScale=(s,key)=>s.buffScale?.[key]||1;
export function activeSkill(s,id){const key=ACTIVE_SKILLS[id],remaining=s.buffs[key]||0;return remaining>0?{key,remaining,total:Math.max(remaining,s.buffTotals?.[key]||remaining)}:null;}
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
function shuffle(s,values){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function validDeck(deck){return Array.isArray(deck)&&deck.length===TEAM_SIZE&&new Set(deck).size===TEAM_SIZE&&deck.every(id=>HERO[id]);}
export function event(s,type,data={}){s.events.push({type,time:s.time,...data});if(s.events.length>200)s.events.shift();}
export function has(s,id){return s.artifacts.includes(id);}
export function summonCost(s){return s.freeSummons>0?0:Math.max(8,10+s.paidSummons*2-(has(s,'feather')?4:0));}
// Doom's merge refund is flat per material rank, so merging never waits on training.
export const DOOM_REFUND=50;
export const doomRefund=rank=>DOOM_REFUND*rank;
export const waveIncome=wave=>48+Math.floor(wave);
export const skillDuration=(s,seconds)=>seconds+(has(s,'broken_clock')?2:0);
export const unitForm=(s,u)=>u.hero==='time_magician'&&s.buffs.trauma>0?'trauma':null;
export function highestMaxHp(s){return s.enemies.filter(e=>e.hp>0).reduce((a,b)=>!a||b.maxHp>a.maxHp||b.maxHp===a.maxHp&&b.uid<a.uid?b:a,null);}
export const queenIncome=(rank,wave,level=0)=>6+rank*6+Math.floor((wave-1)/3)+level*3;
export const QUEEN_CAP=90;
export const QUEEN_TAX=40;
// Doom's black market: 10x, +1x for every 20 gold left after paying, up to 15x.
export const fortuneFactor=(goldAfter,level=0)=>12+level+Math.min(5,Math.floor(Math.max(0,goldAfter)/20));
export const executeThreshold=e=>e.boss ? .4 : .35;
export function dividend(s){return Math.min(QUEEN_CAP,s.board.reduce((n,u)=>n+(u?.hero==='queen'?queenIncome(u.rank,s.wave,s.upgrades.queen):0),0));}
export function upgradeCost(s,id){return Math.ceil((28+(s.upgrades[id]||0)*24)*(1-s.trainingDiscount));}
export function neighbors(index){const x=index%5,y=Math.floor(index/5);return [x>0?index-1:-1,x<4?index+1:-1,y>0?index-5:-1,y<4?index+5:-1].filter(i=>i>=0);}
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
export function personalTrait(s,u,index=s.board.indexOf(u)){
  const trait={damageMultiplier:1,speedBonus:0,chainRatio:.65,extraChain:0,key:null,active:false,label:''};
  if(u.hero==='lightning_sage'){
    const seen=new Set(),pending=index>=0&&s.board[index]?.uid===u.uid?[index]:[];
    while(pending.length){const cell=pending.pop();if(seen.has(cell)||s.board[cell]?.hero!=='lightning_sage')continue;seen.add(cell);for(const n of neighbors(cell))if(!seen.has(n)&&s.board[n]?.hero==='lightning_sage')pending.push(n);}
    const size=seen.size;Object.assign(trait,{key:'lightning',size,active:size>=2,label:size>=2?`번개 연결 ${size}기 · 위력 +${size===2?10:size===3?18:30}%`:'번개 연결 대기'});
    if(size>=2){trait.damageMultiplier=size===2?1.10:size===3?1.18:1.30;trait.chainRatio=size===2?.70:size===3?.75:.80;trait.extraChain=size>=4?1:0;}
  }else if(u.hero==='star_boy'||u.hero==='time_ruler'){
    const age=Math.max(0,s.wave-(u.birthWave??s.wave)),star=u.hero==='star_boy';
    trait.damageMultiplier=star?(age===0?1.5:age===1?1:.75):(age===0?.75:age===1?1:1.25);
    Object.assign(trait,{key:'wave-age',age,active:age!==1,label:`${star?'별의 주기':'시간의 흐름'} · ${age===0?'등장':age===1?'다음':'이후'} 웨이브 ${Math.round(trait.damageMultiplier*100)}%`});
  }else if(u.hero==='aurora'){
    const count=s.board.filter(unit=>unit?.hero==='aurora').length,active=count>=2&&count%2===0;
    Object.assign(trait,{key:'even-formation',count,active,damageMultiplier:active?1.5:1,label:active?`아우로라 ${count}기 · 위력 +50%`:`아우로라 ${count}기 · 짝수 보너스 대기`});
  }else if(u.hero==='cinderella'){
    const top=topCinderella(s),active=top?.uid===u.uid,clock=u.clock||0,step=s.buffs.midnight>0?3:1;
    Object.assign(trait,{key:'cinderella',uid:top?.uid??null,active,clock,damageMultiplier:active?CINDERELLA.top:1,label:active?`진짜 신데렐라 · 위력 +50% · 자정의 종까지 ${Math.ceil((12-clock)/step)}회`:`진짜 신데렐라 ${top?.rank??''}성이 따로 있어요`});
  }else if(u.hero==='zeke'){
    const active=s.enemies.some(e=>e.hp>0&&e.progress>=PATH_LENGTH*.75);
    Object.assign(trait,{key:'last-quarter',active,speedBonus:active?.4:0,label:active?'마지막 구간 · 공속 +40%':'마지막 구간 대기'});
  }else if(u.hero==='flame_sage')Object.assign(trait,{key:'wildfire',active:true,zoneDamageMultiplier:1.3,zoneRadiusMultiplier:1.3,zoneDurationMultiplier:1.3,label:'경로 위 무작위 · 화염장 +30%'});
  else if(u.hero==='avalanche_maid')Object.assign(trait,{key:'random-target',active:true,label:'무작위 표적 고정 · 기본 위력 +50%'});
  else if(u.hero==='storm_sage')Object.assign(trait,{key:'storm-execute',active:true,label:'일반 적 명중마다 즉사 1%'});
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
  if(!(s.buffs.harmony>0))return {count:0,damage:0,speed:0};
  const count=new Set(s.board.filter(u=>u&&u.hero!=='harmonious').map(u=>u.hero)).size,level=s.upgrades.harmonious||0,scale=special(s,'harmonious')*buffScale(s,'harmony');
  return {count,damage:count*(.06+level*.005)*scale,speed:count*(.05+level*.002)*scale};
}
export function bestUnit(s,id){return id==='time_ruler'?syncTimeRuler(s):id==='cinderella'?topCinderella(s)||undefined:s.board.filter(u=>u?.hero===id&&!u.cursed).sort((a,b)=>b.rank-a.rank)[0];}
export function power(s,u){return HERO[u.hero].damage*Math.pow(2.35,u.rank-1)*(1+(s.upgrades[u.hero]||0)*TRAINING_STEP)*(s.meta?.[u.hero]?.power||1)*(1+(s.relicAttack||0))*(1+s.globalAttack)*(s.surgeWave===s.wave?1.25:1)*personalTrait(s,u).damageMultiplier;}
export function trainingBonus(id,level){
  if(id==='frost_witch')return `감속 대상 빙결 ${(.6+level*.06).toFixed(2)}초 · 보스 절반`;
  if(id==='harmonious')return `조화 1종당 위력 +${6+level*.5}% · 공속 +${Number((5+level*.2).toFixed(1))}%`;
  if(id==='aurora')return `환영탄 위력 ${75+level*3}%`;
  const extra={doom:`필살기 기본 ${12+level}배`,queen:`1성 · 1~3물결 배당 ${queenIncome(1,1,level)}G / 기`,siren:`인접 공속 +${15+level*3}%`,ancient_dragon:`인접 공격 +${20+level*3}%`,snow_rabbit:`감속 ${40+level*3}%`,guardian:`세 번째 공격 기절 ${(.7+level*.05).toFixed(2)}초`,great_detective:`일반 노출 +${10+level*2}% · 보스 +${18+level*2}%`,time_ruler:`장판 감속 ${25+level*3}%`,santa:`선물 폭탄 위력 ${200+level*20}%`,time_magician:`인접 추가 공격 위력 ${60+level*5}%`};
  return extra[id]||'';
}
// Base-power comparison excludes rank, relics and temporary buffs; it never
// claims a compounding +25% increase over the previous upgrade.
export const trainingPower=(id,level)=>Number((HERO[id].damage*(1+level*TRAINING_STEP)).toFixed(2));
export function unitEconomy(s,u){
  const level=s.upgrades[u.hero]||0;
  if(u.hero==='doom')return `합성 시 ${doomRefund(u.rank)}G 즉시 환급`;
  if(u.hero==='queen')return `이번 물결 종료 시 ${queenIncome(u.rank,s.wave,level)}G 배당 · 모든 여왕 합계 최대 ${QUEEN_CAP}G`;
  return HERO[u.hero].trait.text;
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
  e.exposed=0;e.exposeTime=0;e.burn=0;e.burnTime=0;e.burnOwner=null;
  e.poison=0;e.poisonTime=0;e.divine=0;e.divineTime=0;e.frostStacks=0;e.frostTime=0;e.stun=0;e.freeze=0;
  for(const effect of e.statusEffects){
    const remaining=effect.until-at;
    if(effect.type==='exposure'){
      if(effect.amount>e.exposed){e.exposed=effect.amount;e.exposeTime=remaining;}
      else if(effect.amount===e.exposed)e.exposeTime=Math.max(e.exposeTime,remaining);
    }else if(effect.type==='burn'){
      if(effect.amount>e.burn||effect.amount===e.burn&&remaining>e.burnTime){e.burn=effect.amount;e.burnTime=remaining;e.burnOwner=effect.owner;}
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
export function statusState(s,e){syncStatuses(s,e);syncSlows(s,e);return {exposure:e.exposed,divine:e.divine,damageTakenBonus:e.takenBonus,burn:e.burn,burnOwner:e.burnOwner,poison:e.poison,poisonDps:activePoison(e).reduce((dps,{effect,stacks})=>dps+stacks*effect.power*POISON_POWER_RATIO,0),stun:e.stun,freeze:e.freeze,controlTime:e.controlTime,slow:e.slow};}
function capStacks(e,type,cap){
  const effects=e.statusEffects.filter(effect=>effect.type===type).sort((a,b)=>b.until-a.until||a.source.localeCompare(b.source));
  let remaining=cap;
  for(const effect of effects){effect.amount=Math.min(remaining,effect.amount);remaining-=effect.amount;}
  e.statusEffects=e.statusEffects.filter(effect=>effect.amount>0);
}
function addStatus(s,e,type,source,owner,amount,duration,power){
  if(e.hp<=0||amount<=0||duration<=0)return;
  if(e.boss&&BOSSES[e.boss]?.immune===type)return;
  syncStatuses(s,e);
  const existing=e.statusEffects.find(effect=>effect.type===type&&effect.source===source),until=s.time+duration;
  if(existing){existing.amount=['poison','divine'].includes(type)?existing.amount+amount:amount;if(type==='poison')existing.amount=Math.min(POISON_CAP,existing.amount);existing.until=until;if(power!==undefined)existing.power=power;}
  else e.statusEffects.push({type,source,owner,amount:type==='poison'?Math.min(POISON_CAP,amount):amount,until,...(power===undefined?{}:{power})});
  if(type==='divine')capStacks(e,type,DIVINE_CAP);
  syncStatuses(s,e);
}
function addPoison(s,e,source,owner,stacks,duration,attackPower){addStatus(s,e,'poison',source,owner,stacks+(has(s,'seed')?1:0),duration,attackPower);}
function addControl(s,e,type,source,owner,duration){
  if(e.boss&&!source.startsWith('interrupt:')){
    if((e.ccImmune||0)-s.time>1e-9)return;
    duration*=BOSS_CONTROL_SCALE;e.ccImmune=s.time+duration+BOSS_CONTROL_IMMUNITY;
  }
  addStatus(s,e,type,source,owner,1,duration);
}
function pushBack(e,distance){e.progress=Math.max(0,e.progress-distance*(e.boss?BOSS_PUSH_SCALE:1));}
function makeUnit(s,hero,rank=1){return {uid:s.nextId++,hero,rank,cooldown:.25,windup:0,target:null,attacks:0,pose:0,born:s.time,birthWave:s.wave+(['reward','intermission'].includes(s.phase)?1:0),harvest:12,disabled:0,facing:'down',aim:Math.PI/2,idleFor:0,priority:targetingLocked(hero)?'random':HERO[hero].bossDamage||HERO[hero].bossPriority?'boss':'first'};}
function freeCell(s){const order=[17,12,16,18,11,13,7,6,8,21,23,2,10,14,20,24,1,3,5,9,15,19,0,4,22];return order.find(i=>!s.board[i])??-1;}
function place(s,id,rank=1,index=-1){const slot=Number.isInteger(index)&&index>=0&&index<25&&!s.board[index]?index:freeCell(s);if(slot<0)return -1;s.board[slot]=makeUnit(s,id,rank);syncTimeRuler(s);event(s,'summon',{index:slot,hero:id,rank});return slot;}

export function newRun({deck=DEFAULT_DECK,chapter=0,seed=Date.now(),artifacts=[],meta={},relicAttack=0,mode='main',boon=0,gaugeMax=GAUGE_MAX,startGold=0}={}){
  const chosen=validDeck(deck)?[...deck]:DEFAULT_DECK.slice(0,TEAM_SIZE);
  const s={version:VERSION,balanceRevision:BALANCE_REVISION,statusRevision:STATUS_REVISION,seed:seed>>>0,rng:(seed>>>0)||1,deck:chosen,chapter:clamp(chapter|0,0,CHAPTERS.length-1),phase:'combat',wave:1,time:0,waveTime:0,
    board:Array(25).fill(null),enemies:[],shots:[],finishers:[],zones:[],events:[],gold:70+Math.max(0,startGold|0),gauge:90,gaugeMax:Math.max(GAUGE_MAX,gaugeMax|0),health:20,summons:0,paidSummons:0,freeSummons:3,nextId:1,bag:[],artifacts:validArtifacts(artifacts)?[...artifacts]:[],upgrades:Object.fromEntries(chosen.map(x=>[x,0])),meta,relicAttack,mode,boon,
    buffs:{},buffTotals:{},buffScale:{},queue:[],spawnIn:0,breakTime:0,reward:null,endless:false,telegraph:null,settlement:null,trainingDiscount:0,globalAttack:0,surgeWave:0,phoenixUsed:false,reserves:[],blessings:[],waveTotal:0,timeRulerUid:null,
    stats:{kills:0,merges:0,summons:0,skills:0,damage:0,income:{},byHero:{}},tutorial:0,won:false};
  const opening=shuffle(s,chosen).slice(0,3);
  const openingCells=TEAM_SIZE===1?[12]:[7,16,18];
  for(const [i,hero] of opening.entries())place(s,hero,1,openingCells[i]);
  beginWave(s,1);return s;
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
  const rank=paid&&has(s,'gift_ribbon')&&s.paidSummons%4===0?2:1,id=drawHero(s),index=place(s,id,rank,preferred);
  s.tutorial=Math.max(s.tutorial,1);return {ok:true,index,hero:id,rank};
}
export function canMerge(a,b){return !!a&&!!b&&a.uid!==b.uid&&a.rank===b.rank&&a.rank<MAX_RANK&&(a.hero===b.hero||a.hero==='rumi'||b.hero==='rumi');}
export function move(s,from,to){
  if(!['combat','intermission'].includes(s.phase)||from===to||!s.board[from]||to<0||to>24)return {ok:false};
  const a=s.board[from],b=s.board[to];
  if(canMerge(a,b)){
    const id=b.hero==='rumi'?a.hero:b.hero,rank=b.rank+1;
    const refund=HERO[id].trait.type==='sacrifice'?doomRefund(a.rank):0;
    if(refund)giveGold(s,refund,'합성 환급');
    const unit=makeUnit(s,id,rank);unit.priority=targetingLocked(id)?'random':(b.hero==='rumi'?a:b).priority;unit.cooldown=.06;s.board[to]=unit;s.board[from]=null;syncTimeRuler(s);
    if(a.hero==='mushroom_king'||b.hero==='mushroom_king')for(const e of s.enemies)addPoison(s,e,sourceKey('merge',id,unit.uid),id,2,8,power(s,unit));
    if(has(s,'alchemy'))for(const e of s.enemies)damage(s,e,power(s,unit)*1.5,id);
    s.stats.merges++;addGauge(s,12+(has(s,'hourglass')?8:0));s.tutorial=Math.max(s.tutorial,2);
    event(s,'merge',{from,to,hero:id,rank,refund});return {ok:true,merged:true,index:to,refund};
  }
  s.board[to]=a;s.board[from]=b;syncTimeRuler(s);event(s,'move',{from,to});return {ok:true,index:to};
}
export function sell(s,index){
  const u=s.board[index];if(!u||!['combat','intermission'].includes(s.phase))return {ok:false};
  if(s.board.filter(Boolean).length<=1)return {ok:false,reason:'마지막 영웅은 회수할 수 없습니다.'};
  const gold=Math.round(6*Math.pow(1.7,u.rank-1));s.board[index]=null;syncTimeRuler(s);giveGold(s,gold,'회수');event(s,'sell',{index,gold});return {ok:true,gold};
}
export function upgrade(s,id){
  if(!s.deck.includes(id)||!['combat','intermission'].includes(s.phase))return {ok:false};
  if(s.upgrades[id]>=5)return {ok:false,reason:'훈련을 모두 마쳤습니다.'};
  const cost=upgradeCost(s,id);if(s.gold<cost)return {ok:false,reason:`골드가 부족합니다. (${cost} 필요)`};
  s.gold-=cost;s.upgrades[id]++;event(s,'upgrade',{hero:id,level:s.upgrades[id]});return {ok:true};
}
export function cycleTarget(s,index){const u=s.board[index];if(!u||targetingLocked(u.hero))return;const values=['first','boss','strong','last'];u.priority=values[(values.indexOf(u.priority)+1)%values.length];}

// Armour carries 1.4× health instead of a hidden 28% damage reduction.
const enemyWeight={grunt:1,armor:3.5,runner:.65,wisp:.9,boss:32};
const enemyKind=(i,wave)=>i%7===6&&wave>=3?'armor':i%5===4&&wave>=2?'runner':i%9===8&&wave>=5?'wisp':'grunt';
export function wavePlan(wave,chapter=0,mode='main'){
  if(mode==='monthly'){
    // Monthly bosses walk the path: no round timer, so each round steps up 2× to keep runs short.
    const hp=Math.round(1225*Math.pow(2,wave-1));
    return {sequence:[{kind:'boss',hp}],interval:.65,healthBudget:hp};
  }
  if(mode==='weekly'){
    const hp=Math.round(34*Math.pow(1.85,wave-1)),sequence=Array.from({length:9},(_,i)=>({kind:enemyKind(i,wave),hp:enemyKind(i,wave)==='armor'?Math.round(hp*1.4):hp}));
    if(wave%3===0)sequence.push({kind:'boss',hp:hp*16});return {sequence,interval:.5,healthBudget:sequence.reduce((n,e)=>n+e.hp,0)};
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
function beginWave(s,wave){
  s.phase='combat';s.wave=wave;s.waveTime=0;s.spawnIn=wave===1?.65:.4;s.settlement=null;s.telegraph=null;s.zones=[];
  s.queue=wavePlan(wave,s.chapter,s.mode).sequence;s.waveTotal=s.queue.length;
  if(s.queue.some(e=>e.kind==='boss'))event(s,'bossApproach',{wave});event(s,'wave',{wave});
}
function spawnEnemy(s,{kind,hp}){
  const wave=s.wave,chapter=CHAPTERS[s.chapter];
  const isBoss=kind==='boss',bossId=isBoss?(s.mode==='monthly'?BOSS_ORDER[(wave-1)%BOSS_ORDER.length]:chapter.bosses[0]):null;
  const e={uid:s.nextId++,kind,boss:bossId,hp,maxHp:hp,progress:0,speed:isBoss?34:kind==='runner'?82:kind==='armor'?39:kind==='wisp'?67:49,
    slow:0,slowTime:0,slowEffects:[],statusEffects:[],stun:0,freeze:0,controlTime:0,burn:0,burnTime:0,burnOwner:null,poison:0,poisonTime:0,exposed:0,exposeTime:0,takenBonus:0,hit:0,skillIn:7.5,channel:0,channelHp:0,dotFlash:0,divine:0,divineTime:0,frostStacks:0,frostTime:0,rage:0,shield:0,ccImmune:0,frostLock:0};
  e.speed*=1.1;s.enemies.push(e);if(isBoss)event(s,'boss',{id:bossId,name:BOSSES[bossId].name});return e;
}
export function attackGeometry(hero,from,to){return {kind:hero.shape,from,to,range:hero.range,radius:hero.radius,angle:Math.atan2(to.y-from.y,to.x-from.x)};}
export function geometryContains(g,p){
  const dx=p.x-g.from.x,dy=p.y-g.from.y,d=Math.hypot(dx,dy),forward=dx*Math.cos(g.angle)+dy*Math.sin(g.angle),side=-dx*Math.sin(g.angle)+dy*Math.cos(g.angle);
  if(g.kind==='cross')return d<=g.range&&Math.min(Math.abs(dx),Math.abs(dy))<=g.radius/2;
  if(g.kind==='beam')return forward>=0&&forward<=g.range&&Math.abs(side)<=g.radius/2;
  if(g.kind==='cleave')return d<=g.range&&forward>=0&&Math.abs(side)<=forward;
  if(g.kind==='pulse')return d<=g.range;
  return Math.hypot(p.x-g.to.x,p.y-g.to.y)<=g.radius;
}
function canTarget(hero,at,p){return Math.hypot(p.x-at.x,p.y-at.y)<=hero.range&&(hero.shape!=='cross'||geometryContains(attackGeometry(hero,at,p),p));}
function chooseTarget(s,u,randomTarget=true){
  const at=cellPoint(s.board.indexOf(u));
  if(u.hero==='flame_sage')return s.enemies.find(e=>e.hp>0)||null;
  const enemies=s.enemies.filter(e=>e.hp>0&&canTarget(HERO[u.hero],at,pathPoint(e.progress)));if(!enemies.length)return null;
  if(u.hero==='avalanche_maid')return enemies[randomTarget?Math.floor(random(s)*enemies.length):0];
  const bosses=u.priority==='boss'?enemies.filter(e=>e.boss):[],pool=bosses.length?bosses:enemies;
  const priority=u.priority==='boss'?(u.hero==='great_detective'?'strong':'first'):u.priority;
  return pool.reduce((a,b)=>priority==='strong'?(a.hp>b.hp?a:b):priority==='last'?(a.progress<b.progress?a:b):(a.progress>b.progress?a:b));
}
function damage(s,e,value,hero,{dot=false,recordMirror=true,instant=false,statusAt=s.time,gift=false,basic=false,dotType=null}={}){
  if(!e||e.hp<=0)return 0;
  syncStatuses(s,e,statusAt);syncSlows(s,e,statusAt);
  const passive=e.boss?BOSSES[e.boss]:null;
  let amount=instant?e.hp+(e.shield||0):value*(1+e.takenBonus*(passive?.exposeScale||1))*(passive?.dotScale?.[dotType]||1)*(basic?passive?.basicScale||1:1)*(e.boss?(HERO[hero]?.bossDamage||1):1)*(e.boss&&has(s,'lens')?1.3:1)*(e.slowTime>0&&has(s,'frost')?1.25:1);
  if(!instant){
    if(has(s,'royal_seal')&&highestMaxHp(s)?.uid===e.uid)amount*=1.25;
    if(e.rage>0&&!dot)amount*=.75;
  }
  const absorbed=Math.min(e.shield||0,amount);e.shield=Math.max(0,(e.shield||0)-absorbed);
  const actual=Math.min(e.hp,amount-absorbed)+absorbed;e.hp-=amount-absorbed;e.hit=.13;s.stats.damage+=actual;s.stats.byHero[hero]=(s.stats.byHero[hero]||0)+actual;
  // No mirror detonation can feed another recording, even when several marks
  // resolve in this frame. Ordinary resolved damage includes shield absorption.
  if(recordMirror)for(const f of s.finishers||[])if(f.kind==='mirror'&&f.target===e.uid&&f.life>0)f.stored=f.cap!==undefined?Math.min(f.cap/.45,f.stored+actual):f.stored+actual;
  if(!dot&&!instant)event(s,'hit',{uid:e.uid,...pathPoint(e.progress),damage:Math.round(amount),hero,big:amount>100||!!e.boss});
  if(e.hp<=0){
    s.stats.kills++;const gold=e.boss?20:e.kind==='armor'?3:2;giveGold(s,gold,'격파');
    if(s.buffs.tax>0)giveGold(s,gold*2,'장미의 세금');
    if(gift)giveGold(s,1,'선물');
    addGauge(s,(e.boss?15:1.3)+e.divine*(e.boss?DIVINE_BOSS_GAUGE:DIVINE_GAUGE));
    // A frozen enemy that falls spreads the witch's cold; Winter Court freezes nearby foes.
    if(e.freeze>0&&s.board.some(u=>u?.hero==='frost_witch'))for(const t of around(s,e,90))addSlow(s,t,sourceKey('attack','frost_witch',e.uid),.4,2);
    if(s.buffs.winter>0)for(const t of around(s,e,120))if(!t.boss)addControl(s,t,'freeze',sourceKey('skill','frost_witch',e.uid),'frost_witch',.8*buffScale(s,'winter'));
    event(s,'kill',{...pathPoint(e.progress),kind:e.kind,boss:e.boss,color:HERO[hero]?.color,divine:e.divine});
  }
  return actual;
}
function normalHit(s,e,value,shot,options={},seen){
  if(shot.hero==='storm_sage'&&shot.proc!==false&&e.hp>0&&!e.boss&&e.kind!=='boss'&&!seen.has(e.uid)){
    seen.add(e.uid);
    if(random(s)<.01){
      const shieldDamage=e.shield||0,actual=damage(s,e,0,shot.hero,{instant:true});
      event(s,'instantKill',{uid:e.uid,hero:shot.hero,...pathPoint(e.progress),damage:actual,shieldDamage});return actual;
    }
  }
  return damage(s,e,value,shot.hero,{...options,basic:true});
}
function around(s,e,radius){const p=pathPoint(e.progress);return s.enemies.filter(x=>x.hp>0&&Math.hypot(pathPoint(x.progress).x-p.x,pathPoint(x.progress).y-p.y)<=radius);}
function makeZone(s,shot,p,orbit=false){
  const h=HERO[shot.hero],flame=shot.hero==='flame_sage'&&!orbit,boost=flame?1.3:1;
  const life=orbit?2:3*boost*(has(s,'roots')?1.5:1),radius=orbit?60:h.radius*boost,zoneDamage=shot.damage*boost;
  s.zones.push({uid:s.nextId++,source:shot.source,hero:shot.hero,rank:shot.rank,damage:zoneDamage,x:p.x,y:p.y,radius,life,total:life,tick:0,orbit});
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
  const level=s.upgrades[hero.id]||0,base=hero.trait.type==='chrono'?.25+level*.03:hero.id==='phantom'?.25:hero.id==='snow_rabbit'?.4+level*.03:.4,slow=base*rankSupport(rank);
  for(const t of targets)addSlow(s,t,source,slow,2.4);
  if(targets.length&&has(s,'tide')){for(const t of s.enemies)if(t.hp>0&&Math.hypot(pathPoint(t.progress).x-point.x,pathPoint(t.progress).y-point.y)<=80)damage(s,t,amount*.25,hero.id);event(s,'tide',{...point});}
}
function applyHit(s,shot){
  if(shot.ground){
    const point=shot.to,hero=HERO[shot.hero];makeZone(s,shot,point);
    if(has(s,'orbit')&&shot.rank>=3)makeZone(s,shot,point,true);
    if(has(s,'meteor')&&shot.count%12===0){for(const target of s.enemies)if(target.hp>0&&Math.hypot(pathPoint(target.progress).x-point.x,pathPoint(target.progress).y-point.y)<=100)damage(s,target,shot.damage*1.8,shot.hero);event(s,'meteor',{...point,color:'#f6c888'});}
    event(s,'impact',{...point,hero:shot.hero,form:shot.form,angle:Math.atan2(point.y-shot.origin.y,point.x-shot.origin.x),rank:shot.rank,shape:hero.shape,origin:shot.origin,ground:true});return;
  }
  const e=s.enemies.find(x=>x.uid===shot.target&&x.hp>0);if(!e)return;
  if(shot.reflected){const p=pathPoint(e.progress);damage(s,e,shot.damage,shot.hero,{basic:true});if(e.hp>0)addStatus(s,e,'divine',sourceKey('attack',shot.hero,shot.uid),shot.hero,1,6);event(s,'impact',{...p,hero:shot.hero,rank:shot.rank,angle:Math.atan2(p.y-shot.from.y,p.x-shot.from.x),reflected:true});return;}
  const hero=HERO[shot.hero],type=hero.trait.type,point=pathPoint(e.progress),amount=shot.damage,procTargets=new Set();
  const geometry={...attackGeometry(hero,shot.origin,point),...(shot.gift?{radius:hero.radius*2}:{})};
  const area=['cleave','pulse','beam','cross','splash'].includes(hero.shape)?s.enemies.filter(t=>t.hp>0&&geometryContains(geometry,pathPoint(t.progress))):shot.bell?[e,...around(s,e,CINDERELLA.radius).filter(t=>t.uid!==e.uid)]:[e];
  const divineMark=type==='divine'||type==='battery'||s.buffs.march>0&&shot.proc!==false;
  for(const target of area){
    syncStatuses(s,target);syncSlows(s,target);
    let factor=1;
    if(type==='execute'&&target.hp/target.maxHp<=executeThreshold(target))factor*=2;
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
  event(s,'impact',{...point,hero:hero.id,form:shot.form,angle:geometry.angle,rank:shot.rank,shape:hero.shape,origin:shot.origin});
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
    const others=around(s,e,type==='gust'?180:hero.radius).filter(x=>x.uid!==e.uid).sort((a,b)=>Math.abs(a.progress-e.progress)-Math.abs(b.progress-e.progress)).slice(0,(type==='chain'?2:1)+(has(s,'prism')?1:0)+extra);
    let from=point;for(const target of others){normalHit(s,target,amount*ratio,shot,{},procTargets);const to=pathPoint(target.progress);event(s,'chain',{from,to,color:hero.color,hero:hero.id});from=to;}
  }
  if(type==='burn')for(const t of area)addStatus(s,t,'burn',sourceKey('attack',hero.id,shot.uid),hero.id,amount*.23,3);
  if(['slow','chrono','gravity','permafrost'].includes(type))slowTargets(s,area,hero,amount,point,sourceKey('attack',hero.id,shot.uid),shot.rank);
  if(type==='poison')addPoison(s,e,sourceKey('attack',hero.id,shot.uid),hero.id,1,7,amount);
  if(type==='stun'&&shot.count%3===0)for(const t of area)addControl(s,t,'stun',sourceKey('attack',hero.id,shot.uid),hero.id,(.7+(s.upgrades[hero.id]||0)*.05)*special(s,hero.id)*rankControl(shot.rank));
  if(type==='fear'&&shot.count%3===0)pushBack(e,35);
  if(type==='expose'){
    const exposure=((e.boss ? .18 : .1)+s.upgrades[hero.id]*.02)*special(s,hero.id)*rankControl(shot.rank);
    addStatus(s,e,'exposure',sourceKey('attack',hero.id,shot.uid),hero.id,Math.min(DAMAGE_TAKEN_CAP,exposure),4);
  }
  if(hero.shape==='zone')makeZone(s,shot,point);
  if(has(s,'orbit')&&shot.rank>=3)makeZone(s,shot,point,true);
  if(has(s,'meteor')&&shot.count%12===0){for(const t of around(s,e,100))damage(s,t,amount*1.8,hero.id);event(s,'meteor',{...pathPoint(e.progress),color:'#f6c888'});}
}
// extra>0 fires one additional shot at that power ratio without advancing
// the unit's attack count (Time Magician); it never triggers further procs.
function attack(s,u,index,extra=0){
  const hero=HERO[u.hero],ground=u.hero==='flame_sage';
  if(ground&&!s.enemies.some(e=>e.hp>0))return false;
  let e=ground?null:u.hero==='avalanche_maid'?chooseTarget(s,u):s.enemies.find(x=>x.uid===u.target&&x.hp>0&&canTarget(hero,cellPoint(index),pathPoint(x.progress)))||chooseTarget(s,u);if(!ground&&!e)return false;
  const clockStep=u.hero==='cinderella'&&!extra&&topCinderella(s)?.uid===u.uid?(s.buffs.midnight>0?3:1):0,bell=clockStep>0&&(u.clock||0)+clockStep>=12;
  if(bell)e=s.enemies.find(x=>x.boss&&x.hp>0)||e;
  const at=cellPoint(index),to=ground?pathPoint(random(s)*PATH_LENGTH):pathPoint(e.progress),angle=Math.atan2(to.y-at.y,to.x-at.x);
  u.aim=angle;u.facing=attackDirection(at,to);
  const from={x:at.x+Math.cos(angle)*9,y:at.y+5+Math.sin(angle)*6};
  if(!extra){u.attacks++;u.pose=.3;}
  if(clockStep)u.clock=((u.clock||0)+clockStep)%12;
  const stats=combatStats(s,u,index),value=stats.damage*(extra||1);
  const travel=['cleave','pulse','cross'].includes(hero.shape)?.12:hero.shape==='beam'?.2:Math.hypot(to.x-from.x,to.y-from.y)/(hero.id==='great_detective'?1400:650);
  const gift=!extra&&u.hero==='santa'&&u.attacks%4===0;
  const shot={uid:s.nextId++,source:u.uid,target:e?.uid??null,hero:u.hero,form:unitForm(s,u),proc:!extra,damage:value,rank:u.rank,count:u.attacks,origin:at,from,to,life:travel,total:travel,...(ground?{ground:true}:{}),...(u.hero==='lightning_sage'?{chainRatio:stats.chainRatio,extraChain:stats.extraChain}:{}),...(gift?{gift:true}:{}),...(bell?{bell:true}:{})};
  s.shots.push(shot);event(s,'attack',{index,hero:u.hero,rank:u.rank,from,to,origin:at,shape:hero.shape,form:shot.form,attackType:hero.attack,...(gift?{gift:true}:{}),...(extra?{extra:true}:{})});
  if(extra)return true;
  if(s.buffs.echo>0){s.shots.push({...shot,uid:s.nextId++,proc:false,gift:undefined,bell:undefined,damage:value*.65*buffScale(s,'echo'),life:shot.life+.14,total:shot.life+.14});}
  if(has(s,'twin')&&u.attacks%4===0)s.shots.push({...shot,uid:s.nextId++,proc:false,gift:undefined,bell:undefined,damage:value*.45,life:shot.life+.2,total:shot.life+.2});
  return true;
}
// One source for outgoing attack power, cadence and the live inspection UI.
// Enemy armor/exposure and conditional hit bonuses are applied at impact.
export function combatStats(s,u,index=s.board.indexOf(u),detail=false){
  const h=HERO[u.hero],trait=personalTrait(s,u,index),adjacent=index<0?[]:neighbors(index).map(i=>s.board[i]).filter(Boolean),bonuses=[];
  // Buff families: placement auras, ultimate buffs and run/relic bonuses. Inside a family only the
  // strongest counts (relic bonuses add up); the families multiply. Speed follows the same rule.
  const power_={aura:0,ult:0,relic:0},speed_={aura:0,ult:0,other:trait.speedBonus};
  const damageBonus=(family,name,value)=>{if(family==='relic')power_.relic+=value;else power_[family]=Math.max(power_[family],value);if(detail)bonuses.push(`${name} +${Math.round(value*100)}% 위력`);};
  const speedBonus=(family,name,value)=>{if(family==='other')speed_.other+=value;else speed_[family]=Math.max(speed_[family],value);if(detail)bonuses.push(`${name} +${Math.round(value*100)}% 공속`);};
  if(detail&&trait.label)bonuses.push(trait.label);
  if(detail&&s.globalAttack)bonuses.push(`원정 축복 +${Math.round(s.globalAttack*100)}% 위력`);
  if(detail&&s.surgeWave===s.wave)bonuses.push('새벽검 +25% 위력');
  const bestAdjacentRank=type=>adjacent.filter(a=>!a.cursed&&HERO[a.hero].trait.type===type).reduce((best,a)=>Math.max(best,a.rank),0);
  const dragonRank=bestAdjacentRank('powerAura'),sirenRank=bestAdjacentRank('hasteAura');
  if(dragonRank)damageBonus('aura','고대 용의 가호',(.2+(s.upgrades.ancient_dragon||0)*.03)*special(s,'ancient_dragon')*rankSupport(dragonRank));
  const harmonySources=index<0?[]:neighbors(index).filter(i=>s.board[i]?.hero==='harmonious'&&!s.board[i].cursed).map(i=>harmonyStrength(s,i));
  const harmony=[...harmonySources,harmonyField(s)].reduce((best,value)=>value.damage>best.damage?value:best,{count:0,damage:0,speed:0});
  if(harmony.count){damageBonus('aura',`조화 ${harmony.count}종`,harmony.damage);speedBonus('aura',`조화 ${harmony.count}종`,harmony.speed);}
  if(has(s,'guild')&&(harmony.count||adjacent.some(a=>['powerAura','hasteAura'].includes(HERO[a.hero].trait.type))))damageBonus('relic','연대',.15);
  if(has(s,'constellation')&&new Set(adjacent.map(a=>a.hero)).size>=3)damageBonus('relic','별자리',.65);
  if(has(s,'banner')&&!adjacent.length&&index>=0)damageBonus('relic','고독한 깃발',.4);
  if(has(s,'crown')&&u.rank>=3)damageBonus('relic','왕관',.25);
  if(s.buffs.awaken>0)damageBonus('ult','각성',.6*buffScale(s,'awaken'));
  if(s.buffs.radiance>0)damageBonus('ult','여신강림',.5*buffScale(s,'radiance'));
  if(unitForm(s,u)){damageBonus('ult','트라우마',1.1);speedBonus('ult','트라우마',.35);}
  if(u.hero==='cinderella'&&s.buffs.midnight>0&&topCinderella(s)?.uid===u.uid)speedBonus('ult','자정의 기적',CINDERELLA.haste);
  if(sirenRank)speedBonus('aura','세이렌의 노래',(.15+(s.upgrades.siren||0)*.03)*special(s,'siren')*rankSupport(sirenRank));
  if(s.buffs.haste>0)speedBonus('ult','가속',.5*buffScale(s,'haste'));
  if(s.buffs.march>0)speedBonus('ult','은빛 행진',.2*buffScale(s,'march'));
  if(s.buffs.festive>0)speedBonus('ult','성야의 선물',.2*buffScale(s,'festive'));
  if(has(s,'tempo_bell')&&s.waveTime<7)speedBonus('other','첫막의 종',.45);
  if(has(s,'chorus')&&s.board.filter(a=>a?.hero===u.hero).length>=2)speedBonus('other','합창',.15);
  if(u.hero==='night_rabbit'){
    const kinds=new Set(s.board.filter(a=>a?.hero.endsWith('_rabbit')).map(a=>a.hero));kinds.delete(u.hero);
    if(kinds.size)speedBonus('other','토끼 연계',kinds.size*.2);
  }
  const multiplier=(1+power_.aura)*(1+power_.ult)*(1+power_.relic),speed=(1+speed_.other)*(1+speed_.aura)*(1+speed_.ult);
  const cooldown=h.interval*zoneCadence(u.hero)/speed;
  return {damage:power(s,u)*multiplier,interval:cooldown+ATTACK_WINDUP,cooldown,skillPower:power(s,u),range:h.range,radius:h.radius*(trait.zoneRadiusMultiplier||1),chainRatio:trait.chainRatio,extraChain:trait.extraChain,bonuses};
}

export function cast(s,id){
  if(s.phase!=='combat'||!s.enemies.some(e=>e.hp>0))return {ok:false,reason:'적이 나타나면 사용할 수 있습니다.'};
  const u=bestUnit(s,id),hero=HERO[id];if(!u||!s.deck.includes(id))return {ok:false,reason:'전장에 이 영웅이 있어야 합니다.'};
  const goldCost=skillGoldCost(id);if(s.gold<goldCost)return {ok:false,reason:`골드가 부족합니다. (${goldCost} 필요)`};
  if(s.gauge<hero.skill.cost)return {ok:false,reason:`별빛이 부족합니다. (${hero.skill.cost} 필요)`};
  // Wish upon a Star spends the whole gauge; every other skill pays its cost.
  const spent=hero.skill.type==='starfall'?s.gauge:hero.skill.cost;
  s.gold-=goldCost;s.gauge-=spent;if(has(s,'lantern'))addGauge(s,15);s.stats.skills++;s.tutorial=Math.max(s.tutorial,3);
  const type=hero.skill.type,base=power(s,u),targets=s.enemies.filter(e=>e.hp>0),control=special(s,id),scale=rankControl(u.rank);
  const source=sourceKey('skill',id,s.nextId++);
  for(const e of targets){syncStatuses(s,e);syncSlows(s,e);}
  let visualTargets=targets,gift;
  const before=new Map(targets.map(e=>[e.uid,pathPoint(e.progress)]));
  const strike=factor=>targets.forEach(e=>damage(s,e,base*factor,id));
  if(type==='echo')s.buffs.echo=skillDuration(s,8*control);
  else if(type==='haste')s.buffs.haste=skillDuration(s,8*control);
  else if(type==='awaken')s.buffs.awaken=skillDuration(s,10*control);
  else if(type==='march')s.buffs.march=skillDuration(s,6*control);
  else if(type==='glassfall'){strike(CINDERELLA.ult);s.buffs.midnight=skillDuration(s,10*control);u.clock=0;}
  else if(type==='gift'){const hero=drawHero(s);gift=place(s,hero,2);if(gift<0)s.reserves.push(hero);s.buffs.festive=skillDuration(s,6*control);}
  else if(type==='goddess'){strike(5);s.buffs.radiance=skillDuration(s,8*control);for(const ally of s.board)if(ally){ally.disabled=0;ally.cursed=false;}}
  else if(type==='trauma'){strike(4);s.buffs.trauma=skillDuration(s,10*control);}
  else if(type==='ice_court'){strike(6);for(const e of targets)if(e.hp>0)addSlow(s,e,source,.5,6);s.buffs.winter=skillDuration(s,6*control);}
  else if(type==='harmony')s.buffs.harmony=skillDuration(s,8*control);
  else if(type==='royal'||type==='starfall'||type==='mirror'){
    const target=highestMaxHp(s),origin=cellPoint(s.board.indexOf(u)),total=type==='mirror'?4:FINISHER_DELAY;
    visualTargets=[target];
    s.finishers.push({uid:s.nextId++,source:u.uid,hero:id,kind:type,target:target.uid,origin,to:pathPoint(target.progress),damage:base*(type==='royal'?24:type==='mirror'?10:.4*spent),rank:u.rank,life:total,total,...(type==='mirror'?{stored:0,ratio:mirrorRatio(s,u)}:{})});
    event(s,'targetLock',{hero:id,uid:target.uid,...pathPoint(target.progress)});
  }
  else if(type==='freeze'){strike(3);for(const e of targets){addControl(s,e,'freeze',source,id,2*control*scale);addSlow(s,e,source,.5,6);}}
  else if(type==='avalanche'){for(const e of targets){damage(s,e,base*(e.controlTime>0?12:4),id);addSlow(s,e,source,.5,4);}}
  else if(type==='dragon'){
    // Dragon Breath lands on the densest pack (radius 180) instead of the whole field.
    const near=e=>targets.filter(t=>t.hp>0&&Math.hypot(pathPoint(t.progress).x-pathPoint(e.progress).x,pathPoint(t.progress).y-pathPoint(e.progress).y)<=180);
    const centre=targets.reduce((best,e)=>{const n=near(e).length;return !best||n>best.n||n===best.n&&e.progress>best.e.progress?{e,n}:best;},null)?.e;
    visualTargets=centre?near(centre):[];for(const e of visualTargets){damage(s,e,base*14,id);addStatus(s,e,'burn',source,id,base*.6,5);}
  }
  else if(type==='inferno'){strike(7*(s.health<10?2:1));for(const e of targets)addStatus(s,e,'burn',source,id,base*.6,5);}
  else if(type==='combust'){for(const e of targets){damage(s,e,base*(e.burnTime>0?10:4),id);addStatus(s,e,'burn',source,id,base*.6,6);}}
  else if(type==='plague'){
    // Enemies already carrying 20+ poison take 30% of the remaining poison at once.
    for(const e of targets){const active=activePoison(e);if(active.reduce((n,a)=>n+a.stacks,0)>=20)damage(s,e,.3*active.reduce((n,{effect,stacks})=>n+stacks*effect.power*POISON_POWER_RATIO*Math.max(0,effect.until-s.time),0),id);}
    for(const e of targets)addPoison(s,e,source,id,8,12,base);strike(3);
  }
  else if(type==='expose'){strike(3);for(const e of targets)addStatus(s,e,'exposure',source,id,detectiveExposure(s,u),10);}
  else if(type==='quake'){strike(3);for(const e of targets){const crisis=e.progress>=PATH_LENGTH*2/3;pushBack(e,(crisis?320:160)*control);addControl(s,e,'stun',source,id,(crisis?3:1.5)*control*scale);}}
  else if(type==='nightmare'){strike(4);for(const e of targets){pushBack(e,220*control);addStatus(s,e,'exposure',source,id,Math.min(DAMAGE_TAKEN_CAP,.25*control*scale),6);addPoison(s,e,source,id,4,12,base);}}
  else if(type==='rewind'){for(const e of targets){pushBack(e,e.speed*6*control);addControl(s,e,'stun',source,id,2*control*scale);}strike(3);}
  else if(type==='vortex'||type==='singularity'){
    const front=targets.reduce((max,e)=>Math.max(max,e.progress),0),point=Math.max(120,front-80);
    for(const e of targets){const pull=Math.min(.9,.65*control)*(e.boss?BOSS_PUSH_SCALE:1);e.progress=e.progress*(1-pull)+point*pull;addControl(s,e,'stun',source,id,(type==='singularity'?2:1.5)*control*scale);addSlow(s,e,source,.6,4);}
    if(type==='vortex')strike(5);
    // Starsea Heart harvests every divine mark: +50% per stack consumed.
    else for(const e of targets){const marks=e.divine;e.statusEffects=e.statusEffects.filter(effect=>effect.type!=='divine');syncStatuses(s,e);damage(s,e,base*8*(1+.5*marks),id);}
  }else if(type==='execute'){
    // Each execution kill carries the step to the next target (up to five more).
    const order=[...targets].sort((a,b)=>Number(!!b.boss)-Number(!!a.boss)||b.maxHp-a.maxHp);visualTargets=[];
    let strikes=5,extra=0;
    for(const e of order){if(strikes<=0)break;strikes--;visualTargets.push(e);const execute=e.hp/e.maxHp<=executeThreshold(e);damage(s,e,base*(execute?30:16),id);if(execute&&e.hp<=0&&extra<5){extra++;strikes++;}}
  }else if(type==='flurry'){visualTargets=[...targets].sort((a,b)=>b.progress-a.progress).slice(0,nightRabbitTargetCount(s));for(const e of visualTargets)damage(s,e,base*9,id);}
  else if(type==='thunder'){strike(7);for(const e of targets)addControl(s,e,'stun',source,id,1.2*control*scale);}
  else if(type==='fortune')strike(fortuneFactor(s.gold,s.upgrades[id]||0));
  else if(type==='dividend'){strike(4);giveGold(s,QUEEN_TAX,'필살기');s.buffs.tax=skillDuration(s,8*control);}
  const support=['echo','haste','awaken','march','gift','trauma','harmony'].includes(type);
  const key=ACTIVE_SKILLS[id];if(key){s.buffTotals[key]=s.buffs[key];if(!s.buffScale)s.buffScale={};s.buffScale[key]=scale;}
  const points=support?s.board.flatMap((ally,index)=>ally&&(type!=='trauma'||ally.hero==='time_magician')?[{...cellPoint(index),uid:ally.uid}]:[]):visualTargets.map(e=>({...pathPoint(e.progress),uid:e.uid,from:before.get(e.uid)}));
  event(s,'skill',{hero:id,name:hero.skill.name,kind:type,rank:u.rank,goldCost,origin:cellPoint(s.board.indexOf(u)),support,locked:['royal','starfall','mirror'].includes(type),targets:points,...(gift!==undefined?{gift}:{})});return {ok:true};
}
// Describes what pressing the ultimate would do right now, with the numbers cast() uses. No side effects.
// The detective's ultimate scales with training and rank like his basic attack, so it never falls behind it.
export const detectiveExposure=(s,u)=>Math.min(DAMAGE_TAKEN_CAP,(.35+(s.upgrades.great_detective||0)*.02)*special(s,'great_detective')*rankControl(u.rank));
// Aurora's mirror echo: 50% at 1★, scaled by rank and enhancement, up to 100%.
export const mirrorRatio=(s,u)=>Math.min(1,.5*rankSupport(u.rank)*special(s,'aurora'));
export function castPreview(s,id){
  const u=bestUnit(s,id);if(!u)return null;
  const hero=HERO[id],type=hero.skill.type,base=power(s,u),control=special(s,id),scale=rankControl(u.rank);
  const targets=s.enemies.filter(e=>e.hp>0),lines=[];
  const num=v=>Math.round(v).toLocaleString('ko-KR');
  const sec=v=>Number(v.toFixed(1))+'초';
  const pct=v=>Math.round(v*100).toLocaleString('ko-KR');
  const dur=seconds=>sec(skillDuration(s,seconds*control));
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
  const burnPerSecond=num(base*.6*(has(s,'ember')?1.6:1));
  const immune=e=>!!e.boss&&(e.ccImmune||0)-s.time>1e-9;

  if(type==='echo')lines.push(`${dur(8)} 동안 모든 동료의 공격마다 위력 ${pct(.65*scale)}%의 추가 공격이 한 번 더 나갑니다.`);
  else if(type==='haste')lines.push(`${dur(8)} 동안 모든 동료의 공격 속도가 ${pct(.5*scale)}% 오릅니다.`);
  else if(type==='awaken')lines.push(`${dur(10)} 동안 모든 동료의 위력이 ${pct(.6*scale)}% 오릅니다.`);
  else if(type==='march')lines.push(`${dur(6)} 동안 모든 동료의 공격이 성광 1중첩을 6초간 남기고, 공격 속도가 ${pct(.2*scale)}% 오릅니다.`);
  else if(type==='glassfall'){
    lines.push(`적 전체에게 위력 ${CINDERELLA.ult}배, ${hit(CINDERELLA.ult)}를 줍니다.`);
    // The haste and the three-hour step are fixed. cast() stores buffScale but never reads it back.
    lines.push(`${dur(10)} 동안 진짜 신데렐라의 공격 속도가 ${pct(CINDERELLA.haste)}% 오르고, 4번째 공격마다 자정의 종이 울립니다.`);
  }else if(type==='gift'){
    lines.push(freeCell(s)<0?'전장이 가득 차 편성된 동료 한 명이 2성으로 대기열에 들어갑니다.':'편성된 동료 한 명이 2성으로 전장에 합류합니다.');
    lines.push(`${dur(6)} 동안 모든 동료의 공격 속도가 ${pct(.2*scale)}% 오릅니다.`);
  }else if(type==='goddess'){
    lines.push(`적 전체에게 위력 5배, ${hit(5)}를 줍니다.`);
    lines.push(`${dur(8)} 동안 모든 동료의 위력이 ${pct(.5*scale)}% 오릅니다.`);
    lines.push('행동 불능을 모두 풀고, 지속 동안 봉인과 폭풍의 행동 불능과 별빛 감소를 막습니다.');
  }else if(type==='trauma'){
    lines.push(`적 전체에게 위력 4배, ${hit(4)}를 줍니다.`);
    // +110% damage and +35% speed are fixed. buffScale is stored and not applied.
    lines.push(`${dur(10)} 동안 시간의마술사가 변신해 위력 110%, 공격 속도 35%가 오릅니다.`);
  }else if(type==='ice_court'){
    lines.push(`적 전체에게 위력 6배, ${hit(6)}를 줍니다.`);
    lines.push(`적은 6초 동안 ${pct(slowOf(.5))}% 느려집니다.`);
    lines.push(`겨울은 ${dur(6)} 동안 이어지고, 쓰러진 적 주변 120 안의 일반 적이 ${sec(.8*scale)} 동안 얼어붙습니다.`);
  }else if(type==='harmony'){
    const count=new Set(s.board.filter(unit=>unit&&unit.hero!=='harmonious').map(unit=>unit.hero)).size,level=s.upgrades.harmonious||0,field=control*scale;
    const damage=count*(.06+level*.005)*field,speed=count*(.05+level*.002)*field;
    lines.push(`${dur(8)} 동안 조화가 전장 전체로 퍼집니다.`);
    lines.push(count?`하모니어스를 뺀 동료 ${count}종 기준으로 위력 ${pct(damage)}%, 공격 속도 ${pct(speed)}%가 오릅니다.`:`다른 종류의 동료가 없어 위력 ${pct(damage)}%, 공격 속도 ${pct(speed)}%가 오릅니다.`);
  }else if(type==='royal'||type==='starfall'||type==='mirror'){
    if(type==='starfall')lines.push(`별빛 ${Math.floor(s.gauge)}을 모두 써 체력이 가장 높은 적에게 ${hit(.4*s.gauge)}를 줍니다.`);
    else if(type==='mirror'){
      lines.push(`체력이 가장 높은 적에게 4초 동안 거울을 걸고, 끝날 때 위력 10배인 ${hit(10)}를 줍니다.`);
      lines.push(`그 사이 그 적이 받은 피해의 ${pct(mirrorRatio(s,u))}%가 더해지며, 모은 양에는 상한이 없습니다.`);
    }else{
      const target=highestMaxHp(s),view=target?snapshot(target):null,hot=!!view&&(view.burnTime>0||view.divine>=3&&view.divineTime>0);
      lines.push(`체력이 가장 높은 적에게 위력 24배, ${hit(24)}를 줍니다.`);
      lines.push(hot?`지금 대상이 불타거나 성광 3중첩이라 맞는 순간 ${hit(48)}가 됩니다.`:`불타거나 성광이 3중첩이면 맞는 순간 ${hit(48)}가 됩니다.`);
    }
  }else if(type==='freeze'){
    const freeze=2*control*scale;
    lines.push(`적 전체에게 위력 3배, ${hit(3)}를 줍니다.`);
    lines.push(`일반 적은 ${sec(freeze)} 동안 얼고 6초간 ${pct(slowOf(.5))}% 느려집니다. 보스는 ${sec(freeze*BOSS_CONTROL_SCALE)} 동안 얼습니다.`);
  }else if(type==='avalanche'){
    const on=targets.filter(e=>snapshot(e).controlTime>0).length;
    if(!targets.length||on===0)lines.push(`적에게 위력 4배, ${hit(4)}를 줍니다. 기절하거나 얼어 있으면 ${hit(12)}입니다.`);
    else if(on===targets.length)lines.push(`지금 기절·빙결 중인 적에게 위력 12배, ${hit(12)}를 줍니다.`);
    else lines.push(`기절·빙결 ${on}명에게 ${hit(12)}, 나머지에게 ${hit(4)}를 줍니다.`);
    lines.push(`4초 동안 ${pct(slowOf(.5))}% 느려집니다.`);
  }else if(type==='dragon'){
    const near=e=>targets.filter(t=>Math.hypot(pathPoint(t.progress).x-pathPoint(e.progress).x,pathPoint(t.progress).y-pathPoint(e.progress).y)<=180);
    const centre=targets.reduce((best,e)=>{const n=near(e).length;return !best||n>best.n||n===best.n&&e.progress>best.e.progress?{e,n}:best;},null)?.e;
    const pack=centre?near(centre):[];
    lines.push(pack.length?`가장 밀집한 반경 180 안의 적 ${pack.length}명에게 위력 14배, ${hit(14)}를 줍니다.`:`반경 180 안에서 가장 밀집한 적에게 위력 14배, ${hit(14)}를 줍니다.`);
    lines.push(`맞은 적은 5초 동안 초당 ${burnPerSecond}의 화상을 입습니다.`);
  }else if(type==='inferno'){
    const factor=7*(s.health<10?2:1);
    lines.push(`적 전체에게 위력 ${factor}배, ${hit(factor)}를 줍니다.`);
    lines.push(`5초 동안 초당 ${burnPerSecond}의 화상을 입습니다.`);
    if(s.health<10)lines.push('코어 생명력이 10 미만이라 피해가 두 배입니다.');
  }else if(type==='combust'){
    const burning=targets.filter(e=>snapshot(e).burnTime>0).length;
    if(!targets.length||burning===0)lines.push(`적에게 위력 4배, ${hit(4)}를 줍니다. 이미 불타면 ${hit(10)}입니다.`);
    else if(burning===targets.length)lines.push(`지금 불타는 적에게 위력 10배, ${hit(10)}를 줍니다.`);
    else lines.push(`불타는 적 ${burning}명에게 ${hit(10)}, 나머지에게 ${hit(4)}를 줍니다.`);
    lines.push(`6초 동안 초당 ${burnPerSecond}의 화상을 입습니다.`);
  }else if(type==='plague'){
    const stacks=8+(has(s,'seed')?1:0),ready=targets.filter(e=>poisonNow(e).reduce((n,a)=>n+a.stacks,0)>=20);
    lines.push(`적 전체에게 위력 3배, ${hit(3)}와 12초 동안 독 ${stacks}중첩을 줍니다.`);
    lines.push(`이 독은 중첩당 초당 ${num(base*POISON_POWER_RATIO)} 피해입니다.`);
    if(!ready.length)lines.push('이미 독이 20중첩 이상인 적은 남은 독 피해의 30%를 먼저 받습니다.');
    else{
      const burst=e=>.3*poisonNow(e).reduce((n,{effect,stacks:count})=>n+count*effect.power*POISON_POWER_RATIO*Math.max(0,effect.until-s.time),0);
      const amounts=ready.map(burst),same=amounts.every(v=>Math.round(v)===Math.round(amounts[0]));
      lines.push(same?`독이 20중첩 이상인 적 ${ready.length}명은 먼저 남은 독의 30%인 ${num(amounts[0])} 피해를 받습니다.`:`독이 20중첩 이상인 적 ${ready.length}명은 각자 남은 독 피해의 30%를 먼저 받습니다.`);
    }
  }else if(type==='expose'){
    const raw=(.35+(s.upgrades.great_detective||0)*.02)*control*rankControl(u.rank),expose=Math.min(DAMAGE_TAKEN_CAP,raw);
    lines.push(`적 전체에게 위력 3배, ${hit(3)}를 줍니다.`);
    lines.push(`10초 동안 받는 피해가 ${pct(expose)}% 늘어납니다.`+(raw>DAMAGE_TAKEN_CAP?' 상한까지 늘어납니다.':''));
  }else if(type==='quake'){
    const late=e=>e.progress>=PATH_LENGTH*2/3,earlyN=targets.filter(e=>!late(e)).length,lateN=targets.length-earlyN;
    const push=crisis=>num((crisis?320:160)*control),stun=crisis=>sec((crisis?3:1.5)*control*scale);
    lines.push(`적 전체에게 위력 3배, ${hit(3)}를 줍니다.`);
    if(targets.length&&lateN&&!earlyN)lines.push(`지금 적은 경로의 마지막 3분의 1이라 ${push(true)}만큼 밀리고 ${stun(true)} 기절합니다.`);
    else if(targets.length&&earlyN&&!lateN)lines.push(`지금 적은 마지막 3분의 1 전이라 ${push(false)}만큼 밀리고 ${stun(false)} 기절합니다. 그 구간에 들면 ${push(true)}만큼 밀리고 ${stun(true)} 기절합니다.`);
    else lines.push(`마지막 3분의 1 전은 ${push(false)}만큼 밀리고 ${stun(false)} 기절하며, 그 안은 ${push(true)}만큼 밀리고 ${stun(true)} 기절합니다.`);
    lines.push('보스는 밀쳐내기와 기절이 절반입니다. 제어 면역인 보스에게는 밀쳐내기만 들어갑니다.');
  }else if(type==='nightmare'){
    const expose=Math.min(DAMAGE_TAKEN_CAP,.25*control*scale),stacks=4+(has(s,'seed')?1:0);
    lines.push(`적 전체에게 위력 4배, ${hit(4)}를 주고 ${num(220*control)}만큼 밀어냅니다.`);
    lines.push(`6초 동안 받는 피해가 ${pct(expose)}% 늘고, 12초 동안 독 ${stacks}중첩이 걸립니다.`);
    lines.push(`독은 중첩당 초당 ${num(base*POISON_POWER_RATIO)} 피해이고, 보스는 절반만 밀립니다.`);
  }else if(type==='rewind'){
    const stun=2*control*scale;
    if(targets.length===1){
      const e=targets[0],boss=!!e.boss,held=immune(e)?0:stun*(boss?BOSS_CONTROL_SCALE:1),dist=e.speed*6*control*(boss?BOSS_PUSH_SCALE:1);
      lines.push(held?`적을 ${num(dist)}만큼 되돌리고 ${sec(held)} 동안 멈춘 뒤 위력 3배, ${hit(3)}를 줍니다.`:`적을 ${num(dist)}만큼 되돌린 뒤 위력 3배, ${hit(3)}를 줍니다. 지금은 제어 면역입니다.`);
      if(!boss)lines.push('보스는 되돌아가는 거리와 멈춤이 절반입니다.');
    }else{
      lines.push(`각 적을 이동 속도로 ${sec(6*control)} 동안 간 거리만큼 되돌리고 위력 3배, ${hit(3)}를 줍니다.`);
      lines.push(`일반 적은 ${sec(stun)}, 보스는 ${sec(stun*BOSS_CONTROL_SCALE)} 동안 멈춥니다.`);
    }
  }else if(type==='vortex'||type==='singularity'){
    const front=targets.reduce((max,e)=>Math.max(max,e.progress),0),point=Math.max(120,front-80),pull=Math.min(.9,.65*control);
    const stunSec=(type==='singularity'?2:1.5)*control*scale,slow=pct(slowOf(.6));
    lines.push(`적들을 경로 ${num(point)} 쪽으로 ${pct(pull)}% 끌어당깁니다. 보스의 끌어당김은 절반입니다.`);
    if(type==='vortex')lines.push(`위력 5배, ${hit(5)}를 주고 4초 동안 ${slow}% 느려집니다.`);
    else{
      const marks=targets.map(e=>snapshot(e).divine);
      if(!marks.length||marks.every(m=>m===0))lines.push(`성광이 없으면 위력 8배, ${hit(8)}를 줍니다. 중첩 하나당 50%가 더해집니다.`);
      else if(marks.every(m=>m===marks[0]))lines.push(`성광 ${marks[0]}중첩을 모두 거둬 위력 ${num(8*(1+.5*marks[0]))}배, ${hit(8*(1+.5*marks[0]))}를 줍니다.`);
      else lines.push(`적마다 성광을 모두 거둬 위력 8배, ${hit(8)}에 중첩당 50%를 더합니다.`);
    }
    lines.push(`일반 적은 ${sec(stunSec)}, 보스는 ${sec(stunSec*BOSS_CONTROL_SCALE)} 동안 기절합니다.`);
  }else if(type==='execute'){
    const order=[...targets].sort((a,b)=>Number(!!b.boss)-Number(!!a.boss)||b.maxHp-a.maxHp),first=order.slice(0,5);
    const low=first.filter(e=>e.hp/e.maxHp<=executeThreshold(e)),high=first.length-low.length;
    const normalRate=pct(executeThreshold({boss:null})),bossRate=pct(executeThreshold({boss:true}));
    if(!first.length){
      lines.push(`보스부터 최대 5명에게 위력 16배, ${hit(16)}를 줍니다.`);
      lines.push(`일반 ${normalRate}%, 보스 ${bossRate}% 이하면 ${hit(30)}이고, 처치하면 최대 5명에게 더 이어집니다.`);
    }else if(low.length&&!high){
      lines.push(`지금 대상 ${first.length}명은 처형 기준 이하라 위력 30배, ${hit(30)}를 받습니다.`);
      lines.push('처치하면 다음 대상에게 이어지며, 추가 대상은 최대 5명입니다.');
    }else if(!low.length){
      lines.push(`지금 대상 ${Math.min(5,first.length)}명에게 위력 16배, ${hit(16)}를 줍니다.`);
      lines.push(`일반 ${normalRate}%, 보스 ${bossRate}% 이하면 ${hit(30)}이고, 처치하면 최대 5명에게 더 이어집니다.`);
    }else{
      lines.push(`처형 기준 이하 ${low.length}명에게 ${hit(30)}, 나머지 ${high}명에게 ${hit(16)}를 줍니다.`);
      lines.push('처치하면 다음 대상에게 이어지며, 추가 대상은 최대 5명입니다.');
    }
  }else if(type==='flurry'){
    const count=nightRabbitTargetCount(s),aimed=Math.min(count,targets.length);
    lines.push(targets.length?`가장 앞선 적 ${aimed}명에게 위력 9배, ${hit(9)}를 줍니다. 최대 ${count}명입니다.`:`가장 앞선 적에게 위력 9배, ${hit(9)}를 줍니다. 최대 ${count}명입니다.`);
  }else if(type==='thunder'){
    const stun=1.2*control*scale;
    lines.push(`적 전체에게 위력 7배, ${hit(7)}를 줍니다.`);
    lines.push(`일반 적은 ${sec(stun)}, 보스는 ${sec(stun*BOSS_CONTROL_SCALE)} 동안 기절합니다.`);
  }else if(type==='fortune'){const level=s.upgrades[id]||0,factor=fortuneFactor(s.gold-skillGoldCost(id),level);lines.push(`적 전체에게 위력 ${factor}배, ${hit(factor)}를 줍니다.`);if(factor<17+level)lines.push(`내고 남은 골드 20마다 +1배 (최대 ${17+level}배).`);}
  else if(type==='dividend'){
    lines.push(`적 전체에게 위력 4배, ${hit(4)}를 주고 골드 ${QUEEN_TAX}을 받습니다.`);
    // The extra payout is 2× kill gold, so the total is 3×. buffScale does not change it.
    lines.push(`${dur(8)} 동안 처치 골드가 3배가 되어 일반 6, 장갑 9, 보스 60골드를 줍니다.`);
  }else lines.push(hero.skill.text);

  const gold=skillGoldCost(id);
  if(gold>0)lines.push(`골드 ${num(gold)}을 사용합니다.`);
  return {rank:u.rank,lines};
}

// Boss patterns. Every action is telegraphed (2.6 s, targeted 3.5 s) except the curse, which the user wants unannounced.
// Targets are random: a random row, random occupied cells, or a random companion for the curse.
// Repeat-limited patterns (curse, shuffle) count per boss so one appearance never spams them.
const BOSS_LIMIT={curse:2,shuffle:2,judgement:2};
// Targeted patterns (lit cells) give longer to drag the unit out; board-wide ones stay at 2.6 s.
export const TELEGRAPH_TIME=Object.freeze({seal:3.5,storm:3.5,stun1:3.5,judgement:3.5});
function bossCells(s,pattern){
  const occupied=s.board.flatMap((u,i)=>u?[i]:[]),all=Array.from({length:25},(_,i)=>i);
  if(pattern==='seal'){const row=Math.floor(random(s)*5);return Array.from({length:5},(_,i)=>row*5+i);}
  if(pattern==='storm')return [...shuffle(s,occupied),...shuffle(s,all.filter(i=>!occupied.includes(i)))].slice(0,3);
  if(pattern==='stun1'||pattern==='judgement')return occupied.length?[occupied[Math.floor(random(s)*occupied.length)]]:[Math.floor(random(s)*25)];
  if(pattern==='thunder'||pattern==='shuffle')return all;
  return [];
}
function bossResolve(s,e,boss,pattern){
  const cells=s.telegraph?.cells||[],shielded=s.buffs.radiance>0;
  if(pattern==='seal'){if(!shielded)for(const i of cells)if(s.board[i])s.board[i].disabled=Math.max(s.board[i].disabled,boss.sealTime||2.4);event(s,'seal',{cells});}
  else if(pattern==='storm'){if(!shielded)for(const i of cells)if(s.board[i]){s.board[i].disabled=1.8;s.gauge=Math.max(0,s.gauge-5);}event(s,'bossCast',{boss:e.boss,pattern,cells,...pathPoint(e.progress)});}
  else if(pattern==='stun1'){if(!shielded)for(const i of cells)if(s.board[i])s.board[i].disabled=Math.max(s.board[i].disabled,2);event(s,'seal',{cells});}
  else if(pattern==='starlust'){if(s.gauge>=gaugeCap(s)-1e-6){s.gauge=Math.max(0,s.gauge-60);event(s,'drain');}event(s,'bossCast',{boss:e.boss,pattern,...pathPoint(e.progress)});}
  else if(pattern==='thunder'){e.judged=true;if(!shielded)for(const u of s.board)if(u)u.disabled=Math.max(u.disabled,4);event(s,'bossCast',{boss:e.boss,pattern,cells,...pathPoint(e.progress)});}
  else if(pattern==='shuffle'){
    const units=s.board.filter(Boolean),slots=shuffle(s,Array.from({length:25},(_,i)=>i));s.board=Array(25).fill(null);units.forEach((u,i)=>{s.board[slots[i]]=u;});syncTimeRuler(s);
    event(s,'shuffle',{});event(s,'bossCast',{boss:e.boss,pattern,...pathPoint(e.progress)});
  }else if(pattern==='warp'){
    // Read the end times without syncing, so later enemies keep this frame's DOT segments (as the old rush did).
    for(const t of s.enemies){if(t.hp<=0)continue;const controlled=t.statusEffects.some(effect=>['stun','freeze'].includes(effect.type)&&effect.until-s.time>1e-9),slowed=t.slowEffects.some(effect=>effect.until-s.time>1e-9);if(controlled||slowed)continue;t.progress=Math.min(PATH_LENGTH-1,t.progress+PATH_LENGTH*.15);}
    event(s,'rush');event(s,'bossCast',{boss:e.boss,pattern,...pathPoint(e.progress)});
  }else if(pattern==='judgement'){
    const i=cells[0],u=s.board[i];
    if(u&&!shielded&&s.board.filter(Boolean).length>1){s.board[i]=null;syncTimeRuler(s);}
    event(s,'judgement',{index:i,hit:!!u&&!shielded,...cellPoint(i)});
  }
}
function bossStep(s,e,dt){
  const boss=BOSSES[e.boss];
  if(e.channel>0){
    e.channel-=dt;
    if(e.channel<=0){const pattern=s.telegraph?.pattern||boss.pattern;bossResolve(s,e,boss,pattern);s.telegraph=null;e.skillIn=boss.every||9;}
    return;
  }
  // Thor: once he reaches the middle of the path, a board-wide judgement that stunning him cancels.
  if(boss.judgement&&!e.judged&&e.progress>=PATH_LENGTH*.5){
    e.channel=3;e.judging=true;e.channelHp=e.hp+(e.shield||0);
    s.telegraph={uid:e.uid,pattern:'thunder',text:boss.judgement,cells:bossCells(s,'thunder'),ends:s.time+3,total:3};event(s,'warning',{text:boss.judgement,cells:s.telegraph.cells,pattern:'thunder'});return;
  }
  e.skillIn-=dt;if(e.skillIn>0)return;
  const casts=e.casts||0,pattern=Array.isArray(boss.pattern)?boss.pattern[casts%boss.pattern.length]:boss.pattern;
  if(BOSS_LIMIT[pattern]!==undefined&&casts>=BOSS_LIMIT[pattern]){e.skillIn=99;return;}
  e.casts=casts+1;
  if(pattern==='curse'){
    // Unannounced: one random active companion is sealed until it is merged, sold or cleansed.
    const pool=s.board.flatMap((u,i)=>u&&!u.cursed?[i]:[]);e.skillIn=boss.every||9;
    if(!pool.length||s.buffs.radiance>0)return;
    const i=pool[Math.floor(random(s)*pool.length)];s.board[i].cursed=true;event(s,'curse',{index:i,hero:s.board[i].hero,...cellPoint(i)});return;
  }
  const time=TELEGRAPH_TIME[pattern]||2.6;e.channel=time;e.channelHp=e.hp+(e.shield||0);
  const text=boss.warnings?.[pattern]||boss.warning,cells=bossCells(s,pattern);
  s.telegraph={uid:e.uid,pattern,text,cells,ends:s.time+time,total:time};event(s,'warning',{text,cells,pattern});
}

function completeWave(s){
  const payout={base:waveIncome(s.wave),dividend:dividend(s)};
  giveGold(s,payout.base,'웨이브');giveGold(s,payout.dividend,'배당');s.settlement=payout;addGauge(s,8);s.shots=[];s.finishers=[];s.zones=[];s.telegraph=null;
  event(s,'clear',{wave:s.wave,...payout});
  if(s.mode==='main'&&s.wave===MAIN_WAVES&&!s.endless){s.reward=null;s.phase='victory';s.won=true;return;}
  s.reward=shuffle(s,BLESSINGS.map(b=>b.id)).slice(0,3);s.phase='reward';
}
export function chooseReward(s,id){
  if(s.phase!=='reward'||!s.reward.includes(id))return {ok:false};
  if(id==='arrival'){const hero=drawHero(s);if(place(s,hero,2)<0)s.reserves.push(hero);}
  if(id==='surge')s.surgeWave=s.wave+1;
  if(id==='training')s.trainingDiscount=Math.min(.5,Math.round((s.trainingDiscount+.1)*10)/10);
  if(id==='oath')s.globalAttack=Math.round((s.globalAttack+.06)*100)/100;
  if(id==='purse')giveGold(s,35,'축복');
  if(id==='mend'){s.health=Math.min(20,s.health+3);addGauge(s,20);}
  s.blessings.push(id);s.reward=null;event(s,'blessing',{id});
  if(s.mode==='main'&&s.wave===MAIN_WAVES&&!s.endless){s.phase='victory';s.won=true;}else {s.phase='intermission';s.breakTime=1.4;}
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
    if(e.burn>0)damage(s,e,e.burn*dt*(has(s,'ember')?1.6:1),e.burnOwner,{dot:true,statusAt:at,dotType:'burn'});
    const poisonByOwner=new Map();
    for(const {effect,stacks} of activePoison(e))poisonByOwner.set(effect.owner,(poisonByOwner.get(effect.owner)||0)+stacks*effect.power*POISON_POWER_RATIO);
    for(const [owner,dps] of poisonByOwner)damage(s,e,dps*dt,owner,{dot:true,statusAt:at,dotType:'poison'});
    if(e.hp<=0)break;
    if(e.controlTime>0){if(e.judging&&s.telegraph?.uid===e.uid&&s.telegraph.pattern==='thunder'){e.judging=false;e.judged=true;e.channel=0;s.telegraph=null;e.skillIn=Math.max(e.skillIn,3);event(s,'interrupt',{name:BOSSES[e.boss].name});}else if(s.telegraph?.uid===e.uid)s.telegraph.ends+=dt;}
    else {e.progress+=e.speed*dt*(e.slowTime>0?1-e.slow:1)*(e.rage>0?1.4:1);if(e.boss)bossStep(s,e,dt);}
    at=until;
  }
  syncStatuses(s,e,end);syncSlows(s,e,end);
}
export function step(s,dt){
  if(!['combat','intermission'].includes(s.phase))return;
  dt=clamp(dt,0,.05);const start=s.time;s.time+=dt;
  // A short challenge measures how far this collection can push, without
  // waiting for a nearly invulnerable late-round enemy to circle the arena.
  for(const key of Object.keys(s.buffs))s.buffs[key]=Math.max(0,s.buffs[key]-dt);
  while(s.reserves.length&&freeCell(s)>=0)place(s,s.reserves.shift(),2);
  if(s.phase==='intermission'){s.breakTime-=dt;if(s.breakTime<=0)beginWave(s,s.wave+1);return;}
  s.waveTime+=dt;addGauge(s,dt*1.2);
  s.spawnIn-=dt;if(s.spawnIn<=0&&s.queue.length){spawnEnemy(s,s.queue.shift());s.spawnIn=wavePlan(s.wave,s.chapter,s.mode).interval;}
  for(const e of s.enemies){
    if(e.hp<=0)continue;e.hit=Math.max(0,e.hit-dt);e.dotFlash-=dt;
    tickEnemyStatuses(s,e,start,s.time);
    if(e.hp<=0)continue;
    if(e.rage>0)e.rage=Math.max(0,e.rage-dt);
    if(e.progress>=PATH_LENGTH&&e.hp>0){e.hp=0;if(has(s,'phoenix')&&!s.phoenixUsed){s.phoenixUsed=true;s.health=Math.min(20,s.health+3);event(s,'phoenix');}else{s.health-=e.boss?7:e.kind==='armor'?2:1;event(s,'leak',{boss:e.boss,health:s.health});}}
  }
  for(const z of s.zones){
    z.life-=dt;z.tick-=dt;if(z.life<=0||z.tick>0)continue;z.tick+=.5;
    const targets=s.enemies.filter(e=>e.hp>0&&Math.hypot(pathPoint(e.progress).x-z.x,pathPoint(e.progress).y-z.y)<=z.radius),h=HERO[z.hero];
    for(const e of targets){
      // Gravity fields deal +30% per divine stack on the enemy.
      if(z.hero==='galaxy_whale'&&!z.orbit)syncStatuses(s,e);
      damage(s,e,z.damage*(z.orbit?.15:.22)*(z.hero==='galaxy_whale'&&!z.orbit?1+.3*e.divine:1),z.hero,{dot:true});if(z.orbit)continue;
      if(z.hero==='flame_sage')addStatus(s,e,'burn',sourceKey('zone',z.hero,z.uid),z.hero,z.damage*.23,3);
      if(z.hero==='mushroom_king')addPoison(s,e,sourceKey('zone',z.hero,z.uid),z.hero,1,7,z.damage);
    }
    if(!z.orbit&&['phantom','galaxy_whale','time_ruler'].includes(z.hero))slowTargets(s,targets,h,z.damage,z,sourceKey('zone',z.hero,z.uid),z.rank);
  }
  s.zones=s.zones.filter(z=>z.life>0);
  for(let i=0;i<s.board.length;i++){
    const u=s.board[i];if(!u)continue;u.pose=Math.max(0,u.pose-dt);
    if(u.disabled>0){u.disabled-=dt;continue;}
    if(u.cursed)continue;
    if(u.windup>0){u.windup-=dt;if(u.windup<=0)attack(s,u,i);continue;}
    u.cooldown-=dt;if(u.cooldown<=0){const target=chooseTarget(s,u,false);if(target){u.idleFor=0;u.target=target.uid;const p=cellPoint(i),t=pathPoint(target.progress);u.aim=Math.atan2(t.y-p.y,t.x-p.x);u.facing=attackDirection(p,t);u.windup=ATTACK_WINDUP;u.cooldown=combatStats(s,u,i).cooldown;}else{u.cooldown=.1;u.idleFor=(u.idleFor||0)+.1;if(u.idleFor>1)u.facing='down';}}
  }
  for(const shot of s.shots){if(shot.delay>0){shot.delay=Math.max(0,shot.delay-dt);continue;}shot.life-=dt;if(shot.life<=0)applyHit(s,shot);}
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
      damage(s,target,f.damage*factor+echoDamage,f.hero,{recordMirror:f.kind!=='mirror'});
      event(s,'finisherImpact',{hero:f.hero,kind:f.kind,target:f.target,targetBoss:!!target.boss,...f.to,origin:f.origin,rank:f.rank,damage:s.stats.damage-before,echoDamage});
    }
  }
  s.finishers=s.finishers.filter(f=>f.life>0);
  s.shots=s.shots.filter(shot=>shot.life>0);s.enemies=s.enemies.filter(e=>e.hp>0);
  if(s.telegraph&&!s.enemies.some(e=>e.uid===s.telegraph.uid))s.telegraph=null;
  if(s.health<=0){s.health=0;s.phase='defeat';event(s,'defeat');}
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
    if(s.buffTotals===undefined)s.buffTotals={...s.buffs};
    if(s.buffScale===undefined)s.buffScale={};
    for(const e of s.enemies)if(e){for(const key of ['divine','divineTime','frostStacks','frostTime','rage','shield','ccImmune','frostLock'])if(e[key]===undefined)e[key]=0;}
    // Frost stacks were retired by the stat renewal; an in-progress run drops them.
    for(const e of s.enemies)if(e){if(Array.isArray(e.statusEffects))e.statusEffects=e.statusEffects.filter(effect=>effect?.type!=='frost');e.frostStacks=0;e.frostTime=0;}
    if(!numeric(s,['gold','gauge','health','time','waveTime','spawnIn','breakTime','summons','paidSummons','freeSummons','trainingDiscount','globalAttack','surgeWave','waveTotal','tutorial','seed'])||s.gold<0||s.time<0||s.health<0||s.health>20||s.gaugeMax!==undefined&&(!Number.isInteger(s.gaugeMax)||s.gaugeMax<GAUGE_MAX||s.gaugeMax>GAUGE_MAX+400)||s.gauge<0||s.gauge>gaugeCap(s)||!Number.isInteger(s.wave)||s.wave<1||s.wave>1000||!Number.isInteger(s.rng)||s.rng<=0||s.rng>0xffffffff||!id(s.nextId))return null;
    if(s.freeSummons<0||s.freeSummons>3||!Number.isInteger(s.freeSummons)||s.paidSummons<0||!Number.isInteger(s.paidSummons)||s.trainingDiscount<0||s.trainingDiscount>.5||s.globalAttack<0||typeof s.phoenixUsed!=='boolean')return null;
    if(!['combat','intermission','reward','victory','defeat'].includes(s.phase)||!CHAPTERS[s.chapter])return null;
    for(const u of s.board)if(u){
      // An old checkpoint cannot reveal its birth wave. Start its new age
      // effect here once, rather than inventing past waves or changing rank.
      if(u.birthWave===undefined)u.birthWave=s.wave;
      if(targetingLocked(u.hero)){
        if(!['first','boss','strong','last','random'].includes(u.priority))return null;
        u.priority='random';
      }
    }
    const latestBirthWave=s.wave+(['reward','intermission'].includes(s.phase)?1:0);
    if(s.board.some(u=>u&&(!s.deck.includes(u.hero)||!id(u.uid)||!Number.isInteger(u.rank)||u.rank<1||u.rank>MAX_RANK||!Number.isInteger(u.birthWave)||u.birthWave<1||u.birthWave>latestBirthWave||!numeric(u,['cooldown','windup','attacks','pose','born','harvest','disabled','aim','idleFor'])||u.clock!==undefined&&(!Number.isInteger(u.clock)||u.clock<0||u.clock>11)||!['down','up','left','right'].includes(u.facing)||!(targetingLocked(u.hero)?u.priority==='random':['first','boss','strong','last'].includes(u.priority)))))return null;
    if(s.timeRulerUid===undefined)s.timeRulerUid=null;
    // Time Ruler no longer has a solo bonus; its cached top unit only orders casts.
    if(s.timeRulerUid!==null&&!id(s.timeRulerUid))return null;
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
    if(s.shots.some(e=>e.form!==undefined&&e.form!==null&&!(e.form==='trauma'&&e.hero==='time_magician')||e.proc!==undefined&&typeof e.proc!=='boolean'))return null;
    if(s.shots.some(e=>e.delay!==undefined&&e.reflected!==true||e.reflected!==undefined&&(e.reflected!==true||e.hero!=='aurora'||e.proc!==false||!numeric(e,['delay'])||e.delay<0||e.delay>.42)))return null;
    if(!Array.isArray(s.finishers)||s.finishers.length>100||s.finishers.some(f=>!id(f?.uid)||!id(f.source)||!id(f.target)||!s.deck.includes(f.hero)||!['royal','starfall','mirror'].includes(f.kind)||HERO[f.hero]?.skill.type!==f.kind||!numeric(f,['damage','rank','life','total'])||f.damage<0||f.total<=0||f.life<=0||f.life>f.total||!numeric(f.origin,['x','y'])||!numeric(f.to,['x','y'])||f.kind==='mirror'&&(!numeric(f,['stored'])||f.stored<0||f.cap!==undefined&&(!numeric(f,['cap'])||f.cap<0||f.stored>f.cap/.45+1e-6))))return null;
    if(s.enemies.some(e=>!numeric(e,['divine','divineTime','rage','shield'])||!Number.isInteger(e.divine)||e.divine<0||e.divine>3||e.shield<0||e.rage<0))return null;
    if(s.enemies.some(e=>!numeric(e,['frostStacks','frostTime','ccImmune','frostLock'])||!Number.isInteger(e.frostStacks)||e.frostStacks<0||e.frostStacks>2||e.frostTime<0||e.ccImmune<0||e.frostLock<0||e.ccImmune>s.time+30||e.frostLock>s.time+30))return null;
    if(!Array.isArray(s.zones)||s.zones.length>ZONE_CAP||s.zones.some(z=>!id(z?.uid)||!id(z.source)||z.source>=s.nextId||!s.deck.includes(z.hero)||!numeric(z,['rank','damage','x','y','radius','life','total','tick'])||!Number.isInteger(z.rank)||z.rank<1||z.rank>MAX_RANK||z.damage<0||z.x<GROUND_BOUNDS.left||z.x>GROUND_BOUNDS.right||z.y<GROUND_BOUNDS.top||z.y>GROUND_BOUNDS.bottom||z.radius<=0||z.radius>720||z.total<=0||z.total>30||z.life<=0||z.life>z.total||z.tick<-.05||z.tick>.5+1e-9||typeof z.orbit!=='boolean'))return null;
    const ids=[...s.board.filter(Boolean),...s.enemies,...s.shots,...s.finishers,...s.zones].map(o=>o.uid);
    if(new Set(ids).size!==ids.length||ids.some(n=>n>=s.nextId))return null;
    if(!Array.isArray(s.bag)||s.bag.length>6||new Set(s.bag).size!==s.bag.length||s.bag.some(h=>!s.deck.includes(h)))return null;
    if(!validArtifacts(s.artifacts)||!Array.isArray(s.reserves)||s.reserves.length>1000||s.reserves.some(h=>!s.deck.includes(h))||!Array.isArray(s.blessings)||s.blessings.length>1000||s.blessings.some(b=>!BLESSING[b]))return null;
    if(!record(s.upgrades)||s.deck.some(h=>!Number.isInteger(s.upgrades[h])||s.upgrades[h]<0||s.upgrades[h]>5)||!record(s.buffs)||Object.values(s.buffs).some(n=>!Number.isFinite(n)))return null;
    if(!record(s.buffTotals)||Object.entries(s.buffTotals).some(([k,n])=>!Object.values(ACTIVE_SKILLS).includes(k)||!Number.isFinite(n)||n<0||n>60))return null;
    if(!record(s.buffScale)||Object.entries(s.buffScale).some(([k,n])=>!Object.values(ACTIVE_SKILLS).includes(k)||!Number.isFinite(n)||n<1||n>rankControl(MAX_RANK)+1e-9))return null;
    if(!numeric(s.stats,['kills','merges','summons','skills','damage'])||!record(s.stats.income)||!record(s.stats.byHero)||Object.values(s.stats.income).some(n=>!Number.isFinite(n))||Object.entries(s.stats.byHero).some(([h,n])=>!HERO[h]||!Number.isFinite(n)))return null;
    if(s.telegraph&&(!id(s.telegraph.uid)||!numeric(s.telegraph,['ends'])||!['seal','heal','drain','rush','storm','duel','creation','stun1','starlust','thunder','shuffle','warp','judgement'].includes(s.telegraph.pattern)||!Array.isArray(s.telegraph.cells)||s.telegraph.cells.some(n=>!Number.isInteger(n)||n<0||n>24)))return null;
    if(s.settlement&&!numeric(s.settlement,['base','dividend']))return null;
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

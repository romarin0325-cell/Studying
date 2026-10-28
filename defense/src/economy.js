import {HERO,ARTIFACT,ARTIFACTS,ROSTER,HIDDEN,LATE_UNLOCK_STAGE,LATE_COMPANIONS,TUNING as T} from './content.js';

export const HOUR=3600000;
// Season guardian of a calendar month (UTC+9). The six guardians retain the original rotation;
// Behemoth joins the regular summon pool after stage45, alongside Venom.
export const guardianOf=(year,month)=>HIDDEN[((year*12+month)%HIDDEN.length+HIDDEN.length)%HIDDEN.length];
// The next months (as {year,month}) in which a hidden hero is the guardian, starting with this month.
export function guardianMonths(id,now=Date.now(),count=2){
  const d=new Date(now+9*HOUR),out=[];let y=d.getUTCFullYear(),m=d.getUTCMonth();
  for(let i=0;i<HIDDEN.length*count+1&&out.length<count;i++){if(guardianOf(y,m)===id)out.push({year:y,month:m+1});if(++m>11){m=0;y++;}}
  return out;
}
export function calendar(now=Date.now()){
  const d=new Date(now+9*HOUR),day=d.toISOString().slice(0,10),month=day.slice(0,7);
  const monday=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-(d.getUTCDay()+6)%7));
  // Normal-banner pickup: the standard URs rotate every Monday (UTC+9).
  const weekNo=Math.round((monday.getTime()-Date.UTC(1970,0,5))/(7*24*HOUR));
  return {day,month,weekNo,week:monday.toISOString().slice(0,10),guardian:guardianOf(d.getUTCFullYear(),d.getUTCMonth()),pickup:heroPool('UR',false)[weekNo%heroPool('UR',false).length]};
}
export const duplicateCost=e=>Math.ceil(T.duplicateGrowth**e);
export const enhanceMultiplier=e=>1+T.enhanceStep*e;
export const specialMultiplier=e=>1+T.specialStep*Math.floor(e/T.specialEvery);
export const levelCost=level=>Math.ceil(T.levelCostBase*T.levelCostGrowth**(level-1));
// Relic unique effects grow by a constant per level; duplicate cost is what phases.
export const RELIC_LEVEL_STEP=.05;
export const relicLevel=entry=>entry?.owned?entry.enhance+1:0;
export const relicScale=level=>1+RELIC_LEVEL_STEP*Math.max(0,level-1);
export const RELIC_COST_STEP=Object.freeze([1,1,2,2,3,4,5,6,7,12,16,21,27,34,42,51,61,72,84]);
export const RELIC_COST_MULT=Object.freeze({C:1,R:.4,SR:.25,UR:.12});
export function relicCost(rarity,enhance){
  const e=Math.max(0,enhance|0),last=RELIC_COST_STEP.length-1,step=e<=last?RELIC_COST_STEP[e]:RELIC_COST_STEP[last]+14*(e-last);
  return Math.max(1,Math.round(step*(RELIC_COST_MULT[rarity]??1)));
}
export const relicPhase=enhance=>enhance<4?'early':enhance<9?'mid':'late';
export const COLLECTION_WEIGHT=Object.freeze({C:1,R:1.5,SR:2,UR:3});
export const COLLECTION_OWN_BONUS=2;
export const COLLECTION_POINTS_PER_PERCENT=30;
export function relicPoints(id,entry){return entry?.owned?COLLECTION_WEIGHT[ARTIFACT[id].rarity]*(relicLevel(entry)+COLLECTION_OWN_BONUS):0;}
export const collectionPoints=relics=>ARTIFACTS.reduce((n,a)=>n+relicPoints(a.id,relics?.[a.id]),0);
export const collectionBonus=relics=>collectionPoints(relics)/COLLECTION_POINTS_PER_PERCENT/100;
// Dream greenhouse. Every bed is shared by all companions; duplicates stay personal.
export const BED_IDS=Object.freeze(['rose','spring','seed','crit','critDamage','stardust']);
// Two gardens of three beds each: the dream greenhouse (from the start) and the dawn greenhouse (opens at stage 45).
export const GARDENS=Object.freeze([{id:'dream',beds:['rose','spring','seed']},{id:'dawn',beds:['crit','critDamage','stardust']}]);
// Retained old price for one +0.5%p purchase. Thirty new purchases cover the same
// dust intervals as all38 old purchases. A smooth log-price bridge then joins the half-price tail.
export const legacyCritCost=level=>Math.ceil(400*1.09**Math.min(level,27)*1.15**Math.max(0,Math.min(level,38)-27)*1.2**Math.max(0,level-38));
function resampledCritCost(level){
  const from=level*38/30,to=(level+1)*38/30;let price=0;
  for(let i=Math.floor(from);i<Math.ceil(to);i++)price+=Math.max(0,Math.min(to,i+1)-Math.max(from,i))*legacyCritCost(i);
  return Math.ceil(price-1e-8);
}
export function critBedCost(level){
  if(level<30)return resampledCritCost(level);
  const b=T.beds.crit,tail=legacyCritCost(b.resampleFrom+level-b.knee2)*b.afterSoftCapPrice;
  const t=Math.min(1,(level-b.knee2+1)/b.priceTransition),smooth=t*t*(3-2*t);
  const anchor=resampledCritCost(b.knee2-1)/(legacyCritCost(b.resampleFrom-1)*b.afterSoftCapPrice);
  return Math.ceil(tail*anchor**(1-smooth)-1e-8);
}
export const bedCost=(id,level)=>{if(id==='crit')return critBedCost(level);const b=T.beds[id],rise=b.rise??b.knee,k2=b.knee2??Infinity;return Math.ceil(b.base*b.growth**Math.min(level,rise)*b.steep**Math.max(0,Math.min(level,k2)-rise)*(b.steep2??b.steep)**Math.max(0,level-k2));};
export const bedOpen=(id,cleared)=>cleared>=T.beds[id].unlock;
// Dawn garden effects. Linear and unbounded: crit chance +0.5%p/level (20% at 30), crit damage +2%/level (200% at 25),
// stardust +1%/level (+50% at 49). The soft cap is the price, not a hard max.
export const critChance=level=>.05+.005*level;
export const critDamage=level=>1.5+.02*level;
export const stardustRate=level=>.01+.01*level;
// Garden bonuses require their bed unlock; the base5%/150% critical applies before the dawn garden too.
export const critStats=(beds,cleared)=>({chance:critChance(bedOpen('crit',cleared)?beds?.crit||0:0),damage:critDamage(bedOpen('critDamage',cleared)?beds?.critDamage||0:0)});
export const stardustBonus=(beds,cleared)=>bedOpen('stardust',cleared)?stardustRate(beds?.stardust||0):0;
// Rose: +1% power per level. Spring: +1 max starlight per level. Seed: +2 starting gold per level.
export const roseAttack=level=>.01*level;
export const springGauge=level=>120+level;
export const seedGold=level=>2*level;
export const heroMultiplier=(entry,beds)=>(1+roseAttack(beds?.rose||0))*enhanceMultiplier(entry.enhance);
export function combatPower(id,entry,beds,relicBonus=0){
  const h=HERO[id];if(!h||!entry?.owned)return 0;
  const damage=h.damage/(h.interval+.13)*heroMultiplier(entry,beds)*(1+relicBonus);
  const role=h.shape==='single'?1:1.12;
  const support=['hasteAura','powerAura','harmonyAura'].includes(h.trait.type)?1.22:1;
  return Math.round((damage*18*role*support+h.range*.12)*specialMultiplier(entry.enhance));
}
export const dispatchSlots=cleared=>Math.min(4,Math.floor(cleared/9));
const dispatchBase=(power,cleared)=>(32+20*Math.log2(1+power/500))*(1+cleared*T.dispatchStageStep);
export const dispatchReward=(power,cleared)=>{const base=dispatchBase(power,cleared);return {dust:Math.floor(base*T.dispatchDust),dreams:Math.max(1,Math.floor(base*T.dispatchDreams))};};
// The stardust bed is applied when a dispatch is collected, so growing it helps dispatches already under way.
export const dispatchDust=(dust,beds,cleared)=>Math.floor(dust*(1+stardustBonus(beds,cleared)));
export const stageReward=stage=>T.firstClearBase+T.firstClearStep*stage;
export const PERFECT_REWARD=100;
export function relicTier(draws){return Math.max(0,Math.floor(Math.log(1+draws*(T.relicThresholdGrowth-1)/T.relicThresholdBase)/Math.log(T.relicThresholdGrowth)+1e-12));}
export const relicThreshold=tier=>Math.ceil(T.relicThresholdBase*(T.relicThresholdGrowth**tier-1)/(T.relicThresholdGrowth-1));
// Rates by tier share q=t/(t+half): 0 at tier 0, approaching 1 (the limit row of the rates ladder) as the tier grows.
export function relicRatesAt(q){const ur=.0005+.0195*q,sr=.0045+.1355*q,r=.035+.255*q;return [1-r-sr-ur,r,sr,ur];}
export const relicTierRates=t=>relicRatesAt(t/(t+T.relicProbabilityHalf));
export function relicRates(draws){return relicTierRates(relicTier(draws));}
export function rollIndex(rates,value){let sum=0;for(let i=0;i<rates.length;i++){sum+=rates[i];if(value<sum)return i;}return rates.length-1;}
export const lateOpen=cleared=>cleared>=LATE_UNLOCK_STAGE;
export function heroPool(rarity,open=true){return (ROSTER[rarity]||[]).filter(id=>open||!LATE_COMPANIONS.includes(id));}
// A UR from the season banner is the monthly guardian half the time; from the normal
// banner it is this week's pickup half the time.
export function drawCharacter(random,season,guardian,pickup=null,urMult=1,open=true){
  const base=T.heroRates,ur=base[3]*urMult,rates=[base[0]-(ur-base[3]),base[1],base[2],ur];
  const rarity=['C','R','SR','UR'][rollIndex(rates,random())];
  if(rarity==='UR'&&season&&random()<.5&&(open||!LATE_COMPANIONS.includes(guardian)))return guardian;
  if(rarity==='UR'&&!season&&pickup&&random()<.5)return pickup;
  const pool=heroPool(rarity,open);return pool[Math.floor(random()*pool.length)];
}
export function drawRelic(random,draws){const rarity=['C','R','SR','UR'][rollIndex(relicRates(draws),random())],pool=Object.values(ARTIFACT).filter(a=>a.rarity===rarity);return pool[Math.floor(random()*pool.length)].id;}
export function idleReward(profile,now){const elapsed=Math.max(0,Math.min(T.idleHours*HOUR,now-profile.idleAt));return Math.floor(elapsed/HOUR*(T.idleDustPerHour+profile.cleared*2)*(1+stardustBonus(profile.beds,profile.cleared)));}

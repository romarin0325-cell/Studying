import {HERO,ARTIFACT,ARTIFACTS,ROSTER,HIDDEN,TUNING as T} from './content.js';

export const HOUR=3600000;
export function calendar(now=Date.now()){
  const d=new Date(now+9*HOUR),day=d.toISOString().slice(0,10),month=day.slice(0,7);
  const monday=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-(d.getUTCDay()+6)%7));
  // Normal-banner pickup: the standard URs rotate every Monday (UTC+9).
  const weekNo=Math.round((monday.getTime()-Date.UTC(1970,0,5))/(7*24*HOUR));
  return {day,month,weekNo,week:monday.toISOString().slice(0,10),guardian:HIDDEN[d.getUTCMonth()%6],pickup:ROSTER.UR[weekNo%ROSTER.UR.length]};
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
export const BED_IDS=Object.freeze(['rose','spring','seed']);
export const bedCost=(id,level)=>{const b=T.beds[id],rise=b.rise??b.knee,k2=b.knee2??Infinity;return Math.ceil(b.base*b.growth**Math.min(level,rise)*b.steep**Math.max(0,Math.min(level,k2)-rise)*(b.steep2??b.steep)**Math.max(0,level-k2));};
export const bedOpen=(id,cleared)=>cleared>=T.beds[id].unlock;
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
export const stageReward=stage=>T.firstClearBase+T.firstClearStep*stage;
export const PERFECT_REWARD=100;
export function relicTier(draws){return Math.max(0,Math.floor(Math.log(1+draws*(T.relicThresholdGrowth-1)/T.relicThresholdBase)/Math.log(T.relicThresholdGrowth)+1e-12));}
export const relicThreshold=tier=>Math.ceil(T.relicThresholdBase*(T.relicThresholdGrowth**tier-1)/(T.relicThresholdGrowth-1));
export function relicRates(draws){const t=relicTier(draws),q=t/(t+T.relicProbabilityHalf),ur=.0005+.0195*q,sr=.0045+.1355*q,r=.035+.255*q;return [1-r-sr-ur,r,sr,ur];}
export function rollIndex(rates,value){let sum=0;for(let i=0;i<rates.length;i++){sum+=rates[i];if(value<sum)return i;}return rates.length-1;}
export function heroPool(rarity){return ROSTER[rarity]||[];}
// A UR from the season banner is the monthly guardian half the time; from the normal
// banner it is this week's pickup half the time.
export function drawCharacter(random,season,guardian,pickup=null,urMult=1){
  const base=T.heroRates,ur=base[3]*urMult,rates=[base[0]-(ur-base[3]),base[1],base[2],ur];
  const rarity=['C','R','SR','UR'][rollIndex(rates,random())];
  if(rarity==='UR'&&season&&random()<.5)return guardian;
  if(rarity==='UR'&&!season&&pickup&&random()<.5)return pickup;
  const pool=ROSTER[rarity];return pool[Math.floor(random()*pool.length)];
}
export function drawRelic(random,draws){const rarity=['C','R','SR','UR'][rollIndex(relicRates(draws),random())],pool=Object.values(ARTIFACT).filter(a=>a.rarity===rarity);return pool[Math.floor(random()*pool.length)].id;}
export function idleReward(profile,now){const elapsed=Math.max(0,Math.min(T.idleHours*HOUR,now-profile.idleAt));return Math.floor(elapsed/HOUR*(T.idleDustPerHour+profile.cleared*2));}

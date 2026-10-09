import {HERO,ARTIFACT,ROSTER,HIDDEN,TUNING as T} from './content.js';

export const HOUR=3600000;
export function calendar(now=Date.now()){
  const d=new Date(now+9*HOUR),day=d.toISOString().slice(0,10),month=day.slice(0,7);
  const monday=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-(d.getUTCDay()+6)%7));
  // Normal-banner pickup: the six standard URs rotate every Monday (UTC+9).
  const weekNo=Math.round((monday.getTime()-Date.UTC(1970,0,5))/(7*24*HOUR));
  return {day,month,week:monday.toISOString().slice(0,10),guardian:HIDDEN[d.getUTCMonth()%6],pickup:ROSTER.UR[weekNo%ROSTER.UR.length]};
}
export const duplicateCost=e=>Math.ceil(T.duplicateGrowth**e);
export const enhanceMultiplier=e=>1+T.enhanceStep*e;
export const specialMultiplier=e=>1+T.specialStep*Math.floor(e/T.specialEvery);
export const levelCost=level=>Math.ceil(T.levelCostBase*T.levelCostGrowth**(level-1));
// Dream greenhouse. Every bed is shared by all companions; duplicates stay personal.
export const BED_IDS=Object.freeze(['rose','spring','seed']);
export const bedCost=(id,level)=>{const b=T.beds[id],k2=b.knee2??Infinity;return Math.ceil(b.base*b.growth**Math.min(level,b.knee)*b.steep**Math.max(0,Math.min(level,k2)-b.knee)*(b.steep2??b.steep)**Math.max(0,level-k2));};
export const bedOpen=(id,cleared)=>cleared>=T.beds[id].unlock;
// Rose: +1% power per level. Spring: +3 max starlight to 150, then +1. Seed: +4 starting gold to +40, then +2.
export const roseAttack=level=>.01*level;
export const springGauge=level=>120+3*Math.min(level,10)+Math.max(0,level-10);
export const seedGold=level=>4*Math.min(level,10)+2*Math.max(0,level-10);
export const heroMultiplier=(entry,beds)=>(1+roseAttack(beds?.rose||0))*enhanceMultiplier(entry.enhance);
export function combatPower(id,entry,beds){
  const h=HERO[id];if(!h||!entry?.owned)return 0;
  const damage=h.damage/(h.interval+.13)*heroMultiplier(entry,beds);
  const role=h.shape==='single'?1:1.12;
  const support=['hasteAura','powerAura','harmonyAura'].includes(h.trait.type)?1.22:1;
  return Math.round((damage*18*role*support+h.range*.12)*specialMultiplier(entry.enhance));
}
export const dispatchSlots=cleared=>Math.min(4,Math.floor(cleared/9));
const dispatchBase=(power,cleared)=>(32+20*Math.log2(1+power/500))*(1+cleared*T.dispatchStageStep);
export const dispatchReward=(power,cleared)=>{const base=dispatchBase(power,cleared);return {dust:Math.floor(base*T.dispatchDust),dreams:Math.max(1,Math.floor(base*T.dispatchDreams))};};
export const stageReward=stage=>T.firstClearBase+T.firstClearStep*stage;
export function relicTier(draws){return Math.max(0,Math.floor(Math.log(1+draws*(T.relicThresholdGrowth-1)/T.relicThresholdBase)/Math.log(T.relicThresholdGrowth)+1e-12));}
export const relicThreshold=tier=>Math.ceil(T.relicThresholdBase*(T.relicThresholdGrowth**tier-1)/(T.relicThresholdGrowth-1));
export function relicRates(draws){const t=relicTier(draws),q=t/(t+T.relicProbabilityHalf),ur=.0005+.0195*q,sr=.0045+.1355*q,r=.035+.255*q;return [1-r-sr-ur,r,sr,ur];}
export function rollIndex(rates,value){let sum=0;for(let i=0;i<rates.length;i++){sum+=rates[i];if(value<sum)return i;}return rates.length-1;}
export function heroPool(rarity){return ROSTER[rarity]||[];}
// A UR from the season banner is the monthly guardian half the time; from the normal
// banner it is this week's pickup half the time.
export function drawCharacter(random,season,guardian,pickup=null){
  const rarity=['C','R','SR','UR'][rollIndex(T.heroRates,random())];
  if(rarity==='UR'&&season&&random()<.5)return guardian;
  if(rarity==='UR'&&!season&&pickup&&random()<.5)return pickup;
  const pool=ROSTER[rarity];return pool[Math.floor(random()*pool.length)];
}
export function drawRelic(random,draws){const rarity=['C','R','SR','UR'][rollIndex(relicRates(draws),random())],pool=Object.values(ARTIFACT).filter(a=>a.rarity===rarity);return pool[Math.floor(random()*pool.length)].id;}
export function idleReward(profile,now){const elapsed=Math.max(0,Math.min(T.idleHours*HOUR,now-profile.idleAt));return Math.floor(elapsed/HOUR*(T.idleDustPerHour+profile.cleared*2));}

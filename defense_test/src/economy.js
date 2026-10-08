import {HERO,ARTIFACT,ROSTER,HIDDEN,TUNING as T} from './content.js';

export const HOUR=3600000;
export function calendar(now=Date.now()){
  const d=new Date(now+9*HOUR),day=d.toISOString().slice(0,10),month=day.slice(0,7);
  const monday=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-(d.getUTCDay()+6)%7));
  return {day,month,week:monday.toISOString().slice(0,10),guardian:HIDDEN[d.getUTCMonth()%6]};
}
export const duplicateCost=e=>Math.ceil(T.duplicateGrowth**e);
export const enhanceMultiplier=e=>1+T.enhanceStep*e;
export const specialMultiplier=e=>1+T.specialStep*Math.floor(e/T.specialEvery);
export const levelCost=level=>Math.ceil(T.levelCostBase*T.levelCostGrowth**(level-1));
// The garden level is shared by every companion; duplicates stay personal.
export const heroMultiplier=(entry,garden=1)=>(1+T.levelStep*(garden-1))*enhanceMultiplier(entry.enhance);
export function combatPower(id,entry,garden=1){
  const h=HERO[id];if(!h||!entry?.owned)return 0;
  const damage=h.damage/(h.interval+.13)*heroMultiplier(entry,garden);
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
export function drawCharacter(random,season,guardian){
  const rarity=['C','R','SR','UR'][rollIndex(T.heroRates,random())];
  if(rarity==='UR'&&season&&random()<.5)return guardian;
  const pool=ROSTER[rarity];return pool[Math.floor(random()*pool.length)];
}
export function drawRelic(random,draws){const rarity=['C','R','SR','UR'][rollIndex(relicRates(draws),random())],pool=Object.values(ARTIFACT).filter(a=>a.rarity===rarity);return pool[Math.floor(random()*pool.length)].id;}
export function idleReward(profile,now){const elapsed=Math.max(0,Math.min(T.idleHours*HOUR,now-profile.idleAt));return Math.floor(elapsed/HOUR*(T.idleDustPerHour+profile.cleared*2));}

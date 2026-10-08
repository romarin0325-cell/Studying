import * as source from './data.js';

// This game's copied definitions and art are maintained independently.
// Rarity deliberately carries no stat multiplier; the author will balance it.
export const RARITIES = ['C','R','SR','UR'];
export const RARITY = {
  C:{name:'커먼',color:'#88aaa3',motif:'잎'},
  R:{name:'레어',color:'#68b8dd',motif:'물결'},
  SR:{name:'슈퍼레어',color:'#bd95ed',motif:'별'},
  UR:{name:'얼티밋레어',color:'#e6be6c',motif:'왕관'},
};
export const ROSTER = {
  C:['star_boy','snow_rabbit','silver_rabbit','night_rabbit','siren','mushroom_king'],
  R:['great_detective','guardian','avalanche_maid','santa','red_dragon','aurora'],
  SR:['storm_sage','flame_sage','lightning_sage','time_magician','ancient_dragon','phantom'],
  UR:['zeke','luna','jasmine','queen','rumi','cherry_prince'],
};
export const HIDDEN = ['time_ruler','galaxy_whale','doom','cinderella','harmonious','frost_witch'];
export const DEFAULT_DECK = ['star_boy','snow_rabbit','night_rabbit','siren','great_detective'];
export const HEROES = [...Object.entries(ROSTER).flatMap(([rarity,ids])=>ids.map(id=>({
  ...source.HERO[id],rarity,hidden:false,name:id==='avalanche_maid'?'메이드':source.HERO[id].name,
}))),...HIDDEN.map(id=>({...source.HERO[id],rarity:'UR',hidden:true}))];
export const HERO = Object.fromEntries(HEROES.map(h=>[h.id,h]));
export const ARTIFACTS = source.ARTIFACTS.map((a,i)=>({...a,rarity:i<10?'C':i<16?'R':i<21?'SR':'UR'}));
export const ARTIFACT = Object.fromEntries(ARTIFACTS.map(a=>[a.id,a]));
export const validArtifacts = ids=>Array.isArray(ids)&&ids.length<=3&&new Set(ids).size===ids.length&&ids.every(id=>ARTIFACT[id]);
export const BOSS_ORDER = ['artificial_demon','flora','love_iris','curse_iris','thor','poseidon','ares','beelzebub','astea'];
export const BOSSES=source.BOSSES;
const worlds=[0,1,0,3,4,2,5,3,6];
export const CHAPTERS=Array.from({length:45},(_,id)=>{
  const cycle=Math.floor(id/9)+1,boss=BOSS_ORDER[id%9],base=source.STAGE_THEMES[worlds[id%9]];
  return {...base,id,name:`${base.name}`,caption:`${cycle}번째 별길 · ${BOSSES[boss].name}`,bosses:[boss,boss,boss],
    hp:1+2.5*id/8,cycle,stage:id+1};
});
export const VERSION=source.VERSION,GRID=source.GRID,MAX_RANK=source.MAX_RANK;
export const BLESSINGS=source.BLESSINGS,BLESSING=source.BLESSING,TRANSFORM_ART=source.TRANSFORM_ART;
export const ASSET_PATHS=source.ASSET_PATHS;
export const TUNING=Object.freeze({
  heroDrawCost:100,relicDrawCost:80,heroRates:[.70,.25,.048,.002],
  // Stat renewal v1: duplicates +5% each with a support milestone every 5.
  // levelCost* only converts old garden-level saves into greenhouse beds.
  duplicateGrowth:1.58,enhanceStep:.05,levelStep:.04,levelCostBase:90,levelCostGrowth:1.12,
  specialStep:.10,specialEvery:5,dispatchHours:20,dispatchStageStep:.05,
  // Dispatch pays mostly dust; a small crystal share keeps it worth sending once dust is spare.
  dispatchDust:1.25,dispatchDreams:.25,
  idleHours:20,idleDustPerHour:14,firstClearBase:160,firstClearStep:10,
  // Dream greenhouse beds: fast early levels, then a cost knee as a soft cap (no hard cap).
  beds:{rose:{unlock:0,base:60,growth:1.13,knee:20,steep:1.28},spring:{unlock:15,base:120,growth:1.22,knee:10,steep:1.45},seed:{unlock:30,base:200,growth:1.2,knee:10,steep:1.4}},
  relicThresholdBase:30,relicThresholdGrowth:2.2,relicProbabilityHalf:3,
});
export const QUOTES={
  star_boy:['오늘은 어떤 별을 만나게 될까?','떨어진 별도, 여기선 다시 빛날 수 있어.'],
  snow_rabbit:['천천히 자라도 괜찮아. 같이 기다릴게.','작은 발자국이 모이면 길이 되니까.'],
  night_rabbit:['밤이 깊을수록 우리 별은 더 밝아져.','오늘도 이 정원을 지켜 줄게.'],
  siren:['당신이 돌아오면 정원에 노래가 흘러.','파견을 떠난 동료에게도 이 노래가 닿을까?'],
  great_detective:['새로운 별길의 단서가 보이는군요.','좋은 팀은 다섯 가지 답을 함께 찾죠.'],
};

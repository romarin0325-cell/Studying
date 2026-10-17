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
  UR:['zeke','luna','jasmine','queen','rumi','cherry_prince','behemoth'],
};
export const HIDDEN = ['time_ruler','galaxy_whale','doom','cinderella','harmonious','frost_witch'];
export const DEFAULT_DECK = ['star_boy','snow_rabbit','night_rabbit','siren','great_detective'];
export const HEROES = [...Object.entries(ROSTER).flatMap(([rarity,ids])=>ids.map(id=>({
  ...source.HERO[id],rarity,hidden:false,name:id==='avalanche_maid'?'메이드':source.HERO[id].name,
}))),...HIDDEN.map(id=>({...source.HERO[id],rarity:'UR',hidden:true}))];
export const HERO = Object.fromEntries(HEROES.map(h=>[h.id,h]));
// Relic rarity follows the data order: 12 C, 6 R, 6 SR, 3 UR (rows of three in the collection).
export const ARTIFACTS = source.ARTIFACTS.map((a,i)=>({...a,rarity:i<12?'C':i<18?'R':i<24?'SR':'UR'}));
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
// Weekly draft and monthly boss rush: three tiers over 18 waves (rounds).
// from/to are main-stage equivalents of the first and last wave; long runs also grow the board, so
// late waves add `late` extra health (quadratic in run progress). Rewards scale with `reward`.
export const CHALLENGE_WAVES=18;
export const TIERS=Object.freeze({
  easy:{name:'쉬움',unlock:3,from:4,to:14,late:1.2,boss:1,monthly:1.3,reward:1},
  hard:{name:'어려움',unlock:18,from:15,to:30,late:2,boss:1.15,monthly:.57,reward:1.5},
  abyss:{name:'심연',unlock:36,from:28,to:48,late:3.4,boss:1.3,monthly:.39,reward:2.2},
});
export const TIER_IDS=Object.keys(TIERS);
export const VERSION=source.VERSION,GRID=source.GRID,MAX_RANK=source.MAX_RANK;
export const BLESSINGS=source.BLESSINGS,BLESSING=source.BLESSING,TRANSFORM_ART=source.TRANSFORM_ART;
export const ASSET_PATHS=source.ASSET_PATHS;
export const TUNING=Object.freeze({
  heroDrawCost:100,relicDrawCost:80,heroRates:[.70,.25,.048,.002],pity:{normal:200,season:200},
  // Gift basket: one gift every 8 hours (candy → letter → bouquet), up to three waiting.
  basketHours:8,basketMax:3,dailyBonus:30,
  // Stat renewal v1: duplicates +5% each with a support milestone every 5.
  // levelCost* only converts old garden-level saves into greenhouse beds.
  duplicateGrowth:1.58,enhanceStep:.05,levelStep:.04,levelCostBase:90,levelCostGrowth:1.12,
  specialStep:.10,specialEvery:5,dispatchHours:24,dispatchStageStep:.05,
  // Dispatch pays mostly dust; a small crystal share keeps it worth sending once dust is spare.
  dispatchDust:1.5,dispatchDreams:.3,
  idleHours:20,idleDustPerHour:14,firstClearBase:160,firstClearStep:10,
  // Dream greenhouse beds (docs/GARDEN_BALANCE.md): a steady slope to the knee, a firmer one to knee2, then a soft cap.
  // Each bed's knee meets the next bed's opening (rose 25 ≈ stage 15, spring 18 ≈ stage 30). Later beds start at the
  // price of that stage's income and meet the earlier beds' prices in the soft cap. knee is the bloom (만개) stage.
  beds:{rose:{unlock:0,base:120,growth:1.05,knee:25,steep:1.09,knee2:42,steep2:1.2},spring:{unlock:15,base:300,growth:1.06,knee:18,steep:1.09,knee2:28,steep2:1.2},seed:{unlock:30,base:700,growth:1.06,knee:12,steep:1.09,knee2:20,steep2:1.2}},
  relicThresholdBase:30,relicThresholdGrowth:2.2,relicProbabilityHalf:3,
});

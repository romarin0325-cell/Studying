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
  C:['star_boy','snow_rabbit','silver_rabbit','night_rabbit','siren','mushroom_king','underdog','joker','sunflower'],
  R:['great_detective','guardian','avalanche_maid','santa','red_dragon','aurora','toffee_apple'],
  SR:['storm_sage','flame_sage','lightning_sage','time_magician','ancient_dragon','phantom'],
  UR:['zeke','luna','jasmine','queen','rumi','cherry_prince'],
};
// Season guardians in rotation order (one per month). Behemoth joined as the seventh; see guardianOf().
export const HIDDEN = ['time_ruler','galaxy_whale','doom','cinderella','harmonious','frost_witch','behemoth'];
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
// Main stages: two parts of 45 (five chapters of nine). Part two opens when stage 45 is cleared and keeps the
// same enemy-health slope; its chapters are the same worlds at dawn.
export const PART_STAGES=45,MAIN_STAGES=90,CHAPTER_STAGES=9;
export const PARTS=Object.freeze([
  {id:1,name:'달빛의 별길',chapters:['달빛 정원','별무리 숲','은하 사원','시간의 탑','창조의 끝']},
  {id:2,name:'새벽의 별길',chapters:['새벽 정원','이슬 숲','노을 사원','되감긴 탑','창조의 시작']},
]);
const DAWN_NAMES=['새벽 정원','깨어난 숲의 노래','맑은 심연','여명의 왕좌','벼락 새벽의 첨탑','잿불의 성채','재창세의 성원'];
export const CHAPTERS=Array.from({length:MAIN_STAGES},(_,id)=>{
  const cycle=Math.floor(id/9)+1,part=id<PART_STAGES?1:2,boss=BOSS_ORDER[id%9],themeAt=worlds[id%9],base=source.STAGE_THEMES[themeAt];
  return {...base,id,name:part===1?`${base.name}`:DAWN_NAMES[themeAt],caption:`${cycle}번째 별길 · ${BOSSES[boss].name}`,bosses:[boss,boss,boss],
    hp:1+2.5*id/8,cycle,stage:id+1,part};
});
// Companions that join the garden the first time a stage is cleared (a temporary arrangement: Behemoth is
// still a guardian-rotation hidden companion as well).
export const CLEAR_UNLOCKS=Object.freeze({45:['behemoth']});
// Companions added after the first 45 stages open to the normal summon and the collection only once stage 45
// has been cleared (before that the summon pool and the collection are exactly what they were). Every new
// companion goes on this list.
export const LATE_UNLOCK_STAGE=45;
export const LATE_COMPANIONS=Object.freeze(['behemoth','underdog','toffee_apple','joker','sunflower']);
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
  beds:{rose:{unlock:0,base:120,growth:1.05,knee:25,steep:1.09,knee2:42,steep2:1.2},spring:{unlock:15,base:300,growth:1.06,knee:18,steep:1.09,knee2:28,steep2:1.2},seed:{unlock:30,base:700,growth:1.06,knee:12,steep:1.09,knee2:20,steep2:1.2},
    // Second garden (opens with part two): price grows by `growth` to `rise` (70% of the soft-cap level), by `steep`
    // from there to `knee2` (the soft-cap level), by `steep2` after; effects are linear and unbounded, so the soft cap
    // comes from price. See docs/DAWN_GARDEN.md for the pacing model.
    crit:{unlock:45,base:400,growth:1.09,rise:27,knee:27,steep:1.15,knee2:38,steep2:1.2},
    critDamage:{unlock:45,base:500,growth:1.13,rise:18,knee:18,steep:1.19,knee2:25,steep2:1.2},
    stardust:{unlock:60,base:1200,growth:1.05,rise:34,knee:34,steep:1.11,knee2:49,steep2:1.2}},
  relicThresholdBase:30,relicThresholdGrowth:2.2,relicProbabilityHalf:3,
});

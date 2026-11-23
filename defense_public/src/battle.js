import {heroMultiplier,specialMultiplier,springGauge,seedGold,collectionBonus,relicLevel,critStats,draftHeroEntry} from './economy.js';
import * as engine from './combat/engine.js';
import {TEAM_SIZE} from './team-config.js';
import {season} from './preview/season.js';
import {LEGACY_HOLLOW,OATH_RULES,oathBosses} from './preview/oath.js';
import {twinBosses} from './preview/twin.js';
import {playerAutoPlay} from './smart-auto.js';

export const battleMeta=(profile,deck)=>Object.fromEntries(deck.map(id=>{const entry=draftHeroEntry(profile.heroes[id]);return [id,{power:heroMultiplier(entry,profile.beds),special:specialMultiplier(entry.enhance)}];}));
const pendingDraft=a=>a.mode==='weekly'&&a.draft?.length!==TEAM_SIZE;
function battleSnapshot(profile){
  const a=profile.active;
  return {
    meta:pendingDraft(a)?null:battleMeta(profile,a.deck),
    artifacts:[...(a.mode==='twin'?a.relics||[]:profile.equipped)],
    met:Math.min(9,profile.cleared),
    gaugeMax:springGauge(profile.beds.spring),
    startGold:seedGold(profile.beds.seed),
    crit:critStats(profile.beds,profile.cleared),
  };
}
export function captureBattle(profile){
  const a=profile.active;
  a.snapshot=battleSnapshot(profile);
  a.relicAttack??=collectionBonus(profile.relics);
  a.relicLevels??=Object.fromEntries(a.snapshot.artifacts.map(id=>[id,relicLevel(profile.relics[id])]));
}
// The engine takes oath IDs, so pass the old board rule only for an expedition already in progress.
const battleOaths=(a,ids)=>a.oathRules<OATH_RULES?ids.map(id=>id==='hollow'?LEGACY_HOLLOW:id):ids;
export function createBattle(profile){
  const a=profile.active;if(!a||pendingDraft(a))return null;
  const {meta,artifacts,met,gaugeMax,startGold,crit}=a.snapshot??battleSnapshot(profile);
  const twin=a.mode==='twin',index=a.mode==='oath'||twin?season(a.started).index:0;
  const relicAttack=a.relicAttack??collectionBonus(profile.relics),relicLevels=a.relicLevels??Object.fromEntries(artifacts.map(id=>[id,relicLevel(profile.relics[id])]));
  const oaths=a.mode==='oath'?a.oaths||[]:[];
  const run=engine.newRun({deck:a.deck,chapter:a.stage-1,seed:a.seed,artifacts,meta:structuredClone(meta),
    relicAttack,relicLevels,mode:a.mode,boon:a.boon,tier:a.tier||'easy',met,gaugeMax,startGold,crit,
    oaths:battleOaths(a,oaths),side:twin?a.side??null:null,lineup:a.mode==='oath'?oathBosses(index,met):twin?twinBosses(index,a.side,met):null});
  run.oaths=[...oaths];
  if(a.mode==='weekly'){run.globalAttack=.05*a.boon;run.gauge=Math.min(run.gaugeMax,run.gauge+(TEAM_SIZE-a.boon)*4);}
  // Monthly: a boss that reaches the core (7 damage) ends the challenge.
  if(a.mode==='monthly')run.health=engine.MONTHLY_HEALTH;
  return run;
}
export function resumeBattle(profile){
  const a=profile.active;if(!a?.run)return null;
  let saved;try{saved=JSON.parse(a.run);}catch{return null;}
  if(!saved||typeof saved!=='object')return null;
  const oaths=saved.oaths===undefined?[]:saved.oaths;
  if(!Array.isArray(oaths)||JSON.stringify(oaths)!==JSON.stringify(a.oaths??[]))return null;
  saved.oaths=battleOaths(a,oaths);
  const s=engine.restore(saved);if(!s||s.mode!==a.mode||s.chapter!==a.stage-1||s.deck.join()!==a.deck.join())return null;
  s.oaths=oaths;
  const expected=createBattle(profile);
  if(!expected||JSON.stringify(s.meta)!==JSON.stringify(expected.meta)||s.relicAttack!==expected.relicAttack||JSON.stringify(s.relicLevels||{})!==JSON.stringify(expected.relicLevels)||(s.gaugeMax||engine.GAUGE_MAX)!==expected.gaugeMax||s.critRevision===2&&s.crit!==undefined&&JSON.stringify(s.crit)!==JSON.stringify(expected.crit)||s.artifacts.join()!==expected.artifacts.join()||s.boon!==a.boon||s.seed!==a.seed||(s.tier||'easy')!==(a.tier||'easy'))return null;
  return s;
}
export const autoPlay=playerAutoPlay;
export const clearedRounds=s=>Math.max(0,s.wave-(s.phase==='reward'||s.phase==='victory'?0:1));

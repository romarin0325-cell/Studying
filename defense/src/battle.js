import {heroMultiplier,specialMultiplier,springGauge,seedGold,collectionBonus,relicLevel,critStats} from './economy.js';
import * as engine from './combat/engine.js';
import {TEAM_SIZE} from './team-config.js';
import {season} from './preview/season.js';
import {oathBosses} from './preview/oath.js';
import {twinBosses} from './preview/twin.js';
import {playerAutoPlay} from './smart-auto.js';

export const battleMeta=(profile,deck)=>Object.fromEntries(deck.map(id=>[id,{power:heroMultiplier(profile.heroes[id],profile.beds),special:specialMultiplier(profile.heroes[id].enhance)}]));
export function createBattle(profile){
  const a=profile.active;if(!a||a.mode==='weekly'&&a.draft?.length!==TEAM_SIZE)return null;
  const meta=battleMeta(profile,a.deck),twin=a.mode==='twin',artifacts=twin?a.relics||[]:profile.equipped;
  const relicAttack=a.relicAttack??collectionBonus(profile.relics),relicLevels=a.relicLevels??Object.fromEntries((twin?artifacts:profile.equipped).map(id=>[id,relicLevel(profile.relics[id])]));
  const met=Math.min(9,profile.cleared),index=a.mode==='oath'||twin?season(a.started).index:0;
  const run=engine.newRun({deck:a.deck,chapter:a.stage-1,seed:a.seed,artifacts,meta,
    relicAttack,relicLevels,mode:a.mode,boon:a.boon,tier:a.tier||'easy',met,
    gaugeMax:springGauge(profile.beds.spring),startGold:seedGold(profile.beds.seed),crit:critStats(profile.beds,profile.cleared),
    oaths:a.mode==='oath'?a.oaths||[]:[],side:twin?a.side??null:null,lineup:a.mode==='oath'?oathBosses(index,met):twin?twinBosses(index,a.side,met):null});
  if(a.mode==='weekly'){run.globalAttack=.05*a.boon;run.gauge=Math.min(run.gaugeMax,run.gauge+(TEAM_SIZE-a.boon)*4);}
  // Monthly: a boss that reaches the core (7 damage) ends the challenge.
  if(a.mode==='monthly')run.health=engine.MONTHLY_HEALTH;
  return run;
}
export function resumeBattle(profile){
  const a=profile.active;if(!a?.run)return null;
  const s=engine.restore(a.run);if(!s||s.mode!==a.mode||s.chapter!==a.stage-1||s.deck.join()!==a.deck.join())return null;
  const expected=createBattle(profile);
  if(!expected||JSON.stringify(s.meta)!==JSON.stringify(expected.meta)||s.relicAttack!==expected.relicAttack||JSON.stringify(s.relicLevels||{})!==JSON.stringify(expected.relicLevels)||(s.gaugeMax||engine.GAUGE_MAX)!==expected.gaugeMax||s.critRevision===2&&s.crit!==undefined&&JSON.stringify(s.crit)!==JSON.stringify(expected.crit)||s.artifacts.join()!==expected.artifacts.join()||s.boon!==a.boon||s.seed!==a.seed||(s.tier||'easy')!==(a.tier||'easy'))return null;
  return s;
}
export const autoPlay=playerAutoPlay;
export const clearedRounds=s=>Math.max(0,s.wave-(s.phase==='reward'||s.phase==='victory'?0:1));

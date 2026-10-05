import {HERO} from './content.js';
import {heroMultiplier,specialMultiplier} from './economy.js';
import * as engine from './combat/engine.js';
import {TEAM_SIZE} from './team-config.js';

export function createBattle(profile){
  const a=profile.active;if(!a||a.mode==='weekly'&&a.draft?.length!==TEAM_SIZE)return null;
  const meta=Object.fromEntries(a.deck.map(id=>[id,{power:heroMultiplier(profile.heroes[id]),special:specialMultiplier(profile.heroes[id].enhance)}]));
  const run=engine.newRun({deck:a.deck,chapter:a.stage-1,seed:a.seed,artifacts:profile.equipped,meta,
    relicAttack:profile.equipped.reduce((n,id)=>n+.02*profile.relics[id].enhance,0),mode:a.mode,boon:a.boon});
  if(a.mode==='weekly'){run.globalAttack=.05*a.boon;run.gauge=Math.min(engine.GAUGE_MAX,run.gauge+(TEAM_SIZE-a.boon)*4);}
  if(a.mode==='monthly')run.health=8;
  return run;
}
export function resumeBattle(profile){
  const a=profile.active;if(!a?.run)return null;
  const s=engine.restore(a.run);if(!s||s.mode!==a.mode||s.chapter!==a.stage-1||s.deck.join()!==a.deck.join())return null;
  const expected=createBattle(profile);
  if(!expected||JSON.stringify(s.meta)!==JSON.stringify(expected.meta)||s.relicAttack!==expected.relicAttack||s.artifacts.join()!==expected.artifacts.join()||s.boon!==a.boon||s.seed!==a.seed)return null;
  return s;
}
// Optional helper keeps idle play moving; it never changes targets or placement.
// Manual moves, merges, purchases and skills always remain available.
export function autoPlay(s){
  if(s.phase==='reward')return engine.chooseReward(s,s.reward.includes('oath')?'oath':s.reward[0]);
  if(!['combat','intermission'].includes(s.phase))return;
  const occupied=s.board.flatMap((u,i)=>u?[i]:[]);
  for(const from of occupied){const to=occupied.find(i=>engine.canMerge(s.board[from],s.board[i]));if(to!==undefined){engine.move(s,from,to);return;}}
  if(s.board.filter(Boolean).length<23&&s.gold>=engine.summonCost(s)){engine.summon(s);return;}
  if(s.enemies.some(e=>e.boss)&&s.gauge>=60){
    const best=s.deck.filter(id=>engine.bestUnit(s,id)&&s.gauge>=HERO[id].skill.cost&&s.gold>=engine.skillGoldCost(id)).sort((a,b)=>(HERO[b].bossDamage||1)-(HERO[a].bossDamage||1));
    if(best.length){engine.cast(s,best[0]);return;}
  }
  const id=s.deck.find(id=>s.upgrades[id]<5&&s.gold>=engine.upgradeCost(s,id));if(id)engine.upgrade(s,id);
}
export const clearedRounds=s=>Math.max(0,s.wave-(s.phase==='reward'||s.phase==='victory'?0:1));

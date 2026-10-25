// Deterministic pass 18 presentation fixture. Both columns receive the same real engine state and events; only the
// renderer differs (and, for Zeke's "before" column, his pre-pass-18 cleave shape, swapped in by review.js).
import * as E from '../../../src/combat/engine.js';
// Enemies on the right edge of the route, beside cell 14 where the reviewed companion stands.
const PACK=[600,690,770,840,905,980,1060,1150];
export const ENTRIES=Object.freeze([
  {key:'zeke',hero:'zeke',modes:['attack']},
  {key:'behemoth',hero:'behemoth',modes:['attack']},
  {key:'demon_king',hero:'demon_king',modes:['attack','skill']},
  {key:'miracle_larva',hero:'miracle_larva',form:'miracle_larva',modes:['attack','skill']},
  {key:'miracle_cocoon',hero:'miracle_larva',form:'miracle_cocoon',modes:['attack','skill']},
  {key:'miracle_wing',hero:'miracle_larva',form:'miracle_wing',modes:['attack']},
  {key:'abyss_wing',hero:'miracle_larva',form:'abyss_wing',modes:['attack']},
  {key:'orbit',hero:'star_boy',artifacts:['orbit'],label:'별바다의 궤도',modes:['attack']},
]);
export function reviewScene(entry,{mode='attack',chapter=0,debuffs=true}={}){
  const id=entry.hero,deck=[id,...['siren','queen','storm_sage','great_detective','zeke'].filter(x=>x!==id)].slice(0,5);
  const s=E.newRun({deck,chapter,seed:261026,artifacts:entry.artifacts||[]});
  const template={...s.board.find(Boolean)};s.board.fill(null);
  const place=(i,hero,rank,form)=>{s.board[i]={...template,uid:s.nextId++,hero,rank,cooldown:99,windup:0,pose:0,disabled:0,cursed:false,aim:0,facing:'down',...(hero==='miracle_larva'?{form:form||'miracle_larva'}:{})};if(hero!=='miracle_larva')delete s.board[i].form;};
  place(14,id,3,entry.form);place(6,'siren',1);place(16,'queen',1);
  // Eclosion hatches every larva and cocoon on the field: two more show both outcomes of the 50% roll.
  if(mode==='skill'&&id==='miracle_larva'){place(9,'miracle_larva',2,'miracle_larva');place(19,'miracle_larva',2,'miracle_cocoon');}
  s.queue=[{kind:'boss',hp:1e7}];s.spawnIn=0;E.step(s,.001);
  const enemy={...s.enemies[0]};
  s.enemies=PACK.map((progress,i)=>({...structuredClone(enemy),uid:s.nextId++,kind:i===3?'boss':'grunt',boss:i===3?enemy.boss:null,progress,speed:0,skillIn:99,hp:1e7,maxHp:1e7,statusEffects:[],slowEffects:[]}));
  // The Death Hand counts live debuff kinds per target: give the pack 0 to 4 kinds.
  if(debuffs)s.enemies.forEach((e,i)=>{const kinds=['slow','burn','poison','exposure'].slice(0,i%5);for(const type of kinds){const a={type,amount:type==='slow'?.3:1,until:s.time+30,owner:'siren',source:`review:${type}:${e.uid}`,...(type==='poison'?{power:1}:{})};(type==='slow'?e.slowEffects:e.statusEffects).push(a);}});
  s.queue=[{kind:'grunt',hp:1e7}];s.spawnIn=999;s.events=[];s.time=0;s.gauge=120;s.gold=300;
  if(mode==='attack')s.board[14].cooldown=0;
  if(mode==='skill'){const result=E.cast(s,id);if(!result.ok)throw Error(result.reason);}
  return {state:s,advance(dt){E.step(s,dt);return s.events.splice(0);}};
}

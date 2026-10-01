// Task-focused comparison, not the full Defense balance suite or a fun score.
// Both versions use the same deterministic policy; reading/decision time is 0.
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import * as current from '../merge/engine.js';
import {DEFAULT_DECK,HERO} from '../merge/content.js';
const baseline=process.argv[2]?await import(pathToFileURL(path.resolve(process.argv[2],'engine.js'))):null;
const newDeck=['doom','santa','jasmine','star_boy','time_magician','cherry_prince'];
function simulate(E,deck,chapter,seed,artifacts=[]){
  const s=E.newRun({deck,chapter,seed,artifacts}),marks={},dt=1/30;
  for(let frame=0;frame<36000&&!['victory','defeat'].includes(s.phase);frame++){
    if(s.phase==='reward')E.chooseReward(s,['arrival','oath','training','purse','surge','mend'].find(id=>s.reward.includes(id)));
    if(frame%15===0&&['combat','intermission'].includes(s.phase)){
      const units=s.board.filter(Boolean);
      if(units.length>=10){let pair=null;for(let i=0;i<25;i++)for(let j=i+1;j<25;j++)if(E.canMerge(s.board[i],s.board[j])&&(!pair||s.board[i].rank<s.board[pair[0]].rank))pair=[i,j];if(pair)E.move(s,...pair);}
      if(s.freeSummons||s.board.filter(Boolean).length<14)E.summon(s);
      const training=s.deck.filter(id=>s.board.some(u=>u?.hero===id)).sort((a,b)=>Math.max(...s.board.filter(u=>u?.hero===b).map(u=>E.power(s,u)))-Math.max(...s.board.filter(u=>u?.hero===a).map(u=>E.power(s,u))));
      if(s.gold>=E.summonCost(s)+28&&training[0])E.upgrade(s,training[0]);
      if(s.enemies.some(e=>e.boss)||s.enemies.length>=4||s.gauge>=99){const ids=[...s.deck].sort((a,b)=>E.power(s,E.bestUnit(s,b)||{hero:b,rank:0})-E.power(s,E.bestUnit(s,a)||{hero:a,rank:0}));for(const id of ids)if(E.cast(s,id).ok)break;}
      if(s.telegraph&&['seal','storm'].includes(s.telegraph.pattern))for(const i of s.telegraph.cells){const safe=s.board.findIndex((u,j)=>!u&&!s.telegraph.cells.includes(j));if(s.board[i]&&safe>=0)E.move(s,i,safe);}
    }
    E.step(s,dt);
    for(const e of s.events){if(e.type==='hit'&&marks.firstHit===undefined)marks.firstHit=s.time;if(e.type==='kill'&&marks.firstKill===undefined)marks.firstKill=s.time;if(e.type==='clear'&&marks.firstReward===undefined)marks.firstReward=s.time;if(e.type==='boss'&&marks.firstBoss===undefined)marks.firstBoss=s.time;}
    s.events=[];
  }
  return {seed,phase:s.phase,wave:s.wave,health:s.health,seconds:s.time,skills:s.stats.skills,merges:s.stats.merges,...marks};
}
const median=a=>{const n=a.filter(Number.isFinite).sort((a,b)=>a-b);return n.length?Math.round(n[Math.floor(n.length/2)]*10)/10:null;};
const groups=[];
for(const [version,E,deck,chapters,artifacts=[]] of [["before",baseline,DEFAULT_DECK,[0,3]],["after-original",current,DEFAULT_DECK,[0,3,4,5,6]],["after-new",current,newDeck,[0,4,5,6]],["after-new-relics",current,newDeck,[4,5,6],["tempo_bell","royal_seal","broken_clock"]],["after-mixed",current,["zeke","snow_rabbit","rumi","jasmine","star_boy","doom"],[4,5,6]]])if(E)for(const chapter of chapters){
  const runs=[31,97,283,743,1709,3571].map(seed=>simulate(E,deck,chapter,seed,artifacts));
  const summary={version,chapter,deck,artifacts,runs:6,wins:runs.filter(r=>r.phase==='victory').length,medianWave:median(runs.map(r=>r.wave)),...Object.fromEntries(['firstHit','firstKill','firstReward','firstBoss','seconds','skills','merges'].map(k=>[k,median(runs.map(r=>r[k]))]))};
  groups.push({summary,runs});console.log(JSON.stringify(summary));
}
await writeFile(new URL('../docs/art/expansion/review/pacing.json',import.meta.url),JSON.stringify({policy:'Same 0.5-second action policy; immediate blessing selection, 30 Hz; no player reading time. Six fixed seeds per configuration. Not a player study.',groups},null,2)+'\n');

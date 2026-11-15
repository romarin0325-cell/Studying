// Practical value of each companion in real main stages: a fixed four-member core plus the companion as the fifth,
// played start to finish with the measurement auto and the real in-run economy (gold, summons, merges). Unlike the
// contribution bench (simulate.mjs, unlimited gold, fixed boards) this counts gold makers and run-long growth.
// The result feeds auto formation (src/practical.js).
//   node defense/scripts/practical-stage-bench.mjs [--seeds 4] [--jobs 4] [--json out.json] [--write]
// --write regenerates src/practical.js from this run.
import fs from 'node:fs/promises';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {isMainThread,Worker,parentPort,workerData} from 'node:worker_threads';
import {HEROES,HERO,levelOf} from '../src/content.js';
import {heroMultiplier,specialMultiplier,springGauge,seedGold} from '../src/economy.js';
import * as engine from '../src/combat/engine.js';
import {smartAutoPlay} from '../src/smart-auto.js';
import {clearedRounds} from '../src/battle.js';

// Three cores a player meets on the way up, each with a spare for when the candidate is in the core, at two stages
// near the point where an average fifth member wins about half the time.
const CORES=[
  {id:'common',deck:['star_boy','snow_rabbit','night_rabbit','siren'],spare:'silver_rabbit',stages:[21,23]},
  {id:'rare',deck:['great_detective','guardian','red_dragon','mushroom_king'],spare:'avalanche_maid',stages:[19,21]},
  {id:'super',deck:['storm_sage','time_magician','ancient_dragon','avalanche_maid'],spare:'phantom',stages:[27,29]},
];
const DT=.05,AUTO=.32,LIMIT=900/DT;
const bedsFor=stage=>{const s=levelOf(stage);return {rose:Math.min(45,3+s),spring:s>=15?Math.min(30,3*(s-14)):0,seed:s>=30?Math.min(20,2*(s-29)):0};};
function play(deck,stage,seed){
  const beds=bedsFor(stage),meta=Object.fromEntries(deck.map(id=>[id,{power:heroMultiplier({enhance:0},beds),special:specialMultiplier(0)}]));
  const s=engine.newRun({deck,chapter:stage-1,seed,meta,mode:'main',gaugeMax:springGauge(beds.spring),startGold:seedGold(beds.seed)});
  let autoIn=0,pick=false,ticks=0;
  while(s.phase!=='victory'&&s.phase!=='defeat'&&ticks<LIMIT){
    const before=s.phase;engine.step(s,DT);ticks++;
    if(pick){smartAutoPlay(s);autoIn=0;pick=false;}else if(before!=='reward'&&s.phase==='reward')pick=true;
    else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=DT;if(autoIn>=AUTO){smartAutoPlay(s);autoIn=0;}}
    s.events.length=0;
  }
  // Score: rounds cleared (0-6), a win adds the core health left (0-20) scaled to two rounds.
  const won=s.phase==='victory';return clearedRounds(s)+(won?1+s.health/20:0);
}
function job(id,seeds){
  const rows=[];
  for(const core of CORES){const deck=[...core.deck.map(x=>x===id?core.spare:x),id];
    for(const stage of core.stages)for(let seed=1;seed<=seeds;seed++)rows.push({core:core.id,stage,score:play(deck,stage,1000+seed*7919+stage)});}
  return {id,rows};
}
if(!isMainThread){parentPort.postMessage(workerData.ids.map(id=>job(id,workerData.seeds)));}
else{
  const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf('--'+n);return i<0?f:args[i+1];};
  const seeds=Number(opt('seeds',4)),jobs=Math.max(1,Number(opt('jobs',Math.min(8,os.cpus().length-1)))),out=opt('json',null);
  const ids=HEROES.map(h=>h.id),chunks=Array.from({length:jobs},(_,i)=>ids.filter((_,k)=>k%jobs===i)),started=Date.now();
  const parts=await Promise.all(chunks.map(chunk=>new Promise((resolve,reject)=>{const w=new Worker(fileURLToPath(import.meta.url),{workerData:{ids:chunk,seeds}});w.once('message',resolve);w.once('error',reject);})));
  const results=parts.flat(),byId=Object.fromEntries(results.map(r=>[r.id,r]));
  // Index: mean score per core and stage, relative to the mean over all companions there, then averaged.
  const keys=CORES.flatMap(c=>c.stages.map(stage=>c.id+':'+stage));
  const cell=(r,key)=>{const [core,stage]=key.split(':');const xs=r.rows.filter(x=>x.core===core&&x.stage===Number(stage)).map(x=>x.score);return xs.reduce((a,b)=>a+b,0)/xs.length;};
  const mean=Object.fromEntries(keys.map(k=>[k,ids.reduce((a,id)=>a+cell(byId[id],k),0)/ids.length]));
  const index=Object.fromEntries(ids.map(id=>[id,keys.reduce((a,k)=>a+cell(byId[id],k)/mean[k],0)/keys.length]));
  const rows=ids.map(id=>({id,name:HERO[id].name,rarity:HERO[id].rarity,index:index[id],cells:Object.fromEntries(keys.map(k=>[k,cell(byId[id],k)]))})).sort((a,b)=>b.index-a.index);
  console.log(`| 동료 | 등급 | 지수 | ${keys.join(' | ')} |\n|---|---|---:|${keys.map(()=>'---:').join('|')}|`);
  for(const r of rows)console.log(`| ${r.name} | ${r.rarity} | ${r.index.toFixed(3)} | ${keys.map(k=>r.cells[k].toFixed(2)).join(' | ')} |`);
  console.log('\nmeans '+JSON.stringify(Object.fromEntries(keys.map(k=>[k,Number(mean[k].toFixed(3))])))+` · ${seeds} seeds · ${((Date.now()-started)/1000).toFixed(0)}s`);
  if(out)await fs.writeFile(out,JSON.stringify({seeds,cores:CORES,means:mean,rows},null,2)+'\n');
  if(args.includes('--write')){
    const table=Object.fromEntries(ids.map(id=>[id,Number(index[id].toFixed(3))]));
    await fs.writeFile(new URL('../src/practical.js',import.meta.url),`// Practical value of each companion for auto formation (1 = the average companion), measured in real main stages
// by scripts/practical-stage-bench.mjs: three cores (common, rare, super rare) plus the companion as the fifth member,
// two stages each, ${seeds} seeds, measurement auto, real in-run gold. Regenerate after a balance patch:
//   node defense/scripts/practical-stage-bench.mjs --write
export const PRACTICAL=Object.freeze(${JSON.stringify(table)});
`);console.log('wrote src/practical.js');
  }
}

// Weekly draft / monthly boss rush difficulty bench (18 waves, three tiers) with the smart auto.
//   node defense/scripts/challenge-sim.mjs [--mode weekly|monthly|both] [--tiers easy,hard,abyss]
//     [--growth 12,26,42] [--anchors 24,52,84] [--target 0.75] [--seeds 4] [--jobs 1]
//     [--decks "a,b,c,d,e;..."] [--load-powers powers.json] [--json out.json]
// --growth (default): greenhouse hero power at that main stage, no crit. The old bench.
// --anchors: for each deck, P(G) is the hero multiplier at which that deck clears main stage G
//   in --target of plays. The search is a log-scale bisection, the same one as power-need.mjs.
//   Spring and seed come from bedsFor(G), capped as in stage-sim. Crit is stage-sim's dawn model:
//   none at G<=45, mid (13% / 180%) at 46-70, full (20% / 200%) above 70. The challenge then
//   runs at that P(G) and crit. P(G) is cached per deck for the run; --load-powers reuses a
//   previous --json file so a later tier tweak does not search again.
import fs from 'node:fs/promises';
import {isMainThread, Worker, parentPort, workerData} from 'node:worker_threads';
import {HERO,CHALLENGE_WAVES,TIERS} from '../src/content.js';
import {heroMultiplier,specialMultiplier,springGauge,seedGold} from '../src/economy.js';
import * as engine from '../src/combat/engine.js';
import {clearedRounds} from '../src/battle.js';
import {smartAutoPlay} from '../src/smart-auto.js';

const DT=.05,AUTO=.32,MAIN_TICKS=900/DT,CHALLENGE_TICKS=36000;
const ORIGINAL_DECKS=[
  ['star_boy','snow_rabbit','night_rabbit','siren','santa'],
  ['zeke','luna','jasmine','ancient_dragon','great_detective'],
  ['flame_sage','red_dragon','zeke','cherry_prince','siren'],
  ['silver_rabbit','jasmine','galaxy_whale','cherry_prince','aurora'],
  ['snow_rabbit','avalanche_maid','frost_witch','guardian','storm_sage'],
];
// Late companions, for the 90-stage anchors. Checked with engine.validDeck at startup.
const LATE_DECKS=[
  ['joker','sunflower','underdog','star_boy','siren'],
  ['venom','ash','cure_master','antropy','luna'],
  ['behemoth','zeke','queen','ancient_dragon','great_detective'],
];

const bedsFor=stage=>({rose:Math.min(45,3+stage),spring:stage>=15?Math.min(30,3*(stage-14)):0,seed:stage>=30?Math.min(20,2*(stage-29)):0});
// stage-sim --dawn mid / full. None until the dawn garden opens.
const critFor=stage=>stage<=45?null:stage<=70?{chance:.13,damage:1.8}:{chance:.2,damage:2};
const critName=stage=>stage<=45?'none':stage<=70?'mid':'full';
const deckKey=deck=>deck.join(',');
const powerKey=(deck,stage)=>deckKey(deck)+'|'+stage;

function stepUntil(s,limitTicks,clearBeforeAuto){
  let autoIn=0,pick=false,ticks=0;
  while(s.phase!=='victory'&&s.phase!=='defeat'&&ticks<limitTicks){
    const before=s.phase;engine.step(s,DT);ticks++;
    if(clearBeforeAuto)s.events.length=0;
    if(pick){smartAutoPlay(s);if(!clearBeforeAuto)autoIn=0;pick=false;}
    else if(before!=='reward'&&s.phase==='reward')pick=true;
    else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=DT;if(autoIn>=AUTO){smartAutoPlay(s);autoIn=0;}}
    if(!clearBeforeAuto)s.events.length=0;
  }
  return {won:s.phase==='victory',rounds:clearedRounds(s)};
}
function playMain(deck,stage,power,seed){
  const beds=bedsFor(stage),meta=Object.fromEntries(deck.map(id=>[id,{power,special:specialMultiplier(0)}]));
  const s=engine.newRun({deck,chapter:stage-1,seed,meta,mode:'main',gaugeMax:springGauge(beds.spring),startGold:seedGold(beds.seed),crit:critFor(stage)});
  return stepUntil(s,MAIN_TICKS,false);
}
// power null: greenhouse multiplier, no crit (the --growth bench). A number: anchor model.
function playChallenge(deck,tier,stage,seed,mode,power){
  const beds=bedsFor(stage),anchored=power!=null,heroPower=anchored?power:heroMultiplier({enhance:0},beds);
  const meta=Object.fromEntries(deck.map(id=>[id,{power:heroPower,special:specialMultiplier(0)}]));
  const s=engine.newRun({deck,chapter:seed%9,seed,meta,mode,tier,gaugeMax:springGauge(beds.spring),startGold:seedGold(beds.seed),met:Math.max(1,Math.min(9,stage)),...(anchored&&critFor(stage)?{crit:critFor(stage)}:{})});
  if(mode==='monthly')s.health=engine.MONTHLY_HEALTH;else s.gauge=Math.min(s.gaugeMax,s.gauge+deck.length*4);
  return stepUntil(s,CHALLENGE_TICKS,true);
}
function winRate(deck,stage,power,seeds){
  let won=0;for(let seed=1;seed<=seeds;seed++)if(playMain(deck,stage,power,seed).won)won++;
  return won/seeds;
}
// Smallest power on the log bisection that still clears `target` of the seeds. Same shape as power-need.mjs.
function findPower(deck,stage,seeds,target,cache){
  const key=powerKey(deck,stage);
  if(cache.has(key))return cache.get(key);
  let lo=1,hi=1;
  while(winRate(deck,stage,hi,seeds)<target&&hi<4000)hi*=2;
  lo=hi/2<1?1:hi/2;
  for(let i=0;i<7;i++){const mid=Math.sqrt(lo*hi);if(winRate(deck,stage,mid,seeds)>=target)hi=mid;else lo=mid;}
  cache.set(key,hi);return hi;
}
function runDeck(job){
  const cache=new Map(Object.entries(job.cached||{}));
  const powers=[],rows=[];
  for(const [i,tier] of job.tiers.entries()){
    const stage=job.stages[i];
    const power=job.useAnchors?findPower(job.deck,stage,job.seeds,job.target,cache):null;
    if(job.useAnchors)powers.push({deck:deckKey(job.deck),stage,power,crit:critName(stage)});
    for(const mode of job.modes){
      const runs=Array.from({length:job.seeds},(_,k)=>playChallenge(job.deck,tier,stage,k+1,mode,power));
      rows.push({mode,tier,growth:stage,deck:deckKey(job.deck),power,clear:runs.filter(r=>r.won).length/runs.length,rounds:runs.reduce((n,r)=>n+r.rounds,0)/runs.length,min:Math.min(...runs.map(r=>r.rounds)),max:Math.max(...runs.map(r=>r.rounds)),samples:runs.map(r=>({won:r.won,rounds:r.rounds}))});
    }
  }
  return {powers,rows};
}

if(!isMainThread){
  const started=Date.now();
  try{parentPort.postMessage(runDeck(workerData));}
  finally{console.error(`deck ${deckKey(workerData.deck)} ${((Date.now()-started)/1000).toFixed(1)}s`);}
}else{
  const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf('--'+n);return i<0?f:args[i+1];};
  const MODE=opt('mode','weekly'),TIER_LIST=opt('tiers','easy,hard,abyss').split(','),SEEDS=Number(opt('seeds',4));
  const useAnchors=args.includes('--anchors'),TARGET=Number(opt('target',.75)),JOBS=Math.max(1,Number(opt('jobs',1))||1);
  const JSON_OUT=opt('json',null),LOAD=opt('load-powers',null);
  const MODES=MODE==='both'?['weekly','monthly']:[MODE];
  if(!['weekly','monthly','both'].includes(MODE))throw new Error('--mode weekly|monthly|both');
  if(args.includes('--growth')&&useAnchors)throw new Error('use either --growth or --anchors');
  if(args.includes('--target')&&!useAnchors)throw new Error('--target is used with --anchors');
  if(TIER_LIST.some(t=>!TIERS[t]))throw new Error('--tiers must name tiers');
  if(!Number.isInteger(SEEDS)||SEEDS<1)throw new Error('--seeds must be a positive integer');
  if(useAnchors&&!(TARGET>0&&TARGET<=1))throw new Error('--target must be in (0,1]');
  const STAGES=(useAnchors?opt('anchors','24,52,84'):opt('growth','12,26,42')).split(',').map(Number);
  if(STAGES.length!==TIER_LIST.length||STAGES.some(s=>!Number.isInteger(s)||s<1||s>90))throw new Error(useAnchors?'--anchors must be one stage 1..90 per tier':'--growth must be one stage 1..90 per tier');
  const fallback=useAnchors?[...ORIGINAL_DECKS,...LATE_DECKS]:ORIGINAL_DECKS;
  const DECKS=(opt('decks',null)?.split(';')??fallback.map(d=>d.join(','))).map(text=>text.split(',').map(id=>id.trim()).filter(Boolean));
  if(!DECKS.length)throw new Error('At least one deck is required');
  for(const deck of DECKS)if(!engine.validDeck(deck))throw new Error('Invalid deck: '+deck.join(','));

  const loaded=LOAD?JSON.parse(await fs.readFile(LOAD,'utf8')):null;
  const loadedPowers=new Map();
  for(const row of loaded?.powers??[])loadedPowers.set(row.deck+'|'+row.stage,row.power);
  const jobs=DECKS.map(deck=>{
    const cached={};
    if(useAnchors)for(const stage of STAGES){const key=powerKey(deck,stage);if(loadedPowers.has(key))cached[key]=loadedPowers.get(key);}
    return {deck,tiers:TIER_LIST,stages:STAGES,seeds:SEEDS,target:TARGET,modes:MODES,useAnchors,cached};
  });
  const started=Date.now();
  const parts=await runAll(jobs,JOBS);
  const rows=parts.flatMap(p=>p.rows),powers=parts.flatMap(p=>p.powers);
  if(useAnchors){
    console.log(`앵커 위력 P(G) · 목표 승률 ${(TARGET*100).toFixed(0)}% · 시드 ${SEEDS} · 봄/씨앗 bedsFor · 치명 ${'none≤45 / mid 46-70 / full>70'}`);
    for(const p of powers)console.log(`P(${p.stage}) ${p.deck.split(',').map(id=>HERO[id].name).join('·')} = ${p.power.toFixed(2)} (crit ${p.crit})`);
    console.log('');
  }
  for(const row of rows){
    const label=useAnchors?`앵커 ${row.growth}, 위력 ${row.power.toFixed(2)}`:`성장 ${row.growth}`;
    console.log(`${row.mode} ${TIERS[row.tier].name} (${label}) · ${row.deck.split(',').map(id=>HERO[id].name).join('·')} · 클리어 ${(row.clear*100).toFixed(0)}% · 평균 ${row.rounds.toFixed(1)}/${CHALLENGE_WAVES} (${row.min}~${row.max})`);
  }
  for(const mode of MODES)for(const tier of TIER_LIST){
    const t=rows.filter(r=>r.mode===mode&&r.tier===tier);
    console.log(`== ${mode} ${TIERS[tier].name}: 클리어 ${(t.reduce((n,r)=>n+r.clear,0)/t.length*100).toFixed(0)}% · 평균 ${(t.reduce((n,r)=>n+r.rounds,0)/t.length).toFixed(1)}웨이브`);
  }
  console.error(`elapsed ${((Date.now()-started)/1000).toFixed(1)}s`);
  if(JSON_OUT)await fs.writeFile(JSON_OUT,JSON.stringify({mode:MODE,useAnchors,target:useAnchors?TARGET:null,tiers:TIER_LIST,stages:STAGES,seeds:SEEDS,powers,rows},null,2)+'\n');
}

function runAll(jobs,jobsLimit){
  if(jobsLimit<=1||jobs.length===1)return Promise.resolve(jobs.map(runDeck));
  const results=new Array(jobs.length);let cursor=0;
  const limit=Math.min(jobsLimit,jobs.length);
  const worker=async()=>{
    while(cursor<jobs.length){
      const index=cursor++;
      results[index]=await new Promise((resolve,reject)=>{
        const child=new Worker(new URL(import.meta.url),{workerData:jobs[index]});
        let settled=false;
        child.once('message',message=>{settled=true;resolve(message);});
        child.once('error',reject);
        child.once('exit',code=>{if(!settled&&code!==0)reject(new Error('worker exit '+code));});
      });
    }
  };
  return Promise.all(Array.from({length:limit},()=>worker())).then(()=>results);
}

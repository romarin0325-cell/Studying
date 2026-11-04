// Starlight Oath power-need bench (9 waves). Ratio vs easy with no oaths, priced so +50% enemy HP is 4 points.
//   node defense/scripts/oath-bench.mjs [--stage 72] [--bosses curse_iris,ares,astea]
//     [--target 0.75] [--seeds 4] [--jobs N] [--decks "a,b,c,d,e;..."]
//     [--conditions "tier:oath+oath;..."] [--load prior.json] [--json out.json]
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {isMainThread, Worker, parentPort, workerData} from 'node:worker_threads';
import {HERO,BOSSES} from '../src/content.js';
import {specialMultiplier,springGauge,seedGold} from '../src/economy.js';
import * as engine from '../src/combat/engine.js';
import {clearedRounds} from '../src/battle.js';
import {smartAutoPlay} from '../src/smart-auto.js';
import {oathDeckProblem} from '../src/preview/oath.js';

const DT=.05,AUTO=.32,TICKS=36000;
const BASE_ID='easy:',REF_ID='easy:tough2';
const DEFAULT_CONDITIONS=[
  'easy:','hard:','abyss:',
  'easy:tough1','easy:tough2','easy:tyrant','easy:haste','easy:glass',
  'easy:drought','easy:untrained','easy:purse','easy:heavy','easy:afterglow','easy:scatter',
  'easy:untrained+purse+heavy+scatter',
  'hard:tough2',
].join(';');
const DEFAULT_DECKS=[
  ['star_boy','snow_rabbit','night_rabbit','siren','santa'],
  ['flame_sage','red_dragon','zeke','cherry_prince','siren'],
  ['venom','ash','cure_master','antropy','luna'],
];

const bedsFor=stage=>({rose:Math.min(45,3+stage),spring:stage>=15?Math.min(30,3*(stage-14)):0,seed:stage>=30?Math.min(20,2*(stage-29)):0});
// stage-sim --dawn mid / full. None until the dawn garden opens.
const critFor=stage=>stage<=45?null:stage<=70?{chance:.13,damage:1.8}:{chance:.2,damage:2};
const deckKey=deck=>deck.join(',');
const powerKey=(deck,condition)=>deckKey(deck)+'|'+condition;

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
function play(deck,tier,oaths,stage,seed,power,bosses){
  const beds=bedsFor(stage),meta=Object.fromEntries(deck.map(id=>[id,{power,special:specialMultiplier(0)}]));
  const s=engine.newRun({deck,chapter:seed%9,seed,meta,mode:'oath',tier,met:9,gaugeMax:springGauge(beds.spring),startGold:seedGold(beds.seed),crit:critFor(stage),oaths,lineup:bosses,artifacts:[],relicAttack:0});
  return stepUntil(s,TICKS,true);
}
function winRate(deck,condition,model,power){
  let won=0;
  for(let seed=1;seed<=model.seeds;seed++)if(play(deck,condition.tier,condition.oaths,model.stage,seed,power,model.bosses).won)won++;
  return won/model.seeds;
}
// Smallest power on the log bisection that still clears `target` of the seeds. Same shape as challenge-sim, with 8 steps.
function findPower(deck,condition,model,cache){
  const key=powerKey(deck,condition.id);
  if(cache.has(key))return cache.get(key);
  const rate=power=>winRate(deck,condition,model,power);
  let lo=1,hi=1;
  while(rate(hi)<model.target&&hi<4000)hi*=2;
  lo=hi/2<1?1:hi/2;
  for(let i=0;i<8;i++){const mid=Math.sqrt(lo*hi);if(rate(mid)>=model.target)hi=mid;else lo=mid;}
  cache.set(key,hi);return hi;
}
function runJob(job,cache){
  return {deck:deckKey(job.deck),condition:job.condition.id,power:findPower(job.deck,job.condition,job,cache)};
}

if(!isMainThread){
  const started=Date.now();
  try{
    const result=runJob(workerData,new Map());
    parentPort.postMessage(result);
    console.error(`${result.deck} ${result.condition} ${result.power.toFixed(2)} ${((Date.now()-started)/1000).toFixed(1)}s`);
  }catch(error){
    console.error(error);
    throw error;
  }
}else{
  const started=Date.now();
  const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf('--'+n);return i<0?f:args[i+1];};
  const STAGE=Number(opt('stage',72)),SEEDS=Number(opt('seeds',4)),TARGET=Number(opt('target',.75));
  const JOBS=Math.max(1,Number(opt('jobs',os.availableParallelism()-1))||1);
  const JSON_OUT=opt('json',null),LOAD=opt('load',null);
  const bosses=opt('bosses','curse_iris,ares,astea').split(',').map(id=>id.trim()).filter(Boolean);
  const conditions=parseConditions(opt('conditions',DEFAULT_CONDITIONS));
  const decks=(opt('decks',null)?.split(';')??DEFAULT_DECKS.map(d=>d.join(','))).map(text=>text.split(',').map(id=>id.trim()).filter(Boolean));
  if(!Number.isInteger(STAGE)||STAGE<1)throw new Error('--stage must be a positive integer');
  if(!Number.isInteger(SEEDS)||SEEDS<1)throw new Error('--seeds must be a positive integer');
  if(!(TARGET>0&&TARGET<=1))throw new Error('--target must be in (0,1]');
  if(bosses.length!==3||bosses.some(id=>!BOSSES[id]))throw new Error('--bosses must be three known boss ids');
  if(!conditions.length)throw new Error('At least one condition is required');
  if(!decks.length)throw new Error('At least one deck is required');
  for(const deck of decks)if(!engine.validDeck(deck))throw new Error('Invalid deck: '+deck.join(','));

  const loaded=LOAD?JSON.parse(await fs.readFile(LOAD,'utf8')):null;
  const powers=new Map();
  for(const row of loaded?.results??[]){
    const power=Number(row?.power);
    if(typeof row?.deck==='string'&&typeof row?.condition==='string'&&Number.isFinite(power))powers.set(row.deck+'|'+row.condition,power);
  }
  const jobs=[],queued=new Set();
  for(const deck of decks)for(const condition of conditions){
    const problem=oathDeckProblem(condition.oaths,deck);
    if(problem){console.log(`skip ${deckKey(deck)} ${condition.id}: ${problem}`);continue;}
    const key=powerKey(deck,condition.id);
    if(powers.has(key)||queued.has(key))continue;
    queued.add(key);
    jobs.push({deck,condition,stage:STAGE,seeds:SEEDS,target:TARGET,bosses});
  }
  const parts=await runAll(jobs,JOBS);
  for(const row of parts)powers.set(row.deck+'|'+row.condition,row.power);

  const results=[];
  for(const deck of decks)for(const condition of conditions){
    const key=powerKey(deck,condition.id);
    if(powers.has(key))results.push({deck:deckKey(deck),condition:condition.id,power:powers.get(key)});
  }
  const summary=conditions.map(condition=>{
    const ratios=decks.map(deck=>ratioOf(deckKey(deck),condition.id,powers)).filter(ratio=>ratio>0);
    return ratios.length?{condition:condition.id,ratio:geoMean(ratios)}:null;
  }).filter(Boolean);
  const ref=summary.find(row=>row.condition===REF_ID)?.ratio??null;
  for(const row of summary)row.pts=pressure(row.ratio,ref);

  console.log(`stage ${STAGE} · target ${(TARGET*100).toFixed(0)}% · seeds ${SEEDS} · bosses ${bosses.join(',')} · jobs ${JOBS}`);
  console.log(`pts = 4·ln(ratio)/ln(ratio of ${REF_ID})`);
  for(const deck of decks){
    const key=deckKey(deck),refRatio=ratioOf(key,REF_ID,powers);
    console.log('');
    console.log(`${deck.map(id=>HERO[id].name).join('·')} (${key})`);
    const rows=conditions.filter(condition=>powers.has(powerKey(deck,condition.id))).map(condition=>{
      const power=powers.get(powerKey(deck,condition.id)),ratio=ratioOf(key,condition.id,powers);
      return [condition.id,num(power,2),num(ratio,3),num(pressure(ratio,refRatio),2)];
    });
    if(rows.length)printTable(['condition','P','ratio','pts'],rows);
    else console.log('(no result)');
  }
  console.log('');
  console.log('geometric mean');
  if(summary.length)printTable(['condition','ratio','pts'],summary.map(row=>[row.condition,num(row.ratio,3),num(row.pts,2)]));
  else console.log('(no result)');
  const elapsed=((Date.now()-started)/1000).toFixed(1);
  console.log(`elapsed ${elapsed}s`);
  if(JSON_OUT){
    await fs.mkdir(path.dirname(JSON_OUT),{recursive:true});
    const payload={model:{stage:STAGE,target:TARGET,seeds:SEEDS,bosses},decks:decks.map(deckKey),conditions:conditions.map(condition=>condition.id),results,summary};
    await fs.writeFile(JSON_OUT,JSON.stringify(payload,null,2)+'\n');
  }
}

function parseConditions(text){
  return text.split(';').map(part=>part.trim()).filter(Boolean).map(raw=>{
    const colon=raw.indexOf(':');
    if(colon<0)throw new Error('Condition must be tier:oath+oath: '+raw);
    const tier=raw.slice(0,colon).trim(),rest=raw.slice(colon+1).trim();
    const oaths=rest?rest.split('+').map(id=>id.trim()).filter(Boolean):[];
    if(!tier)throw new Error('Condition is missing a tier: '+raw);
    return {tier,oaths,id:tier+':'+oaths.join('+')};
  });
}
function ratioOf(deck,condition,powers){
  const base=powers.get(deck+'|'+BASE_ID),power=powers.get(deck+'|'+condition);
  return base>0&&power>0?power/base:null;
}
function pressure(ratio,ref){
  if(!(ratio>0)||!(ref>0))return null;
  const den=Math.log(ref);
  return den===0?null:4*Math.log(ratio)/den;
}
function geoMean(values){
  let sum=0;
  for(const value of values)sum+=Math.log(value);
  return Math.exp(sum/values.length);
}
function num(value,digits){return value==null||!Number.isFinite(value)?'—':value.toFixed(digits);}
function printTable(headers,rows){
  console.log('| '+headers.join(' | ')+' |');
  console.log('|'+headers.map((_,i)=>i===0?'---':'---:').join('|')+'|');
  for(const row of rows)console.log('| '+row.join(' | ')+' |');
}
function runAll(jobs,jobsLimit){
  if(!jobs.length)return Promise.resolve([]);
  if(jobsLimit<=1||jobs.length===1){
    const cache=new Map();
    return Promise.resolve(jobs.map(job=>runJob(job,cache)));
  }
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

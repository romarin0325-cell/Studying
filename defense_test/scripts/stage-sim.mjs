// Real-stage difficulty bench. Plays whole main stages with the built-in auto-play.
//   node defense_test/scripts/stage-sim.mjs [--stages 3,9,15,21,27,33,39,45] [--seeds 10] [--decks "id,id,id,id,id;..."] [--rose auto|N] [--json out.json]
import fs from 'node:fs/promises';
import {HERO} from '../src/content.js';
import {heroMultiplier,specialMultiplier,springGauge,seedGold} from '../src/economy.js';
import * as engine from '../src/combat/engine.js';
import {autoPlay,clearedRounds} from '../src/battle.js';

const DT=.05,AUTO=.32,LIMIT=900,LIMIT_TICKS=LIMIT/DT;
const args=process.argv.slice(2);
const opt=(name,fallback)=>{const i=args.indexOf('--'+name);if(i<0)return fallback;const value=args[i+1];if(value===undefined||value.startsWith('--'))throw new Error(`--${name} needs a value`);return value;};

const STAGES=opt('stages','3,9,15,21,27,33,39,45').split(',').map(s=>Number(s.trim()));
const SEEDS=Number(opt('seeds',10));
const ROSE=opt('rose','auto');
const JSON_OUT=opt('json',null);
const DEFAULT_DECKS=[
  ['star_boy','snow_rabbit','night_rabbit','siren','great_detective'],
  ['star_boy','snow_rabbit','night_rabbit','siren','queen'],
  ['star_boy','snow_rabbit','night_rabbit','siren','doom'],
  ['star_boy','snow_rabbit','night_rabbit','siren','santa'],
  ['star_boy','snow_rabbit','night_rabbit','siren','silver_rabbit'],
  ['zeke','luna','jasmine','ancient_dragon','great_detective'],
];
const decks=(opt('decks',null)?.split(';')??DEFAULT_DECKS.map(d=>d.join(','))).map(s=>s.trim()).filter(Boolean).map(text=>{
  const deck=text.split(',').map(id=>id.trim()).filter(Boolean);
  if(!engine.validDeck(deck))throw new Error(`Invalid deck: ${text}`);
  return deck;
});
if(!decks.length)throw new Error('At least one deck is required');
if(!Number.isInteger(SEEDS)||SEEDS<1)throw new Error('--seeds must be a positive integer');
if(!STAGES.length||STAGES.some(stage=>!Number.isInteger(stage)||stage<1||stage>45))throw new Error('--stages must be integers from 1 to 45');
const roseMode=ROSE==='auto'?ROSE:Number(ROSE);
if(roseMode!=='auto'&&(!Number.isInteger(roseMode)||roseMode<0))throw new Error('--rose must be auto or a non-negative integer');

// Greenhouse a player would plausibly have on the way to stage S. Enhance stays 0.
const bedsFor=stage=>({
  rose:roseMode==='auto'?Math.min(45,3+stage):roseMode,
  spring:stage>=15?Math.min(10,stage-14):0,
  seed:stage>=30?Math.min(10,stage-29):0,
});
const metaFor=(deck,beds)=>{
  const entry={enhance:0};
  return Object.fromEntries(deck.map(id=>[id,{power:heroMultiplier(entry,beds),special:specialMultiplier(entry.enhance)}]));
};

function play(deck,stage,seed){
  const beds=bedsFor(stage),meta=metaFor(deck,beds);
  const s=engine.newRun({deck,chapter:stage-1,seed,meta,mode:'main',gaugeMax:springGauge(beds.spring),startGold:seedGold(beds.seed)});
  // Same cadence as the battle frame: step 0.05s, then auto-play once the
  // accumulator reaches 0.32s and resets. Entering reward defers the blessing
  // pick to the next tick, while combat is already paused.
  let autoIn=0,pickBlessing=false,ticks=0;
  while(s.phase!=='victory'&&s.phase!=='defeat'&&ticks<LIMIT_TICKS){
    const before=s.phase;
    engine.step(s,DT);ticks++;
    if(pickBlessing){autoPlay(s);autoIn=0;pickBlessing=false;}
    else if(before!=='reward'&&s.phase==='reward')pickBlessing=true;
    else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=DT;if(autoIn>=AUTO){autoPlay(s);autoIn=0;}}
    s.events.length=0;
  }
  const byHero={};
  for(const [id,value] of Object.entries(s.stats.byHero))byHero[id]=value;
  const income=s.stats.income;
  return {won:s.phase==='victory',timeout:s.phase!=='victory'&&s.phase!=='defeat',health:s.health,rounds:clearedRounds(s),time:ticks*DT,damage:s.stats.damage,byHero,gold:income?Object.values(income).reduce((n,v)=>n+v,0):0,merges:s.stats.merges,skills:s.stats.skills,beds,power:meta[deck[0]].power,special:meta[deck[0]].special,gaugeMax:springGauge(beds.spring),seedGold:seedGold(beds.seed)};
}

const tally=()=>({runs:0,wins:0,timeouts:0,health:0,rounds:0,time:0,damage:0,gold:0,merges:0,skills:0,byHero:{}});
function absorb(agg,sample){
  agg.runs++;if(sample.won)agg.wins++;if(sample.timeout)agg.timeouts++;
  agg.health+=sample.health;agg.rounds+=sample.rounds;agg.time+=sample.time;agg.damage+=sample.damage;agg.gold+=sample.gold;agg.merges+=sample.merges;agg.skills+=sample.skills;
  for(const id of Object.keys(sample.byHero))agg.byHero[id]=(agg.byHero[id]||0)+sample.byHero[id];
}
function view(agg){
  const n=agg.runs,shares=Object.keys(agg.byHero).map(id=>({id,damage:agg.byHero[id],share:agg.damage>0?agg.byHero[id]/agg.damage:0}));
  shares.sort((a,b)=>b.damage-a.damage||(a.id<b.id?-1:a.id>b.id?1:0));
  const damageByHero={};
  for(const id of Object.keys(agg.byHero).sort())damageByHero[id]=n?agg.byHero[id]/n:0;
  return {runs:n,wins:agg.wins,defeats:n-agg.wins-agg.timeouts,timeouts:agg.timeouts,winRate:n?agg.wins/n:0,meanHealth:n?agg.health/n:0,meanClearedRounds:n?agg.rounds/n:0,meanTime:n?agg.time/n:0,meanDamage:n?agg.damage/n:0,meanGold:n?agg.gold/n:0,meanMerges:n?agg.merges/n:0,meanSkills:n?agg.skills/n:0,damageByHero,damageShare:shares.map(({id,share})=>({id,share}))};
}
const pct=rate=>(rate*100).toFixed(1)+'%';
const topText=shares=>shares.slice(0,3).filter(row=>row.share>0).map(row=>`${HERO[row.id]?.name||row.id} ${(row.share*100).toFixed(0)}%`).join(' · ')||'—';
const winText=row=>`${pct(row.winRate)}${row.timeouts?` (초과 ${row.timeouts})`:''}`;
function printTable(deck,rows,overall){
  console.log(`\n## ${deck.map(id=>HERO[id].name).join(' · ')}\n`);
  console.log('| 스테이지 | 성장 | 승률 | 체력 | 라운드 | 시간 | 피해 비중 |');
  console.log('|---:|---|---:|---:|---:|---:|---|');
  for(const row of rows){const b=row.beds;console.log(`| ${row.stage} | 장${b.rose} 샘${b.spring} 씨${b.seed} | ${winText(row)} | ${row.meanHealth.toFixed(2)} | ${row.meanClearedRounds.toFixed(2)} | ${row.meanTime.toFixed(1)}s | ${topText(row.damageShare)} |`);}
  console.log(`| 전체 | | ${winText(overall)} | ${overall.meanHealth.toFixed(2)} | ${overall.meanClearedRounds.toFixed(2)} | ${overall.meanTime.toFixed(1)}s | ${topText(overall.damageShare)} |`);
}

const started=process.hrtime.bigint();
console.log(`스테이지 ${STAGES.join(',')} · 시드 1..${SEEDS} · 장미 ${roseMode} · 강화 0 · 자동 ${AUTO}s · 제한 ${LIMIT}s`);
const results=[];
for(const deck of decks){
  const rows=[],overall=tally();
  for(const stage of STAGES){
    const agg=tally();let sample=null;
    for(let seed=1;seed<=SEEDS;seed++){sample=play(deck,stage,seed);absorb(agg,sample);absorb(overall,sample);}
    const summary=view(agg);
    rows.push({stage,beds:sample.beds,heroPower:sample.power,special:sample.special,gaugeMax:sample.gaugeMax,seedGold:sample.seedGold,...summary});
  }
  const overallView=view(overall);
  results.push({deck,stages:rows,overall:overallView});
  printTable(deck,rows,overallView);
}
const elapsed=Number(process.hrtime.bigint()-started)/1e9;
console.log(`\n${elapsed.toFixed(1)}s`);
if(JSON_OUT){
  const payload={parameters:{stages:STAGES,seeds:SEEDS,rose:roseMode,decks,dt:DT,autoInterval:AUTO,timeLimit:LIMIT,enhance:0,mode:'main'},results};
  await fs.writeFile(JSON_OUT,JSON.stringify(payload,null,2)+'\n');
}

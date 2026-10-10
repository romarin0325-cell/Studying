// Boss-difficulty audit. Plays whole main stages with the built-in auto-play.
//   node defense_test/scripts/boss-audit.mjs [--cycles 0,1] [--seeds 6] [--decks "id,id,id,id,id;..."] [--rose auto|N] [--json out.json]
import fs from 'node:fs/promises';
import {HERO,BOSSES,BOSS_ORDER} from '../src/content.js';
import {heroMultiplier,specialMultiplier,springGauge,seedGold} from '../src/economy.js';
import * as engine from '../src/combat/engine.js';
import {autoPlay,clearedRounds} from '../src/battle.js';

const DT=.05,AUTO=.32,LIMIT=900,LIMIT_TICKS=LIMIT/DT;
const ALL_WAVES=[1,2,3,4,5,6],BOSS_WAVES=[3,6],NORMAL_WAVES=[1,2,4,5];
// Events emitted by bossStep/bossResolve (plus interrupt when Thor's thunder is stunned).
const BOSS_EVENT_TYPES=new Set(['seal','bossCast','drain','shuffle','rush','judgement','warning','curse','interrupt']);
const EVENT_LABEL={seal:'봉인',bossCast:'시전',drain:'흡수',shuffle:'재배치',rush:'워프',judgement:'천벌',judgementHit:'천벌적중',warning:'예고',curse:'저주',interrupt:'차단'};
const PATTERN_LABEL={seal:'봉인',storm:'낙뢰',stun1:'기절',starlust:'시험',thunder:'천둥',shuffle:'재배치',warp:'워프',judgement:'천벌'};

const args=process.argv.slice(2);
const opt=(name,fallback)=>{const i=args.indexOf('--'+name);if(i<0)return fallback;const value=args[i+1];if(value===undefined||value.startsWith('--'))throw new Error(`--${name} needs a value`);return value;};

const CYCLES=opt('cycles','0,1').split(',').map(s=>Number(s.trim()));
const SEEDS=Number(opt('seeds',6));
const ROSE=opt('rose','auto');
const JSON_OUT=opt('json',null);
const DEFAULT_DECKS=[
  ['star_boy','snow_rabbit','night_rabbit','siren','santa'],
  ['zeke','luna','jasmine','ancient_dragon','great_detective'],
  ['flame_sage','red_dragon','zeke','cherry_prince','siren'],
  ['silver_rabbit','jasmine','galaxy_whale','cherry_prince','aurora'],
  ['snow_rabbit','avalanche_maid','frost_witch','guardian','storm_sage'],
];
const decks=(opt('decks',null)?.split(';')??DEFAULT_DECKS.map(d=>d.join(','))).map(s=>s.trim()).filter(Boolean).map(text=>{
  const deck=text.split(',').map(id=>id.trim()).filter(Boolean);
  if(!engine.validDeck(deck))throw new Error(`Invalid deck: ${text}`);
  return deck;
});
if(!decks.length)throw new Error('At least one deck is required');
if(!Number.isInteger(SEEDS)||SEEDS<1)throw new Error('--seeds must be a positive integer');
if(!CYCLES.length||CYCLES.some(cycle=>!Number.isInteger(cycle)||cycle<0||cycle>4))throw new Error('--cycles must be integers from 0 to 4');
const roseMode=ROSE==='auto'?ROSE:Number(ROSE);
if(roseMode!=='auto'&&(!Number.isInteger(roseMode)||roseMode<0))throw new Error('--rose must be auto or a non-negative integer');
const uniqueCycles=[...new Set(CYCLES)];

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

const emptyEvents=()=>({seal:0,bossCast:0,drain:0,shuffle:0,rush:0,judgement:0,judgementHit:0,warning:0,curse:0,interrupt:0,bossCastByPattern:{}});

function play(deck,stage,seed){
  const beds=bedsFor(stage),meta=metaFor(deck,beds);
  const s=engine.newRun({deck,chapter:stage-1,seed,meta,mode:'main',gaugeMax:springGauge(beds.spring),startGold:seedGold(beds.seed)});
  let autoIn=0,pickBlessing=false,ticks=0;
  const waveLoss=[0,0,0,0,0,0,0],waveDur=[0,0,0,0,0,0,0];
  const waveEntered=[false,true,false,false,false,false,false];
  const waveStartHealth=[0,s.health,0,0,0,0,0],waveStartTime=[0,0,0,0,0,0,0];
  let prevWave=s.wave;
  const bossKilled={3:false,6:false},bossSeen={3:false,6:false},lastBossFrac={3:1,6:1};
  const events=emptyEvents();

  const noteEvents=()=>{
    for(const ev of s.events){
      if(BOSS_EVENT_TYPES.has(ev.type)){
        events[ev.type]++;
        if(ev.type==='bossCast'){
          const pattern=ev.pattern||'unknown';
          events.bossCastByPattern[pattern]=(events.bossCastByPattern[pattern]||0)+1;
        }
        if(ev.type==='judgement'&&ev.hit)events.judgementHit++;
      }
      if((s.wave===3||s.wave===6)&&ev.boss){
        if(ev.type==='boss'||ev.type==='kill'||ev.type==='leak')bossSeen[s.wave]=true;
        if(ev.type==='kill')bossKilled[s.wave]=true;
        if(ev.type==='leak')lastBossFrac[s.wave]=0;
      }
    }
  };
  const snapshotBoss=()=>{
    if(s.wave!==3&&s.wave!==6)return;
    const boss=s.enemies.find(e=>e.boss);
    if(boss){
      bossSeen[s.wave]=true;
      lastBossFrac[s.wave]=boss.maxHp>0?boss.hp/boss.maxHp:0;
    }else if(bossKilled[s.wave]||lastBossFrac[s.wave]===0)lastBossFrac[s.wave]=0;
  };
  const closeWave=(wave,time,health)=>{
    if(!waveEntered[wave])return;
    waveLoss[wave]=waveStartHealth[wave]-health;
    waveDur[wave]=time-waveStartTime[wave];
  };

  while(s.phase!=='victory'&&s.phase!=='defeat'&&ticks<LIMIT_TICKS){
    const before=s.phase;
    engine.step(s,DT);ticks++;
    noteEvents();
    snapshotBoss();
    if(s.wave!==prevWave){
      closeWave(prevWave,s.time,s.health);
      prevWave=s.wave;
      waveEntered[s.wave]=true;
      waveStartHealth[s.wave]=s.health;
      waveStartTime[s.wave]=s.time;
    }
    if(pickBlessing){autoPlay(s);autoIn=0;pickBlessing=false;}
    else if(before!=='reward'&&s.phase==='reward')pickBlessing=true;
    else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=DT;if(autoIn>=AUTO){autoPlay(s);autoIn=0;}}
    s.events.length=0;
  }
  closeWave(s.wave,s.time,s.health);
  snapshotBoss();
  const lost=ALL_WAVES.reduce((n,w)=>n+(waveEntered[w]?waveLoss[w]:0),0);
  if(Math.abs(lost-(20-s.health))>1e-6)throw new Error(`health telescope failed: lost=${lost} health=${s.health} stage=${stage} seed=${seed}`);
  const endedDuring={
    3:s.wave===3&&s.phase!=='reward'&&s.phase!=='victory',
    6:s.wave===6&&s.phase!=='reward'&&s.phase!=='victory',
  };
  return {
    won:s.phase==='victory',timeout:s.phase!=='victory'&&s.phase!=='defeat',
    health:s.health,rounds:clearedRounds(s),time:ticks*DT,
    waveLoss,waveDur,waveEntered,bossKilled,bossSeen,bossHpFrac:lastBossFrac,endedDuring,events,beds,
  };
}

const tally=()=>({
  runs:0,wins:0,timeouts:0,health:0,rounds:0,
  waveLoss:[0,0,0,0,0,0,0],waveLossN:[0,0,0,0,0,0,0],
  waveDur:[0,0,0,0,0,0,0],waveDurN:[0,0,0,0,0,0,0],
  bossKilled:{3:0,6:0},bossSeen:{3:0,6:0},
  bossEndedFrac:{3:0,6:0},bossEndedN:{3:0,6:0},
  events:emptyEvents(),
});
function absorb(agg,sample){
  agg.runs++;if(sample.won)agg.wins++;if(sample.timeout)agg.timeouts++;
  agg.health+=sample.health;agg.rounds+=sample.rounds;
  for(const w of ALL_WAVES){
    if(!sample.waveEntered[w])continue;
    agg.waveLoss[w]+=sample.waveLoss[w];agg.waveLossN[w]++;
    agg.waveDur[w]+=sample.waveDur[w];agg.waveDurN[w]++;
  }
  for(const w of BOSS_WAVES){
    if(sample.bossSeen[w]){agg.bossSeen[w]++;if(sample.bossKilled[w])agg.bossKilled[w]++;}
    if(sample.endedDuring[w]){agg.bossEndedN[w]++;agg.bossEndedFrac[w]+=sample.bossHpFrac[w];}
  }
  for(const key of ['seal','bossCast','drain','shuffle','rush','judgement','judgementHit','warning','curse','interrupt']){
    agg.events[key]+=sample.events[key];
  }
  for(const [pattern,count] of Object.entries(sample.events.bossCastByPattern)){
    agg.events.bossCastByPattern[pattern]=(agg.events.bossCastByPattern[pattern]||0)+count;
  }
}
const avg=(sum,n)=>n?sum/n:0;
const meanWaves=(agg,waves,values,counts)=>{
  let sum=0,n=0;
  for(const w of waves){sum+=values[w];n+=counts[w];}
  return avg(sum,n);
};
function eventMeans(agg){
  const n=agg.runs,means={};
  for(const key of ['seal','bossCast','drain','shuffle','rush','judgement','judgementHit','warning','curse','interrupt'])means[key]=avg(agg.events[key],n);
  const bossCastByPattern={};
  for(const [pattern,count] of Object.entries(agg.events.bossCastByPattern))bossCastByPattern[pattern]=avg(count,n);
  means.bossCastByPattern=bossCastByPattern;
  return means;
}
function view(agg){
  const n=agg.runs,means=eventMeans(agg);
  const healthLostByWave={},durationByWave={},bossKillRate={},bossHpFracWhenEnded={};
  for(const w of ALL_WAVES){
    healthLostByWave[w]=avg(agg.waveLoss[w],agg.waveLossN[w]);
    durationByWave[w]=avg(agg.waveDur[w],agg.waveDurN[w]);
  }
  for(const w of BOSS_WAVES){
    bossKillRate[w]=avg(agg.bossKilled[w],agg.bossSeen[w]);
    bossHpFracWhenEnded[w]=avg(agg.bossEndedFrac[w],agg.bossEndedN[w]);
  }
  return {
    runs:n,wins:agg.wins,defeats:n-agg.wins-agg.timeouts,timeouts:agg.timeouts,
    winRate:avg(agg.wins,n),meanHealth:avg(agg.health,n),meanClearedRounds:avg(agg.rounds,n),
    meanBossWaveHealthLost:meanWaves(agg,BOSS_WAVES,agg.waveLoss,agg.waveLossN),
    meanNormalWaveHealthLost:meanWaves(agg,NORMAL_WAVES,agg.waveLoss,agg.waveLossN),
    meanBossWaveDuration:meanWaves(agg,BOSS_WAVES,agg.waveDur,agg.waveDurN),
    meanNormalWaveDuration:meanWaves(agg,NORMAL_WAVES,agg.waveDur,agg.waveDurN),
    healthLostByWave,durationByWave,bossKillRate,bossHpFracWhenEnded,
    bossEndedRuns:{3:agg.bossEndedN[3],6:agg.bossEndedN[6]},
    meanEvents:means,
  };
}

const pct=rate=>(rate*100).toFixed(1)+'%';
const winText=row=>`${pct(row.winRate)}${row.timeouts?` (초과 ${row.timeouts})`:''}`;
function topText(means){
  const rows=[];
  for(const key of ['seal','curse','shuffle','rush','drain','judgement','judgementHit','warning','interrupt']){
    if(means[key]>0)rows.push({label:EVENT_LABEL[key],n:means[key]});
  }
  for(const [pattern,n] of Object.entries(means.bossCastByPattern)){
    if(n>0)rows.push({label:`시전·${PATTERN_LABEL[pattern]||pattern}`,n});
  }
  rows.sort((a,b)=>b.n-a.n||(a.label<b.label?-1:a.label>b.label?1:0));
  return rows.slice(0,3).map(row=>`${row.label} ${row.n.toFixed(1)}`).join(' · ')||'—';
}
const deckLabel=deck=>deck.map(id=>HERO[id].name).join(' · ');
const num=(value,digits)=>value.toFixed(digits);
function printSummary(rows){
  console.log('\n## 보스 요약\n');
  console.log('| 보스 | 승률 | 라운드 | 보스 HP/웨이브 | 일반 HP/웨이브 | 보스 초 | 일반 초 | 주요 이벤트 |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---|');
  for(const row of rows){
    console.log(`| ${row.name} | ${winText(row)} | ${num(row.meanClearedRounds,2)} | ${num(row.meanBossWaveHealthLost,2)} | ${num(row.meanNormalWaveHealthLost,2)} | ${num(row.meanBossWaveDuration,1)} | ${num(row.meanNormalWaveDuration,1)} | ${topText(row.meanEvents)} |`);
  }
}
function printBossDecks(name,rows){
  console.log(`\n## ${name}\n`);
  console.log('| 덱 | 승률 | 라운드 | 보스 HP/웨이브 | 일반 HP/웨이브 | 보스 초 | 일반 초 | 주요 이벤트 |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---|');
  for(const row of rows){
    console.log(`| ${row.label} | ${winText(row)} | ${num(row.meanClearedRounds,2)} | ${num(row.meanBossWaveHealthLost,2)} | ${num(row.meanNormalWaveHealthLost,2)} | ${num(row.meanBossWaveDuration,1)} | ${num(row.meanNormalWaveDuration,1)} | ${topText(row.meanEvents)} |`);
  }
}

const started=process.hrtime.bigint();
console.log(`사이클 ${uniqueCycles.join(',')} · 시드 1..${SEEDS} · 장미 ${roseMode} · 강화 0 · 자동 ${AUTO}s · 제한 ${LIMIT}s`);
const bosses=BOSS_ORDER.map((id,index)=>({
  id,index,name:BOSSES[id].name,
  overall:tally(),
  byCycle:Object.fromEntries(uniqueCycles.map(cycle=>[cycle,tally()])),
  byDeck:decks.map(()=>tally()),
}));
let done=0;
const total=uniqueCycles.length*BOSS_ORDER.length*decks.length*SEEDS;
for(const cycle of uniqueCycles){
  for(let b=0;b<BOSS_ORDER.length;b++){
    const stage=cycle*9+b+1,bucket=bosses[b];
    for(let d=0;d<decks.length;d++){
      for(let seed=1;seed<=SEEDS;seed++){
        const sample=play(decks[d],stage,seed);
        absorb(bucket.overall,sample);
        absorb(bucket.byCycle[cycle],sample);
        absorb(bucket.byDeck[d],sample);
        done++;
      }
    }
    process.stderr.write(`${BOSSES[BOSS_ORDER[b]].name} 사이클 ${cycle} 스테이지 ${stage} (${done}/${total})\n`);
  }
}

const summaryRows=bosses.map(boss=>({name:boss.name,...view(boss.overall)}));
printSummary(summaryRows);
for(const boss of bosses){
  const rows=boss.byDeck.map((agg,i)=>({label:deckLabel(decks[i]),deck:decks[i],...view(agg)}));
  printBossDecks(boss.name,rows);
}

const elapsed=Number(process.hrtime.bigint()-started)/1e9;
console.log(`\n${elapsed.toFixed(1)}s`);
if(JSON_OUT){
  const payload={
    parameters:{
      cycles:uniqueCycles,seeds:SEEDS,rose:roseMode,decks,
      stages:uniqueCycles.flatMap(cycle=>BOSS_ORDER.map((_,b)=>cycle*9+b+1)),
      dt:DT,autoInterval:AUTO,timeLimit:LIMIT,enhance:0,mode:'main',
    },
    bosses:bosses.map(boss=>({
      id:boss.id,index:boss.index,name:boss.name,
      overall:view(boss.overall),
      byCycle:Object.fromEntries(uniqueCycles.map(cycle=>[String(cycle),view(boss.byCycle[cycle])])),
      byDeck:boss.byDeck.map((agg,i)=>({deck:decks[i],...view(agg)})),
    })),
  };
  await fs.writeFile(JSON_OUT,JSON.stringify(payload,null,2)+'\n');
}

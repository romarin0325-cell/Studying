// Rank-reach bench for the constellation plan (docs/plans/2026-11-17-CONSTELLATION_BONDS.md).
// Plays whole main stages with the auto-play and records the wave in which each deck hero first stands on the
// board at 3 and 4 stars, then prints how often both heroes of a deck pair are there by each wave.
//   node defense/scripts/rank-reach.mjs [--seeds 12] [--stages 12,21,33,60] [--decks "id,id,id,id,id;..."]
// Growth model: rose/spring/seed beds by level as in stage-sim, enhance 0, no relics, no crit beds.
import {levelOf,MAIN_STAGES} from '../src/content.js';
import {heroMultiplier,specialMultiplier,springGauge,seedGold} from '../src/economy.js';
import * as engine from '../src/combat/engine.js';
import {autoPlay as basicAuto} from '../src/battle.js';
import {smartAutoPlay} from '../src/smart-auto.js';

const DT=.05,AUTO=.32,LIMIT_TICKS=900/DT,RANKS=[3,4];
const args=process.argv.slice(2);
const opt=(name,fallback)=>{const i=args.indexOf('--'+name);return i<0?fallback:args[i+1];};
const SEEDS=Number(opt('seeds',12));
const STAGES=String(opt('stages','12,21,33,60')).split(',').map(Number);
const DECKS=(opt('decks',null)?.split(';')??[
  'star_boy,snow_rabbit,night_rabbit,siren,great_detective',
  'star_boy,snow_rabbit,night_rabbit,siren,santa',
  'flame_sage,red_dragon,zeke,cherry_prince,siren',
  'snow_rabbit,avalanche_maid,frost_witch,guardian,storm_sage',
]).map(text=>text.split(',').map(id=>id.trim()));
if(!Number.isInteger(SEEDS)||SEEDS<1)throw new Error('--seeds must be a positive integer');
if(STAGES.some(stage=>!Number.isInteger(stage)||stage<1||stage>MAIN_STAGES))throw new Error('--stages must be integers from 1 to '+MAIN_STAGES);
for(const deck of DECKS)if(!engine.validDeck(deck))throw new Error('Invalid deck: '+deck.join(','));

const bedsAt=level=>({rose:Math.min(45,3+level),spring:level>=15?Math.min(30,3*(level-14)):0,seed:level>=30?Math.min(20,2*(level-29)):0});
function play(deck,stage,seed,autoPlay){
  const beds=bedsAt(levelOf(stage)),entry={enhance:0};
  const meta=Object.fromEntries(deck.map(id=>[id,{power:heroMultiplier(entry,beds),special:specialMultiplier(0)}]));
  const s=engine.newRun({deck,chapter:stage-1,seed,meta,mode:'main',gaugeMax:springGauge(beds.spring),startGold:seedGold(beds.seed),crit:null});
  const first=Object.fromEntries(RANKS.map(rank=>[rank,{}]));let autoIn=0,pick=false,ticks=0,cells=0;
  const scan=()=>{let n=0;for(const u of s.board){if(!u)continue;n++;for(const rank of RANKS)if(u.rank>=rank&&first[rank][u.hero]===undefined)first[rank][u.hero]=s.wave;}cells=Math.max(cells,n);};
  // Same cadence as stage-sim: step 0.05s, auto-play every 0.32s, blessing pick on the tick after entering reward.
  while(s.phase!=='victory'&&s.phase!=='defeat'&&ticks<LIMIT_TICKS){
    const before=s.phase;engine.step(s,DT);ticks++;
    if(pick){autoPlay(s);autoIn=0;pick=false;}
    else if(before!=='reward'&&s.phase==='reward')pick=true;
    else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=DT;if(autoIn>=AUTO){autoPlay(s);autoIn=0;}}
    s.events.length=0;if(ticks%10===0)scan();
  }
  scan();
  return {won:s.phase==='victory',first,cells,summons:s.stats.summons,merges:s.stats.merges};
}
const pairs=deck=>deck.flatMap((a,i)=>deck.slice(i+1).map(b=>[a,b]));
for(const [name,auto] of [['basic',basicAuto],['smart',smartAutoPlay]]){
  console.log(`\n# auto=${name}, decks=${DECKS.length}, seeds=${SEEDS}`);
  for(const stage of STAGES){
    // Pooled over decks: share of (run, pair) where both heroes had reached the rank by the end of wave w.
    const pool=Object.fromEntries(RANKS.map(rank=>[rank,Array(7).fill(0)])),heroes=Object.fromEntries(RANKS.map(rank=>[rank,0]));
    let total=0,wins=0,runs=0,summons=0,merges=0,cells=0;
    for(const deck of DECKS)for(let seed=1;seed<=SEEDS;seed++){
      const r=play(deck,stage,seed,auto);runs++;if(r.won)wins++;summons+=r.summons;merges+=r.merges;cells+=r.cells;
      for(const rank of RANKS)heroes[rank]+=deck.filter(id=>r.first[rank][id]!==undefined).length;
      for(const [a,b] of pairs(deck)){total++;for(const rank of RANKS){const wa=r.first[rank][a],wb=r.first[rank][b];if(wa===undefined||wb===undefined)continue;for(let w=Math.max(wa,wb);w<=6;w++)pool[rank][w]++;}}
    }
    const row=rank=>[1,2,3,4,5,6].map(w=>(pool[rank][w]/total*100).toFixed(0).padStart(3)+'%').join(' ');
    console.log(`stage ${stage}: win ${(wins/runs*100).toFixed(0)}%, summons ${(summons/runs).toFixed(1)}, merges ${(merges/runs).toFixed(1)}, max cells ${(cells/runs).toFixed(1)}, heroes at 3 stars ${(heroes[3]/runs).toFixed(2)}/5, at 4 stars ${(heroes[4]/runs).toFixed(2)}/5`);
    for(const rank of RANKS)console.log(`  pair both >= ${rank} stars by wave 1..6: ${row(rank)}`);
  }
}

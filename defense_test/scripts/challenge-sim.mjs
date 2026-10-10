// Weekly draft / monthly boss rush difficulty bench (18 waves, three tiers) with the smart auto.
//   node defense_test/scripts/challenge-sim.mjs [--mode weekly|monthly] [--tiers easy,hard,abyss] [--growth 12,26,42] [--seeds 4] [--decks "a,b,c,d,e;..."] [--json out.json]
// --growth gives, per tier, the main stage whose greenhouse a player would plausibly have (same model as stage-sim).
import fs from 'node:fs/promises';
import {HERO,CHALLENGE_WAVES,TIERS} from '../src/content.js';
import {heroMultiplier,specialMultiplier,springGauge,seedGold} from '../src/economy.js';
import * as engine from '../src/combat/engine.js';
import {clearedRounds} from '../src/battle.js';
import {smartAutoPlay} from '../src/smart-auto.js';

const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf('--'+n);return i<0?f:args[i+1];};
const MODE=opt('mode','weekly'),TIER_LIST=opt('tiers','easy,hard,abyss').split(','),GROWTH=opt('growth','12,26,42').split(',').map(Number),SEEDS=Number(opt('seeds',4)),JSON_OUT=opt('json',null);
if(!['weekly','monthly'].includes(MODE))throw new Error('--mode weekly|monthly');
if(TIER_LIST.some(t=>!TIERS[t])||GROWTH.length!==TIER_LIST.length)throw new Error('--tiers and --growth must match');
const DECKS=(opt('decks',null)?.split(';')??['star_boy,snow_rabbit,night_rabbit,siren,santa','zeke,luna,jasmine,ancient_dragon,great_detective','flame_sage,red_dragon,zeke,cherry_prince,siren','silver_rabbit,jasmine,galaxy_whale,cherry_prince,aurora','snow_rabbit,avalanche_maid,frost_witch,guardian,storm_sage']).map(d=>d.split(','));
const bedsFor=stage=>({rose:Math.min(45,3+stage),spring:stage>=15?Math.min(10,stage-14):0,seed:stage>=30?Math.min(10,stage-29):0});

function play(deck,tier,growth,seed){
  const beds=bedsFor(growth),meta=Object.fromEntries(deck.map(id=>[id,{power:heroMultiplier({enhance:0},beds),special:specialMultiplier(0)}]));
  const s=engine.newRun({deck,chapter:(seed%9),seed,meta,mode:MODE,tier,gaugeMax:springGauge(beds.spring),startGold:seedGold(beds.seed)});
  if(MODE==='monthly')s.health=7;else s.gauge=Math.min(s.gaugeMax,s.gauge+deck.length*4);
  let autoIn=0,pick=false,ticks=0;
  while(s.phase!=='victory'&&s.phase!=='defeat'&&ticks<36000){const before=s.phase;engine.step(s,.05);ticks++;s.events.length=0;
    if(pick){smartAutoPlay(s);pick=false;}else if(before!=='reward'&&s.phase==='reward')pick=true;else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=.05;if(autoIn>=.32){smartAutoPlay(s);autoIn=0;}}}
  return {won:s.phase==='victory',rounds:clearedRounds(s),time:ticks*.05};
}
const rows=[];
for(const [i,tier] of TIER_LIST.entries())for(const deck of DECKS){
  const runs=Array.from({length:SEEDS},(_,k)=>play(deck,tier,GROWTH[i],k+1));
  rows.push({tier,growth:GROWTH[i],deck:deck.join(','),clear:runs.filter(r=>r.won).length/runs.length,rounds:runs.reduce((n,r)=>n+r.rounds,0)/runs.length,min:Math.min(...runs.map(r=>r.rounds)),max:Math.max(...runs.map(r=>r.rounds))});
  const r=rows.at(-1);console.log(`${MODE} ${TIERS[tier].name} (성장 ${r.growth}) · ${deck.map(id=>HERO[id].name).join('·')} · 클리어 ${(r.clear*100).toFixed(0)}% · 평균 ${r.rounds.toFixed(1)}/${CHALLENGE_WAVES} (${r.min}~${r.max})`);
}
for(const tier of TIER_LIST){const t=rows.filter(r=>r.tier===tier);console.log(`== ${TIERS[tier].name}: 클리어 ${(t.reduce((n,r)=>n+r.clear,0)/t.length*100).toFixed(0)}% · 평균 ${(t.reduce((n,r)=>n+r.rounds,0)/t.length).toFixed(1)}웨이브`);}
if(JSON_OUT)await fs.writeFile(JSON_OUT,JSON.stringify({mode:MODE,rows},null,2)+'\n');

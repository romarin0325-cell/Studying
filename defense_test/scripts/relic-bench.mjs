// Relic value bench (one equipped relic vs none), smart auto, deterministic seeds.
//   node defense_test/scripts/relic-bench.mjs dps [--relics a,b] [--level 1] [--layout]   damage over 40 s from real boards (enemy health x40, nothing dies)
//   node defense_test/scripts/relic-bench.mjs run [--relics a,b] [--level 1] [--mode weekly|monthly] [--seeds 3]   whole runs (weekly keeps going past 18)
// dps: boards are captured at the start of waves 6 and 12 of a weekly-hard run per deck and seed. --layout first
// hill-climbs the placement (pair swaps on smart-auto boardValue) for both sides, i.e. a player who builds for the relic.
// Value V = gain / 10% (1.0 = +10% team damage). Each relic also reports its tagged decks (where its condition holds).
import {ARTIFACTS,ARTIFACT} from '../src/content.js';
import {heroMultiplier,specialMultiplier,springGauge} from '../src/economy.js';
import * as E from '../src/combat/engine.js';
import {clearedRounds} from '../src/battle.js';
import {smartAutoPlay,boardValue} from '../src/smart-auto.js';

const args=process.argv.slice(2),MODE=args[0]||'dps',opt=(n,f)=>{const i=args.indexOf('--'+n);return i<0?f:args[i+1];};
const RELICS=(opt('relics',null)?.split(','))||ARTIFACTS.map(a=>a.id),LEVEL=Number(opt('level',1)),LAYOUT=args.includes('--layout'),SEEDS=Number(opt('seeds',3)),RUN_MODE=opt('mode','weekly');
const DECKS={
  mixed1:'star_boy,snow_rabbit,night_rabbit,siren,santa',strike:'zeke,luna,jasmine,ancient_dragon,great_detective',burn:'flame_sage,red_dragon,zeke,cherry_prince,siren',
  marks:'silver_rabbit,jasmine,galaxy_whale,cherry_prince,aurora',slow:'snow_rabbit,avalanche_maid,frost_witch,guardian,storm_sage',aura:'siren,ancient_dragon,harmonious,time_magician,zeke',
  chain:'lightning_sage,night_rabbit,storm_sage,snow_rabbit,silver_rabbit',poison:'mushroom_king,phantom,time_ruler,galaxy_whale,siren',zone:'flame_sage,mushroom_king,phantom,galaxy_whale,time_ruler',
  buff:'siren,ancient_dragon,harmonious,rumi,jasmine',hybrid:'zeke,red_dragon,flame_sage,mushroom_king,phantom',
};
// Decks where a synergy relic's condition is built in.
const TAGS={ember:['burn'],frost:['slow'],tide:['slow'],seed:['poison'],roots:['zone','poison'],prism:['chain'],guild:['aura'],broken_clock:['buff'],chorus:['chain','mixed1'],twin:['strike','burn'],lens:['strike'],royal_seal:['strike'],chalice:['hybrid']};
const G=22,beds={rose:3+G,spring:Math.min(30,3*(G-14)),seed:0};
const metaFor=deck=>Object.fromEntries(deck.map(id=>[id,{power:heroMultiplier({enhance:0},beds),special:specialMultiplier(0)}]));
// 'power10' is the yardstick: no relic, every companion +10% power.
const withRelic=(s,relic)=>{if(relic==='power10'){for(const m of Object.values(s.meta))m.power*=1.1;relic=null;}s.artifacts=relic?[relic]:[];s.relicLevels=relic?{[relic]:LEVEL}:{};return s;};
function drive(s,seconds,stopAt){
  let autoIn=0,pick=false,t=0;const limit=seconds/.05;
  while(s.phase!=='victory'&&s.phase!=='defeat'&&t<limit){const before=s.phase;E.step(s,.05);t++;s.events.length=0;if(stopAt&&stopAt(s))return true;
    if(pick){smartAutoPlay(s);pick=false;}else if(before!=='reward'&&s.phase==='reward')pick=true;else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=.05;if(autoIn>=.32){smartAutoPlay(s);autoIn=0;}}}
  return false;
}
function optimise(s){let best=boardValue(s),improved=true,r=0;while(improved&&r++<12){improved=false;for(let a=0;a<25;a++)for(let b=a+1;b<25;b++){if(!s.board[a]&&!s.board[b])continue;[s.board[a],s.board[b]]=[s.board[b],s.board[a]];const v=boardValue(s);if(v>best*1.0005){best=v;improved=true;}else [s.board[a],s.board[b]]=[s.board[b],s.board[a]];}}}
function snapshots(deck,seed){
  const s=E.newRun({deck,chapter:seed%9,seed,meta:metaFor(deck),mode:'weekly',tier:'hard',gaugeMax:springGauge(beds.spring)});s.endless=true;
  const out=[];for(const wave of [6,12]){if(!drive(s,2000,x=>x.phase==='combat'&&x.wave===wave&&x.waveTime<.06))break;out.push(E.serialize(s));}
  return out;
}
function dpsSample(raw,relic){
  const s=withRelic(E.restore(raw),relic);if(LAYOUT)optimise(s);
  for(const e of s.queue)e.hp*=40;for(const e of s.enemies){e.hp*=40;e.maxHp*=40;}
  const before=s.stats.damage;drive(s,40);return s.stats.damage-before;
}
function runSample(deck,seed,relic){
  const s=withRelic(E.newRun({deck,chapter:seed%9,seed,meta:metaFor(deck),mode:RUN_MODE,tier:RUN_MODE==='monthly'?'easy':'hard',gaugeMax:springGauge(beds.spring)}),relic);
  if(RUN_MODE==='monthly')s.health=7;else{s.endless=true;s.gauge=Math.min(s.gaugeMax,s.gauge+20);}
  drive(s,4000);return clearedRounds(s)+Math.max(0,s.health)/(RUN_MODE==='monthly'?7:20);
}
const fmt=v=>(v>=0?'+':'')+v.toFixed(1)+'%';
if(MODE==='dps'){
  const snaps=Object.entries(DECKS).flatMap(([tag,d])=>[1,2].flatMap(seed=>snapshots(d.split(','),seed).map(raw=>({tag,raw}))));
  const base=new Map(snaps.map((x,i)=>[i,dpsSample(x.raw,null)]));
  console.log(`dps bench · level ${LEVEL}${LAYOUT?' · layout optimised':''} · ${snaps.length} boards`);
  for(const relic of RELICS){
    const gains=snaps.map((x,i)=>({tag:x.tag,g:dpsSample(x.raw,relic)/base.get(i)-1}));
    const avg=list=>list.length?list.reduce((n,x)=>n+x.g,0)/list.length*100:NaN,tagged=gains.filter(x=>(TAGS[relic]||[]).includes(x.tag));
    console.log(`${relic.padEnd(13)} ${(ARTIFACT[relic]?.rarity||'-').padEnd(2)} all ${fmt(avg(gains)).padStart(7)} (V ${(avg(gains)/10).toFixed(2)})${tagged.length?`  tagged ${fmt(avg(tagged)).padStart(7)} (V ${(avg(tagged)/10).toFixed(2)})`:''}`);
  }
}else{
  const decks=Object.entries(DECKS),score=(relic,list)=>list.reduce((n,[,d])=>n+Array.from({length:SEEDS},(_,k)=>runSample(d.split(','),k+1,relic)).reduce((a,b)=>a+b,0)/SEEDS,0)/list.length;
  const base=score(null,decks);console.log(`run bench · ${RUN_MODE} · level ${LEVEL} · base ${base.toFixed(2)}`);
  for(const relic of RELICS){const d=score(relic,decks)-base;console.log(`${relic.padEnd(13)} ${(ARTIFACT[relic]?.rarity||'-').padEnd(2)} ${d>=0?'+':''}${d.toFixed(2)}`);}
}

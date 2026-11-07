import {DEFAULT_DECK,HERO} from '../src/content.js';
import {heroMultiplier,specialMultiplier,springGauge,seedGold} from '../src/economy.js';
import * as E from '../src/combat/engine.js';
import {autoPlay,clearedRounds} from '../src/battle.js';
import {dodgeLit,chooseBlessingFor,pickUltimateFor} from '../src/smart-auto.js';

// Frozen copy of the previous helper for comparison.
function old(s){
  if(s.phase==='reward')return E.chooseReward(s,s.reward.includes('oath')?'oath':s.reward[0]);
  if(!['combat','intermission'].includes(s.phase))return;
  const occupied=s.board.flatMap((u,i)=>u?[i]:[]);for(const from of occupied){const to=occupied.find(i=>E.canMerge(s.board[from],s.board[i],s));if(to!==undefined){E.move(s,from,to);return;}}
  if(s.board.some((u,i)=>!u&&!E.closedCell(s,i))&&s.board.filter(Boolean).length<23&&s.gold>=E.summonCost(s)){E.summon(s);return;}
  if(s.enemies.some(e=>e.boss)&&s.gauge>=60){const best=s.deck.filter(id=>E.bestUnit(s,id)&&!E.castLock(s,id)&&s.gauge>=E.skillCost(s,id)&&s.gold>=E.skillGoldCost(id)).sort((a,b)=>(HERO[b].bossDamage||1)-(HERO[a].bossDamage||1));if(best.length){E.cast(s,best[0]);return;}}
  const id=s.deck.find(id=>s.upgrades[id]<E.trainCap(s)&&s.gold>=E.upgradeCost(s,id));if(id)E.upgrade(s,id);
}
// Frozen PR helper; its three smart-auto helper exports are retained solely for this bench.
function prev(s){
  if(s.phase==='reward')return E.chooseReward(s,s.reward.includes('oath')?'oath':chooseBlessingFor(s));
  if(!['combat','intermission'].includes(s.phase))return;
  if(dodgeLit(s))return;
  const occupied=s.board.flatMap((u,i)=>u?[i]:[]);
  for(const from of occupied){const to=occupied.find(i=>E.canMerge(s.board[from],s.board[i],s));if(to!==undefined){E.move(s,from,to);return;}}
  const room=s.board.some((u,i)=>!u&&!E.closedCell(s,i));
  if(room&&s.board.filter(Boolean).length<23&&s.gold>=E.summonCost(s)){E.summon(s);return;}
  if(s.enemies.some(e=>e.boss)&&s.gauge>=60){const best=s.deck.filter(id=>E.bestUnit(s,id)&&!E.castLock(s,id)&&s.gauge>=E.skillCost(s,id)&&s.gold>=E.skillGoldCost(id)).sort((a,b)=>(HERO[b].bossDamage||1)-(HERO[a].bossDamage||1));if(best.length){E.cast(s,best[0]);return;}}
  if(s.gauge>=E.gaugeCap(s)-8&&s.enemies.some(e=>e.hp>0)){const id=pickUltimateFor(s);if(id){E.cast(s,id);return;}}
  const id=s.deck.find(id=>s.upgrades[id]<E.trainCap(s)&&s.gold>=E.upgradeCost(s,id));if(id)E.upgrade(s,id);
}
const DT=.05,stages=[1,3,6,9,18],beds={rose:0,spring:0,seed:0,crit:0,critDamage:0,stardust:0},meta=Object.fromEntries(DEFAULT_DECK.map(id=>[id,{power:heroMultiplier({enhance:0},beds),special:specialMultiplier(0)}]));
function play(stage,seed,policy){
  const s=E.newRun({deck:DEFAULT_DECK,chapter:stage-1,seed,meta,mode:'main',gaugeMax:springGauge(0),startGold:seedGold(0)});let autoIn=0,pick=false,ticks=0,cap=0,hits=0;
  while(!['victory','defeat'].includes(s.phase)&&ticks<18000){
    const before=s.phase,t=s.telegraph,targets=t&&['seal','storm','stun1','thunder','judgement'].includes(t.pattern)?t.cells.filter(i=>s.board[i]&&!(t.pattern==='judgement'?E.invincible(s,i):E.immune(s,i))):[];
    E.step(s,DT);ticks++;if(s.gauge>=E.gaugeCap(s)-1e-6)cap+=DT;
    if(t&&t.ends<=s.time&&!s.telegraph&&s.events.some(e=>e.type==='seal'||e.type==='bossCast'))hits+=targets.length;
    hits+=s.events.filter(e=>e.type==='curse'||e.type==='judgement'&&e.hit).length;
    if(pick){policy(s);autoIn=0;pick=false;}else if(before!=='reward'&&s.phase==='reward')pick=true;else if(['combat','intermission'].includes(s.phase)){autoIn+=DT;if(autoIn>=.32){policy(s);autoIn=0;}}s.events.length=0;
  }
  return {won:s.phase==='victory',waves:clearedRounds(s),ultimates:s.stats.skills,capSeconds:cap,patternHits:hits};
}
const rows=[];for(const stage of stages)for(const [name,policy] of [['old',old],['prev',prev],['new',autoPlay]]){const samples=Array.from({length:6},(_,i)=>play(stage,i+1,policy));rows.push({stage,helper:name,clears:samples.filter(x=>x.won).length,waves:samples.reduce((n,x)=>n+x.waves,0)/6,ultimates:samples.reduce((n,x)=>n+x.ultimates,0)/6,capSeconds:samples.reduce((n,x)=>n+x.capSeconds,0)/6,patternHits:samples.reduce((n,x)=>n+x.patternHits,0)/6,samples});}
console.log('| Stage | Helper | Clears/6 | Waves avg | Ult avg | Cap sec avg | Pattern hits avg |\n|---:|---|---:|---:|---:|---:|---:|');for(const r of rows)console.log(`| ${r.stage} | ${r.helper} | ${r.clears} | ${r.waves.toFixed(2)} | ${r.ultimates.toFixed(2)} | ${r.capSeconds.toFixed(2)} | ${r.patternHits.toFixed(2)} |`);

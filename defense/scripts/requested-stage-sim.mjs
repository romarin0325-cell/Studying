// Reproducible, engine-backed simulation of the requested five-companion strategy.
// node defense/scripts/requested-stage-sim.mjs --seeds 100 --jobs 4 --json result.json
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {isMainThread, Worker, parentPort, workerData} from 'node:worker_threads';
import {HERO, CHAPTERS, BOSSES} from '../src/content.js';
import {heroMultiplier, specialMultiplier, seedGold, springGauge, critStats} from '../src/economy.js';
import * as E from '../src/combat/engine.js';

export const DECK=['santa','storm_sage','time_magician','siren','snow_rabbit'];
export const ARTIFACTS=['lantern','hourglass','chorus'];
export const BEDS={rose:0,spring:20,seed:20,crit:0,critDamage:0,stardust:0};
export const DT=.05, ACTION_INTERVAL=.35, LIMIT=900;
const CELLS=Array.from({length:25},(_,i)=>i);
const LIMITS={santa:1,siren:3,snow_rabbit:2,time_magician:4,storm_sage:Infinity};
const SCHEDULE=[{after:2,id:'snow_rabbit',level:1},{after:3,id:'siren',level:1},
  {after:4,id:'snow_rabbit',level:2},{after:5,id:'siren',level:2}];
const LIT=new Set(['seal','storm','stun1','thunder','judgement']);
const priority={storm_sage:5,time_magician:4,siren:3,snow_rabbit:2,santa:1};

// Hash the trial index: consecutive small xorshift seeds have correlated opening draws.
export function trialSeed(i){
  let x=(i+0x9e3779b9)>>>0;
  x=Math.imul(x^(x>>>16),0x85ebca6b)>>>0;
  x=Math.imul(x^(x>>>13),0xc2b2ae35)>>>0;
  return (x^(x>>>16))>>>0||1;
}
export function createScenario(stage,seed){
  const enhancements={santa:5,storm_sage:1,time_magician:1,siren:5,snow_rabbit:5};
  const meta=Object.fromEntries(DECK.map(id=>[id,{
    power:heroMultiplier({enhance:enhancements[id]},BEDS),
    special:specialMultiplier(enhancements[id])
  }]));
  return E.newRun({deck:DECK,chapter:stage-1,seed,artifacts:ARTIFACTS,
    relicLevels:Object.fromEntries(ARTIFACTS.map(id=>[id,5])),meta,relicAttack:.03,
    gaugeMax:springGauge(BEDS.spring),startGold:seedGold(BEDS.seed),crit:critStats(BEDS,stage-1)});
}

// Score pairs lexicographically: magician/storm, then siren/magician, then siren/storm.
// The positional tiebreaker prefers snow rabbits that can attack near the entrance.
const NEIGHBORS=CELLS.map(E.neighbors);
const EDGES=CELLS.flatMap(i=>NEIGHBORS[i].filter(j=>j>i).map(j=>[i,j]));
const EDGES_FOR=CELLS.map(i=>EDGES.filter(([a,b])=>a===i||b===i));
const SNOW_POSITION=CELLS.map(i=>{
  const from=E.cellPoint(i);
  return Array.from({length:9},(_,k)=>{
    const p=E.pathPoint(k*50),distance=Math.hypot(from.x-p.x,from.y-p.y);
    return distance<=HERO.snow_rabbit.range?1+(400-k*50)/800:0;
  }).reduce((a,b)=>a+b,0);
});
function edgeValue(a,b){
  if(!a||!b||a.cursed||b.cursed)return 0;
  const pair=[a.hero,b.hero].sort().join('/');
  if(pair==='storm_sage/time_magician')return 1000000;
  if(pair==='siren/time_magician')return 10000;
  if(pair==='siren/storm_sage')return 100;
  return 0;
}
function positional(u,i){return u&&!u.cursed&&u.hero==='snow_rabbit'?SNOW_POSITION[i]:0;}
export function boardScore(board){
  return EDGES.reduce((n,[a,b])=>n+edgeValue(board[a],board[b]),0)
    +board.reduce((n,u,i)=>n+positional(u,i),0);
}
function swapDelta(board,a,b){
  const ua=board[a],ub=board[b];
  const edges=new Set([...EDGES_FOR[a],...EDGES_FOR[b]]);
  const before=[...edges].reduce((n,[x,y])=>n+edgeValue(board[x],board[y]),0)+positional(ua,a)+positional(ub,b);
  const at=i=>i===a?ub:i===b?ua:board[i];
  const after=[...edges].reduce((n,[x,y])=>n+edgeValue(at(x),at(y)),0)+positional(ub,a)+positional(ua,b);
  return after-before;
}
function signature(s){return s.board.map(u=>u?u.uid+':'+(u.cursed?1:0):'-').join(',');}
function bestReposition(s,m){
  const sig=signature(s);if(sig===m.optimized)return false;
  const danger=new Set(LIT.has(s.telegraph?.pattern)?s.telegraph.cells:[]);
  let best=null;
  for(let a=0;a<25;a++)if(s.board[a]&&!s.board[a].cursed&&!danger.has(a)){
    for(let b=a+1;b<25;b++){
      if(danger.has(b)||s.board[b]?.cursed||E.canMerge(s.board[a],s.board[b]))continue;
      const d=swapDelta(s.board,a,b);
      if(d>1e-7&&(!best||d>best.d))best={a,b,d};
    }
    // Empty cells with lower indexes also need consideration.
    for(let b=0;b<a;b++)if(!s.board[b]&&!danger.has(b)){
      const d=swapDelta(s.board,a,b);
      if(d>1e-7&&(!best||d>best.d))best={a,b,d};
    }
  }
  if(best&&E.move(s,best.a,best.b).ok){m.moves++;return true;}
  m.optimized=sig;return false;
}
function unitImportance(u){return u?(priority[u.hero]||0)*Math.pow(2.35,u.rank-1):0;}
function dodge(s,m){
  if(!LIT.has(s.telegraph?.pattern))return false;
  const danger=new Set(s.telegraph.cells);
  const victims=[...danger].filter(i=>s.board[i]&&!s.board[i].cursed)
    .sort((a,b)=>unitImportance(s.board[b])-unitImportance(s.board[a]));
  for(const from of victims){
    const u=s.board[from];
    const empty=CELLS.filter(i=>!danger.has(i)&&!s.board[i]);
    if(empty.length){
      empty.sort((a,b)=>swapDelta(s.board,from,b)-swapDelta(s.board,from,a));
      if(E.move(s,from,empty[0]).ok){m.dodges++;return true;}
    }
    const safe=CELLS.filter(i=>!danger.has(i)&&s.board[i]&&!E.canMerge(u,s.board[i])
      &&unitImportance(s.board[i])<unitImportance(u));
    safe.sort((a,b)=>unitImportance(s.board[a])-unitImportance(s.board[b]));
    if(safe.length&&E.move(s,from,safe[0]).ok){m.dodges++;return true;}
  }
  return false;
}
function mergePair(s,from,to,m,why){
  if(!E.canMerge(s.board[from],s.board[to])||s.board[from].hero==='storm_sage')return false;
  // Keep the destination with the more useful local position.
  const b=s.board,ua=b[from],ub=b[to];
  b[from]=null;let keepTo=boardScore(b);b[from]=ua;b[to]=null;let keepFrom=boardScore(b);b[to]=ub;
  if(keepFrom>keepTo)[from,to]=[to,from];
  const hero=s.board[from].hero;
  if(!E.move(s,from,to).merged)return false;
  m.merges[hero]=(m.merges[hero]||0)+1;
  if(why==='curse')m.curseMerges++;
  return true;
}
function cleanCurse(s,m){
  for(const from of CELLS){
    const u=s.board[from];if(!u?.cursed)continue;
    if(u.hero!=='storm_sage'){
      const to=CELLS.find(i=>i!==from&&E.canMerge(u,s.board[i]));
      if(to!==undefined&&mergePair(s,from,to,m,'curse'))return true;
    }
    if(E.sell(s,from).ok){m.curseSales++;return true;}
  }
  return false;
}
function plannedMerge(s,m){
  for(const hero of ['santa','siren','snow_rabbit','time_magician']){
    const units=CELLS.filter(i=>s.board[i]?.hero===hero);
    if(hero!=='santa'&&units.length<=LIMITS[hero])continue;
    for(const from of units.sort((a,b)=>s.board[a].rank-s.board[b].rank)){
      const to=units.find(i=>i!==from&&E.canMerge(s.board[from],s.board[i]));
      if(to!==undefined&&mergePair(s,from,to,m,'cap'))return true;
    }
  }
  return false;
}
function trainingDue(s){
  const cleared=s.phase==='intermission'?s.wave:s.wave-1;
  return SCHEDULE.find(x=>cleared>=x.after&&s.upgrades[x.id]<x.level);
}
function chooseBlessing(s){
  // A reproducible choice for an unspecified player decision.
  if(s.health<=14&&s.reward.includes('mend'))return 'mend';
  if(s.board.filter(Boolean).length<23&&s.reward.includes('arrival'))return 'arrival';
  for(const id of ['oath','purse','surge','training','mend','arrival'])
    if(s.reward.includes(id))return id;
  throw new Error('No valid reward');
}
export function policyAction(s,m){
  if(s.phase==='reward'){const id=chooseBlessing(s);E.chooseReward(s,id);m.blessings[id]=(m.blessings[id]||0)+1;return 'reward';}
  if(!['combat','intermission'].includes(s.phase))return 'none';
  if(dodge(s,m))return 'dodge';
  if(cleanCurse(s,m))return 'curse';
  if(s.phase==='combat'&&s.enemies.some(e=>e.hp>0)){
    const threshold=(s.wave===3||s.wave===6)?0.3:0.5;
    const danger=s.enemies.some(e=>e.hp>0&&e.progress>=E.PATH_LENGTH*threshold);
    if(danger){
      if(E.cast(s,'snow_rabbit').ok){m.casts.snow_rabbit++;return 'snow_rabbit';}
      m.dangerWithoutCast++;
    }else if(E.cast(s,'santa').ok){m.casts.santa++;return 'santa';}
  }
  const due=trainingDue(s);
  if(due&&E.upgrade(s,due.id).ok){
    m.training.push({wave:s.wave,phase:s.phase,id:due.id,level:s.upgrades[due.id],time:s.time});
    return 'train';
  }
  if(plannedMerge(s,m))return 'merge';
  if(!due&&E.summon(s).ok){m.summons++;return 'summon';}
  if(bestReposition(s,m))return 'position';
  return 'none';
}
export function newMetrics(){
  return {summons:0,moves:0,dodges:0,curseMerges:0,curseSales:0,
    casts:{santa:0,snow_rabbit:0},merges:{},blessings:{},training:[],dangerWithoutCast:0,
    warnings:{},events:{},judgementHits:0,bossKills:0,bossLeaks:0,bossKillWaves:[],bossLeakWaves:[],
    reserveFromGift:0,reserveReleased:0,
    chorusSeconds:Object.fromEntries(DECK.map(id=>[id,0])),sampleSeconds:0,optimized:null};
}
function tallyEvents(s,m){
  for(const ev of s.events){
    if(['warning','curse','shuffle','rush','drain','interrupt','judgement','leak','seal'].includes(ev.type))
      m.events[ev.type]=(m.events[ev.type]||0)+1;
    if(ev.type==='warning')m.warnings[ev.pattern]=(m.warnings[ev.pattern]||0)+1;
    if(ev.type==='judgement'&&ev.hit)m.judgementHits++;
    if(ev.type==='kill'&&ev.boss){m.bossKills++;m.bossKillWaves.push(s.wave);}
    if(ev.type==='leak'&&ev.boss){m.bossLeaks++;m.bossLeakWaves.push(s.wave);}
    if(ev.type==='skill'&&ev.hero==='santa'&&ev.gift===-1)m.reserveFromGift++;
  }
  s.events.length=0;
}
export function playScenario(stage,seed){
  const s=createScenario(stage,seed),m=newMetrics();
  let actionIn=ACTION_INTERVAL,ticks=0,prevReserve=0;
  tallyEvents(s,m);
  while(s.phase!=='victory'&&s.phase!=='defeat'&&ticks<LIMIT/DT){
    E.step(s,DT);ticks++;
    if(s.reserves.length<prevReserve)m.reserveReleased+=prevReserve-s.reserves.length;
    prevReserve=s.reserves.length;
    tallyEvents(s,m);
    actionIn+=DT;
    if(s.phase==='reward'||actionIn+1e-9>=ACTION_INTERVAL){
      policyAction(s,m);actionIn=0;tallyEvents(s,m);prevReserve=s.reserves.length;
    }
    if(ticks%20===0){
      m.sampleSeconds++;
      for(const id of DECK)if(s.board.filter(u=>u?.hero===id).length>=3)m.chorusSeconds[id]++;
    }
  }
  delete m.optimized;
  return {seed,won:s.phase==='victory',timeout:!['victory','defeat'].includes(s.phase),
    wave:s.wave,phase:s.phase,health:s.health,time:Number((ticks*DT).toFixed(2)),damage:s.stats.damage,
    damageByHero:s.stats.byHero,leaks:s.stats.leaks,board:s.board.filter(Boolean).map(u=>({hero:u.hero,rank:u.rank,cursed:u.cursed})),
    remainingReserves:s.reserves.length,upgrades:s.upgrades,...m};
}
export function wilson(wins,n){
  const z=1.959963984540054,p=wins/n,den=1+z*z/n;
  const mid=(p+z*z/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
  return [wins===0?0:Math.max(0,mid-half),wins===n?1:Math.min(1,mid+half)];
}
export function summarize(stage,runs){
  const n=runs.length,wins=runs.filter(r=>r.won).length,timeouts=runs.filter(r=>r.timeout).length;
  const mean=f=>runs.reduce((sum,r)=>sum+f(r),0)/n;
  const sumMap=(field,keys)=>Object.fromEntries(keys.map(k=>[k,mean(r=>r[field]?.[k]||0)]));
  const failures=Object.fromEntries(Array.from({length:6},(_,i)=>[i+1,runs.filter(r=>!r.won&&!r.timeout&&r.wave===i+1).length]));
  const damageTotals=Object.fromEntries(DECK.map(id=>[id,runs.reduce((sum,r)=>sum+(r.damageByHero?.[id]||0),0)]));
  const allDamage=Object.values(damageTotals).reduce((a,b)=>a+b,0);
  const bossId=CHAPTERS[stage-1].bosses[0];
  return {stage,bossId,bossName:BOSSES[bossId].name,runs:n,wins,losses:n-wins-timeouts,timeouts,
    winRate:wins/n,interval95:wilson(wins,n),failures,meanHealth:mean(r=>r.health),meanTime:mean(r=>r.time),
    meanSummons:mean(r=>r.summons),meanCasts:sumMap('casts',['santa','snow_rabbit']),
    meanMerges:sumMap('merges',DECK),meanMoves:mean(r=>r.moves),meanDodges:mean(r=>r.dodges),
    meanCurseSales:mean(r=>r.curseSales),meanJudgementHits:mean(r=>r.judgementHits),
    meanBossKills:mean(r=>r.bossKills),meanBossLeaks:mean(r=>r.bossLeaks),
    winsBothBossesKilled:runs.filter(r=>r.won&&r.bossKills===2).length,
    winsWithBossLeak:runs.filter(r=>r.won&&r.bossLeaks>0).length,
    meanGiftReserves:mean(r=>r.reserveFromGift),
    meanReserveReleased:mean(r=>r.reserveReleased),
    damageShare:Object.fromEntries(DECK.map(id=>[id,allDamage?damageTotals[id]/allDamage:0])),
    chorusUptime:Object.fromEntries(DECK.map(id=>[id,mean(r=>r.sampleSeconds?r.chorusSeconds[id]/r.sampleSeconds:0)])),
    fullTrainingRuns:runs.filter(r=>r.upgrades.snow_rabbit===2&&r.upgrades.siren===2).length};
}
function runStage(stage,seeds){const runs=Array.from({length:seeds},(_,i)=>playScenario(stage,trialSeed(i+1)));return {summary:summarize(stage,runs),runs};}
async function runAll(stages,seeds,jobs){
  if(jobs===1)return stages.map(stage=>runStage(stage,seeds));
  const parts=new Array(stages.length);let next=0;
  await Promise.all(Array.from({length:Math.min(jobs,stages.length)},async()=>{
    while(next<stages.length){
      const i=next++;
      parts[i]=await new Promise((resolve,reject)=>{
        const worker=new Worker(new URL(import.meta.url),{workerData:{stage:stages[i],seeds}});
        worker.once('message',resolve);worker.once('error',reject);
        worker.once('exit',code=>{if(code)reject(new Error('worker exit '+code));});
      });
      const x=parts[i].summary;
      console.error('stage '+x.stage+': '+x.wins+'/'+x.runs+', timeouts '+x.timeouts);
    }
  }));
  return parts;
}
async function main(){
  const args=process.argv.slice(2),opt=(name,fallback)=>{const at=args.indexOf('--'+name);return at<0?fallback:args[at+1];};
  const stages=opt('stages','82,83,84,85,86,87,88,89,90').split(',').map(Number);
  const seeds=Number(opt('seeds','100')),jobs=Number(opt('jobs','1')),out=opt('json',null);
  if(!Number.isInteger(seeds)||seeds<1||!Number.isInteger(jobs)||jobs<1||stages.some(x=>!Number.isInteger(x)||x<1||x>90))
    throw new Error('Use positive integer seeds/jobs and stages 1..90');
  const start=Date.now(),results=await runAll(stages,seeds,jobs);
  const payload={parameters:{stages,seeds,jobs,dt:DT,actionInterval:ACTION_INTERVAL,limit:LIMIT,deck:DECK,
    artifacts:ARTIFACTS,relicLevel:5,beds:BEDS,relicAttack:.03,enhancements:{santa:5,storm_sage:1,time_magician:1,siren:5,snow_rabbit:5},
    snowThreshold:{normal:.5,bossWave:.3},
    mergeLimits:{santa:'as soon as possible',siren:3,snow_rabbit:2,time_magician:4,storm_sage:'never'},
    training:SCHEDULE,trialSeeds:'trialSeed(1..N)'},
    elapsedSeconds:(Date.now()-start)/1000,results};
  for(const {summary:r} of results)console.log(r.stage+' '+r.bossName+': '+r.wins+'/'+r.runs+' ('+(r.winRate*100).toFixed(1)+'%), 95% CI '+(100*r.interval95[0]).toFixed(1)+'–'+(100*r.interval95[1]).toFixed(1)+'%, timeouts '+r.timeouts);
  if(out)await fs.writeFile(out,JSON.stringify(payload,null,2)+'\n');
  console.error('elapsed '+payload.elapsedSeconds.toFixed(1)+'s');
}
if(!isMainThread){parentPort.postMessage(runStage(workerData.stage,workerData.seeds));}
else if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url)))await main();

// Overall value of each companion for combat power (src/power-factor.js). Random five-member teams (each with at least
// one attack ultimate and one area basic attack, src/roles.js) play real main stages from start to finish with the
// measurement auto and the real in-run economy; a ridge regression of the result on team membership gives what each
// companion adds on average over many teams, so the number is not tied to one formation.
//   node defense/scripts/power-factor-bench.mjs [--runs 4000] [--stages 27,33] [--jobs 15] [--json out.json] [--write]
// --write regenerates src/power-factor.js from this run. --from saved.json refits the games saved by an earlier --json.
import fs from 'node:fs/promises';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {isMainThread,Worker,parentPort,workerData} from 'node:worker_threads';
import {HEROES,HERO,levelOf} from '../src/content.js';
import {heroMultiplier,specialMultiplier,springGauge,seedGold,POWER_RARITY} from '../src/economy.js';
import {hasRole} from '../src/roles.js';
import * as engine from '../src/combat/engine.js';
import {smartAutoPlay} from '../src/smart-auto.js';
import {clearedRounds} from '../src/battle.js';

const DT=.05,AUTO=.32,LIMIT=900/DT,IDS=HEROES.map(h=>h.id);
const bedsFor=stage=>{const s=levelOf(stage);return {rose:Math.min(45,3+s),spring:s>=15?Math.min(30,3*(s-14)):0,seed:s>=30?Math.min(20,2*(s-29)):0};};
function rng(seed){let x=seed>>>0||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
function team(r){
  for(;;){const pool=[...IDS],deck=[];while(deck.length<5)deck.push(...pool.splice(Math.floor(r()*pool.length),1));
    if(deck.some(id=>hasRole(id,'strike'))&&deck.some(id=>hasRole(id,'area')))return deck;}
}
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
  return clearedRounds(s)+(s.phase==='victory'?1+s.health/20:0);
}
if(!isMainThread){
  const out=[];for(const {deck,stage,seed} of workerData.jobs)out.push({deck,stage,score:play(deck,stage,seed)});parentPort.postMessage(out);
}else{
  const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf('--'+n);return i<0?f:args[i+1];};
  const from=opt('from',null),saved=from?JSON.parse(await fs.readFile(from,'utf8')):null;
  const runs=saved?.runs??Number(opt('runs',4000)),stages=saved?.stages??opt('stages','27,33').split(',').map(Number),jobs=Math.max(1,Number(opt('jobs',Math.max(1,os.cpus().length-1)))),out=opt('json',null);
  const r=rng(20261116),all=[];if(!saved)for(const stage of stages)for(let i=0;i<runs;i++)all.push({deck:team(r),stage,seed:1+Math.floor(r()*1e9)});
  const started=Date.now(),chunks=Array.from({length:jobs},(_,i)=>all.filter((_,k)=>k%jobs===i));
  const rows=saved?saved.games:(await Promise.all(chunks.map(chunk=>new Promise((resolve,reject)=>{const w=new Worker(fileURLToPath(import.meta.url),{workerData:{jobs:chunk}});w.once('message',resolve);w.once('error',reject);})))).flat();
  // Ridge regression: score = stage mean + sum of member effects. Effects are centred (the average companion adds 0).
  const n=IDS.length,idx=Object.fromEntries(IDS.map((id,i)=>[id,i])),stageMean=Object.fromEntries(stages.map(st=>{const xs=rows.filter(x=>x.stage===st);return [st,xs.reduce((a,x)=>a+x.score,0)/xs.length];}));
  const A=Array.from({length:n},()=>new Float64Array(n)),b=new Float64Array(n),lambda=Number(opt('ridge',5));
  for(const row of rows){const y=row.score-stageMean[row.stage],xs=row.deck.map(id=>idx[id]);for(const i of xs){b[i]+=y;for(const j of xs)A[i][j]+=1;}}
  for(let i=0;i<n;i++)A[i][i]+=lambda;
  const M=A.map((rowA,i)=>[...rowA,b[i]]);
  for(let c=0;c<n;c++){let p=c;for(let r2=c+1;r2<n;r2++)if(Math.abs(M[r2][c])>Math.abs(M[p][c]))p=r2;[M[c],M[p]]=[M[p],M[c]];
    for(let r2=0;r2<n;r2++)if(r2!==c){const f=M[r2][c]/M[c][c];for(let k=c;k<=n;k++)M[r2][k]-=f*M[c][k];}}
  const effect=IDS.map((_,i)=>M[i][n]/M[i][i]),mean=effect.reduce((a,x)=>a+x,0)/n;
  // Convert effects to combat power units through the rarity means: fit effect = a + k * rarity weight over the four
  // rarity means, read each companion's implied weight, and divide by its rarity weight (mean 1 inside each rarity).
  const rar=['C','R','SR','UR'],byR=Object.fromEntries(rar.map(x=>[x,IDS.map((id,i)=>[id,effect[i]-mean]).filter(([id])=>HERO[id].rarity===x)]));
  const rm=Object.fromEntries(rar.map(x=>[x,byR[x].reduce((a,[,e])=>a+e,0)/byR[x].length]));
  const wx=rar.map(x=>POWER_RARITY[x]),wy=rar.map(x=>rm[x]),mx=wx.reduce((a,v)=>a+v,0)/4,my=wy.reduce((a,v)=>a+v,0)/4;
  const k=wx.reduce((a,v,i)=>a+(v-mx)*(wy[i]-my),0)/wx.reduce((a,v)=>a+(v-mx)**2,0);
  const raw=Object.fromEntries(IDS.map((id,i)=>{const w=POWER_RARITY[HERO[id].rarity];return [id,1+(effect[i]-mean-rm[HERO[id].rarity])/(k*w)];}));
  const sorted=IDS.map(id=>({id,name:HERO[id].name,rarity:HERO[id].rarity,effect:effect[idx[id]]-mean,raw:raw[id],n:rows.filter(x=>x.deck.includes(id)).length})).sort((a,b2)=>rar.indexOf(a.rarity)-rar.indexOf(b2.rarity)||b2.raw-a.raw);
  console.log('| 동료 | 등급 | 효과(점수) | 계수(원값) | 판 수 |\n|---|---|---:|---:|---:|');
  for(const x of sorted)console.log(`| ${x.name} | ${x.rarity} | ${x.effect.toFixed(3)} | ${x.raw.toFixed(3)} | ${x.n} |`);
  console.log(`\nstage means ${JSON.stringify(stageMean)} · rarity means ${JSON.stringify(Object.fromEntries(rar.map(x=>[x,Number(rm[x].toFixed(3))])))} · k ${k.toFixed(3)} · ${rows.length} runs · ${((Date.now()-started)/1000).toFixed(0)}s`);
  if(out)await fs.writeFile(out,JSON.stringify({runs,stages,ridge:lambda,stageMean,rarityMeans:rm,k,rows:sorted,games:rows},null,1)+'\n');
  if(args.includes('--write')){
    // Rounded to 0.05 and kept in 0.8-1.2: a rough grade, not a precise ranking (the measured spread is far wider; the
    // roles in auto formation carry what a team needs). Each rarity is shifted so its mean stays 1 after the clamp.
    const lo=.8,hi=1.2,clamp=v=>Math.min(hi,Math.max(lo,v)),table={};
    for(const x of rar){
      const ids=IDS.filter(id=>HERO[id].rarity===x),mean=c=>ids.reduce((a,id)=>a+clamp(raw[id]+c),0)/ids.length;
      let a=-2,b=2;for(let i=0;i<60;i++){const c=(a+b)/2;if(mean(c)<1)a=c;else b=c;}
      for(const id of ids)table[id]=Math.round(clamp(raw[id]+a)*20)/20;
      const m=ids.reduce((s,id)=>s+table[id],0)/ids.length;console.log(`${x} mean ${m.toFixed(3)} after rounding`);
    }
    await fs.writeFile(new URL('../src/power-factor.js',import.meta.url),`// Overall value of each companion inside its rarity (1 = the rarity average), one factor of combat power. Measured by
// scripts/power-factor-bench.mjs: ${runs} random teams (at least one attack ultimate and one area basic attack) at each
// of stages ${stages.join(', ')}, played whole with the measurement auto and real in-run gold; a ridge regression on team
// membership gives what each companion adds on average over many teams. Rounded to 0.05, kept in 0.8-1.2.
//   node defense/scripts/power-factor-bench.mjs --write
export const POWER_FACTOR=Object.freeze(${JSON.stringify(table)});
`);console.log('wrote src/power-factor.js');
  }
}

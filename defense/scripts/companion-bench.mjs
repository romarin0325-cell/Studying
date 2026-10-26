// Contribution bench for companions whose strength depends on a state the bench never reaches by itself:
// Joker's five colours and Chaos, and Sunflower's sunlight stack (0..3). It reuses the scenarios, reference teams and index of
// scripts/simulate.mjs (C average = 1.00) and measures every state on its own.
//   node defense/scripts/companion-bench.mjs [--teams 10] [--ranks 1,3,5] [--ult on|off]
// --ult on : the candidate casts its ultimate whenever it can; Joker's colour and Sunflower's stack are put back
//            after every cast so the measured state stays fixed (the cast itself still hits for full damage).
// --ult off: passive attack only.
import {HEROES,HERO} from '../src/content.js';
import * as engine from '../src/combat/engine.js';

const args=process.argv.slice(2),opt=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:fallback;};
const TEAMS=Number(opt('teams',10)),RANKS=opt('ranks','1,3,5').split(',').map(Number),ULT=opt('ult','on')==='on',DT=.05;
const CANDIDATE_CELLS=[12,21],REF_CELLS=[6,7,8,11,13,16,17,18];
function rng(seed){let x=seed>>>0||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296;};}
const teamRandom=rng(20261008),teamPool=Array.from({length:TEAMS},()=>{const ids=HEROES.map(h=>h.id);for(let i=ids.length-1;i>0;i--){const j=Math.floor(teamRandom()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return ids;});
const referenceTeam=(index,exclude)=>teamPool[index].filter(id=>id!==exclude).slice(0,4);
const rankScale=r=>Math.pow(2.35,r-1);
const SCENARIOS={
  crowd:{label:'A 다수전',seconds:45,health:1e9,queue:r=>Array.from({length:40},(_,i)=>({kind:i%7===6?'armor':i%5===4?'runner':'grunt',hp:Math.round(900*rankScale(r))})),interval:.5},
  boss:{label:'B 보스전',seconds:60,health:1e9,queue:r=>[{kind:'boss',hp:Math.round(4e5*rankScale(r))},...Array.from({length:6},()=>({kind:'grunt',hp:Math.round(500*rankScale(r))}))],interval:1},
  crisis:{label:'C 위기',seconds:30,health:9,start:1450,queue:r=>Array.from({length:30},(_,i)=>({kind:i%3===2?'grunt':'runner',hp:Math.round(700*rankScale(r))})),interval:.45},
  long:{label:'D 장기전',seconds:30,health:1e9,start:1394,queue:()=>[{kind:'boss',hp:1e12}],interval:1,freeze:true},
};
function bench(deck,candidateCell,rank,scenario,castId,seed,state){
  const s=engine.newRun({deck,chapter:2,seed});
  s.wave=2;s.board=Array(25).fill(null);s.nextId+=1000;
  const placements=[...REF_CELLS.map((cell,i)=>[cell,deck[i%4]]),...(candidateCell>=0?[[candidateCell,deck[4]]]:[])];
  for(const [cell,id] of placements){s.board[cell]={uid:s.nextId++,hero:id,rank,cooldown:.25,windup:0,target:null,attacks:0,pose:0,born:0,birthWave:1,harvest:12,disabled:0,facing:'down',aim:Math.PI/2,idleFor:0,priority:HERO[id].bossDamage||HERO[id].bossPriority?'boss':'first'};}
  s.enemies=[];s.queue=scenario.queue(rank);s.waveTotal=s.queue.length;s.spawnIn=0;s.gold=1e6;s.health=scenario.health;
  if(state)state.apply(s);
  const seen=new Set();let t=0;
  while(t<scenario.seconds&&['combat','intermission'].includes(s.phase)){
    if(scenario.health<100)s.health=scenario.health;
    if(s.queue.length&&s.spawnIn>scenario.interval)s.spawnIn=scenario.interval;
    engine.step(s,DT);t+=DT;
    for(const e of s.enemies)if(!seen.has(e.uid)){seen.add(e.uid);if(scenario.start)e.progress=scenario.start;if(e.boss){e.skillIn=1e9;if(scenario.freeze)e.speed=0;}}
    if(castId&&s.enemies.some(e=>e.hp>0)){
      if(s.gauge>=engine.skillCost(s,castId)){engine.cast(s,castId);if(state)state.apply(s);}
    }
  }
  return s.stats.damage;
}
const ONLY=opt('only',null);
const VARIANTS=[
  ...[...engine.JOKER.colors,'chaos'].map(c=>({id:'joker',label:'조커 '+engine.JOKER_NAMES[c],apply:s=>{s.jokerColor=c;s.jokerSeen=c==='chaos'?engine.JOKER.all:1|(1<<engine.JOKER.colors.indexOf(c));}})),
  ...[0,1,2,3].map(n=>({id:'sunflower',label:`해바라기 햇빛 ${n}`,apply:s=>{s.sunlight=n;}})),
  // Stateless companions are measured as they are.
  ...['antropy','cure_master','ash','venom'].map(id=>({id,label:HERO[id].name,apply:()=>{}})),
].filter(v=>!ONLY||v.id===ONLY);
// C average over the original normals (the index base used by simulate.mjs).
const BASE=['star_boy','snow_rabbit','silver_rabbit','night_rabbit','siren','mushroom_king'];
const measure=(id,rank,scenario,state)=>{let gain=0;for(let t=0;t<TEAMS;t++){const team=referenceTeam(t,id),seed=1000+t;
  const without=bench([...team,id],-1,rank,scenario,null,seed,state);
  const best=CANDIDATE_CELLS.map(cell=>bench([...team,id],cell,rank,scenario,ULT?id:null,seed,state)).reduce((a,b)=>b>a?b:a);
  gain+=(best-without)/TEAMS;}return gain;};
console.log(`## 조커·해바라기 상태별 기여 지수 (C 평균 = 1.00, 궁극기 ${ULT?'사용':'미사용'}, 팀 ${TEAMS}개)\n`);
console.log('| 성급 | 상태 | A 다수전 | B 보스전 | C 위기 | D 장기전 | 평균 |\n|---|---|---:|---:|---:|---:|---:|');
for(const rank of RANKS){
  const base={};for(const [key,sc] of Object.entries(SCENARIOS))base[key]=BASE.reduce((n,id)=>n+measure(id,rank,sc,null),0)/BASE.length;
  for(const v of VARIANTS){
    const idx=Object.fromEntries(Object.entries(SCENARIOS).map(([key,sc])=>[key,measure(v.id,rank,sc,v)/base[key]]));
    const mean=Object.values(idx).reduce((a,b)=>a+b,0)/4;
    console.log(`| ${rank}성 | ${v.label} | ${idx.crowd.toFixed(2)} | ${idx.boss.toFixed(2)} | ${idx.crisis.toFixed(2)} | ${idx.long.toFixed(2)} | **${mean.toFixed(2)}** |`);
  }
}

// Contribution bench for the stat renewal (docs/STAT_RENEWAL.md §1).
// Every companion is measured by how much it adds to sampled four-member
// teams in four fixed scenarios, using the real combat engine.
//   node defense_test/scripts/simulate.mjs [--teams 10] [--ranks 1,3,5] [--json out.json]
import fs from 'node:fs/promises';
import {HEROES,HERO} from '../src/content.js';
import * as engine from '../src/combat/engine.js';

const args=process.argv.slice(2),opt=(name,fallback)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:fallback;};
const TEAMS=Number(opt('teams',10)),RANKS=opt('ranks','1,3,5').split(',').map(Number),JSON_OUT=opt('json',null),DT=.05;
// Eight reference units (each team member twice) ring the centre like a
// mid-game board. The candidate is benched at the centre and at a bottom edge
// cell near the path (short-range companions), keeping the better placement.
const CANDIDATE_CELLS=[12,21],REF_CELLS=[6,7,8,11,13,16,17,18];
const RARITY_ORDER=['C','R','SR','UR'];
const budget={C:1,R:1.1,SR:1.25,UR:1.5};
const rarityOf=h=>h.hidden?'UR':h.rarity;
// Gold producers are judged on income, not on the damage bench.
const ECONOMY=new Set(['queen','doom']);

function rng(seed){let x=seed>>>0||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296;};}
// The same reference teams are reused for every candidate (excluding itself),
// so differences come from the candidate rather than from team luck.
const teamRandom=rng(20261008),teamPool=Array.from({length:TEAMS},()=>{const ids=HEROES.map(h=>h.id);for(let i=ids.length-1;i>0;i--){const j=Math.floor(teamRandom()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return ids;});
const referenceTeam=(index,exclude)=>teamPool[index].filter(id=>id!==exclude).slice(0,4);

// Scenario health is scaled by rank so a 1-star and 5-star bench both stay
// unsaturated (the reference team cannot clear everything).
const rankScale=r=>Math.pow(2.35,r-1);
const SCENARIOS={
  crowd:{label:'A 다수전',seconds:45,health:1e9,queue:r=>Array.from({length:40},(_,i)=>({kind:i%7===6?'armor':i%5===4?'runner':'grunt',hp:Math.round(900*rankScale(r))})),interval:.5},
  boss:{label:'B 보스전',seconds:60,health:1e9,queue:r=>[{kind:'boss',hp:Math.round(4e5*rankScale(r))},...Array.from({length:6},()=>({kind:'grunt',hp:Math.round(500*rankScale(r))}))],interval:1},
  crisis:{label:'C 위기',seconds:30,health:9,start:1450,queue:r=>Array.from({length:30},(_,i)=>({kind:i%3===2?'grunt':'runner',hp:Math.round(700*rankScale(r))})),interval:.45},
  // The long target stands mid-way along the bottom edge, inside every range.
  long:{label:'D 장기전',seconds:30,health:1e9,start:1394,queue:()=>[{kind:'boss',hp:1e12}],interval:1,freeze:true},
};

function bench(deck,candidateCell,rank,scenario,castId,seed){
  const s=engine.newRun({deck,chapter:0,seed});
  // Wave 2 with birth wave 1: wave-age companions sit at their neutral 100% step.
  s.wave=2;
  s.board=Array(25).fill(null);s.nextId+=1000;
  const placements=[...REF_CELLS.map((cell,i)=>[cell,deck[i%4]]),...(candidateCell>=0?[[candidateCell,deck[4]]]:[])];
  for(const [cell,id] of placements){s.board[cell]={uid:s.nextId++,hero:id,rank,cooldown:.25,windup:0,target:null,attacks:0,pose:0,born:0,birthWave:1,harvest:12,disabled:0,facing:'down',aim:Math.PI/2,idleFor:0,priority:HERO[id].bossDamage||HERO[id].bossPriority?'boss':'first'};}
  s.enemies=[];s.queue=scenario.queue(rank);s.waveTotal=s.queue.length;s.spawnIn=0;s.gold=1e6;s.health=scenario.health;
  const seen=new Set();let t=0;
  while(t<scenario.seconds&&['combat','intermission'].includes(s.phase)){
    if(scenario.health<100)s.health=scenario.health;
    // Spawn spacing follows the scenario rather than the stage plan.
    if(s.queue.length&&s.spawnIn>scenario.interval)s.spawnIn=scenario.interval;
    engine.step(s,DT);t+=DT;
    for(const e of s.enemies)if(!seen.has(e.uid)){seen.add(e.uid);if(scenario.start)e.progress=scenario.start;if(e.boss){e.skillIn=1e9;if(scenario.freeze)e.speed=0;}}
    if(castId&&s.enemies.some(e=>e.hp>0)){
      const cost=HERO[castId].skill.cost,wait=HERO[castId].skill.type==='starfall'?Math.max(cost,engine.GAUGE_MAX):cost;
      if(s.gauge>=wait)engine.cast(s,castId);
    }
  }
  return {damage:s.stats.damage,gold:Object.entries(s.stats.income).filter(([k])=>!['웨이브','격파'].includes(k)).reduce((n,[,v])=>n+v,0)};
}

const results={},reference={};
const start=Date.now();
for(const rank of RANKS){
  results[rank]={};reference[rank]={};
  for(const [key,scenario] of Object.entries(SCENARIOS)){
    const rows={};let base=0;
    for(const h of HEROES){
      let gain=0,gold=0;
      for(let t=0;t<TEAMS;t++){
        const team=referenceTeam(t,h.id),seed=1000+t;
        const without=bench([...team,h.id],-1,rank,scenario,null,seed);base+=without.damage/(TEAMS*HEROES.length);
        const best=CANDIDATE_CELLS.map(cell=>bench([...team,h.id],cell,rank,scenario,h.id,seed)).reduce((a,b)=>b.damage>a.damage?b:a);
        gain+=(best.damage-without.damage)/TEAMS;gold+=(best.gold-without.gold)/TEAMS;
      }
      rows[h.id]={gain,gold};
    }
    const cMean=HEROES.filter(h=>rarityOf(h)==='C').reduce((n,h)=>n+rows[h.id].gain,0)/HEROES.filter(h=>rarityOf(h)==='C').length;
    for(const id of Object.keys(rows))rows[id].index=rows[id].gain/cMean;
    results[rank][key]=rows;reference[rank][key]=base;
  }
}

const summary=RANKS.map(rank=>({rank,heroes:HEROES.map(h=>{
  const by=Object.fromEntries(Object.keys(SCENARIOS).map(k=>[k,results[rank][k][h.id].index]));
  const mean=Object.values(by).reduce((a,b)=>a+b,0)/Object.keys(by).length,rarity=rarityOf(h);
  return {id:h.id,name:h.name,rarity,hidden:!!h.hidden,...by,mean,budget:budget[rarity],deviation:mean/budget[rarity]-1,gold:results[rank].crowd[h.id].gold};
})}));

const pct=n=>(n>=0?'+':'')+Math.round(n*100)+'%';
for(const {rank,heroes} of summary){
  console.log(`\n## ${rank}성 · 팀 기여 지수 (C 평균 = 1.00)\n`);
  console.log('| 등급 | 동료 | A 다수전 | B 보스전 | C 위기 | D 장기전 | 평균 | 예산 | 편차 |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for(const r of [...heroes].sort((a,b)=>RARITY_ORDER.indexOf(a.rarity)-RARITY_ORDER.indexOf(b.rarity)||a.hidden-b.hidden||b.mean-a.mean))
    console.log(`| ${r.rarity}${r.hidden?'·H':''} | ${r.name} | ${r.crowd.toFixed(2)} | ${r.boss.toFixed(2)} | ${r.crisis.toFixed(2)} | ${r.long.toFixed(2)} | **${r.mean.toFixed(2)}** | ${r.budget.toFixed(2)} | ${ECONOMY.has(r.id)?'경제 (골드 '+Math.round(r.gold)+')':Math.abs(r.deviation)>.1?'**'+pct(r.deviation)+'**':pct(r.deviation)} |`);
  console.log('\n| 등급 | 평균 지수 | 예산 |\n|---|---:|---:|');
  for(const rarity of RARITY_ORDER){const list=heroes.filter(h=>h.rarity===rarity);console.log(`| ${rarity} | ${(list.reduce((n,h)=>n+h.mean,0)/list.length).toFixed(2)} | ${budget[rarity].toFixed(2)} |`);}
}
// Absolute damage of the eight-unit reference board: the overall power level.
console.log(`\n## 기준 보드 절대 피해 (전체 화력 수준)\n\n| 성급 | ${Object.values(SCENARIOS).map(x=>x.label).join(' | ')} |\n|---|${Object.keys(SCENARIOS).map(()=>'---:').join('|')}|`);
for(const rank of RANKS)console.log(`| ${rank}성 | ${Object.keys(SCENARIOS).map(k=>Math.round(reference[rank][k]).toLocaleString('en-US')).join(' | ')} |`);
console.error(`\n${TEAMS} teams × ${RANKS.length} ranks × 4 scenarios · ${((Date.now()-start)/1000).toFixed(1)}s`);
if(JSON_OUT)await fs.writeFile(JSON_OUT,JSON.stringify({teams:TEAMS,ranks:RANKS,reference,summary},null,2)+'\n');

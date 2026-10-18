// Team-contribution bench for chosen heroes in the dummy worktree (same method as scripts/simulate.mjs).
//   node --import ./preload.mjs contrib.mjs --heroes joker,ash [--ranks 1,3,5] [--teams 10] [--team a,b,c,d] [--centre|--edge] [--chapter 2] [--json out.json]
// Index = gain / mean gain of the six ORIGINAL Normal heroes (so new Normals never move the yardstick); the random
// reference teams are drawn from the 31 live heroes in HEROES order, exactly like scripts/simulate.mjs.
import fs from 'node:fs/promises';
const WT=process.env.UP_WT||new URL('../../src/',import.meta.url).href;
const {HEROES,HERO}=await import(WT+'content.js');
const engine=await import(WT+'combat/engine.js');
const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:f;};
const NEW=new Set(['joker','underdog','toffee_apple','antropy','ash','cure_master','venom']);
const ORIG_C=['star_boy','snow_rabbit','silver_rabbit','night_rabbit','siren','mushroom_king'];
const WANT=(opt('heroes','')||'').split(',').filter(Boolean),RANKS=opt('ranks','1,3,5').split(',').map(Number),TEAMS=Number(opt('teams',10)),DT=.05;
const CHAPTER=Number(opt('chapter',2));
const FIXED=(opt('team','')||'').split(',').filter(Boolean),CANDIDATE_CELLS=args.includes('--centre')?[12]:args.includes('--edge')?[21]:[12,21];
const REF_CELLS=[6,7,8,11,13,16,17,18],budget={C:1,R:1.1,SR:1.25,UR:1.5},rarityOf=h=>h.hidden?'UR':h.rarity;
function rng(seed){let x=seed>>>0||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296;};}
const POOL=HEROES.filter(h=>!NEW.has(h.id)).map(h=>h.id);
const teamRandom=rng(20261008),teamPool=Array.from({length:TEAMS},()=>{const ids=[...POOL];for(let i=ids.length-1;i>0;i--){const j=Math.floor(teamRandom()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return ids;});
const referenceTeam=(index,exclude)=>FIXED.length?FIXED:teamPool[index].filter(id=>id!==exclude).slice(0,4);
const rankScale=r=>Math.pow(2.35,r-1);
const SCENARIOS={
  crowd:{label:'A 다수전',seconds:45,health:1e9,queue:r=>Array.from({length:40},(_,i)=>({kind:i%7===6?'armor':i%5===4?'runner':'grunt',hp:Math.round(900*rankScale(r))})),interval:.5},
  boss:{label:'B 보스전',seconds:60,health:1e9,queue:r=>[{kind:'boss',hp:Math.round(4e5*rankScale(r))},...Array.from({length:6},()=>({kind:'grunt',hp:Math.round(500*rankScale(r))}))],interval:1},
  crisis:{label:'C 위기',seconds:30,health:9,start:1450,queue:r=>Array.from({length:30},(_,i)=>({kind:i%3===2?'grunt':'runner',hp:Math.round(700*rankScale(r))})),interval:.45},
  long:{label:'D 장기전',seconds:30,health:1e9,start:1394,queue:()=>[{kind:'boss',hp:1e12}],interval:1,freeze:true},
};
function bench(deck,candidateCell,rank,scenario,castId,seed){
  const s=engine.newRun({deck,chapter:CHAPTER,seed});s.wave=2;s.board=Array(25).fill(null);s.nextId+=1000;
  const placements=[...REF_CELLS.map((cell,i)=>[cell,deck[i%4]]),...(candidateCell>=0?[[candidateCell,deck[4]]]:[])];
  for(const [cell,id] of placements)s.board[cell]={uid:s.nextId++,hero:id,rank,cooldown:.25,windup:0,target:null,attacks:0,pose:0,born:0,birthWave:1,harvest:12,disabled:0,facing:'down',aim:Math.PI/2,idleFor:0,priority:HERO[id].bossDamage||HERO[id].bossPriority?'boss':'first'};
  s.enemies=[];s.queue=scenario.queue(rank);s.waveTotal=s.queue.length;s.spawnIn=0;s.gold=1e6;s.health=scenario.health;
  const seen=new Set();let t=0,casts=0;
  while(t<scenario.seconds&&['combat','intermission'].includes(s.phase)){
    if(scenario.health<100)s.health=scenario.health;
    if(s.queue.length&&s.spawnIn>scenario.interval)s.spawnIn=scenario.interval;
    engine.step(s,DT);t+=DT;s.events.length=0;
    for(const e of s.enemies)if(!seen.has(e.uid)){seen.add(e.uid);if(scenario.start)e.progress=scenario.start;if(e.boss){e.skillIn=1e9;if(scenario.freeze)e.speed=0;}}
    if(castId&&s.enemies.some(e=>e.hp>0)){const cost=HERO[castId].skill.cost,wait=HERO[castId].skill.type==='starfall'?Math.max(cost,engine.GAUGE_MAX):cost;if(s.gauge>=wait&&engine.cast(s,castId).ok)casts++;}
  }
  return {damage:s.stats.damage,casts};
}
const measured=[...new Set([...ORIG_C,...WANT])];
const results={},meta={};
for(const rank of RANKS){
  results[rank]={};meta[rank]={};
  for(const [key,scenario] of Object.entries(SCENARIOS)){
    const rows={};let baseDamage=0;
    for(const id of measured){
      let gain=0,casts=0;
      for(let t=0;t<TEAMS;t++){
        const team=referenceTeam(t,id),seed=1000+t;
        const without=bench([...team,id],-1,rank,scenario,null,seed);
        const best=CANDIDATE_CELLS.map(cell=>bench([...team,id],cell,rank,scenario,id,seed)).reduce((a,b)=>b.damage>a.damage?b:a);
        gain+=(best.damage-without.damage)/TEAMS;casts+=best.casts/TEAMS;if(id===ORIG_C[0])baseDamage+=without.damage/TEAMS;
      }
      rows[id]={gain,casts};
    }
    const cMean=ORIG_C.reduce((n,id)=>n+rows[id].gain,0)/ORIG_C.length;
    for(const id of measured)rows[id].index=rows[id].gain/cMean;
    results[rank][key]=rows;meta[rank][key]={base:baseDamage,cMeanGain:cMean};
  }
}
const lines=[];
for(const rank of RANKS){
  lines.push(`\n## ${rank}성 (C 평균 = 1.00)\n`,'| 동료 | 등급 | A 다수전 | B 보스전 | C 위기 | D 장기전 | 평균 | 예산 | 편차 | 시전/전투 |','|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for(const id of WANT){
    const h=HERO[id],by=Object.fromEntries(Object.keys(SCENARIOS).map(k=>[k,results[rank][k][id].index])),mean=Object.values(by).reduce((a,b)=>a+b,0)/4,b=budget[rarityOf(h)];
    const casts=Object.keys(SCENARIOS).reduce((n,k)=>n+results[rank][k][id].casts,0)/4;
    lines.push(`| ${h.name} | ${rarityOf(h)} | ${by.crowd.toFixed(2)} | ${by.boss.toFixed(2)} | ${by.crisis.toFixed(2)} | ${by.long.toFixed(2)} | **${mean.toFixed(2)}** | ${b.toFixed(2)} | ${((mean/b-1)*100).toFixed(0)}% | ${casts.toFixed(1)} |`);
  }
}
console.log(lines.join('\n'));
const out=opt('json',null);if(out)await fs.writeFile(out,JSON.stringify({ranks:RANKS,teams:TEAMS,fixed:FIXED,results,meta},null,2));

// Focused version of simulate.mjs's actual-engine marginal-contribution bench.
// It compares every C/R/SR plus relevant UR area/support peers and all miracle forms.
// No game balance is inferred from rarity labels; support/control contribute through actual engine outcomes.
import fs from 'node:fs/promises';
import {HERO,HEROES,DEFAULT_DECK} from '../src/content.js';
import * as E from '../src/combat/engine.js';
const arg=(key,fallback)=>{const i=process.argv.indexOf('--'+key);return i<0?fallback:process.argv[i+1];};
const rank=Number(arg('rank',3)),teams=Number(arg('teams',3)),setting=arg('crit','base');
const crit=setting==='garden'?{chance:.2,damage:2}:{chance:.05,damage:1.5};
const only=arg('heroes','').split(',').filter(Boolean),file=arg('out','defense/test-results/demon-miracle-balance.json');
const peers=HEROES.filter(h=>h.rarity!=='UR'||['jasmine','venom','galaxy_whale','behemoth','harmonious'].includes(h.id));
const variants=[...peers.map(h=>({id:h.id,hero:h.id,name:h.name,rarity:h.rarity,cast:true})),
  ...Object.entries(E.MIRACLE_FORMS).map(([form,h])=>({id:form==='miracle_larva'?'miracle_larva_waiting':form,hero:'miracle_larva',name:h.name+(form==='miracle_larva'?' 대기':''),rarity:['miracle_larva','miracle_cocoon'].includes(form)?'R':'UR',form,cast:false}))]
  .filter(v=>!only.length||v.rarity==='C'||only.includes(v.id));
const scenarios={
  crowd:{seconds:30,interval:.5,queue:()=>Array.from({length:36},(_,i)=>({kind:i%7===6?'armor':i%5===4?'runner':'grunt',hp:900*2.35**(rank-1)}))},
  boss:{seconds:30,interval:1,queue:()=>[{kind:'boss',hp:1e12},...Array.from({length:6},()=>({kind:'grunt',hp:500*2.35**(rank-1)}))]},
  long:{seconds:30,interval:1,start:1394,freeze:true,queue:()=>[{kind:'boss',hp:1e12}]},
};
const fixedTeams=[['snow_rabbit','great_detective','silver_rabbit','red_dragon'],['mushroom_king','guardian','siren','ash'],['phantom','frost_witch','venom','jasmine']];
const reference=(n,id)=>{const ids=fixedTeams[n%fixedTeams.length].filter(x=>x!==id);for(const x of DEFAULT_DECK)if(!ids.includes(x)&&x!==id&&ids.length<4)ids.push(x);return ids.slice(0,4);};
const refCells=[6,7,8,11,13,16,17,18];
function bench(v,team,cell,scenario,seed){
  const deck=[...team,v.hero],s=E.newRun({deck,chapter:2,seed,crit});const template=s.board.find(Boolean);s.board.fill(null);s.nextId+=1000;s.wave=2;
  for(const [at,hero] of [...refCells.map((at,i)=>[at,team[i%4]]),...(cell>=0?[[cell,v.hero]]:[])]){
    s.board[at]={...template,uid:s.nextId++,hero,rank,birthWave:1,form:hero==='miracle_larva'?(at===cell?v.form||'miracle_larva':'miracle_larva'):undefined,cooldown:.25,windup:0,target:null,attacks:0,disabled:0,cursed:false,priority:HERO[hero].bossDamage?'boss':'first'};
  }
  s.enemies=[];s.queue=scenario.queue();s.spawnIn=0;s.gold=1e6;s.health=1e9;const seen=new Set();
  for(let t=0;t<scenario.seconds;t+=.05){
    s.health=1e9;if(s.queue.length)s.spawnIn=Math.min(s.spawnIn,scenario.interval);E.step(s,.05);
    for(const e of s.enemies)if(!seen.has(e.uid)){seen.add(e.uid);if(scenario.start)e.progress=scenario.start;if(e.boss){e.skillIn=1e9;if(scenario.freeze)e.speed=0;}}
    if(cell>=0&&v.cast&&s.gauge>=E.skillCost(s,v.hero)&&s.enemies.some(e=>e.hp>0))E.cast(s,v.hero);
    s.events=[];if(!s.enemies.length&&!s.queue.length)break;
  }
  return {damage:s.stats.damage,heroDamage:s.stats.byHero[v.hero]||0,casts:s.stats.skills,form:s.board[cell]?.form||null};
}
const rows=[];
for(const v of variants){
  const by={};for(const [key,scene] of Object.entries(scenarios)){
    let gain=0;for(let n=0;n<teams;n++){const team=reference(n,v.hero),base=bench(v,team,-1,scene,1000+n);const best=[12,14,21].map(c=>bench(v,team,c,scene,1000+n)).sort((a,b)=>b.damage-a.damage)[0];gain+=(best.damage-base.damage)/teams;}
    by[key]=gain;
  }
  rows.push({...v,gain:by});
}
const refs=Object.fromEntries(Object.keys(scenarios).map(key=>[key,rows.filter(r=>r.rarity==='C').reduce((n,r)=>n+r.gain[key],0)/rows.filter(r=>r.rarity==='C').length]));
for(const r of rows){r.index=Object.fromEntries(Object.entries(r.gain).map(([k,v])=>[k,v/refs[k]]));r.mean=Object.values(r.index).reduce((a,b)=>a+b)/3;}
// Closed-form burst comparison uses actual current attack powers, then separates conditional targets and DOT.
const bursts=[...HEROES.filter(h=>h.rarity==='R'||['ash','flame_sage','jasmine','galaxy_whale'].includes(h.id))].map(h=>({id:h.id,name:h.name,damage:h.damage,cost:h.skill.cost,skill:h.skill.name}));
const result={method:'Actual engine, simulate.mjs reference-board method; 30-second crowd/moving boss/stationary boss; candidate at centre/edge, better placement. Reference teams are explicit and include typical two-status and rich-status lineups. Only candidate ultimate is cast. Fixed-form rows deliberately exclude evolution cost; collector row includes its50-starlight evolution but no merges, so it is a high-wing-uptime bound, not a full-run tier list.',rank,teams,crit,references:fixedTeams,normalizers:refs,rows,burstInputs:bursts};
await fs.writeFile(file,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({rank,teams,crit,rows:rows.map(r=>({id:r.id,...Object.fromEntries(Object.entries(r.index).map(([k,v])=>[k,+v.toFixed(3)])),mean:+r.mean.toFixed(3)}))},null,2));

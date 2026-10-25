// Zeke's basic attack moved from a 90-degree cleave band to a self-centred circle (pass 18). This compares the old
// shape with candidate circle sizes and powers on demon-miracle-bench.mjs's actual-engine reference boards: the same
// three scenes, reference teams, candidate cells (better of 12/14/21) and C-average normalisation.
// Usage: node defense/scripts/zeke-bench.mjs [--rank 3] [--teams 3] [--out file]
import fs from 'node:fs/promises';
import {HERO,HEROES,DEFAULT_DECK} from '../src/content.js';
import * as E from '../src/combat/engine.js';
const arg=(key,fallback)=>{const i=process.argv.indexOf('--'+key);return i<0?fallback:process.argv[i+1];};
const rank=Number(arg('rank',3)),teams=Number(arg('teams',3)),file=arg('out','defense/test-results/zeke-bench.json');
const crit={chance:.05,damage:1.5};
const scenarios={
  crowd:{seconds:30,interval:.5,queue:()=>Array.from({length:36},(_,i)=>({kind:i%7===6?'armor':i%5===4?'runner':'grunt',hp:900*2.35**(rank-1)}))},
  boss:{seconds:30,interval:1,queue:()=>[{kind:'boss',hp:1e12},...Array.from({length:6},()=>({kind:'grunt',hp:500*2.35**(rank-1)}))]},
  long:{seconds:30,interval:1,start:1394,freeze:true,queue:()=>[{kind:'boss',hp:1e12}]},
};
const fixedTeams=[['snow_rabbit','great_detective','silver_rabbit','red_dragon'],['mushroom_king','guardian','siren','ash'],['phantom','frost_witch','venom','jasmine']];
const reference=(n,id)=>{const ids=fixedTeams[n%fixedTeams.length].filter(x=>x!==id);for(const x of DEFAULT_DECK)if(!ids.includes(x)&&x!==id&&ids.length<4)ids.push(x);return ids.slice(0,4);};
const refCells=[6,7,8,11,13,16,17,18];
const original={...HERO.zeke};
const zekeVariants=[
  {id:'zeke_old',name:'지크 이전(부채꼴 345/90, 25)',shape:'cleave',range:345,radius:90,damage:25},
  ...[230,250,270].flatMap(r=>[25,27,28,30,31,32].map(d=>({id:`zeke_pulse_${r}_${d}`,name:`지크 원형 ${r}, ${d}`,shape:'pulse',range:r,radius:r,damage:d}))),
];
const refs=['guardian','behemoth','luna','jasmine','venom','cherry_prince'];
const variants=[...HEROES.filter(h=>h.rarity==='C').map(h=>({id:h.id,hero:h.id,rarity:'C'})),...refs.map(id=>({id,hero:id,rarity:HERO[id].rarity})),...zekeVariants.map(z=>({...z,hero:'zeke',rarity:'UR',zeke:z}))];
function bench(v,team,cell,scenario,seed){
  const deck=[...team,v.hero],s=E.newRun({deck,chapter:2,seed,crit});const template=s.board.find(Boolean);s.board.fill(null);s.nextId+=1000;s.wave=2;
  for(const [at,hero] of [...refCells.map((at,i)=>[at,team[i%4]]),...(cell>=0?[[cell,v.hero]]:[])])
    s.board[at]={...template,uid:s.nextId++,hero,rank,birthWave:1,cooldown:.25,windup:0,target:null,attacks:0,disabled:0,cursed:false,priority:HERO[hero].bossDamage?'boss':'first'};
  s.enemies=[];s.queue=scenario.queue();s.spawnIn=0;s.gold=1e6;s.health=1e9;const seen=new Set();
  for(let t=0;t<scenario.seconds;t+=.05){
    s.health=1e9;if(s.queue.length)s.spawnIn=Math.min(s.spawnIn,scenario.interval);E.step(s,.05);
    for(const e of s.enemies)if(!seen.has(e.uid)){seen.add(e.uid);if(scenario.start)e.progress=scenario.start;if(e.boss){e.skillIn=1e9;if(scenario.freeze)e.speed=0;}}
    if(cell>=0&&s.gauge>=HERO[v.hero].skill.cost&&s.enemies.some(e=>e.hp>0))E.cast(s,v.hero);
    s.events=[];if(!s.enemies.length&&!s.queue.length)break;
  }
  return {damage:s.stats.damage,cell};
}
const rows=[];
for(const v of variants){
  if(v.zeke)Object.assign(HERO.zeke,{shape:v.zeke.shape,range:v.zeke.range,radius:v.zeke.radius,damage:v.zeke.damage});else Object.assign(HERO.zeke,original);
  const by={},cells={};for(const [key,scene] of Object.entries(scenarios)){
    let gain=0;cells[key]=[];for(let n=0;n<teams;n++){const team=reference(n,v.hero),base=bench(v,team,-1,scene,1000+n);const best=[12,14,21].map(c=>bench(v,team,c,scene,1000+n)).sort((a,b)=>b.damage-a.damage)[0];gain+=(best.damage-base.damage)/teams;cells[key].push(best.cell);}
    by[key]=gain;
  }
  rows.push({id:v.id,name:v.name||HERO[v.hero].name,rarity:v.rarity,gain:by,cells});
}
Object.assign(HERO.zeke,original);
const norm=Object.fromEntries(Object.keys(scenarios).map(key=>[key,rows.filter(r=>r.rarity==='C').reduce((n,r)=>n+r.gain[key],0)/rows.filter(r=>r.rarity==='C').length]));
for(const r of rows){r.index=Object.fromEntries(Object.entries(r.gain).map(([k,v])=>[k,v/norm[k]]));r.mean=Object.values(r.index).reduce((a,b)=>a+b)/3;}
await fs.mkdir(new URL('../test-results/',import.meta.url),{recursive:true}).catch(()=>{});
await fs.writeFile(file,JSON.stringify({method:'demon-miracle-bench reference boards; Zeke shape/power swapped at runtime; ultimate cast when affordable',rank,teams,crit,normalizers:norm,rows},null,2)+'\n');
for(const r of rows.filter(r=>r.rarity!=='C'))console.log(r.id.padEnd(22),Object.values(r.index).map(v=>v.toFixed(3)).join(' / '),'mean',r.mean.toFixed(3),JSON.stringify(r.cells));

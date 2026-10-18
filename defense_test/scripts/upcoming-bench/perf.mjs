// Engine cost of status-heavy teams: wall time per simulated second with 40 long-lived enemies, comparing a Venom team
// (poison stacks + burn on everything, plus the plague ultimate) with the same board using Luna instead.
//   node --import ./preload.mjs perf.mjs [--seconds 60] [--runs 5]
import {engine,HERO} from './play.mjs';
const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:f;};
const SECONDS=Number(opt('seconds',60)),RUNS=Number(opt('runs',5)),DT=.05;
function run(hero,upcoming){
  const deck=[hero,'mushroom_king','phantom','flame_sage','red_dragon'];
  const s=engine.newRun({deck,chapter:2,seed:7});s.board=Array(25).fill(null);s.nextId+=1000;
  [[6,hero],[7,hero],[8,'mushroom_king'],[11,'phantom'],[13,'flame_sage'],[16,'red_dragon'],[17,hero],[18,'mushroom_king'],[12,hero]].forEach(([cell,id])=>{s.board[cell]={uid:s.nextId++,hero:id,rank:3,cooldown:.25,windup:0,target:null,attacks:0,pose:0,born:0,birthWave:1,harvest:12,disabled:0,facing:'down',aim:Math.PI/2,idleFor:0,priority:'first'};});
  s.queue=Array.from({length:400},()=>({kind:'grunt',hp:1e12}));s.waveTotal=400;s.spawnIn=0;s.gold=1e6;s.health=1e9;s.gauge=1e6;
  let steps=0,casts=0;const t0=process.hrtime.bigint();
  for(let t=0;t<SECONDS;t+=DT){if(s.queue.length&&s.spawnIn>.25)s.spawnIn=.25;engine.step(s,DT);steps++;s.events.length=0;if(upcoming&&s.enemies.length&&s.gauge>=HERO[hero].skill.cost&&Math.floor(t)%12===0){if(engine.cast(s,hero).ok)casts++;}else if(s.gauge>=90&&!upcoming)engine.cast(s,hero);}
  const ms=Number(process.hrtime.bigint()-t0)/1e6;
  const poison=s.enemies.reduce((n,e)=>n+(e.poison||0),0);
  return {msPerStep:ms/steps,alive:s.enemies.length,poisonStacks:poison,casts,buff:s.buffs.venom||0};
}
const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
const out={};
for(const [label,hero,up] of [['luna(기준)','luna',false],['venom','venom',true]]){const r=Array.from({length:RUNS},()=>run(hero,up));out[label]={casts:median(r.map(x=>x.casts)),ms:median(r.map(x=>x.msPerStep)),alive:median(r.map(x=>x.alive)),poison:median(r.map(x=>x.poisonStacks))};}
for(const [k,v] of Object.entries(out))console.log(`${k}: ${v.ms.toFixed(3)} ms/step · 시전 ${v.casts} · 생존 ${v.alive} · 독 중첩 합계 ${v.poison}`);
console.log(`비율 ${(out.venom.ms/out['luna(기준)'].ms).toFixed(2)}x (16.7ms 프레임 안에 3틱이 들어가는지: venom ${(out.venom.ms*3).toFixed(2)}ms)`);

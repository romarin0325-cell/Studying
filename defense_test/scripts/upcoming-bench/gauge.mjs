// Starlight earned per fight with a candidate on the reference board (no casting), so a hero whose marks or kills
// feed the gauge can be seen as an economy source. Gauge cap is lifted so nothing overflows.
//   node --import ./preload.mjs gauge.mjs --heroes joker,silver_rabbit [--ranks 3] [--teams 10] [--seconds 45]
const WT=process.env.UP_WT||new URL('../../src/',import.meta.url).href;
const {HEROES,HERO}=await import(WT+'content.js');
const engine=await import(WT+'combat/engine.js');
const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:f;};
const WANT=(opt('heroes','')||'').split(',').filter(Boolean),RANKS=opt('ranks','3').split(',').map(Number),TEAMS=Number(opt('teams',10)),SECONDS=Number(opt('seconds',45)),DT=.05;
const NEW=new Set(['joker','underdog','toffee_apple','antropy','ash','cure_master','venom']);
function rng(seed){let x=seed>>>0||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;x>>>=0;return x/4294967296;};}
const POOL=HEROES.filter(h=>!NEW.has(h.id)).map(h=>h.id);
const teamRandom=rng(20261008),teamPool=Array.from({length:TEAMS},()=>{const ids=[...POOL];for(let i=ids.length-1;i>0;i--){const j=Math.floor(teamRandom()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return ids;});
const REF_CELLS=[6,7,8,11,13,16,17,18];
const rankScale=r=>Math.pow(2.35,r-1);
function gaugeOf(deck,cell,rank){
  const s=engine.newRun({deck,chapter:2,seed:1000});s.wave=2;s.board=Array(25).fill(null);s.nextId+=1000;s.gaugeMax=1e6;s.gauge=0;
  const place=[...REF_CELLS.map((c,i)=>[c,deck[i%4]]),...(cell>=0?[[cell,deck[4]]]:[])];
  for(const [c,id] of place)s.board[c]={uid:s.nextId++,hero:id,rank,cooldown:.25,windup:0,target:null,attacks:0,pose:0,born:0,birthWave:1,harvest:12,disabled:0,facing:'down',aim:Math.PI/2,idleFor:0,priority:'first'};
  s.enemies=[];s.queue=Array.from({length:40},(_,i)=>({kind:i%7===6?'armor':i%5===4?'runner':'grunt',hp:Math.round(900*rankScale(rank))}));s.waveTotal=40;s.spawnIn=0;s.gold=1e6;s.health=1e9;
  let t=0;while(t<SECONDS&&['combat','intermission'].includes(s.phase)){if(s.queue.length&&s.spawnIn>.5)s.spawnIn=.5;engine.step(s,DT);t+=DT;s.events.length=0;}
  return {gauge:s.gauge,kills:s.stats.kills};
}
for(const rank of RANKS)for(const id of WANT){
  let gain=0,kills=0;
  for(let t=0;t<TEAMS;t++){const team=teamPool[t].filter(x=>x!==id).slice(0,4);const w=gaugeOf([...team,id],21,rank),n=gaugeOf([...team,id],-1,rank);gain+=(w.gauge-n.gauge)/TEAMS;kills+=(w.kills-n.kills)/TEAMS;}
  console.log(`${HERO[id].name} ${rank}성: 별빛 ${gain>=0?'+':''}${gain.toFixed(1)} / ${SECONDS}초 (처치 ${kills>=0?'+':''}${kills.toFixed(1)})`);
}

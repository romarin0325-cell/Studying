// Relic COMBO / LOOP bench (smart auto, deterministic seeds, real engine).
//   node defense_test/scripts/relic-combo.mjs static
//   node defense_test/scripts/relic-combo.mjs run [--combos a+b,c] [--level N] [--seeds 2] [--json out.json]
// Default `run` prints relic levels 1 and 10 and uses 2 seeds (same width as relic-bench dps).
// `--level N` prints one level. All relic-bench decks plus the two santa decks, waves 6 and 12.
// Boards: start of waves 6 and 12 of a weekly-hard endless run, per deck and seed. A deck that dies
// before a wave simply has no snapshot there. Each board then fights 60 s (enemy hp ×40, including a
// later wave if the first one ends) with smartAutoPlay every 0.32 s, same drive shape as relic-bench.
// Gold is income gained. Starlight buckets replay the engine formulas (tick 1.2/s, merge +12, hourglass
// bonus, lantern refund, sand released on cast, broken_clock while a buff is up, kill, wave +8). Sand is
// the hourglass bank (cap 120, not scaled) emptied on the next cast. `other`/`drain` is the residual.
// LOOP is true if, on that board, any of: cast rate rises across the three 20 s slices of a full minute
// and casts >6/min; gauge stays at or above the cheapest ult after 20 s while casts >6/min; at least
// 3 merges with the board not shrinking and no paid summon; else 3+ santa gifts grow the board with no
// paid summon; else casts stay >=12/min and no 20 s slice falls under 6/min.
// V = mean(combo/none − 1) / mean(power10/none − 1). power10 is +10% power and no relic, as in relic-bench.
import {writeFileSync} from 'node:fs';
import {HERO,ARTIFACT} from '../src/content.js';
import {heroMultiplier,specialMultiplier,springGauge} from '../src/economy.js';
import * as E from '../src/combat/engine.js';
import {smartAutoPlay} from '../src/smart-auto.js';

const args=process.argv.slice(2),MODE=args[0]&&!args[0].startsWith('--')?args[0]:'run',opt=(n,f)=>{const i=args.indexOf('--'+n);return i<0?f:args[i+1];};
const SEEDS=Number(opt('seeds',2)),levelArg=opt('level',null),LEVELS=levelArg==null?[1,10]:[Number(levelArg)],JSON_PATH=opt('json',null);
if(!Number.isInteger(SEEDS)||SEEDS<1)throw new Error('--seeds needs a positive integer');
if(LEVELS.some(n=>!Number.isInteger(n)||n<1))throw new Error('--level needs a positive integer');
const DECKS={
  mixed1:'star_boy,snow_rabbit,night_rabbit,siren,santa',strike:'zeke,luna,jasmine,ancient_dragon,great_detective',burn:'flame_sage,red_dragon,zeke,cherry_prince,siren',
  marks:'silver_rabbit,jasmine,galaxy_whale,cherry_prince,aurora',slow:'snow_rabbit,avalanche_maid,frost_witch,guardian,storm_sage',aura:'siren,ancient_dragon,harmonious,time_magician,zeke',
  chain:'lightning_sage,night_rabbit,storm_sage,snow_rabbit,silver_rabbit',poison:'mushroom_king,phantom,time_ruler,galaxy_whale,siren',zone:'flame_sage,mushroom_king,phantom,galaxy_whale,time_ruler',
  buff:'siren,ancient_dragon,harmonious,rumi,jasmine',
  santa_loop:'santa,doom,queen,zeke,lightning_sage',santa_mix:'santa,siren,zeke,lightning_sage,flame_sage',
};
const BUFF=DECKS.buff.split(','),hasAll=(d,ids)=>ids.every(id=>d.includes(id));
const COMBOS=[
  {id:'lantern',relics:['lantern']},{id:'hourglass',relics:['hourglass']},{id:'lantern+hourglass',relics:['lantern','hourglass']},
  {id:'lantern+hourglass/santa',relics:['lantern','hourglass'],where:d=>d.includes('santa')},
  {id:'lantern+hourglass/santa+queen',relics:['lantern','hourglass'],where:d=>d.includes('santa')&&d.includes('queen')},
  {id:'lantern+hourglass/santa+queen+doom',relics:['lantern','hourglass'],where:d=>d.includes('santa')&&d.includes('queen')&&d.includes('doom')},
  {id:'broken_clock',relics:['broken_clock'],where:d=>hasAll(d,BUFF)},
  {id:'broken_clock+lantern',relics:['broken_clock','lantern']},
  {id:'twin',relics:['twin']},{id:'twin+lantern',relics:['twin','lantern']},{id:'chorus',relics:['chorus']},{id:'crown',relics:['crown']},
  {id:'constellation',relics:['constellation']},{id:'meteor',relics:['meteor']},{id:'orbit',relics:['orbit']},{id:'tide',relics:['tide']},{id:'banner',relics:['banner']},
];
for(const c of COMBOS)for(const id of c.relics)if(!ARTIFACT[id])throw new Error('unknown relic '+id);
const WANT=opt('combos',null)?.split(',').filter(Boolean)??null;
const KNOWN=new Map([['none',{id:'none',relics:[]}],['power10',{id:'power10',relics:'power10'}],...COMBOS.map(c=>[c.id,c])]);
if(WANT?.some(id=>!KNOWN.has(id)))throw new Error('unknown combo: '+WANT.filter(id=>!KNOWN.has(id)).join(',')+' · '+[...KNOWN.keys()].join(','));
const LIST=WANT?WANT.map(id=>KNOWN.get(id)):[KNOWN.get('none'),KNOWN.get('power10'),...COMBOS];
if(!LIST.some(c=>c.id==='power10'))LIST.push(KNOWN.get('power10'));
const G=22,beds={rose:3+G,spring:Math.min(30,3*(G-14)),seed:0};
const metaFor=deck=>Object.fromEntries(deck.map(id=>[id,{power:heroMultiplier({enhance:0},beds),special:specialMultiplier(0)}]));
const CLOCK=['haste','awaken','march','festive','radiance','harmony','echo','trauma']; // engine CLOCK_BUFFS, not exported
const scaleOf=(id,level)=>E.relicScaleIn({relicLevels:{[id]:level}},id);
const fmt=v=>{const t=(Math.round(v*100)/100).toFixed(2);return t.replace(/\.00$/,'').replace(/(\.\d)0$/,'$1');};
const pct=v=>(v>=0?'+':'')+(v*100).toFixed(1)+'%';
const mean=(xs,f)=>xs.reduce((n,x)=>n+f(x),0)/(xs.length||1);
function drive(s,seconds,stopAt){
  let autoIn=0,pick=false,t=0;const limit=seconds/.05;
  while(s.phase!=='victory'&&s.phase!=='defeat'&&t<limit){const before=s.phase;E.step(s,.05);t++;s.events.length=0;if(stopAt&&stopAt(s))return true;
    if(pick){smartAutoPlay(s);pick=false;}else if(before!=='reward'&&s.phase==='reward')pick=true;else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=.05;if(autoIn>=.32){smartAutoPlay(s);autoIn=0;}}}
  return false;
}
function snapshots(deck,seed){
  const s=E.newRun({deck,chapter:seed%9,seed,meta:metaFor(deck),mode:'weekly',tier:'hard',gaugeMax:springGauge(beds.spring)});s.endless=true;
  const out=[];for(const wave of [6,12]){if(!drive(s,2000,x=>x.phase==='combat'&&x.wave===wave&&x.waveTime<.06))break;out.push(E.serialize(s));}
  return out;
}
// Lantern refund: a share of the spent starlight since relic pass 7 (values below 1), a flat amount before.
const back=(spent,refund)=>refund<1?spent*refund:refund;
const blank=()=>({tick:0,merge:0,hourglass:0,lantern:0,sand:0,clock:0,kill:0,wave:0,mend:0,spent:0,waste:0,drain:0,other:0,maxGap:0});
function pour(flow,g,cap,name,amt){if(!(amt>0))return g;const got=Math.min(amt,Math.max(0,cap-g));flow[name]+=got;flow.waste+=amt-got;return g+got;}
function note(flow,g,actual){const d=actual-g;if(d>1e-3)flow.other+=d;else if(d<-1e-3)flow.drain+=-d;flow.maxGap=Math.max(flow.maxGap,Math.abs(d));}
function clockGain(s,dt){if(!E.has(s,'broken_clock'))return 0;const covered=Math.min(dt,Math.max(0,...CLOCK.map(k=>s.buffs[k]||0)));return covered>0?E.RELIC_VALUES.broken_clock.starlight*E.relicScaleIn(s,'broken_clock')*covered:0;}
// One smart-auto action. Returns whether it cast, and records the gauge it moved.
function attributeAuto(s,flow,before,casts,onCast){
  const cap=E.gaugeCap(s);let g=before.gauge,cast=false;
  if(s.stats.skills>before.skills+1||s.stats.merges>before.merges+1){note(flow,g,s.gauge);return false;}
  if(s.stats.skills>before.skills){
    const ev=s.events.find(e=>e.type==='skill'),id=ev?.hero,hero=HERO[id],spent=hero?.skill.type==='starfall'?before.gauge:(hero?.skill.cost||0);
    flow.spent+=spent;g-=spent;if(id)casts[id]=(casts[id]||0)+1;if(hero?.skill.type==='gift')casts.gift=(casts.gift||0)+1;onCast();cast=true;
    g=pour(flow,Math.max(0,g),cap,'lantern',E.has(s,'lantern')?back(spent,E.RELIC_VALUES.lantern.refund*E.relicScaleIn(s,'lantern')):0);
    g=pour(flow,g,cap,'sand',before.sand);
  }else if(s.stats.merges>before.merges){
    const bonus=E.has(s,'hourglass')?E.RELIC_VALUES.hourglass.starlight*E.relicScaleIn(s,'hourglass'):0,gain=12+bonus,overflow=Math.max(0,before.gauge+gain-cap),got=gain-overflow;
    const base=Math.min(12,got);flow.merge+=base;flow.hourglass+=got-base;
    const stored=E.has(s,'hourglass')?Math.max(0,Math.min(E.RELIC_VALUES.hourglass.store,before.sand+overflow)-before.sand):0;flow.waste+=Math.max(0,overflow-stored);g=before.gauge+got;
  }else{const bless=s.events.find(e=>e.type==='blessing');if(bless?.id==='mend')g=pour(flow,g,cap,'mend',20);}
  note(flow,g,s.gauge);return cast;
}
function sample(raw,relics,level){
  const s=E.restore(raw);if(!s)throw new Error('restore failed');
  if(relics==='power10'){for(const m of Object.values(s.meta))m.power*=1.1;relics=[];}
  s.artifacts=relics.slice();s.relicLevels=Object.fromEntries(relics.map(id=>[id,level]));
  for(const e of s.queue){e.hp*=40;e.sponge=1;}for(const e of s.enemies){e.hp*=40;e.maxHp*=40;e.sponge=1;}
  const flow=blank(),casts={},slices=[{casts:0,sec:0},{casts:0,sec:0},{casts:0,sec:0}];
  const g0=s.gauge,gold0=s.gold,sand0=s.sandStore||0,dmg0=s.stats.damage,merges0=s.stats.merges,paid0=s.paidSummons,free0=s.freeSummons,units0=s.board.filter(Boolean).length,inc0={...s.stats.income};
  const cheap=Math.min(...s.deck.map(id=>HERO[id].skill.cost));
  let sim=0,autoIn=0,pick=false,minG=Infinity;
  while(s.phase!=='victory'&&s.phase!=='defeat'&&sim<60-1e-9){
    const before=s.phase;sim+=.05;const slice=slices[Math.min(2,Math.floor((sim-.001)/20))];slice.sec+=.05;
    if(before==='combat'||before==='intermission'){
      for(const e of s.queue)if(!e.sponge){e.hp*=40;e.sponge=1;}
      const g0s=s.gauge,cap=E.gaugeCap(s),clock=clockGain(s,.05);E.step(s,.05);let g=g0s;
      g=pour(flow,g,cap,'clock',clock);if(before==='combat')g=pour(flow,g,cap,'tick',.05*1.2);
      for(const e of s.events){if(e.type==='kill')g=pour(flow,g,cap,'kill',(e.boss?15:1.3)+(e.divine||0)*(e.boss?E.DIVINE_BOSS_GAUGE:E.DIVINE_GAUGE));else if(e.type==='clear')g=pour(flow,g,cap,'wave',8);}
      note(flow,g,s.gauge);s.events.length=0;
    }else{E.step(s,.05);s.events.length=0;}
    if(sim>20)minG=Math.min(minG,s.gauge);
    let acted=false;
    if(pick){acted=true;pick=false;}else if(before!=='reward'&&s.phase==='reward')pick=true;else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=.05;if(autoIn>=.32){acted=true;autoIn=0;}}
    if(acted){
      const snap={gauge:s.gauge,sand:s.sandStore||0,skills:s.stats.skills,merges:s.stats.merges};
      smartAutoPlay(s);attributeAuto(s,flow,snap,casts,()=>{slice.casts++;});s.events.length=0;if(sim>20)minG=Math.min(minG,s.gauge);
    }
  }
  let gold=0;const income={};for(const [k,v] of Object.entries(s.stats.income)){const d=v-(inc0[k]||0);if(d){income[k]=d;gold+=d;}}
  const castN=Object.entries(casts).reduce((n,[k,v])=>n+(k==='gift'?0:v),0),cpm=castN*60/sim,units=s.board.filter(Boolean).length,merges=s.stats.merges-merges0,gifts=casts.gift||0;
  const sliceCpm=slices.map(x=>x.sec>0?x.casts*60/x.sec:0),reasons=[],tags=[];
  if(sim>=55&&sliceCpm[0]<sliceCpm[1]&&sliceCpm[1]<sliceCpm[2]&&cpm>6){tags.push('rising');reasons.push(`casts/min rising ${sliceCpm.map(v=>v.toFixed(1)).join('<')}`);}
  if(sim>20&&minG>=cheap-1e-6&&cpm>6){tags.push('gauge floor');reasons.push(`gauge stayed >= ${cheap} after 20s at ${cpm.toFixed(1)}/min`);}
  if(s.paidSummons===paid0&&merges>=3&&units>=units0){tags.push('unpaid merges');reasons.push(`merges ${merges}, units ${units0}->${units}, paid summons 0`);}
  else if(s.paidSummons===paid0&&gifts>=3&&units>units0){tags.push('gift growth');reasons.push(`gifts ${gifts} grew the board ${units0}->${units}, paid summons 0`);}
  const held=slices.filter(x=>x.sec>=10),sliceFloor=held.length?Math.min(...held.map(x=>x.casts*60/x.sec)):0;
  if(!tags.length&&cpm>=12&&sliceFloor>=6){tags.push('cast rate >=12/min');reasons.push(`casts ${cpm.toFixed(1)}/min (${sliceCpm.map(v=>v.toFixed(0)).join('/')}), no 20s slice under 6`);}
  return {sec:sim,phase:s.phase,dmg:s.stats.damage-dmg0,casts:castN,cpm,by:Object.fromEntries(Object.entries(casts).filter(([k])=>k!=='gift')),gifts,slices:sliceCpm,minG:minG===Infinity?null:minG,cheap,gold,goldNet:s.gold-gold0,income,
    merges,paid:s.paidSummons-paid0,free:free0-s.freeSummons,units,units0,flow,gaugeNet:s.gauge-g0,sandEnd:s.sandStore||0,sand0,loop:tags.length>0,tags,why:reasons.join('; ')};
}
function staticReport(){
  const rows=['| hero | ult | cost | gold | eff L1 | x L1 | eff L10 | x L10 |','| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
  const refund=level=>E.RELIC_VALUES.lantern.refund*scaleOf('lantern',level),r1=refund(1),r10=refund(10);
  const heroes=Object.values(HERO).sort((a,b)=>a.skill.cost-b.skill.cost||a.id.localeCompare(b.id));
  let tri1=0,tri10=0;
  for(const h of heroes){
    const cost=h.skill.cost,e1=cost-back(cost,r1),e10=cost-back(cost,r10),x1=e1<=0?Infinity:cost/e1,x10=e10<=0?Infinity:cost/e10,star=h.skill.type==='starfall'?'*':'';
    if(x1>=3)tri1++;if(x10>=3)tri10++;
    const cell=v=>v===Infinity?'inf':fmt(v);
    rows.push(`| ${h.id}${star} | ${h.skill.type} | ${cost} | ${h.skill.goldCost||0} | ${cell(e1)} | ${cell(x1)} | ${cell(e10)} | ${cell(x10)} |`);
  }
  const hg=level=>E.RELIC_VALUES.hourglass.starlight*scaleOf('hourglass',level),cheap=Math.min(...heroes.map(h=>h.skill.cost));
  const triCosts=refund=>[...new Set(heroes.filter(h=>{const e=h.skill.cost-back(h.skill.cost,refund);return (e<=0?Infinity:h.skill.cost/e)>=3;}).map(h=>h.skill.cost))].sort((a,b)=>a-b);
  const lines=[
    '# lantern / hourglass static (no simulation)',
    '',
    `Lantern refund is RELIC_VALUES.lantern.refund x relicScaleIn (5% per level): L1 ${fmt(r1)}, L10 ${fmt(r10)}. Effective cost = listed cost - refund (a share of the cost when the value is below 1). Uptime multiplier = cost / effective.`,
    'A multiplier of 3x is the "lantern triples uptime" claim. It needs refund >= 2/3 of the listed cost.',
    '',
    ...rows,
    '',
    '* starfall spends the whole gauge, then receives the flat refund. That row uses the listed cost, which is only the cheapest legal cast.',
    '',
    `Level 1 refund ${fmt(r1)}: best multiplier is ${fmt(cheap/(cheap-back(cheap,r1)))}x at cost ${cheap}. Heroes at >=3x: ${tri1}${tri1?` (cost ${triCosts(r1).join(', ')})`:''}.`,
    `Level 10 refund ${fmt(r10)}: best multiplier ${fmt(cheap/(cheap-back(cheap,r10)))}x. Heroes at >=3x: ${tri10} of ${heroes.length}${tri10?` (cost ${triCosts(r10).join(', ')})`:''}.`,
    '',
    `| hourglass | L1 | L10 |`,`| --- | ---: | ---: |`,`| bonus per merge | ${fmt(hg(1))} | ${fmt(hg(10))} |`,`| with the +12 base | ${fmt(12+hg(1))} | ${fmt(12+hg(10))} |`,`| bank cap (not scaled) | ${E.RELIC_VALUES.hourglass.store} | ${E.RELIC_VALUES.hourglass.store} |`,
    '',
    'The merge itself always grants 12. Hourglass adds the bonus, and anything past the gauge cap waits in the bank until the next ultimate.',
  ];
  return {text:lines.join('\n'),data:{refund:{1:r1,10:r10},hourglass:{1:hg(1),10:hg(10)},triples:{1:tri1,10:tri10}}};
}
function runReport(){
  const t0=performance.now(),seeds=Array.from({length:SEEDS},(_,k)=>k+1),boards=[];
  for(const [tag,list] of Object.entries(DECKS))for(const seed of seeds)snapshots(list.split(','),seed).forEach((raw,i)=>{const wave=[6,12][i];boards.push({key:`${tag}#${seed}@${wave}`,tag,seed,wave,deck:list.split(','),raw});});
  const miss=[];for(const [tag] of Object.entries(DECKS))for(const seed of seeds)for(const wave of [6,12])if(!boards.some(b=>b.tag===tag&&b.seed===seed&&b.wave===wave))miss.push(`${tag}#${seed} w${wave}`);
  const cache=new Map();let maxGap=0,maxOther=0,maxDrain=0;
  function measure(b,relics,level){
    const key=b.key+'|'+(relics==='power10'?'power10':relics.join('+')+'@'+(relics.length?level:0));
    if(cache.has(key))return cache.get(key);
    const m=sample(b.raw,relics,level);maxGap=Math.max(maxGap,m.flow.maxGap);maxOther=Math.max(maxOther,m.flow.other);maxDrain=Math.max(maxDrain,m.flow.drain);cache.set(key,m);return m;
  }
  const lines=[],json={seeds:SEEDS,levels:LEVELS,fightSeconds:60,hpScale:40,boards:boards.map(({tag,seed,wave})=>({tag,seed,wave})),missed:miss,levels:[]};
  for(const level of LEVELS){
    lines.push('',`## level ${level}`,'',`| combo | n | sec | dmg | vs none | V | cast/min | loop |`,`| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`);
    const econ=['',`| combo | gold+ | merges | units | tick | merge | hg | lantern | sand | clock | kill | spent | waste | net |`,`| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`];
    const why=[],rows=[];
    for(const combo of LIST){
      const pack=boards.filter(b=>!combo.where||combo.where(b.deck)).map(b=>({tag:b.tag,wave:b.wave,seed:b.seed,m:measure(b,combo.relics,level),base:measure(b,[],0),p10:measure(b,'power10',0)}));
      if(!pack.length){lines.push(`| ${combo.id} | 0 | | | | | | |`);econ.push(`| ${combo.id} | | | | | | | | | | | | |`);continue;}
      const gain=pack.filter(x=>x.base.dmg>0).map(x=>({g:x.m.dmg/x.base.dmg-1,p:x.p10.dmg/x.base.dmg-1}));
      const g=mean(gain,x=>x.g),p=mean(gain,x=>x.p),V=Math.abs(p)<1e-9?'n/a':(g/p).toFixed(2);
      const looped=pack.filter(x=>x.m.loop);
      lines.push(`| ${combo.id} | ${pack.length} | ${mean(pack,x=>x.m.sec).toFixed(1)} | ${Math.round(mean(pack,x=>x.m.dmg))} | ${pct(g)} | ${V} | ${mean(pack,x=>x.m.cpm).toFixed(1)} | ${looped.length}/${pack.length} |`);
      const f=k=>mean(pack,x=>x.m.flow[k]);
      econ.push(`| ${combo.id} | ${mean(pack,x=>x.m.gold).toFixed(0)} | ${mean(pack,x=>x.m.merges).toFixed(1)} | ${mean(pack,x=>x.m.units).toFixed(1)} | ${f('tick').toFixed(0)} | ${f('merge').toFixed(0)} | ${f('hourglass').toFixed(0)} | ${f('lantern').toFixed(0)} | ${f('sand').toFixed(0)} | ${f('clock').toFixed(0)} | ${f('kill').toFixed(0)} | ${f('spent').toFixed(0)} | ${f('waste').toFixed(0)} | ${mean(pack,x=>x.m.gaugeNet).toFixed(0)} |`);
      const by={};let mins=0;for(const x of pack){mins+=x.m.sec/60;for(const [h,c] of Object.entries(x.m.by))by[h]=(by[h]||0)+c;}
      const heroes=Object.entries(by).map(([h,c])=>[h,c/mins]).filter(([,c])=>c>=.3).sort((a,b)=>b[1]-a[1]).map(([h,c])=>`${h} ${c.toFixed(1)}`).join(', ')||'-';
      why.push(`- ${combo.id}: ${heroes}`);
      if(looped.length){const kinds=new Map();for(const x of looped)for(const t of x.m.tags)kinds.set(t,(kinds.get(t)||0)+1);why.push('  loop '+[...kinds.entries()].map(([k,n])=>`${n}x ${k}`).join('; '));}
      rows.push({id:combo.id,n:pack.length,sec:+mean(pack,x=>x.m.sec).toFixed(2),dmg:mean(pack,x=>x.m.dmg),vsNone:g,V:V==='n/a'?null:Number(V),castPerMin:mean(pack,x=>x.m.cpm),loop:`${looped.length}/${pack.length}`,heroes,gold:mean(pack,x=>x.m.gold),merges:mean(pack,x=>x.m.merges),units:mean(pack,x=>x.m.units),starlight:Object.fromEntries(['tick','merge','hourglass','lantern','sand','clock','kill','wave','mend','spent','waste','drain','other'].map(k=>[k,f(k)])),gaugeNet:mean(pack,x=>x.m.gaugeNet)});
    }
    lines.push(...econ,'','Casts/min by hero (average over the boards in the row):',...why);json.levels.push({level,rows});
  }
  const secs=(performance.now()-t0)/1000;
  lines.unshift(`# relic combo bench · weekly-hard · seeds ${seeds.join(',')} · levels ${LEVELS.join(',')} · ${boards.length} boards · enemy hp x40 · 60s · ${secs.toFixed(1)}s`,'',
    `Decks: relic-bench set + santa_loop + santa_mix. ${miss.length?`Missing snapshots (run died first): ${miss.join(', ')}.`: 'Every deck reached waves 6 and 12.'}`,
    'santa / queen / doom rows are the lantern+hourglass relic pair filtered to decks that contain those heroes (queen dividend, doom fortune + merge refund, santa gift). broken_clock is the buff deck only.',
    `Gauge residual: max step ${maxGap.toFixed(2)}, max boss-drain bucket ${maxDrain.toFixed(1)}, max unexplained ${maxOther.toFixed(2)}. A step of 60 is Love Iris spending a full gauge.`);
  return {text:lines.join('\n'),data:{...json,seconds:+secs.toFixed(2),gaugeMaxGap:maxGap}};
}
const started=performance.now();
const report=MODE==='static'?staticReport():MODE==='run'?runReport():null;
if(!report)throw new Error('mode is run or static');
if(JSON_PATH)writeFileSync(JSON_PATH,JSON.stringify({mode:MODE,seconds:(performance.now()-started)/1000,...report.data},null,2));
console.log(report.text);

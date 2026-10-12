// Marginal value of each ultimate in realistic main-stage states.
// Plays with the same greenhouse and smart-auto loop as stage-sim, snapshots
// boss and crowd moments, then rolls the real engine forward with and without a cast.
//   node defense_test/scripts/ult-rollout.mjs [--stages 9,13,17,21] [--seeds 3] [--heroes id,id] [--json out.json]
import fs from 'node:fs/promises';
import {HERO,HEROES} from '../src/content.js';
import {heroMultiplier,specialMultiplier,springGauge,seedGold} from '../src/economy.js';
import * as engine from '../src/combat/engine.js';
import {smartAutoPlay} from '../src/smart-auto.js';

const DT=.05,AUTO=.32,LIMIT=900,LIMIT_TICKS=LIMIT/DT,HORIZON=12,HORIZON_TICKS=Math.round(HORIZON/DT);
const KINDS=['boss3','boss6','crowd'];
const DECKS=[
  ['star_boy','snow_rabbit','night_rabbit','silver_rabbit','siren'],
  ['mushroom_king','great_detective','guardian','avalanche_maid','santa'],
  ['red_dragon','aurora','storm_sage','flame_sage','lightning_sage'],
  ['time_magician','ancient_dragon','phantom','zeke','luna'],
  ['jasmine','queen','rumi','cherry_prince','time_ruler'],
  ['galaxy_whale','doom','cinderella','harmonious','frost_witch'],
];

const covered=DECKS.flat();
const roster=HEROES.map(hero=>hero.id);
if(roster.length!==30||new Set(covered).size!==30||roster.some(id=>!covered.includes(id))||DECKS.some(deck=>!engine.validDeck(deck))){
  throw new Error('Decks must be six valid teams that partition the 30 heroes');
}
const deckOf=new Map(DECKS.flatMap(deck=>deck.map(id=>[id,deck])));

const args=process.argv.slice(2);
const opts=new Map();
for(let i=0;i<args.length;i++){
  const token=args[i];
  if(!token.startsWith('--'))throw new Error(`Unexpected argument: ${token}`);
  const name=token.slice(2);
  if(!['stages','seeds','heroes','json'].includes(name))throw new Error(`Unknown option: --${name}`);
  if(opts.has(name))throw new Error(`Duplicate option: --${name}`);
  const value=args[++i];
  if(value===undefined||value.startsWith('--'))throw new Error(`--${name} needs a value`);
  opts.set(name,value);
}
const stageText=opts.get('stages')??'9,13,17,21';
const stageParts=stageText.split(',').map(part=>part.trim());
const STAGES=stageParts.map(part=>Number(part));
if(!stageParts.length||stageParts.some(part=>part==='')||STAGES.some(stage=>!Number.isInteger(stage)||stage<1||stage>45))throw new Error('--stages must be integers from 1 to 45');
const SEEDS=Number(opts.get('seeds')??3);
if(!Number.isInteger(SEEDS)||SEEDS<1)throw new Error('--seeds must be a positive integer');
let heroFilter=null;
if(opts.has('heroes')){
  const ids=opts.get('heroes').split(',').map(id=>id.trim()).filter(Boolean);
  if(!ids.length||ids.some(id=>!HERO[id]))throw new Error('--heroes must be comma-separated known hero ids');
  heroFilter=new Set(ids);
}
const JSON_OUT=opts.get('json')??null;
if(opts.has('json')&&!JSON_OUT)throw new Error('--json needs a file path');

// Greenhouse a player would plausibly have on the way to stage S. Enhance stays 0.
// Same curves as stage-sim with --rose auto.
const bedsFor=stage=>({
  rose:Math.min(45,3+stage),
  spring:stage>=15?Math.min(30,3*(stage-14)):0,
  seed:stage>=30?Math.min(20,2*(stage-29)):0,
});
const metaFor=(deck,beds)=>{
  const entry={enhance:0};
  return Object.fromEntries(deck.map(id=>[id,{power:heroMultiplier(entry,beds),special:specialMultiplier(entry.enhance)}]));
};
const fighting=s=>s.phase==='combat'||s.phase==='intermission';

function observe(s,bossAt,taken,snapshots){
  if(s.phase!=='combat')return;
  if((s.wave===3||s.wave===6)&&bossAt[s.wave]==null&&s.enemies.some(e=>e.hp>0&&e.boss))bossAt[s.wave]=s.time;
  if(s.wave===3&&!taken.boss3&&bossAt[3]!=null&&s.time-bossAt[3]>=4-1e-6){snapshots.boss3=engine.serialize(s);taken.boss3=true;}
  else if(s.wave===6&&!taken.boss6&&bossAt[6]!=null&&s.time-bossAt[6]>=4-1e-6){snapshots.boss6=engine.serialize(s);taken.boss6=true;}
  if((s.wave===4||s.wave===5)&&!taken.crowd&&s.enemies.filter(e=>e.hp>0).length>=10){snapshots.crowd=engine.serialize(s);taken.crowd=true;}
}

function play(deck,stage,seed,seen){
  const beds=bedsFor(stage),meta=metaFor(deck,beds);
  const s=engine.newRun({deck,chapter:stage-1,seed,meta,mode:'main',gaugeMax:springGauge(beds.spring),startGold:seedGold(beds.seed)});
  let autoIn=0,pickBlessing=false,ticks=0;
  const bossAt={3:null,6:null},taken={boss3:false,boss6:false,crowd:false},snapshots={boss3:null,boss6:null,crowd:null};
  while(s.phase!=='victory'&&s.phase!=='defeat'&&ticks<LIMIT_TICKS){
    const before=s.phase;
    engine.step(s,DT);ticks++;
    observe(s,bossAt,taken,snapshots);
    for(const u of s.board)if(u)seen.add(u.hero);
    if(pickBlessing){smartAutoPlay(s);autoIn=0;pickBlessing=false;}
    else if(before!=='reward'&&s.phase==='reward')pickBlessing=true;
    else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=DT;if(autoIn>=AUTO){smartAutoPlay(s);autoIn=0;}}
    s.events.length=0;
  }
  return {snapshots,won:s.phase==='victory',phase:s.phase};
}

// Both copies receive the same starlight and gold top-up. Only A casts.
// Starfall spends the whole gauge, so its top-up is the run's gauge cap.
function fund(s,id){
  const hero=HERO[id];
  s.gauge=hero.skill.type==='starfall'?engine.gaugeCap(s):Math.max(s.gauge,hero.skill.cost);
  s.gold+=engine.skillGoldCost(id);
}

// Step A and B the same number of ticks so the damage delta is one shared window.
// Stop when either copy leaves combat, and never steer them after the cast.
function compare(raw,id,castFails){
  const A=engine.restore(raw),B=engine.restore(raw);
  if(!A||!B)return {error:'restore'};
  if(!engine.bestUnit(A,id))return null;
  fund(A,id);fund(B,id);
  const hero=HERO[id],cost=hero.skill.type==='starfall'?A.gauge:hero.skill.cost;
  const cast=engine.cast(A,id);
  if(!cast?.ok){const reason=cast?.reason||'failed';castFails.set(reason,(castFails.get(reason)||0)+1);return null;}
  const snapshotDamage=B.stats.damage,t0=B.time;
  let ticks=0;
  while(ticks<HORIZON_TICKS){
    if(!fighting(A)||!fighting(B))break;
    engine.step(A,DT);engine.step(B,DT);ticks++;
  }
  const elapsed=B.time-t0,teamDamage=B.stats.damage-snapshotDamage;
  const teamDps=elapsed>0?teamDamage/elapsed:0,damage=A.stats.damage-B.stats.damage;
  // A silent team makes "seconds of team damage" undefined. Keep the sample finite.
  const seconds=teamDps>0&&Number.isFinite(damage)?damage/teamDps:0;
  const per100=cost>0&&Number.isFinite(seconds)?seconds/cost*100:0;
  const sample={seconds,per100,kills:A.stats.kills-B.stats.kills,health:A.health-B.health,gold:A.gold-B.gold,damage,teamDps,cost,elapsed,flat:!(teamDps>0)};
  if(!Number.isFinite(sample.seconds)||!Number.isFinite(sample.per100)||!Number.isFinite(sample.kills)||!Number.isFinite(sample.health)||!Number.isFinite(sample.gold))return {error:'nonfinite',sample};
  return sample;
}

const acc=()=>({n:0,seconds:0,per100:0,kills:0,health:0,gold:0});
const absorb=(agg,sample)=>{agg.n++;agg.seconds+=sample.seconds;agg.per100+=sample.per100;agg.kills+=sample.kills;agg.health+=sample.health;agg.gold+=sample.gold;};
const mean=agg=>agg.n?{samples:agg.n,seconds:agg.seconds/agg.n,per100:agg.per100/agg.n,kills:agg.kills/agg.n,health:agg.health/agg.n,gold:agg.gold/agg.n}:null;

const decks=heroFilter?DECKS.filter(deck=>deck.some(id=>heroFilter.has(id))):DECKS;
const started=process.hrtime.bigint();
const stats=new Map(),seen=new Set(),castFails=new Map();
let runs=0,restoreFails=0,flatTeams=0,nonfinite=0;
const totalRuns=decks.length*STAGES.length*SEEDS;
console.error(`ult rollout · decks ${decks.length} · stages ${STAGES.join(',')} · seeds 1..${SEEDS}${heroFilter?` · heroes ${[...heroFilter].join(',')}`:''}`);
for(const deck of decks){
  for(const stage of STAGES){
    for(let seed=1;seed<=SEEDS;seed++){
      runs++;
      const mark=process.hrtime.bigint();
      console.error(`[${runs}/${totalRuns}] play ${deck.join(',')} stage ${stage} seed ${seed}`);
      const {snapshots,phase}=play(deck,stage,seed,seen);
      let samples=0;
      for(const kind of KINDS){
        const raw=snapshots[kind];if(!raw)continue;
        for(const id of deck){
          if(heroFilter&&!heroFilter.has(id))continue;
          const sample=compare(raw,id,castFails);
          if(!sample)continue;
          if(sample.error){if(sample.error==='restore')restoreFails++;else nonfinite++;console.error(`  skip ${id} ${kind}: ${sample.error}`);continue;}
          if(sample.flat)flatTeams++;
          let row=stats.get(id);
          if(!row){row={boss3:acc(),boss6:acc(),crowd:acc(),all:acc()};stats.set(id,row);}
          absorb(row[kind],sample);absorb(row.all,sample);samples++;
        }
      }
      const sec=Number(process.hrtime.bigint()-mark)/1e9;
      console.error(`[${runs}/${totalRuns}] done ${phase} snaps ${KINDS.filter(kind=>snapshots[kind]).join('+')||'—'} samples ${samples} ${sec.toFixed(1)}s`);
    }
  }
}

const rows=[];
for(const [id,row] of stats){
  const all=mean(row.all);if(!all)continue;
  const cell=kind=>mean(row[kind]);
  rows.push({id,name:HERO[id].name,rarity:HERO[id].rarity,deck:deckOf.get(id),...all,byKind:{boss3:cell('boss3'),boss6:cell('boss6'),crowd:cell('crowd')}});
}
rows.sort((a,b)=>b.per100-a.per100||(a.id<b.id?-1:a.id>b.id?1:0));
for(const row of rows){
  for(const key of ['samples','seconds','per100','kills','health','gold'])if(!Number.isFinite(row[key]))throw new Error(`Non-finite ${key} for ${row.id}`);
  for(const kind of KINDS)if(row.byKind[kind]&&Object.values(row.byKind[kind]).some(value=>!Number.isFinite(value)))throw new Error(`Non-finite ${kind} for ${row.id}`);
}

const num=value=>value==null?'—':value.toFixed(2);
const kindSeconds=row=>Object.fromEntries(KINDS.map(kind=>[kind,row.byKind[kind]?.seconds??null]));
console.log(`# 필살기 한계 가치\n`);
console.log(`합리 오토 · 스테이지 ${STAGES.join(', ')} · 시드 1..${SEEDS} · 강화 0 · 온실 자동 · 관측 ${HORIZON}초`);
console.log(`보스 3·6은 살아있는 보스가 나타난 뒤 4초, 밀집은 4·5웨이브에서 적이 10기 이상인 첫 순간입니다. 초는 시전이 만들어 낸 추가 피해를, 시전하지 않은 쪽의 팀 초당 피해로 나눈 값입니다.\n`);
console.log('| 영웅 | 등급 | 표본 | 보스3 | 보스6 | 밀집 | 전체 | 별빛 100당 | 처치 | 체력 | 골드 |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for(const row of rows){
  const seconds=kindSeconds(row);
  console.log(`| ${row.name} | ${row.rarity} | ${row.samples} | ${num(seconds.boss3)} | ${num(seconds.boss6)} | ${num(seconds.crowd)} | ${num(row.seconds)} | ${num(row.per100)} | ${num(row.kills)} | ${num(row.health)} | ${num(row.gold)} |`);
}
if(!rows.length)console.log('| — | — | 0 | — | — | — | — | — | — | — | — |');
const elapsed=Number(process.hrtime.bigint()-started)/1e9;
console.log(`\n${elapsed.toFixed(1)}s`);

const wanted=heroFilter?[...heroFilter]:roster;
const missing=wanted.filter(id=>!rows.some(row=>row.id===id));
const never=missing.filter(id=>!seen.has(id));
const unseenSample=missing.filter(id=>seen.has(id));
console.error(`done ${elapsed.toFixed(1)}s · rows ${rows.length} · restore failures ${restoreFails} · non-finite ${nonfinite} · zero team dps ${flatTeams} · cast failures ${[...castFails].map(([reason,n])=>`${n} ${reason}`).join('; ')||'—'}`);
console.error(`missing ${missing.length?missing.map(id=>`${id}${seen.has(id)?' (on board)':''}`).join(', '):'—'} · never on board ${never.join(', ')||'—'} · on board without a sample ${unseenSample.join(', ')||'—'}`);

if(JSON_OUT){
  const payload={
    parameters:{stages:STAGES,seeds:SEEDS,heroes:heroFilter?[...heroFilter]:null,dt:DT,autoInterval:AUTO,horizon:HORIZON,timeLimit:LIMIT,enhance:0,mode:'main',decks},
    elapsed,
    restoreFails,flatTeams,
    rows:rows.map(row=>({id:row.id,name:row.name,rarity:row.rarity,samples:row.samples,seconds:{boss3:row.byKind.boss3?.seconds??null,boss6:row.byKind.boss6?.seconds??null,crowd:row.byKind.crowd?.seconds??null,overall:row.seconds},per100:row.per100,kills:row.kills,health:row.health,gold:row.gold,byKind:row.byKind})),
  };
  await fs.writeFile(JSON_OUT,JSON.stringify(payload,null,2)+'\n');
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAPTERS,PARTS,PART_STAGES,MAIN_STAGES,CHAPTER_STAGES,CLEAR_UNLOCKS,TUNING,HERO,levelStage,levelOf,stageHp,stageMilestone,partOf,LATE_UNLOCK_STAGE} from '../src/content.js';
import {BEGINNER_DAYS,UNLOCKS} from '../src/beginner.js';
import {TWIN_STAGE} from '../src/preview/twin.js';
import {BED_IDS,GARDENS,bedCost,bedOpen,critChance,critDamage,critStats,stardustRate,stardustBonus,idleReward,dispatchDust,dispatchReward,DISPATCH_UNLOCK_STAGES,combatPower,HOUR} from '../src/economy.js';
import {createProfile,validateProfile,parseProfile,command,grantClearUnlocks} from '../src/profile.js';
import {createBattle,resumeBattle,autoPlay} from '../src/battle.js';
import {testGrant,TEST_TOOLS} from '../src/test-unlock.js';
import * as E from '../src/combat/engine.js';
const NOW=Date.parse('2026-10-04T03:00:00Z');
const ok=(p,a,args={},now=NOW)=>{const r=command(p,a,args,now);assert.ok(r.ok,r.message);return r;};

test('public main stages have ten named chapters of nine stages across two equal parts',()=>{
  assert.equal(MAIN_STAGES,90);assert.equal(PART_STAGES,45);assert.equal(CHAPTERS.length,90);
  assert.equal(CHAPTER_STAGES,9);
  assert.deepEqual(PARTS.map(x=>x.chapters),[
    ['별빛 산책','달빛 정원','별무리 숲','은하 사원','창조의 끝'],
    ['새벽 정원','이슬 숲','노을 사원','창조의 시작','첫 햇살의 언덕'],
  ]);
  assert.deepEqual(PARTS.map(x=>[x.first,x.last,x.chapterAt]),[[1,45,0],[46,90,5]]);
  assert.equal(MAIN_STAGES,PARTS.reduce((n,x)=>n+x.chapters.length*CHAPTER_STAGES,0),'every stage belongs to a chapter of a part');
  for(const c of CHAPTERS){assert.equal(c.part,c.stage<=PART_STAGES?1:2);assert.equal(partOf(c.stage).id,c.part);assert.equal(c.bosses[0],CHAPTERS[(c.stage-1)%9].bosses[0],'stage n meets boss (n-1)%9');}
  assert.equal(CHAPTERS[PART_STAGES].bosses[0],CHAPTERS[0].bosses[0],'the first dawn stage repeats the first boss');
  assert.notEqual(CHAPTERS[PART_STAGES].name,CHAPTERS[0].name,'dawn names differ from the night ones');
});

test('each new stage interpolates old HP and floors its old income level',()=>{
  const intro=[.30,.36,.42,.49,.56,.63,.71,.8,.9];
  function oldHp(stage){
    if(stage<=9)return intro[stage-1];
    const level=stage-9;
    return level>=18?1+2.5*(level-1)/8:1+(2.5*17/8)*((level-1)/17)**1.7;
  }
  assert.equal(stageHp(1),.30);
  assert.equal(stageHp(90),oldHp(108));
  for(const {stage,hp,level} of CHAPTERS){
    const position=1+(stage-1)*107/89,left=Math.floor(position),right=Math.ceil(position);
    const expected=oldHp(left)+(position-left)*(oldHp(right)-oldHp(left));
    assert.ok(Math.abs(hp-expected)<1e-12,`stage ${stage}`);
    assert.equal(level,Math.max(0,left-9));
    if(stage>1)assert.ok(hp>CHAPTERS[stage-2].hp,`stage ${stage} is harder than the previous stage`);
  }
});

test('difficulty milestones move to the nearest stage while tutorial gates keep their pace',()=>{
  const milestones=[[9,8],[15,13],[18,15],[24,20],[27,23],[36,30],[39,33],[51,43],[54,45],[69,58],[79,66],[99,83],[108,90]];
  for(const [previous,current] of milestones)assert.equal(stageMilestone(previous),current,`former stage ${previous}`);
  assert.equal(LATE_UNLOCK_STAGE,23);
  assert.deepEqual(Object.values(TUNING.beds).map(b=>b.unlock),[0,20,33,45,45,58]);
  assert.deepEqual(DISPATCH_UNLOCK_STAGES,[8,15,23,30]);
  assert.deepEqual(TWIN_STAGE,{easy:43,hard:66,abyss:83});
  assert.deepEqual(UNLOCKS,{garden:2,library:4,relic:6,draft:8,dispatch:9,season:11,monthly:13,request:15,event:17});
  assert.deepEqual(BEGINNER_DAYS[6].task,{id:'clear13',text:'스테이지 13 클리어',reward:{dreams:200}});
});

test('dawn garden: beds, caps and unlock stages',()=>{
  assert.deepEqual(GARDENS.map(g=>g.beds),[['rose','spring','seed'],['crit','critDamage','stardust']]);
  assert.deepEqual([...BED_IDS],['rose','spring','seed','crit','critDamage','stardust']);
  assert.equal(TUNING.beds.crit.unlock,PART_STAGES);assert.equal(TUNING.beds.critDamage.unlock,PART_STAGES);assert.equal(TUNING.beds.stardust.unlock,levelStage(60));
  assert.equal(bedCost('crit',0),517);assert.equal(bedCost('critDamage',0),500);assert.equal(bedCost('stardust',0),1200);
  // start values and soft-cap values from the design; effects keep growing linearly past the cap
  assert.ok(Math.abs(critChance(0)-.05)<1e-12);assert.ok(Math.abs(critChance(30)-.2)<1e-12);assert.ok(critChance(31)>critChance(30));
  assert.ok(Math.abs(critDamage(0)-1.5)<1e-12);assert.ok(Math.abs(critDamage(25)-2)<1e-12);assert.ok(critDamage(26)>critDamage(25));
  assert.ok(Math.abs(stardustRate(0)-.01)<1e-12);assert.ok(Math.abs(stardustRate(49)-.5)<1e-12);assert.ok(stardustRate(50)>stardustRate(49));
  assert.ok(Math.abs((critChance(1)-critChance(0))-(critChance(39)-critChance(38)))<1e-12);
  assert.ok(!('max' in TUNING.beds.crit)&&!('max' in TUNING.beds.critDamage)&&!('max' in TUNING.beds.stardust));
  // prices are strictly increasing; the first levels are cheap; after the soft cap the slope is much steeper
  for(const id of ['crit','critDamage','stardust']){
    const cap=TUNING.beds[id].knee2;let last=0,total=0;
    for(let l=0;l<cap+5;l++){const c=bedCost(id,l);if(!(id==='crit'&&l===cap))assert.ok(c>last,id+' '+l);last=c;if(l<cap)total+=c;}
    assert.ok(total>80000,id+' total '+total);
    assert.ok(bedCost(id,cap+1)/bedCost(id,cap)>bedCost(id,1)/bedCost(id,0),id+' steep after soft cap');
  }
});

test('base critical hits exist from the start; garden levels apply after unlocking',()=>{
  const dust=levelStage(60);
  assert.deepEqual(critStats({crit:9,critDamage:9},PART_STAGES-1),{chance:.05,damage:1.5});
  assert.deepEqual(critStats({crit:0,critDamage:0},PART_STAGES),{chance:.05,damage:1.5});
  assert.equal(stardustBonus({stardust:10},dust-1),0);assert.ok(Math.abs(stardustBonus({stardust:10},dust)-.11)<1e-12);
  const p=createProfile(NOW);p.cleared=PART_STAGES-1;p.beds.stardust=34;p.idleAt=NOW-20*HOUR;
  assert.equal(idleReward(p,NOW),4*(168+levelOf(PART_STAGES-1)*24),'no bonus before the bed opens');
  p.cleared=dust;const perHour=(168+60*24)*1.35;
  assert.equal(idleReward(p,NOW),Math.floor(4*perHour));
  p.idleAt=NOW-4*HOUR;assert.equal(idleReward(p,NOW),Math.floor(4*perHour));
  p.idleAt=NOW-2.5*HOUR;assert.equal(idleReward(p,NOW),Math.floor(2.5*perHour));
});

test('growing a dawn bed: stage lock and cost',()=>{
  const p=createProfile(NOW);p.dust=1e9;
  p.cleared=PART_STAGES-1;assert.equal(command(p,'bed',{id:'crit'},NOW).ok,false,'closed before the second part');
  p.cleared=PART_STAGES;const cost=bedCost('crit',0);ok(p,'bed',{id:'crit'});assert.equal(p.beds.crit,1);assert.equal(p.dust,1e9-cost);
  assert.equal(command(p,'bed',{id:'stardust'},NOW).ok,false,'stardust opens at level 60');
  p.cleared=levelStage(60);ok(p,'bed',{id:'stardust'});
  p.beds.crit=38;const past=bedCost('crit',38);const dust=p.dust;ok(p,'bed',{id:'crit'});assert.equal(p.beds.crit,39);assert.equal(p.dust,dust-past,'levels past the soft cap still grow');
  assert.equal(validateProfile(p),true);p.beds.crit=100;assert.equal(validateProfile(p),true);
});

test('save migration: revision 3 saves gain the dawn beds without a new Behemoth grant',()=>{
  const old=createProfile(NOW);old.bedRev=3;old.beds={rose:7,spring:3,seed:1};old.cleared=50;
  assert.equal(old.heroes.behemoth.owned,false);
  const moved=parseProfile(JSON.stringify(old));assert.ok(moved);assert.equal(moved.bedRev,4);
  assert.deepEqual(moved.beds,{rose:7,spring:3,seed:1,crit:0,critDamage:0,stardust:0});
  assert.equal(moved.heroes.behemoth.owned,false,'stage45 now opens the regular pool without a free grant');
  old.heroes.behemoth.owned=true;old.heroes.behemoth.copies=3;const owned=parseProfile(JSON.stringify(old));assert.equal(owned.heroes.behemoth.owned,true);assert.equal(owned.heroes.behemoth.copies,3);
  const young=createProfile(NOW);young.bedRev=3;young.beds={rose:0,spring:0,seed:0};young.cleared=44;
  assert.equal(parseProfile(JSON.stringify(young)).heroes.behemoth.owned,false);
});

test('clearing the last stage of part one for the first time opens part two without a companion grant',()=>{
  assert.deepEqual(CLEAR_UNLOCKS,{});
  const end=PART_STAGES,p=createProfile(NOW);p.cleared=end-1;ok(p,'begin',{mode:'main',stage:end},NOW);
  const r=ok(p,'settle',{token:p.active.token,won:true,round:6},NOW+1000);
  assert.equal(p.cleared,end);assert.equal(r.partOpened,true);assert.deepEqual(r.unlocked,[]);assert.equal(p.heroes.behemoth.owned,false);
  ok(p,'begin',{mode:'main',stage:end+1},NOW+2000);assert.equal(p.active.stage,end+1);
  const again=ok(p,'settle',{token:p.active.token,won:true,round:6},NOW+3000);assert.equal(again.partOpened,false);assert.deepEqual(again.unlocked,[]);
  assert.deepEqual(grantClearUnlocks(p),[],'already owned');
  assert.equal(command(p,'begin',{mode:'main',stage:end+3},NOW+4000).ok,false,'the stage before has to be cleared first');
  p.active=null;p.cleared=MAIN_STAGES;assert.equal(command(p,'begin',{mode:'main',stage:MAIN_STAGES},NOW+5000).ok,true);
  assert.equal(validateProfile(p),true);
});

test('the stardust bed is paid out when a dispatch is collected',()=>{
  const p=createProfile(NOW);p.cleared=levelStage(60);p.beds.stardust=10;p.heroes.queen.owned=true;
  ok(p,'dispatch',{slot:0,id:'queen'},NOW);const stored=p.dispatches[0].dust,collected=NOW+TUNING.dispatchHours*HOUR;
  const r=ok(p,'claimDispatch',{slot:0},collected);
  assert.equal(r.dust,dispatchDust(stored,p.beds,p.cleared));assert.ok(r.dust>stored);
  const q=createProfile(NOW);q.cleared=levelStage(60);q.beds.stardust=0;q.heroes.queen.owned=true;ok(q,'dispatch',{slot:0,id:'queen'},NOW);
  const base=q.dispatches[0].dust;assert.equal(ok(q,'claimDispatch',{slot:0},collected).dust,Math.floor(base*1.01));
});

const fresh=(crit=null,seed=11)=>E.newRun({seed,crit});
function play(run,seconds){const hits=[];for(let t=0;t<seconds;t+=.05){E.step(run,.05);for(const e of run.events)if(e.type==='hit')hits.push(e);run.events.length=0;autoPlay(run);}return hits;}

test('critical hits: no effect without a crit setting, always with chance 1, on a stream of their own',()=>{
  const plain=fresh(null),certain=fresh({chance:1,damage:2});
  assert.equal(plain.crit,null);assert.deepEqual(certain.crit,{chance:1,damage:2});
  assert.equal(plain.rng,certain.rng);assert.deepEqual(plain.board.map(u=>u&&u.hero),certain.board.map(u=>u&&u.hero),'the opening is the same with or without crits');
  const a=play(plain,30),b=play(certain,30);
  assert.ok(a.length>20&&b.length>20);assert.ok(a.every(h=>!h.crit));assert.ok(b.every(h=>h.crit));
  // the first identical shot lands twice as hard
  assert.ok(Math.abs(b[0].damage-2*a[0].damage)<=1,`${b[0].damage} vs ${a[0].damage}`);
});

test('critical hit frequency follows the chance and damage never shrinks',()=>{
  const run=fresh({chance:.2,damage:1.5},21),hits=play(run,200);
  const crits=hits.filter(h=>h.crit).length,share=crits/hits.length;
  assert.ok(hits.length>300,'enough hits '+hits.length);assert.ok(share>.12&&share<.28,'share '+share);
  assert.ok(E.serialize(run).includes('"critRng"'));
  const copy=E.restore(E.serialize(run));assert.ok(copy);assert.deepEqual(copy.crit,run.crit);assert.equal(copy.critRng,run.critRng);
  // crit stream continues identically after a save and restore
  const x=play(run,10),y=play(copy,10);assert.deepEqual(x.map(h=>[h.damage,!!h.crit]),y.map(h=>[h.damage,!!h.crit]));
});

test('runs saved before critical hits restore without them, and bad crit data is refused',()=>{
  const run=fresh({chance:.1,damage:1.5});const raw=JSON.parse(E.serialize(run));delete raw.crit;delete raw.critRng;
  const old=E.restore(raw);assert.ok(old);assert.ok(!old.crit);assert.ok(Number.isInteger(old.critRng)&&old.critRng>0);
  const bad=JSON.parse(E.serialize(run));bad.crit={chance:.5,damage:.2};assert.equal(E.restore(bad),null);
  const nan=JSON.parse(E.serialize(run));nan.crit={chance:'x',damage:2};assert.equal(E.restore(nan),null);
});

test('a battle locks its crit setting on entry and rejects checkpoint edits',()=>{
  const p=createProfile(NOW);p.cleared=PART_STAGES+5;Object.assign(p.beds,{crit:10,critDamage:4});
  ok(p,'begin',{mode:'main',stage:PART_STAGES+5},NOW);
  const run=createBattle(p);assert.deepEqual(run.crit,critStats(p.beds,p.cleared));assert.ok(run.crit.chance>.05);
  p.active.run=E.serialize(run);assert.ok(resumeBattle(p));
  p.beds.crit=11;assert.deepEqual(resumeBattle(p)?.crit,run.crit);
  const forged=JSON.parse(p.active.run);forged.crit=critStats(p.beds,p.cleared);
  p.active.run=JSON.stringify(forged);assert.equal(resumeBattle(p),null);
  // a run from before crits existed still resumes
  const legacy=JSON.parse(E.serialize(run));delete legacy.crit;delete legacy.critRng;p.active.run=JSON.stringify(legacy);assert.ok(resumeBattle(p));
  const early=createProfile(NOW);early.cleared=10;ok(early,'begin',{mode:'main',stage:10},NOW);assert.deepEqual(createBattle(early).crit,{chance:.05,damage:1.5});
});

test('test tools of the unlocked build',()=>{
  const p=createProfile(NOW);p.dreams=0;p.dust=0;
  assert.ok(testGrant(p,'wallet'));assert.equal(p.dreams,10000);assert.equal(p.dust,10000);
  testGrant(p,'dreams');testGrant(p,'dust');assert.equal(p.dreams,110000);assert.equal(p.dust,1010000);
  testGrant(p,'stage60');assert.equal(p.cleared,levelStage(60));testGrant(p,'dawn-max');assert.deepEqual([p.beds.crit,p.beds.critDamage,p.beds.stardust],[30,25,49]);assert.equal(validateProfile(p),true);
  testGrant(p,'dawn-reset');assert.deepEqual([p.beds.crit,p.beds.critDamage,p.beds.stardust],[0,0,0]);
  assert.equal(testGrant(p,'nope'),'');assert.ok(TEST_TOOLS.every(t=>t.label&&t.kind));
  const q=createProfile(NOW);assert.equal(command(q,'testGrant',{kind:'dust'},NOW).ok,false,'the normal build refuses test tools');
  p.dust=9500000;testGrant(p,'dust');assert.equal(p.dust,9999999,'currencies are capped');
});

test('challenge reset tools clear the current challenge while preserving history and lifetime',()=>{
  const p=createProfile(NOW);p.cleared=3;
  ok(p,'begin',{mode:'monthly'});
  ok(p,'settle',{token:p.active.token,round:2,damage:1200,seconds:32});
  const results=structuredClone(p.results),lifetime=structuredClone(p.monthlyLifetime);
  ok(p,'begin',{mode:'weekly'});assert.ok(validateProfile(p));
  assert.equal(testGrant(p,'weekly-reset'),'유성 드래프트를 다시 입장할 수 있게 했어요');assert.equal(p.weekly,null);assert.equal(p.active,null);assert.deepEqual(p.results,results);assert.ok(validateProfile(p));
  ok(p,'begin',{mode:'weekly'});assert.equal(testGrant(p,'monthly-reset'),'만월 토벌전 기록과 보상을 초기화했어요');assert.equal(p.active.mode,'weekly');assert.ok(validateProfile(p));
  testGrant(p,'weekly-reset');ok(p,'begin',{mode:'monthly'});ok(p,'settle',{token:p.active.token,round:2,damage:1200,seconds:32});ok(p,'begin',{mode:'monthly'});assert.ok(validateProfile(p));testGrant(p,'monthly-reset');
  assert.equal(p.active,null);assert.equal(p.monthly,null);assert.equal(p.monthlyBest,null);assert.equal(p.monthlyClaim,null);assert.deepEqual(p.monthlyLifetime,lifetime);assert.deepEqual(p.results.slice(1),results);assert.ok(validateProfile(p));
  ok(p,'begin',{mode:'monthly'});ok(p,'settle',{token:p.active.token,round:1});assert.equal(p.monthlyClaim.round,1);assert.equal(command(p,'claimMonthly',{token:p.monthlyBest.token},NOW).ok,false);
});

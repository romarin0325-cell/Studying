import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAPTERS,PARTS,PART_STAGES,MAIN_STAGES,CLEAR_UNLOCKS,TUNING,HERO} from '../src/content.js';
import {BED_IDS,GARDENS,bedCost,bedOpen,bedMax,bedFull,critChance,critDamage,critExpected,critStats,stardustRate,stardustBonus,idleReward,dispatchDust,dispatchReward,combatPower,HOUR} from '../src/economy.js';
import {createProfile,validateProfile,parseProfile,command,grantClearUnlocks} from '../src/profile.js';
import {createBattle,resumeBattle,autoPlay} from '../src/battle.js';
import {testGrant,TEST_TOOLS} from '../src/test-unlock.js';
import * as E from '../src/combat/engine.js';
const NOW=Date.parse('2026-10-04T03:00:00Z');
const ok=(p,a,args={},now=NOW)=>{const r=command(p,a,args,now);assert.ok(r.ok,r.message);return r;};

test('part two: 90 stages in two parts, the same slope, chapter names for both parts',()=>{
  assert.equal(MAIN_STAGES,90);assert.equal(PART_STAGES,45);assert.equal(CHAPTERS.length,90);
  assert.deepEqual(PARTS.map(x=>x.chapters.length),[5,5]);assert.equal(new Set(PARTS.flatMap(x=>x.chapters)).size,10);
  for(const c of CHAPTERS)assert.equal(c.part,c.stage<=45?1:2);
  assert.ok(Math.abs(CHAPTERS[89].hp-(1+2.5*89/8))<1e-12);
  assert.equal(CHAPTERS[45].bosses[0],CHAPTERS[0].bosses[0],'stage 46 repeats the first boss');
  assert.notEqual(CHAPTERS[45].name,CHAPTERS[0].name,'dawn names differ from the night ones');
});

test('dawn garden: beds, caps and unlock stages',()=>{
  assert.deepEqual(GARDENS.map(g=>g.beds),[['rose','spring','seed'],['crit','critDamage','stardust']]);
  assert.deepEqual([...BED_IDS],['rose','spring','seed','crit','critDamage','stardust']);
  assert.equal(TUNING.beds.crit.unlock,45);assert.equal(TUNING.beds.critDamage.unlock,45);assert.equal(TUNING.beds.stardust.unlock,60);
  // start values and soft caps from the design
  assert.ok(Math.abs(critChance(0)-.01)<1e-12);assert.ok(Math.abs(critChance(26)-.2)<1e-12);assert.equal(critChance(99),critChance(26));
  assert.ok(Math.abs(critDamage(0)-1.5)<1e-12);assert.ok(Math.abs(critDamage(20)-2)<1e-12);assert.equal(critDamage(99),critDamage(20));
  assert.ok(Math.abs(stardustRate(0)-.01)<1e-12);assert.ok(Math.abs(stardustRate(34)-.5)<1e-12);assert.equal(stardustRate(99),stardustRate(34));
  assert.equal(bedMax('crit'),26);assert.equal(bedMax('critDamage'),20);assert.equal(bedMax('stardust'),34);assert.equal(bedMax('rose'),Infinity);
  // effects are fast first and slow later, and the average gain tops out at +20%
  assert.ok(critChance(1)-critChance(0)>critChance(26)-critChance(25));
  assert.ok(Math.abs(critExpected({crit:26,critDamage:20})-1.2)<1e-12);
  // prices are strictly increasing; the first levels are cheap and the full set takes a long time
  for(const id of ['crit','critDamage','stardust']){let last=0,total=0;for(let l=0;l<bedMax(id);l++){const c=bedCost(id,l);assert.ok(c>last,id+' '+l);last=c;total+=c;}assert.ok(bedCost(id,0)<=1200);assert.ok(total>80000,id+' total '+total);}
});

test('the dawn effects exist only after their beds open, so stages 1-45 are unchanged',()=>{
  assert.equal(critStats({crit:9,critDamage:9},44),null);
  assert.deepEqual(critStats({crit:0,critDamage:0},45),{chance:.01,damage:1.5});
  assert.equal(stardustBonus({stardust:10},59),0);assert.ok(stardustBonus({stardust:10},60)>.2);
  const p=createProfile(NOW);p.cleared=44;p.beds.stardust=34;p.idleAt=NOW-20*HOUR;
  assert.equal(idleReward(p,NOW),Math.floor(20*(TUNING.idleDustPerHour+44*2)),'no bonus before the bed opens');
  p.cleared=60;assert.equal(idleReward(p,NOW),Math.floor(20*(TUNING.idleDustPerHour+60*2)*1.5));
});

test('growing a dawn bed: stage lock, cap and cost',()=>{
  const p=createProfile(NOW);p.dust=1e6;
  assert.equal(command(p,'bed',{id:'crit'},NOW).ok,false,'closed before stage 45');
  p.cleared=45;const cost=bedCost('crit',0);ok(p,'bed',{id:'crit'});assert.equal(p.beds.crit,1);assert.equal(p.dust,1e6-cost);
  assert.equal(command(p,'bed',{id:'stardust'},NOW).ok,false,'stardust opens at stage 60');
  p.cleared=60;ok(p,'bed',{id:'stardust'});
  p.beds.crit=26;assert.ok(bedFull('crit',26));const dust=p.dust;const r=command(p,'bed',{id:'crit'},NOW);assert.equal(r.ok,false);assert.equal(p.dust,dust,'a full bed takes nothing');
  assert.equal(validateProfile(p),true);p.beds.crit=27;assert.equal(validateProfile(p),false,'levels above the cap are invalid');
});

test('save migration: revision 3 saves gain the dawn beds, and a cleared stage 45 brings Behemoth',()=>{
  const old=createProfile(NOW);old.bedRev=3;old.beds={rose:7,spring:3,seed:1};old.cleared=50;
  assert.equal(old.heroes.behemoth.owned,false);
  const moved=parseProfile(JSON.stringify(old));assert.ok(moved);assert.equal(moved.bedRev,4);
  assert.deepEqual(moved.beds,{rose:7,spring:3,seed:1,crit:0,critDamage:0,stardust:0});
  assert.equal(moved.heroes.behemoth.owned,true,'a save that already cleared stage 45 receives the companion');
  const young=createProfile(NOW);young.bedRev=3;young.beds={rose:0,spring:0,seed:0};young.cleared=44;
  assert.equal(parseProfile(JSON.stringify(young)).heroes.behemoth.owned,false);
});

test('clearing stage 45 for the first time opens part two and brings Behemoth',()=>{
  assert.deepEqual(CLEAR_UNLOCKS,{45:['behemoth']});
  const p=createProfile(NOW);p.cleared=44;ok(p,'begin',{mode:'main',stage:45},NOW);
  const r=ok(p,'settle',{token:p.active.token,won:true,round:6},NOW+1000);
  assert.equal(p.cleared,45);assert.equal(r.partOpened,true);assert.deepEqual(r.unlocked,['behemoth']);assert.equal(p.heroes.behemoth.owned,true);
  ok(p,'begin',{mode:'main',stage:46},NOW+2000);assert.equal(p.active.stage,46);
  const again=ok(p,'settle',{token:p.active.token,won:true,round:6},NOW+3000);assert.equal(again.partOpened,false);assert.deepEqual(again.unlocked,[]);
  assert.deepEqual(grantClearUnlocks(p),[],'already owned');
  assert.equal(command(p,'begin',{mode:'main',stage:48},NOW+4000).ok,false,'stage 47 has to be cleared first');
  p.active=null;p.cleared=90;assert.equal(command(p,'begin',{mode:'main',stage:90},NOW+5000).ok,true);
  assert.equal(validateProfile(p),true);
});

test('the stardust bed is paid out when a dispatch is collected',()=>{
  const p=createProfile(NOW);p.cleared=60;p.beds.stardust=10;p.heroes.queen.owned=true;
  ok(p,'dispatch',{slot:0,id:'queen'},NOW);const stored=p.dispatches[0].dust,collected=NOW+TUNING.dispatchHours*HOUR;
  const r=ok(p,'claimDispatch',{slot:0},collected);
  assert.equal(r.dust,dispatchDust(stored,p.beds,p.cleared));assert.ok(r.dust>stored);
  const q=createProfile(NOW);q.cleared=60;q.beds.stardust=0;q.heroes.queen.owned=true;ok(q,'dispatch',{slot:0,id:'queen'},NOW);
  const base=q.dispatches[0].dust;assert.equal(ok(q,'claimDispatch',{slot:0},collected).dust,Math.floor(base*1.01));
});

const fresh=(crit,seed=11)=>E.newRun({seed,crit});
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

test('a battle takes its crit setting from the profile and resumes only with the same one',()=>{
  const p=createProfile(NOW);p.cleared=50;Object.assign(p.beds,{crit:5,critDamage:4});
  ok(p,'begin',{mode:'main',stage:50},NOW);
  const run=createBattle(p);assert.deepEqual(run.crit,critStats(p.beds,p.cleared));assert.ok(run.crit.chance>.05);
  p.active.run=E.serialize(run);assert.ok(resumeBattle(p));
  p.beds.crit=6;assert.equal(resumeBattle(p),null,'a different crit setting cannot resume the old run');
  // a run from before crits existed still resumes
  p.beds.crit=5;const legacy=JSON.parse(p.active.run);delete legacy.crit;delete legacy.critRng;p.active.run=JSON.stringify(legacy);assert.ok(resumeBattle(p));
  const early=createProfile(NOW);early.cleared=10;ok(early,'begin',{mode:'main',stage:10},NOW);assert.equal(createBattle(early).crit,null);
});

test('test tools of the unlocked build',()=>{
  const p=createProfile(NOW);p.dreams=0;p.dust=0;
  assert.ok(testGrant(p,'wallet'));assert.equal(p.dreams,10000);assert.equal(p.dust,10000);
  testGrant(p,'dreams');testGrant(p,'dust');assert.equal(p.dreams,110000);assert.equal(p.dust,1010000);
  testGrant(p,'stage60');assert.equal(p.cleared,60);testGrant(p,'dawn-max');assert.deepEqual([p.beds.crit,p.beds.critDamage,p.beds.stardust],[26,20,34]);assert.equal(validateProfile(p),true);
  testGrant(p,'dawn-reset');assert.deepEqual([p.beds.crit,p.beds.critDamage,p.beds.stardust],[0,0,0]);
  assert.equal(testGrant(p,'nope'),'');assert.ok(TEST_TOOLS.every(t=>t.label&&t.kind));
  const q=createProfile(NOW);assert.equal(command(q,'testGrant',{kind:'dust'},NOW).ok,false,'the normal build refuses test tools');
  p.dust=9500000;testGrant(p,'dust');assert.equal(p.dust,9999999,'currencies are capped');
});

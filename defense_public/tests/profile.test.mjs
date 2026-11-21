import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,HERO,DEFAULT_DECK,ARTIFACT,TUNING,HIDDEN,MAIN_STAGES,PART_STAGES,INTRO_STAGES,levelStage} from '../src/content.js';
import {unlockProfile,topUpUnlocked,testGrant,TEST_TOOLS} from '../src/test-unlock.js';
import {lateNoticeIds} from '../src/profile.js';
import {LATE_COMPANIONS} from '../src/content.js';
import {ProfileStore,SAVE_KEY,createProfile,validateProfile,parseProfile,available,draftEligible,draftPool,away,command,weeklyState,random} from '../src/profile.js';
import {monthlyReward,weeklyReward,WEEKLY_ENTRIES} from '../src/monthly.js';
import {duplicateCost,relicCost,collectionBonus,HOUR,calendar,levelCost,heroMultiplier,combatPower,draftHeroEntry,bedCost,springGauge,seedGold,relicLevel,heroPool,drawCharacter,enhanceMultiplier,specialMultiplier,roseAttack,lateOpen} from '../src/economy.js';
import {createBattle,resumeBattle} from '../src/battle.js';
import * as E from '../src/combat/engine.js';
import {CONSTELLATIONS} from '../src/library.js';
const NOW=Date.parse('2026-10-04T03:00:00Z');
function memory(p=null){let raw=p?JSON.stringify(p):null;return {fail:false,getItem:()=>raw,setItem(k,v){if(this.fail)throw Error('quota');raw=v;}};}
const storeFor=p=>new ProfileStore(memory(p),NOW);
const call=(s,a,args={},now=NOW)=>{const r=s.transact(a,args,now);assert.ok(r.ok,r.message);return r;};

test('cut-in setting defaults on, migrates old saves and accepts only booleans',()=>{
  const p=createProfile(NOW);assert.equal(p.settings.cutin,true);assert.ok(validateProfile(p));
  delete p.settings.cutin;const migrated=parseProfile(p);assert.equal(migrated.settings.cutin,true);assert.ok(validateProfile(migrated));
  for(const value of [false,true]){assert.ok(command(migrated,'setting',{id:'cutin',value},NOW).ok);assert.equal(migrated.settings.cutin,value);}
  assert.equal(command(migrated,'setting',{id:'cutin',value:0},NOW).ok,false);migrated.settings.cutin=0;assert.equal(validateProfile(migrated),false);
});

test('greenhouse beds are shared, unlock at levels 15 and 30, and soft-cap by cost',()=>{
  const p=createProfile(NOW);assert.deepEqual(p.beds,{rose:0,spring:0,seed:0,crit:0,critDamage:0,stardust:0});assert.equal(p.bedRev,4);p.dust=100000;const s=storeFor(p);
  call(s,'bed',{id:'rose'});assert.equal(s.value.beds.rose,1);assert.equal(s.value.dust,100000-bedCost('rose',0));assert.equal(bedCost('rose',0),120);
  for(const id of ['star_boy','queen'])assert.ok(Math.abs(heroMultiplier(s.value.heroes[id],s.value.beds)-1.01)<1e-12);
  assert.ok(combatPower('star_boy',s.value.heroes.star_boy,{rose:2})>combatPower('star_boy',s.value.heroes.star_boy,{rose:1}));
  s.value.cleared=levelStage(15)-1;assert.equal(s.transact('bed',{id:'spring'},NOW).ok,false,'spring is closed before level 15');
  s.value.cleared=levelStage(15);call(s,'bed',{id:'spring'});assert.equal(s.transact('bed',{id:'seed'},NOW).ok,false,'seed is closed before level 30');
  s.value.cleared=levelStage(30);call(s,'bed',{id:'seed'});assert.deepEqual(s.value.beds,{rose:1,spring:1,seed:1,crit:0,critDamage:0,stardust:0});
  assert.equal(s.transact('bed',{id:'moon'},NOW).ok,false);
  // Soft caps: the cost step jumps after rise and knee2, and no level is refused for being high.
  for(const [id,at] of [['rose',25],['rose',42],['spring',18],['spring',28],['seed',12],['seed',20]]){
    const before=bedCost(id,at-1)/bedCost(id,at-2),after=bedCost(id,at+1)/bedCost(id,at);assert.ok(after>before+.02,id+'@'+at);
    assert.ok(Number.isSafeInteger(bedCost(id,60)),id);
  }
  assert.equal(springGauge(0),120);assert.equal(springGauge(10),130);assert.equal(springGauge(15),135);
  assert.equal(seedGold(10),20);assert.equal(seedGold(15),30);
  s.value.dust=0;assert.equal(s.transact('bed',{id:'rose'},NOW).ok,false);
  // Pacing (docs/GARDEN_BALANCE.md): rose to its knee ~5.7k, later beds open at the price of their stage's income,
  // and the three prices meet in the soft cap (all near 3k at rose 45 · spring 30 · seed 20).
  const cum=(id,n)=>Array.from({length:n},(_,i)=>bedCost(id,i)).reduce((a,b)=>a+b,0);assert.ok(cum('rose',25)>5000&&cum('rose',25)<6500&&cum('rose',42)>18000&&cum('rose',42)<24000);
  assert.ok(bedCost('spring',0)>bedCost('rose',15)&&bedCost('seed',0)>bedCost('spring',10),'later beds open dearer');
  for(const [id,at] of [['spring',30],['seed',20]])assert.ok(Math.abs(bedCost(id,at)/bedCost('rose',45)-1)<.1,id+' meets rose in the soft cap');
  // Old saves: 18×1.14^(L-1) spent on star_boy Lv.5 and snow_rabbit Lv.3 is 129 dust → garden 2 + 39 refund → rose 4.
  const old=createProfile(NOW);delete old.beds;delete old.bedRev;old.dust=0;old.heroes.star_boy.level=5;old.heroes.snow_rabbit.level=3;
  const migrated=parseProfile(JSON.stringify(old));assert.ok(migrated);
  assert.deepEqual(migrated.beds,{rose:4,spring:0,seed:0,crit:0,critDamage:0,stardust:0});assert.equal(migrated.bedRev,4);assert.equal(migrated.garden,undefined);assert.equal(migrated.dust,39);assert.ok(HEROES.every(h=>migrated.heroes[h.id].level===1));
  assert.equal(levelCost(1),90);
  assert.deepEqual(parseProfile(JSON.stringify(migrated)),migrated);
  // Saves keep their exact power: garden L (+4% each) becomes rose 4(L-1); a revision-1 rose (+2%) doubles.
  const garden=createProfile(NOW);delete garden.beds;delete garden.bedRev;garden.garden=11;const moved=parseProfile(JSON.stringify(garden));
  assert.equal(moved.beds.rose,40);assert.equal(moved.bedRev,4);assert.ok(Math.abs(heroMultiplier(moved.heroes.star_boy,moved.beds)-1.4)<1e-12);
  const rev1=createProfile(NOW);delete rev1.bedRev;rev1.beds={rose:20,spring:3,seed:0,crit:0,critDamage:0,stardust:0};const doubled=parseProfile(JSON.stringify(rev1));
  assert.deepEqual(doubled.beds,{rose:40,spring:9,seed:0,crit:0,critDamage:0,stardust:0});assert.equal(doubled.bedRev,4);assert.ok(Math.abs(heroMultiplier(doubled.heroes.star_boy,doubled.beds)-1.4)<1e-12);
  for(const bad of [{rose:-1,spring:0,seed:0,crit:0,critDamage:0,stardust:0},{rose:0,spring:0},{rose:0,spring:0,seed:0,moon:1},null]){const b=structuredClone(migrated);b.beds=bad;assert.equal(validateProfile(b),false);}
});

test('bed revision 3 preserves spring and seed effect from older greenhouse saves',()=>{
  const rev2=createProfile(NOW);rev2.bedRev=2;rev2.beds={rose:5,spring:10,seed:10,crit:0,critDamage:0,stardust:0};
  const moved=parseProfile(JSON.stringify(rev2));assert.ok(moved);assert.equal(moved.bedRev,4);
  assert.deepEqual(moved.beds,{rose:5,spring:30,seed:20,crit:0,critDamage:0,stardust:0});assert.equal(springGauge(30),150);assert.equal(seedGold(20),40);
  const late=createProfile(NOW);late.bedRev=2;late.beds={rose:8,spring:15,seed:12,crit:0,critDamage:0,stardust:0};
  const grown=parseProfile(JSON.stringify(late));assert.deepEqual(grown.beds,{rose:8,spring:35,seed:22,crit:0,critDamage:0,stardust:0});
  assert.equal(springGauge(35),155);assert.equal(seedGold(22),44);
  const already=createProfile(NOW);already.bedRev=3;already.beds={rose:2,spring:6,seed:4,crit:0,critDamage:0,stardust:0};
  assert.deepEqual(parseProfile(JSON.stringify(already)).beds,{rose:2,spring:6,seed:4,crit:0,critDamage:0,stardust:0});
});

test('spring and seed shape a new run: starlight ceiling and starting gold',()=>{
  const p=createProfile(NOW);p.beds={rose:0,spring:12,seed:12,crit:0,critDamage:0,stardust:0};const s=storeFor(p);call(s,'begin',{mode:'main',stage:1});
  const run=createBattle(s.value);assert.equal(run.gaugeMax,springGauge(12));assert.equal(run.gold,70+seedGold(12));
  run.gauge=run.gaugeMax-1;E.step(run,.05);assert.ok(run.gauge<=run.gaugeMax);
  const restored=E.restore(E.serialize(run));assert.ok(restored);assert.equal(restored.gaugeMax,springGauge(12));
  const legacy=JSON.parse(E.serialize(run));delete legacy.gaugeMax;legacy.gauge=Math.min(legacy.gauge,120);assert.ok(E.restore(legacy),'older runs keep the 120 ceiling');
  const over=JSON.parse(E.serialize(run));over.gauge=over.gaugeMax+1;assert.equal(E.restore(over),null);
});

test('a pre-renewal active run resumes with the renewed permanent multipliers',()=>{
  const p=createProfile(NOW);p.heroes.star_boy.enhance=10;p.heroes.star_boy.level=4;
  const s=storeFor(p);call(s,'begin',{mode:'main',stage:1});
  const run=createBattle(s.value);const raw=JSON.parse(E.serialize(run));raw.meta.star_boy={power:2.4,special:1.08};
  const old=structuredClone(s.value);delete old.beds;old.heroes.star_boy.level=4;old.active.run=JSON.stringify(raw);
  const migrated=parseProfile(JSON.stringify(old));assert.ok(migrated,'old checkpoint stays resumable');
  const resumed=resumeBattle(migrated);assert.ok(resumed);
  assert.ok(Math.abs(resumed.meta.star_boy.power-heroMultiplier(migrated.heroes.star_boy,migrated.beds))<1e-12);
  assert.ok(Math.abs(resumed.meta.star_boy.special-1.2)<1e-12);
});

test('daily missions come from playing, the free summons are once a day on each banner, and old missions migrate',()=>{
  const s=storeFor(createProfile(NOW));assert.equal(s.transact('daily',{id:'idle'},NOW).ok,false);
  s.value.idleAt=NOW-3*HOUR;call(s,'idle');assert.equal(s.value.daily.idle,true);const d0=s.value.dreams;call(s,'daily',{id:'idle'});assert.equal(s.value.dreams,d0+30);
  const d1=s.value.dreams;call(s,'draw',{banner:'normal',count:1,free:true});assert.equal(s.value.dreams,d1);assert.equal(s.value.daily.free,true);assert.equal(s.value.history.length,1);
  assert.equal(s.transact('draw',{banner:'normal',count:1,free:true},NOW).ok,false,'one free summon a day');
  // The relic banner has its own free single a day; the season banner has none and a free ten does not exist.
  const r=storeFor(createProfile(NOW)),r0=r.value.dreams;call(r,'draw',{banner:'relic',count:1,free:true});assert.equal(r.value.dreams,r0);assert.equal(r.value.daily.relicFree,true);assert.equal(r.value.daily.free,false);assert.equal(r.value.relicDraws,1);
  assert.equal(r.transact('draw',{banner:'relic',count:1,free:true},NOW).ok,false,'one free relic summon a day');call(r,'draw',{banner:'normal',count:1,free:true});
  call(r,'pet');const midnight=Date.parse('2026-10-04T15:00:00Z');
  assert.equal(r.transact('draw',{banner:'relic',count:1,free:true},midnight-1).ok,false);
  assert.equal(r.transact('pet',{},midnight-1).ok,false);
  assert.equal(r.transact('draw',{banner:'relic',count:1,free:true},midnight).ok,true);
  assert.equal(r.transact('draw',{banner:'normal',count:1,free:true},midnight).ok,true);
  assert.equal(r.transact('pet',{},midnight).ok,true);
  for(const [banner,count] of [['season',1],['relic',10],['normal',10]])assert.equal(storeFor(createProfile(NOW)).transact('draw',{banner,count,free:true},NOW).ok,false,banner+' '+count);
  call(s,'begin',{mode:'main',stage:1});call(s,'settle',{token:s.value.active.token,won:false,round:0,merges:5});assert.equal(s.value.daily.merges,5);
  call(s,'daily',{id:'merge'});call(s,'daily',{id:'combat'});assert.equal(s.transact('daily',{id:'merge'},NOW).ok,false);
  const old=createProfile(NOW);old.daily={day:old.daily.day,combat:true,draw:true,dispatch:false,claimed:['draw']};
  const migrated=parseProfile(JSON.stringify(old));assert.ok(migrated);
  assert.deepEqual(migrated.daily,{day:old.daily.day,combat:true,merges:0,idle:false,free:false,relicFree:false,bouquet:false,accel:false,claimed:[]});
  const bad=structuredClone(migrated);bad.daily.claimed=['draw'];assert.equal(validateProfile(bad),false);
});

test('a new garden owns one of exactly the requested five heroes and starts with a valid deck',()=>{
  const p=createProfile(NOW);assert.ok(validateProfile(p));
  assert.deepEqual(HEROES.filter(h=>p.heroes[h.id].owned).map(h=>h.id).sort(),[...DEFAULT_DECK].sort());
  for(const id of DEFAULT_DECK)assert.equal(p.heroes[id].copies,0);
  assert.equal(p.deck.length,5);assert.equal(p.dispatches.length,0);
});

test('wallet, random state, receipt and duplicate materials commit together or not at all',()=>{
  const disk=memory(),s=new ProfileStore(disk,NOW),before=structuredClone(s.value);
  disk.fail=true;assert.equal(s.transact('draw',{banner:'normal',count:1},NOW).ok,false);
  assert.deepEqual(s.value,before);assert.equal(disk.getItem(SAVE_KEY),null);
  disk.fail=false;const r=call(s,'draw',{banner:'normal',count:1});
  assert.equal(s.value.dreams,500);assert.equal(s.value.history.length,1);
  assert.equal(s.value.heroes[r.items[0].id].owned,true);
  const low=structuredClone(s.value);low.dreams=0;const lowStore=storeFor(low);
  assert.equal(lowStore.transact('draw',{banner:'normal',count:10},NOW).ok,false);
  assert.equal(lowStore.value.history.length,1);
});

test('duplicate growth consumes the correct hero only and relic enhancement requires duplicates',()=>{
  const p=createProfile(NOW);p.heroes.star_boy.copies=10;p.relics.hourglass.owned=true;p.relics.hourglass.copies=3;
  const s=storeFor(p);call(s,'enhance',{id:'star_boy'});call(s,'enhance',{id:'star_boy'});
  assert.equal(s.value.heroes.star_boy.enhance,2);assert.equal(s.value.heroes.star_boy.copies,10-duplicateCost(0)-duplicateCost(1));
  assert.equal(s.value.heroes.snow_rabbit.enhance,0);
  call(s,'enhance',{kind:'relic',id:'hourglass'});assert.equal(s.value.relics.hourglass.copies,3-relicCost('C',0));
  assert.equal(s.value.equipped.length,0);call(s,'equip',{id:'hourglass'});assert.deepEqual(s.value.equipped,['hourglass']);
});

test('relic enhance spends relicCost copies by rarity, not hero duplicateCost',()=>{
  const p=createProfile(NOW);p.relics.hourglass.owned=true;p.relics.hourglass.copies=6;p.relics.gift_ribbon.owned=true;p.relics.gift_ribbon.copies=2;
  const s=storeFor(p);
  for(let i=0;i<4;i++)call(s,'enhance',{kind:'relic',id:'hourglass'});
  assert.equal(s.value.relics.hourglass.enhance,4);assert.equal(s.value.relics.hourglass.copies,0);
  assert.equal(s.transact('enhance',{kind:'relic',id:'hourglass'},NOW).ok,false,'Lv5→6 needs 3 C copies');
  call(s,'enhance',{kind:'relic',id:'gift_ribbon'});assert.equal(s.value.relics.gift_ribbon.enhance,1);assert.equal(s.value.relics.gift_ribbon.copies,2-relicCost('UR',0));
});

test('older saves gain relicRev 2 and an in-progress run still resumes',()=>{
  const p=createProfile(NOW);p.relics.hourglass.owned=true;p.relics.hourglass.enhance=5;p.equipped=['hourglass'];
  const s=storeFor(p);call(s,'begin',{mode:'main',stage:1});
  const run=createBattle(s.value),raw=JSON.parse(E.serialize(run));
  raw.relicAttack=.02*5;delete raw.relicLevels;
  const old=structuredClone(s.value);delete old.relicRev;old.active.run=JSON.stringify(raw);
  const migrated=parseProfile(JSON.stringify(old));assert.ok(migrated,'old checkpoint stays resumable');assert.equal(migrated.relicRev,2);
  const resumed=resumeBattle(migrated);assert.ok(resumed);
  assert.ok(Math.abs(resumed.relicAttack-collectionBonus(migrated.relics))<1e-12);
  assert.deepEqual(resumed.relicLevels,{hourglass:6});
  assert.equal(createProfile(NOW).relicRev,2);
  const bad=structuredClone(createProfile(NOW));bad.relicRev=1;assert.equal(validateProfile(bad),false);
});

test('older saves gain the relic patch entries',()=>{
  const raw=createProfile(NOW);
  for(const id of ['spotlight','royal_crown','dream_crystal'])delete raw.relics[id];
  const loaded=parseProfile(JSON.stringify(raw));
  assert.ok(loaded);
  for(const id of ['spotlight','royal_crown','dream_crystal'])assert.deepEqual(loaded.relics[id],{owned:false,enhance:0,copies:0});
});

test('a dispatch cannot consume the last five battle heroes and has a fixed one-hour receipt',()=>{
  const p=createProfile(NOW);p.cleared=9;const s=storeFor(p);
  assert.equal(s.transact('dispatch',{slot:0,id:'star_boy'},NOW).ok,false);
  const q=createProfile(NOW);q.cleared=9;q.heroes.queen.owned=true;const extra=storeFor(q);
  assert.equal(call(extra,'dispatch',{slot:0,id:'star_boy'}).message,'파견 출발 · 1시간 후 귀환');
  assert.ok(away(extra.value,'star_boy'));assert.equal(extra.value.deck.length,5);assert.ok(!extra.value.deck.includes('star_boy'));
  assert.equal(extra.transact('deck',{ids:DEFAULT_DECK},NOW).ok,false);
  assert.equal(extra.transact('begin',{mode:'main',stage:10,deck:DEFAULT_DECK},NOW).ok,false);
  const d=extra.value.dispatches[0];assert.equal(d.end-d.start,HOUR);
  const malformed=structuredClone(extra.value);malformed.dispatches[0].end+=1;assert.equal(validateProfile(malformed),false);
  assert.ok(d.dust>d.reward&&d.reward>=1,'dust is the main dispatch reward');
  call(extra,'bed',{id:'rose'});assert.equal(extra.value.dispatches[0].reward,d.reward);assert.equal(extra.value.dispatches[0].dust,d.dust);
  assert.equal(extra.transact('claimDispatch',{slot:0},d.end-1).ok,false);
  const before=extra.value.dreams,dust=extra.value.dust;call(extra,'claimDispatch',{slot:0},d.end);
  assert.equal(extra.value.dreams,before+d.reward);assert.equal(extra.value.dust,dust+d.dust);assert.ok(available(extra.value).includes('star_boy'));
  assert.equal(extra.transact('claimDispatch',{slot:0},d.end).ok,false);
});

test('a dispatch sent before dust rewards still validates and pays its promised crystals',()=>{
  const p=createProfile(NOW);p.cleared=9;p.heroes.queen.owned=true;
  p.dispatches=[{slot:0,hero:'star_boy',start:NOW,end:NOW+TUNING.dispatchHours*HOUR,reward:77}];p.deck=p.deck.filter(id=>id!=='star_boy');p.deck.push('queen');
  assert.ok(validateProfile(p));const s=storeFor(p),dreams=s.value.dreams,dust=s.value.dust;
  call(s,'claimDispatch',{slot:0},NOW+TUNING.dispatchHours*HOUR);assert.equal(s.value.dreams,dreams+77);assert.equal(s.value.dust,dust);
  const bad=structuredClone(p);bad.dispatches[0].dust=-1;assert.equal(validateProfile(bad),false);
});

test('weekly draft survives reload, excludes dispatched heroes and produces five distinct choices',()=>{
  const p=createProfile(NOW);p.cleared=9;for(const h of HEROES)p.heroes[h.id].owned=true;
  const s=storeFor(p);call(s,'dispatch',{slot:0,id:'queen'});call(s,'begin',{mode:'weekly',stage:10});
  assert.ok(!s.value.active.draftPool.includes('queen'));assert.equal(s.value.weekly,calendar(NOW).week);
  call(s,'draft',{index:0});const reload=new ProfileStore(s.storage,NOW);assert.deepEqual(reload.value.active,s.value.active);
  for(let i=1;i<5;i++)call(reload,'draft',{index:i%2});
  assert.equal(new Set(reload.value.active.deck).size,5);assert.ok(validateProfile(reload.value));
  assert.ok(createBattle(reload.value));assert.equal(reload.transact('begin',{mode:'weekly'},NOW).ok,false);
  const token=reload.value.active.token;call(reload,'settle',{token,round:3,won:false});assert.equal(reload.value.dreams,600+weeklyReward('easy',3,false));
  assert.equal(reload.transact('settle',{token,round:3,won:false},NOW).ok,false);
  assert.equal(reload.value.weeklyRuns,1);assert.deepEqual(reload.value.weeklyBest,{round:3,won:false,tier:'easy',reward:weeklyReward('easy',3,false)});
});

test('the draft allows three entries per four-hour period and pays its best record',()=>{
  const p=createProfile(NOW);p.cleared=TUNING.beds.crit.unlock-5;for(const h of HEROES)p.heroes[h.id].owned=true;const s=storeFor(p);
  const run=(tier,round,won)=>{call(s,'begin',{mode:'weekly',tier});for(let i=0;i<5;i++)call(s,'draft',{index:0});const before=s.value.dreams,r=call(s,'settle',{token:s.value.active.token,round,won});assert.equal(s.value.dreams-before,r.reward);return r;};
  const first=run('easy',6,false);assert.equal(first.reward,3*Math.round(250*1.3));assert.equal(first.newBest,true);assert.equal(first.left,2);
  const worse=run('easy',4,false);assert.equal(worse.reward,0,'a lower record pays nothing');assert.equal(worse.newBest,false);assert.equal(worse.left,1);
  assert.equal(s.value.weeklyBest.round,6);
  const best=run('hard',18,true);assert.equal(best.reward,weeklyReward('hard',18,true)-weeklyReward('easy',6,false),'a better record pays the difference');
  assert.equal(best.newBest,true);assert.equal(best.left,0);assert.equal(best.earned,weeklyReward('hard',18,true));assert.equal(best.paidBefore,weeklyReward('easy',6,false));
  assert.equal(s.value.dreams,600+weeklyReward('hard',18,true),'three runs pay only the period best');
  const {end}=calendar(NOW).periods.draft;assert.equal(end-calendar(NOW).periods.draft.start,4*HOUR);
  const fourth=s.transact('begin',{mode:'weekly',tier:'easy'},end-1);assert.equal(fourth.ok,false);assert.match(fourth.message,/입장 횟수/);
  assert.equal(s.value.weeklyRuns,3);assert.ok(validateProfile(s.value));
  assert.deepEqual(weeklyState(s.value,end),{runs:0,left:3,best:null});
  call(s,'begin',{mode:'weekly',tier:'easy'},end);assert.equal(s.value.weeklyRuns,1);assert.equal(s.value.weekly,calendar(end).week);assert.equal(s.value.weeklyBest,null);
  const bad=structuredClone(s.value);bad.weeklyRuns=4;assert.equal(validateProfile(bad),false);
  for(const wrong of [null,calendar(end-1).week,calendar(end).month,'2026-10-04']){
    const bad=structuredClone(s.value);bad.weekly=wrong;assert.equal(validateProfile(bad),false);
  }
});

test('the single-entry save shape keeps the draft period and recovers its best record',()=>{
  const p=createProfile(NOW);p.cleared=40;p.weekly=calendar(NOW).week;delete p.weeklyRuns;delete p.weeklyBest;
  p.results=[{at:NOW,mode:'weekly',stage:4,round:9,reward:weeklyReward('hard',9,false),won:false,tier:'hard'}];
  const m=parseProfile(p);assert.ok(m);assert.equal(m.weeklyRuns,1);assert.deepEqual(m.weeklyBest,{round:9,won:false,tier:'hard',reward:weeklyReward('hard',9,false)});
  const fresh=createProfile(NOW);delete fresh.weeklyRuns;delete fresh.weeklyBest;const n=parseProfile(fresh);assert.equal(n.weeklyRuns,0);assert.equal(n.weeklyBest,null);
  // A settled entry missing its receipt keeps the period closed to prevent duplicate payment.
  const lost=createProfile(NOW);lost.cleared=40;lost.weekly=calendar(NOW).week;delete lost.weeklyRuns;delete lost.weeklyBest;lost.results=[];
  const l=parseProfile(lost);assert.equal(l.weeklyRuns,WEEKLY_ENTRIES);assert.equal(l.weeklyBest,null);assert.equal(command(l,'begin',{mode:'weekly',tier:'easy'},NOW).ok,false);
  // A draft still running from the old rule has paid nothing: it settles in full and leaves two entries.
  const running=createProfile(NOW);running.cleared=40;for(const h of HEROES)running.heroes[h.id].owned=true;
  assert.ok(command(running,'begin',{mode:'weekly',tier:'easy'},NOW).ok);delete running.weeklyRuns;delete running.weeklyBest;
  const r=parseProfile(running);assert.ok(r);assert.equal(r.weeklyRuns,1);assert.equal(r.weeklyBest,null);
  for(let i=0;i<5;i++)assert.ok(command(r,'draft',{index:0},NOW).ok);const paid=command(r,'settle',{token:r.active.token,round:5,won:false},NOW);
  assert.equal(paid.reward,weeklyReward('easy',5,false));assert.equal(paid.left,WEEKLY_ENTRIES-1);
});

test('a saved five-hero draft pool still gives two honest tactical choices on the final draft pick',()=>{
  const p=createProfile(NOW);p.cleared=3;const s=storeFor(p);call(s,'begin',{mode:'weekly',stage:4});
  const saved=structuredClone(s.value);
  saved.active.draftPool=[...DEFAULT_DECK];saved.active.draft=DEFAULT_DECK.slice(0,3);saved.active.boon=0;
  saved.active.offers=[{id:DEFAULT_DECK[3],boon:'focus'},{id:DEFAULT_DECK[4],boon:'spark'}];
  const loaded=storeFor(parseProfile(JSON.stringify(saved)));
  call(loaded,'draft',{index:0});
  assert.equal(loaded.value.active.offers[0].id,DEFAULT_DECK[4]);
  assert.equal(loaded.value.active.offers[0].id,loaded.value.active.offers[1].id);
  assert.notEqual(loaded.value.active.offers[0].boon,loaded.value.active.offers[1].boon);
  call(loaded,'draft',{index:1});assert.equal(new Set(loaded.value.active.deck).size,5);
});

test('weekly draft includes unowned companions with part-one unlock, base enhancement, and shared growth',()=>{
  const early=createProfile(NOW);early.cleared=PART_STAGES-1;early.beds.rose=10;early.beds.spring=5;early.beds.seed=4;
  early.relics.hourglass={owned:true,enhance:2,copies:0};early.equipped=['hourglass'];
  early.heroes.star_boy.enhance=10;early.heroes.queen.owned=true;early.heroes.queen.enhance=6;
  const earlyStore=storeFor(early);call(earlyStore,'dispatch',{slot:0,id:'queen'});
  call(earlyStore,'begin',{mode:'weekly'});
  const expectedEarly=HEROES.filter(h=>!LATE_COMPANIONS.includes(h.id)&&h.id!=='queen').map(h=>h.id);
  assert.deepEqual(earlyStore.value.active.draftPool,expectedEarly,'before part one: early owned + unowned (including hidden), excluding late and dispatched');
  assert.equal(LATE_COMPANIONS.some(id=>earlyStore.value.active.draftPool.includes(id)),false);
  assert.equal(HIDDEN.every(id=>earlyStore.value.active.draftPool.includes(id)),true);
  assert.equal(draftEligible(earlyStore.value,'gold_dragon'),false);
  assert.equal(draftEligible(earlyStore.value,'queen'),false);

  // Owned late companions remain eligible before PART_STAGES just like in the collection.
  const ownedLate=createProfile(NOW);ownedLate.cleared=3;ownedLate.heroes.gold_dragon.owned=true;
  assert.equal(draftPool(ownedLate).includes('gold_dragon'),true);

  // After part one clear, all 42 companions (minus dispatched) join the draft pool.
  const late=createProfile(NOW);late.cleared=PART_STAGES;late.beds.rose=10;late.beds.spring=5;late.beds.seed=4;
  late.relics.hourglass={owned:true,enhance:2,copies:0};late.equipped=['hourglass'];
  late.heroes.star_boy.enhance=10;late.heroes.queen.owned=true;
  const lateStore=storeFor(late);call(lateStore,'dispatch',{slot:0,id:'queen'});
  call(lateStore,'begin',{mode:'weekly'});
  assert.equal(lateStore.value.active.draftPool.length,HEROES.length-1);
  assert.equal(LATE_COMPANIONS.every(id=>lateStore.value.active.draftPool.includes(id)),true);

  // Unowned drafted companions compute combat power and battle multipliers at enhance 0 while keeping shared growth;
  // plain combatPower on an unowned entry still returns 0.
  assert.equal(combatPower('luna',lateStore.value.heroes.luna,lateStore.value.beds,collectionBonus(lateStore.value.relics)),0);
  const unownedPower=combatPower('luna',draftHeroEntry(lateStore.value.heroes.luna),lateStore.value.beds,collectionBonus(lateStore.value.relics));
  assert.ok(unownedPower>0);
  assert.equal(unownedPower,combatPower('luna',{owned:true,enhance:0},lateStore.value.beds,collectionBonus(lateStore.value.relics)));

  // Pick a deterministic weekly deck containing both an enhanced owned hero and unowned heroes.
  const deck=['star_boy','luna','gold_dragon','cinderella','snow_rabbit'];
  lateStore.value.active.draft=[];lateStore.value.active.boon=0;
  for(const id of deck){
    lateStore.value.active.offers=[{id,boon:'focus'},{id:id==='queen'?'siren':deck.find(x=>x!==id),boon:'spark'}];
    call(lateStore,'draft',{index:0});
  }
  assert.deepEqual(lateStore.value.active.deck,deck);
  assert.equal(validateProfile(lateStore.value),true);

  const run=createBattle(lateStore.value);assert.ok(run);
  const expectedRose=1+roseAttack(lateStore.value.beds.rose);
  assert.ok(Math.abs(run.meta.star_boy.power-expectedRose*enhanceMultiplier(10))<1e-12);
  assert.ok(Math.abs(run.meta.star_boy.special-specialMultiplier(10))<1e-12);
  for(const id of ['luna','gold_dragon','cinderella']){
    assert.ok(Math.abs(run.meta[id].power-expectedRose)<1e-12,id+' uses beds.rose with enhance 0');
    assert.equal(run.meta[id].special,1,id+' specialMultiplier(0) === 1');
  }
  assert.equal(run.gaugeMax,springGauge(5));assert.equal(run.gold,70+seedGold(4));
  assert.ok(Math.abs(run.relicAttack-collectionBonus(lateStore.value.relics))<1e-12);
  lateStore.value.active.run=E.serialize(run);
  const reloaded=parseProfile(JSON.stringify(lateStore.value));assert.ok(reloaded&&resumeBattle(reloaded));

  // Validation rejects unowned late companions before part one, dispatched heroes, and non-weekly unowned decks.
  const badEarly=structuredClone(earlyStore.value);badEarly.active.draftPool.push('gold_dragon');assert.equal(validateProfile(badEarly),false);
  const badAway=structuredClone(lateStore.value);badAway.active.draftPool.push('queen');assert.equal(validateProfile(badAway),false);
  const badAwayDeck=structuredClone(lateStore.value);badAwayDeck.active.draft[0]='queen';badAwayDeck.active.deck[0]='queen';assert.equal(validateProfile(badAwayDeck),false);
  const badMain=createProfile(NOW);badMain.active={mode:'main',stage:1,deck:['luna',...DEFAULT_DECK.slice(1)],started:NOW,seed:1,token:'t',boon:0,run:null,relicAttack:0,relicLevels:{}};
  assert.equal(validateProfile(badMain),false,'main mode still rejects unowned heroes');
  assert.equal(lateOpen(PART_STAGES-1),false);assert.equal(lateOpen(PART_STAGES),true);
});

test('failed monthly entry, record save and reward confirmation preserve the wallet and active run',()=>{
  const p=createProfile(NOW);p.cleared=3;const disk=memory(p),s=new ProfileStore(disk,NOW);
  disk.fail=true;assert.equal(s.transact('begin',{mode:'monthly',stage:4},NOW).ok,false);assert.equal(s.value.monthly,null);
  disk.fail=false;call(s,'begin',{mode:'monthly',stage:4});const before=structuredClone(s.value);
  disk.fail=true;assert.equal(s.transact('settle',{token:s.value.active.token,round:2},NOW).ok,false);assert.deepEqual(s.value,before);
  disk.fail=false;call(s,'settle',{token:s.value.active.token,round:2,damage:1200,seconds:32});assert.equal(s.value.dreams,600+monthlyReward({round:2}));assert.equal(s.value.monthlyClaim.round,2);
  const token=s.value.monthlyBest.token;assert.equal(s.transact('claimMonthly',{token},NOW).ok,false);
  call(s,'begin',{mode:'monthly'},NOW);call(s,'settle',{token:s.value.active.token,round:4});assert.equal(s.value.dreams,600+monthlyReward({round:4}));assert.equal(s.value.monthlyBest.round,4);
  assert.equal(s.transact('claimMonthly',{token:s.value.monthlyBest.token},NOW).ok,false);
  call(s,'begin',{mode:'monthly'},Date.parse('2026-11-01T00:00:00Z'));
});

test('gacha during a saved expedition preserves its battle seed, stats and exact resume',()=>{
  const s=storeFor(createProfile(NOW));call(s,'begin',{mode:'main',stage:1});const run=createBattle(s.value);
  E.step(run,.05);assert.equal(s.saveRun(E.serialize(run)),true);const seed=run.seed;
  call(s,'draw',{banner:'normal',count:1});assert.notEqual(s.value.rng,seed);
  const restored=resumeBattle(s.value);assert.ok(restored);assert.equal(restored.seed,seed);assert.equal(restored.time,run.time);
  const bad=JSON.parse(E.serialize(run));bad.meta.star_boy.power=10;
  assert.equal(s.saveRun(JSON.stringify(bad)),false);
});

test('invalid draft/run backups are rejected and damaged data is preserved until valid import',()=>{
  const p=createProfile(NOW);p.cleared=3;const s=storeFor(p);call(s,'begin',{mode:'weekly',stage:4});
  const bad=structuredClone(s.value);bad.active.offers[0].id='missing';assert.equal(parseProfile(bad),null);
  const disk=memory();disk.setItem(SAVE_KEY,'{broken');const broken=new ProfileStore(disk,NOW);
  assert.equal(broken.broken,true);assert.equal(broken.transact('pet',{},NOW).ok,false);assert.equal(disk.getItem(SAVE_KEY),'{broken');
  assert.equal(broken.import(JSON.stringify(createProfile(NOW))).ok,true);assert.equal(broken.broken,false);
});

test('concurrent windows, clock rollback, daily rewards and first-clear rewards cannot duplicate',()=>{
  const disk=memory(),s=new ProfileStore(disk,NOW),other=new ProfileStore(disk,NOW);
  call(s,'pet');assert.equal(other.transact('pet',{},NOW).ok,false);assert.equal(other.conflict,true);
  assert.equal(s.transact('pet',{},NOW-24*HOUR).ok,false);
  call(s,'begin',{mode:'main',stage:1});call(s,'settle',{token:s.value.active.token,round:6,won:true});
  assert.equal(s.value.cleared,1);const dreams=s.value.dreams;call(s,'daily',{id:'combat'});
  assert.equal(s.value.dreams,dreams+60);assert.equal(s.transact('daily',{id:'combat'},NOW).ok,false);
  call(s,'begin',{mode:'main',stage:1});call(s,'settle',{token:s.value.active.token,round:6,won:true});
  assert.equal(s.value.dreams,dreams+60);
  call(s,'idle',{},NOW+21*HOUR);const dust=s.value.dust;
  assert.equal(s.transact('idle',{},NOW).ok,false);assert.equal(s.value.dust,dust);
});

test('topUpUnlocked owns companions and relics added after the save, and testGrant is unlocked-only',()=>{
  const raw=createProfile(NOW);delete raw.heroes.behemoth;delete raw.relics.hourglass;
  raw.heroes.star_boy.bond=6;raw.heroes.star_boy.bondXp=3;
  raw.relics.lens.owned=true;raw.relics.lens.enhance=2;raw.relics.lens.copies=1;
  const p=parseProfile(JSON.stringify(raw));
  assert.equal(p.heroes.behemoth.owned,false);assert.equal(p.relics.hourglass.owned,false);
  assert.equal(p.cleared,0);topUpUnlocked(p);assert.equal(p.cleared,MAIN_STAGES,'an old test save is raised to the last stage');
  assert.equal(p.heroes.behemoth.owned,true);assert.equal(p.heroes.behemoth.bond,10);assert.equal(p.heroes.behemoth.bondXp,0);
  assert.equal(p.heroes.star_boy.bond,6);assert.equal(p.heroes.star_boy.bondXp,3);
  assert.equal(p.relics.hourglass.owned,true);assert.equal(p.relics.hourglass.enhance,6);assert.equal(p.relics.hourglass.copies,20);
  assert.equal(p.relics.lens.enhance,2);assert.equal(p.relics.lens.copies,1);
  assert.equal(validateProfile(p),true);
  const dreams=p.dreams,dust=p.dust;
  const denied=command(p,'testGrant',{},NOW);assert.equal(denied.ok,false);assert.equal(p.dreams,dreams);assert.equal(p.dust,dust);
  assert.equal(command(p,'testGrant',{unlocked:true},NOW).ok,false,'no argument opens it outside the unlocked build');
  testGrant(p);assert.equal(p.dreams,dreams+10000);assert.equal(p.dust,dust+10000);
  p.dreams=9999990;p.dust=9999999;testGrant(p);
  assert.equal(p.dreams,9999999);assert.equal(p.dust,9999999);assert.equal(validateProfile(p),true);
});

test('a save from before the intro chapter moves every main stage it names nine places and keeps its battle',()=>{
  const old=createProfile(NOW);delete old.stageRev;old.cleared=20;old.perfect=[3,7,20];
  old.results=[{at:NOW,mode:'main',stage:20,round:6,reward:0,won:true},{at:NOW,mode:'weekly',stage:4,round:3,reward:10,won:false}];
  call(storeFor(old),'tick');assert.equal(old.cleared,20,'a store on an in-memory profile does not migrate it');
  old.active={mode:'main',stage:21,deck:[...old.deck],started:NOW,seed:77,token:'t-1',boon:0,run:null,relicAttack:0,relicLevels:{}};
  old.active.run=E.serialize(createBattle({...old,active:{...old.active}}));
  const moved=parseProfile(JSON.stringify(old));assert.ok(moved);assert.equal(moved.stageRev,1);
  assert.equal(moved.cleared,20+INTRO_STAGES);assert.deepEqual(moved.perfect,[12,16,29]);
  assert.equal(moved.results[0].stage,29);assert.equal(moved.results[1].stage,4,'other modes keep their stage');
  assert.equal(moved.active.stage,30);assert.equal(JSON.parse(moved.active.run).chapter,29);assert.ok(resumeBattle(moved),'the battle in progress resumes on the same enemies');
  assert.equal(parseProfile(JSON.stringify(moved)).cleared,moved.cleared,'a migrated save is not moved twice');
  // A save that had not cleared a stage starts in the intro, and its stage 1 run stays stage 1.
  const young=createProfile(NOW);delete young.stageRev;const y=parseProfile(JSON.stringify(young));assert.equal(y.cleared,0);assert.equal(y.stageRev,1);
  const bad=createProfile(NOW);bad.stageRev=2;assert.equal(parseProfile(JSON.stringify(bad)),null);
});

test('perfect clears pay 100 dreams once on main stages',()=>{
  const old=createProfile(NOW);delete old.perfect;const loaded=parseProfile(JSON.stringify(old));assert.deepEqual(loaded.perfect,[]);
  const s=storeFor(loaded),start=s.value.dreams;
  call(s,'begin',{mode:'main',stage:1});
  const first=call(s,'settle',{token:s.value.active.token,round:6,won:true,perfect:true});
  assert.equal(first.reward,260);assert.equal(first.clearReward,160,'intro stages pay the level-0 first clear');assert.equal(first.firstPerfect,true);assert.equal(first.perfect,true);
  assert.equal(s.value.dreams,start+260);assert.deepEqual(s.value.perfect,[1]);assert.equal(s.value.results[0].perfect,true);
  call(s,'begin',{mode:'main',stage:1});
  const again=call(s,'settle',{token:s.value.active.token,round:6,won:true,perfect:true});
  assert.equal(again.reward,0);assert.equal(again.clearReward,0);assert.equal(again.firstPerfect,false);assert.equal(again.perfect,true);
  assert.equal(s.value.dreams,start+260);assert.deepEqual(s.value.perfect,[1]);
  call(s,'begin',{mode:'main',stage:2});
  const plain=call(s,'settle',{token:s.value.active.token,round:6,won:true,perfect:false});
  assert.equal(plain.reward,160);assert.equal(plain.clearReward,160);assert.equal(plain.perfect,false);
  assert.deepEqual(s.value.perfect,[1]);assert.equal(s.value.results[0].perfect,undefined);
  call(s,'begin',{mode:'main',stage:3});
  const both=call(s,'settle',{token:s.value.active.token,round:6,won:true,perfect:true});
  assert.equal(both.clearReward,160);assert.equal(both.reward,260);assert.equal(both.firstPerfect,true);
  assert.deepEqual(s.value.perfect,[1,3]);
  const bad=structuredClone(s.value);
  for(const perfect of [[3,1],[1,1],[0],[4],[1.5]]){bad.perfect=perfect;assert.equal(validateProfile(bad),false,JSON.stringify(perfect));}
  bad.perfect=[1,3];assert.equal(validateProfile(bad),true);
});

test('unlockProfile owns every companion (three below ten hearts to try gifts), every relic, and clears every main stage',()=>{
  const fresh=createProfile(NOW),deck=[...fresh.deck],partner=fresh.partner,relics=structuredClone(fresh.relics);
  const p=unlockProfile(fresh);
  assert.equal(p,fresh);
  assert.ok(HEROES.every(h=>{const e=p.heroes[h.id];return e.owned&&e.bond===({star_boy:6,siren:3,snow_rabbit:8}[h.id]??10)&&e.level===1&&e.enhance===0&&e.copies===0;}));
  assert.equal(p.cleared,MAIN_STAGES);assert.equal(p.dreams,99999);assert.equal(p.dust,99999);
  assert.deepEqual(p.deck,deck);assert.equal(p.partner,partner);
  assert.ok(Object.entries(p.relics).every(([id,r])=>r.owned&&r.enhance==={C:6,R:4,SR:3,UR:1}[ARTIFACT[id].rarity]&&r.copies>0),'every relic owned at a mid-game level with spare duplicates');
  assert.equal(validateProfile(p),true);
});

test('the legacy dispatch migration retains the receipt and applies the one-hour duration',()=>{
  const raw=createProfile(NOW);raw.cleared=9;raw.heroes.queen.owned=true;
  raw.dispatches=[{slot:0,hero:'star_boy',start:NOW,end:NOW+20*HOUR,reward:77,dust:3}];
  raw.deck=raw.deck.filter(id=>id!=='star_boy');raw.deck.push('queen');
  assert.equal(validateProfile(raw),false);
  const migrated=parseProfile(JSON.stringify(raw));assert.ok(migrated);
  assert.equal(migrated.dispatches[0].end,NOW+20*HOUR);
  assert.equal(migrated.dispatches[0].start,migrated.dispatches[0].end-TUNING.dispatchHours*HOUR);
  assert.equal(migrated.dispatches[0].reward,77);assert.equal(migrated.dispatches[0].dust,3);
  const kept=createProfile(NOW);kept.cleared=9;kept.heroes.queen.owned=true;
  kept.dispatches=[{slot:0,hero:'star_boy',start:NOW+HOUR,end:NOW+HOUR+TUNING.dispatchHours*HOUR,reward:5,dust:1}];
  kept.deck=kept.deck.filter(id=>id!=='star_boy');kept.deck.push('queen');
  assert.equal(parseProfile(JSON.stringify(kept)).dispatches[0].start,NOW+HOUR);
  const legacy=createProfile(NOW);delete legacy.pity;delete legacy.daily.accel;legacy.pity={season:4};
  const filled=parseProfile(JSON.stringify(legacy));assert.ok(filled);
  assert.equal(filled.daily.accel,false);assert.deepEqual(filled.pity,{normal:0,season:4});
});

test('the time-hour tool shifts all waiting timers without changing the clock or receipts',()=>{
  const p=createProfile(NOW);p.cleared=18;p.heroes.queen.owned=true;p.heroes.luna.owned=true;
  for(const [slot,id] of [[0,'queen'],[1,'luna']])assert.ok(command(p,'dispatch',{slot,id},NOW).ok);
  assert.ok(command(p,'requestArrive',{},NOW).arrived.length);
  assert.deepEqual(TEST_TOOLS.find(t=>t.kind==='time-hour'),{kind:'time-hour',label:'시간 1시간 앞으로'});
  const before=structuredClone(p);assert.equal(command(p,'testGrant',{kind:'time-hour'},NOW).ok,false);assert.deepEqual(p,before);
  assert.ok(testGrant(p,'time-hour',NOW));assert.equal(p.clockAt,before.clockAt);assert.deepEqual(p.daily,before.daily);assert.deepEqual(p.beginner,before.beginner);
  assert.equal(p.idleAt,before.idleAt-HOUR);assert.equal(p.basket.at,before.basket.at-HOUR);
  assert.deepEqual(p.dispatches,before.dispatches.map(d=>({...d,start:d.start-HOUR,end:d.end-HOUR})));
  assert.equal(p.requests.next,before.requests.next-HOUR);assert.deepEqual(p.requests.active,before.requests.active.map(r=>({...r,at:r.at-HOUR})));
  assert.ok(validateProfile(p));assert.equal(command(p,'basket',{},NOW).gifts.length,4);
  assert.ok(command(p,'idle',{},NOW).reward>0);assert.ok(command(p,'claimDispatch',{slot:0},NOW).ok);
});

test('the trial-day tool resets dailies and greeting while leaving the sprout board intact',()=>{
  const p=createProfile(NOW),s=storeFor(p);call(s,'pet');call(s,'draw',{banner:'normal',count:1,free:true});
  call(s,'beginnerClaim',{day:1,kind:'login'});const before=structuredClone(s.value);
  assert.ok(testGrant(s.value,'trial-day',NOW));assert.deepEqual(s.value.beginner,before.beginner);
  assert.equal(s.value.daily.day,before.daily.day);assert.equal(s.value.daily.free,false);assert.equal(s.value.petDay,'');
  assert.equal(s.value.clockAt,before.clockAt);assert.ok(validateProfile(s.value));
});

test('a main win lights the album from stage 1 and releases a painting at each boundary',()=>{
  const s=storeFor(createProfile(NOW));
  const settle=won=>{call(s,'begin',{mode:'main',stage:1});return call(s,'settle',{token:s.value.active.token,round:6,won});};
  const loss=settle(false);assert.equal(loss.star,null);assert.equal(loss.dust,20);
  let first=true;
  for(const c of CONSTELLATIONS)for(let stars=1;stars<=c.stars.length;stars++){
    const completed=stars===c.stars.length?c.id:null,r=settle(true);
    assert.deepEqual(r.star,{constellation:c.id,stars,of:c.stars.length,completed});
    assert.equal(r.dust,first?180:60);assert.equal(r.clearReward,first?160:0);first=false;
    assert.equal(s.value.study.library.stars,completed?0:stars);
    if(completed)assert.equal(s.value.study.library.unlocked.at(-1),c.id);
  }
  const library={index:7,stars:0,unlocked:CONSTELLATIONS.map(c=>c.id),day:''};
  assert.equal(settle(true).star,null);assert.deepEqual(parseProfile(s.raw).study,{wrong:[],solved:[],library});
  for(const [field,value] of [['wrong',[{kind:'concept'}]],['solved',['concept:x']],['wrong',{}],['solved',null]]){
    const bad=structuredClone(s.value);bad.study[field]=value;assert.equal(parseProfile(bad),null);
  }
  const bad=structuredClone(s.value);bad.study.library.day=calendar(NOW).day;assert.equal(parseProfile(bad),null);
});

test('paid summons fill the exchange gauge; at the threshold the player picks the companion, and a natural UR never empties it',()=>{
  const step=rng=>{let x=rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0||1;};
  const urStart=TUNING.heroRates[0]+TUNING.heroRates[1]+TUNING.heroRates[2];
  let state=1,urSeed=0;for(let i=0;i<5000000&&!urSeed;i++){const n=step(state);if(n/4294967296>=urStart)urSeed=state;else state=n;}
  assert.ok(urSeed);
  const natural=createProfile(NOW);natural.rng=urSeed;natural.pity.normal=12;natural.dreams=1000;
  const hit=command(natural,'draw',{banner:'normal',count:1},NOW);
  assert.equal(hit.ok,true);assert.equal(HERO[hit.items[0].id].rarity,'UR');assert.equal(natural.pity.normal,13);
  // The gauge only fills: the 200th pull is an ordinary pull.
  const p=createProfile(NOW);p.dreams=100000;p.pity.normal=TUNING.pity.normal-1;
  const one=command(p,'draw',{banner:'normal',count:1},NOW);assert.equal(one.items[0].pity,undefined);assert.equal(p.pity.normal,TUNING.pity.normal);
  assert.equal(command(p,'draw',{banner:'normal',count:1,free:true},NOW).ok,true);assert.equal(p.pity.normal,TUNING.pity.normal,'free pulls do not count');
  // The season exchange uses the guardian of the current window.
  assert.equal(command(p,'pityClaim',{banner:'normal',id:'doom'},NOW).ok,false,'a season guardian is not in the normal pool');
  const pick=command(p,'pityClaim',{banner:'normal',id:'queen'},NOW);
  assert.equal(pick.ok,true);assert.equal(pick.item.id,'queen');assert.equal(pick.item.pity,true);assert.equal(p.heroes.queen.owned,true);assert.equal(p.pity.normal,0);assert.equal(p.history[0].pity,true);
  assert.equal(command(p,'pityClaim',{banner:'normal',id:'queen'},NOW).ok,false,'needs a full gauge again');
  p.pity.season=TUNING.pity.season;const guardian=calendar(NOW).guardian,other=HEROES.find(h=>h.hidden&&h.id!==guardian).id;
  assert.equal(command(p,'pityClaim',{banner:'season',id:other},NOW).ok,false);
  assert.equal(command(p,'pityClaim',{banner:'season',id:guardian},NOW).ok,true);assert.equal(p.pity.season,0);assert.ok(validateProfile(p));
  // The season gauge carries across guardian windows.
  p.pity.season=37;command(p,'draw',{banner:'season',count:1},calendar(NOW).periods.guardian.end);assert.equal(p.pity.season,38);
});

test('paid ten-pulls on every banner have ten percent luck and bonuses leave pity unchanged',()=>{
  for(const banner of ['normal','season','relic']){
    const seeds={rng:0x13579bdf},trials=2000;let wins=0;
    for(let i=0;i<trials;i++){
      random(seeds);const q=createProfile(NOW);q.dreams=100000;q.rng=seeds.rng;q.pity={normal:4,season:7};
      const r=command(q,'draw',{banner,count:10},NOW),cost=10*(banner==='relic'?80:100);
      assert.equal(r.ok,true,r.message);assert.equal(r.items.length,10);assert.equal(r.cost,cost);assert.equal(q.dreams,100000-cost);
      assert.equal(q.daily.free,false);assert.deepEqual(r.pity,{normal:banner==='normal'?14:4,season:banner==='season'?17:7});
      assert.ok(r.items.every(item=>!item.bonus&&!item.pity));assert.equal(r.bonus.length,r.lucky?10:0);
      assert.ok(r.bonus.every(item=>item.bonus===true&&item.banner===banner&&!item.pity&&q.history.includes(item)));
      wins+=Number(r.lucky);
    }
    assert.ok(Math.abs(wins/trials-.1)<.02,`${banner} luck: ${wins}/${trials}`);
  }
  const refused=createProfile(NOW);refused.dreams=100000;
  for(const boost of [true,false])assert.equal(command(refused,'draw',{banner:'normal',count:10,boost},NOW).ok,false);
  assert.equal(refused.daily.free,false);assert.equal(refused.dreams,100000);assert.equal(refused.pity.normal,0);
  for(const [banner,free] of [['relic',false],['relic',true],['normal',true],['normal',false],['season',false]]){
    const single=command(refused,'draw',{banner,count:1,free},NOW);assert.equal(single.ok,true);assert.equal(single.lucky,false);assert.deepEqual(single.bonus,[]);
  }
  assert.deepEqual(refused.pity,{normal:1,season:1});assert.equal(refused.daily.free,true);
});

test('drawing relics during a saved run keeps the snapshotted collection bonus',()=>{
  const s=storeFor(createProfile(NOW));call(s,'begin',{mode:'main',stage:1});
  const run=createBattle(s.value),bonus=run.relicAttack;
  assert.equal(bonus,0);assert.equal(s.value.active.relicAttack,bonus);assert.deepEqual(s.value.active.relicLevels,{});
  E.step(run,.05);assert.equal(s.saveRun(E.serialize(run)),true);
  call(s,'draw',{banner:'relic',count:1});
  assert.ok(collectionBonus(s.value.relics)>bonus);
  const restored=resumeBattle(s.value);assert.ok(restored);
  assert.equal(restored.relicAttack,bonus);assert.deepEqual(restored.relicLevels,run.relicLevels);
});

test('an old active run without a relic snapshot copies the saved run, and bad snapshots are rejected',()=>{
  const p=createProfile(NOW);p.relics.hourglass.owned=true;p.equipped=['hourglass'];
  const s=storeFor(p);call(s,'begin',{mode:'main',stage:1});
  const run=createBattle(s.value);E.step(run,.05);
  const raw=JSON.parse(E.serialize(run));raw.relicAttack=.02;raw.relicLevels={hourglass:4};
  const old=structuredClone(s.value);delete old.active.relicAttack;delete old.active.relicLevels;old.active.run=JSON.stringify(raw);
  old.relics.lens.owned=true;
  const migrated=parseProfile(JSON.stringify(old));assert.ok(migrated);
  assert.notEqual(migrated.active.relicAttack,collectionBonus(migrated.relics));
  assert.equal(migrated.active.relicAttack,.02);assert.deepEqual(migrated.active.relicLevels,{hourglass:4});
  const resumed=resumeBattle(migrated);assert.ok(resumed);assert.equal(resumed.relicAttack,.02);assert.deepEqual(resumed.relicLevels,{hourglass:4});
  const bare=structuredClone(s.value);delete bare.active.relicAttack;delete bare.active.relicLevels;bare.active.run=null;bare.relics.hourglass.enhance=8;
  const filled=parseProfile(JSON.stringify(bare));
  assert.equal(filled.active.relicAttack,collectionBonus(filled.relics));
  assert.deepEqual(filled.active.relicLevels,{hourglass:relicLevel(filled.relics.hourglass)});
  const check=createProfile(NOW);check.relics.hourglass.owned=true;check.equipped=['hourglass'];
  assert.ok(command(check,'begin',{mode:'main',stage:1},NOW).ok);
  check.active.relicAttack=10;assert.equal(validateProfile(check),true);
  check.active.relicAttack=10.1;assert.equal(validateProfile(check),false);
  check.active.relicAttack=-.01;assert.equal(validateProfile(check),false);
  check.active.relicAttack=0;
  check.active.relicLevels={hourglass:0};assert.equal(validateProfile(check),false);
  check.active.relicLevels={hourglass:1.5};assert.equal(validateProfile(check),false);
  check.active.relicLevels={};assert.equal(validateProfile(check),false);
  check.active.relicLevels={hourglass:2,lens:1};assert.equal(validateProfile(check),false);
  check.active.relicLevels={hourglass:2};assert.equal(validateProfile(check),true);
});

test('Behemoth joins the normal UR pool and exchange only after part one, never the guardian rotation',()=>{
  const p=createProfile(NOW);assert.equal(HERO.behemoth.hidden,false);assert.ok(!HIDDEN.includes('behemoth'));
  for(let period=0;period<HIDDEN.length;period++)assert.notEqual(calendar(NOW+period*4*HOUR).guardian,'behemoth');
  assert.ok(!heroPool('UR',false).includes('behemoth'));assert.ok(heroPool('UR',true).includes('behemoth'));
  // Force a normal UR and Behemoth's actual slot; later additions need not leave it last.
  const behemothUr=open=>{const pool=heroPool('UR',open),at=pool.indexOf('behemoth'),rolls=[.999999,at<0?.999999:(at+.5)/pool.length];return drawCharacter(()=>rolls.shift(),false,calendar(NOW).guardian,null,open);};
  assert.notEqual(behemothUr(false),'behemoth');assert.equal(behemothUr(true),'behemoth');
  p.pity.normal=TUNING.pity.normal;p.pity.season=TUNING.pity.season;p.dreams=100000;
  for(const stage of [0,PART_STAGES-1]){
    p.cleared=stage;assert.equal(command(p,'pityClaim',{banner:'normal',id:'behemoth'},NOW).ok,false);
    assert.equal(p.heroes.behemoth.owned,false);assert.equal(p.pity.normal,TUNING.pity.normal,'the gauge is kept');
  }
  const draws=command(p,'draw',{banner:'normal',count:10},NOW);assert.equal(draws.ok,true);assert.ok(!draws.items.some(i=>i.id==='behemoth'));
  p.cleared=PART_STAGES;
  assert.equal(command(p,'pityClaim',{banner:'season',id:'behemoth'},NOW).ok,false);assert.equal(p.pity.season,TUNING.pity.season);
  const late=command(p,'pityClaim',{banner:'normal',id:'behemoth'},NOW);
  assert.equal(late.ok,true);assert.equal(p.heroes.behemoth.owned,true);assert.equal(p.pity.normal,10,'the exchange spends only the normal gauge');
});

test('the part one announcement covers the late companions once: not before its last stage, never twice, old saves get an empty list',()=>{
  const fresh=createProfile(NOW),announced=LATE_COMPANIONS.filter(id=>!HERO[id].hidden);
  assert.deepEqual(lateNoticeIds(fresh),[],'nothing to announce before part one is cleared');
  fresh.cleared=PART_STAGES-1;assert.deepEqual(lateNoticeIds(fresh),[]);
  fresh.cleared=PART_STAGES;assert.deepEqual(lateNoticeIds(fresh),announced,'every non-hidden late companion, including Behemoth');
  assert.deepEqual(announced.slice().sort(),['behemoth','underdog','toffee_apple','joker','sunflower','antropy','cure_master','ash','venom','demon_king','miracle_larva','gold_dragon'].sort());
  assert.equal(command(fresh,'noticeLate',{},NOW).ok,true);
  assert.deepEqual(lateNoticeIds(fresh),[]);assert.deepEqual(fresh.noticeLate.slice().sort(),announced.slice().sort());
  assert.equal(command(fresh,'noticeLate',{},NOW).ok,true);assert.equal(fresh.noticeLate.length,announced.length,'marking twice adds nothing');
  assert.equal(validateProfile(fresh),true);
  // a save from before the announcement has no field: it migrates to an empty list and is told once
  const old=JSON.parse(JSON.stringify(createProfile(NOW)));delete old.noticeLate;old.cleared=60;
  const loaded=parseProfile(JSON.stringify(old));assert.ok(loaded);assert.deepEqual(loaded.noticeLate,[]);assert.deepEqual(lateNoticeIds(loaded),announced);
  // bad data is rejected
  const bad=createProfile(NOW);bad.noticeLate=['no_such_hero'];assert.equal(validateProfile(bad),false);
  const bad2=createProfile(NOW);bad2.noticeLate='all';assert.equal(validateProfile(bad2),false);
});

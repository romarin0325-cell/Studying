import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,HERO,DEFAULT_DECK,ARTIFACT,TUNING} from '../src/content.js';
import {unlockProfile,topUpUnlocked,testGrant} from '../src/test-unlock.js';
import {ProfileStore,SAVE_KEY,createProfile,validateProfile,parseProfile,available,away,command} from '../src/profile.js';
import {monthlyReward,weeklyReward} from '../src/monthly.js';
import {duplicateCost,relicCost,collectionBonus,HOUR,calendar,levelCost,heroMultiplier,combatPower,bedCost,springGauge,seedGold,relicLevel} from '../src/economy.js';
import {createBattle,resumeBattle} from '../src/battle.js';
import * as E from '../src/combat/engine.js';
const NOW=Date.parse('2026-10-04T03:00:00Z');
function memory(p=null){let raw=p?JSON.stringify(p):null;return {fail:false,getItem:()=>raw,setItem(k,v){if(this.fail)throw Error('quota');raw=v;}};}
const storeFor=p=>new ProfileStore(memory(p),NOW);
const call=(s,a,args={},now=NOW)=>{const r=s.transact(a,args,now);assert.ok(r.ok,r.message);return r;};

test('greenhouse beds are shared, unlock at stages 15 and 30, and soft-cap by cost',()=>{
  const p=createProfile(NOW);assert.deepEqual(p.beds,{rose:0,spring:0,seed:0,crit:0,critDamage:0,stardust:0});assert.equal(p.bedRev,4);p.dust=100000;const s=storeFor(p);
  call(s,'bed',{id:'rose'});assert.equal(s.value.beds.rose,1);assert.equal(s.value.dust,100000-bedCost('rose',0));assert.equal(bedCost('rose',0),120);
  for(const id of ['star_boy','queen'])assert.ok(Math.abs(heroMultiplier(s.value.heroes[id],s.value.beds)-1.01)<1e-12);
  assert.ok(combatPower('star_boy',s.value.heroes.star_boy,{rose:2})>combatPower('star_boy',s.value.heroes.star_boy,{rose:1}));
  assert.equal(s.transact('bed',{id:'spring'},NOW).ok,false,'spring is closed before stage 15');
  s.value.cleared=15;call(s,'bed',{id:'spring'});assert.equal(s.transact('bed',{id:'seed'},NOW).ok,false,'seed is closed before stage 30');
  s.value.cleared=30;call(s,'bed',{id:'seed'});assert.deepEqual(s.value.beds,{rose:1,spring:1,seed:1,crit:0,critDamage:0,stardust:0});
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

test('daily missions come from playing, the free summon is once a day, and old missions migrate',()=>{
  const s=storeFor(createProfile(NOW));assert.equal(s.transact('daily',{id:'idle'},NOW).ok,false);
  s.value.idleAt=NOW-3*HOUR;call(s,'idle');assert.equal(s.value.daily.idle,true);const d0=s.value.dreams;call(s,'daily',{id:'idle'});assert.equal(s.value.dreams,d0+30);
  const d1=s.value.dreams;call(s,'draw',{banner:'normal',count:1,free:true});assert.equal(s.value.dreams,d1);assert.equal(s.value.daily.free,true);assert.equal(s.value.history.length,1);
  assert.equal(s.transact('draw',{banner:'normal',count:1,free:true},NOW).ok,false,'one free summon a day');
  assert.equal(storeFor(createProfile(NOW)).transact('draw',{banner:'relic',count:1,free:true},NOW).ok,false,'free summon is the normal banner only');
  call(s,'begin',{mode:'main',stage:1});call(s,'settle',{token:s.value.active.token,won:false,round:0,merges:5});assert.equal(s.value.daily.merges,5);
  call(s,'daily',{id:'merge'});call(s,'daily',{id:'combat'});assert.equal(s.transact('daily',{id:'merge'},NOW).ok,false);
  const old=createProfile(NOW);old.daily={day:old.daily.day,combat:true,draw:true,dispatch:false,claimed:['draw']};
  const migrated=parseProfile(JSON.stringify(old));assert.ok(migrated);
  assert.deepEqual(migrated.daily,{day:old.daily.day,combat:true,merges:0,idle:false,free:false,bouquet:false,accel:false,claimed:[]});
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

test('a dispatch cannot consume the last five battle heroes and has a fixed 24-hour receipt',()=>{
  const p=createProfile(NOW);p.cleared=9;const s=storeFor(p);
  assert.equal(s.transact('dispatch',{slot:0,id:'star_boy'},NOW).ok,false);
  const q=createProfile(NOW);q.cleared=9;q.heroes.queen.owned=true;const extra=storeFor(q);
  call(extra,'dispatch',{slot:0,id:'star_boy'});
  assert.ok(away(extra.value,'star_boy'));assert.equal(extra.value.deck.length,5);assert.ok(!extra.value.deck.includes('star_boy'));
  assert.equal(extra.transact('deck',{ids:DEFAULT_DECK},NOW).ok,false);
  assert.equal(extra.transact('begin',{mode:'main',stage:10,deck:DEFAULT_DECK},NOW).ok,false);
  const d=extra.value.dispatches[0];assert.equal(d.end-d.start,TUNING.dispatchHours*HOUR);
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
  assert.equal(reload.transact('begin',{mode:'weekly'},NOW).ok,false);
  call(reload,'begin',{mode:'weekly'},NOW+7*24*HOUR);
});

test('five owned heroes still give two honest tactical choices on the final draft pick',()=>{
  const p=createProfile(NOW);p.cleared=3;const s=storeFor(p);call(s,'begin',{mode:'weekly',stage:4});
  for(let i=0;i<4;i++)call(s,'draft',{index:0});
  assert.equal(s.value.active.offers[0].id,s.value.active.offers[1].id);
  assert.notEqual(s.value.active.offers[0].boon,s.value.active.offers[1].boon);
  call(s,'draft',{index:1});assert.equal(new Set(s.value.active.deck).size,5);
});

test('failed monthly entry, record save and reward confirmation preserve the wallet and active run',()=>{
  const p=createProfile(NOW);p.cleared=3;const disk=memory(p),s=new ProfileStore(disk,NOW);
  disk.fail=true;assert.equal(s.transact('begin',{mode:'monthly',stage:4},NOW).ok,false);assert.equal(s.value.monthly,null);
  disk.fail=false;call(s,'begin',{mode:'monthly',stage:4});const before=structuredClone(s.value);
  disk.fail=true;assert.equal(s.transact('settle',{token:s.value.active.token,round:2},NOW).ok,false);assert.deepEqual(s.value,before);
  disk.fail=false;call(s,'settle',{token:s.value.active.token,round:2,damage:1200,seconds:32});assert.equal(s.value.dreams,600);
  const token=s.value.monthlyBest.token;disk.fail=true;assert.equal(s.transact('claimMonthly',{token},NOW).ok,false);assert.equal(s.value.monthly,null);assert.equal(s.value.dreams,600);
  disk.fail=false;call(s,'claimMonthly',{token});assert.equal(s.value.dreams,600+monthlyReward({round:2}));
  assert.equal(s.transact('claimMonthly',{token},NOW).ok,false);
  call(s,'begin',{mode:'monthly'},NOW);call(s,'settle',{token:s.value.active.token,round:4});assert.equal(s.value.dreams,600+monthlyReward({round:2}));assert.equal(s.value.monthlyBest.round,4);
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
  assert.equal(p.cleared,0);topUpUnlocked(p);assert.equal(p.cleared,90,'an old test save is raised to stage 90');
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

test('perfect clears pay 100 dreams once on main stages',()=>{
  const old=createProfile(NOW);delete old.perfect;const loaded=parseProfile(JSON.stringify(old));assert.deepEqual(loaded.perfect,[]);
  const s=storeFor(loaded),start=s.value.dreams;
  call(s,'begin',{mode:'main',stage:1});
  const first=call(s,'settle',{token:s.value.active.token,round:6,won:true,perfect:true});
  assert.equal(first.reward,270);assert.equal(first.clearReward,170);assert.equal(first.firstPerfect,true);assert.equal(first.perfect,true);
  assert.equal(s.value.dreams,start+270);assert.deepEqual(s.value.perfect,[1]);assert.equal(s.value.results[0].perfect,true);
  call(s,'begin',{mode:'main',stage:1});
  const again=call(s,'settle',{token:s.value.active.token,round:6,won:true,perfect:true});
  assert.equal(again.reward,0);assert.equal(again.clearReward,0);assert.equal(again.firstPerfect,false);assert.equal(again.perfect,true);
  assert.equal(s.value.dreams,start+270);assert.deepEqual(s.value.perfect,[1]);
  call(s,'begin',{mode:'main',stage:2});
  const plain=call(s,'settle',{token:s.value.active.token,round:6,won:true,perfect:false});
  assert.equal(plain.reward,180);assert.equal(plain.clearReward,180);assert.equal(plain.perfect,false);
  assert.deepEqual(s.value.perfect,[1]);assert.equal(s.value.results[0].perfect,undefined);
  call(s,'begin',{mode:'main',stage:3});
  const both=call(s,'settle',{token:s.value.active.token,round:6,won:true,perfect:true});
  assert.equal(both.clearReward,190);assert.equal(both.reward,290);assert.equal(both.firstPerfect,true);
  assert.deepEqual(s.value.perfect,[1,3]);
  const bad=structuredClone(s.value);
  for(const perfect of [[3,1],[1,1],[0],[4],[1.5]]){bad.perfect=perfect;assert.equal(validateProfile(bad),false,JSON.stringify(perfect));}
  bad.perfect=[1,3];assert.equal(validateProfile(bad),true);
});

test('unlockProfile owns every companion (three below ten hearts to try gifts), every relic, and clears all 90 main stages',()=>{
  const fresh=createProfile(NOW),deck=[...fresh.deck],partner=fresh.partner,relics=structuredClone(fresh.relics);
  const p=unlockProfile(fresh);
  assert.equal(p,fresh);
  assert.ok(HEROES.every(h=>{const e=p.heroes[h.id];return e.owned&&e.bond===({star_boy:6,siren:3,snow_rabbit:8}[h.id]??10)&&e.level===1&&e.enhance===0&&e.copies===0;}));
  assert.equal(p.cleared,90);assert.equal(p.dreams,99999);assert.equal(p.dust,99999);
  assert.deepEqual(p.deck,deck);assert.equal(p.partner,partner);
  assert.ok(Object.entries(p.relics).every(([id,r])=>r.owned&&r.enhance==={C:6,R:4,SR:3,UR:1}[ARTIFACT[id].rarity]&&r.copies>0),'every relic owned at a mid-game level with spare duplicates');
  assert.equal(validateProfile(p),true);
});

test('a 20-hour dispatch migrates onto 24 hours and old dailies gain accel',()=>{
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

test('daily acceleration shifts every running dispatch once and a wrong answer still spends the day',()=>{
  const idle=storeFor(createProfile(NOW));
  assert.equal(idle.transact('accelerate',{correct:true},NOW).ok,false);assert.equal(idle.value.daily.accel,false);
  const late=createProfile(NOW);late.cleared=9;late.heroes.queen.owned=true;const done=storeFor(late);
  call(done,'dispatch',{slot:0,id:'star_boy'});
  assert.equal(done.transact('accelerate',{correct:true},done.value.dispatches[0].end).ok,false);
  assert.equal(done.value.daily.accel,false);
  const wrong=createProfile(NOW);wrong.cleared=9;wrong.heroes.queen.owned=true;const w=storeFor(wrong);
  call(w,'dispatch',{slot:0,id:'star_boy'});const end=w.value.dispatches[0].end,reward=w.value.dispatches[0].reward;
  const miss=call(w,'accelerate',{correct:false});
  assert.equal(miss.shifted,0);assert.equal(miss.hours,undefined);assert.equal(miss.message,'오늘의 가속은 내일 다시 할 수 있습니다.');
  assert.equal(w.value.dispatches[0].end,end);assert.equal(w.value.daily.accel,true);
  assert.equal(w.transact('accelerate',{correct:true},NOW).ok,false);
  const next=call(w,'accelerate',{correct:true},NOW+23*HOUR);
  assert.equal(next.shifted,1);assert.equal(next.hours,4);assert.equal(w.value.dispatches[0].reward,reward);
  assert.equal(w.value.dispatches[0].end,end-HOUR);assert.equal(w.value.dispatches[0].end-w.value.dispatches[0].start,TUNING.dispatchHours*HOUR);
  const p=createProfile(NOW);p.cleared=27;p.heroes.queen.owned=true;p.heroes.luna.owned=true;const s=storeFor(p);
  call(s,'dispatch',{slot:0,id:'star_boy'});
  call(s,'dispatch',{slot:1,id:'queen'},NOW+20*HOUR);
  const [a,b]=s.value.dispatches.map(d=>({end:d.end,reward:d.reward})),when=NOW+22*HOUR;
  const hit=call(s,'accelerate',{correct:true},when);
  assert.equal(hit.shifted,2);assert.equal(hit.hours,4);
  assert.equal(hit.message,'정답입니다. 진행 중인 파견 2건을 최대 4시간 앞당겼습니다.');
  assert.equal(s.value.dispatches[0].end,a.end-Math.min(4*HOUR,a.end-when));
  assert.equal(s.value.dispatches[1].end,b.end-Math.min(4*HOUR,b.end-when));
  assert.equal(s.value.dispatches[0].reward,a.reward);assert.equal(s.value.dispatches[1].reward,b.reward);
  for(const d of s.value.dispatches)assert.equal(d.end-d.start,TUNING.dispatchHours*HOUR);
  assert.equal(s.transact('accelerate',{correct:true},when).ok,false);
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
  // Exchange: any of the six normal URs; the season gauge takes only this month's guardian.
  assert.equal(command(p,'pityClaim',{banner:'normal',id:'doom'},NOW).ok,false,'a season guardian is not in the normal pool');
  const pick=command(p,'pityClaim',{banner:'normal',id:'queen'},NOW);
  assert.equal(pick.ok,true);assert.equal(pick.item.id,'queen');assert.equal(pick.item.pity,true);assert.equal(p.heroes.queen.owned,true);assert.equal(p.pity.normal,0);assert.equal(p.history[0].pity,true);
  assert.equal(command(p,'pityClaim',{banner:'normal',id:'queen'},NOW).ok,false,'needs a full gauge again');
  p.pity.season=TUNING.pity.season;const guardian=calendar(NOW).guardian,other=HEROES.find(h=>h.hidden&&h.id!==guardian).id;
  assert.equal(command(p,'pityClaim',{banner:'season',id:other},NOW).ok,false);
  assert.equal(command(p,'pityClaim',{banner:'season',id:guardian},NOW).ok,true);assert.equal(p.pity.season,0);assert.ok(validateProfile(p));
  // The season gauge carries across months.
  p.pity.season=37;command(p,'draw',{banner:'season',count:1},NOW+40*24*HOUR);assert.equal(p.pity.season,38);
});

test('boost is a doubled-UR 10-pull and may add ten free bonus draws',()=>{
  const [c,r,sr,ur]=TUNING.heroRates,start=c-(ur*2-ur)+r+sr,end=c+r+sr;
  const step=rng=>{let x=rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0||1;};
  let state=1,found=0;for(let i=0;i<5000000&&!found;i++){const n=step(state),value=n/4294967296;if(value>=start&&value<end)found=state;else state=n;}
  assert.ok(found);
  const make=()=>{const q=createProfile(NOW);q.rng=found;q.dreams=100000;q.pity.normal=3;return q;};
  const boosted=make(),plain=make();
  const rb=command(boosted,'draw',{banner:'normal',count:10,boost:true},NOW);
  const rp=command(plain,'draw',{banner:'normal',count:10},NOW);
  assert.equal(rb.ok,true);assert.equal(HERO[rb.items[0].id].rarity,'UR');assert.equal(rb.items[0].pity,undefined);
  assert.equal(HERO[rp.items[0].id].rarity,'SR');assert.deepEqual(rp.bonus,[]);
  assert.equal(boosted.dreams,100000-TUNING.heroDrawCost*10);assert.equal(boosted.pity.normal,13);assert.equal(rb.pity.normal,13);
  assert.equal(boosted.daily.free,false);
  let sawBonus=false,sawNone=false;
  for(let i=0;i<120&&!(sawBonus&&sawNone);i++){
    const q=createProfile(NOW);q.dreams=100000;q.rng=(0x13579bdf+i*997)>>>0||1;q.pity.normal=4;
    const dreams=q.dreams,result=command(q,'draw',{banner:'season',count:10,boost:true},NOW);
    assert.equal(result.ok,true,result.message);assert.equal(result.items.length,10);assert.equal(q.dreams,dreams-TUNING.heroDrawCost*10);
    assert.equal(q.daily.free,false);assert.equal(q.pity.season,10);assert.equal(q.pity.normal,4);assert.equal(result.items.some(item=>item.bonus),false);
    if(result.bonus.length){sawBonus=true;assert.equal(result.bonus.length,10);assert.ok(result.bonus.every(item=>item.bonus===true&&item.banner==='season'&&item.pity===undefined&&q.history.includes(item)));assert.equal(q.pity.season,10);}
    else{sawNone=true;assert.deepEqual(result.bonus,[]);}
  }
  assert.ok(sawBonus&&sawNone);
  const refused=createProfile(NOW);refused.dreams=100000;
  assert.equal(command(refused,'draw',{banner:'normal',count:1,boost:true},NOW).ok,false);
  assert.equal(command(refused,'draw',{banner:'relic',count:10,boost:true},NOW).ok,false);
  assert.equal(command(refused,'draw',{banner:'normal',count:1,free:true,boost:true},NOW).ok,false);
  assert.equal(refused.daily.free,false);assert.equal(refused.dreams,100000);assert.equal(refused.pity.normal,0);
  const relic=command(refused,'draw',{banner:'relic',count:1},NOW);assert.equal(relic.pity.normal,0);assert.deepEqual(relic.bonus,[]);
  const free=command(refused,'draw',{banner:'normal',count:1,free:true},NOW);assert.equal(free.ok,true);assert.equal(refused.pity.normal,0);assert.equal(refused.daily.free,true);
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

test('Behemoth cannot be exchanged for before stage 45 in its guardian month, and can after',()=>{
  const JAN=Date.UTC(2027,0,15,3);
  const p=createProfile(JAN);assert.equal(calendar(JAN).guardian,'behemoth');
  p.pity.season=TUNING.pity.season;p.dreams=100000;
  const early=command(p,'pityClaim',{banner:'season',id:'behemoth'},JAN);
  assert.equal(early.ok,false);assert.match(early.message,/스테이지 45/);assert.equal(p.heroes.behemoth.owned,false);assert.equal(p.pity.season,TUNING.pity.season,'the gauge is kept');
  p.cleared=44;assert.equal(command(p,'pityClaim',{banner:'season',id:'behemoth'},JAN).ok,false);
  // A season pull in that month never hands out Behemoth before 45 (it falls back to the normal URs).
  const draws=command(p,'draw',{banner:'season',count:10},JAN);assert.equal(draws.ok,true);assert.ok(!draws.items.some(i=>i.id==='behemoth'));
  p.cleared=45;
  const late=command(p,'pityClaim',{banner:'season',id:'behemoth'},JAN);
  assert.equal(late.ok,true);assert.equal(p.heroes.behemoth.owned,true);assert.equal(p.pity.season,10,'200 spent, the 10 pulls above stay');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,DEFAULT_DECK} from '../src/content.js';
import {unlockProfile} from '../src/test-unlock.js';
import {ProfileStore,SAVE_KEY,createProfile,validateProfile,parseProfile,available,away} from '../src/profile.js';
import {duplicateCost,HOUR,calendar,levelCost,heroMultiplier,combatPower,bedCost,springGauge,seedGold} from '../src/economy.js';
import {createBattle,resumeBattle} from '../src/battle.js';
import * as E from '../src/combat/engine.js';
const NOW=Date.parse('2026-10-04T03:00:00Z');
function memory(p=null){let raw=p?JSON.stringify(p):null;return {fail:false,getItem:()=>raw,setItem(k,v){if(this.fail)throw Error('quota');raw=v;}};}
const storeFor=p=>new ProfileStore(memory(p),NOW);
const call=(s,a,args={},now=NOW)=>{const r=s.transact(a,args,now);assert.ok(r.ok,r.message);return r;};

test('greenhouse beds are shared, unlock at stages 15 and 30, and soft-cap by cost',()=>{
  const p=createProfile(NOW);assert.deepEqual(p.beds,{rose:0,spring:0,seed:0});assert.equal(p.bedRev,2);p.dust=100000;const s=storeFor(p);
  call(s,'bed',{id:'rose'});assert.equal(s.value.beds.rose,1);assert.equal(s.value.dust,100000-bedCost('rose',0));assert.equal(bedCost('rose',0),40);
  for(const id of ['star_boy','queen'])assert.ok(Math.abs(heroMultiplier(s.value.heroes[id],s.value.beds)-1.01)<1e-12);
  assert.ok(combatPower('star_boy',s.value.heroes.star_boy,{rose:2})>combatPower('star_boy',s.value.heroes.star_boy,{rose:1}));
  assert.equal(s.transact('bed',{id:'spring'},NOW).ok,false,'spring is closed before stage 15');
  s.value.cleared=15;call(s,'bed',{id:'spring'});assert.equal(s.transact('bed',{id:'seed'},NOW).ok,false,'seed is closed before stage 30');
  s.value.cleared=30;call(s,'bed',{id:'seed'});assert.deepEqual(s.value.beds,{rose:1,spring:1,seed:1});
  assert.equal(s.transact('bed',{id:'moon'},NOW).ok,false);
  // Soft caps: the cost step jumps after each knee, and no level is refused for being high.
  for(const [id,knee] of [['rose',30],['rose',40],['spring',10],['seed',10]]){
    const before=bedCost(id,knee-1)/bedCost(id,knee-2),after=bedCost(id,knee+1)/bedCost(id,knee);assert.ok(after>before+.05,id);
    assert.ok(Number.isSafeInteger(bedCost(id,60)),id);
  }
  assert.equal(springGauge(0),120);assert.equal(springGauge(10),150);assert.equal(springGauge(15),155);
  assert.equal(seedGold(10),40);assert.equal(seedGold(15),50);
  s.value.dust=0;assert.equal(s.transact('bed',{id:'rose'},NOW).ok,false);
  // Rose pacing: Lv.30 stays affordable, Lv.40 is a goal, beyond that each level climbs sharply.
  const cum=n=>Array.from({length:n},(_,i)=>bedCost('rose',i)).reduce((a,b)=>a+b,0);assert.ok(cum(30)<4000&&cum(40)<10000&&cum(45)>18000);
  // Old saves: 18×1.14^(L-1) spent on star_boy Lv.5 and snow_rabbit Lv.3 is 129 dust → garden 2 + 39 refund → rose 4.
  const old=createProfile(NOW);delete old.beds;delete old.bedRev;old.dust=0;old.heroes.star_boy.level=5;old.heroes.snow_rabbit.level=3;
  const migrated=parseProfile(JSON.stringify(old));assert.ok(migrated);
  assert.deepEqual(migrated.beds,{rose:4,spring:0,seed:0});assert.equal(migrated.bedRev,2);assert.equal(migrated.garden,undefined);assert.equal(migrated.dust,39);assert.ok(HEROES.every(h=>migrated.heroes[h.id].level===1));
  assert.equal(levelCost(1),90);
  assert.deepEqual(parseProfile(JSON.stringify(migrated)),migrated);
  // Saves keep their exact power: garden L (+4% each) becomes rose 4(L-1); a revision-1 rose (+2%) doubles.
  const garden=createProfile(NOW);delete garden.beds;delete garden.bedRev;garden.garden=11;const moved=parseProfile(JSON.stringify(garden));
  assert.equal(moved.beds.rose,40);assert.ok(Math.abs(heroMultiplier(moved.heroes.star_boy,moved.beds)-1.4)<1e-12);
  const rev1=createProfile(NOW);delete rev1.bedRev;rev1.beds={rose:20,spring:3,seed:0};const doubled=parseProfile(JSON.stringify(rev1));
  assert.deepEqual(doubled.beds,{rose:40,spring:3,seed:0});assert.ok(Math.abs(heroMultiplier(doubled.heroes.star_boy,doubled.beds)-1.4)<1e-12);
  for(const bad of [{rose:-1,spring:0,seed:0},{rose:0,spring:0},{rose:0,spring:0,seed:0,moon:1},null]){const b=structuredClone(migrated);b.beds=bad;assert.equal(validateProfile(b),false);}
});

test('spring and seed shape a new run: starlight ceiling and starting gold',()=>{
  const p=createProfile(NOW);p.beds={rose:0,spring:12,seed:12};const s=storeFor(p);call(s,'begin',{mode:'main',stage:1});
  const run=createBattle(s.value);assert.equal(run.gaugeMax,springGauge(12));assert.equal(run.gold,70+seedGold(12));
  run.gauge=run.gaugeMax-1;E.step(run,.05);assert.ok(run.gauge<=run.gaugeMax);
  const restored=E.restore(E.serialize(run));assert.ok(restored);assert.equal(restored.gaugeMax,152);
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
  assert.deepEqual(migrated.daily,{day:old.daily.day,combat:true,merges:0,idle:false,free:false,claimed:[]});
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
  call(s,'enhance',{kind:'relic',id:'hourglass'});assert.equal(s.value.relics.hourglass.copies,2);
  assert.equal(s.value.equipped.length,0);call(s,'equip',{id:'hourglass'});assert.deepEqual(s.value.equipped,['hourglass']);
});

test('a dispatch cannot consume the last five battle heroes and has a fixed 20-hour receipt',()=>{
  const p=createProfile(NOW);p.cleared=9;const s=storeFor(p);
  assert.equal(s.transact('dispatch',{slot:0,id:'star_boy'},NOW).ok,false);
  const q=createProfile(NOW);q.cleared=9;q.heroes.queen.owned=true;const extra=storeFor(q);
  call(extra,'dispatch',{slot:0,id:'star_boy'});
  assert.ok(away(extra.value,'star_boy'));assert.equal(extra.value.deck.length,5);assert.ok(!extra.value.deck.includes('star_boy'));
  assert.equal(extra.transact('deck',{ids:DEFAULT_DECK},NOW).ok,false);
  assert.equal(extra.transact('begin',{mode:'main',stage:10,deck:DEFAULT_DECK},NOW).ok,false);
  const d=extra.value.dispatches[0];assert.equal(d.end-d.start,20*HOUR);
  assert.ok(d.dust>d.reward&&d.reward>=1,'dust is the main dispatch reward');
  call(extra,'bed',{id:'rose'});assert.equal(extra.value.dispatches[0].reward,d.reward);assert.equal(extra.value.dispatches[0].dust,d.dust);
  assert.equal(extra.transact('claimDispatch',{slot:0},d.end-1).ok,false);
  const before=extra.value.dreams,dust=extra.value.dust;call(extra,'claimDispatch',{slot:0},d.end);
  assert.equal(extra.value.dreams,before+d.reward);assert.equal(extra.value.dust,dust+d.dust);assert.ok(available(extra.value).includes('star_boy'));
  assert.equal(extra.transact('claimDispatch',{slot:0},d.end).ok,false);
});

test('a dispatch sent before dust rewards still validates and pays its promised crystals',()=>{
  const p=createProfile(NOW);p.cleared=9;p.heroes.queen.owned=true;
  p.dispatches=[{slot:0,hero:'star_boy',start:NOW,end:NOW+20*HOUR,reward:77}];p.deck=p.deck.filter(id=>id!=='star_boy');p.deck.push('queen');
  assert.ok(validateProfile(p));const s=storeFor(p),dreams=s.value.dreams,dust=s.value.dust;
  call(s,'claimDispatch',{slot:0},NOW+20*HOUR);assert.equal(s.value.dreams,dreams+77);assert.equal(s.value.dust,dust);
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
  const token=reload.value.active.token;call(reload,'settle',{token,round:3,won:false});assert.equal(reload.value.dreams,900);
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
  disk.fail=false;call(s,'claimMonthly',{token});assert.equal(s.value.dreams,850);
  assert.equal(s.transact('claimMonthly',{token},NOW).ok,false);
  call(s,'begin',{mode:'monthly'},NOW);call(s,'settle',{token:s.value.active.token,round:4});assert.equal(s.value.dreams,850);assert.equal(s.value.monthlyBest.round,4);
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

test('unlockProfile owns every companion at bond 10 and clears main stages through 45',()=>{
  const fresh=createProfile(NOW),deck=[...fresh.deck],partner=fresh.partner,relics=structuredClone(fresh.relics);
  const p=unlockProfile(fresh);
  assert.equal(p,fresh);
  assert.ok(HEROES.every(h=>{const e=p.heroes[h.id];return e.owned&&e.bond===10&&e.level===1&&e.enhance===0&&e.copies===0;}));
  assert.equal(p.cleared,45);assert.equal(p.dreams,99999);assert.equal(p.dust,99999);
  assert.deepEqual(p.deck,deck);assert.equal(p.partner,partner);assert.deepEqual(p.relics,relics);
  assert.equal(validateProfile(p),true);
});

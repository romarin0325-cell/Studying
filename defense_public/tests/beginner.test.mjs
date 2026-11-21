import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfile,parseProfile,validateProfile,command,random} from '../src/profile.js';
import {BEGINNER_DAYS,beginnerState,featureOpen,newlyOpened,ftueNext,urChoices} from '../src/beginner.js';
import {drawRelic,drawCharacter,calendar,lateOpen,combatPower,POWER_RARITY,HOUR} from '../src/economy.js';
import {HERO,HEROES,ARTIFACTS} from '../src/content.js';
import {activeEvent,eventOpen,eventWindow,nextEvent,season} from '../src/preview/season.js';
import {autoDeck,autoRelics,autoTwin,oathDeck,ROLE_FLOOR} from '../src/auto-team.js';
import {POWER_FACTOR} from '../src/power-factor.js';
import {ROLES,ROLE_NEEDS,hasRole} from '../src/roles.js';
import {unlockProfile} from '../src/test-unlock.js';
import {oathDeckProblem} from '../src/preview/oath.js';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const now=Date.UTC(2026,10,9),day=24*HOUR;
test('new and legacy saves migrate, and invalid beginner shapes are rejected',()=>{
  for(const legacy of [false,true]){const p=createProfile(now);p.cleared=legacy?3:2;for(const k of ['ftue','beginner','firstTen','eventSeen','eventFlip','trial'])delete p[k];const q=parseProfile(p);assert.equal(q.ftue.legacy,legacy);assert.equal(q.firstTen,legacy);assert.equal(q.beginner===null,legacy);}
  const p=createProfile(now);for(const mutate of [q=>q.ftue.done.push('bad'),q=>q.ftue.seen.push('garden','garden'),q=>q.beginner.did.push('bad'),q=>q.beginner.claimed.push(8),q=>q.beginner.count=0,q=>q.eventSeen='x'.repeat(13),q=>q.trial=true,q=>q.beginner.choice='star_boy']){const q=structuredClone(p);mutate(q);assert.equal(validateProfile(q),false);}
});
test('unlock notices, tutorial and a sprout step unlocked only by the previous task claim',()=>{
  const p=createProfile(now);assert.equal(ftueNext(p),'lobby');assert.equal(featureOpen(p,'unknown'),true);p.cleared=2;assert.deepEqual(newlyOpened(p),['garden']);assert.equal(command(p,'ftue',{done:'lobby',seen:'garden'},now).ok,true);assert.equal(ftueNext(p),'prepare');assert.deepEqual(newlyOpened(p),[]);
  assert.equal(command(p,'beginnerClaim',{day:2,kind:'login'},now).ok,false);assert.equal(command(p,'beginnerClaim',{day:1,kind:'login'},now).ok,true);assert.equal(command(p,'beginnerClaim',{day:1,kind:'login'},now).ok,false);
  const later=now+10*day;command(p,'tick',{},later);assert.equal(p.beginner.count,1);assert.equal(beginnerState(p).days[1].unlocked,false);
  assert.deepEqual(command(p,'beginnerClaim',{day:1,kind:'task'},later).reward,{dreams:100});assert.equal(p.beginner.count,2);
  assert.equal(beginnerState(p).count,2);assert.equal(beginnerState(p).days[1].login.claimable,true);
  command(p,'ftue',{skip:true},later);assert.equal(ftueNext(p),null);
});
test('task flags only follow successful actions and every claim closes the board',()=>{
  const p=createProfile(now);p.cleared=20;p.dreams=10000;p.dust=10000;p.gifts.candy=1;
  const claim=(day,kind,choice)=>command(p,'beginnerClaim',{day,kind,choice},now);
  assert.equal(command(p,'gift',{id:'missing',gift:'candy'},now).ok,false);assert.deepEqual(p.beginner.did,[]);
  assert.equal(command(p,'pet',{},now).ok,true);assert.equal(command(p,'bed',{id:'rose'},now).ok,true);assert.equal(command(p,'gift',{id:p.partner,gift:'candy'},now).ok,true);assert.equal(command(p,'draw',{banner:'relic',count:1},now).ok,true);assert.deepEqual(p.beginner.did,['greet','water','gift','relic']);
  assert.deepEqual(BEGINNER_DAYS.map(d=>[d.login,!!d.big,d.task.id,d.task.reward.dreams]),[
    [{dreams:500},false,'clear1',100],[{dreams:2000},true,'greet',100],[{dust:1000},false,'water',100],
    [{dreams:300,bouquet:2},false,'gift',100],[{dreams:800},false,'relic',100],[{dust:1500},false,'clear21',200],[{choice:'UR'},true,'draft',200]
  ]);
  for(let day=1;day<=5;day++){assert.equal(claim(day,'login').ok,true);assert.equal(claim(day,'task').ok,true);}
  const choice=urChoices(p)[0].id;p.heroes[choice].owned=true;const copies=p.heroes[choice].copies;
  assert.equal(claim(6,'login').ok,true);assert.equal(claim(6,'task').ok,false);assert.equal(claim(7,'login',choice).ok,false);
  assert.equal(command(p,'begin',{mode:'main',stage:21},now).ok,true);assert.equal(command(p,'settle',{token:p.active.token,round:6,won:true},now).ok,true);
  assert.equal(claim(7,'login',choice).ok,false);assert.equal(claim(6,'task').ok,true);assert.equal(beginnerState(p).count,7);
  assert.equal(claim(7,'login','star_boy').ok,false);assert.deepEqual(claim(7,'login',choice).hero,{id:choice,fresh:false});assert.equal(p.heroes[choice].copies,copies+1);assert.equal(beginnerState(p).choice,choice);
  assert.equal(claim(7,'task').ok,false);assert.equal(command(p,'begin',{mode:'weekly'},now).ok,true);
  for(let i=0;i<p.deck.length;i++)assert.equal(command(p,'draft',{index:0},now).ok,true);
  assert.equal(beginnerState(p).days[6].task.done,false);assert.equal(command(p,'settle',{token:p.active.token,round:1,won:false},now).ok,true);
  assert.ok(p.beginner.did.includes('draft'));assert.equal(claim(7,'task').ok,true);assert.equal(p.beginner.closed,true);assert.equal(beginnerState(p).active,false);assert.ok(parseProfile(p));
});
test('first ten is free, uses the same hero rates, and preserves pity without luck',()=>{
  const c=calendar(now);let plainTen=false;
  for(let seed=1;seed<=200;seed++){
    const p=createProfile(now);p.rng=seed;p.pity.normal=7;const q={rng:seed};
    const expect=Array.from({length:10},()=>drawCharacter(()=>random(q),false,c.guardian,c.pickup,lateOpen(p.cleared)));
    const r=command(p,'draw',{banner:'normal',count:10,first:true},now);assert.equal(r.cost,0);assert.equal(p.dreams,600);assert.equal(p.pity.normal,7);
    assert.deepEqual(r.items.map(x=>x.id),expect);assert.equal(p.rng,q.rng);assert.equal(r.lucky,false);assert.deepEqual(r.bonus,[]);
    assert.ok(r.items.every(x=>x.first));assert.equal(command(p,'draw',{banner:'normal',count:10,first:true},now).ok,false);
    plainTen||=r.items.every(x=>['C','R'].includes(HERO[x.id].rarity));
  }
  assert.ok(plainTen);
});
test('relic luck retains ordinary pull RNG and can award bonus pulls',()=>{
  let bonus=false;for(let seed=1;seed<=100;seed++){const p=createProfile(now);p.dreams=100000;p.rng=seed;const q={rng:seed};let draws=p.relicDraws;const pull=()=>drawRelic(()=>random(q),draws++),expected=Array.from({length:10},pull),lucky=random(q)<.1;
    const r=command(p,'draw',{banner:'relic',count:10},now);assert.deepEqual(r.items.map(x=>x.id),expected);assert.equal(r.lucky,lucky);
    assert.deepEqual(r.bonus.map(x=>x.id),lucky?Array.from({length:10},pull):[]);assert.equal(p.rng,q.rng);assert.equal(p.relicDraws,draws);bonus||=lucky;
  }assert.ok(bonus);
});
test('paid hero draws keep their ten-pull RNG sequence before testing luck',()=>{
  for(const banner of ['normal','season'])for(let seed=1;seed<=40;seed++){
    const p=createProfile(now);p.dreams=100000;p.rng=seed;const q={rng:seed},c=calendar(now),pull=()=>drawCharacter(()=>random(q),banner==='season',c.guardian,c.pickup,lateOpen(p.cleared));
    const expected=Array.from({length:10},pull),lucky=random(q)<.1,result=command(p,'draw',{banner,count:10},now);
    assert.deepEqual(result.items.map(x=>x.id),expected);assert.equal(result.lucky,lucky);assert.deepEqual(result.bonus.map(x=>x.id),lucky?Array.from({length:10},pull):[]);assert.equal(p.rng,q.rng);
  }
});
test('four-hour events always alternate and inactive entries are rejected',()=>{
  const start=Date.parse('2026-11-08T15:00:00Z');
  const span=4*HOUR,twin=start+span,next=twin+span,index=(start+9*HOUR)/span;
  assert.equal(activeEvent(start-1),'twin');assert.equal(activeEvent(start),'oath');assert.equal(activeEvent(twin),'twin');assert.equal(activeEvent(next),'oath');
  assert.equal(activeEvent(start,true),'twin');assert.equal(activeEvent(twin,true),'oath');assert.equal(eventOpen('twin',start),false);assert.equal(eventOpen('both',start),false);
  assert.deepEqual(eventWindow(start),{index,id:`W${index}`,start,end:twin,msLeft:span});assert.equal(eventWindow(twin-1).msLeft,1);
  assert.deepEqual(eventWindow(twin),{index:index+1,id:`W${index+1}`,start:twin,end:next,msLeft:span});
  assert.deepEqual(nextEvent(start+HOUR),{kind:'twin',start:twin});assert.deepEqual(nextEvent(twin+HOUR),{kind:'oath',start:next});
  const p=unlockProfile(createProfile(start));assert.match(command(p,'begin',{mode:'twin'},start).message,/이벤트/);assert.equal(command(p,'begin',{mode:'oath',oaths:[]},start).ok,true);const token=p.active.token;assert.ok(parseProfile(p).active);
  assert.equal(command(p,'settle',{token,round:9,won:true},twin).ok,true);assert.match(command(p,'begin',{mode:'oath',oaths:[]},twin).message,/이벤트/);assert.equal(p.oath.period,season(twin).id);assert.equal(command(p,'twinParty',autoTwin(p),twin).ok,true);assert.equal(command(p,'begin',{mode:'twin',side:'left'},twin).ok,true);
});
test('unlocked trial stays a new profile on load and supports test tools',async()=>{
  const src=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src'),result=await build({stdin:{contents:"export {createProfile,validateProfile,command,ProfileStore} from './profile.js';",resolveDir:src},bundle:true,write:false,format:'cjs',platform:'node',define:{__GARDEN_UNLOCKED__:'true'}}),compiled={exports:{}};runInNewContext(result.outputFiles[0].text,{module:compiled,structuredClone});const api=compiled.exports,p=api.createProfile(now,{trial:true});assert.equal(p.trial,true);assert.equal(p.cleared,0);assert.equal(api.validateProfile(p),true);
  const storage={getItem:()=>JSON.stringify(p)},store=new api.ProfileStore(storage,now);assert.equal(store.value.cleared,0);
  const q=store.value;api.command(q,'pet',{},now);api.command(q,'beginnerClaim',{day:1,kind:'login'},now);const sprout=JSON.stringify(q.beginner);
  q.daily.free=true;assert.equal(api.command(q,'testGrant',{kind:'trial-day'},now).ok,true);assert.equal(JSON.stringify(q.beginner),sprout);assert.equal(q.daily.free,false);assert.equal(q.petDay,'');
  assert.equal(api.command(q,'testGrant',{kind:'time-hour'},now).ok,true);assert.equal(q.idleAt,now-HOUR);assert.equal(api.validateProfile(q),true);
  assert.equal(api.command(q,'testGrant',{kind:'event-flip'},now).ok,true);assert.equal(q.eventFlip,true);assert.equal(api.command(q,'testGrant',{kind:'ftue-reset'},now).ok,true);
});
test('combat power is one formula; auto formation fills the team roles, then takes power, and keeps equals',()=>{
  const p=createProfile(now),entry=e=>({owned:true,enhance:e});
  for(const [id,e] of Object.entries(p.heroes)){e.owned=HERO[id].rarity!=='UR'||['zeke','luna','jasmine','rumi','venom','cherry_prince'].includes(id);e.enhance={C:8,R:6,SR:2,UR:0}[HERO[id].rarity];}
  assert.deepEqual(POWER_RARITY,{C:1,R:1.2,SR:1.4,UR:1.9});
  // Combat power = 500 x rarity x overall factor x growth. Factors are rough grades with mean 1 inside each rarity.
  for(const h of HEROES){assert.ok(POWER_FACTOR[h.id]>=.8&&POWER_FACTOR[h.id]<=1.2,h.id);assert.ok(Array.isArray(ROLES[h.id]),h.id);}
  for(const r of ['C','R','SR','UR']){const xs=HEROES.filter(h=>h.rarity===r).map(h=>POWER_FACTOR[h.id]);assert.ok(Math.abs(xs.reduce((a,b)=>a+b,0)/xs.length-1)<=.03,r);}
  assert.equal(combatPower('zeke',entry(0)),Math.round(950*POWER_FACTOR.zeke));assert.equal(combatPower('star_boy',entry(0)),Math.round(500*POWER_FACTOR.star_boy));
  // Growth multiplies every companion alike (+8 commons: 735 at factor 1).
  for(const id of ['star_boy','snow_rabbit','siren'])assert.ok(Math.abs(combatPower(id,entry(8))-735*POWER_FACTOR[id])<=1,id);
  // Every role the team needs is covered when an available companion of that role is strong enough.
  const power=id=>combatPower(id,p.heroes[id],p.beds),owned=HEROES.filter(h=>p.heroes[h.id].owned).map(h=>h.id).sort((a,b)=>power(b)-power(a)),floor=ROLE_FLOOR*power(owned[4]),deck=autoDeck(p);
  assert.equal(new Set(deck).size,5);
  for(const role of ROLE_NEEDS)if(owned.some(id=>hasRole(id,role)&&power(id)>=floor))assert.ok(deck.some(id=>hasRole(id,role)),role);
  // A weak companion is never forced in for a role: everything picked is at least the floor.
  assert.ok(deck.every(id=>power(id)>=floor));
  // Without role gaps the pick is combat power order: five strikers with area attacks and nothing else to fill.
  const two=createProfile(now);for(const e of Object.values(two.heroes))e.owned=false;for(const id of ['zeke','luna','cherry_prince','venom','cinderella','star_boy'])two.heroes[id].owned=true;
  assert.equal(autoDeck(two).includes('star_boy'),false);
  // A pick that already matches the team never swaps anyone.
  p.deck=[...deck].reverse();assert.deepEqual([...autoDeck(p)].sort(),[...p.deck].sort());
  const fresh=createProfile(now);assert.deepEqual([...autoDeck(fresh)].sort(),[...fresh.deck].sort());
});
test('auto formation respects ownership, dispatch, rarity and oath constraints',()=>{
  const p=unlockProfile(createProfile(now));const ids=autoDeck(p,{size:10});assert.equal(ids.length,10);assert.equal(autoDeck(p,{exclude:[ids[0]]}).includes(ids[0]),false);p.dispatches=[{hero:ids[0]}];assert.equal(autoDeck(p).includes(ids[0]),false);assert.equal(autoDeck(p,{allow:id=>HERO[id].rarity==='C'}).every(id=>HERO[id].rarity==='C'),true);
  const twin=autoTwin(p);assert.equal(new Set([...twin.left.deck,...twin.right.deck]).size,10);assert.equal(new Set([...twin.left.relics,...twin.right.relics]).size,6);assert.equal(autoRelics(p).length,3);
  for(const rules of [['lowstar'],['crownless','nobeam','shapes'],['rabbits','shapes']]){const deck=oathDeck(p,rules);assert.ok(deck);assert.equal(oathDeckProblem(rules,deck),'');}p.heroes.night_rabbit.owned=false;assert.equal(oathDeck(p,['rabbits']),null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfile,parseProfile,validateProfile,command,random} from '../src/profile.js';
import {BEGINNER_DAYS,beginnerState,featureOpen,newlyOpened,ftueNext,urChoices} from '../src/beginner.js';
import {drawRelic,drawCharacter,calendar,lateOpen,combatPower,POWER_RARITY} from '../src/economy.js';
import {HERO,HEROES,ARTIFACTS} from '../src/content.js';
import {activeEvent,eventOpen,eventWindow,nextEvent,season,EVENT_ROTATION_START} from '../src/preview/season.js';
import {autoDeck,autoRelics,autoTwin,oathDeck} from '../src/auto-team.js';
import {unlockProfile} from '../src/test-unlock.js';
import {oathDeckProblem} from '../src/preview/oath.js';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const now=Date.UTC(2026,10,9),day=86400000;
test('new and legacy saves migrate, and invalid beginner shapes are rejected',()=>{
  for(const legacy of [false,true]){const p=createProfile(now);p.cleared=legacy?3:2;for(const k of ['ftue','beginner','firstTen','eventSeen','eventFlip','trial'])delete p[k];const q=parseProfile(p);assert.equal(q.ftue.legacy,legacy);assert.equal(q.firstTen,legacy);assert.equal(q.beginner===null,legacy);}
  const p=createProfile(now);for(const mutate of [q=>q.ftue.done.push('bad'),q=>q.ftue.seen.push('garden','garden'),q=>q.beginner.did.push('bad'),q=>q.beginner.claimed.push(8),q=>q.beginner.count=0,q=>q.eventSeen='x'.repeat(13),q=>q.trial=true,q=>q.beginner.choice='star_boy']){const q=structuredClone(p);mutate(q);assert.equal(validateProfile(q),false);}
});
test('unlock notices, tutorial and cumulative login claims',()=>{
  const p=createProfile(now);assert.equal(ftueNext(p),'lobby');assert.equal(featureOpen(p,'unknown'),true);p.cleared=2;assert.deepEqual(newlyOpened(p),['garden']);assert.equal(command(p,'ftue',{done:'lobby',seen:'garden'},now).ok,true);assert.equal(ftueNext(p),'prepare');assert.deepEqual(newlyOpened(p),[]);
  assert.equal(command(p,'beginnerClaim',{day:2,kind:'login'},now).ok,false);assert.equal(command(p,'beginnerClaim',{day:1,kind:'login'},now).ok,true);assert.equal(command(p,'beginnerClaim',{day:1,kind:'login'},now).ok,false);
  command(p,'tick',{},now+10*day);assert.equal(p.beginner.count,2);for(let i=11;i<=18;i++)command(p,'tick',{},now+i*day);assert.equal(p.beginner.count,7);
  const choice=urChoices(p)[0].id;p.heroes[choice].owned=true;const copies=p.heroes[choice].copies;assert.equal(command(p,'beginnerClaim',{day:7,kind:'login',choice:'star_boy'},now+18*day).ok,false);const result=command(p,'beginnerClaim',{day:7,kind:'login',choice},now+18*day);assert.deepEqual(result.hero,{id:choice,fresh:false});assert.equal(p.heroes[choice].copies,copies+1);assert.equal(beginnerState(p).choice,choice);
  command(p,'ftue',{skip:true},now+18*day);assert.equal(ftueNext(p),null);
});
test('task flags only follow successful actions and every claim closes the board',()=>{
  const p=createProfile(now);p.cleared=12;p.dreams=10000;p.dust=10000;p.gifts.candy=1;
  assert.equal(command(p,'pet',{},now).ok,true);assert.equal(command(p,'bed',{id:'rose'},now).ok,true);assert.equal(command(p,'gift',{id:p.partner,gift:'candy'},now).ok,true);assert.equal(command(p,'draw',{banner:'relic',count:1},now).ok,true);assert.deepEqual(p.beginner.did,['greet','water','gift','relic']);
  for(let i=1;i<=6;i++)command(p,'tick',{},now+i*day);for(const d of BEGINNER_DAYS){assert.equal(command(p,'beginnerClaim',{day:d.day,kind:'task'},now+6*day).ok,true);assert.equal(command(p,'beginnerClaim',{day:d.day,kind:'login',choice:urChoices(p)[0].id},now+6*day).ok,true);}assert.equal(p.beginner.closed,true);assert.equal(beginnerState(p).active,false);
});
test('first ten is free, preserves pity and guarantees SR or better for many seeds',()=>{
  for(let seed=1;seed<=200;seed++){const p=createProfile(now);p.rng=seed;p.pity.normal=7;const r=command(p,'draw',{banner:'normal',count:10,first:true},now);assert.equal(r.cost,0);assert.equal(p.dreams,600);assert.equal(p.pity.normal,7);assert.ok(r.items.some(x=>['SR','UR'].includes(HERO[x.id].rarity)));assert.ok(r.items.every(x=>x.first));assert.equal(command(p,'draw',{banner:'normal',count:10,first:true},now).ok,false);}
});
test('relic boost retains ordinary pull RNG and can award bonus pulls',()=>{
  let bonus=false;for(let seed=1;seed<=100;seed++){const p=createProfile(now);p.dreams=100000;p.rng=seed;const q=structuredClone(p),expected=Array.from({length:10},()=>{const id=drawRelic(()=>random(q),q.relicDraws);q.relicDraws++;return id;});const r=command(p,'draw',{banner:'relic',count:10,boost:true},now);assert.deepEqual(r.items.map(x=>x.id),expected);if(r.bonus.length)bonus=true;}assert.ok(bonus);
});
test('ordinary hero draws keep their existing random sequence',()=>{
  for(let seed=1;seed<=40;seed++){const p=createProfile(now);p.dreams=100000;p.rng=seed;const q=structuredClone(p),c=calendar(now),expected=Array.from({length:10},()=>drawCharacter(()=>random(q),false,c.guardian,c.pickup,1,lateOpen(q.cleared)));const result=command(p,'draw',{banner:'normal',count:10},now);assert.deepEqual(result.items.map(x=>x.id),expected);assert.equal(p.rng,q.rng);}
});
test('events alternate from the specified season and inactive entries are rejected',()=>{
  const start=Date.parse('2026-11-08T15:00:00Z');
  assert.equal(season(start).index,EVENT_ROTATION_START);assert.equal(activeEvent(start-1),'both');assert.equal(activeEvent(start),'oath');assert.equal(activeEvent(start+7*day),'twin');assert.equal(activeEvent(start+14*day),'oath');assert.notEqual(season(start).id,season(start+14*day).id);assert.equal(activeEvent(start,true),'twin');assert.equal(activeEvent(start+7*day,true),'oath');assert.equal(eventOpen('twin',start),false);
  assert.deepEqual(eventWindow(start),{index:2966,id:'W2966',start,end:start+7*day,daysLeft:7});assert.equal(eventWindow(start+day).daysLeft,6);assert.equal(eventWindow(start+7*day-1).daysLeft,1);assert.deepEqual(eventWindow(start+7*day),{index:2967,id:'W2967',start:start+7*day,end:start+14*day,daysLeft:7});
  assert.deepEqual(nextEvent(start+day),{kind:'twin',start:start+7*day});assert.deepEqual(nextEvent(start+8*day),{kind:'oath',start:start+14*day});
  const p=unlockProfile(createProfile(start));assert.equal(command(p,'begin',{mode:'twin'},start).message,'이번 주 이벤트가 아니에요.');assert.equal(command(p,'begin',{mode:'oath',oaths:[]},start).ok,true);const token=p.active.token;assert.ok(parseProfile(p).active);assert.equal(command(p,'settle',{token,round:9,won:true},start+day).ok,true);assert.equal(command(p,'begin',{mode:'oath',oaths:[]},start+7*day).message,'이번 주 이벤트가 아니에요.');assert.equal(p.oath.period,season(start+7*day).id);assert.equal(command(p,'twinParty',autoTwin(p),start+7*day).ok,true);assert.equal(command(p,'begin',{mode:'twin',side:'left'},start+7*day).ok,true);
});
test('unlocked trial stays a new profile on load and supports test tools',async()=>{
  const src=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src'),result=await build({stdin:{contents:"export {createProfile,validateProfile,command,ProfileStore} from './profile.js';",resolveDir:src},bundle:true,write:false,format:'cjs',platform:'node',define:{__GARDEN_UNLOCKED__:'true'}}),compiled={exports:{}};runInNewContext(result.outputFiles[0].text,{module:compiled,structuredClone});const api=compiled.exports,p=api.createProfile(now,{trial:true});assert.equal(p.trial,true);assert.equal(p.cleared,0);assert.equal(api.validateProfile(p),true);
  const storage={getItem:()=>JSON.stringify(p)},store=new api.ProfileStore(storage,now);assert.equal(store.value.cleared,0);assert.equal(store.value.beginner.count,1);assert.equal(api.command(store.value,'testGrant',{kind:'trial-day'},now).ok,true);assert.equal(store.value.beginner.count,2);assert.equal(api.command(store.value,'testGrant',{kind:'event-flip'},now).ok,true);assert.equal(store.value.eventFlip,true);assert.equal(api.command(store.value,'testGrant',{kind:'ftue-reset'},now).ok,true);
});
test('combat power follows rarity and growth, and auto formation keeps equals and spreads shapes',()=>{
  // A mid account (about a thousand summons): commons far ahead in duplicates, the few URs at +0.
  const p=createProfile(now),entry=e=>({owned:true,enhance:e});
  for(const [id,e] of Object.entries(p.heroes)){e.owned=HERO[id].rarity!=='UR'||['zeke','luna','jasmine','rumi','venom','cherry_prince'].includes(id);e.enhance={C:8,R:6,SR:2,UR:0}[HERO[id].rarity];}
  assert.deepEqual(POWER_RARITY,{C:1,R:1.2,SR:1.4,UR:1.9});
  assert.equal(combatPower('zeke',entry(0)),950);assert.equal(combatPower('star_boy',entry(0)),500);assert.equal(combatPower('star_boy',entry(8)),735);
  // Same rarity and enhancement: the same number, whatever the basic attack.
  assert.equal(combatPower('siren',entry(8)),combatPower('night_rabbit',entry(8)));
  assert.ok(combatPower('zeke',entry(0))>combatPower('great_detective',entry(6))&&combatPower('great_detective',entry(6))>combatPower('storm_sage',entry(2))&&combatPower('storm_sage',entry(2))>combatPower('night_rabbit',entry(8)));
  const deck=autoDeck(p);assert.equal(deck.every(id=>HERO[id].rarity==='UR'),true);
  // Six URs tie; the five picked cover every shape the six have before a shape repeats.
  assert.equal(new Set(deck.map(id=>HERO[id].shape)).size,new Set(['zeke','luna','jasmine','rumi','venom','cherry_prince'].map(id=>HERO[id].shape)).size);
  // A tie never swaps out a companion already in the team.
  p.deck=['venom','cherry_prince','luna','zeke','jasmine'];assert.deepEqual([...autoDeck(p)].sort(),[...p.deck].sort());
  const fresh=createProfile(now);assert.deepEqual([...autoDeck(fresh)].sort(),[...fresh.deck].sort());
});
test('auto formation respects ownership, dispatch, rarity and oath constraints',()=>{
  const p=unlockProfile(createProfile(now));const ids=autoDeck(p,{size:10});assert.equal(ids.length,10);assert.equal(autoDeck(p,{exclude:[ids[0]]}).includes(ids[0]),false);p.dispatches=[{hero:ids[0]}];assert.equal(autoDeck(p).includes(ids[0]),false);assert.equal(autoDeck(p,{allow:id=>HERO[id].rarity==='C'}).every(id=>HERO[id].rarity==='C'),true);
  const twin=autoTwin(p);assert.equal(new Set([...twin.left.deck,...twin.right.deck]).size,10);assert.equal(new Set([...twin.left.relics,...twin.right.relics]).size,6);assert.equal(autoRelics(p).length,3);
  for(const rules of [['lowstar'],['crownless','nobeam','shapes'],['rabbits','shapes']]){const deck=oathDeck(p,rules);assert.ok(deck);assert.equal(oathDeckProblem(rules,deck),'');}p.heroes.night_rabbit.owned=false;assert.equal(oathDeck(p,['rabbits']),null);
});

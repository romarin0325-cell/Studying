import test from 'node:test';
import assert from 'node:assert/strict';
import {ProfileStore,createProfile,parseProfile,validateProfile,command} from '../src/profile.js';
import {UNLOCKS,TOUR_IDS,featureOpen,newlyOpened,tourOpen} from '../src/beginner.js';
import {BOSSES,DEFAULT_DECK,TUNING,PART_STAGES,TIERS} from '../src/content.js';
import {HOUR,idleReward} from '../src/economy.js';
import {createBattle,resumeBattle,battleMeta} from '../src/battle.js';
import {autoDeck,autoTwin,isMelee,oathDeck} from '../src/auto-team.js';
import {OATH_CLOSED,OATH_RULES} from '../src/preview/oath.js';
import * as engine from '../src/combat/engine.js';

const NOW=Date.parse('2026-11-08T15:00:00Z');
const ok=(p,action,args={},now=NOW)=>{
  const result=command(p,action,args,now);assert.ok(result.ok,result.message);return result;
};
function storeFor(p){
  let raw=JSON.stringify(p);
  return new ProfileStore({getItem:()=>raw,setItem:(_,value)=>{raw=value;}},NOW);
}

test('features open in order and migrated notices and tours keep their progress',()=>{
  const expected={garden:2,library:4,relic:6,draft:8,dispatch:9,season:11,monthly:13,request:15,event:17};
  assert.deepEqual(UNLOCKS,expected);
  assert.deepEqual(TOUR_IDS,Object.keys(expected).filter(id=>id!=='request'));
  assert.equal(TIERS.easy.unlock,3);
  const p=createProfile(NOW);
  for(const [id,stage] of Object.entries(expected)){
    p.cleared=stage-1;assert.equal(featureOpen(p,id),false);
    p.cleared=stage;assert.equal(featureOpen(p,id),true);
    assert.equal(newlyOpened(p).at(-1),id);
  }
  p.cleared=5;
  p.ftue.seen=['garden','season','relic','challenge','draft'];
  p.ftue.tours=['garden','challenge','draft'];
  const loaded=parseProfile(p);assert.ok(loaded);
  assert.deepEqual(loaded.ftue.seen,['garden','season','relic','draft','monthly','event']);
  assert.deepEqual(loaded.ftue.tours,['garden','draft','monthly','event']);
  for(const id of ['draft','monthly','event']){
    assert.equal(featureOpen(loaded,id),true);
    assert.equal(tourOpen(loaded,id),false);
  }
  assert.equal(featureOpen(loaded,'season'),true);
  assert.equal(featureOpen(loaded,'relic'),true);
  assert.equal(featureOpen(loaded,'dispatch'),false);
  assert.deepEqual(newlyOpened(loaded),['library']);
});

test('growth and dispatch commit synchronously and keep the active expedition byte-identical',()=>{
  const p=createProfile(NOW);p.cleared=PART_STAGES;p.dust=100000;
  for(const id of ['queen','ash'])p.heroes[id].owned=true;
  p.heroes.star_boy.copies=10;
  p.relics.hourglass={owned:true,enhance:2,copies:10};
  p.relics.lens.owned=true;p.equipped=['hourglass'];
  const s=storeFor(p),act=(action,args,at=NOW)=>{
    const r=s.transact(action,args,at);assert.ok(r.ok,r.message);return r;
  };
  act('begin',{mode:'main'});
  const initial=engine.serialize(createBattle(s.value));
  const battle=createBattle(s.value);for(let i=0;i<30;i++)engine.step(battle,.05);
  assert.ok(s.saveRun(engine.serialize(battle)));
  const saved=engine.serialize(resumeBattle(s.value));
  for(const id of ['rose','spring','seed','crit','critDamage'])act('bed',{id});
  act('enhance',{kind:'hero',id:'star_boy'});act('enhance',{kind:'relic',id:'hourglass'});
  const nextDeck=[...DEFAULT_DECK.slice(0,4),'queen'];
  act('deck',{ids:nextDeck});act('relics',{ids:['lens']});act('equip',{id:'hourglass'});
  act('dispatch',{slot:0,id:'star_boy'});
  const at=NOW+TUNING.dispatchHours*HOUR;act('claimDispatch',{slot:0},at);
  const loaded=new ProfileStore(s.storage,at);
  assert.equal(loaded.broken,false);
  assert.equal(engine.serialize(createBattle(loaded.value)),initial);
  assert.equal(engine.serialize(resumeBattle(loaded.value)),saved);
  const token=s.value.active.token;act('settle',{token,round:0,won:false},at);
  act('begin',{mode:'main'},at);
  const next=createBattle(s.value);
  assert.deepEqual(next.deck,nextDeck);assert.deepEqual(next.artifacts,['lens','hourglass']);
  assert.deepEqual(next.relicLevels,{lens:1,hourglass:4});
  assert.equal(next.gaugeMax,battle.gaugeMax+1);assert.equal(next.gold,JSON.parse(initial).gold+2);
  assert.ok(next.crit.chance>battle.crit.chance&&next.crit.damage>battle.crit.damage);
  assert.ok(next.meta.star_boy.power>battle.meta.star_boy.power);
});

test('old saves derive missing battle inputs and reject invalid new snapshots',()=>{
  const p=createProfile(NOW);ok(p,'begin',{mode:'main'});
  const initial=engine.serialize(createBattle(p));
  p.active.run=initial;delete p.active.snapshot;
  const notes={},loaded=parseProfile(JSON.stringify(p),notes);
  assert.ok(loaded);assert.ok(loaded.active.snapshot);assert.equal(notes.runDropped,undefined);
  assert.equal(engine.serialize(resumeBattle(loaded)),initial);
  const wrong=structuredClone(loaded);wrong.active.snapshot.meta[DEFAULT_DECK[0]].power=-1;
  assert.equal(validateProfile(wrong),false);assert.equal(parseProfile(wrong),null);
});

test('draft locks relics and bed inputs on entry and captures selected hero meta when the draft finishes',()=>{
  const p=createProfile(NOW);p.cleared=PART_STAGES;p.dust=10000;p.relics.hourglass.owned=true;p.equipped=['hourglass'];
  const s=storeFor(p),act=(action,args)=>{
    const r=s.transact(action,args,NOW);assert.ok(r.ok,r.message);return r;
  };
  act('begin',{mode:'weekly'});
  assert.equal(s.value.active.snapshot.meta,null);assert.equal(createBattle(s.value),null);
  act('bed',{id:'rose'});act('bed',{id:'spring'});act('equip',{id:'hourglass'});
  while(s.value.active.draft.length<5)act('draft',{index:0});
  const run=createBattle(s.value);
  assert.deepEqual(run.artifacts,['hourglass']);assert.equal(run.gaugeMax,120);
  assert.deepEqual(run.meta,battleMeta(s.value,s.value.active.deck));
  assert.ok(s.saveRun(engine.serialize(run)));assert.ok(resumeBattle(s.value));
});

test('an older draft checkpoint keeps its boss count through the intro-stage save migration',()=>{
  const p=createProfile(NOW);p.cleared=5;
  ok(p,'begin',{mode:'weekly'});
  while(p.active.draft.length<5)ok(p,'draft',{index:0});
  const old=engine.serialize(createBattle(p));
  p.active.run=old;delete p.active.snapshot;delete p.stageRev;
  const loaded=parseProfile(p);assert.ok(loaded);
  assert.equal(loaded.cleared,14);
  assert.equal(engine.serialize(resumeBattle(loaded)),old);
});

test('new oath runs close the cross, and an old 3×3 checkpoint keeps its board and rule version',()=>{
  const p=createProfile(NOW);p.cleared=17;
  ok(p,'begin',{mode:'oath',oaths:['hollow']});
  assert.equal(p.active.oathRules,OATH_RULES);
  assert.deepEqual(createBattle(p).oathMods.closed,OATH_CLOSED);
  p.active.oathRules=3;
  const old=engine.serialize(createBattle(p));
  p.active.run=old;delete p.active.snapshot;delete p.active.oathRules;
  const loaded=parseProfile(p);assert.ok(loaded);
  const resumed=resumeBattle(loaded);assert.ok(resumed);
  assert.deepEqual(resumed.oathMods.closed,[6,7,8,11,12,13,16,17,18]);
  assert.equal(engine.serialize(resumed),old);
  assert.equal(ok(loaded,'settle',{token:p.active.token,round:9,won:true}).record.rules,3);
});

test('auto formation uses pulse only for vacancies or a mandatory oath shape',()=>{
  const p=createProfile(NOW);
  for(const id of ['behemoth','guardian','zeke']){
    assert.equal(isMelee(id),true);Object.assign(p.heroes[id],{owned:true,enhance:99});
  }
  assert.equal(isMelee('star_boy'),false);
  assert.deepEqual(new Set(autoDeck(p)),new Set(DEFAULT_DECK));
  assert.deepEqual(new Set(oathDeck(p,[])),new Set(DEFAULT_DECK));
  assert.equal(oathDeck(p,['shapes']).filter(isMelee).length,1);
  assert.equal(autoDeck(p,{exclude:['star_boy']}).filter(isMelee).length,1);
  for(const id of ['aurora','luna','jasmine','santa','queen'])p.heroes[id].owned=true;
  const twin=autoTwin(p);assert.equal([...twin.left.deck,...twin.right.deck].filter(isMelee).length,0);
  p.heroes.queen.owned=false;
  const short=autoTwin(p);assert.equal([...short.left.deck,...short.right.deck].filter(isMelee).length,1);
});

test('a fresh profile can collect a full shooting-star jar and greets the Great Detective',()=>{
  const p=createProfile(NOW);
  assert.equal(p.partner,'great_detective');assert.ok(p.heroes.great_detective.owned);
  assert.equal(p.idleAt,NOW-TUNING.idleHours*HOUR);
  assert.equal(idleReward(p,NOW),idleReward(p,NOW+HOUR));
  assert.ok(ok(p,'idle').reward>0);
  assert.equal(command(p,'idle',{},NOW).ok,false);
});

test('boss display names use the new names without changing boss IDs',()=>{
  const names={love_iris:'아이리스',curse_iris:'저주받은 아이리스',flora:'플로라',poseidon:'포세이돈',beelzebub:'벨제뷔트',thor:'토르',ares:'아레스',astea:'아스테아'};
  for(const [id,name] of Object.entries(names))assert.equal(BOSSES[id]?.name,name,id);
});

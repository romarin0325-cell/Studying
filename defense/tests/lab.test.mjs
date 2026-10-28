import test from 'node:test';
import assert from 'node:assert/strict';
import {roster,measure,arena,castArena,defaults} from '../src/lab/model.js';
const hero=id=>roster.find(h=>h.id===id);
test('all collectible identities and forms have finite real-engine results',()=>{for(const h of roster){const r=measure(h);assert.ok(Number.isFinite(r.dps)&&r.dps>=0,h.id);assert.ok(Number.isFinite(r.value),h.id);}});
test('burn and poison contribute to measured DPS, external conditional effects change hits',()=>{const h=hero('luna');assert.ok(measure(h,{low:true,boss:true}).dps>measure(h,{boss:true}).dps*1.9);const v=measure(hero('venom'));assert.ok(v.dps>v.direct);});
test('final patch uses canonical stats without the old scenario being applied twice',()=>{
 for(const [id,power] of [['underdog',25],['miracle_larva',48],['miracle_cocoon',40],['ash',28],['guardian',55],['joker',20],['cure_master',21]]){
  const h=hero(id);assert.equal(h.damage,power);assert.equal(measure(h).dps,measure(h,{patch:true}).dps,id);
 }
 const maid=measure(hero('avalanche_maid'));assert.equal(maid.cost,80);assert.equal(measure(hero('avalanche_maid'),{patch:true}).cost,80);
 const ash=measure(hero('ash'));assert.ok(Math.abs(ash.skill-28*22*5)<.01);assert.equal(hero('cure_master').skill.name,'퍼스트키스');
});

test('Chaos, apple contact and prism compare actual canonical engine conditions',()=>{
 const j=measure(hero('joker'),{joker:5});assert.equal(j.cost,100);assert.equal(j.preview.name,'카오스 룰렛');assert.ok(j.dps>measure(hero('joker')).dps);
 assert.ok(measure(hero('toffee_apple'),{appleApproach:true}).skillDamage>0);
 assert.ok(measure(hero('lightning_sage'),{prism:true}).dps>measure(hero('lightning_sage')).dps);
});

test('draft speed can both raise and lower cadence',()=>{const h=hero('luna'),a=measure(h);assert.ok(measure(h,{}, {interval:2.5}).dps<a.dps);assert.ok(measure(h,{}, {interval:.5}).dps>a.dps);});
test('support and transformation skills retain real cast restrictions',()=>{const a=arena(hero('miracle_wing'),defaults);assert.equal(castArena(a).ok,false);});

import * as E from '../src/combat/engine.js';
import {baselineOptions,sortRows} from '../src/lab/model.js';
test('Zeke position attack power and core crisis are independent real-engine conditions',()=>{
 const h=hero('zeke'),a=arena(h),near=arena(h,{coreNear:true});
 assert.equal(E.personalTrait(a.s,a.u).active,false);assert.equal(E.personalTrait(near.s,near.u).active,true);
 assert.equal(E.combatStats(near.s,near.u).interval,E.combatStats(a.s,a.u).interval);assert.equal(E.combatStats(near.s,near.u).damage/E.combatStats(a.s,a.u).damage,1.4);
 const normal=measure(h),crisis=measure(h,{coreCrisis:true});
 assert.equal(normal.dps,crisis.dps);assert.equal(crisis.skill/normal.skill,2);
});
test('Aurora even formation raises individual damage without adding another attacker',()=>{
 const h=hero('aurora'),a=measure(h),b=measure(h,{auroraEven:true}),r=arena(h,{auroraEven:true});
 assert.equal(r.helpers.length,1);assert.equal(b.power/a.power,1.5);assert.ok(Math.abs(b.dps/a.dps-1.5)<.001);
});
test('normal-only deck and connected lightning are selectable and reset in baseline',()=>{
 const h=hero('underdog'),a=measure(h),b=measure(h,{normalDeck:true});assert.equal(b.power/a.power,1.8);
 const l=hero('lightning_sage');assert.equal(measure(l,{lightningTeam:true}).power/measure(l).power,1.6);
 const o=baselineOptions({heroMax:true,auroraEven:true,coreNear:true,normalDeck:true,rank:3,boss:true});
 assert.equal(o.heroMax,false);assert.equal(o.auroraEven,false);assert.equal(o.normalDeck,false);assert.equal(o.coreNear,false);assert.equal(o.rank,3);assert.equal(o.boss,true);
});
test('wave age, rabbit companions, auras, and fake Cinderella use actual engine conditions',()=>{
 assert.equal(measure(hero('star_boy'),{age:0}).power/measure(hero('star_boy'),{age:1}).power,1.5);
 assert.equal(measure(hero('time_ruler'),{age:2}).power/measure(hero('time_ruler'),{age:1}).power,1.25);
 const r=arena(hero('night_rabbit'),{rabbitTeam:true});assert.equal(E.nightRabbitTargetCount(r.s),13);
 assert.ok(measure(hero('behemoth'),{powerAura:true,speedAura:true}).dps>measure(hero('behemoth')).dps);
 const c=arena(hero('cinderella'),{falseCinderella:true});assert.notEqual(E.topCinderella(c.s).uid,c.u.uid);
});
test('delayed finishers and multi-hit ultimates have nonzero standalone damage for sorting',()=>{
 for(const id of ['cherry_prince','star_boy','aurora','behemoth']){const m=measure(hero(id));assert.ok(m.skillDamage>0,id);}
 assert.equal(measure(hero('cherry_prince')).skill,0);
 const entries=['ash','star_boy','snow_rabbit'].map(id=>({h:hero(id),r:measure(hero(id))}));
 const sorted=sortRows(entries,'skillDamage');assert.ok(sorted[0].r.skillDamage>=sorted[1].r.skillDamage);assert.ok(sorted[1].r.skillDamage>=sorted[2].r.skillDamage);
});
test('character presets activate each native condition and starlight/gold controls change ultimates',()=>{
 const a=measure(hero('aurora'),{heroMax:true});assert.equal(a.conditions.auroraEven,true);
 assert.equal(measure(hero('underdog'),{heroMax:true}).conditions.normalDeck,true);
 assert.equal(measure(hero('star_boy'),{gauge:120}).skillDamage/measure(hero('star_boy'),{gauge:60}).skillDamage,2);
 assert.ok(measure(hero('doom'),{gold:240}).skillDamage>measure(hero('doom'),{gold:40}).skillDamage);
});

test('one stationary target is within the Ancient Dragon cross and takes normal attack damage',()=>{
 const h=hero('ancient_dragon');for(const coreNear of [false,true]){const a=arena(h,{targets:1,coreNear});const p=E.pathPoint(a.s.enemies[0].progress),origin=E.cellPoint(a.index);assert.ok(E.geometryContains(E.attackGeometry(h,origin,p),p));const m=measure(h,{targets:1,coreNear});assert.ok(m.dps>0);assert.ok(Math.abs(m.dps-m.direct)<2);}
});

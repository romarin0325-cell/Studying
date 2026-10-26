import test from 'node:test';
import assert from 'node:assert/strict';
import {roster,measure,arena,castArena,defaults} from '../src/lab/model.js';
const hero=id=>roster.find(h=>h.id===id);
test('all collectible identities and forms have finite real-engine results',()=>{for(const h of roster){const r=measure(h);assert.ok(Number.isFinite(r.dps)&&r.dps>=0,h.id);assert.ok(Number.isFinite(r.value),h.id);}});
test('burn and poison contribute to measured DPS, external conditional effects change hits',()=>{const h=hero('luna');assert.ok(measure(h,{low:true,boss:true}).dps>measure(h,{boss:true}).dps*1.9);const v=measure(hero('venom'));assert.ok(v.dps>v.direct);});
test('proposed power reductions and buffs are isolated from canonical content',()=>{for(const [id,factor]of [['underdog',1.15],['miracle_larva',.8],['miracle_cocoon',.4]]){const h=hero(id),base=h.damage,a=measure(h),b=measure(h,{patch:true});assert.ok(Math.abs(b.dps/a.dps-factor)<.015,id);assert.equal(h.damage,base);}});
test('mana scenario changes efficiency without changing damage',()=>{const h=hero('avalanche_maid'),a=measure(h),b=measure(h,{patch:true});assert.equal(a.gain,b.gain);assert.equal(b.cost,80);assert.ok(Math.abs(b.value/a.value-85/80)<1e-8);});
test('Ash 20x scenario only raises ultimate direct damage',()=>{const h=hero('ash'),a=measure(h),b=measure(h,{patch:true});assert.equal(a.dps,b.dps);assert.ok(Math.abs(b.skill/a.skill-20/18)<.01);});
test('draft speed can both raise and lower cadence',()=>{const h=hero('luna'),a=measure(h);assert.ok(measure(h,{}, {interval:2.5}).dps<a.dps);assert.ok(measure(h,{}, {interval:.5}).dps>a.dps);});
test('support and transformation skills retain real cast restrictions',()=>{const a=arena(hero('miracle_wing'),defaults);assert.equal(castArena(a).ok,false);});

import * as E from '../src/combat/engine.js';
import {baselineOptions,sortRows} from '../src/lab/model.js';
test('Zeke position haste and core crisis are independent real-engine conditions',()=>{
 const h=hero('zeke'),a=arena(h),near=arena(h,{coreNear:true});
 assert.equal(E.personalTrait(a.s,a.u).active,false);assert.equal(E.personalTrait(near.s,near.u).active,true);
 assert.ok(E.combatStats(near.s,near.u).interval<E.combatStats(a.s,a.u).interval);
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

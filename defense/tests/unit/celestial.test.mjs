import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../../merge/engine.js';
import {HERO,DEFAULT_DECK} from '../../merge/content.js';
import {attackDescription,skillDescription} from '../../merge/unit-info.js';

const tick=(s,t)=>{for(let n=0;n<Math.round(t*60);n++)E.step(s,1/60);};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function run(id,artifacts=[],chapter=0){const s=E.newRun({deck:[id,...DEFAULT_DECK.filter(x=>x!==id)].slice(0,6),artifacts,chapter,seed:736});const u=s.board.find(Boolean);s.board.fill(null);s.board[12]={...u,hero:id,cooldown:1000,windup:0};s.queue=[];s.events=[];return s;}
function enemy(s,hp=10000,progress=180,kind='grunt'){s.queue=[{kind,hp}];s.spawnIn=0;E.step(s,1/60);s.queue=[];const e=s.enemies.at(-1);e.progress=progress;e.speed=0;return e;}
function hit(s,e,{count=1,form=null,proc=true}={}){const u=s.board[12],p=E.cellPoint(12);s.shots.push({uid:s.nextId++,source:u.uid,hero:u.hero,form,proc,rank:u.rank,count,damage:E.combatStats(s,u).damage,target:e.uid,origin:p,from:p,to:E.pathPoint(e.progress),life:.001,total:.2});E.step(s,1/60);}

for(const id of ['star_boy','cherry_prince']){
  test(id+': maxHP selection is single, delayed, independent of current HP or boss flag',()=>{
    const s=run(id),low=enemy(s,5000,240,'boss'),high=enemy(s,20000,270);high.hp=1000;s.gauge=100;const before=s.stats.damage;
    assert.equal(E.cast(s,id).ok,true);assert.equal(s.finishers.length,1);assert.equal(s.finishers[0].target,high.uid);assert.equal(s.stats.damage,before);
    assert.equal(s.events.find(e=>e.type==='skill').targets.length,1);tick(s,.5);assert.equal(high.hp,1000);high.progress+=80;tick(s,.1);assert.deepEqual(s.finishers[0].to,E.pathPoint(high.progress));tick(s,.7);
    assert.ok(high.hp<1000);assert.equal(low.hp,5000);assert.equal(s.finishers.length,0);assert.equal(s.events.filter(e=>e.type==='finisherImpact').length,1);
  });
  test(id+': tie chooses first UID; dead target fizzles with no retarget; resume preserves damage time',()=>{
    const s=run(id),first=enemy(s,10000),second=enemy(s,10000,210);s.gauge=100;E.cast(s,id);assert.equal(s.finishers[0].target,first.uid);
    tick(s,.3);const saved=E.restore(E.serialize(s));assert.ok(saved);tick(s,1);tick(saved,1);assert.equal(E.serialize(s),E.serialize(saved));
    const d=run(id),a=enemy(d),b=enemy(d);d.gauge=100;E.cast(d,id);a.hp=0;tick(d,1.5);assert.equal(b.hp,b.maxHp);assert.equal(d.events.filter(e=>e.type==='finisherImpact').length,0);assert.equal(d.events.filter(e=>e.type==='finisherFizzle').length,1);
  });
}
test('royal synergy is evaluated at impact and ignores armor; starfall respects armor',()=>{
  for(const id of ['cherry_prince','star_boy']){const s=run(id),e=enemy(s,10000,220,'armor');s.gauge=100;E.cast(s,id);e.divine=3;e.divineTime=4;tick(s,1.4);close(e.maxHp-e.hp,HERO[id].damage*(id==='cherry_prince'?34*1.4:32*.72));}
});
test('Trauma uses a timed form, live power, pure in-flight shots and returns after expiry',()=>{
  const s=run('time_magician',['broken_clock']),e=enemy(s,10000,220,'armor'),u=s.board[12],base=E.combatStats(s,u);s.gauge=100;E.cast(s,u.hero);
  assert.equal(s.buffs.trauma,12);assert.equal(E.unitForm(s,u),'trauma');close(E.combatStats(s,u).damage,base.damage*2.1);close(E.combatStats(s,u).cooldown,1.35/1.35);
  assert.match(attackDescription(s,u),/방어 무시/);assert.match(skillDescription(s,u.hero),/12초/);
  const before=e.hp;hit(s,e,{form:'trauma'});close(before-e.hp,base.damage*2.1);
  E.move(s,12,13);let copy=E.restore(E.serialize(s));assert.ok(copy);assert.equal(E.unitForm(copy,copy.board[13]),'trauma');
  tick(copy,12.1);assert.equal(E.unitForm(copy,copy.board[13]),null);close(E.combatStats(copy,copy.board[13]).damage,base.damage);
});
test('transformation applies to every time magician across merge, summon and resume; not other heroes',()=>{
  const s=run('time_magician');enemy(s);s.board[13]={...s.board[12],uid:s.nextId++};s.gauge=100;E.cast(s,'time_magician');E.move(s,12,13);assert.equal(E.unitForm(s,s.board[13]),'trauma');assert.equal(s.board[13].rank,2);
  assert.equal(E.unitForm(s,{hero:'zeke'}),null);assert.equal(E.unitForm(s,{hero:'time_magician'}),'trauma');
});
test('Doom inherits refunds and income skill; Cinderella gains combat and never pays gold',()=>{
  for(const id of ['doom','cinderella']){const s=run(id);s.board[13]={...s.board[12],uid:s.nextId++};const gold=s.gold;E.move(s,12,13);assert.equal(s.gold-gold,id==='doom'?18:0);enemy(s);s.gauge=100;const before=s.gold;E.cast(s,id);assert.equal(s.gold-before,id==='doom'?25:0);}
  const s=run('cinderella'),e=enemy(s,10000,220,'armor');hit(s,e,{count:3});close(e.maxHp-e.hp,23*1.8);assert.ok(HERO.cinderella.interval<1.15);
});
test('Jasmine stacks have a lifetime and amplify only hits after reaching three',()=>{
  const s=run('jasmine'),e=enemy(s);for(let i=0;i<3;i++)hit(s,e);assert.equal(e.divine,3);close(e.maxHp-e.hp,60);const hp=e.hp;hit(s,e);close(hp-e.hp,33);tick(s,6.1);assert.equal(e.divine,0);
});
test('support proc follows real adjacency once, never once per beam victim or echoed shot',()=>{
  for(const [id,count] of [['santa',4],['time_magician',3]]){const s=run(id);const e=enemy(s,10000,240);enemy(s,10000,250);s.board[13]={...s.board[12],uid:s.nextId++,hero:'zeke',cooldown:10};s.board[24]={...s.board[13],uid:s.nextId++};
    hit(s,e,{count});close(s.board[24].cooldown-s.board[13].cooldown,.6);assert.equal(s.events.filter(e=>e.type==='supportPulse').length,1);
    hit(s,e,{count,proc:false});close(s.board[24].cooldown-s.board[13].cooldown,.6);
  }
});
test('four expansion relics change timing, one-target damage, paid draws and buff duration',()=>{
  const tempo=run('zeke',['tempo_bell']);const fast=E.combatStats(tempo,tempo.board[12]).cooldown;tempo.waveTime=7;close(E.combatStats(tempo,tempo.board[12]).cooldown/fast,1.45);
  const seal=run('star_boy',['royal_seal']),low=enemy(seal,5000),high=enemy(seal,10000);hit(seal,low);hit(seal,high);close(low.maxHp-low.hp,17);close(high.maxHp-high.hp,17*1.25);
  const gift=run('santa',['gift_ribbon']);gift.gold=1000;for(let i=0;i<3;i++)assert.equal(E.summon(gift).rank,1);assert.equal(gift.paidSummons,0);for(let i=1;i<=8;i++)assert.equal(E.summon(gift).rank,i%4?1:2);
  for(const id of ['siren','santa','jasmine','time_magician']){const s=run(id,['broken_clock']);enemy(s);s.gauge=100;E.cast(s,id);const key={siren:'haste',santa:'festive',jasmine:'radiance',time_magician:'trauma'}[id];assert.equal(s.buffs[key],{siren:10,santa:8,jasmine:10,time_magician:12}[id]);}
});
test('Santa full-board gift reserves a rank-two ally through save and leaves paid-summon counter unchanged',()=>{
  const s=run('santa');const e=enemy(s);s.board=Array.from({length:25},()=>({...s.board[12],uid:s.nextId++}));s.gauge=100;E.cast(s,'santa');assert.equal(s.reserves.length,1);assert.equal(s.paidSummons,0);const c=E.restore(E.serialize(s));assert.ok(c);c.board[0]=null;E.step(c,1/60);assert.equal(c.board[0].rank,2);assert.equal(c.reserves.length,0);
});
test('Thor marks three occupied cells and moving out avoids disable and gauge loss',()=>{
  const s=run('zeke',[],4);s.wave=4;const e=enemy(s,100000,220,'boss');s.board[13]={...s.board[12],uid:s.nextId++};s.board[14]={...s.board[12],uid:s.nextId++};e.skillIn=0;E.step(s,1/60);assert.deepEqual([...s.telegraph.cells].sort((a,b)=>a-b),[12,13,14]);E.move(s,12,0);E.move(s,13,1);E.move(s,14,2);const gauge=s.gauge;tick(s,2.7);close(s.gauge,gauge+2.7*1.2);assert.ok(s.board.filter(Boolean).every(u=>u.disabled===0));
});
for(const [chapter,pattern] of [[5,'duel'],[6,'creation']])test(pattern+' has a real 6-percent interrupt and a visible consequence if missed',()=>{
  for(const interrupted of [false,true]){const s=run('zeke',[],chapter);s.wave=12;const e=enemy(s,100000,220,'boss');e.skillIn=0;E.step(s,1/60);assert.equal(s.telegraph.pattern,pattern);if(interrupted)e.hp-=6001;tick(s,2.65);
    if(interrupted){assert.ok(e.stun>0);assert.equal(e.shield,0);assert.equal(e.rage,0);assert.equal(s.enemies.length,1);}else if(pattern==='duel')assert.ok(e.rage>4);else{assert.equal(e.shield,12000);assert.equal(s.enemies.length,3);assert.ok(s.enemies.slice(1).every(e=>e.maxHp===6000));}
  }
});
test('revision-two migration preserves HP and wallet, and rejects malformed pending finishers',()=>{
  const s=run('star_boy'),e=enemy(s);s.balanceRevision=2;delete s.finishers;for(const k of ['divine','divineTime','rage','shield'])delete e[k];const c=E.restore(JSON.stringify(s));assert.ok(c);assert.equal(c.enemies[0].hp,e.hp);assert.equal(c.gold,s.gold);assert.equal(c.balanceRevision,E.BALANCE_REVISION);
  c.gauge=100;E.cast(c,'star_boy');for(const key of ['target','damage','life','total']){const bad=JSON.parse(E.serialize(c));bad.finishers[0][key]=-1;assert.equal(E.restore(bad),null,key);}
});

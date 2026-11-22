import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/combat/engine.js';
import {victoriaChargeValue} from '../src/smart-auto.js';

const deck=['victoria','gold_dragon','star_boy','rumi','ash'];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function setup(){
  const s=E.newRun({deck,seed:11,crit:null}),template=structuredClone(s.board.find(Boolean));
  s.board.fill(null);s.spawnIn=0;E.step(s,.01);s.time=0;s.waveTime=0;s.spawnIn=1e6;s.queue=[{kind:'grunt',hp:1e9}];s.events=[];s.shots=[];s.gauge=120;
  const enemy=s.enemies[0];Object.assign(enemy,{hp:1e9,maxHp:1e9,progress:863,speed:0,skillIn:1e8,statusEffects:[],slowEffects:[]});
  const unit=(hero,index,rank=1)=>s.board[index]={...structuredClone(template),uid:s.nextId++,hero,rank,cooldown:1e6,windup:0,attacks:0,cursed:false,disabled:0};
  return {s,enemy,unit};
}
function advance(s,seconds){for(let t=0;t<seconds-1e-9;t+=.05)E.step(s,Math.min(.05,seconds-t));}

test('Victoria charges for five seconds before granting eight seconds of team buffs without cleansing or wards',()=>{
  const {s,unit}=setup(),victoria=unit('victoria',12),ally=unit('star_boy',0);ally.disabled=20;ally.cursed=true;
  const base=E.combatStats(s,ally,0);assert.ok(E.cast(s,'victoria').ok);assert.equal(s.gauge,40);assert.equal(s.buffs.victoriaMiracle||0,0);
  assert.equal(E.castLock(s,'victoria').kind,'charge');assert.ok(E.charging(s,victoria));assert.equal(E.stunUnit(s,12,2),false);
  assert.equal(ally.disabled,20);assert.equal(ally.cursed,true);assert.equal(ally.stunWard,0);assert.ok(!s.events.some(e=>e.type==='skill'&&e.hero==='victoria'));
  assert.equal(E.move(s,12,13).ok,false);assert.equal(E.sell(s,12).ok,false);advance(s,4.95);assert.equal(s.buffs.victoriaMiracle||0,0);
  advance(s,.05);near(s.buffs.victoriaMiracle,8);assert.equal(s.victoriaCharge,null);assert.equal(ally.cursed,true);assert.ok(ally.disabled>14);assert.equal(ally.stunWard,0);
  const enhanced=E.combatStats(s,ally,0);near(enhanced.damage/base.damage,1.7);near(enhanced.cooldown/base.cooldown,1/1.4);
  const event=s.events.find(e=>e.type==='skill'&&e.hero==='victoria');assert.equal(event.support,true);assert.equal(event.allies.length,2);
  advance(s,8);near(s.buffs.victoriaMiracle,0);
});

test('Victoria charge snapshots through save, cancels at wave end, and rejects invalid restored locks',()=>{
  const {s,unit}=setup();unit('victoria',12,3);assert.ok(E.cast(s,'victoria').ok);advance(s,2);
  const back=E.restore(E.serialize(s));assert.ok(back);near(back.victoriaCharge.ends-back.time,3);advance(back,3);near(back.buffs.victoriaMiracle,8);near(back.buffScale.victoriaMiracle,1.2);
  for(const change of [x=>x.victoriaCharge.source=999999,x=>x.victoriaCharge.wave++,x=>x.victoriaCharge.ends++,x=>x.phase='reward']){const x=JSON.parse(E.serialize(s));change(x);assert.equal(E.restore(JSON.stringify(x)),null);}
  const legacy=E.newRun({deck,seed:11});delete legacy.victoriaCharge;assert.equal(E.restore(E.serialize(legacy)).victoriaCharge,null);
  s.queue=[];for(const enemy of s.enemies)enemy.hp=0;E.step(s,.05);assert.equal(s.victoriaCharge,null);assert.equal(s.phase,'reward');
});

test('Gold Dragon and Victoria charge independently and remain fixed together during shuffle',()=>{
  const {s,enemy,unit}=setup(),victoria=unit('victoria',2,2),gold=unit('gold_dragon',12,3);unit('star_boy',7);
  assert.ok(E.cast(s,'victoria').ok);s.gauge=120;assert.ok(E.cast(s,'gold_dragon').ok);
  assert.equal(E.bestUnit(s,'gold_dragon').uid,gold.uid);assert.equal(E.bestUnit(s,'victoria').uid,victoria.uid);
  const back=E.restore(E.serialize(s));assert.ok(back);assert.equal(back.goldCharge.source,gold.uid);assert.equal(back.victoriaCharge.source,victoria.uid);
  enemy.boss='ares';enemy.channel=.001;enemy.channelHp=enemy.hp;s.telegraph={uid:enemy.uid,pattern:'shuffle',cells:[2,12],ends:s.time+.001,total:.001};E.step(s,.01);
  assert.equal(s.board[2].uid,victoria.uid);assert.equal(s.board[12].uid,gold.uid);advance(s,5);
  assert.equal(s.goldCharge,null);assert.equal(s.victoriaCharge,null);assert.ok(s.buffs.victoriaMiracle>7.9);assert.ok(s.volleys.some(v=>v.kind==='gold_breath'));
});

test('Victoria snapshots spotlight recipient at release before her buff affects the comparison',()=>{
  const {s,unit}=setup();s.deck[1]='queen';s.upgrades.queen=0;s.artifacts=['spotlight'];
  const first=unit('queen',0),second=unit('queen',24);unit('victoria',12);s.meta.queen={power:10,special:1};
  s.buffs.awaken=20;s.buffTotals.awaken=20;s.buffScale.awaken=1;s.buffSpotlight.awaken=second.uid;
  assert.ok(E.combatStats(s,second).damage>E.combatStats(s,first).damage);
  assert.match(E.castPreview(s,'victoria').lines.join(' '),/차지 완료 시 다시 결정/);
  assert.ok(E.cast(s,'victoria').ok);advance(s,5);assert.equal(s.buffSpotlight.victoriaMiracle,second.uid);
});

test('smart auto values Victoria as delayed incremental team support rather than immediate damage',()=>{
  const {s,unit}=setup(),victoria=unit('victoria',12);unit('star_boy',0,4);unit('rumi',24,3);
  const before=E.serialize(s);assert.equal(victoriaChargeValue(s,victoria,5),0);
  const longer=victoriaChargeValue(s,victoria,30),shorter=victoriaChargeValue(s,victoria,7);
  assert.ok(longer>shorter&&longer>0);assert.equal(E.serialize(s),before,'forecast must not mutate the run');
  s.buffs.awaken=30;s.buffScale.awaken=10;s.buffs.haste=30;s.buffScale.haste=10;
  assert.equal(victoriaChargeValue(s,victoria,30),0,'already stronger power and speed buffs remove incremental gain');
  s.buffs.awaken=2;s.buffs.haste=2;assert.ok(victoriaChargeValue(s,victoria,30)>0,'existing buffs expire during charge');
});

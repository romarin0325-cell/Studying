import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/combat/engine.js';
import {createScenario,newMetrics,policyAction,trialSeed,wilson} from '../scripts/requested-stage-sim.mjs';

function unit(template,hero,uid,rank=1){return {...template,hero,uid,rank,cursed:false};}
function situation(){
  const s=createScenario(82,trialSeed(17)),template=s.board.find(Boolean);
  s.board=Array(25).fill(null);
  s.board[7]=unit(template,'santa',101);
  s.board[8]=unit(template,'snow_rabbit',102);
  s.nextId=200;
  while(!s.enemies.length)E.step(s,.05);
  s.events.length=0;
  return {s,template};
}

test('scenario preserves requested growth, relics and base critical rate',()=>{
  const s=createScenario(82,123);
  assert.deepEqual(s.artifacts,['lantern','hourglass','chorus']);
  assert.deepEqual(s.relicLevels,{lantern:5,hourglass:5,chorus:5});
  assert.equal(s.relicAttack,.03);
  assert.equal(s.gold,110);
  assert.equal(s.gaugeMax,140);
  assert.deepEqual(s.crit,{chance:.05,damage:1.5});
  assert.equal(s.meta.santa.power,1.25);
  assert.equal(s.meta.snow_rabbit.special,1.1);
  assert.equal(s.meta.storm_sage.power,1.05);
  assert.equal(s.meta.time_magician.special,1);
});
test('normal and boss progress thresholds select only Santa or Snow Rabbit',()=>{
  const {s}=situation(),m=newMetrics(),enemy=s.enemies[0];
  enemy.progress=E.PATH_LENGTH*.49;s.gauge=100;
  assert.equal(policyAction(s,m),'santa');
  assert.equal(m.casts.santa,1);
  enemy.progress=E.PATH_LENGTH*.5;s.gauge=100;
  assert.equal(policyAction(s,m),'snow_rabbit');
  assert.equal(m.casts.snow_rabbit,1);
  s.wave=3;enemy.progress=E.PATH_LENGTH*.3;s.gauge=100;
  assert.equal(policyAction(s,m),'snow_rabbit');
  enemy.progress=E.PATH_LENGTH*.31;s.gauge=0;
  policyAction(s,m);
  assert.equal(m.casts.santa,1,'do not spend on Santa while an enemy is beyond the threshold');
});
test('training is purchased after each specified wave',()=>{
  const {s}=situation(),m=newMetrics();
  s.phase='intermission';s.gold=1000;s.enemies=[];
  for(const [wave,id,level] of [[2,'snow_rabbit',1],[3,'siren',1],[4,'snow_rabbit',2],[5,'siren',2]]){
    s.wave=wave;
    assert.equal(policyAction(s,m),'train');
    assert.equal(s.upgrades[id],level);
  }
  assert.deepEqual(m.training.map(x=>[x.wave,x.id,x.level]),[
    [2,'snow_rabbit',1],[3,'siren',1],[4,'snow_rabbit',2],[5,'siren',2]
  ]);
});
test('merge policy respects the storm prohibition and siren cap',()=>{
  const {s,template}=situation(),m=newMetrics();
  s.phase='intermission';s.wave=1;s.gold=0;s.freeSummons=0;s.enemies=[];
  s.board=Array(25).fill(null);
  s.board[0]=unit(template,'storm_sage',1);s.board[1]=unit(template,'storm_sage',2);
  for(let i=0;i<4;i++)s.board[i+5]=unit(template,'siren',10+i);
  assert.equal(policyAction(s,m),'merge');
  assert.equal(s.board.filter(u=>u?.hero==='storm_sage').length,2);
  assert.equal(s.board.filter(u=>u?.hero==='siren').length,3);
  assert.equal(m.merges.storm_sage,undefined);
});
test('announced judgement is dodged and a cursed storm is sold rather than merged',()=>{
  const {s,template}=situation(),m=newMetrics();
  s.telegraph={pattern:'judgement',cells:[7],uid:999,ends:s.time+3.5};
  assert.equal(policyAction(s,m),'dodge');
  assert.equal(s.board[7],null);
  s.telegraph=null;s.board=Array(25).fill(null);
  s.board[0]={...unit(template,'storm_sage',1),cursed:true};
  s.board[1]=unit(template,'storm_sage',2);
  assert.equal(policyAction(s,m),'curse');
  assert.equal(s.board[0],null);
  assert.equal(m.curseSales,1);
  assert.equal(m.merges.storm_sage,undefined);
});
test('confidence interval and trial seeds are deterministic',()=>{
  assert.equal(new Set(Array.from({length:1000},(_,i)=>trialSeed(i+1))).size,1000);
  const [lo,hi]=wilson(0,100);
  assert.equal(lo,0);
  assert.ok(hi>.036&&hi<.038);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../../merge/engine.js';
import {HERO} from '../../merge/content.js';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const tick=(s,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)E.step(s,1/60);};
function fixture(id='frost_witch'){
  const deck=['frost_witch','snow_rabbit','avalanche_maid','storm_sage','galaxy_whale','time_ruler'];
  const s=E.newRun({deck,seed:736}),template=s.board.find(Boolean);
  s.board.fill(null);s.board[12]={...template,hero:id,cooldown:1000,windup:0};
  s.queue=[{kind:'grunt',hp:100000}];s.spawnIn=0;E.step(s,1/60);s.queue=[];s.events=[];
  const e=s.enemies[0];e.progress=180;e.speed=0;
  return {s,e};
}
function hit(s,e,id='frost_witch'){
  let u=s.board.find(u=>u?.hero===id);
  if(!u){u={...s.board[12],uid:s.nextId++,hero:id,cooldown:1000};s.board[11]=u;}
  const p=E.cellPoint(s.board.indexOf(u));
  s.shots.push({uid:s.nextId++,source:u.uid,hero:id,rank:u.rank,count:1,damage:HERO[id].damage,target:e.uid,origin:p,from:p,to:E.pathPoint(e.progress),life:.001,total:.2});
  E.step(s,1/60);
}
function cast(s,id){s.gauge=100;assert.equal(E.cast(s,id).ok,true);return s.time;}

test('snow rabbit basic hits cannot shorten ice court remaining duration',()=>{
  const {s,e}=fixture(),started=cast(s,'frost_witch');
  tick(s,.1);close(e.slow,.5);close(e.slowTime,5.9);
  hit(s,e,'snow_rabbit');close(e.slow,.5);close(e.slowTime,6-(s.time-started));
  tick(s,2.5);close(e.slow,.5);close(e.slowTime,6-(s.time-started));
  tick(s,6-(s.time-started));close(e.slow,0);close(e.slowTime,0);
});

test('continuous witch attacks return ice court to 40 percent at six seconds',()=>{
  const {s,e}=fixture();s.board[12].cooldown=0;cast(s,'frost_witch');
  tick(s,5.9);close(e.slow,.5);assert.ok(s.board[12].attacks>=3);
  tick(s,.1);close(e.slow,.4);assert.ok(e.slowTime>0&&e.slowTime<=2.4);
  tick(s,4);close(e.slow,.4);assert.ok(e.hp>0);
});

test('weaker basic hits expire separately and cannot renew a stronger basic slow',()=>{
  const {s,e}=fixture();hit(s,e);tick(s,1);hit(s,e,'time_ruler');
  close(e.slow,.4);tick(s,1.4);close(e.slow,.25);
  // The clock field can refresh only its own 25-percent effect.
  tick(s,4.5);close(e.slow,0);close(e.slowTime,0);
});

test('different slow skills keep their own strength and expiry',()=>{
  const {s,e}=fixture('storm_sage');cast(s,'storm_sage');tick(s,1);
  s.board[11]={...s.board[12],uid:s.nextId++,hero:'frost_witch',cooldown:1000};
  cast(s,'frost_witch');close(e.slow,.6);close(e.slowTime,3);
  tick(s,3);close(e.slow,.5);close(e.slowTime,3);
  tick(s,3);close(e.slow,0);close(e.slowTime,0);
});

test('all existing slow skills resist basic refresh and expire to the active basic effect',()=>{
  for(const [id,amount,duration] of [['snow_rabbit',.5,6],['avalanche_maid',.5,4],['storm_sage',.6,4],['galaxy_whale',.6,4]]){
    const {s,e}=fixture(id),started=cast(s,id);
    for(let i=0;i<duration;i++){
      tick(s,.5);hit(s,e);close(e.slow,amount);close(e.slowTime,duration-(s.time-started));
      tick(s,.5-1/60);
    }
    close(e.slow,.4);assert.ok(e.slowTime>0&&e.slowTime<=2.4);
    tick(s,2.4);close(e.slow,0);close(e.slowTime,0);
  }
});

test('overlapping slow effects save and resume with identical expiry and movement',()=>{
  const {s,e}=fixture();cast(s,'frost_witch');tick(s,1);hit(s,e,'snow_rabbit');e.speed=30;
  const resumed=E.restore(E.serialize(s));assert.ok(resumed);s.events=[];
  tick(s,5);tick(resumed,5);assert.equal(E.serialize(s),E.serialize(resumed));
  close(e.slow,0);close(resumed.enemies[0].slow,0);
});

test('legacy slow saves retain their remaining effect once without letting basics renew it',()=>{
  const {s,e}=fixture();e.slow=.5;e.slowTime=5.9;delete e.slowEffects;
  const resumed=E.restore(E.serialize(s));assert.ok(resumed);const target=resumed.enemies[0];
  assert.equal(target.slowEffects.length,1);assert.equal(target.slowEffects[0].source,'legacy');
  close(target.slow,.5);close(target.slowTime,5.9);hit(resumed,target);
  resumed.board[12].cooldown=0;tick(resumed,5.9);close(target.slow,.4);
  const expired=fixture();expired.e.slow=.5;expired.e.slowTime=-.01;delete expired.e.slowEffects;
  const restored=E.restore(E.serialize(expired.s));assert.ok(restored);close(restored.enemies[0].slow,0);assert.deepEqual(restored.enemies[0].slowEffects,[]);
});

test('save validation rejects malformed or duplicate slow effects',()=>{
  const {s}=fixture();cast(s,'frost_witch');
  for(const effects of [null,{},[{source:'skill:frost_witch',amount:1,until:6}],[{source:'skill:frost_witch',amount:-.1,until:6}],[{source:'skill:frost_witch',amount:.5,until:-1}],[{source:'skill:frost_witch',amount:.5,until:null}],[{source:'skill:unknown',amount:.5,until:6}],[{source:'skill:frost_witch',amount:.5,until:6},{source:'skill:frost_witch',amount:.5,until:7}]]){
    const bad=JSON.parse(E.serialize(s));bad.enemies[0].slowEffects=effects;
    assert.equal(E.restore(bad),null,JSON.stringify(effects));
  }
});

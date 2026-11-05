import test from 'node:test';
import assert from 'node:assert/strict';
import {activeSkill, combatStats} from '../src/combat/engine.js';
import {recordPilotScene} from '../scripts/pilot-review-scenes.mjs';

const records = id=>recordPilotScene(id).frames.flatMap(f=>f.events);
const get = (events,type,hero)=>events.find(e=>e.type===type&&e.hero===hero);

test('Royal Strike records the result after a target changes state or disappears during its lock',()=>{
  const plain=records('royal');
  const hot=records('royal-heat');
  const hero='cherry_prince';
  const lock=get(plain,'targetLock',hero);
  const impact=get(plain,'finisherImpact',hero);
  const enhanced=get(hot,'finisherImpact',hero);
  assert.equal(impact.target,lock.uid);
  assert.equal(impact.enhanced,false);
  assert.ok(Math.abs(impact.time-lock.time-.3)<1e-9);
  assert.equal(enhanced.enhanced,true);
  assert.equal(enhanced.damage,impact.damage*2);

  const lost=records('royal-lost');
  assert.ok(get(lost,'finisherFizzle',hero));
  assert.equal(get(lost,'finisherImpact',hero),undefined);
});

test('Dragon Breath uses the same impact centre for the renderer and real damage, including a lethal hit',()=>{
  for (const [id,x] of [['breath',644],['breath-left',76]]) {
    const events=records(id);
    const skill=get(events,'skill','red_dragon');
    const hits=events.filter(e=>e.type==='hit'&&e.hero==='red_dragon'&&e.time===skill.time);
    assert.equal(skill.blast.x,x);
    assert.equal(skill.blast.radius,180);
    assert.deepEqual(skill.targets.map(e=>e.uid),hits.map(e=>e.uid));
    assert.equal(hits.length,4);
    assert.ok(events.some(e=>e.type==='kill'&&e.time===skill.time));
  }
});

test('Dragon basic impact keeps target-level enhancement inside its real splash',()=>{
  const events=records('breath-basic');
  const impact=get(events,'impact','red_dragon');
  const hits=events.filter(e=>e.type==='hit'&&e.hero==='red_dragon'&&e.time===impact.time);
  assert.equal(impact.radius,88);
  assert.deepEqual(impact.hitTargets.map(e=>e.uid),hits.map(e=>e.uid));
  assert.deepEqual(impact.hitTargets.map(e=>e.enhanced),[true,false]);
});

test('Aria indicators follow live recipients and the winning speed modifier',()=>{
  const {frames}=recordPilotScene('aria-focus');
  const start=frames[0].state;
  assert.equal(combatStats(start,start.board[13],13).sirenAura,true);
  assert.equal(combatStats(start,start.board[20],20).sirenAura,false);
  const live=frames.find(f=>f.events.some(e=>e.type==='summon')).state;
  const receiver=live.board[13], joined=live.board[16];
  assert.equal(live.buffSpotlight.haste,receiver.uid);
  assert.equal(combatStats(live,joined,16).sirenHaste,true);
  // A stronger global modifier wins for non-focus units. The focus recipient keeps Aria.
  const overlap=structuredClone(live);
  overlap.buffs.march=5;
  assert.equal(combatStats(overlap,receiver,13).sirenHaste,true);
  assert.equal(combatStats(overlap,joined,16).sirenHaste,false);
  const end=frames.at(-1).state;
  assert.equal(activeSkill(end,'siren'),null);
  assert.equal(combatStats(end,end.board[16],16).sirenHaste,false);
});

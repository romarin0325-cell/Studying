import test from 'node:test';
import assert from 'node:assert/strict';
import {BattleSession} from '../../js/battle/BattleSession.js';
import {DEFAULT_FORMATION} from '../../js/content/heroes.js';
import {STAGES} from '../../js/content/stages.js';
import {spawnEnemy,isWaveClear} from '../../js/battle/systems/WaveSystem.js';
import {updateBossAbilities} from '../../js/battle/systems/BossAbilitySystem.js';
import {castStarfall} from '../../js/battle/systems/CommandSystem.js';
import {calculateDirectDamage} from '../../js/battle/systems/DamageSystem.js';
import {updateMovement} from '../../js/battle/systems/MovementSystem.js';

function fixture(id){
  const stage=STAGES.find(stage=>stage.finalBossId===id);
  const session=new BattleSession({stageId:stage.id,formation:DEFAULT_FORMATION,seed:'boss-test'});
  session.applyNow('auto_place'); session.state.nextWave=10; session.applyNow('start_wave');
  const state=session.state; state.wave.spawnIndex=state.wave.spawnQueue.length;
  const boss=spawnEnemy(state,id); updateBossAbilities(state,8);
  assert.equal(boss.bossState.phase,'windup');
  return {state,boss,session};
}

test('six chapters retain four save IDs and introduce six exact requested bosses',()=>{
  assert.deepEqual(STAGES.map(s=>[s.id,s.name,s.finalBossId]),[
    ['ancient_ruins','마도제국','artificial_demon'],['crossroads','빛의 신전','love_iris'],
    ['long_boulevard','어둠의 신전','curse_iris'],['fairy_forest','요정의 숲','flora'],
    ['sunken_temple','해저 신전','poseidon'],['chaos_rift','혼돈의 틈','beelzebub']]);
  for(const stage of STAGES) assert.ok(stage.waves[4].hpMultiplier<stage.waves[9].hpMultiplier,'the mid-stage apparition is weaker');
});

test('prism guard changes real damage only after the warning, then expires',()=>{
  const {state,boss}=fixture('artificial_demon'),progress=boss.progress;
  const hit=()=>calculateDirectDamage({state,source:state.heroes[0],target:boss,baseDamage:100,attackType:'magic',attackKind:'basic',rng:{next:()=>.99}}).amount;
  const normal=hit(); updateMovement(state,1); assert.equal(boss.progress,progress,'windup holds the boss');
  updateBossAbilities(state,3.1); assert.equal(hit(),normal);
  updateBossAbilities(state,.1); assert.equal(boss.bossState.phase,'active'); assert.equal(hit(),normal*.65);
  updateBossAbilities(state,4); assert.equal(hit(),normal);
});

test('starfall interrupts a charge, prevents its effect, and exposes the boss',()=>{
  const {state,boss}=fixture('love_iris'); boss.hp=boss.maxHp*.6;
  boss.bossState.hpAtCharge=boss.hp;
  assert.equal(castStarfall(state,boss.x,boss.y),true);
  updateBossAbilities(state,1/60);
  assert.equal(boss.bossState.phase,'recovery'); assert.equal(boss.bossState.damageTaken,1.25);
  assert.equal(boss.hp,boss.maxHp*.6); assert.ok(state.events.some(e=>e.type==='boss_ability_interrupted'));
  assert.ok(!state.events.some(e=>e.type==='boss_ability_resolved'));
});

test('enough damage during the visible windup interrupts without stun',()=>{
  const {state,boss}=fixture('beelzebub'),core=state.core.durability;
  boss.hp-=boss.bossState.breakDamage;
  updateBossAbilities(state,.1); assert.equal(boss.bossState.interrupted,true);
  assert.equal(state.core.durability,core);
});

test('uninterrupted rose heal and curse delay resolve at cast completion',()=>{
  const rose=fixture('love_iris'); rose.boss.hp=rose.boss.maxHp*.5; rose.boss.bossState.hpAtCharge=rose.boss.hp;
  updateBossAbilities(rose.state,3.2); assert.ok(Math.abs(rose.boss.hp-rose.boss.maxHp*.56)<1e-8);
  const curse=fixture('curse_iris');
  updateBossAbilities(curse.state,3.2);
  assert.equal(curse.state.heroes.filter(h=>h.skillTimer===3).length,2);
  assert.equal(curse.state.events.filter(e=>e.type==='skill_delayed').length,2);
});

test('Flora summons real enemies on the current path and they keep the wave open',()=>{
  const {state,boss}=fixture('flora'); boss.progress=6.5;
  updateBossAbilities(state,3.2);
  const summoned=[...state.enemies.values()].filter(e=>e!==boss);
  assert.equal(summoned.length,2); assert.deepEqual(summoned.map(e=>e.progress),[5.5,4.5]);
  assert.ok(summoned.every(e=>e.enemyId==='regrowth_idol' && e.hp>0 && Number.isFinite(e.x)));
  boss.dead=true; assert.equal(isWaveClear(state),false);
});

test('Poseidon tide accelerates actual movement and expires',()=>{
  const {state,boss}=fixture('poseidon');
  updateBossAbilities(state,3.2); const before=boss.progress;
  updateMovement(state,1); assert.ok(Math.abs(boss.progress-before-boss.speed*1.7)<1e-9);
  updateBossAbilities(state,4); assert.equal(boss.bossState.speedMultiplier,1);
});

test('doom damages the core at resolution, pause freezes windup, dead bosses cannot finish',()=>{
  const f=fixture('beelzebub'); f.state.paused=true;
  const before=f.boss.bossState.remaining; f.session.step(1); assert.equal(f.boss.bossState.remaining,before);
  f.state.paused=false; updateBossAbilities(f.state,3.2); assert.equal(f.state.core.durability,9);
  const dead=fixture('beelzebub'); dead.boss.dead=true;
  updateBossAbilities(dead.state,10); assert.equal(dead.state.core.durability,10);
});

test('lethal remote doom ends the session once and clears living enemies without kill rewards',()=>{
  const {state,boss,session}=fixture('beelzebub');
  state.core.durability=1; boss.bossState.remaining=1/60;
  spawnEnemy(state,'rift_shade',{progress:2});
  const kills=state.heroes.reduce((sum,hero)=>sum+hero.stats.kills,0);
  session.consumeVisualEvents(); session.step(1/60);
  assert.equal(state.phase,'DEFEAT'); assert.equal(state.core.durability,0);
  assert.equal(state.registry.activeEnemyCount(),0); assert.equal(state.registry.projectiles.size,0);
  assert.equal(state.heroes.reduce((sum,hero)=>sum+hero.stats.kills,0),kills);
  assert.equal(session.consumeVisualEvents().filter(e=>e.type==='battle_defeated').length,1);
  session.step(10); assert.equal(session.consumeVisualEvents().length,0);
});

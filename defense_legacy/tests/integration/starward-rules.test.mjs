import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleSession } from '../../js/battle/BattleSession.js';
import { DEFAULT_FORMATION } from '../../js/content/heroes.js';
import { updateMovement } from '../../js/battle/systems/MovementSystem.js';
import { SaveRepositoryV2, MemoryStorage } from '../../js/persistence/SaveRepositoryV2.js';
import { validateCheckpoint } from '../../js/persistence/schemas.js';
import { updateWaveSpawning } from '../../js/battle/systems/WaveSystem.js';

function battle(difficultyId='easy') { const s=new BattleSession({stageId:'ancient_ruins',difficultyId,formation:DEFAULT_FORMATION,seed:'starward'});s.applyNow('auto_place');s.applyNow('start_wave');updateWaveSpawning(s.state,1/60);return s; }
test('starfall rejects empty, invalid and paused casts without consuming its one-wave charge',()=>{
  const session=battle();
  for(const [x,y] of [[NaN,2],[-1,1],[13,1],[5,11]])assert.equal(session.applyNow('cast_starfall',{x,y}),false);
  assert.equal(session.snapshot().starfallReady,true);
  const enemy=[...session.state.enemies.values()][0];
  session.applyNow('toggle_pause');assert.equal(session.applyNow('cast_starfall',{x:enemy.x,y:enemy.y}),false);session.applyNow('toggle_pause');
  const rng=session.state.waveRng.snapshot();
  assert.equal(session.applyNow('cast_starfall',{x:enemy.x,y:enemy.y}),true);
  assert.equal(enemy.statuses.stun.remaining,1.5);assert.equal(enemy.statuses.slow.remaining,4);
  assert.equal(session.snapshot().starfallReady,false);assert.equal(session.applyNow('cast_starfall',{x:enemy.x,y:enemy.y}),false);
  assert.deepEqual(session.state.waveRng.snapshot(),rng,'visual/player targeting does not consume combat RNG');
  session.state.phase='INTERMISSION';session.state.nextWave=2;session.applyNow('start_wave');assert.equal(session.snapshot().starfallReady,true);
});
test('the final boss reaching the core is a defeat even with World Shield',()=>{
  const session=battle();const state=session.state;
  state.heroes.find(h=>h.id==='guardian').selectedTraits.lv4='guardian_world_shield';
  const enemy=[...state.enemies.values()][0];enemy.isBoss=true;enemy.progress=state.stage.path.length;state.wave.number=10;
  updateMovement(state,1/60);assert.equal(state.phase,'DEFEAT');assert.equal(state.core.durability,0);
});
test('trial difficulty changes pressure and round-trips through an existing checkpoint schema',()=>{
  const story=battle(),trial=battle('normal');
  const easyEnemy=[...story.state.enemies.values()][0],trialEnemy=[...trial.state.enemies.values()][0];
  assert.ok(trialEnemy.maxHp>easyEnemy.maxHp);assert.ok(trialEnemy.speed>easyEnemy.speed);
  const repository=new SaveRepositoryV2({storage:new MemoryStorage()});trial.repository=repository;
  const checkpoint=trial.saveCheckpoint();assert.equal(validateCheckpoint(checkpoint).difficultyId,'normal');
  const restored=new BattleSession({checkpoint});assert.equal(restored.state.difficultyId,'normal');
});
test('journey medals keep the best stars and time separately per difficulty and reject corrupt saves',()=>{
  const storage=new MemoryStorage(),repository=new SaveRepositoryV2({storage});
  repository.recordVictory('ancient_ruins:easy',3,300);repository.recordVictory('ancient_ruins:easy',1,250);repository.recordVictory('ancient_ruins:normal',1,410);
  assert.deepEqual(repository.loadProgress()['ancient_ruins:easy'],{stars:3,seconds:250});
  assert.deepEqual(repository.loadProgress()['ancient_ruins:normal'],{stars:1,seconds:410});
  assert.equal(repository.recordVictory('x',Infinity,0),false);
  storage.setItem('starwardJourneyProgress','{"bad":{"stars":99,"seconds":-2}}');assert.deepEqual(repository.loadProgress(),{});
});

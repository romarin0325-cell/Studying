import assert from 'node:assert/strict';
import test from 'node:test';

import { BattleSession } from '../../js/battle/BattleSession.js';
import { createCheckpointFromState } from '../../js/battle/BattleState.js';
import { DEFAULT_FORMATION } from '../../js/content/heroes.js';
import { BATTLE_PHASE, FIXED_TICK_SECONDS } from '../../js/core/enums.js';

function boundaryHeroState(session) {
  return session.state.heroes.map((hero) => ({
    id: hero.id,
    direction: hero.direction,
    attackTimer: hero.attackTimer,
    skillTimer: hero.skillTimer,
    lastTargetId: hero.lastTargetId,
  }));
}

function heroStats(session) {
  return Object.fromEntries(session.state.heroes.map((hero) => [hero.id, { ...hero.stats }]));
}

function subtractStats(current, baseline) {
  return Object.fromEntries(Object.entries(current).map(([heroId, stats]) => [
    heroId,
    Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, value - baseline[heroId][key]])),
  ]));
}

function relativeEnemySerial(id, serialAtWaveStart) {
  if (id === null) return null;
  const serial = Number(String(id).match(/(\d+)$/)?.[1]);
  return Number.isFinite(serial) ? serial - serialAtWaveStart : id;
}

function nextWaveDigest(session, { statsAtWaveStart, serialAtWaveStart }) {
  const state = session.state;
  return {
    phase: state.phase,
    coreDurability: state.core.durability,
    crystals: state.crystals,
    nextWave: state.nextWave,
    wave: {
      number: state.wave.number,
      spawnIndex: state.wave.spawnIndex,
      spawnTimer: state.wave.spawnTimer,
      currentCoreDamaged: state.wave.currentCoreDamaged,
      previousCoreDamaged: state.wave.previousCoreDamaged,
    },
    waveRng: state.waveRng.snapshot(),
    heroes: state.heroes.map((hero) => ({
      id: hero.id,
      direction: hero.direction,
      attackTimer: hero.attackTimer,
      skillTimer: hero.skillTimer,
      lastTarget: relativeEnemySerial(hero.lastTargetId, serialAtWaveStart),
      buffs: [...hero.buffs.keys()],
    })),
    heroStatDeltas: subtractStats(heroStats(session), statsAtWaveStart),
    enemies: [...state.enemies.values()]
      .sort((left, right) => left.spawnOrder - right.spawnOrder)
      .map((enemy) => ({
        spawnOrder: enemy.spawnOrder - serialAtWaveStart,
        enemyId: enemy.enemyId,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        progress: enemy.progress,
        x: enemy.x,
        y: enemy.y,
        dead: enemy.dead,
        reachedCore: enemy.reachedCore,
        statuses: structuredClone(enemy.statuses),
      })),
  };
}

test('restored wave boundary starts and advances the next wave like uninterrupted play', () => {
  const continuous = new BattleSession({
    stageId: 'ancient_ruins',
    difficultyId: 'easy',
    formation: DEFAULT_FORMATION,
    seed: 'checkpoint-continuity',
  });
  assert.equal(continuous.applyNow('auto_place'), true);

  const initialRestored = new BattleSession({ checkpoint: createCheckpointFromState(continuous.state) });
  assert.equal(initialRestored.state.phase, BATTLE_PHASE.PREPARATION);
  assert.equal(initialRestored.state.nextWave, 1);
  assert.equal(initialRestored.state.wave.completedCount, 0);
  initialRestored.destroy();

  assert.equal(continuous.applyNow('start_wave'), true);
  while (continuous.state.phase === BATTLE_PHASE.WAVE_RUNNING) {
    continuous.step(FIXED_TICK_SECONDS);
  }
  assert.equal(continuous.state.phase, BATTLE_PHASE.INTERMISSION);
  assert.equal(continuous.state.nextWave, 2);

  const restored = new BattleSession({ checkpoint: createCheckpointFromState(continuous.state) });
  assert.equal(restored.state.phase, BATTLE_PHASE.INTERMISSION);
  assert.equal(restored.state.wave.completedCount, restored.state.nextWave - 1);

  const continuousStats = heroStats(continuous);
  const restoredStats = heroStats(restored);
  const continuousSerial = continuous.state.wave.spawnSerial;
  const restoredSerial = restored.state.wave.spawnSerial;

  assert.equal(continuous.applyNow('start_wave'), true);
  assert.equal(restored.applyNow('start_wave'), true);
  assert.deepEqual(
    boundaryHeroState(continuous),
    boundaryHeroState(restored),
    'wave start must normalize cooldown and targeting state omitted by the checkpoint schema',
  );

  for (let tick = 0; tick < 600; tick += 1) {
    continuous.step(FIXED_TICK_SECONDS);
    restored.step(FIXED_TICK_SECONDS);
  }

  assert.deepEqual(
    nextWaveDigest(continuous, { statsAtWaveStart: continuousStats, serialAtWaveStart: continuousSerial }),
    nextWaveDigest(restored, { statsAtWaveStart: restoredStats, serialAtWaveStart: restoredSerial }),
  );

  continuous.destroy();
  restored.destroy();
});

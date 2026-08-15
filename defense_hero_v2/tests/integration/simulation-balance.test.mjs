import assert from 'node:assert/strict';
import { availableParallelism } from 'node:os';
import test from 'node:test';
import {
  isMainThread,
  parentPort,
  Worker,
  workerData,
} from 'node:worker_threads';

import { BattleSession } from '../../js/battle/BattleSession.js';
import { ENTITY_ACTIVE_CAPS } from '../../js/battle/EntityRegistry.js';
import { createCheckpointFromState } from '../../js/battle/BattleState.js';
import { BATTLE_PHASE, FIXED_TICK_SECONDS } from '../../js/core/enums.js';
import { MAIN_HEROES, NORMAL_HEROES } from '../../js/content/heroes.js';
import { STAGES } from '../../js/content/stages.js';
import { validateCheckpoint } from '../../js/persistence/schemas.js';

const TERMINAL_PHASES = new Set([BATTLE_PHASE.VICTORY, BATTLE_PHASE.DEFEAT]);
const MAX_TICKS = 60 * 60 * 15;
const TARGETS = Object.freeze({
  ancient_ruins: { minimumClearRate: 0.80, minimumMinutes: 7, maximumMinutes: 9 },
  chaos_rift: { minimumClearRate: 0.65, minimumMinutes: 9, maximumMinutes: 11 },
});
// Conservative input-time allowance for the automated policy: 15 seconds for
// initial review/placement plus 10 seconds at each of the nine intermissions
// to spend crystals, choose Lv4 traits and consider repositioning. This is
// deliberately separate from deterministic combat elapsed time.
const STANDARD_INPUT_SECONDS = 15 + (9 * 10);

function choose(values, count, offset = 0, prefix = [], output = []) {
  if (prefix.length === count) {
    output.push(prefix);
    return output;
  }
  for (let index = offset; index <= values.length - (count - prefix.length); index += 1) {
    choose(values, count, index + 1, [...prefix, values[index]], output);
  }
  return output;
}

export function enumerateValidFormations() {
  const normalCombinations = choose(NORMAL_HEROES.map(({ id }) => id), 4);
  return MAIN_HEROES.flatMap(({ id: mainId }) => normalCombinations.map((heroIds) => ({
    mainId,
    heroIds: [...heroIds],
  })));
}

function firstTraitAtLevel(hero, level) {
  return hero.definition.traits.find((trait) => trait.level === level)?.id ?? null;
}

// The launch balance baseline deliberately makes no matchup-specific choices:
// auto-place once, then spend every available crystal on the lowest-level hero,
// breaking ties by the fixed formation slot and choosing the first listed trait.
// With 15 crystals this brings all five heroes to Lv4 before wave 10.
function applyStandardGrowthPolicy(session) {
  while (session.state.crystals > 0) {
    const hero = [...session.state.heroes]
      .filter((candidate) => candidate.level < 6)
      .sort((left, right) => left.level - right.level || left.slot - right.slot)[0];
    if (!hero) break;
    const nextLevel = hero.level + 1;
    const traitId = [4, 6].includes(nextLevel) ? firstTraitAtLevel(hero, nextLevel) : null;
    const previousCrystals = session.state.crystals;
    assert.equal(
      session.applyNow('level_up', { heroId: hero.id, traitId }),
      true,
      `standard growth failed for ${hero.id} Lv${nextLevel}`,
    );
    assert.equal(session.state.crystals, previousCrystals - 1);
  }
}

function assertFiniteRuntime(state, label) {
  const finite = (value, field) => {
    if (!Number.isFinite(value)) throw new Error(`${label}: ${field} is not finite (${value})`);
  };
  finite(state.tick, 'tick');
  finite(state.elapsedSeconds, 'elapsedSeconds');
  finite(state.core.durability, 'core.durability');
  finite(state.crystals, 'crystals');
  finite(state.nextWave, 'nextWave');
  finite(state.wave.spawnIndex, 'wave.spawnIndex');
  finite(state.wave.spawnTimer, 'wave.spawnTimer');
  for (const hero of state.heroes) {
    finite(hero.level, `${hero.id}.level`);
    finite(hero.attackTimer, `${hero.id}.attackTimer`);
    finite(hero.skillTimer, `${hero.id}.skillTimer`);
    finite(hero.stats.damage, `${hero.id}.damage`);
    finite(hero.stats.kills, `${hero.id}.kills`);
    if (hero.placed) {
      finite(hero.x, `${hero.id}.x`);
      finite(hero.y, `${hero.id}.y`);
    }
  }
  for (const enemy of state.enemies.values()) {
    finite(enemy.hp, `${enemy.id}.hp`);
    finite(enemy.maxHp, `${enemy.id}.maxHp`);
    finite(enemy.x, `${enemy.id}.x`);
    finite(enemy.y, `${enemy.id}.y`);
    finite(enemy.progress, `${enemy.id}.progress`);
    for (const [statusId, status] of Object.entries(enemy.statuses ?? {})) {
      finite(status.remaining, `${enemy.id}.${statusId}.remaining`);
      if (status.stacks !== undefined) finite(status.stacks, `${enemy.id}.${statusId}.stacks`);
    }
  }
}

function assertEntityCaps(state, maxima, label) {
  for (const [type, cap] of Object.entries(ENTITY_ACTIVE_CAPS)) {
    const size = state.registry[type].size;
    maxima[type] = Math.max(maxima[type] ?? 0, size);
    assert.ok(size <= cap, `${label}: ${type} ${size} exceeded cap ${cap}`);
  }
}

function assertCheckpointBoundary(session, label) {
  const checkpoint = createCheckpointFromState(session.state);
  assert.doesNotThrow(() => validateCheckpoint(checkpoint), `${label}: checkpoint schema`);
  assert.equal(checkpoint.nextWave, session.state.nextWave, `${label}: next wave`);
  assert.equal(checkpoint.coreDurability, session.state.core.durability, `${label}: core`);
  assert.equal(Object.keys(checkpoint.placements).length, 5, `${label}: placements`);

  const restored = new BattleSession({ checkpoint });
  assert.equal(restored.state.phase, BATTLE_PHASE.INTERMISSION, `${label}: restored phase`);
  assert.equal(restored.state.nextWave, session.state.nextWave, `${label}: restored next wave`);
  assert.equal(restored.state.core.durability, session.state.core.durability, `${label}: restored core`);
  assert.deepEqual(
    restored.state.heroes.map(({ id, level, x, y, selectedTraits }) => ({ id, level, x, y, selectedTraits })),
    session.state.heroes.map(({ id, level, x, y, selectedTraits }) => ({ id, level, x, y, selectedTraits })),
    `${label}: restored formation state`,
  );
  restored.destroy();
}

function terminalDigest(result) {
  return {
    formation: result.formation,
    stageId: result.stageId,
    phase: result.phase,
    victory: result.victory,
    wave: result.wave,
    completedWaves: result.completedWaves,
    coreDurability: result.coreDurability,
    crystals: result.crystals,
    ticks: result.ticks,
    elapsedSeconds: result.elapsedSeconds,
    levels: result.levels,
    traits: result.traits,
    heroStats: result.heroStats,
  };
}

export function simulateFormation(stageId, formation, { seed = `balance:v2:${stageId}` } = {}) {
  const checkpoints = [];
  const repository = {
    saveCheckpoint(checkpoint) {
      validateCheckpoint(checkpoint);
      checkpoints.push(checkpoint);
      return structuredClone(checkpoint);
    },
    clearCheckpoint() {},
  };
  const session = new BattleSession({
    stageId,
    difficultyId: 'easy',
    formation,
    seed,
    repository,
  });
  const label = `${stageId}/${formation.mainId}+${formation.heroIds.join('+')}`;
  const maxima = Object.fromEntries(Object.keys(ENTITY_ACTIVE_CAPS).map((type) => [type, 0]));
  assert.equal(session.applyNow('auto_place'), true, `${label}: auto-place`);
  assert.equal(session.state.heroes.every((hero) => hero.placed), true, `${label}: five heroes placed`);

  let observedCompletedWaves = 0;
  while (!TERMINAL_PHASES.has(session.state.phase) && session.state.tick < MAX_TICKS) {
    if ([BATTLE_PHASE.PREPARATION, BATTLE_PHASE.INTERMISSION].includes(session.state.phase)) {
      if (session.state.phase === BATTLE_PHASE.INTERMISSION) {
        assert.equal(
          session.state.wave.completedCount,
          observedCompletedWaves + 1,
          `${label}: wave completion must occur exactly once`,
        );
        observedCompletedWaves = session.state.wave.completedCount;
        assertCheckpointBoundary(session, `${label}/after-wave-${observedCompletedWaves}`);
      }
      applyStandardGrowthPolicy(session);
      assert.equal(session.applyNow('start_wave'), true, `${label}: start wave ${session.state.nextWave}`);
    }

    session.step(FIXED_TICK_SECONDS);
    assertEntityCaps(session.state, maxima, label);
    if (session.state.tick % 60 === 0 || TERMINAL_PHASES.has(session.state.phase)) {
      assertFiniteRuntime(session.state, label);
    }
  }

  assert.ok(TERMINAL_PHASES.has(session.state.phase), `${label}: did not terminate within 15 simulated minutes`);
  assert.ok(session.state.tick < MAX_TICKS, `${label}: tick guard reached`);
  assert.equal(session.state.result?.victory, session.state.phase === BATTLE_PHASE.VICTORY, `${label}: result/phase`);
  assert.equal(session.state.registry.activeEnemyCount(), 0, `${label}: terminal active enemies`);
  assert.ok(checkpoints.length >= 2, `${label}: checkpoint writes`);
  const updateSamples = [...session.state.metrics.updateSamples];
  const result = {
    formation: { mainId: formation.mainId, heroIds: [...formation.heroIds] },
    stageId,
    phase: session.state.phase,
    victory: session.state.phase === BATTLE_PHASE.VICTORY,
    wave: session.state.result.wave,
    completedWaves: session.state.wave.completedCount,
    coreDurability: session.state.core.durability,
    crystals: session.state.crystals,
    ticks: session.state.tick,
    elapsedSeconds: session.state.elapsedSeconds,
    levels: Object.fromEntries(session.state.heroes.map((hero) => [hero.id, hero.level])),
    traits: Object.fromEntries(session.state.heroes.map((hero) => [hero.id, { ...hero.selectedTraits }])),
    heroStats: Object.fromEntries(session.state.heroes.map((hero) => [hero.id, { ...hero.stats }])),
    maxima,
    updateSamples,
  };
  session.destroy();
  return result;
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function summarize(stageId, results) {
  const victories = results.filter(({ victory }) => victory);
  const combatMinutes = victories.map(({ elapsedSeconds }) => elapsedSeconds / 60);
  const estimatedPlayMinutes = victories.map(
    ({ elapsedSeconds }) => (elapsedSeconds + STANDARD_INPUT_SECONDS) / 60,
  );
  const updateSamples = results.flatMap(({ updateSamples }) => updateSamples);
  return {
    stageId,
    battles: results.length,
    victories: victories.length,
    defeats: results.length - victories.length,
    clearRate: victories.length / results.length,
    standardInputSeconds: STANDARD_INPUT_SECONDS,
    minimumCombatMinutes: Math.min(...combatMinutes),
    medianCombatMinutes: percentile(combatMinutes, 0.5),
    maximumCombatMinutes: Math.max(...combatMinutes),
    minimumEstimatedPlayMinutes: Math.min(...estimatedPlayMinutes),
    medianEstimatedPlayMinutes: percentile(estimatedPlayMinutes, 0.5),
    maximumEstimatedPlayMinutes: Math.max(...estimatedPlayMinutes),
    minimumVictoryCore: Math.min(...victories.map(({ coreDurability }) => coreDurability)),
    medianVictoryCore: percentile(victories.map(({ coreDurability }) => coreDurability), 0.5),
    updateP95Ms: percentile(updateSamples, 0.95),
    maxima: Object.fromEntries(Object.keys(ENTITY_ACTIVE_CAPS).map((type) => [
      type,
      Math.max(...results.map((result) => result.maxima[type])),
    ])),
  };
}

const formations = enumerateValidFormations();
let matrixPromise;

function runSimulationWorker(jobs) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), {
      type: 'module',
      workerData: { simulationBalanceWorker: true, jobs },
    });
    let settled = false;
    worker.once('message', (message) => {
      settled = true;
      if (message.error) reject(new Error(message.error));
      else resolve(message.results);
    });
    worker.once('error', (error) => {
      settled = true;
      reject(error);
    });
    worker.once('exit', (code) => {
      if (!settled && code !== 0) reject(new Error(`simulation worker exited with code ${code}`));
    });
  });
}

function runBalanceMatrix() {
  matrixPromise ??= (async () => {
    const jobs = STAGES.flatMap((stage) => formations.map((formation, formationIndex) => ({
      stageId: stage.id,
      formationIndex,
      formation,
    })));
    const workerCount = Math.min(4, availableParallelism(), jobs.length);
    const chunks = Array.from({ length: workerCount }, () => []);
    jobs.forEach((job, index) => chunks[index % workerCount].push(job));
    const batches = await Promise.all(chunks.map(runSimulationWorker));
    const matrix = Object.fromEntries(STAGES.map((stage) => [stage.id, Array(formations.length)]));
    for (const result of batches.flat()) matrix[result.stageId][result.formationIndex] = result.result;
    return matrix;
  })();
  return matrixPromise;
}

if (!isMainThread && workerData?.simulationBalanceWorker) {
  try {
    const results = workerData.jobs.map(({ stageId, formationIndex, formation }) => ({
      stageId,
      formationIndex,
      result: simulateFormation(stageId, formation),
    }));
    parentPort.postMessage({ results });
  } catch (error) {
    parentPort.postMessage({ error: error?.stack ?? String(error) });
  } finally {
    parentPort.close();
  }
} else {
  test('enumerates exactly all 4 × C(6,4) = 60 legal launch formations', () => {
    assert.equal(MAIN_HEROES.length, 4);
    assert.equal(NORMAL_HEROES.length, 6);
    assert.equal(formations.length, 60);
    assert.equal(new Set(formations.map(({ mainId, heroIds }) => `${mainId}:${heroIds.join(',')}`)).size, 60);
    for (const formation of formations) {
      assert.ok(MAIN_HEROES.some(({ id }) => id === formation.mainId));
      assert.equal(formation.heroIds.length, 4);
      assert.equal(new Set(formation.heroIds).size, 4);
      assert.ok(formation.heroIds.every((id) => NORMAL_HEROES.some((hero) => hero.id === id)));
    }
  });

  test('all 60 formations terminate deterministically on both fixed Easy stages within caps', async (context) => {
    const matrix = await runBalanceMatrix();
    for (const stage of STAGES) {
      const results = matrix[stage.id];
      assert.equal(results.length, 60);
      assert.ok(results.every(({ phase }) => TERMINAL_PHASES.has(phase)));
      const summary = summarize(stage.id, results);
      context.diagnostic(`BALANCE ${JSON.stringify(summary)}`);
      assert.ok(summary.updateP95Ms <= 4, `${stage.id}: update p95 ${summary.updateP95Ms}ms exceeds 4ms`);
      for (const [type, cap] of Object.entries(ENTITY_ACTIVE_CAPS)) {
        assert.ok(summary.maxima[type] <= cap, `${stage.id}: ${type} cap`);
      }
    }
  });

  test('standard auto-placement and balanced Lv4 growth meet launch Easy clear-rate gates', async (context) => {
    const matrix = await runBalanceMatrix();
    for (const stage of STAGES) {
      const summary = summarize(stage.id, matrix[stage.id]);
      const target = TARGETS[stage.id];
      assert.ok(
        summary.clearRate >= target.minimumClearRate,
        `${stage.id}: ${(summary.clearRate * 100).toFixed(1)}% < ${(target.minimumClearRate * 100).toFixed(0)}% clear-rate gate`,
      );
      assert.ok(
        summary.medianEstimatedPlayMinutes >= target.minimumMinutes
          && summary.medianEstimatedPlayMinutes <= target.maximumMinutes,
        `${stage.id}: estimated median ${summary.medianEstimatedPlayMinutes.toFixed(2)} min is outside ${target.minimumMinutes}-${target.maximumMinutes} min`,
      );
      context.diagnostic(
        `${stage.id}: ${(summary.clearRate * 100).toFixed(1)}% clear; combat ${summary.minimumCombatMinutes.toFixed(2)}-${summary.maximumCombatMinutes.toFixed(2)} min (median ${summary.medianCombatMinutes.toFixed(2)}); estimated play +${summary.standardInputSeconds}s input ${summary.minimumEstimatedPlayMinutes.toFixed(2)}-${summary.maximumEstimatedPlayMinutes.toFixed(2)} min (median ${summary.medianEstimatedPlayMinutes.toFixed(2)})`,
      );
    }
  });

  test('identical seed, formation and policy reproduce the exact terminal combat digest', async () => {
    const matrix = await runBalanceMatrix();
    const formation = formations[0];
    const first = matrix.ancient_ruins[0];
    const replay = simulateFormation('ancient_ruins', formation);
    assert.deepEqual(terminalDigest(replay), terminalDigest(first));
  });
}

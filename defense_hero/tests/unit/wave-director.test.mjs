import assert from "node:assert/strict";
import test from "node:test";

import { buildStagePlan } from "../../js/battle/StageBuilder.js";
import { SeededRng } from "../../js/battle/SeededRng.js";
import { STAGE_DEFINITIONS } from "../../js/data/stages.js";

const ELITE_PREFIX_POOL = ["swift", "steel", "regeneration", "unyielding"];

test("WaveDirector fills deterministic stage budgets with allowed packages", () => {
  for (const stage of STAGE_DEFINITIONS) {
    const allowed = new Set(stage.allowedWavePackageIds);
    for (let sample = 0; sample < 160; sample += 1) {
      const options = { stageNumber: stage.number, seed: `BUDGET-${stage.number}-${sample}`, difficultyId: "standard" };
      const plan = buildStagePlan(options);
      const replay = buildStagePlan(options);
      const packageWaves = plan.waves.filter((wave) => wave.budgetCost > 0);

      assert.equal(plan.packageBudgetExceeded, false);
      assert.ok(plan.packageBudgetUsed <= plan.packageBudget);
      assert.equal(plan.packageBudgetRemaining, plan.packageBudget - plan.packageBudgetUsed);
      assert.equal(packageWaves.length, stage.waveCount);
      assert.ok(packageWaves.every((wave) => allowed.has(wave.packageId)));
      assert.deepEqual(
        packageWaves.map((wave) => [wave.packageId, wave.budgetCost]),
        replay.waves.filter((wave) => wave.budgetCost > 0).map((wave) => [wave.packageId, wave.budgetCost]),
      );
    }
  }
});

test("WaveDirector applies air-only and cleanse/regeneration incompatibilities", () => {
  const airPlan = buildStagePlan({
    stageNumber: 4,
    seed: "AIR-ONLY-GUARD",
    difficultyId: "standard",
    trainingOverrides: { wavePackageId: "wave_aerial_scatter" },
  });
  assert.ok(airPlan.incompatibleTags.includes("air_only_stage"));
  assert.ok(airPlan.spawnSpecs.some((spawn) => !spawn.isBoss && spawn.enemyId !== "aerial"));

  const seed = "regen-151";
  const cleansePlan = buildStagePlan({
    stageNumber: 5,
    seed,
    difficultyId: "standard",
    trainingOverrides: { mutator: "mutator_cleanse" },
  });
  assert.ok(cleansePlan.waves.some((wave) => wave.packageId === "wave_cleanse_procession"));
  assert.ok(cleansePlan.incompatibleTags.includes("multiple_regeneration_elites"));
  const eliteWaveIndex = cleansePlan.waves.findIndex((wave) => wave.packageId === "wave_elite_hunt");
  assert.ok(eliteWaveIndex >= 0);
  const rawElitePrefixes = [0, 1, 2].map((spawnIndex) => (
    new SeededRng(`${seed}::stage:5::node:0`)
      .fork(`wave:${eliteWaveIndex}`)
      .fork(`spawn:0:${spawnIndex}`)
      .pick(ELITE_PREFIX_POOL)
  ));
  assert.ok(rawElitePrefixes.filter((prefix) => prefix === "regeneration").length >= 2);
  assert.ok(cleansePlan.spawnSpecs.filter((spawn) => spawn.elitePrefix === "regeneration").length <= 1);
});

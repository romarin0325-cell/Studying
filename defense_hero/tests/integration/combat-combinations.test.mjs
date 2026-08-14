import test from "node:test";
import assert from "node:assert/strict";

import { BattleEngine } from "../../js/battle/BattleEngine.js";

function combatPlan({ hp = 10000, count = 1, enemyId = "normal", elements = ["fire"] } = {}) {
  const cells = Array.from({ length: 11 }, (_, col) => ({ col, row: 3 }));
  const lower = Array.from({ length: 11 }, (_, col) => ({ col, row: 5 - Math.min(2, Math.max(0, col - 8)) }));
  const spawnSpecs = Array.from({ length: count }, (_, index) => ({
    id: `combo_spawn_${index}`,
    enemyId,
    element: elements[index % elements.length],
    pathId: "path_1",
    pathIndex: 0,
    spawnAt: index * 0.05,
  }));
  return {
    id: "combo_stage",
    stageNumber: 1,
    seed: "combat-combinations",
    difficultyId: "standard",
    cols: 13,
    rows: 8,
    grid: { cols: 13, rows: 8 },
    core: { col: 10, row: 3 },
    paths: [{ id: "path_1", cells }, { id: "path_2", cells: lower }],
    obstacles: [],
    leaderNodes: [{ col: 2, row: 2 }, { col: 5, row: 2 }],
    specialTiles: [],
    elementProfile: { primaryElement: elements[0], weights: { [elements[0]]: 1 } },
    threats: [enemyId],
    mutator: null,
    waves: [{ id: "combo_wave", index: 0, startsAt: 0, endsSpawningAt: count * 0.05, threats: [enemyId], spawns: spawnSpecs }],
    spawnSpecs,
    totalEnemies: count,
    maxActiveEnemies: 65,
    baseEnemyHp: hp,
  };
}

function stepFor(engine, seconds) {
  for (let frame = 0; frame < Math.ceil(seconds * 60) && engine.getSnapshot().phase === "running"; frame += 1) engine.step(1 / 60);
  return engine.getSnapshot();
}

function placeAndStart(engine, placements) {
  for (const [id, col, row] of placements) assert.equal(engine.place(id, col, row), true, `failed to place ${id}`);
  assert.equal(engine.start(), true);
  engine.step(1 / 60);
}

test("Rumi A, Gray B and Time Magician A shorten Gray delay from 3.0s to 1.8s while Moon Bless is active", () => {
  const plan = combatPlan();
  const engine = new BattleEngine({
    stagePlan: plan,
    deck: { leaderId: "rumi", companionIds: ["gray", "time_magician"] },
    levels: { rumi: 4, gray: 3, time_magician: 3 },
    branches: { rumi: "A", gray: "B", time_magician: "A" },
    seed: "combo-delay-1.8",
    gold: 999,
  });
  placeAndStart(engine, [["rumi", 2, 2], ["gray", 3, 2], ["time_magician", 4, 2]]);
  assert.equal(engine.castLeaderActive(1, 3), true);
  assert.equal(engine.fieldBuffs.has("moon_bless"), true);
  const gray = engine.registry.allies.get("ally_gray");
  gray.delayedClock = 0;
  engine.step(1 / 60);
  const delayed = engine.getSnapshot().areaEffects.find((area) => area.kind === "delayed_attack" && area.sourceId === gray.id);
  assert.ok(delayed);
  assert.equal(gray.traits.delayedStrike.delay, 3);
  assert.ok(Math.abs((delayed.delay + 1 / 60) - 1.8) < 1e-9, `expected a 1.8s scheduled delay, got ${delayed.delay}`);
  assert.equal(engine.fieldBuffs.has("moon_bless"), true);
  engine.destroy();
});

test("Zeke A with Overflame caps burn at seven and does not recursively chain deaths", () => {
  const plan = combatPlan({ hp: 1000, count: 3, elements: ["water"] });
  const engine = new BattleEngine({
    stagePlan: plan,
    deck: { leaderId: "zeke", companionIds: [] },
    levels: { zeke: 5 },
    branches: { zeke: "A" },
    relics: ["relic_overflame"],
    seed: "combo-overflame-bounded",
    gold: 999,
  });
  placeAndStart(engine, [["zeke", 2, 2]]);
  stepFor(engine, 0.2);
  const enemies = [...engine.registry.enemies.values()];
  assert.equal(enemies.length, 3);
  for (const enemy of enemies) {
    enemy.x = 2;
    enemy.y = 3;
    enemy.hp = enemy === enemies[0] ? 130 : 1000;
    engine.applyStatus(enemy, "stun", { duration: 5 });
  }
  engine.applyStatus(enemies[0], "burn", { stacks: 20, duration: 8 }, engine.registry.allies.get("ally_zeke"));
  assert.equal(enemies[0].statuses.stacks("burn"), 7);
  assert.equal(engine.castLeaderActive(2, 3), true);
  const snapshot = engine.getSnapshot();
  assert.equal(snapshot.events.filter((event) => event.type === "burn_detonation_spread").length, 1);
  assert.ok(snapshot.stats.kills <= 3);
  assert.ok(snapshot.enemies.every((enemy) => (enemy.statuses.burn?.stacks ?? 0) >= 0));
  engine.destroy();
});

test("Cinderella A consume and Snow Rabbit B splash in the same frame never make corrosion negative", () => {
  const plan = combatPlan({ hp: 100000, count: 2, enemyId: "armored", elements: ["water"] });
  const engine = new BattleEngine({
    stagePlan: plan,
    deck: { leaderId: "cinderella", companionIds: ["snow_rabbit"] },
    levels: { cinderella: 6, snow_rabbit: 5 },
    branches: { cinderella: "A", snow_rabbit: "B" },
    seed: "combo-corrosion-same-frame",
    gold: 999,
  });
  placeAndStart(engine, [["cinderella", 2, 2], ["snow_rabbit", 3, 2]]);
  stepFor(engine, 0.1);
  const target = [...engine.registry.enemies.values()][0];
  target.x = 2;
  target.y = 3;
  engine.applyStatus(target, "stun", { duration: 5 });
  engine.applyStatus(target, "corrosion", { stacks: 3, duration: 8 });
  const snow = engine.registry.allies.get("ally_snow_rabbit");
  snow.hitCount = 2;
  snow.attackCooldown = 0;
  assert.equal(engine.castLeaderActive(target.x, target.y), true);
  engine.step(1 / 60);
  const snapshot = engine.getSnapshot();
  assert.ok((snapshot.enemies.find((enemy) => enemy.id === target.id)?.statuses.corrosion?.stacks ?? 0) >= 0);
  for (const event of snapshot.events.filter((entry) => entry.type === "corrosion_break")) assert.ok(event.remainingStacks >= 0);
  engine.destroy();
});

test("armored fire, water and dark variants retain type stats; only advantage is exactly 1.20", () => {
  const elements = ["fire", "water", "dark"];
  const plan = combatPlan({ hp: 1000, count: 3, enemyId: "armored", elements });
  const engine = new BattleEngine({
    stagePlan: plan,
    deck: { leaderId: "rumi", companionIds: [] },
    seed: "combo-armored-elements",
    gold: 999,
    settings: { elementRulesEnabled: true, elementMultiplier: 1.2 },
  });
  placeAndStart(engine, [["rumi", 2, 2]]);
  stepFor(engine, 0.2);
  const enemies = [...engine.registry.enemies.values()].sort((left, right) => elements.indexOf(left.element) - elements.indexOf(right.element));
  assert.equal(enemies.length, 3);
  const statView = (enemy) => ({ maxHp: enemy.maxHp, speed: enemy.speed, physicalResist: enemy.physicalResist, magicResist: enemy.magicResist, coreDamage: enemy.coreDamage, tags: enemy.tags });
  assert.deepEqual(statView(enemies[0]), statView(enemies[1]));
  assert.deepEqual(statView(enemies[0]), statView(enemies[2]));
  const source = engine.registry.allies.get("ally_rumi");
  source.element = "water";
  const results = Object.fromEntries(enemies.map((enemy) => [enemy.element, engine.dealDamage(source, enemy, { amount: 100, damageType: "true", canCrit: false })]));
  assert.equal(results.fire.elementMultiplier, 1.2);
  assert.equal(results.fire.amount, 120);
  assert.equal(results.water.elementMultiplier, 1);
  assert.equal(results.water.amount, 100);
  assert.equal(results.dark.elementMultiplier, 1);
  assert.equal(results.dark.amount, 100);
  engine.destroy();
});

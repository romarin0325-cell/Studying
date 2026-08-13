import test from "node:test";
import assert from "node:assert/strict";

import { buildStagePlan } from "../../js/battle/StageBuilder.js";
import { BattleEngine } from "../../js/battle/BattleEngine.js";
import { FieldBuffSlots, StatusCollection, resolveDamage } from "../../js/battle/CombatRules.js";

const DECK = Object.freeze({
  leaderId: "rumi",
  companionIds: ["guardian", "silver_rabbit", "snow_rabbit", "gray"],
});

function straightPlan({ hp = 8, count = 1, element = "fire", coreDamageEnemyId = "normal" } = {}) {
  const cells = Array.from({ length: 11 }, (_, col) => ({ col, row: 3 }));
  const second = Array.from({ length: 11 }, (_, col) => ({ col, row: 5 - Math.min(2, Math.max(0, col - 8)) }));
  const spawns = Array.from({ length: count }, (_, index) => ({
    id: `test_spawn_${index}`,
    enemyId: coreDamageEnemyId,
    element,
    pathId: "path_1",
    pathIndex: 0,
    spawnAt: index * 0.2,
  }));
  return {
    id: "test_stage",
    stageNumber: 1,
    seed: "battle-unit",
    difficultyId: "standard",
    cols: 13,
    rows: 8,
    grid: { cols: 13, rows: 8 },
    core: { col: 10, row: 3 },
    paths: [{ id: "path_1", cells }, { id: "path_2", cells: second }],
    obstacles: [{ col: 2, row: 0 }],
    leaderNodes: [{ col: 5, row: 2 }, { col: 8, row: 1 }, { col: 12, row: 7 }],
    specialTiles: [{ id: "test_conduit", type: "conduit", col: 4, row: 2 }],
    elementProfile: { primaryElement: element, secondaryElement: "water", weights: { [element]: 0.7, water: 0.3 }, maxElementsPerGroup: 2 },
    threats: [coreDamageEnemyId],
    mutator: null,
    waves: [{ id: "test_wave", index: 0, startsAt: 0, endsSpawningAt: count * 0.2, threats: [coreDamageEnemyId], spawns }],
    spawnSpecs: spawns,
    totalEnemies: count,
    maxActiveEnemies: 65,
    baseEnemyHp: hp,
  };
}

function runFor(engine, seconds, step = 1 / 60) {
  const iterations = Math.ceil(seconds / step);
  for (let index = 0; index < iterations && engine.getSnapshot().phase === "running"; index += 1) engine.step(step);
  return engine.getSnapshot();
}

function digest(snapshot) {
  return {
    phase: snapshot.phase,
    time: Number(snapshot.time.toFixed(5)),
    core: snapshot.core,
    gold: snapshot.gold,
    enemies: snapshot.enemies.map((enemy) => ({
      id: enemy.id,
      enemyId: enemy.enemyId,
      element: enemy.element,
      hp: enemy.hp,
      shield: enemy.shield,
      progress: Number(enemy.progress.toFixed(6)),
      statuses: enemy.statuses,
    })),
    allies: snapshot.allies.map((ally) => ({
      characterId: ally.characterId,
      attackCount: ally.attackCount,
      hitCount: ally.hitCount,
      attackCooldown: Number(ally.attackCooldown.toFixed(6)),
    })),
    stats: snapshot.stats,
  };
}

test("StageBuilder creates a deterministic 13x8 two-path plan", () => {
  const options = { stageNumber: 5, seed: "same-seed", difficultyId: "eclipse", nodeVariant: 1 };
  const first = buildStagePlan(options);
  const second = buildStagePlan(options);
  assert.deepEqual(first, second);
  assert.equal(first.cols, 13);
  assert.equal(first.rows, 8);
  assert.equal(first.paths.length, 2);
  assert.equal(first.leaderNodes.length, 3);
  assert.ok(first.obstacles.length >= 4 && first.obstacles.length <= 6);
  assert.ok(first.specialTiles.length >= 2 && first.specialTiles.length <= 3);
  assert.ok(first.spawnSpecs.length > 0);
  for (const wave of first.waves) {
    for (const group of new Set(wave.spawns.map((spawn) => spawn.groupIndex))) {
      const elements = new Set(wave.spawns.filter((spawn) => spawn.groupIndex === group).map((spawn) => spawn.element));
      assert.ok(elements.size <= 2, `wave group used ${elements.size} elements`);
    }
  }
});

test("early stages honor their package allowlist and never combine two advanced counters", () => {
  const advanced = new Set(["aerial", "cleanse", "armored"]);
  for (let stageNumber = 1; stageNumber <= 3; stageNumber += 1) {
    for (let index = 0; index < 120; index += 1) {
      const plan = buildStagePlan({ stageNumber, seed: `EARLY-GUARD-${stageNumber}-${index}`, difficultyId: "standard" });
      const demanded = new Set(plan.spawnSpecs.map((spawn) => spawn.enemyId).filter((id) => advanced.has(id)));
      assert.ok(demanded.size < 2, `stage ${stageNumber} demanded ${[...demanded].join("+")} for seed ${index}`);
    }
  }
});

test("placement rejects paths, obstacles and non-leader nodes", () => {
  const plan = buildStagePlan({ stageNumber: 1, seed: "placement", difficultyId: "scout" });
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "placement", gold: 999 });
  const pathCell = plan.paths[0].cells[0];
  assert.equal(engine.place("guardian", pathCell.col, pathCell.row), false);
  assert.equal(engine.lastActionError, "path_blocked");
  const obstacle = plan.obstacles[0];
  assert.equal(engine.place("guardian", obstacle.col, obstacle.row), false);
  assert.equal(engine.lastActionError, "obstacle");
  assert.equal(engine.place("rumi", 12, 0), false);
  assert.equal(engine.lastActionError, "leader_node_required");
  const leaderNode = plan.leaderNodes[0];
  assert.equal(engine.place("rumi", leaderNode.col, leaderNode.row), true);
  const valid = (() => {
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 13; col += 1) {
        if (engine.place("guardian", col, row)) return { col, row };
      }
    }
    return null;
  })();
  assert.ok(valid, "a companion should have a legal placement cell");
  assert.equal(engine.getSnapshot().allies.length, 2);
  engine.destroy();
});

test("placement rejects the core and a cell occupied by another ally", () => {
  const plan = straightPlan({ hp: 500, count: 1 });
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "placement-collisions", gold: 999 });
  assert.equal(engine.place("guardian", plan.core.col, plan.core.row), false);
  assert.equal(engine.lastActionError, "path_blocked", "the shared core/path cell must remain forbidden");
  assert.equal(engine.place("guardian", 4, 2), true);
  assert.equal(engine.place("silver_rabbit", 4, 2), false);
  assert.equal(engine.lastActionError, "occupied");
  assert.equal(engine.getSnapshot().allies.length, 1);
  engine.destroy();
});

test("an immediate second combat move is rejected by relocation cooldown", () => {
  const plan = straightPlan({ hp: 500, count: 1 });
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "relocation-lock", gold: 999 });
  assert.equal(engine.place("rumi", 5, 2), true);
  assert.equal(engine.place("guardian", 4, 2), true);
  assert.equal(engine.start(), true);
  assert.equal(engine.move("guardian", 3, 2), true);
  assert.equal(engine.move("guardian", 2, 2), false);
  assert.equal(engine.lastActionError, "relocation_cooldown");
  const guardian = engine.getSnapshot().allies.find((ally) => ally.characterId === "guardian");
  assert.deepEqual([guardian.col, guardian.row], [3, 2]);
  assert.ok(guardian.relocationCooldown > 0);
  engine.destroy();
});

test("same seed and commands produce the same battle digest", () => {
  const plan = straightPlan({ hp: 35, count: 5, element: "fire" });
  const create = () => {
    const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "deterministic", gold: 999 });
    assert.equal(engine.place("rumi", 5, 2), true);
    assert.equal(engine.place("silver_rabbit", 4, 2), true);
    assert.equal(engine.start(), true);
    return engine;
  };
  const first = create();
  const second = create();
  const firstSnapshot = runFor(first, 18);
  const secondSnapshot = runFor(second, 18);
  assert.deepEqual(digest(firstSnapshot), digest(secondSnapshot));
  first.destroy();
  second.destroy();
});

test("element advantage is +20% and disadvantage has no penalty", () => {
  const target = { element: "fire", physicalResist: 0, magicResist: 0, statuses: new StatusCollection() };
  const advantage = resolveDamage({ amount: 100, damageType: "magic", attackerElement: "water", target });
  const neutral = resolveDamage({ amount: 100, damageType: "magic", attackerElement: "dark", target });
  const disadvantage = resolveDamage({ amount: 100, damageType: "magic", attackerElement: "nature", target });
  assert.equal(advantage.amount, 120);
  assert.equal(neutral.amount, 100);
  assert.equal(disadvantage.amount, 100);
  assert.equal(resolveDamage({ amount: 100, damageType: "magic", attackerElement: "water", target, advantageMultiplier: 1.15 }).amount, 115);
  assert.equal(resolveDamage({ amount: 100, damageType: "magic", attackerElement: "water", target, advantageMultiplier: 1.25 }).amount, 125);
});

test("damage combines criticals with physical and magic resistance at the -25% to 75% caps", () => {
  const physical = resolveDamage({ amount: 100, damageType: "physical", target: { physicalResist: 200, element: "water" }, forceCritical: true, critMultiplier: 2 });
  assert.equal(physical.resistance, 0.75);
  assert.equal(physical.amount, 50);
  const magic = resolveDamage({ amount: 100, damageType: "magic", target: { magicResist: -200, element: "water" }, forceCritical: true, critMultiplier: 1.5 });
  assert.equal(magic.resistance, -0.25);
  assert.equal(magic.amount, 188);
});

test("status stacks respect burn and corrosion caps", () => {
  const statuses = new StatusCollection();
  statuses.apply("burn", { stacks: 4, duration: 6 });
  statuses.apply("burn", { stacks: 4, duration: 6 });
  statuses.apply("corrosion", { stacks: 2, duration: 8 });
  statuses.apply("corrosion", { stacks: 5, duration: 8 });
  assert.equal(statuses.stacks("burn"), 5);
  assert.equal(statuses.stacks("corrosion"), 3);
  assert.equal(statuses.consume("corrosion", 2), 2);
  assert.equal(statuses.stacks("corrosion"), 1);
  assert.equal(statuses.consume("corrosion", 99), 1);
  assert.equal(statuses.consume("corrosion", 99), 0);
  assert.equal(statuses.stacks("corrosion"), 0, "repeated over-consumption must never make a stack negative");
});

test("status refresh, frost immunity and boss control duration follow their contracts", () => {
  const statuses = new StatusCollection();
  statuses.apply("burn", { stacks: 2, duration: 2 });
  statuses.update(1);
  statuses.apply("burn", { stacks: 1, duration: 6 });
  assert.equal(statuses.stacks("burn"), 3);
  assert.equal(statuses.get("burn").duration, 6);

  const bossStatuses = new StatusCollection();
  bossStatuses.apply("stun", { duration: 2 }, { isBoss: true });
  assert.ok(Math.abs(bossStatuses.get("stun").duration - 0.6) < 1e-9);
  bossStatuses.apply("frost", { stacks: 100, maxStacks: 100 }, { isBoss: true });
  assert.equal(bossStatuses.get("frozen").duration, 0.4);
  bossStatuses.update(0.41, {}, { isBoss: true });
  assert.equal(bossStatuses.has("frost_resist"), true);
  assert.equal(bossStatuses.apply("frost", { stacks: 50 }, { isBoss: true }).applied, false);
  bossStatuses.update(3.01, {}, { isBoss: true });
  assert.equal(bossStatuses.has("frost_resist"), false);
});

test("field buff slots refresh in place and evict the oldest fourth buff", () => {
  const buffs = new FieldBuffSlots(3);
  buffs.add("moon_bless", { duration: 8 });
  buffs.add("sun_bless", { duration: 8 });
  buffs.add("star_powder", { duration: 8 });
  const refreshed = buffs.add("moon_bless", { duration: 10 });
  assert.equal(refreshed.refreshed, true);
  assert.equal(buffs.toJSON().length, 3);
  const overflow = buffs.add("test_fourth", { duration: 5 });
  assert.equal(overflow.evicted, "moon_bless");
  assert.deepEqual(buffs.toJSON().map(({ id }) => id), ["sun_bless", "star_powder", "test_fourth"]);
});

test("field buff suppression hides the oldest slot and restores it after the timer", () => {
  const slots = new FieldBuffSlots(3);
  slots.add("moon_bless", { duration: 8 });
  slots.add("sun_bless", { duration: 8 });
  assert.equal(slots.suppressOldest(2), "moon_bless");
  assert.equal(slots.has("moon_bless"), false);
  assert.equal(slots.has("moon_bless", false), true);
  slots.update(2.01);
  assert.equal(slots.has("moon_bless"), true);
});

test("battle reaches victory and emits it once", () => {
  const events = [];
  const plan = straightPlan({ hp: 5, count: 1, element: "fire" });
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "victory", gold: 999, onEvent: (event) => events.push(event.type) });
  assert.equal(engine.place("rumi", 5, 2), true);
  assert.equal(engine.start(), true);
  const snapshot = runFor(engine, 20);
  assert.equal(snapshot.phase, "victory");
  assert.equal(events.filter((type) => type === "victory").length, 1);
  assert.equal(snapshot.stats.kills, 1);
  engine.destroy();
});

test("battle reaches defeat from core contact and reports normalized stats", () => {
  const events = [];
  const plan = straightPlan({ hp: 500, count: 1, element: "water" });
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "defeat", gold: 999, coreHp: 1, onEvent: (event) => events.push(event.type) });
  assert.equal(engine.place("rumi", 12, 7), true);
  assert.equal(engine.start(), true);
  const snapshot = runFor(engine, 30);
  assert.equal(snapshot.phase, "defeat");
  assert.equal(events.filter((type) => type === "defeat").length, 1);
  assert.ok(snapshot.stats.coreDamageTaken >= 1);
  for (const key of ["kills", "damage", "advantageDamage", "aerialDamage", "areaDamage", "controlSeconds", "statusesApplied", "corrosionBreaks", "delayedDamage", "relocations", "activeUses", "elapsedSeconds", "byCharacter"]) {
    assert.ok(Object.hasOwn(snapshot.stats, key), `missing normalized stat ${key}`);
  }
  engine.destroy();
});

test("preparation recall refunds paid cost once and battle finish refunds all deployed costs", () => {
  const plan = straightPlan({ hp: 5, count: 1, element: "fire" });
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "refund", gold: 100 });
  assert.equal(engine.place("rumi", 5, 2), true);
  assert.equal(engine.place("guardian", 4, 2), true);
  let snapshot = engine.getSnapshot();
  assert.equal(snapshot.allies.find((ally) => ally.characterId === "guardian").paidCost, 55);
  assert.equal(snapshot.gold, 45);
  assert.equal(engine.recall("guardian"), true);
  assert.equal(engine.getSnapshot().gold, 100);
  assert.equal(engine.recall("guardian"), false);
  assert.equal(engine.getSnapshot().gold, 100, "a second recall must not duplicate the refund");
  assert.equal(engine.place("guardian", 4, 2), true);
  assert.equal(engine.start(), true);
  snapshot = runFor(engine, 20);
  assert.equal(snapshot.phase, "victory");
  assert.equal(snapshot.gold, 100 + snapshot.stats.goldEarned, "finish must return every still-deployed paidCost");
  const refundEvents = snapshot.events.filter((event) => event.type === "deployment_costs_refunded");
  assert.equal(refundEvents.length, 1);
  engine.destroy();
});

test("recallAll, expedition multipliers and doctrine start shield are applied", () => {
  const plan = straightPlan({ hp: 50, count: 1 });
  const engine = new BattleEngine({
    stagePlan: plan,
    deck: DECK,
    seed: "multipliers",
    gold: 100,
    doctrines: ["doctrine_core"],
    costMultiplier: 0.92,
    leaderActiveCooldownMultiplier: 0.92,
  });
  assert.equal(engine.place("rumi", 5, 2), true);
  assert.equal(engine.place("guardian", 4, 2), true);
  let snapshot = engine.getSnapshot();
  assert.equal(snapshot.core.shield, 18);
  assert.ok(Math.abs(snapshot.allies.find((ally) => ally.characterId === "rumi").activeCooldown - 18.4) < 1e-9);
  assert.equal(snapshot.allies.find((ally) => ally.characterId === "guardian").paidCost, 51);
  assert.equal(snapshot.gold, 49);
  assert.equal(engine.recallAll(), 2);
  snapshot = engine.getSnapshot();
  assert.equal(snapshot.gold, 100);
  assert.equal(snapshot.allies.length, 0);
  engine.destroy();
});

test("every wave emits wave_warning exactly once before its arrivals", () => {
  const plan = straightPlan({ hp: 500, count: 1 });
  const secondSpawn = { ...plan.spawnSpecs[0], id: "test_spawn_second", spawnAt: 10, waveIndex: 1 };
  plan.spawnSpecs.push(secondSpawn);
  plan.totalEnemies = 2;
  plan.waves.push({ id: "test_wave_second", index: 1, startsAt: 10, endsSpawningAt: 10, threats: ["rush"], spawns: [secondSpawn] });
  const events = [];
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "wave-warning", gold: 999, onEvent: (event) => events.push(event) });
  assert.equal(engine.place("rumi", 12, 7), true);
  assert.equal(engine.start(), true);
  runFor(engine, 10.2);
  const warnings = events.filter((event) => event.type === "wave_warning");
  const spawns = events.filter((event) => event.type === "enemy_spawned");
  assert.deepEqual(warnings.map((event) => event.waveId), ["test_wave", "test_wave_second"]);
  assert.equal(new Set(warnings.map((event) => event.waveId)).size, 2);
  assert.ok(warnings[0].sequence < spawns[0].sequence);
  assert.ok(warnings[1].sequence < spawns[1].sequence);
  assert.ok(warnings[1].time < spawns[1].time);
  engine.destroy();
});

test("boss warning and telegraph precede the corresponding strong pattern effect", () => {
  const plan = straightPlan({ hp: 100, count: 1 });
  plan.spawnSpecs[0] = {
    ...plan.spawnSpecs[0],
    enemyId: "artificial_demon",
    bossId: "artificial_demon",
    isBoss: true,
    element: "water",
  };
  plan.waves[0].spawns = plan.spawnSpecs;
  const events = [];
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "boss-warning", gold: 999, onEvent: (event) => events.push(event) });
  assert.equal(engine.place("rumi", 12, 7), true);
  assert.equal(engine.start(), true);
  runFor(engine, 10);
  const warning = events.find((event) => event.type === "boss_warning" && event.patternId === "artificial_demon_destruction_form");
  const effect = events.find((event) => event.type === "boss_pattern" && event.patternId === "artificial_demon_destruction_form");
  assert.ok(warning);
  assert.ok(effect);
  assert.ok(warning.sequence < effect.sequence);
  assert.ok(effect.time - warning.time >= 1.45);
  engine.destroy();
});

test("boss telegraphs remain visible for one real second at 2x speed and include a warning area", () => {
  const plan = straightPlan({ hp: 100, count: 1 });
  plan.spawnSpecs[0] = {
    ...plan.spawnSpecs[0],
    enemyId: "artificial_demon",
    bossId: "artificial_demon",
    isBoss: true,
    element: "water",
  };
  plan.waves[0].spawns = plan.spawnSpecs;
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "boss-warning-2x", gold: 999 });
  assert.equal(engine.place("rumi", 12, 7), true);
  assert.equal(engine.start(), true);
  assert.equal(engine.setSpeed(2), true);
  let warningFrame = null;
  let effectFrame = null;
  let warningAreaVisible = false;
  for (let frame = 0; frame < 720 && effectFrame === null; frame += 1) {
    const snapshot = engine.step(1 / 60);
    if (warningFrame === null && snapshot.events.some((event) => event.type === "boss_warning" && event.patternId === "artificial_demon_destruction_form")) {
      warningFrame = frame;
      warningAreaVisible = snapshot.areaEffects.some((area) => area.kind === "warning" && area.telegraph);
    }
    if (snapshot.events.some((event) => event.type === "boss_pattern" && event.patternId === "artificial_demon_destruction_form")) effectFrame = frame;
  }
  assert.notEqual(warningFrame, null);
  assert.notEqual(effectFrame, null);
  assert.ok(effectFrame - warningFrame >= 59, `warning lasted only ${effectFrame - warningFrame} display frames`);
  assert.equal(warningAreaVisible, true);
  engine.destroy();
});

test("debug snapshot exposes current targets and attack cooldowns from live targeting", () => {
  const plan = straightPlan({ hp: 500, count: 1, element: "fire" });
  plan.leaderNodes[0] = { col: 2, row: 2 };
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "debug-overlay", gold: 999 });
  assert.equal(engine.place("rumi", 2, 2), true);
  assert.equal(engine.start(), true);
  engine.step(1 / 60);
  let snapshot = engine.getSnapshot();
  const enemy = snapshot.enemies[0];
  const ally = snapshot.allies.find((entry) => entry.characterId === "rumi");
  assert.ok(enemy);
  assert.equal(ally.targetId, enemy.id);
  assert.ok(Number.isFinite(ally.attackCooldown));
  for (const key of ["hp", "maxHp", "physicalResist", "magicResist", "statuses", "progress", "pathLength"]) {
    assert.ok(Object.hasOwn(enemy, key), `debug enemy snapshot missing ${key}`);
  }
  const liveEnemy = [...engine.registry.enemies.values()][0];
  liveEnemy.hp = 0;
  liveEnemy.dead = true;
  runFor(engine, 0.1);
  snapshot = engine.getSnapshot();
  assert.equal(snapshot.allies[0].targetId, null);
  engine.destroy();
});

test("battle snapshot exposes the full 300 event ring", () => {
  const plan = straightPlan({ hp: 100000, count: 1 });
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "event-ring", gold: 999 });
  assert.equal(engine.place("rumi", 5, 2), true);
  assert.equal(engine.getSnapshot().limits.events, 300);
  // Public commands emit deterministic events and exercise ring eviction without private hooks.
  for (let index = 0; index < 340; index += 1) engine.setPriority("rumi", index % 2 ? "front" : "strong");
  const snapshot = engine.getSnapshot();
  assert.equal(snapshot.events.length, 300);
  assert.equal(snapshot.events.at(-1).sequence - snapshot.events[0].sequence, 299);
  engine.destroy();
});

test("particle and damage popup entities honor caps, expire, and return to explicit pools", () => {
  const plan = straightPlan({ hp: 100000, count: 1 });
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "vfx-pools", gold: 999 });
  assert.equal(engine.place("rumi", 5, 2), true);
  assert.equal(engine.start(), true);
  engine.step(1 / 60);
  const source = engine.registry.allies.get("ally_rumi");
  const target = [...engine.registry.enemies.values()][0];
  for (let index = 0; index < 220; index += 1) {
    engine.dealDamage(source, target, { amount: 1, damageType: "physical", forceCritical: true });
  }
  let snapshot = engine.getSnapshot();
  assert.equal(snapshot.damagePopups.length, 60);
  assert.equal(snapshot.particles.length, 500);
  assert.equal(snapshot.limits.damagePopups, 60);
  assert.equal(snapshot.limits.particles, 500);
  runFor(engine, 1);
  snapshot = engine.getSnapshot();
  assert.equal(snapshot.damagePopups.length, 0);
  assert.equal(snapshot.particles.length, 0);
  assert.equal(snapshot.limits.pool.damagePopups, 60);
  assert.equal(snapshot.limits.pool.particles, 500);
  engine.dealDamage(source, target, { amount: 1, damageType: "physical" });
  snapshot = engine.getSnapshot();
  assert.ok(snapshot.damagePopups.length > 0);
  assert.ok(snapshot.limits.pool.damagePopups < 60, "a returned popup must be reused");
  engine.destroy();
});

test("silence pauses both boss telegraph execution and its warning area at 2x", () => {
  const plan = straightPlan({ hp: 100000, count: 1 });
  plan.spawnSpecs[0] = { ...plan.spawnSpecs[0], enemyId: "artificial_demon", bossId: "artificial_demon", isBoss: true };
  plan.waves[0].spawns = plan.spawnSpecs;
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "silenced-telegraph", gold: 999 });
  assert.equal(engine.place("rumi", 12, 7), true);
  assert.equal(engine.start(), true);
  assert.equal(engine.setSpeed(2), true);
  let boss;
  let warning;
  for (let frame = 0; frame < 420 && !warning; frame += 1) {
    engine.step(1 / 60);
    boss = [...engine.registry.enemies.values()].find((enemy) => enemy.isBoss);
    warning = engine.getSnapshot().events.find((event) => event.type === "boss_warning" && event.patternId === "artificial_demon_destruction_form");
  }
  assert.ok(warning);
  engine.applyStatus(boss, "silence", { duration: 2 });
  const areaId = boss.bossState.pendingPatterns[0].warningAreaId;
  engine.step(1 / 60);
  const before = engine.registry.areaEffects.get(areaId).duration;
  for (let frame = 0; frame < 35; frame += 1) engine.step(1 / 60);
  assert.equal(engine.getSnapshot().events.some((event) => event.type === "boss_pattern" && event.patternId === "artificial_demon_destruction_form"), false);
  assert.ok(engine.registry.areaEffects.has(areaId));
  assert.ok(Math.abs(engine.registry.areaEffects.get(areaId).duration - before) < 0.03);
  let effect;
  for (let frame = 0; frame < 180 && !effect; frame += 1) {
    engine.step(1 / 60);
    effect = engine.getSnapshot().events.find((event) => event.type === "boss_pattern" && event.patternId === "artificial_demon_destruction_form");
  }
  assert.ok(effect);
  assert.ok(effect.sequence > warning.sequence);
  engine.destroy();
});

test("training boss phase ratio initializes HP and treats already-passed thresholds as consumed", () => {
  const plan = buildStagePlan({
    stageNumber: 3,
    seed: "training-boss-phase",
    difficultyId: "standard",
    trainingOverrides: { bossOnly: true, bossId: "artificial_demon", bossPhaseRatio: 0.39 },
  });
  assert.equal(plan.spawnSpecs.length, 1);
  assert.equal(plan.spawnSpecs[0].initialHpRatio, 0.39);
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "training-boss-phase", gold: 999 });
  const leaderNode = plan.leaderNodes.at(-1);
  assert.equal(engine.place("rumi", leaderNode.col, leaderNode.row), true);
  assert.equal(engine.start(), true);
  runFor(engine, plan.spawnSpecs[0].spawnAt + 0.1);
  const snapshot = engine.getSnapshot();
  const boss = snapshot.enemies.find((enemy) => enemy.isBoss);
  assert.ok(boss);
  assert.equal(boss.hp, Math.floor(boss.maxHp * 0.39));
  assert.equal(boss.bossState.triggered["summon_0.7"], true);
  assert.equal(boss.bossState.triggered["summon_0.4"], true);
  assert.equal(snapshot.events.some((event) => event.type === "boss_warning" && event.patternId === "artificial_demon_rift_summon"), false);
  engine.destroy();
});

test("boss HP threshold patterns trigger and execute exactly once", () => {
  const plan = straightPlan({ hp: 100000, count: 1 });
  plan.spawnSpecs[0] = { ...plan.spawnSpecs[0], enemyId: "artificial_demon", bossId: "artificial_demon", isBoss: true };
  plan.waves[0].spawns = plan.spawnSpecs;
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "boss-threshold-once", gold: 999 });
  assert.equal(engine.place("rumi", 12, 7), true);
  assert.equal(engine.start(), true);
  engine.step(1 / 60);
  const boss = [...engine.registry.enemies.values()][0];
  boss.hp = boss.maxHp * 0.69;
  runFor(engine, 2.5);
  boss.hp = Math.min(boss.hp, boss.maxHp * 0.69);
  runFor(engine, 2.5);
  const thresholdWarnings = engine.getSnapshot().events.filter((event) =>
    event.type === "boss_warning"
      && event.patternId === "artificial_demon_rift_summon"
      && event.threshold === 0.7,
  );
  const thresholdEffects = engine.getSnapshot().events.filter((event) =>
    event.type === "boss_pattern"
      && event.patternId === "artificial_demon_rift_summon"
      && event.threshold === 0.7,
  );
  assert.equal(thresholdWarnings.length, 1);
  assert.equal(thresholdEffects.length, 1);
  engine.destroy();
});

test("Iris apocalypse telegraph can be evaded by moving its target before resolution", () => {
  const plan = straightPlan({ hp: 100000, count: 1 });
  plan.spawnSpecs[0] = { ...plan.spawnSpecs[0], enemyId: "iris_curse", bossId: "iris_curse", isBoss: true };
  plan.waves[0].spawns = plan.spawnSpecs;
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "iris-apocalypse-evade", gold: 999 });
  assert.equal(engine.place("rumi", 5, 2), true);
  assert.equal(engine.place("guardian", 4, 2), true);
  assert.equal(engine.start(), true);
  engine.step(1 / 60);
  const boss = [...engine.registry.enemies.values()][0];
  boss.hp = boss.maxHp * 0.74;
  let warning;
  for (let frame = 0; frame < 30 && !warning; frame += 1) {
    engine.step(1 / 60);
    warning = engine.getSnapshot().events.find((event) => event.type === "boss_warning" && event.patternId === "iris_apocalypse");
  }
  assert.ok(warning);
  const warnedAlly = [...engine.registry.allies.values()].find((ally) => ally.id === warning.targetId);
  assert.ok(warnedAlly);
  assert.equal(engine.move(warnedAlly.characterId, 8, 7), true);
  runFor(engine, 2.2);
  const effect = engine.getSnapshot().events.find((event) => event.type === "boss_pattern" && event.patternId === "iris_apocalypse");
  assert.ok(effect);
  assert.equal(effect.hitTargetIds.includes(warnedAlly.id), false);
  assert.equal(warnedAlly.disabledFor, 0);
  engine.destroy();
});

test("training enemyId, elitePrefix and statusId overrides reach spawned enemies", () => {
  const plan = buildStagePlan({
    stageNumber: 1,
    seed: "training-overrides",
    difficultyId: "standard",
    trainingOverrides: { enemyId: "armored", enemyCount: 2, elitePrefix: "steel", statusId: "burn", statusStacks: 3 },
  });
  assert.ok(plan.spawnSpecs.every((spawn) => spawn.enemyId === "armored"));
  assert.ok(plan.spawnSpecs.every((spawn) => spawn.elitePrefix === "steel"));
  assert.ok(plan.spawnSpecs.every((spawn) => spawn.initialStatuses?.[0]?.id === "burn"));
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "training-overrides", gold: 999 });
  const leaderNode = plan.leaderNodes.at(-1);
  assert.equal(engine.place("rumi", leaderNode.col, leaderNode.row), true);
  assert.equal(engine.start(), true);
  const snapshot = runFor(engine, 1.7);
  assert.equal(snapshot.enemies[0].enemyId, "armored");
  assert.equal(snapshot.enemies[0].elitePrefix, "elite_steel");
  assert.equal(snapshot.enemies[0].statuses.burn.stacks, 3);
  engine.destroy();
});

test("corrosion breaks and delayed damage are accumulated in battle statistics", () => {
  const plan = straightPlan({ hp: 5000, count: 1, element: "water" });
  plan.leaderNodes[0] = { col: 2, row: 2 };
  const deck = { leaderId: "cinderella", companionIds: ["gray", "guardian", "silver_rabbit", "snow_rabbit"] };
  const engine = new BattleEngine({
    stagePlan: plan,
    deck,
    levels: { cinderella: 5, gray: 5 },
    branches: { cinderella: "A", gray: "B" },
    seed: "stat-contract",
    gold: 999,
  });
  assert.equal(engine.place("cinderella", 2, 2), true);
  assert.equal(engine.place("gray", 4, 2), true);
  assert.equal(engine.start(), true);
  engine.step(1 / 60);
  const enemy = [...engine.registry.enemies.values()][0];
  assert.ok(enemy);
  engine.applyStatus(enemy, "stun", { duration: 20 });
  engine.createAreaEffect({ kind: "delayed_attack", sourceId: "ally_gray", x: enemy.x, y: enemy.y, radius: 1, delay: 0.1, damage: 20, damageType: "physical", element: "dark" });
  const snapshot = runFor(engine, 9);
  assert.ok(snapshot.stats.corrosionBreaks >= 1);
  assert.ok(snapshot.stats.delayedDamage > 0);
  assert.ok(snapshot.stats.byCharacter.gray.delayedDamage > 0);
  engine.destroy();
});

test("Luna critical hits ignore 35% resistance even when the critical is not forced", () => {
  const plan = straightPlan({ hp: 10000, count: 1, element: "fire" });
  const engine = new BattleEngine({
    stagePlan: plan,
    deck: { leaderId: "luna", companionIds: [] },
    levels: { luna: 5 },
    branches: { luna: "A" },
    seed: "luna-resistance-ignore",
    gold: 999,
  });
  assert.equal(engine.place("luna", 5, 2), true);
  assert.equal(engine.start(), true);
  engine.step(1 / 60);
  const luna = engine.registry.allies.get("ally_luna");
  const enemy = [...engine.registry.enemies.values()][0];
  enemy.physicalResist = 0.5;
  let critical = null;
  for (let index = 0; index < 20 && !critical; index += 1) {
    const result = engine.dealDamage(luna, enemy, { amount: 10, damageType: "physical", critChance: 0.8, critMultiplier: 1 });
    if (result.critical) critical = result;
  }
  assert.ok(critical, "the deterministic sample should include an ordinary critical hit");
  assert.ok(Math.abs(critical.resistance - 0.15) < 1e-9);
  engine.destroy();
});

test("Luna No Moon critical bonus follows active, suppressed and restored field buffs", () => {
  const plan = straightPlan({ hp: 10000, count: 1, element: "fire" });
  plan.leaderNodes[0] = { col: 2, row: 2 };
  const engine = new BattleEngine({
    stagePlan: plan,
    deck: { leaderId: "luna", companionIds: [] },
    seed: "luna-no-moon-toggle",
    gold: 999,
  });
  assert.equal(engine.place("luna", 2, 2), true);
  assert.equal(engine.start(), true);
  engine.step(1 / 60);
  const luna = engine.registry.allies.get("ally_luna");
  const enemy = [...engine.registry.enemies.values()][0];
  const sample = () => engine.dealDamage(luna, enemy, { amount: 1, damageType: "physical", critMultiplier: 1 });
  let noMoonCrits = 0;
  for (let index = 0; index < 200; index += 1) noMoonCrits += Number(sample().critical);
  engine.addFieldBuff("moon_bless", { duration: 8 }, luna);
  let buffCrits = 0;
  for (let index = 0; index < 200; index += 1) buffCrits += Number(sample().critical);
  engine.fieldBuffs.suppressOldest(2);
  let suppressedCrits = 0;
  for (let index = 0; index < 200; index += 1) suppressedCrits += Number(sample().critical);
  assert.ok(noMoonCrits > buffCrits + 15, `${noMoonCrits} should exceed ${buffCrits}`);
  assert.ok(suppressedCrits > buffCrits + 15, `${suppressedCrits} should exceed ${buffCrits}`);
  engine.destroy();
});

test("Zeke detonation kills spread burn once without recursively exploding a death chain", () => {
  const plan = straightPlan({ hp: 1000, count: 3, element: "water" });
  const engine = new BattleEngine({
    stagePlan: plan,
    deck: { leaderId: "zeke", companionIds: [] },
    levels: { zeke: 5 },
    branches: { zeke: "A" },
    seed: "zeke-detonation-spread",
    gold: 999,
  });
  assert.equal(engine.place("zeke", 5, 2), true);
  assert.equal(engine.start(), true);
  runFor(engine, 0.5);
  const enemies = [...engine.registry.enemies.values()];
  assert.equal(enemies.length, 3);
  for (const enemy of enemies) {
    enemy.x = 5;
    enemy.y = 3;
    enemy.hp = enemy === enemies[0] ? 130 : 1000;
    engine.applyStatus(enemy, "stun", { duration: 5 });
  }
  engine.applyStatus(enemies[0], "burn", { stacks: 2, duration: 8 });
  assert.equal(engine.castLeaderActive(5, 3), true);
  const snapshot = engine.getSnapshot();
  assert.equal(snapshot.events.filter((event) => event.type === "burn_detonation_spread").length, 1);
  assert.ok(snapshot.stats.kills <= 3, "death effects must remain bounded to the spawned enemies");
  assert.ok(snapshot.enemies.every((enemy) => (enemy.statuses.burn?.stacks ?? 0) >= 0));
  engine.destroy();
});

test("Luna sixth consecutive elite hit executes and Rabbit Relay assists on four distinct rabbit attacks", () => {
  const lunaPlan = straightPlan({ hp: 10000, count: 1, element: "fire" });
  lunaPlan.spawnSpecs[0].elitePrefix = "steel";
  const lunaEngine = new BattleEngine({
    stagePlan: lunaPlan,
    deck: { leaderId: "luna", companionIds: [] },
    levels: { luna: 6 },
    branches: { luna: "A" },
    seed: "luna-sixth-hit",
    gold: 999,
  });
  assert.equal(lunaEngine.place("luna", 5, 2), true);
  assert.equal(lunaEngine.start(), true);
  lunaEngine.step(1 / 60);
  const luna = lunaEngine.registry.allies.get("ally_luna");
  const elite = [...lunaEngine.registry.enemies.values()][0];
  luna.attackInterval = 0.12;
  elite.x = 5;
  elite.y = 3;
  lunaEngine.applyStatus(elite, "stun", { duration: 5 });
  runFor(lunaEngine, 2);
  assert.ok(lunaEngine.getSnapshot().events.some((event) => event.type === "same_boss_hit_execute"));
  lunaEngine.destroy();

  const relayPlan = straightPlan({ hp: 10000, count: 1, element: "fire" });
  const relayEngine = new BattleEngine({
    stagePlan: relayPlan,
    deck: { leaderId: "rumi", companionIds: ["silver_rabbit", "snow_rabbit"] },
    levels: { silver_rabbit: 3, snow_rabbit: 2 },
    branches: { silver_rabbit: "B" },
    seed: "rabbit-relay",
    gold: 999,
  });
  assert.equal(relayEngine.place("rumi", 5, 2), true);
  assert.equal(relayEngine.place("silver_rabbit", 4, 2), true);
  assert.equal(relayEngine.place("snow_rabbit", 4, 4), true);
  assert.equal(relayEngine.start(), true);
  relayEngine.step(1 / 60);
  const rabbitTarget = [...relayEngine.registry.enemies.values()][0];
  rabbitTarget.x = 5;
  rabbitTarget.y = 3;
  relayEngine.applyStatus(rabbitTarget, "stun", { duration: 5 });
  relayEngine.registry.allies.get("ally_snow_rabbit").attackInterval = 0.12;
  runFor(relayEngine, 2);
  assert.ok(relayEngine.getSnapshot().events.some((event) => event.type === "rabbit_relay"));
  relayEngine.destroy();
});

test("all eight doctrines apply their runtime modifiers", () => {
  const plan = straightPlan({ hp: 1000, count: 1 });
  const base = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "doctrine-base", gold: 999 });
  const boosted = new BattleEngine({
    stagePlan: plan,
    deck: DECK,
    seed: "doctrine-all",
    gold: 999,
    doctrines: ["doctrine_range", "doctrine_rate", "doctrine_splash", "doctrine_control", "doctrine_core", "doctrine_cost", "doctrine_relocate", "doctrine_status"],
  });
  assert.equal(base.place("rumi", 5, 2), true);
  assert.equal(base.place("guardian", 4, 2), true);
  assert.equal(boosted.place("rumi", 5, 2), true);
  assert.equal(boosted.place("guardian", 4, 2), true);
  let snapshot = boosted.getSnapshot();
  const baseGuardian = base.getSnapshot().allies.find((ally) => ally.characterId === "guardian");
  const guardian = snapshot.allies.find((ally) => ally.characterId === "guardian");
  assert.ok(guardian.range > baseGuardian.range);
  assert.ok(guardian.attackInterval < baseGuardian.attackInterval);
  assert.equal(guardian.paidCost, 49);
  assert.equal(snapshot.core.shield, 18);
  assert.equal(boosted.start(), true);
  boosted.step(1 / 60);
  const enemy = [...boosted.registry.enemies.values()][0];
  const leader = boosted.registry.allies.get("ally_rumi");
  boosted.applyStatus(enemy, "frost", { stacks: 10 }, leader);
  boosted.applyStatus(enemy, "burn", { stacks: 1, duration: 10 }, leader);
  assert.equal(enemy.statuses.stacks("frost"), 12);
  assert.equal(enemy.statuses.get("burn").duration, 12);
  const area = boosted.createAreaEffect({ sourceId: leader.id, radius: 1, damage: 10 });
  assert.equal(area.radius, 1.2);
  assert.ok(Math.abs(area.damage - 10.8) < 1e-9);
  assert.equal(boosted.move("guardian", 3, 2), true);
  snapshot = boosted.getSnapshot();
  assert.equal(snapshot.allies.find((ally) => ally.characterId === "guardian").relocationCooldown, 7);
  base.destroy();
  boosted.destroy();
});

test("relic stat, status, cooldown and direct-damage modifiers are deterministic", () => {
  const plan = straightPlan({ hp: 10000, count: 1, element: "fire" });
  const deck = { leaderId: "rumi", companionIds: ["silver_rabbit", "gold_dragon"] };
  const engine = new BattleEngine({
    stagePlan: plan,
    deck,
    seed: "relic-core",
    gold: 999,
    relics: ["relic_rabbit_hole", "relic_overflame", "relic_assassin_nail", "relic_blue_moon", "relic_dragon_heart", "relic_star_crown", "relic_arena", "relic_support_boost", "relic_last_light"],
  });
  engine.place("rumi", 5, 2);
  engine.place("silver_rabbit", 4, 2);
  engine.place("gold_dragon", 4, 4);
  let snapshot = engine.getSnapshot();
  const rabbit = snapshot.allies.find((ally) => ally.characterId === "silver_rabbit");
  assert.ok(rabbit.critChance >= 0.2);
  assert.ok(rabbit.range >= 3.6);
  assert.equal(snapshot.fieldBuffs.length, 0);
  assert.equal(engine.fieldBuffs.maxSlots, 4);
  assert.ok(snapshot.allies.find((ally) => ally.characterId === "rumi").activeCooldown < 20);
  engine.addFieldBuff("moon_bless", { duration: 8 });
  assert.equal(engine.getSnapshot().fieldBuffs.find((buff) => buff.id === "moon_bless").duration, 6.8);
  engine.start();
  engine.step(1 / 60);
  const enemy = [...engine.registry.enemies.values()][0];
  engine.applyStatus(enemy, "burn", { stacks: 1, duration: 6 }, engine.registry.allies.get("ally_rumi"));
  engine.applyStatus(enemy, "burn", { stacks: 6, duration: 6 }, engine.registry.allies.get("ally_rumi"));
  engine.applyStatus(enemy, "corrosion", { stacks: 1 }, engine.registry.allies.get("ally_rumi"));
  assert.equal(enemy.statuses.stacks("burn"), 7);
  assert.equal(enemy.corrosionReduction, 0.16);
  const dragon = engine.registry.allies.get("ally_gold_dragon");
  enemy.tags.push("air", "aerial");
  const dragonHit = engine.dealDamage(dragon, enemy, { amount: 100, damageType: "true", canCrit: false, isBasic: true });
  assert.equal(dragonHit.rawAmount, 132.25);
  const beforeDirect = enemy.hp;
  const activeHit = engine.dealDamage(engine.registry.allies.get("ally_rumi"), enemy, { amount: 100, damageType: "true", canCrit: false, reason: "active" });
  assert.equal(beforeDirect - enemy.hp, 99);
  const leader = engine.registry.allies.get("ally_rumi");
  for (let cast = 0; cast < 4; cast += 1) {
    leader.activeCooldownRemaining = 0;
    assert.equal(engine.castLeaderActive(0, 0), true);
  }
  assert.ok(engine.getSnapshot().events.some((event) => event.type === "blue_moon_refund"));
  engine.core.hp = 25;
  enemy.x = 5;
  enemy.y = 3;
  engine.applyStatus(enemy, "stun", { duration: 2 });
  leader.attackCooldown = 0;
  runFor(engine, 0.1);
  assert.equal(engine.lastLightTriggered, true);
  engine.core.hp = 100;
  runFor(engine, 0.1);
  assert.equal(engine.lastLightTriggered, true, "last light remains active after recovery during the stage");
  engine.destroy();
});

test("broken clock increases delayed strike damage and delay", () => {
  const make = (withRelic) => {
    const plan = straightPlan({ hp: 10000, count: 1 });
    const engine = new BattleEngine({
      stagePlan: plan,
      deck: { leaderId: "rumi", companionIds: ["gray"] },
      levels: { gray: 3 },
      branches: { gray: "B" },
      seed: `broken-clock-${withRelic}`,
      gold: 999,
      relics: withRelic ? ["relic_broken_clock"] : [],
    });
    engine.place("rumi", 5, 2);
    engine.place("gray", 4, 2);
    engine.start();
    engine.step(1 / 60);
    const enemy = [...engine.registry.enemies.values()][0];
    enemy.x = 5;
    enemy.y = 3;
    engine.applyStatus(enemy, "stun", { duration: 20 });
    runFor(engine, 5.05);
    return engine;
  };
  const base = make(false);
  const relic = make(true);
  const baseArea = base.getSnapshot().areaEffects.find((area) => area.kind === "delayed_attack");
  const relicArea = relic.getSnapshot().areaEffects.find((area) => area.kind === "delayed_attack");
  assert.ok(baseArea && relicArea);
  assert.ok(Math.abs(relicArea.damage / baseArea.damage - 1.45) < 1e-9);
  assert.ok(Math.abs(relicArea.delay - baseArea.delay - 0.8) < 0.03);
  base.destroy();
  relic.destroy();
});

test("hourglass and frozen body trigger once and spread frost gauge", () => {
  const plan = straightPlan({ hp: 1000, count: 2, coreDamageEnemyId: "rush" });
  plan.spawnSpecs[0].spawnAt = 0;
  plan.spawnSpecs[1].spawnAt = 0;
  plan.waves[0].spawns = plan.spawnSpecs;
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "relic-reactive", gold: 999, relics: ["relic_hourglass", "relic_frozen_body"] });
  engine.place("rumi", 12, 7);
  engine.start();
  engine.step(1 / 60);
  const [first, second] = [...engine.registry.enemies.values()];
  first.x = second.x = 1;
  first.y = second.y = 3;
  first.hp = 1;
  first.statuses.apply("frozen", { duration: 5, sourceId: "ally_rumi" }, first);
  engine.dealDamage(engine.registry.allies.get("ally_rumi"), first, { amount: 2, damageType: "true", canCrit: false });
  assert.equal(second.statuses.stacks("frost"), 35);
  second.distanceTravelled = second.pathLength;
  engine.step(1 / 60);
  const snapshot = engine.getSnapshot();
  assert.equal(snapshot.events.filter((event) => event.type === "hourglass_triggered").length, 1);
  assert.equal(snapshot.events.filter((event) => event.type === "frozen_body_spread").length, 1);
  engine.destroy();
});

test("all eight mutators alter stage composition or combat rewards", () => {
  const build = (mutator, extra = {}) => buildStagePlan({
    stageNumber: 4,
    seed: `mutator-${mutator}`,
    difficultyId: "standard",
    trainingOverrides: { mutator, ...extra },
  });
  const frenzyPlan = build("mutator_frenzy", { enemyId: "normal", enemyCount: 1 });
  const fortifiedPlan = build("mutator_fortified", { enemyId: "armored", enemyCount: 1 });
  const aerialPlan = build("mutator_aerial", { wavePackageId: "wave_aerial_scatter" });
  const splitPlan = build("mutator_split", { wavePackageId: "wave_basic_formation" });
  const cleansePlan = build("mutator_cleanse", { wavePackageId: "wave_basic_formation" });
  const volatilePlan = build("mutator_volatile", { enemyId: "normal", enemyCount: 1 });
  const leylinePlan = build("mutator_leyline", { specialTileCount: 2 });
  const blackMoonPlan = build("mutator_black_moon", { enemyId: "normal", enemyCount: 1 });
  assert.ok(aerialPlan.aerialRatio <= 0.6 + 1e-8);
  assert.equal(splitPlan.scoreMultiplier, 1.15);
  assert.ok(new Set(splitPlan.spawnSpecs.map((spawn) => spawn.pathIndex)).size > 1);
  assert.ok(cleansePlan.spawnSpecs.some((spawn) => spawn.enemyId === "cleanse"));
  assert.equal(leylinePlan.specialTiles.length, 3);

  const create = (stagePlan) => {
    const engine = new BattleEngine({ stagePlan, deck: DECK, seed: stagePlan.seed, gold: 999 });
    engine.place("rumi", stagePlan.leaderNodes[0].col, stagePlan.leaderNodes[0].row);
    return engine;
  };
  const frenzyCombatPlan = straightPlan({ hp: 1, count: 1, coreDamageEnemyId: "armored" });
  frenzyCombatPlan.mutator = "mutator_frenzy";
  const fortifiedCombatPlan = straightPlan({ hp: 1, count: 1, coreDamageEnemyId: "armored" });
  fortifiedCombatPlan.mutator = "mutator_fortified";
  const frenzy = create(frenzyCombatPlan);
  const fortified = create(fortifiedCombatPlan);
  const aerialCombatPlan = straightPlan({ hp: 1, count: 1, coreDamageEnemyId: "aerial" });
  aerialCombatPlan.mutator = "mutator_aerial";
  const aerial = create(aerialCombatPlan);
  const volatile = create(volatilePlan);
  const blackMoon = create(blackMoonPlan);
  assert.equal(blackMoon.fieldBuffs.maxSlots, 2);
  blackMoon.addFieldBuff("star_powder", { duration: 8 });
  assert.equal(blackMoon.getSnapshot().core.shield, 34);
  const splash = volatile.createAreaEffect({ radius: 1, damage: 10 });
  assert.equal(splash.damage, 12);
  volatile.start();
  runFor(volatile, 1.6);
  const volatileEnemy = [...volatile.registry.enemies.values()][0];
  volatileEnemy.distanceTravelled = volatileEnemy.pathLength;
  volatile.step(1 / 60);
  assert.ok(volatile.getSnapshot().stats.coreDamageTaken >= 9);
  frenzy.start();
  fortified.start();
  aerial.start();
  const frenzyResult = runFor(frenzy, 40);
  const fortifiedResult = runFor(fortified, 40);
  const aerialResult = runFor(aerial, 40);
  assert.equal(frenzyResult.stats.goldEarned, 8);
  assert.ok(fortifiedResult.stats.goldEarned >= 9);
  assert.equal(aerialResult.stats.goldEarned, 4);

  const cleanseEngine = create(cleansePlan);
  cleanseEngine.start();
  runFor(cleanseEngine, 1.6);
  const cleanseTarget = [...cleanseEngine.registry.enemies.values()][0];
  cleanseEngine.applyStatus(cleanseTarget, "burn", { duration: 10 }, cleanseEngine.registry.allies.get("ally_rumi"));
  assert.equal(cleanseTarget.statuses.get("burn").duration, 11.5);

  const leylineEngine = create(leylinePlan);
  leylineEngine.start();
  runFor(leylineEngine, 1.6);
  const leylineTarget = [...leylineEngine.registry.enemies.values()][0];
  const mycelium = leylinePlan.specialTiles.find((tile) => tile.type === "mycelium");
  leylineEngine.applyStatus(leylineTarget, "frost", { stacks: 10 }, { id: "test_source", characterId: "rumi", ...mycelium });
  assert.equal(leylineTarget.statuses.stacks("frost"), 12.5);
  [frenzy, fortified, aerial, volatile, blackMoon, cleanseEngine, leylineEngine].forEach((engine) => engine.destroy());
});

test("challenge and training overrides shape the actual spawn plan", () => {
  const training = buildStagePlan({
    stageNumber: 2,
    seed: "training-package-enemy",
    difficultyId: "scout",
    trainingOverrides: { wavePackageId: "wave_magic_phalanx", enemyId: "rush" },
  });
  assert.ok(training.spawnSpecs.every((spawn) => spawn.enemyId === "rush"));

  const sky = buildStagePlan({ stageNumber: 5, seed: "challenge-sky", trainingOverrides: { aerialHpBudgetRatio: 0.6, primaryElement: "dark" } });
  assert.ok(sky.aerialRatio >= 0.5 && sky.aerialRatio <= 0.6 + 1e-8);
  assert.equal(sky.elementProfile.primaryElement, "dark");

  const iron = buildStagePlan({ stageNumber: 4, seed: "challenge-iron", trainingOverrides: { highWeightTags: ["armored", "magic"], elementPool: ["fire", "dark"], maxElements: 2 } });
  assert.ok(iron.spawnSpecs.every((spawn) => ["armored", "magic"].includes(spawn.enemyId)));
  assert.deepEqual(Object.keys(iron.elementProfile.weights), ["fire", "dark"]);

  const stopped = buildStagePlan({ stageNumber: 6, seed: "challenge-stopped", trainingOverrides: { bossOnly: true, bossId: "artificial_demon", enemyElement: "light" } });
  assert.equal(stopped.spawnSpecs.length, 1);
  assert.equal(stopped.spawnSpecs[0].bossId, "artificial_demon");
  assert.equal(stopped.spawnSpecs[0].isBoss, true);
  assert.equal(stopped.spawnSpecs[0].element, "light");
});

test("core approach warning is emitted once and boss telegraphs are at least one second", () => {
  const plan = straightPlan({ hp: 1000, count: 1, coreDamageEnemyId: "rush" });
  const engine = new BattleEngine({ stagePlan: plan, deck: DECK, seed: "approach-warning", gold: 999 });
  engine.place("rumi", 12, 7);
  engine.start();
  runFor(engine, 30);
  assert.equal(engine.getSnapshot().events.filter((event) => event.type === "core_approach_warning").length, 1);
  engine.destroy();

  const bossPlan = straightPlan({ hp: 100, count: 1 });
  bossPlan.spawnSpecs[0] = { ...bossPlan.spawnSpecs[0], enemyId: "artificial_demon", bossId: "artificial_demon", isBoss: true };
  bossPlan.waves[0].spawns = bossPlan.spawnSpecs;
  const bossEngine = new BattleEngine({ stagePlan: bossPlan, deck: DECK, seed: "boss-minimum-warning", gold: 999 });
  bossEngine.place("rumi", 12, 7);
  bossEngine.start();
  runFor(bossEngine, 11);
  const warnings = bossEngine.getSnapshot().events.filter((event) => event.type === "boss_warning");
  assert.ok(warnings.length > 0);
  assert.ok(warnings.every((event) => event.telegraph >= 1));
  bossEngine.destroy();
});

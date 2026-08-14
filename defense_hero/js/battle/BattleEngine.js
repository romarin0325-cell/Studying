import { CONTENT, CONTENT_MAPS, firstDefined, numberFrom, tagsFrom } from "./ContentAdapter.js";
import { SeededRng } from "./SeededRng.js";
import { EntityRegistry } from "./EntityRegistry.js";
import { EffectRegistry, buildRuntimeTraits } from "./EffectRegistry.js";
import {
  FieldBuffSlots,
  StatusCollection,
  distanceBetween,
  resolveDamage,
} from "./CombatRules.js";

const FIXED_STEP = 1 / 60;
const MAX_STEPS_PER_CALL = 300;
const MAX_FRAME_DT = 0.25;
const MAX_ENEMIES = 65;
const MAX_PROJECTILES = 160;
const MAX_PARTICLES = 500;
const MAX_DAMAGE_POPUPS = 60;
const EVENT_BUFFER_SIZE = 300;
const VALID_PRIORITIES = Object.freeze(["front", "strong", "air"]);
const STAGE_BASE_HP = Object.freeze({ 1: 80, 2: 115, 3: 150, 4: 190, 5: 235, 6: 285 });
const DIFFICULTY = Object.freeze({
  scout: { hp: 0.88, speed: 0.93, gold: 210 },
  standard: { hp: 1, speed: 1, gold: 180 },
  eclipse: { hp: 1.18, speed: 1.08, gold: 165 },
});

const PRIORITY_ALIASES = Object.freeze({
  leading: "front",
  lead: "front",
  first: "front",
  strongest: "strong",
  elite: "strong",
  aerial: "air",
  anti_air: "air",
});

const DEFAULT_CHARACTER = Object.freeze({
  id: "unknown",
  name: "Unknown",
  kind: "companion",
  element: "light",
  cost: 50,
  attackTags: ["air", "single"],
  targetPolicy: "front",
  damageTypes: ["physical"],
  baseStats: {
    damage: 12,
    attackInterval: 1,
    rangeCells: 3,
    critChance: 0.05,
    critMultiplier: 1.5,
  },
});

const DEFAULT_ENEMIES = Object.freeze({
  normal: { id: "normal", name: "일반", hpMul: 1, speedMul: 1, coreDamage: 8, reward: 2, resistances: {}, tags: ["normal", "ground"] },
  rush: { id: "rush", name: "질주", hpMul: 0.55, speedMul: 1.65, coreDamage: 6, reward: 1, resistances: {}, tags: ["rush", "ground"] },
  swarm: { id: "swarm", name: "군집", hpMul: 0.34, speedMul: 1.12, coreDamage: 3, reward: 1, resistances: {}, tags: ["swarm", "ground"] },
  armored: { id: "armored", name: "중갑", hpMul: 2.5, speedMul: 0.65, coreDamage: 15, reward: 7, resistances: { physical: 0.35 }, tags: ["armored", "ground"] },
  magic: { id: "magic", name: "마법", hpMul: 1.55, speedMul: 0.86, coreDamage: 9, reward: 5, shieldRatio: 0.25, resistances: { magic: 0.35 }, tags: ["magic", "ground"] },
  aerial: { id: "aerial", name: "공중", hpMul: 0.9, speedMul: 1.25, coreDamage: 8, reward: 3, resistances: {}, tags: ["aerial", "air"] },
  split: { id: "split", name: "분열", hpMul: 1.25, speedMul: 0.92, coreDamage: 8, reward: 4, resistances: {}, tags: ["split", "ground"], onDeath: { spawnEnemyId: "swarm", count: 2, childReward: 0, inheritElement: true } },
  cleanse: { id: "cleanse", name: "정화", hpMul: 1.3, speedMul: 0.82, coreDamage: 10, reward: 5, resistances: {}, tags: ["cleanse", "ground", "ability"], ability: { interval: 5, radiusCells: 1.5 } },
  support: { id: "support", name: "지원", hpMul: 1.2, speedMul: 0.78, coreDamage: 11, reward: 5, resistances: {}, tags: ["support", "ground", "ability"], ability: { radiusCells: 1.6, moveSpeedMul: 1.15 } },
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function cellKey(col, row) {
  return `${col},${row}`;
}

function normalizeDeck(deck) {
  if (Array.isArray(deck)) return { all: deck.map((entry) => typeof entry === "string" ? entry : entry?.id).filter(Boolean) };
  const leader = firstDefined(deck?.leader, deck?.leaderId, deck?.leaderCharacterId);
  const companions = firstDefined(deck?.companions, deck?.companionIds, deck?.members, []);
  const ids = [typeof leader === "object" ? leader.id : leader, ...(Array.isArray(companions) ? companions.map((entry) => typeof entry === "object" ? entry.id : entry) : [])].filter(Boolean);
  return { all: ids };
}

function valueFor(collection, id, fallback) {
  if (collection instanceof Map) return firstDefined(collection.get(id), fallback);
  if (Array.isArray(collection)) {
    const match = collection.find((entry) => entry?.id === id || entry?.characterId === id);
    return firstDefined(match?.value, match?.level, match?.branch, match, fallback);
  }
  return firstDefined(collection?.[id], fallback);
}

function idSet(values) {
  if (!Array.isArray(values)) return new Set();
  return new Set(values.map((value) => typeof value === "string" ? value : value?.id).filter(Boolean));
}

function pathMetrics(cells) {
  const segments = [];
  let total = 0;
  for (let index = 0; index < cells.length - 1; index += 1) {
    const from = cells[index];
    const to = cells[index + 1];
    const length = Math.hypot(to.col - from.col, to.row - from.row) || 0.0001;
    segments.push({ from, to, length, startsAt: total, endsAt: total + length });
    total += length;
  }
  return { segments, total: Math.max(total, 0.0001) };
}

function pointAtDistance(path, distance) {
  const value = clamp(distance, 0, path.total);
  const segment = path.segments.find((entry) => value <= entry.endsAt) ?? path.segments[path.segments.length - 1];
  if (!segment) return { x: 0, y: 0 };
  const local = clamp((value - segment.startsAt) / segment.length, 0, 1);
  return {
    x: segment.from.col + (segment.to.col - segment.from.col) * local,
    y: segment.from.row + (segment.to.row - segment.from.row) * local,
  };
}

function hasTag(entity, tag) {
  return Array.isArray(entity?.tags) && entity.tags.includes(tag);
}

function normalizeElitePrefix(prefix) {
  const value = String(prefix ?? "");
  return value.startsWith("elite_") ? value : value ? `elite_${value}` : null;
}

function elementFromProfile(profile, rng) {
  const entries = Object.entries(profile?.weights ?? { water: 1 }).map(([element, weight]) => ({ element, weight: Number(weight) || 0 }));
  return rng.weighted(entries, (entry) => entry.weight)?.element ?? "water";
}

function characterDefinition(id) {
  return CONTENT_MAPS.characters.get(id) ?? { ...DEFAULT_CHARACTER, id, name: id };
}

function enemyDefinition(id, isBoss = false) {
  if (isBoss || CONTENT_MAPS.bosses.has(id)) return CONTENT_MAPS.bosses.get(id) ?? { id, name: id, element: id === "iris_curse" ? "fire" : "water", baseStats: { hpMul: id === "iris_curse" ? 18 : 12, speedMul: 0.5, coreDamage: id === "iris_curse" ? 45 : 30, physicalResist: 0.1, magicResist: 0.1 }, tags: ["boss", "ground", "ability"] };
  return CONTENT_MAPS.enemies.get(id) ?? DEFAULT_ENEMIES[id] ?? { ...DEFAULT_ENEMIES.normal, id, name: id };
}

function serializeStatusCarrier(entity) {
  const copy = { ...entity };
  if (entity.statuses instanceof StatusCollection) copy.statuses = entity.statuses.toJSON();
  delete copy.definition;
  delete copy.traits;
  delete copy.pathMetric;
  return copy;
}

function initialBossState(enemyId, initialHpRatio) {
  const triggered = {};
  const isPast = (threshold) => initialHpRatio < threshold - 1e-8;
  if (enemyId === "artificial_demon") {
    for (const threshold of [0.7, 0.4]) if (isPast(threshold)) triggered[`summon_${threshold}`] = true;
  } else if (enemyId === "iris_curse") {
    for (const threshold of [0.75, 0.35]) if (isPast(threshold)) triggered[`apocalypse_${threshold}`] = true;
    if (isPast(0.5)) triggered.curse_cleanse = true;
    if (isPast(0.2)) triggered.last_procession = true;
  }
  return {
    clock: 0,
    triggered,
    pendingPatterns: [],
    speedBuffFor: 0,
    stoppedFor: 0,
    rangedCoreFor: 0,
    rangedCoreClock: 3,
    initialHpRatio,
  };
}

export class BattleEngine {
  constructor({
    stagePlan,
    deck,
    levels = {},
    branches = {},
    doctrines = [],
    relics = [],
    difficultyId,
    seed,
    settings = {},
    onEvent,
    coreHp = 100,
    coreShield = 0,
    gold,
    costMultiplier = 1,
    leaderActiveCooldownMultiplier = 1,
  } = {}) {
    if (!stagePlan || !Array.isArray(stagePlan.paths) || stagePlan.paths.length === 0) {
      throw new TypeError("BattleEngine requires a StagePlan with at least one path.");
    }
    this.stagePlan = stagePlan;
    this.difficultyId = difficultyId ?? stagePlan.difficultyId ?? "standard";
    this.difficulty = DIFFICULTY[this.difficultyId] ?? DIFFICULTY.standard;
    this.seed = String(seed ?? stagePlan.seed ?? "hero-defense-battle");
    this.rng = new SeededRng(`${this.seed}::combat:${stagePlan.stageNumber ?? 1}`);
    this.deck = normalizeDeck(deck).all;
    this.levels = levels;
    this.branches = branches;
    this.doctrines = idSet(doctrines);
    this.relics = idSet(relics);
    this.mutatorId = typeof stagePlan.mutator === "object" ? stagePlan.mutator?.id : stagePlan.mutator;
    this.costMultiplier = clamp(Number(costMultiplier) || 1, 0.1, 3);
    this.leaderActiveCooldownMultiplier = clamp(Number(leaderActiveCooldownMultiplier) || 1, 0.1, 3);
    this.settings = {
      elementRulesEnabled: settings.elementRulesEnabled !== false,
      elementMultiplier: Number(settings.elementMultiplier) || 1.2,
      damageNumbers: settings.damageNumbers !== false,
      reducedEffects: Boolean(settings.reducedEffects),
      debug: Boolean(settings.debug),
    };
    this.onEvent = typeof onEvent === "function" ? onEvent : () => {};
    this.registry = new EntityRegistry();
    this.effects = new EffectRegistry();
    this.phase = "preparation";
    this.paused = false;
    this.speed = 1;
    this.time = 0;
    this.accumulator = 0;
    this.destroyed = false;
    this.spawnCursor = 0;
    this.warnedWaves = new Set();
    this.spawnSpecs = [...(stagePlan.spawnSpecs ?? stagePlan.waves?.flatMap((wave) => wave.spawns ?? []) ?? [])]
      .sort((left, right) => Number(left.spawnAt) - Number(right.spawnAt) || String(left.id).localeCompare(String(right.id)));
    this.pathMetrics = stagePlan.paths.map((path) => pathMetrics(path.cells ?? path.points ?? path));
    this.occupied = new Map();
    this.events = [];
    this.eventSequence = 0;
    this.lastActionError = null;
    this.debugFlags = {};
    this.hourglassTriggered = false;
    this.lastLightTriggered = false;
    this.victoryBonusApplied = false;
    const doctrineShield = this.doctrines.has("doctrine_core") ? 18 : 0;
    const initialShield = Math.max(0, Number(firstDefined(coreShield, stagePlan.startingCoreShield, 0)) || 0) + doctrineShield;
    const maxShield = (this.relics.has("relic_core_shell") ? 20 : 0) + doctrineShield;
    this.core = {
      col: Number(stagePlan.core?.col ?? stagePlan.layout?.core?.col ?? 10),
      row: Number(stagePlan.core?.row ?? stagePlan.layout?.core?.row ?? 3),
      hp: clamp(Number(firstDefined(coreHp, stagePlan.startingCoreHp, 100)) || 100, 0, 100),
      maxHp: 100,
      shield: initialShield,
      maxShield: Math.max(maxShield, initialShield),
    };
    this.gold = Math.max(0, Number(firstDefined(gold, stagePlan.startingGold, this.difficulty.gold)) || 0);
    const fieldBuffSlots = 3 + (this.relics.has("relic_star_crown") ? 1 : 0) - (this.mutatorId === "mutator_black_moon" ? 1 : 0);
    this.fieldBuffs = new FieldBuffSlots(Math.max(1, fieldBuffSlots));
    this.stats = {
      elapsedTime: 0,
      enemiesSpawned: 0,
      enemiesDefeated: 0,
      enemiesLeaked: 0,
      coreDamageTaken: 0,
      goldEarned: 0,
      damage: 0,
      advantageousDamage: 0,
      criticalHits: 0,
      statusApplications: 0,
      controlTime: 0,
      relocations: 0,
      activeCasts: 0,
      corrosionBreaks: 0,
      delayedDamage: 0,
      byCharacter: {},
    };
    this.#emit("battle_ready", { stageId: stagePlan.id, seed: this.seed });
  }

  #emit(type, detail = {}) {
    const event = { sequence: ++this.eventSequence, type, time: this.time, ...detail };
    this.events.push(event);
    if (this.events.length > EVENT_BUFFER_SIZE) this.events.splice(0, this.events.length - EVENT_BUFFER_SIZE);
    try {
      this.onEvent(event);
    } catch (error) {
      // Presentation callbacks must never break deterministic simulation.
    }
    return event;
  }

  #failAction(reason, detail = {}) {
    this.lastActionError = reason;
    this.#emit("command_rejected", { reason, ...detail });
    return false;
  }

  #definitionInDeck(characterId) {
    return this.deck.includes(characterId) ? characterDefinition(characterId) : null;
  }

  #isLeader(definition) {
    return definition?.kind === "leader" || definition?.type === "leader";
  }

  #hasAllyTrait(traitId) {
    return [...this.registry.allies.values()].some((ally) => Boolean(ally.traits?.[traitId]));
  }

  #rabbitCount() {
    return this.deck.filter((id) => characterDefinition(id).tags?.includes("rabbit")).length;
  }

  #specialTile(col, row) {
    return this.stagePlan.specialTiles?.find((tile) => tile.col === col && tile.row === row) ?? null;
  }

  #fieldBuffEffect(value) {
    const number = Number(value) || 0;
    return this.mutatorId === "mutator_black_moon" ? number * 1.35 : number;
  }

  #tileEffect(value) {
    const number = Number(value) || 0;
    return this.mutatorId === "mutator_leyline" ? number * 1.25 : number;
  }

  #isValidCell(characterId, col, row, moving = false) {
    const definition = this.#definitionInDeck(characterId);
    if (!definition) return { valid: false, reason: "character_not_in_deck" };
    if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0 || col >= 13 || row >= 8) {
      return { valid: false, reason: "outside_grid" };
    }
    const key = cellKey(col, row);
    const occupant = this.occupied.get(key);
    if (occupant && occupant !== characterId) return { valid: false, reason: "occupied" };
    if (this.#isLeader(definition)) {
      const isNode = this.stagePlan.leaderNodes?.some((cell) => cell.col === col && cell.row === row);
      if (!isNode) return { valid: false, reason: "leader_node_required" };
      return { valid: true };
    }
    if (this.stagePlan.paths.some((path) => (path.cells ?? path.points ?? path).some((cell) => cell.col === col && cell.row === row))) {
      return { valid: false, reason: "path_blocked" };
    }
    if (this.stagePlan.obstacles?.some((cell) => cell.col === col && cell.row === row)) return { valid: false, reason: "obstacle" };
    if (this.core.col === col && this.core.row === row) return { valid: false, reason: "core" };
    return { valid: true, moving };
  }

  #placementCost(definition, col, row) {
    if (this.#isLeader(definition)) return 0;
    let cost = Math.max(0, Number(definition.cost) || 0);
    if (this.doctrines.has("doctrine_cost")) cost *= 0.88;
    cost *= this.costMultiplier;
    const tile = this.#specialTile(col, row);
    if (["forge", "foundry", "tile_foundry"].includes(tile?.type ?? tile?.id)) cost *= 1 - this.#tileEffect(0.2);
    return Math.ceil(cost);
  }

  #createAlly(definition, col, row) {
    const level = clamp(Math.floor(Number(valueFor(this.levels, definition.id, 1)) || 1), 1, Number(definition.maxLevel) || (this.#isLeader(definition) ? 6 : 5));
    const branchValue = valueFor(this.branches, definition.id, null);
    const branch = typeof branchValue === "object" ? firstDefined(branchValue.branch, branchValue.id, null) : branchValue;
    const traits = buildRuntimeTraits(definition, level, branch, {
      hasTimeMagician: this.deck.includes("time_magician"),
      rabbitCount: this.#rabbitCount(),
    });
    const base = definition.baseStats ?? definition.stats ?? DEFAULT_CHARACTER.baseStats;
    let attackInterval = Math.max(0.12, numberFrom(base, ["attackInterval", "interval", "attackSpeed"], 1));
    let range = numberFrom(base, ["rangeCells", "range", "attackRange"], 3);
    let damage = numberFrom(base, ["damage", "attackDamage", "power"], 12);
    damage *= traits.damageMultiplier;
    attackInterval *= traits.attackIntervalMultiplier;
    range = (range + traits.rangeAdd) * traits.rangeMultiplier;
    if (this.doctrines.has("doctrine_rate")) attackInterval /= 1.12;
    if (this.doctrines.has("doctrine_range")) range *= 1.1;
    if (this.relics.has("relic_rabbit_hole") && tagsFrom(definition).includes("rabbit")) range += 0.2;
    const tile = this.#specialTile(col, row);
    if (["conduit", "tile_conduit"].includes(tile?.type ?? tile?.id)) {
      damage *= 1 + this.#tileEffect(0.15);
      range *= 1 + this.#tileEffect(0.1);
    }
    const ally = this.registry.add("allies", {
      id: `ally_${definition.id}`,
      characterId: definition.id,
      name: definition.name ?? definition.id,
      kind: this.#isLeader(definition) ? "leader" : "companion",
      element: definition.element ?? "light",
      role: definition.rolePrimary ?? "dealer",
      col,
      row,
      x: col,
      y: row,
      level,
      branch,
      priority: VALID_PRIORITIES.includes(definition.targetPolicy) ? definition.targetPolicy : "front",
      targetId: null,
      damage,
      damageTypes: [...(definition.damageTypes ?? ["physical"])],
      attackTags: [...(definition.attackTags ?? ["air", "single"])],
      attackInterval,
      attackCooldown: this.rng.fork(`ally-start:${definition.id}`).next() * Math.min(attackInterval, 0.35),
      attackCount: 0,
      hitCount: 0,
      range,
      critChance: numberFrom(base, ["critChance", "criticalChance"], 0.05) + traits.critChanceAdd
        + (this.relics.has("relic_rabbit_hole") && tagsFrom(definition).includes("rabbit") ? 0.15 : 0),
      critMultiplier: numberFrom(base, ["critMultiplier", "criticalMultiplier"], 1.5) + traits.critMultiplierAdd,
      activeCooldown: numberFrom(base, ["activeCooldown"], numberFrom(definition, ["activeCooldown"], 20))
        * (this.#isLeader(definition) ? this.leaderActiveCooldownMultiplier : 1)
        * (this.relics.has("relic_support_boost")
          && (definition.skills ?? []).some((skill) => tagsFrom(skill).includes("field_buff")) ? 0.8 : 1),
      activeCooldownRemaining: 0,
      relocationCooldown: 0,
      disabledFor: 0,
      skillClock: 0,
      delayedClock: traits.delayedStrike?.interval ?? 0,
      timeStopClock: traits.timeStop?.interval ?? 0,
      corrosionSplashCooldown: 0,
      airKillChainCooldown: 0,
      delayedNextDelayReduction: 0,
      sameBossHitTargetId: null,
      sameBossHitCount: 0,
      fullHealthHitTargets: {},
      overflowCarryDamage: 0,
      thresholdTraitUsed: false,
      lastFlameFor: 0,
      bonusFieldBuffSlotFor: 0,
      definition,
      traits,
      assetId: definition.assetIds?.battle ?? definition.assetId ?? `battle/${definition.id}`,
      statuses: new StatusCollection(),
      statusApplicationHistory: {},
      tile: tile?.type ?? tile?.id ?? null,
    });
    if (traits.coreShieldMaxAdd) this.core.maxShield += traits.coreShieldMaxAdd;
    return ally;
  }

  place(characterId, col, row) {
    if (this.destroyed) return this.#failAction("destroyed");
    if (!["preparation", "running"].includes(this.phase)) return this.#failAction("placement_unavailable");
    if (this.registry.allies.has(`ally_${characterId}`)) return this.move(characterId, col, row);
    const validation = this.#isValidCell(characterId, col, row);
    if (!validation.valid) return this.#failAction(validation.reason, { characterId, col, row });
    const definition = this.#definitionInDeck(characterId);
    const cost = this.#placementCost(definition, col, row);
    if (this.gold < cost) return this.#failAction("insufficient_gold", { characterId, cost, gold: this.gold });
    this.gold -= cost;
    const ally = this.#createAlly(definition, col, row);
    ally.paidCost = cost;
    ally.costRefunded = false;
    this.occupied.set(cellKey(col, row), characterId);
    this.lastActionError = null;
    this.#emit("ally_placed", { characterId, col, row, cost });
    return true;
  }

  #refundAllyCost(ally, { removeModifiers = false } = {}) {
    if (!ally || ally.costRefunded) return 0;
    const refund = Math.max(0, Number(ally.paidCost) || 0);
    ally.costRefunded = true;
    this.gold += refund;
    if (removeModifiers && ally.traits?.coreShieldMaxAdd) {
      this.core.maxShield = Math.max(0, this.core.maxShield - ally.traits.coreShieldMaxAdd);
      this.core.shield = Math.min(this.core.shield, this.core.maxShield);
    }
    return refund;
  }

  recall(characterId) {
    if (this.destroyed) return this.#failAction("destroyed");
    if (this.phase !== "preparation") return this.#failAction("recall_preparation_only", { characterId });
    const ally = this.registry.allies.get(`ally_${characterId}`);
    if (!ally) return this.#failAction("ally_not_placed", { characterId });
    const refund = this.#refundAllyCost(ally, { removeModifiers: true });
    this.occupied.delete(cellKey(ally.col, ally.row));
    this.registry.remove("allies", ally.id);
    this.lastActionError = null;
    this.#emit("ally_recalled", { characterId, refund, gold: this.gold });
    return true;
  }

  recallAll() {
    if (this.destroyed) return 0;
    if (this.phase !== "preparation") {
      this.#failAction("recall_preparation_only");
      return 0;
    }
    const characterIds = [...this.registry.allies.values()].map((ally) => ally.characterId);
    let recalled = 0;
    for (const characterId of characterIds) if (this.recall(characterId)) recalled += 1;
    return recalled;
  }

  #refundAllDeploymentCosts() {
    let total = 0;
    for (const ally of this.registry.allies.values()) total += this.#refundAllyCost(ally);
    if (total > 0) this.#emit("deployment_costs_refunded", { amount: total, gold: this.gold });
    return total;
  }

  autoPlace() {
    if (this.destroyed || !["preparation", "running"].includes(this.phase)) return false;
    let placed = 0;
    const sortedDeck = [...this.deck].sort((left, right) => {
      const leftLeader = this.#isLeader(characterDefinition(left));
      const rightLeader = this.#isLeader(characterDefinition(right));
      return Number(rightLeader) - Number(leftLeader) || this.deck.indexOf(left) - this.deck.indexOf(right);
    });
    for (const characterId of sortedDeck) {
      if (this.registry.allies.has(`ally_${characterId}`)) continue;
      const definition = characterDefinition(characterId);
      let candidates;
      if (this.#isLeader(definition)) {
        candidates = [...(this.stagePlan.leaderNodes ?? [])].sort((left, right) => {
          const nearestPath = (cell) => Math.min(...this.stagePlan.paths.flatMap((path) => (path.cells ?? path.points ?? path)
            .map((pathCell) => Math.hypot(cell.col - pathCell.col, cell.row - pathCell.row))));
          return nearestPath(left) - nearestPath(right) || left.col - right.col || left.row - right.row;
        });
      } else {
        candidates = [];
        for (let row = 0; row < 8; row += 1) {
          for (let col = 0; col < 13; col += 1) {
            if (this.#isValidCell(characterId, col, row).valid) candidates.push({ col, row });
          }
        }
        candidates.sort((left, right) => {
          const coverage = (cell) => this.stagePlan.paths.reduce((sum, path) => {
            const inRange = (path.cells ?? path.points ?? path).some((pathCell) => Math.hypot(cell.col - pathCell.col, cell.row - pathCell.row) <= 3.2);
            return sum + Number(inRange);
          }, 0);
          const leftTile = this.#specialTile(left.col, left.row) ? 0 : 1;
          const rightTile = this.#specialTile(right.col, right.row) ? 0 : 1;
          const leftPath = Math.min(...this.stagePlan.paths.flatMap((path) => (path.cells ?? path.points ?? path).map((cell) => Math.hypot(left.col - cell.col, left.row - cell.row))));
          const rightPath = Math.min(...this.stagePlan.paths.flatMap((path) => (path.cells ?? path.points ?? path).map((cell) => Math.hypot(right.col - cell.col, right.row - cell.row))));
          return coverage(right) - coverage(left) || leftTile - rightTile || leftPath - rightPath || right.col - left.col || left.row - right.row;
        });
      }
      const candidate = candidates.find((cell) => this.#isValidCell(characterId, cell.col, cell.row).valid && this.gold >= this.#placementCost(definition, cell.col, cell.row));
      if (candidate && this.place(characterId, candidate.col, candidate.row)) placed += 1;
    }
    return placed;
  }

  move(characterId, col, row) {
    const ally = this.registry.allies.get(`ally_${characterId}`);
    if (!ally) return this.#failAction("ally_not_placed", { characterId });
    if (!["preparation", "running"].includes(this.phase)) return this.#failAction("movement_unavailable");
    if (this.phase === "running" && ally.relocationCooldown > 0) return this.#failAction("relocation_cooldown", { remaining: ally.relocationCooldown });
    const validation = this.#isValidCell(characterId, col, row, true);
    if (!validation.valid) return this.#failAction(validation.reason, { characterId, col, row });
    this.occupied.delete(cellKey(ally.col, ally.row));
    ally.col = col;
    ally.row = row;
    ally.x = col;
    ally.y = row;
    ally.tile = this.#specialTile(col, row)?.type ?? null;
    this.occupied.set(cellKey(col, row), characterId);
    if (this.phase === "running") {
      const base = ally.kind === "leader" ? 5 : (this.doctrines.has("doctrine_relocate") ? 7 : 10);
      const tilePenalty = ["forge", "foundry", "tile_foundry"].includes(ally.tile) ? this.#tileEffect(2) : 0;
      ally.relocationCooldown = base + tilePenalty;
      this.stats.relocations += 1;
    }
    this.lastActionError = null;
    this.#emit("ally_moved", { characterId, col, row, cooldown: ally.relocationCooldown });
    return true;
  }

  setPriority(characterId, policy) {
    const ally = this.registry.allies.get(`ally_${characterId}`);
    if (!ally) return this.#failAction("ally_not_placed", { characterId });
    const normalized = PRIORITY_ALIASES[policy] ?? policy;
    if (!VALID_PRIORITIES.includes(normalized)) return this.#failAction("invalid_priority", { policy });
    ally.priority = normalized;
    this.#emit("priority_changed", { characterId, policy: normalized });
    return true;
  }

  start() {
    if (this.phase !== "preparation") return false;
    const leaderPlaced = [...this.registry.allies.values()].some((ally) => ally.kind === "leader");
    if (!leaderPlaced) return this.#failAction("leader_required");
    this.phase = "running";
    this.paused = false;
    this.#emit("battle_started", { placed: this.registry.allies.size });
    this.#emitDueWaveWarnings();
    return true;
  }

  togglePause(force) {
    if (!["preparation", "running"].includes(this.phase)) return this.paused;
    this.paused = typeof force === "boolean" ? force : !this.paused;
    this.#emit(this.paused ? "battle_paused" : "battle_resumed");
    return this.paused;
  }

  setSpeed(value) {
    const speed = Number(value);
    if (!Number.isFinite(speed) || speed < 0 || speed > 20) return false;
    this.speed = speed;
    this.#emit("speed_changed", { speed });
    return true;
  }

  step(dt) {
    if (this.destroyed || this.phase !== "running" || this.paused || this.speed <= 0) return this.getSnapshot();
    const frameDt = clamp(Number(dt) || 0, 0, MAX_FRAME_DT) * this.speed;
    this.accumulator += frameDt;
    let steps = 0;
    while (this.accumulator + 1e-10 >= FIXED_STEP && steps < MAX_STEPS_PER_CALL && this.phase === "running") {
      this.#simulate(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (steps >= MAX_STEPS_PER_CALL) this.accumulator = Math.min(this.accumulator, FIXED_STEP * 5);
    return this.getSnapshot();
  }

  #simulate(dt) {
    const wallClockDt = dt / Math.max(0.001, this.speed);
    this.time += dt;
    this.stats.elapsedTime = this.time;
    this.#emitDueWaveWarnings();
    this.#spawnDueEnemies();
    this.fieldBuffs.update(dt);
    this.#updateStatuses(dt);
    this.#updateEnemyAbilities(dt);
    this.#updateBossPatterns(dt, wallClockDt);
    this.#moveEnemies(dt);
    this.#updateAllies(dt);
    this.#updateProjectiles(dt);
    this.#updateAreaEffects(dt);
    this.#updateBarricades(dt);
    this.#updateTransientVfx(dt);
    this.#resolveBattleEnd();
  }

  #emitDueWaveWarnings() {
    const leadSeconds = Math.max(0, Number(firstDefined(this.stagePlan.wavePreviewLeadSeconds, 8)) || 0);
    for (const wave of this.stagePlan.waves ?? []) {
      const key = String(firstDefined(wave.id, wave.index));
      if (this.warnedWaves.has(key)) continue;
      const startsAt = Math.max(0, Number(wave.startsAt) || 0);
      if (this.time + 1e-8 < Math.max(0, startsAt - leadSeconds)) continue;
      this.warnedWaves.add(key);
      this.#emit("wave_warning", {
        waveId: wave.id ?? key,
        waveIndex: Number(wave.index) || 0,
        waveNumber: (Number(wave.index) || 0) + 1,
        threats: [...(wave.threats ?? [])],
        primaryElement: this.stagePlan.elementProfile?.primaryElement ?? null,
        elementWeights: { ...(this.stagePlan.elementProfile?.weights ?? {}) },
        startsAt,
        startsIn: Math.max(0, startsAt - this.time),
        telegraph: Math.max(0, startsAt - this.time),
      });
    }
  }

  #spawnDueEnemies() {
    while (this.spawnCursor < this.spawnSpecs.length) {
      const spec = this.spawnSpecs[this.spawnCursor];
      if (Number(spec.spawnAt) > this.time + 1e-8) break;
      if (this.registry.activeEnemyCount() >= (this.stagePlan.maxActiveEnemies ?? MAX_ENEMIES)) break;
      this.spawnCursor += 1;
      this.#spawnEnemy(spec);
    }
  }

  #spawnEnemy(spec, overrides = {}) {
    if (this.registry.activeEnemyCount() >= MAX_ENEMIES) return null;
    const isBoss = Boolean(firstDefined(overrides.isBoss, spec.isBoss, spec.bossId, CONTENT_MAPS.bosses.has(spec.enemyId)));
    const definition = enemyDefinition(spec.bossId ?? spec.enemyId, isBoss);
    const baseStats = isBoss ? definition.baseStats ?? definition.stats ?? {} : definition;
    const stageBaseHp = Number(firstDefined(this.stagePlan.baseEnemyHp, STAGE_BASE_HP[this.stagePlan.stageNumber], 80));
    let hpMul = numberFrom(baseStats, ["hpMul", "hpMultiplier"], isBoss ? 12 : 1);
    let speedMul = numberFrom(baseStats, ["speedMul", "speedMultiplier"], isBoss ? 0.5 : 1);
    let physicalResist = numberFrom(baseStats, ["physicalResist", "resistances.physical"], numberFrom(definition, ["resistances.physical"], 0));
    let magicResist = numberFrom(baseStats, ["magicResist", "resistances.magic"], numberFrom(definition, ["resistances.magic"], 0));
    const elitePrefix = normalizeElitePrefix(firstDefined(overrides.elitePrefix, spec.elitePrefix));
    if (elitePrefix === "elite_swift") {
      hpMul *= 0.9;
      speedMul *= 1.25;
    } else if (elitePrefix === "elite_steel") {
      if ((definition.id ?? spec.enemyId) === "armored") hpMul *= 1.25;
      else {
        hpMul *= 1.3;
        physicalResist += 0.15;
      }
      speedMul *= 0.92;
    }
    if (this.mutatorId === "mutator_fortified") hpMul *= 1.18;
    if (this.mutatorId === "mutator_frenzy") speedMul *= 1.12;
    const maxHp = Math.max(1, Math.round(stageBaseHp * hpMul * this.difficulty.hp));
    const requestedInitialHpRatio = Number(firstDefined(overrides.initialHpRatio, spec.initialHpRatio, 1));
    const initialHpRatio = Number.isFinite(requestedInitialHpRatio) ? clamp(requestedInitialHpRatio, 0.01, 1) : 1;
    const shieldRatio = numberFrom(definition, ["shieldRatio"], 0);
    const pathIndex = clamp(Math.floor(Number(firstDefined(overrides.pathIndex, spec.pathIndex, 0)) || 0), 0, this.pathMetrics.length - 1);
    const metric = this.pathMetrics[pathIndex];
    const initialDistance = clamp(Number(firstDefined(overrides.distanceTravelled, 0)) || 0, 0, metric.total);
    const point = pointAtDistance(metric, initialDistance);
    const tags = [...new Set([...(definition.tags ?? []), isBoss ? "boss" : null, elitePrefix ? "elite" : null].filter(Boolean))];
    const enemy = this.registry.add("enemies", {
      enemyId: definition.id ?? spec.enemyId,
      name: definition.name ?? spec.enemyId,
      isBoss,
      elitePrefix,
      element: firstDefined(overrides.element, spec.element, definition.element, elementFromProfile(this.stagePlan.elementProfile, this.rng.fork(`spawn-element:${spec.id ?? this.spawnCursor}`))),
      tags,
      x: point.x,
      y: point.y,
      pathIndex,
      pathId: this.stagePlan.paths[pathIndex]?.id ?? `path_${pathIndex + 1}`,
      distanceTravelled: initialDistance,
      pathLength: metric.total,
      progress: initialDistance / metric.total,
      speed: 0.72 * speedMul * this.difficulty.speed,
      maxHp,
      hp: Math.max(1, Math.floor(maxHp * initialHpRatio)),
      initialHpRatio,
      maxShield: Math.round(maxHp * shieldRatio),
      shield: Math.round(maxHp * shieldRatio),
      physicalResist,
      magicResist,
      coreDamage: numberFrom(baseStats, ["coreDamage"], numberFrom(definition, ["coreDamage"], isBoss ? 30 : 8)),
      reward: Number(firstDefined(overrides.reward, definition.reward, 0)) * Number(firstDefined(spec.rewardMultiplier, 1)),
      spawnOrder: this.stats.enemiesSpawned,
      statuses: new StatusCollection(),
      statusApplicationHistory: {},
      definition,
      abilityClock: numberFrom(definition, ["ability.interval"], 5),
      lastDamagedAgo: Infinity,
      dead: false,
      reachedCore: false,
      bossState: isBoss ? initialBossState(definition.id ?? spec.enemyId, initialHpRatio) : null,
      unyieldingAvailable: elitePrefix === "elite_unyielding",
      regeneration: elitePrefix === "elite_regeneration",
      sourceSpawnId: spec.id ?? null,
      childReward: overrides.childReward,
      assetId: definition.assetId ?? (isBoss ? `boss/${definition.id}` : `enemy/${definition.id}`),
    });
    this.stats.enemiesSpawned += 1;
    this.#emit("enemy_spawned", { entityId: enemy.id, enemyId: enemy.enemyId, element: enemy.element, pathIndex, isBoss, elitePrefix });
    const initialStatuses = Array.isArray(spec.initialStatuses)
      ? spec.initialStatuses
      : spec.statusId
        ? [{ id: spec.statusId, stacks: spec.statusStacks, duration: spec.statusDuration }]
        : [];
    for (const status of initialStatuses) {
      const result = enemy.statuses.apply(status.id, status, enemy);
      if (result.applied) {
        enemy.statusApplicationHistory[status.id] = true;
        this.#emit("status_applied", { sourceId: null, targetId: enemy.id, statusId: status.id, stacks: result.stacks, initial: true });
      }
    }
    if (isBoss) this.#tryTimeJump();
    return enemy;
  }

  #tryTimeJump() {
    if (![...this.registry.enemies.values()].some((enemy) => enemy.isBoss && !enemy.dead)) return false;
    const magician = [...this.registry.allies.values()].find((ally) => ally.traits.timeJump && !ally.timeJumpUsed);
    const delayed = [...this.registry.areaEffects.values()]
      .filter((area) => area.kind === "delayed_attack" && !area.active && !area.fired)
      .sort((left, right) => right.delay - left.delay)[0];
    if (!magician || !delayed) return false;
    magician.timeJumpUsed = true;
    delayed.delay = 0;
    delayed.active = true;
    this.#emit("time_jump", { sourceId: magician.id, areaId: delayed.id });
    return true;
  }

  #updateStatuses(dt) {
    for (const ally of this.registry.allies.values()) {
      ally.statuses.update(dt, {}, ally);
      ally.relocationCooldown = Math.max(0, ally.relocationCooldown - dt);
      const cooldownRate = this.#cooldownRate(ally);
      ally.activeCooldownRemaining = Math.max(0, ally.activeCooldownRemaining - dt * cooldownRate);
      ally.disabledFor = Math.max(0, ally.disabledFor - dt);
      ally.corrosionSplashCooldown = Math.max(0, ally.corrosionSplashCooldown - dt);
      ally.airKillChainCooldown = Math.max(0, ally.airKillChainCooldown - dt);
      ally.lastFlameFor = Math.max(0, ally.lastFlameFor - dt);
      const previousSlotBonus = ally.bonusFieldBuffSlotFor;
      ally.bonusFieldBuffSlotFor = Math.max(0, ally.bonusFieldBuffSlotFor - dt);
      if (previousSlotBonus > 0 && ally.bonusFieldBuffSlotFor <= 0) {
        this.fieldBuffs.maxSlots = Math.max(1, this.fieldBuffs.maxSlots - 1);
        while (this.fieldBuffs.slots.length > this.fieldBuffs.maxSlots) {
          this.fieldBuffs.slots.sort((left, right) => left.createdAt - right.createdAt).shift();
        }
      }
    }
    for (const enemy of [...this.registry.enemies.values()]) {
      enemy.lastDamagedAgo += dt;
      if (enemy.crystalMark) enemy.crystalMark.cooldown = Math.max(0, enemy.crystalMark.cooldown - dt);
      enemy.statuses.update(dt, {
        onBurnTick: (stacks, entry) => {
          const perStackRatio = enemy.isBoss ? 0.0012 : 0.0035;
          const perStack = Math.min(5, enemy.maxHp * perStackRatio);
          const volatileMultiplier = this.mutatorId === "mutator_volatile" ? 1.2 : 1;
          const amount = Math.max(1, Math.round(perStack * stacks * volatileMultiplier));
          const source = this.registry.get(entry.sourceId);
          this.dealDamage(source, enemy, { amount, damageType: "true", element: null, canCrit: false, isDot: true, reason: "burn" });
        },
      }, enemy);
      if (enemy.regeneration && enemy.lastDamagedAgo >= 3 && !enemy.dead) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.04 * dt);
    }
  }

  #supportSpeedMultiplier(enemy) {
    if (hasTag(enemy, "air")) return 1;
    let multiplier = 1;
    for (const support of this.registry.enemies.values()) {
      if (support.dead || support.id === enemy.id || support.enemyId !== "support") continue;
      const radius = numberFrom(support.definition, ["ability.radiusCells"], 1.6);
      if (distanceBetween(enemy, support) <= radius) multiplier = Math.max(multiplier, numberFrom(support.definition, ["ability.moveSpeedMul"], 1.15));
    }
    return multiplier;
  }

  #updateEnemyAbilities(dt) {
    for (const enemy of this.registry.enemies.values()) {
      if (enemy.dead || enemy.isBoss || !enemy.statuses.canAct()) continue;
      if (enemy.enemyId !== "cleanse") continue;
      enemy.abilityClock -= dt;
      if (enemy.abilityClock > 0 || enemy.statuses.has("silence")) continue;
      enemy.abilityClock += numberFrom(enemy.definition, ["ability.interval"], 5);
      const radius = numberFrom(enemy.definition, ["ability.radiusCells"], 1.5);
      const nearby = [...this.registry.enemies.values()]
        .filter((other) => !other.dead && distanceBetween(enemy, other) <= radius)
        .sort((left, right) => left.spawnOrder - right.spawnOrder);
      let removed = null;
      for (const target of nearby) {
        removed = target.statuses.removeOneDebuff();
        if (removed) {
          this.#emit("status_cleansed", { sourceId: enemy.id, targetId: target.id, statusId: removed });
          break;
        }
      }
    }
  }

  #moveEnemies(dt) {
    for (const enemy of [...this.registry.enemies.values()]) {
      if (enemy.dead || enemy.reachedCore) continue;
      const state = enemy.bossState;
      if (state) {
        state.speedBuffFor = Math.max(0, state.speedBuffFor - dt);
        state.stoppedFor = Math.max(0, state.stoppedFor - dt);
      }
      if (!enemy.statuses.canAct() || state?.stoppedFor > 0) continue;
      const barricade = hasTag(enemy, "air") ? null : this.#blockingBarricade(enemy);
      if (barricade) {
        barricade.durability -= enemy.coreDamage * 0.75 * dt;
        barricade.lastHitBy = enemy.id;
        continue;
      }
      let movementMultiplier = enemy.statuses.movementMultiplier();
      if (hasTag(enemy, "air")) {
        const slow = enemy.statuses.get("slow")?.potency ?? 0;
        movementMultiplier = 1 - slow * 0.6;
      }
      movementMultiplier *= this.#supportSpeedMultiplier(enemy);
      if (state?.speedBuffFor > 0) movementMultiplier *= 1.2;
      const distance = enemy.speed * movementMultiplier * dt;
      enemy.distanceTravelled = Math.min(enemy.pathLength, enemy.distanceTravelled + distance);
      enemy.progress = enemy.distanceTravelled / enemy.pathLength;
      const point = pointAtDistance(this.pathMetrics[enemy.pathIndex], enemy.distanceTravelled);
      enemy.x = point.x;
      enemy.y = point.y;
      const secondsToCore = enemy.speed * movementMultiplier > 0
        ? (enemy.pathLength - enemy.distanceTravelled) / (enemy.speed * movementMultiplier)
        : Infinity;
      if (!enemy.coreApproachWarned && secondsToCore <= 1.5) {
        enemy.coreApproachWarned = true;
        this.#emit("core_approach_warning", {
          entityId: enemy.id,
          enemyId: enemy.enemyId,
          pathIndex: enemy.pathIndex,
          secondsToCore: Math.max(0, secondsToCore),
        });
      }
      if (enemy.distanceTravelled >= enemy.pathLength - 1e-6) this.#enemyReachCore(enemy);
    }
  }

  #blockingBarricade(enemy) {
    const barrier = [...this.registry.barricades.values()]
      .filter((candidate) => {
        candidate.blockedEnemyIds = (candidate.blockedEnemyIds ?? []).filter((id) => this.registry.enemies.has(id));
        const hasCapacity = candidate.blockedEnemyIds.includes(enemy.id) || candidate.blockedEnemyIds.length < candidate.stopLimit;
        return hasCapacity && candidate.pathIndex === enemy.pathIndex && candidate.durability > 0 && candidate.duration > 0
          && Math.abs(candidate.progress - enemy.progress) <= 0.035;
      })
      .sort((left, right) => left.progress - right.progress)[0] ?? null;
    if (barrier && !barrier.blockedEnemyIds.includes(enemy.id)) barrier.blockedEnemyIds.push(enemy.id);
    return barrier;
  }

  #enemyReachCore(enemy) {
    if (enemy.dead || enemy.reachedCore) return;
    for (const ally of this.registry.allies.values()) {
      if (ally.targetId === enemy.id) ally.targetId = null;
    }
    enemy.reachedCore = true;
    let damage = enemy.coreDamage;
    if (enemy.statuses.has("curse")) damage *= 0.8;
    if (this.fieldBuffs.has("star_powder") && this.#hasAllyTrait("starPowderCoreDamageMultiplier")) damage *= 1 - this.#fieldBuffEffect(0.15);
    if (this.mutatorId === "mutator_volatile") damage *= 1.1;
    damage = Math.max(0, Math.round(damage));
    const absorbed = Math.min(this.core.shield, damage);
    this.core.shield -= absorbed;
    const hpDamage = damage - absorbed;
    this.core.hp = Math.max(0, this.core.hp - hpDamage);
    this.stats.enemiesLeaked += 1;
    this.stats.coreDamageTaken += hpDamage;
    this.registry.remove("enemies", enemy.id);
    this.#emit("core_damaged", { enemyId: enemy.enemyId, entityId: enemy.id, damage: hpDamage, absorbed, coreHp: this.core.hp });
    if (this.relics.has("relic_hourglass") && !this.hourglassTriggered) {
      this.hourglassTriggered = true;
      for (const target of this.registry.enemies.values()) this.applyStatus(target, "slow", { potency: 0.35, duration: 2 }, null);
      this.#emit("hourglass_triggered", { duration: 2, speedMultiplier: 0.65 });
    }
    if (this.core.hp > 0) this.#triggerCoreThresholdTraits();
    if (this.core.hp <= 0) this.#finish("defeat");
  }

  #triggerCoreThresholdTraits() {
    const hpRatio = this.core.hp / this.core.maxHp;
    for (const leader of this.registry.allies.values()) {
      if (leader.kind !== "leader" || leader.thresholdTraitUsed) continue;
      if (leader.traits.dreamForm && hpRatio < leader.traits.dreamForm.threshold) {
        leader.thresholdTraitUsed = true;
        leader.bonusFieldBuffSlotFor = leader.traits.dreamForm.slotDuration;
        this.fieldBuffs.maxSlots += 1;
        leader.activeCooldownRemaining = 0;
        this.castLeaderActive(this.core.col, this.core.row);
        this.#emit("threshold_trait_triggered", { sourceId: leader.id, traitId: "dream_form" });
      } else if (leader.traits.lastFlame && hpRatio <= leader.traits.lastFlame.threshold) {
        leader.thresholdTraitUsed = true;
        leader.activeCooldownRemaining = 0;
        leader.lastFlameFor = leader.traits.lastFlame.duration;
        this.#emit("threshold_trait_triggered", { sourceId: leader.id, traitId: "last_flame" });
      }
    }
  }

  #updateAllies(dt) {
    for (const ally of this.registry.allies.values()) {
      const cooldownRate = this.#cooldownRate(ally);
      ally.attackCooldown -= dt;
      ally.skillClock += dt * cooldownRate;
      if (ally.disabledFor > 0 || !ally.statuses.canAct()) {
        ally.targetId = null;
        continue;
      }

      if (ally.traits.pangaea && ally.skillClock >= 7) {
        ally.skillClock -= 7;
        const target = this.#findTarget(ally);
        if (target) {
          this.createAreaEffect({
            kind: "delayed_attack",
            sourceId: ally.id,
            x: target.x,
            y: target.y,
            radius: 1,
            delay: 1.8,
            damage: 75 * (ally.traits.upgradeIds.includes("guardian_pangaea_l4") ? 1.25 : 1),
            damageType: "magic",
            element: ally.element,
            duration: 0.01,
            createArena: ally.traits.arenaAfterPangaea,
          });
        }
      }

      if (ally.traits.delayedStrike) {
        ally.delayedClock -= dt * cooldownRate;
        if (ally.delayedClock <= 0) {
          ally.delayedClock += ally.traits.delayedStrike.interval;
          const target = this.#findTarget(ally);
          if (target) {
            const timeMagician = this.#nearbyTimeMagician(ally);
            const baseDelay = timeMagician && ally.traits.delayedStrike.timeMagicianDelay != null
              ? ally.traits.delayedStrike.timeMagicianDelay
              : Math.max(0.05, ally.traits.delayedStrike.delay - ally.delayedNextDelayReduction);
            const delay = timeMagician && ally.traits.delayedStrike.timeMagicianDelay != null
              ? baseDelay
              : this.#adjustDelayedDuration(ally, baseDelay);
            ally.delayedNextDelayReduction = 0;
            this.createAreaEffect({
              kind: "delayed_attack",
              sourceId: ally.id,
              x: target.x,
              y: target.y,
              radius: ally.traits.delayedStrike.radius ?? 0.55,
              delay,
              damage: ally.traits.delayedStrike.damage
                * (timeMagician ? ally.traits.delayedStrike.timeMagicianDamageMultiplier : 1)
                * (this.relics.has("relic_broken_clock") ? 1.45 : 1),
              damageType: "physical",
              element: ally.element,
              duration: 0.01,
              tags: ["delayed", "pierce"],
              nextDelayReduction: ally.traits.delayedStrike.nextDelayReduction ?? 0,
            });
          }
        }
      }

      if (ally.traits.timeStop) {
        ally.timeStopClock -= dt * cooldownRate;
        if (ally.timeStopClock <= 0) {
          ally.timeStopClock += ally.traits.timeStop.interval;
          for (const enemy of this.registry.enemies.values()) {
            this.applyStatus(enemy, "stun", { duration: enemy.isBoss ? ally.traits.timeStop.bossDuration / 0.3 : ally.traits.timeStop.duration }, ally);
            if (ally.traits.zeroHourCastDelay) {
              enemy.abilityClock += ally.traits.zeroHourCastDelay;
              for (const pending of enemy.bossState?.pendingPatterns ?? []) pending.remaining += ally.traits.zeroHourCastDelay;
            }
          }
          this.#emit("time_stop", { sourceId: ally.id });
        }
      }

      const target = this.#findTarget(ally);
      ally.targetId = target?.id ?? null;
      if (ally.attackCooldown > 0) continue;
      if (!target) {
        ally.attackCooldown = Math.max(0, ally.attackCooldown);
        continue;
      }
      this.#fireBasicAttack(ally, target);
      ally.attackCooldown += this.#effectiveAttackInterval(ally);
    }
  }

  #adjustDelayedDuration(source, delay) {
    let result = Number(delay) || 0;
    for (const ally of this.registry.allies.values()) {
      if (ally.characterId !== "time_magician" || !ally.traits.delayedReduction) continue;
      if (distanceBetween(source, ally) <= (ally.traits.supportRadius ?? 2.2)) result *= 1 - ally.traits.delayedReduction;
    }
    if (this.relics.has("relic_broken_clock")) result += 0.8;
    return Math.max(0.05, result);
  }

  #nearbyTimeMagician(target) {
    return [...this.registry.allies.values()].find((ally) =>
      ally.characterId === "time_magician"
      && distanceBetween(target, ally) <= (ally.traits.supportRadius ?? 2.2),
    ) ?? null;
  }

  #cooldownRate(target) {
    const support = this.#nearbyTimeMagician(target);
    if (!support || support.id === target.id || !support.traits.cooldownReductionAura) return 1;
    return 1 + support.traits.cooldownReductionAura;
  }

  #effectiveAttackInterval(ally) {
    let interval = ally.attackInterval;
    if (ally.characterId === "rumi" && (this.fieldBuffs.has("moon_bless") || this.fieldBuffs.has("star_powder"))) {
      interval /= ally.level >= 3 ? 1.12 : 1.1;
    }
    if (ally.characterId === "luna" && this.fieldBuffs.active().length === 0) interval *= 0.85;
    if (ally.lastFlameFor > 0) interval /= ally.traits.lastFlame?.attackSpeedMultiplier ?? 1;
    if (ally.traits.synchronization) {
      const supported = [...this.registry.allies.values()].filter((other) =>
        other.id !== ally.id && distanceBetween(ally, other) <= (ally.traits.supportRadius ?? 2.2),
      ).length;
      if (supported >= ally.traits.synchronization.requiredTargets) interval /= ally.traits.synchronization.attackSpeedMultiplier;
    }
    if (this.relics.has("relic_last_light") && this.core.hp / this.core.maxHp <= 0.3) this.lastLightTriggered = true;
    if (this.lastLightTriggered) interval /= 1.3;
    return Math.max(0.12, interval);
  }

  #canAttack(ally, enemy) {
    if (enemy.dead || enemy.reachedCore) return false;
    const aerial = hasTag(enemy, "air") || hasTag(enemy, "aerial");
    if (aerial && !ally.attackTags.includes("air") && !ally.attackTags.includes("anti_air")) return false;
    const moonRange = this.fieldBuffs.has("moon_bless")
      ? [...this.registry.allies.values()].find((candidate) => candidate.traits.moonBlessEmpower)?.traits.moonBlessEmpower?.rangeMultiplier ?? 1
      : 1;
    const adjustedMoonRange = 1 + this.#fieldBuffEffect(moonRange - 1);
    return distanceBetween(ally, enemy) <= ally.range * adjustedMoonRange + 1e-8;
  }

  #findTarget(ally) {
    const candidates = [...this.registry.enemies.values()].filter((enemy) => this.#canAttack(ally, enemy));
    if (candidates.length === 0) return null;
    const policy = ally.priority;
    candidates.sort((left, right) => {
      if (policy === "air") {
        const leftAir = Number(hasTag(left, "air") || hasTag(left, "aerial"));
        const rightAir = Number(hasTag(right, "air") || hasTag(right, "aerial"));
        if (leftAir !== rightAir) return rightAir - leftAir;
      } else if (policy === "strong") {
        const leftRank = Number(left.isBoss) * 4 + Number(Boolean(left.elitePrefix)) * 2;
        const rightRank = Number(right.isBoss) * 4 + Number(Boolean(right.elitePrefix)) * 2;
        if (leftRank !== rightRank) return rightRank - leftRank;
        if (left.hp !== right.hp) return right.hp - left.hp;
      }
      return right.progress - left.progress || left.spawnOrder - right.spawnOrder;
    });
    return candidates[0];
  }

  #effectiveBasicDamage(ally, target) {
    let amount = ally.damage;
    if (this.fieldBuffs.has("sun_bless")) amount *= 1 + this.#fieldBuffEffect(0.2);
    const moonEmpower = [...this.registry.allies.values()].find((candidate) => candidate.traits.moonBlessEmpower)?.traits.moonBlessEmpower;
    if (this.fieldBuffs.has("moon_bless") && moonEmpower && ally.damageTypes.includes("magic")) {
      amount *= 1 + this.#fieldBuffEffect(moonEmpower.magicDamageMultiplier - 1);
    }
    if (this.relics.has("relic_arena")) amount *= 1.25;
    if (ally.traits.execute && target.hp / target.maxHp <= ally.traits.execute.threshold) amount *= ally.traits.execute.multiplier;
    if (ally.traits.armoredDamageMultiplier && hasTag(target, "armored")) amount *= ally.traits.armoredDamageMultiplier;
    if (ally.traits.antiAirMultiplier && (hasTag(target, "air") || hasTag(target, "aerial"))) amount *= ally.traits.antiAirMultiplier;
    if (ally.traits.rushFallbackAntiAirMultiplier && hasTag(target, "rush")
      && ![...this.registry.enemies.values()].some((enemy) => !enemy.dead && (hasTag(enemy, "air") || hasTag(enemy, "aerial")))) {
      amount *= ally.traits.rushFallbackAntiAirMultiplier;
    }
    if (ally.traits.goldenFlame) {
      if (hasTag(target, "air") || hasTag(target, "aerial")) amount *= ally.traits.goldenFlame.airMultiplier;
      if (target.statuses.has("burn")) amount *= ally.traits.goldenFlame.burningMultiplier;
    }
    if (ally.traits.goldExecute && (target.isBoss || target.elitePrefix) && target.hp / target.maxHp <= ally.traits.goldExecute.threshold) {
      amount *= ally.traits.goldExecute.multiplier;
    }
    if (ally.characterId === "luna" && target.statuses.has("darkness")) amount *= 1.4;
    if (ally.characterId === "silver_rabbit") {
      const otherRabbits = this.deck.filter((id) => id !== "silver_rabbit" && id.includes("rabbit")).length;
      amount *= 1 + otherRabbits * 0.12;
    }
    if (this.#insideArena(ally)) amount *= 1.2;
    return amount;
  }

  #splashRadius(radius) {
    return Math.max(0, Number(radius) || 0) * (this.doctrines.has("doctrine_splash") ? 1.2 : 1);
  }

  #splashDamage(amount) {
    return Math.max(0, Number(amount) || 0)
      * (this.doctrines.has("doctrine_splash") ? 1.08 : 1)
      * (this.mutatorId === "mutator_volatile" ? 1.2 : 1);
  }

  #insideArena(ally) {
    return [...this.registry.areaEffects.values()].some((area) => area.kind === "arena" && area.active && distanceBetween(ally, area) <= area.radius);
  }

  #fireBasicAttack(ally, target) {
    ally.attackCount += 1;
    const traits = ally.traits;
    let damageType = ally.damageTypes[0] ?? "physical";
    if (traits.alternatingDamage) damageType = ally.attackCount % 2 === 1 ? "physical" : "magic";
    if (traits.cinderellaPhysical) damageType = "physical";
    if (traits.cinderellaMagicSplash) damageType = "magic";
    if (traits.goldDragonPhysical) damageType = "physical";
    let projectileCount = Math.max(1, Math.floor(traits.projectilesPerAttack));
    if (traits.extraAirProjectile && (hasTag(target, "air") || hasTag(target, "aerial"))) projectileCount += 1;
    let baseAmount = this.#effectiveBasicDamage(ally, target) * (traits.splash ? traits.splash.multiplier : 1);
    if (traits.splash || traits.cinderellaMagicSplash) baseAmount = this.#splashDamage(baseAmount);
    const firstMultiplier = ally.attackCount === 1 ? Number(traits.firstAttackMultiplier ?? 1) : 1;
    const forceCritical = traits.forceCritEvery ? ally.attackCount % traits.forceCritEvery === 0 : false;
    const forceCritMultiplier = forceCritical && traits.forceCritMoonMultiplier && this.fieldBuffs.has("moon_bless")
      ? traits.forceCritMoonMultiplier
      : traits.forceCritMultiplier;
    for (let index = 0; index < projectileCount; index += 1) {
      const multiplier = index >= Number(traits.projectilesPerAttack ?? 1) ? 0.6 : 1;
      this.#spawnProjectile({
        source: ally,
        target,
        amount: baseAmount * firstMultiplier * multiplier,
        damageType,
        forceCritical,
        critMultiplier: forceCritical && forceCritMultiplier ? forceCritMultiplier : ally.critMultiplier,
        resistanceIgnore: forceCritical ? traits.forceCritResistanceIgnore : 0,
        attackIndex: ally.attackCount,
        projectileIndex: index,
        isBasic: true,
      });
    }
    if (traits.piercingTargets > 1) {
      const secondary = [...this.registry.enemies.values()]
        .filter((enemy) => enemy.id !== target.id && this.#canAttack(ally, enemy))
        .sort((left, right) => right.progress - left.progress || left.spawnOrder - right.spawnOrder)[0];
      if (secondary) this.#spawnProjectile({
        source: ally,
        target: secondary,
        amount: baseAmount * firstMultiplier,
        damageType,
        forceCritical,
        critMultiplier: forceCritical && forceCritMultiplier ? forceCritMultiplier : ally.critMultiplier,
        resistanceIgnore: forceCritical ? traits.forceCritResistanceIgnore : 0,
        attackIndex: ally.attackCount,
        projectileIndex: projectileCount,
        isBasic: true,
        piercingSecondary: true,
      });
    }
    if (traits.barricadeEvery && ally.attackCount % traits.barricadeEvery === 0 && !traits.pangaea) this.#createBarricade(ally, target);
    this.#emit("ally_attack", { sourceId: ally.id, characterId: ally.characterId, targetId: target.id, attackIndex: ally.attackCount });
  }

  #spawnProjectile({ source, target, ...payload }) {
    if (!target || target.dead) return null;
    if (this.registry.projectiles.size >= MAX_PROJECTILES) {
      this.#impactPayload(source, target, payload);
      return null;
    }
    return this.registry.add("projectiles", {
      sourceId: source?.id ?? null,
      characterId: source?.characterId ?? null,
      targetId: target.id,
      x: source?.x ?? target.x,
      y: source?.y ?? target.y,
      destinationX: target.x,
      destinationY: target.y,
      speed: 8,
      ttl: 2.5,
      element: source?.element ?? payload.element ?? null,
      colorToken: payload.damageType === "magic" ? "magic" : "physical",
      payload,
    });
  }

  #updateProjectiles(dt) {
    for (const projectile of [...this.registry.projectiles.values()]) {
      projectile.ttl -= dt;
      const target = this.registry.enemies.get(projectile.targetId);
      if (!target || target.dead || projectile.ttl <= 0) {
        this.registry.remove("projectiles", projectile.id);
        continue;
      }
      projectile.destinationX = target.x;
      projectile.destinationY = target.y;
      const dx = target.x - projectile.x;
      const dy = target.y - projectile.y;
      const distance = Math.hypot(dx, dy);
      const travel = projectile.speed * dt;
      if (distance <= travel + 1e-8) {
        const source = this.registry.allies.get(projectile.sourceId);
        this.registry.remove("projectiles", projectile.id);
        this.#impactPayload(source, target, projectile.payload);
        continue;
      }
      projectile.x += (dx / distance) * travel;
      projectile.y += (dy / distance) * travel;
    }
  }

  #impactPayload(source, target, payload) {
    if (!target || target.dead) return null;
    let amount = Math.max(0, Number(payload.amount) || 0);
    if (source?.overflowCarryDamage > 0 && payload.isBasic) {
      amount += source.overflowCarryDamage;
      source.overflowCarryDamage = 0;
    }
    if (source?.traits?.fullHealthFirstHit && payload.isBasic && target.hp >= target.maxHp && !source.fullHealthHitTargets[target.id]) {
      source.fullHealthHitTargets[target.id] = true;
      amount *= 2;
    }
    const sameBossTrait = source?.traits?.sameBossHitExecute;
    if (sameBossTrait && payload.isBasic) {
      const eligible = target.isBoss || Boolean(target.elitePrefix);
      if (!eligible || source.sameBossHitTargetId !== target.id) {
        source.sameBossHitTargetId = eligible ? target.id : null;
        source.sameBossHitCount = 0;
      }
      if (eligible) {
        source.sameBossHitCount += 1;
        if (source.sameBossHitCount >= sameBossTrait.hits) {
          source.sameBossHitCount = 0;
          amount *= sameBossTrait.multiplier;
          source.activeCooldownRemaining = Math.max(0, source.activeCooldownRemaining - sameBossTrait.cooldownRefund);
          this.#emit("same_boss_hit_execute", { sourceId: source.id, targetId: target.id, hitCount: sameBossTrait.hits, multiplier: sameBossTrait.multiplier });
        }
      }
    }
    if (payload.forceCritical && source?.traits?.forceCritExecute && (target.isBoss || target.elitePrefix)
      && target.hp / target.maxHp <= source.traits.forceCritExecute.threshold) {
      amount *= source.traits.forceCritExecute.multiplier;
    }
    const durabilityBefore = Math.max(0, Number(target.hp) || 0) + Math.max(0, Number(target.shield) || 0);
    const result = this.dealDamage(source, target, {
      amount,
      damageType: payload.damageType,
      element: source?.element,
      critChance: payload.forceCritical ? 1 : source?.critChance,
      critMultiplier: payload.critMultiplier ?? source?.critMultiplier,
      forceCritical: payload.forceCritical,
      isBasic: payload.isBasic,
      attackIndex: payload.attackIndex,
      resistanceIgnore: payload.resistanceIgnore,
      reason: payload.reason,
      splash: payload.splash,
    });
    if (source?.traits?.goldExecute?.overflowCarry && result?.killed) {
      source.overflowCarryDamage = Math.max(0, result.amount - durabilityBefore) * source.traits.goldExecute.overflowCarry;
    }
    if (!source || !payload.isBasic) return result;
    const traits = source.traits;
    source.hitCount += 1;

    if (traits.burnEvery && source.hitCount % traits.burnEvery === 0 && !target.dead) this.applyStatus(target, "burn", { stacks: 1, duration: source.level >= 2 ? 8 : 6 }, source);
    if (traits.corrosionEvery && source.hitCount % traits.corrosionEvery === 0 && !target.dead) {
      const corrosion = this.applyStatus(target, "corrosion", { stacks: 1, duration: 8 }, source);
      if (source.traits.armoredDamageMultiplier && corrosion.stacks >= 3) {
        target.statuses.consume("corrosion", 2);
        this.applyStatus(target, "stun", { duration: 1 }, source);
        this.stats.corrosionBreaks += 1;
        this.#characterStats(source.characterId).corrosionBreaks += 1;
        this.#emit("corrosion_break", { sourceId: source.id, targetId: target.id, remainingStacks: target.statuses.stacks("corrosion") });
      }
    }
    if (traits.frostPerHit && !target.dead) {
      const frost = this.applyStatus(target, "frost", { stacks: traits.frostPerHit, maxStacks: traits.frostThreshold ?? 100 }, source);
      if (frost.triggered === "frozen" && traits.frozenDamageMultiplier) {
        this.applyStatus(target, "frozen_vulnerability", { duration: (target.isBoss ? 0.4 : 1.5) + 2, potency: traits.frozenDamageMultiplier - 1 }, source);
      }
    }
    if (traits.applyDarkness && !target.dead) this.applyStatus(target, "darkness", { duration: 6 }, source);
    if (traits.applySlow && !target.dead) this.applyStatus(target, "slow", traits.applySlow, source);
    if (traits.cinderellaPhysical && source.hitCount % 3 === 0 && !target.dead) {
      const corrosion = this.applyStatus(target, "corrosion", { stacks: 1, duration: 8 }, source);
      if (traits.armoredDamageMultiplier && corrosion.stacks >= 3) {
        target.statuses.consume("corrosion", 2);
        this.applyStatus(target, "stun", { duration: 1 }, source);
        this.stats.corrosionBreaks += 1;
        this.#characterStats(source.characterId).corrosionBreaks += 1;
        this.#emit("corrosion_break", { sourceId: source.id, targetId: target.id, remainingStacks: target.statuses.stacks("corrosion") });
      }
    }
    if (traits.alternatingDamage && !target.dead) this.#updateCrystalMark(source, target, payload.damageType);

    const splash = traits.splash ?? (traits.cinderellaMagicSplash ? { radius: 0.45, multiplier: 1 } : null);
    if (splash) {
      for (const other of this.#enemiesInRadius(target.x, target.y, this.#splashRadius(splash.radius))) {
        if (other.id === target.id) continue;
        this.dealDamage(source, other, { amount: payload.amount, damageType: payload.damageType, element: source.element, isBasic: true, splash: true });
        if (splash.burn && !other.dead) this.applyStatus(other, "burn", { stacks: splash.burn, duration: 6 }, source);
      }
      if (splash.burn && !target.dead) this.applyStatus(target, "burn", { stacks: splash.burn, duration: 6 }, source);
    }
    if (traits.frostSplash && !target.dead) {
      for (const other of this.#enemiesInRadius(target.x, target.y, 0.45)) {
        if (other.id !== target.id) this.applyStatus(other, "frost", { stacks: traits.frostPerHit * 0.5, maxStacks: traits.frostThreshold ?? 100 }, source);
      }
    }
    if (traits.corrosionSplash && source.corrosionSplashCooldown <= 0 && target.statuses.stacks("corrosion") >= 3) {
      target.statuses.consume("corrosion", 1);
      source.corrosionSplashCooldown = traits.corrosionSplash.cooldown;
      this.stats.corrosionBreaks += 1;
      this.#characterStats(source.characterId).corrosionBreaks += 1;
      this.#emit("corrosion_break", { sourceId: source.id, targetId: target.id, remainingStacks: target.statuses.stacks("corrosion") });
      for (const other of this.#enemiesInRadius(target.x, target.y, traits.corrosionSplash.radius)) {
        this.dealDamage(source, other, { amount: traits.corrosionSplash.damage, damageType: "magic", element: source.element, splash: true });
      }
    }
    if (traits.everyNthSplash && payload.attackIndex % traits.everyNthSplash.n === 0) {
      const amount = traits.everyNthSplash.damage ?? payload.amount * (traits.everyNthSplash.multiplier ?? 1);
      for (const other of this.#enemiesInRadius(target.x, target.y, traits.everyNthSplash.radius)) {
        this.dealDamage(source, other, { amount, damageType: traits.everyNthSplash.damageType ?? payload.damageType, element: source.element });
      }
      if (traits.everyNthSplash.cooldownRefund) source.activeCooldownRemaining = Math.max(0, source.activeCooldownRemaining - traits.everyNthSplash.cooldownRefund);
    }
    if (traits.chain && !target.dead) {
      const next = [...this.registry.enemies.values()]
        .filter((enemy) => enemy.id !== target.id && !enemy.dead && distanceBetween(enemy, target) <= 1.6)
        .sort((left, right) => distanceBetween(left, target) - distanceBetween(right, target))[0];
      if (next) this.#spawnProjectile({ source, target: next, amount: payload.amount * traits.chain.multiplier, damageType: payload.damageType, isBasic: true, attackIndex: payload.attackIndex, chain: true });
    }
    this.#markRabbitRelay(source, target, payload);
    return result;
  }

  #markRabbitRelay(source, target, payload) {
    if (target.dead || !source.definition?.tags?.includes("rabbit")) return;
    const attackKey = `${source.id}:${payload.attackIndex}`;
    for (const relay of this.registry.allies.values()) {
      if (!relay.traits.rabbitRelay || relay.id === source.id) continue;
      target.rabbitRelayMarks ??= {};
      const state = target.rabbitRelayMarks[relay.id] ?? { count: 0, lastAttackKey: null };
      if (state.lastAttackKey === attackKey) continue;
      state.lastAttackKey = attackKey;
      state.count = Math.max(0, state.count) + 1;
      if (state.count >= relay.traits.rabbitRelay.marks) {
        state.count = 0;
        this.#spawnProjectile({
          source: relay,
          target,
          amount: this.#effectiveBasicDamage(relay, target) * relay.traits.rabbitRelay.damageMultiplier,
          damageType: "physical",
          isBasic: false,
          reason: "rabbit_relay",
        });
        this.#emit("rabbit_relay", { sourceId: relay.id, markedById: source.id, targetId: target.id });
      }
      target.rabbitRelayMarks[relay.id] = state;
    }
  }

  #updateCrystalMark(source, target, damageType) {
    target.crystalMark ??= { physical: false, magic: false, cooldown: 0 };
    target.crystalMark.cooldown = Math.max(0, target.crystalMark.cooldown - FIXED_STEP);
    target.crystalMark[damageType] = true;
    if (!target.crystalMark.physical || !target.crystalMark.magic || target.crystalMark.cooldown > 0) return;
    target.crystalMark.physical = false;
    target.crystalMark.magic = false;
    target.crystalMark.cooldown = 1.5;
    this.dealDamage(source, target, { amount: source.level >= 2 ? 33 : 25, damageType: "true", element: null, reason: "crystal_mark" });
    if (source.traits.markSilence && target.definition?.abilityIds?.length) this.applyStatus(target, "silence", { duration: 1.5 }, source);
  }

  castLeaderActive(col, row) {
    if (this.phase !== "running" || this.paused) return this.#failAction("active_unavailable");
    if (!Number.isFinite(Number(col)) || !Number.isFinite(Number(row)) || col < 0 || row < 0 || col >= 13 || row >= 8) {
      return this.#failAction("invalid_target", { col, row });
    }
    const leader = [...this.registry.allies.values()].find((ally) => ally.kind === "leader");
    if (!leader || !leader.traits.activeSkillId) return this.#failAction("leader_active_missing");
    if (leader.activeCooldownRemaining > 0 || leader.disabledFor > 0) return this.#failAction("active_cooldown", { remaining: leader.activeCooldownRemaining });
    const skillId = leader.traits.activeSkillId;
    const mechanics = leader.traits.activeMechanics ?? {};
    const point = { x: Number(col), y: Number(row) };
    leader.activeCooldownRemaining = leader.activeCooldown;
    this.stats.activeCasts += 1;
    this.#characterStats(leader.characterId).activeUses += 1;

    if (skillId === "rumi_moonlight_serenade") {
      const radius = numberFrom(mechanics, ["radiusCells"], 2) + (leader.level >= 2 ? 0.2 : 0);
      const duration = numberFrom(mechanics, ["duration"], 4);
      this.createAreaEffect({
        kind: "slow_field",
        sourceId: leader.id,
        ...point,
        radius,
        duration,
        slow: numberFrom(mechanics, ["slow"], 0.4),
        bossSlow: numberFrom(mechanics, ["bossSlow"], 0.2),
        groundOnly: true,
      });
      this.addFieldBuff(firstDefined(mechanics.fieldBuffId, "moon_bless"), {
        duration: numberFrom(mechanics, ["fieldBuffDuration"], 8) + (leader.level >= 3 ? 2 : 0),
      }, leader);
      if (leader.traits.rumiGuard) {
        this.core.maxShield = Math.max(this.core.maxShield, 25 + (leader.traits.coreShieldMaxAdd ?? 0));
        this.core.shield = Math.min(this.core.maxShield, this.core.shield + 25);
        this.addFieldBuff("star_powder", { duration: 8 + (leader.level >= 3 ? 2 : 0) }, leader);
      }
    } else if (skillId === "zeke_ragnarok") {
      const radius = this.#splashRadius(numberFrom(mechanics, ["radiusCells"], 1.25) + (leader.level >= 3 ? 0.15 : 0));
      const targets = this.#enemiesInRadius(point.x, point.y, radius);
      for (const enemy of targets) {
        this.dealDamage(leader, enemy, { amount: this.#splashDamage(numberFrom(mechanics, ["physicalDamage", "damage"], 70)), damageType: "physical", element: leader.element, reason: "ragnarok" });
        const stacks = enemy.statuses.consume(firstDefined(mechanics.consumeStatusId, "burn"), Infinity);
        if (stacks > 0 && !enemy.dead) {
          const perStack = numberFrom(mechanics, ["magicDamagePerStack"], 18) + (leader.level >= 3 ? 10 : 0);
          this.dealDamage(leader, enemy, { amount: stacks * perStack, damageType: "magic", element: leader.element, reason: "burn_detonation", detonatedBurn: stacks });
        }
      }
      if (leader.traits.firePatch) {
        this.createAreaEffect({ kind: "damage_field", sourceId: leader.id, ...point, radius, duration: 5, tickInterval: 1, damage: this.#splashDamage(10), damageType: "magic", element: leader.element, burnEvery: 2, doctrineAdjusted: true });
      }
      if (leader.traits.sunBlessOnActive) this.addFieldBuff("sun_bless", { duration: 8 }, leader);
    } else if (skillId === "luna_dark_meteor") {
      const radius = this.#splashRadius(numberFrom(mechanics, ["radiusCells"], 1.5) * (leader.traits.meteorExpanded ? 1.35 : 1));
      let killsBefore = this.stats.enemiesDefeated;
      for (const enemy of this.#enemiesInRadius(point.x, point.y, radius)) {
        const aerialBonus = leader.traits.meteorExpanded && hasTag(enemy, "air") ? 1.5 : 1;
        this.dealDamage(leader, enemy, { amount: this.#splashDamage(numberFrom(mechanics, ["damage"], 90) * aerialBonus), damageType: "magic", element: leader.element, reason: "dark_meteor" });
        if (leader.traits.meteorExpanded && !hasTag(enemy, "air") && !enemy.dead) this.applyStatus(enemy, "stun", { duration: 1 }, leader);
      }
      const kills = this.stats.enemiesDefeated - killsBefore;
      leader.disabledFor = leader.traits.meteorRecovery ?? numberFrom(mechanics, ["recovery"], 2.5);
      if (kills >= 3 && leader.traits.meteorRecovery) leader.activeCooldownRemaining *= 0.85;
      if (leader.traits.blackMoon) {
        this.createAreaEffect({ kind: "damage_field", sourceId: leader.id, ...point, radius, duration: 4, tickInterval: 1, damage: this.#splashDamage(16), damageType: "magic", element: leader.element, slow: 0.55, bossSlow: 0.25, doctrineAdjusted: true });
      }
    } else if (skillId === "cinderella_midnight_spell") {
      const radius = this.#splashRadius(numberFrom(mechanics, ["radiusCells"], 1.35));
      const targets = this.#enemiesInRadius(point.x, point.y, radius);
      for (const enemy of targets) {
        if (leader.traits.miracleKick) {
          const stacks = enemy.statuses.consume("corrosion", Infinity);
          this.dealDamage(leader, enemy, { amount: 120 + stacks * 20, damageType: "physical", element: leader.element, reason: "miracle_kick" });
        } else {
          this.dealDamage(leader, enemy, { amount: this.#splashDamage(numberFrom(mechanics, ["damage"], 50)), damageType: "magic", element: leader.element, reason: "midnight_spell" });
          for (const status of mechanics.statuses ?? [{ id: "corrosion", stacks: 1 }, { id: "curse", duration: 3 }, { id: "silence", duration: 3 }]) {
            const duration = enemy.isBoss && status.bossDuration ? status.bossDuration : status.duration;
            const upgradedDuration = (duration ?? 3) + (leader.level >= 3 && ["corrosion", "curse"].includes(status.id) ? 2 : 0);
            this.applyStatus(enemy, status.id, {
              ...status,
              duration: status.id === "curse" && leader.traits.hexCurseDuration
                ? Math.max(upgradedDuration, leader.traits.hexCurseDuration)
                : upgradedDuration,
            }, leader);
          }
          if (leader.traits.midnightSeal && !enemy.dead) this.applyStatus(enemy, "midnight_seal", { duration: 6, potency: enemy.isBoss ? 0.15 : 0.25 }, leader);
        }
      }
    } else {
      const radius = numberFrom(mechanics, ["radiusCells", "radius"], 1.25);
      const damage = numberFrom(mechanics, ["damage", "physicalDamage", "magicDamage"], leader.damage * 3);
      const damageType = leader.traits.activeTags.includes("physical") ? "physical" : "magic";
      for (const enemy of this.#enemiesInRadius(point.x, point.y, radius)) {
        this.dealDamage(leader, enemy, { amount: damage, damageType, element: leader.element, reason: skillId });
      }
      for (const status of mechanics.statuses ?? []) {
        for (const enemy of this.#enemiesInRadius(point.x, point.y, radius)) this.applyStatus(enemy, status.id, status, leader);
      }
      if (mechanics.fieldBuffId) this.addFieldBuff(mechanics.fieldBuffId, { duration: mechanics.fieldBuffDuration }, leader);
    }
    if (this.relics.has("relic_blue_moon") && this.stats.activeCasts % 4 === 0) {
      leader.activeCooldownRemaining *= 0.5;
      this.#emit("blue_moon_refund", { sourceId: leader.id, castNumber: this.stats.activeCasts, remaining: leader.activeCooldownRemaining });
    }
    this.#emit("leader_active", { sourceId: leader.id, characterId: leader.characterId, skillId, col: point.x, row: point.y });
    return true;
  }

  #characterStats(characterId) {
    this.stats.byCharacter[characterId] ??= {
      damage: 0,
      advantageousDamage: 0,
      aerialDamage: 0,
      areaDamage: 0,
      kills: 0,
      statusApplications: 0,
      controlTime: 0,
      activeUses: 0,
      corrosionBreaks: 0,
      delayedDamage: 0,
    };
    return this.stats.byCharacter[characterId];
  }

  dealDamage(source, target, payload = {}) {
    if (!target || target.dead || target.reachedCore) return null;
    let amount = Math.max(0, Number(payload.amount) || 0);
    if (source?.characterId && this.relics.has("relic_dragon_heart") && tagsFrom(source.definition).includes("dragon")) {
      amount *= 1.25;
      if (hasTag(target, "air") || hasTag(target, "aerial")) amount *= 1.15;
    }
    if (source?.characterId && this.relics.has("relic_support_boost") && !payload.isDot) amount *= 0.92;
    if (source?.characterId && this.relics.has("relic_arena") && !payload.isBasic && !payload.isDot) amount *= 0.9;
    if (target.statuses?.has("midnight_seal") && payload.damageType === "magic") amount *= 1 + (target.statuses.get("midnight_seal")?.potency ?? 0.25);
    if (target.statuses?.has("frozen_vulnerability")) amount *= 1 + (target.statuses.get("frozen_vulnerability")?.potency ?? 0.2);
    if (payload.damageType === "magic" && target.statuses?.has("corrosion") && this.#hasAllyTrait("corrosionMagicDamageMultiplier")) {
      amount *= [...this.registry.allies.values()].find((ally) => ally.traits.corrosionMagicDamageMultiplier)?.traits.corrosionMagicDamageMultiplier ?? 1;
    }
    const deathClock = [...this.registry.allies.values()].find((ally) =>
      ally.traits.deathClockDamageMultiplier && ally.timeStopClock > 0 && ally.timeStopClock <= 2,
    );
    if (deathClock) amount *= deathClock.traits.deathClockDamageMultiplier;
    let critChance = payload.canCrit === false ? 0 : firstDefined(payload.critChance, source?.critChance, 0);
    if (payload.canCrit !== false && source?.characterId === "luna" && this.fieldBuffs.active().length === 0) critChance += 0.2;
    let critMultiplier = firstDefined(payload.critMultiplier, source?.critMultiplier, 1.5);
    if (this.fieldBuffs.has("sun_bless")) critMultiplier += this.#fieldBuffEffect(0.25);
    const forceCritical = Boolean(payload.forceCritical);
    const resistanceIgnore = Number(payload.resistanceIgnore ?? 0);
    const result = resolveDamage({
      amount,
      damageType: payload.damageType ?? "physical",
      attackerElement: firstDefined(payload.element, source?.element),
      target,
      critChance,
      critMultiplier,
      rng: this.rng,
      forceCritical,
      elementRulesEnabled: this.settings.elementRulesEnabled,
      advantageMultiplier: this.settings.elementMultiplier,
      resistanceIgnore,
      criticalResistanceIgnore: Number(source?.traits?.criticalResistanceIgnore ?? 0),
    });
    const before = target.hp + target.shield;
    const shieldDamage = Math.min(target.shield, result.amount);
    target.shield -= shieldDamage;
    const hpDamage = Math.min(target.hp, result.amount - shieldDamage);
    target.hp = Math.max(0, target.hp - hpDamage);
    const actual = Math.max(0, before - target.hp - target.shield);
    target.lastDamagedAgo = 0;
    const characterId = source?.characterId;
    if (characterId) {
      const characterStats = this.#characterStats(characterId);
      characterStats.damage += actual;
      this.stats.damage += actual;
      if (result.advantageous) {
        characterStats.advantageousDamage += actual;
        this.stats.advantageousDamage += actual;
      }
      if (hasTag(target, "air") || hasTag(target, "aerial")) characterStats.aerialDamage += actual;
      if (payload.splash || payload.reason === "dark_meteor" || payload.reason === "ragnarok") characterStats.areaDamage += actual;
      if (payload.reason === "delayed_attack" || payload.delayed) {
        characterStats.delayedDamage += actual;
        this.stats.delayedDamage += actual;
      }
      if (result.critical) this.stats.criticalHits += 1;
    }
    const damageEvent = this.#emit("damage", {
      sourceId: source?.id ?? null,
      characterId: characterId ?? null,
      targetId: target.id,
      x: target.x,
      y: target.y,
      amount: actual,
      attemptedAmount: result.amount,
      damageType: result.damageType,
      critical: result.critical,
      advantageous: result.advantageous,
      elementMultiplier: result.elementMultiplier,
      reason: payload.reason ?? null,
    });
    this.#spawnDamageVfx(damageEvent);
    if (target.hp <= 0) this.#killEnemy(target, source, payload);
    return { ...result, actual, shieldDamage, hpDamage, killed: target.dead };
  }

  #spawnDamageVfx(event) {
    if (Number(event.amount) <= 0) return;
    if (this.settings.damageNumbers && this.registry.damagePopups.size < MAX_DAMAGE_POPUPS) {
      this.registry.add("damagePopups", {
        targetId: event.targetId,
        x: Number(event.x) || 0,
        y: Number(event.y) || 0,
        amount: event.amount,
        critical: Boolean(event.critical),
        advantageous: Boolean(event.advantageous),
        age: 0,
        ttl: 0.85,
        maxTtl: 0.85,
      });
    }
    if (this.settings.reducedEffects) return;
    const count = event.critical ? 6 : 3;
    for (let index = 0; index < count && this.registry.particles.size < MAX_PARTICLES; index += 1) {
      const ordinal = event.sequence * 7 + index * 11;
      const angle = (ordinal % 24) / 24 * Math.PI * 2;
      const speed = 0.55 + (ordinal % 5) * 0.08;
      this.registry.add("particles", {
        x: Number(event.x) || 0,
        y: Number(event.y) || 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.25,
        age: 0,
        ttl: 0.42,
        maxTtl: 0.42,
        colorToken: event.critical ? "critical" : event.advantageous ? "advantage" : event.damageType,
      });
    }
  }

  #updateTransientVfx(dt) {
    for (const particle of [...this.registry.particles.values()]) {
      particle.age += dt;
      particle.ttl -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 0.9 * dt;
      if (particle.ttl <= 0) this.registry.remove("particles", particle.id);
    }
    for (const popup of [...this.registry.damagePopups.values()]) {
      popup.age += dt;
      popup.ttl -= dt;
      if (popup.ttl <= 0) this.registry.remove("damagePopups", popup.id);
    }
  }

  applyStatus(target, statusId, options = {}, source) {
    if (!target || target.dead || !statusId) return { applied: false, reason: "invalid_target" };
    if (target.unyieldingAvailable && ["stun", "frost"].includes(statusId)) {
      target.unyieldingAvailable = false;
      target.statuses.apply("control_resist", { duration: 3 }, target);
      this.#emit("status_resisted", { targetId: target.id, statusId, reason: "elite_unyielding" });
      return { applied: false, reason: "elite_unyielding" };
    }
    if (target.statuses.has("control_resist") && ["stun", "frost", "frozen"].includes(statusId)) return { applied: false, reason: "control_resist" };
    const adjusted = { ...options, sourceId: source?.id ?? options.sourceId };
    const statusDuration = numberFrom(CONTENT_MAPS.statuses.get(statusId), ["duration", "baseDuration"], 6);
    const seenStatus = Boolean(target.statusApplicationHistory?.[statusId] || target.statuses.has(statusId));
    if (statusId === "burn" && this.relics.has("relic_overflame")) {
      adjusted.maxStacks = 7;
      if (!seenStatus) adjusted.stacks = Number(firstDefined(adjusted.stacks, adjusted.value, 1)) + 1;
    }
    if (statusId === "corrosion" && this.relics.has("relic_assassin_nail")) target.corrosionReduction = 0.16;
    const tile = source ? this.#specialTile(source.col, source.row) : null;
    if (["mycelium", "tile_mycelium"].includes(tile?.type ?? tile?.id) && ["slow", "frost", "burn", "corrosion"].includes(statusId)) {
      if (statusId === "frost") adjusted.stacks = Number(firstDefined(adjusted.stacks, adjusted.value, 1)) * (1 + this.#tileEffect(0.2));
      else adjusted.duration = Number(firstDefined(adjusted.duration, statusDuration)) * (1 + this.#tileEffect(0.2));
    }
    if (this.doctrines.has("doctrine_control") && ["slow", "frost", "stun", "frozen"].includes(statusId)) {
      if (statusId === "frost") adjusted.stacks = Number(firstDefined(adjusted.stacks, adjusted.value, 1)) * (target.isBoss ? 1.1 : 1.2);
      else adjusted.duration = Number(firstDefined(adjusted.duration, 1)) * (target.isBoss ? 1.1 : 1.2);
    }
    if (this.doctrines.has("doctrine_status") && ["burn", "corrosion", "curse", "darkness"].includes(statusId)) adjusted.duration = Number(firstDefined(adjusted.duration, statusDuration)) * 1.2;
    if (this.mutatorId === "mutator_cleanse" && source?.characterId) adjusted.duration = Number(firstDefined(adjusted.duration, statusDuration)) * 1.15;
    const result = target.statuses.apply(statusId, adjusted, target);
    if (result.applied) {
      target.statusApplicationHistory ??= {};
      target.statusApplicationHistory[statusId] = true;
      this.stats.statusApplications += 1;
      if (source?.characterId) {
        const characterStats = this.#characterStats(source.characterId);
        characterStats.statusApplications += 1;
        const duration = Number(adjusted.duration) || 0;
        if (["slow", "frozen", "stun"].includes(statusId)) {
          characterStats.controlTime += duration;
          this.stats.controlTime += duration;
        }
      }
      this.#emit("status_applied", { sourceId: source?.id ?? null, targetId: target.id, statusId, stacks: result.stacks, triggered: result.triggered ?? null });
    }
    return result;
  }

  addFieldBuff(buffId, options = {}, source) {
    const durationMultiplier = this.relics.has("relic_star_crown") ? 0.85 : 1;
    const result = this.fieldBuffs.add(buffId, { ...options, duration: Number(firstDefined(options.duration, 8)) * durationMultiplier, sourceId: source?.id });
    if (buffId === "star_powder" && result.added) {
      const shield = Math.round(this.#fieldBuffEffect(25));
      this.core.maxShield = Math.max(this.core.maxShield, shield);
      this.core.shield = Math.min(this.core.maxShield, this.core.shield + shield);
    }
    this.#emit(result.refreshed ? "field_buff_refreshed" : "field_buff_added", { buffId, sourceId: source?.id ?? null, evicted: result.evicted });
    return result;
  }

  #enemiesInRadius(x, y, radius, { groundOnly = false } = {}) {
    return [...this.registry.enemies.values()]
      .filter((enemy) => !enemy.dead && (!groundOnly || !hasTag(enemy, "air")) && Math.hypot(enemy.x - x, enemy.y - y) <= radius + 1e-8)
      .sort((left, right) => left.spawnOrder - right.spawnOrder);
  }

  createAreaEffect(options = {}) {
    const source = this.registry.get(options.sourceId);
    const delay = Math.max(0, Number(firstDefined(options.delay, 0)) || 0);
    const dealsAreaDamage = Number(firstDefined(options.damage, options.amount, 0)) > 0;
    const areaRadius = Math.max(0.05, Number(firstDefined(options.radius, options.radiusCells, 1)) || 1);
    const areaDamage = Math.max(0, Number(firstDefined(options.damage, options.amount, 0)) || 0);
    const area = this.registry.add("areaEffects", {
      kind: options.kind ?? "area",
      sourceId: options.sourceId ?? null,
      characterId: source?.characterId ?? null,
      x: Number(firstDefined(options.x, options.col, source?.x, 0)) || 0,
      y: Number(firstDefined(options.y, options.row, source?.y, 0)) || 0,
      radius: dealsAreaDamage && !options.doctrineAdjusted ? this.#splashRadius(areaRadius) : areaRadius,
      delay,
      duration: Math.max(0.01, Number(firstDefined(options.duration, 0.01)) || 0.01),
      maxDuration: Math.max(0.01, Number(firstDefined(options.duration, 0.01)) || 0.01),
      active: delay <= 0,
      fired: false,
      tickInterval: Math.max(0.05, Number(firstDefined(options.tickInterval, 0.25)) || 0.25),
      tickClock: 0,
      damage: dealsAreaDamage && !options.doctrineAdjusted ? this.#splashDamage(areaDamage) : areaDamage,
      damageType: options.damageType ?? "magic",
      element: firstDefined(options.element, source?.element, null),
      slow: Number(options.slow) || 0,
      bossSlow: Number(options.bossSlow) || 0,
      burnEvery: Number(options.burnEvery) || 0,
      burnClock: Number(options.burnEvery) || 0,
      groundOnly: Boolean(options.groundOnly),
      createArena: Boolean(options.createArena),
      nextDelayReduction: Math.max(0, Number(options.nextDelayReduction) || 0),
      tags: [...(options.tags ?? [])],
      colorToken: options.colorToken ?? options.kind ?? "area",
      telegraph: Boolean(options.telegraph),
      wallClock: Boolean(options.wallClock),
      bossTelegraph: Boolean(options.bossTelegraph),
    });
    this.#emit("area_created", { areaId: area.id, kind: area.kind, sourceId: area.sourceId, x: area.x, y: area.y, radius: area.radius, delay });
    if (area.kind === "delayed_attack") this.#tryTimeJump();
    return area;
  }

  #updateAreaEffects(dt) {
    for (const area of [...this.registry.areaEffects.values()]) {
      // Pending boss patterns own their warning clock so silence pauses both.
      if (area.bossTelegraph) continue;
      const areaDt = area.wallClock ? dt / Math.max(0.001, this.speed) : dt;
      if (!area.active) {
        area.delay -= areaDt;
        if (area.delay > 0) continue;
        area.active = true;
        this.#emit("area_activated", { areaId: area.id, kind: area.kind });
      }
      if (area.kind === "delayed_attack" && !area.fired) {
        area.fired = true;
        const source = this.registry.get(area.sourceId);
        const targets = this.#enemiesInRadius(area.x, area.y, area.radius, { groundOnly: area.groundOnly });
        for (const enemy of targets) {
          this.dealDamage(source, enemy, { amount: area.damage, damageType: area.damageType, element: area.element, splash: true, reason: "delayed_attack" });
        }
        if (source && area.nextDelayReduction > 0 && targets.length >= 3) source.delayedNextDelayReduction = area.nextDelayReduction;
        if (area.createArena) this.createAreaEffect({ kind: "arena", sourceId: area.sourceId, x: area.x, y: area.y, radius: 2, duration: 5 });
      } else if (area.kind === "slow_field") {
        area.tickClock -= dt;
        if (area.tickClock <= 0) {
          area.tickClock += area.tickInterval;
          const source = this.registry.get(area.sourceId);
          for (const enemy of this.#enemiesInRadius(area.x, area.y, area.radius, { groundOnly: area.groundOnly })) {
            this.applyStatus(enemy, "slow", { potency: enemy.isBoss ? area.bossSlow : area.slow, duration: area.tickInterval + 0.12 }, source);
          }
        }
      } else if (area.kind === "damage_field") {
        area.tickClock -= dt;
        area.burnClock -= dt;
        if (area.tickClock <= 0) {
          area.tickClock += area.tickInterval;
          const source = this.registry.get(area.sourceId);
          for (const enemy of this.#enemiesInRadius(area.x, area.y, area.radius, { groundOnly: area.groundOnly })) {
            this.dealDamage(source, enemy, { amount: area.damage, damageType: area.damageType, element: area.element, splash: true, reason: "damage_field" });
            if (area.slow && !enemy.dead) this.applyStatus(enemy, "slow", { potency: enemy.isBoss ? area.bossSlow : area.slow, duration: area.tickInterval + 0.12 }, source);
          }
        }
        if (area.burnEvery && area.burnClock <= 0) {
          area.burnClock += area.burnEvery;
          const source = this.registry.get(area.sourceId);
          for (const enemy of this.#enemiesInRadius(area.x, area.y, area.radius, { groundOnly: area.groundOnly })) this.applyStatus(enemy, "burn", { stacks: 1, duration: 6 }, source);
        }
      }
      area.duration -= areaDt;
      if (area.duration <= 0) {
        this.registry.remove("areaEffects", area.id);
        this.#emit("area_expired", { areaId: area.id, kind: area.kind });
      }
    }
  }

  #createBarricade(source, target) {
    if (!target || hasTag(target, "air")) return null;
    for (const existing of [...this.registry.barricades.values()]) {
      if (existing.sourceId === source.id) this.registry.remove("barricades", existing.id);
    }
    const durability = (source.level >= 2 ? 115 : 90) * (source.branch === "A" ? 1.7 : 1);
    const progress = clamp(target.progress + 0.035, 0, 0.98);
    const point = pointAtDistance(this.pathMetrics[target.pathIndex], progress * target.pathLength);
    const barrier = this.registry.add("barricades", {
      sourceId: source.id,
      characterId: source.characterId,
      pathIndex: target.pathIndex,
      progress,
      x: point.x,
      y: point.y,
      durability,
      maxDurability: durability,
      duration: 3,
      maxDuration: 3,
      slow: source.traits.barricadeSlow ?? 0,
      stunOnBreak: Boolean(source.traits.barricadeStun),
      stopLimit: source.traits.barricadeStopLimit ?? 2,
      blockedEnemyIds: [],
    });
    this.#emit("barricade_created", { barrierId: barrier.id, sourceId: source.id, pathIndex: target.pathIndex });
    return barrier;
  }

  #updateBarricades(dt) {
    for (const barrier of [...this.registry.barricades.values()]) {
      barrier.duration -= dt;
      if (barrier.slow) {
        const source = this.registry.get(barrier.sourceId);
        for (const enemy of this.#enemiesInRadius(barrier.x, barrier.y, 0.8, { groundOnly: true })) this.applyStatus(enemy, "slow", { potency: barrier.slow, duration: 0.25 }, source);
      }
      if (barrier.durability > 0 && barrier.duration > 0) continue;
      if (barrier.stunOnBreak && barrier.durability <= 0) {
        const source = this.registry.get(barrier.sourceId);
        for (const enemy of this.#enemiesInRadius(barrier.x, barrier.y, 0.9, { groundOnly: true })) this.applyStatus(enemy, "stun", { duration: enemy.isBoss ? 0.4 / 0.3 : 1.5 }, source);
      }
      this.registry.remove("barricades", barrier.id);
      this.#emit("barricade_removed", { barrierId: barrier.id, broken: barrier.durability <= 0 });
    }
  }

  #killEnemy(enemy, source, payload = {}) {
    if (!enemy || enemy.dead) return;
    for (const ally of this.registry.allies.values()) {
      if (ally.targetId === enemy.id) ally.targetId = null;
    }
    const wasFrozen = enemy.statuses.has("frozen");
    const frozenSource = this.registry.get(enemy.statuses.get("frozen")?.sourceId) ?? source;
    enemy.dead = true;
    const definition = enemy.definition ?? {};
    const characterId = source?.characterId;
    this.stats.enemiesDefeated += 1;
    if (characterId) this.#characterStats(characterId).kills += 1;
    let reward = Math.max(0, Number(firstDefined(enemy.childReward, enemy.reward, 0)) || 0);
    if (this.mutatorId === "mutator_fortified" && hasTag(enemy, "armored")) reward *= 1.35;
    if (this.mutatorId === "mutator_aerial" && (hasTag(enemy, "air") || hasTag(enemy, "aerial"))) reward *= 1.25;
    reward = Math.round(reward);
    this.gold += reward;
    this.stats.goldEarned += reward;
    this.registry.remove("enemies", enemy.id);
    this.#emit("enemy_defeated", { entityId: enemy.id, enemyId: enemy.enemyId, sourceId: source?.id ?? null, characterId: characterId ?? null, reward, isBoss: enemy.isBoss });

    if (wasFrozen && this.relics.has("relic_frozen_body")) {
      for (const other of this.#enemiesInRadius(enemy.x, enemy.y, 0.8)) this.applyStatus(other, "frost", { stacks: 35 }, frozenSource);
      this.#emit("frozen_body_spread", { defeatedId: enemy.id, radius: 0.8, gauge: 35 });
    }

    const onDeath = firstDefined(definition.onDeath, enemy.enemyId === "split" ? DEFAULT_ENEMIES.split.onDeath : null);
    if (onDeath?.spawnEnemyId && this.registry.activeEnemyCount() < MAX_ENEMIES) {
      const count = Math.min(Number(onDeath.count) || 2, MAX_ENEMIES - this.registry.activeEnemyCount());
      for (let index = 0; index < count; index += 1) {
        this.#spawnEnemy({
          id: `${enemy.sourceSpawnId ?? enemy.id}_child_${index}`,
          enemyId: onDeath.spawnEnemyId,
          element: onDeath.inheritElement ? enemy.element : elementFromProfile(this.stagePlan.elementProfile, this.rng.fork(`split:${enemy.id}:${index}`)),
          pathIndex: enemy.pathIndex,
          spawnAt: this.time,
          rewardMultiplier: 0,
        }, {
          pathIndex: enemy.pathIndex,
          distanceTravelled: Math.max(0, enemy.distanceTravelled - index * 0.08),
          childReward: Number(onDeath.childReward) || 0,
        });
      }
    }
    if (source?.traits?.burnSpreadOnDetonateKill && payload.reason === "burn_detonation" && payload.detonatedBurn > 0) {
      for (const other of this.#enemiesInRadius(enemy.x, enemy.y, 1.1)) {
        this.applyStatus(other, "burn", { stacks: 1, duration: source.level >= 2 ? 8 : 6 }, source);
      }
      this.#emit("burn_detonation_spread", { sourceId: source.id, defeatedId: enemy.id });
    }
    if (source?.traits?.burnDeathExplosion && enemy.statuses.stacks("burn") > 0 && !payload.burnDeathExplosion) {
      for (const other of this.#enemiesInRadius(enemy.x, enemy.y, 0.8)) this.dealDamage(source, other, { amount: source.traits.burnDeathExplosion, damageType: "magic", element: source.element, splash: true, burnDeathExplosion: true });
    }
    if (source?.traits?.airKillChain && source.airKillChainCooldown <= 0 && (hasTag(enemy, "air") || hasTag(enemy, "aerial"))) {
      const next = [...this.registry.enemies.values()].filter((other) => hasTag(other, "air") || hasTag(other, "aerial")).sort((left, right) => distanceBetween(left, enemy) - distanceBetween(right, enemy))[0];
      if (next) {
        source.airKillChainCooldown = source.traits.airKillChain.cooldown;
        this.dealDamage(source, next, { amount: source.traits.airKillChain.damage, damageType: "magic", element: source.element, reason: "air_kill_chain" });
      }
    }
  }

  #updateBossPatterns(dt, wallClockDt = dt) {
    for (const boss of [...this.registry.enemies.values()].filter((enemy) => enemy.isBoss && !enemy.dead)) {
      const state = boss.bossState;
      state.clock += dt;
      const silenced = boss.statuses.has("silence");
      this.#resolveBossTelegraphs(boss, wallClockDt, silenced);
      const hpRatio = boss.hp / boss.maxHp;
      if (!silenced && boss.enemyId === "artificial_demon") this.#updateArtificialDemon(boss, state, hpRatio);
      else if (!silenced && boss.enemyId === "iris_curse") this.#updateIris(boss, state, hpRatio);
      if (boss.enemyId === "iris_curse") this.#updateIrisRangedCore(boss, state, dt);
    }
  }

  #queueBossPattern(boss, patternId, telegraph = 0, payload = {}) {
    const delay = Math.max(1, Number(telegraph) || 0);
    const pending = { patternId, remaining: delay, telegraph: delay, payload: { ...payload }, warningAreaId: null };
    const globalWarning = ["artificial_demon_rift_summon", "iris_last_procession"].includes(patternId);
    const originCol = Number(payload.originCol);
    const originRow = Number(payload.originRow);
    const warningArea = this.createAreaEffect({
      kind: "warning",
      sourceId: boss.id,
      x: globalWarning ? 6 : Number.isFinite(originCol) ? originCol + 0.5 : boss.x,
      y: globalWarning ? 3.5 : Number.isFinite(originRow) ? originRow + 0.5 : boss.y,
      radius: globalWarning ? 7 : patternId === "iris_apocalypse" ? 1.45 : 1.8,
      duration: delay,
      colorToken: "warning",
      telegraph: true,
      wallClock: true,
      bossTelegraph: true,
    });
    pending.warningAreaId = warningArea.id;
    this.#emit("boss_warning", {
      bossId: boss.id,
      bossDefinitionId: boss.enemyId,
      patternId,
      telegraph: delay,
      executeAt: this.time + delay,
      ...payload,
    });
    if (delay <= 0) this.#executeBossPattern(boss, pending);
    else boss.bossState.pendingPatterns.push(pending);
  }

  #resolveBossTelegraphs(boss, dt, silenced = false) {
    const state = boss.bossState;
    for (const pending of [...state.pendingPatterns]) {
      const warningArea = this.registry.areaEffects.get(pending.warningAreaId);
      if (silenced) {
        continue;
      }
      pending.remaining -= dt;
      if (warningArea) warningArea.duration = Math.max(0, pending.remaining);
      if (pending.remaining > 1e-8) continue;
      state.pendingPatterns.splice(state.pendingPatterns.indexOf(pending), 1);
      if (warningArea) this.registry.remove("areaEffects", warningArea.id);
      this.#executeBossPattern(boss, pending);
    }
  }

  #executeBossPattern(boss, pending) {
    const { patternId, payload = {}, telegraph = 0 } = pending;
    const state = boss.bossState;
    if (patternId === "artificial_demon_destruction_form") {
      state.speedBuffFor = 4;
      const shield = Math.round(boss.maxHp * 0.12);
      boss.maxShield = Math.max(boss.maxShield, shield);
      boss.shield = Math.min(boss.maxShield, boss.shield + shield);
    } else if (patternId === "artificial_demon_rift_summon") {
      this.#summonGroup(boss, "aerial", 4);
      this.#summonGroup(boss, "rush", 4);
    } else if (patternId === "artificial_demon_shockwave") {
      for (const ally of this.registry.allies.values()) ally.relocationCooldown += 3;
    } else if (patternId === "iris_soul_drain") {
      payload.buffId = this.fieldBuffs.suppressOldest(4);
    } else if (patternId === "iris_apocalypse") {
      const originCol = Number(payload.originCol);
      const originRow = Number(payload.originRow);
      const targets = [...this.registry.allies.values()].filter((ally) =>
        ally.col >= originCol && ally.col < originCol + 2 && ally.row >= originRow && ally.row < originRow + 2,
      );
      for (const target of targets) target.disabledFor = Math.max(target.disabledFor, 3);
      payload.hitTargetIds = targets.map((target) => target.id);
    } else if (patternId === "iris_curse_cleanse") {
      boss.statuses.clearDebuffs();
      boss.statuses.apply("control_resist", { duration: 4 }, boss);
      this.#summonGroup(boss, "cleanse", 2);
    } else if (patternId === "iris_last_procession") {
      state.stoppedFor = 6;
      state.rangedCoreFor = 6;
      state.rangedCoreClock = 3;
      this.#summonGroup(boss, "split", 4);
      this.#summonGroup(boss, "magic", 3);
    }
    this.#emit("boss_pattern", {
      bossId: boss.id,
      bossDefinitionId: boss.enemyId,
      patternId,
      telegraph,
      ...payload,
    });
  }

  #updateArtificialDemon(boss, state, hpRatio) {
    const castIndex = Math.floor(state.clock / 8);
    if (castIndex > 0 && !state.triggered[`destruction_${castIndex}`]) {
      state.triggered[`destruction_${castIndex}`] = true;
      this.#queueBossPattern(boss, "artificial_demon_destruction_form", 1.5, { castIndex });
    }
    for (const threshold of [0.7, 0.4]) {
      const key = `summon_${threshold}`;
      if (hpRatio <= threshold && !state.triggered[key]) {
        state.triggered[key] = true;
        this.#queueBossPattern(boss, "artificial_demon_rift_summon", 0.6, { threshold });
      }
    }
    if (boss.progress >= Math.max(0, 1 - 4 / boss.pathLength) && !state.triggered.shockwave) {
      state.triggered.shockwave = true;
      this.#queueBossPattern(boss, "artificial_demon_shockwave", 0.5);
    }
  }

  #updateIris(boss, state, hpRatio) {
    const drainIndex = Math.floor(state.clock / 7);
    if (drainIndex > 0 && !state.triggered[`soul_drain_${drainIndex}`]) {
      state.triggered[`soul_drain_${drainIndex}`] = true;
      this.#queueBossPattern(boss, "iris_soul_drain", 1.2, { castIndex: drainIndex });
    }
    for (const threshold of [0.75, 0.35]) {
      const key = `apocalypse_${threshold}`;
      if (hpRatio <= threshold && !state.triggered[key]) {
        state.triggered[key] = true;
        const target = [...this.registry.allies.values()].sort((left, right) => left.col - right.col || left.row - right.row)[0];
        if (target) {
          const originCol = clamp(target.col, 0, 11);
          const originRow = clamp(target.row, 0, 6);
          this.#queueBossPattern(boss, "iris_apocalypse", 2, { threshold, targetId: target.id, originCol, originRow });
        } else {
          this.#queueBossPattern(boss, "iris_apocalypse", 2, { threshold, targetId: null, originCol: -10, originRow: -10 });
        }
      }
    }
    if (hpRatio <= 0.5 && !state.triggered.curse_cleanse) {
      state.triggered.curse_cleanse = true;
      this.#queueBossPattern(boss, "iris_curse_cleanse", 0.8);
    }
    if (hpRatio <= 0.2 && !state.triggered.last_procession) {
      state.triggered.last_procession = true;
      this.#queueBossPattern(boss, "iris_last_procession", 1);
    }
  }

  #updateIrisRangedCore(boss, state, dt) {
    if (state.rangedCoreFor > 0) {
      state.rangedCoreFor = Math.max(0, state.rangedCoreFor - dt);
      state.rangedCoreClock -= dt;
      if (state.rangedCoreClock <= 0) {
        state.rangedCoreClock += 3;
        const absorbed = Math.min(this.core.shield, 5);
        this.core.shield -= absorbed;
        const hpDamage = 5 - absorbed;
        this.core.hp = Math.max(0, this.core.hp - hpDamage);
        this.stats.coreDamageTaken += hpDamage;
        this.#emit("core_damaged", { enemyId: boss.enemyId, entityId: boss.id, damage: hpDamage, absorbed, coreHp: this.core.hp, ranged: true });
        if (this.core.hp <= 0) this.#finish("defeat");
      }
    }
  }

  #summonGroup(boss, enemyId, count) {
    const available = Math.max(0, MAX_ENEMIES - this.registry.activeEnemyCount());
    const spawnCount = Math.min(available, Math.max(0, Number(count) || 0));
    for (let index = 0; index < spawnCount; index += 1) {
      const pathIndex = index % this.pathMetrics.length;
      const profileRng = this.rng.fork(`boss-summon:${boss.id}:${enemyId}:${index}:${Object.keys(boss.bossState.triggered).length}`);
      this.#spawnEnemy({
        id: `${boss.id}_summon_${enemyId}_${index}_${this.eventSequence}`,
        enemyId,
        element: elementFromProfile(this.stagePlan.elementProfile, profileRng),
        pathIndex,
        spawnAt: this.time,
        rewardMultiplier: 0,
      }, { pathIndex, childReward: 0 });
    }
  }

  #resolveBattleEnd() {
    if (this.phase !== "running") return;
    if (this.core.hp <= 0) {
      this.#finish("defeat");
      return;
    }
    if (this.spawnCursor >= this.spawnSpecs.length && this.registry.activeEnemyCount() === 0) this.#finish("victory");
  }

  #finish(phase) {
    if (!["victory", "defeat"].includes(phase) || ["victory", "defeat"].includes(this.phase)) return;
    if (phase === "victory" && this.mutatorId === "mutator_frenzy" && !this.victoryBonusApplied) {
      const bonus = Math.round(this.stats.goldEarned * 0.2);
      this.gold += bonus;
      this.stats.goldEarned += bonus;
      this.victoryBonusApplied = true;
      this.#emit("mutator_clear_bonus", { mutatorId: this.mutatorId, gold: bonus });
    }
    this.#refundAllDeploymentCosts();
    this.phase = phase;
    this.paused = true;
    this.accumulator = 0;
    this.stats.elapsedTime = this.time;
    this.#emit(phase, { phase, stats: this.#normalizedStats(), core: { ...this.core }, gold: this.gold });
    this.#emit("battle_finished", { phase, victory: phase === "victory" });
  }

  #normalizedStats() {
    const byCharacter = Object.fromEntries(Object.entries(this.stats.byCharacter).map(([id, entry]) => [id, {
      ...entry,
      advantageDamage: entry.advantageousDamage,
      statusesApplied: entry.statusApplications,
      controlSeconds: entry.controlTime,
      activeUses: entry.activeUses,
    }]));
    const aerialDamage = Object.values(this.stats.byCharacter).reduce((sum, entry) => sum + (entry.aerialDamage ?? 0), 0);
    const areaDamage = Object.values(this.stats.byCharacter).reduce((sum, entry) => sum + (entry.areaDamage ?? 0), 0);
    return {
      ...this.stats,
      kills: this.stats.enemiesDefeated,
      damage: this.stats.damage,
      advantageDamage: this.stats.advantageousDamage,
      aerialDamage,
      areaDamage,
      controlSeconds: this.stats.controlTime,
      statusesApplied: this.stats.statusApplications,
      coreDamageTaken: this.stats.coreDamageTaken,
      relocations: this.stats.relocations,
      activeUses: this.stats.activeCasts,
      elapsedSeconds: this.stats.elapsedTime,
      scoreMultiplier: Number(this.stagePlan.scoreMultiplier) || (this.mutatorId === "mutator_split" ? 1.15 : 1),
      byCharacter,
    };
  }

  #placementSnapshot() {
    const costs = {};
    for (const characterId of this.deck) {
      const definition = characterDefinition(characterId);
      costs[characterId] = this.#isLeader(definition) ? 0 : Math.max(0, Number(definition.cost) || 0);
    }
    return {
      occupied: Object.fromEntries(this.occupied),
      costs,
      lastError: this.lastActionError,
      canStart: [...this.registry.allies.values()].some((ally) => ally.kind === "leader"),
    };
  }

  getSnapshot() {
    const allies = [...this.registry.allies.values()].map(serializeStatusCarrier);
    const enemies = [...this.registry.enemies.values()].map(serializeStatusCarrier);
    const projectiles = [...this.registry.projectiles.values()].map((entry) => ({ ...entry, payload: { ...entry.payload } }));
    const areaEffects = [...this.registry.areaEffects.values()].map((entry) => ({ ...entry }));
    const particles = [...this.registry.particles.values()].map((entry) => ({ ...entry }));
    const damagePopups = [...this.registry.damagePopups.values()].map((entry) => ({ ...entry }));
    const barricades = [...this.registry.barricades.values()].map((entry) => ({ ...entry }));
    const currentWave = this.stagePlan.waves?.findLast?.((wave) => this.time >= Number(wave.startsAt))
      ?? [...(this.stagePlan.waves ?? [])].reverse().find((wave) => this.time >= Number(wave.startsAt))
      ?? this.stagePlan.waves?.[0]
      ?? null;
    const nextSpawn = this.spawnSpecs[this.spawnCursor] ?? null;
    return clone({
      phase: this.phase,
      paused: this.paused,
      speed: this.speed,
      time: this.time,
      seed: this.seed,
      stageNumber: this.stagePlan.stageNumber,
      difficultyId: this.difficultyId,
      core: { ...this.core },
      gold: this.gold,
      deck: [...this.deck],
      placement: this.#placementSnapshot(),
      wave: {
        index: currentWave?.index ?? 0,
        number: (currentWave?.index ?? 0) + 1,
        total: this.stagePlan.waves?.length ?? 0,
        id: currentWave?.id ?? null,
        packageId: currentWave?.packageId ?? null,
        threats: currentWave?.threats ?? [],
        nextSpawnIn: nextSpawn ? Math.max(0, Number(nextSpawn.spawnAt) - this.time) : null,
        spawned: this.spawnCursor,
        totalSpawns: this.spawnSpecs.length,
        remaining: this.spawnSpecs.length - this.spawnCursor + enemies.length,
      },
      allies,
      enemies,
      projectiles,
      areaEffects,
      particles,
      damagePopups,
      barricades,
      fieldBuffs: this.fieldBuffs.toJSON(),
      stats: this.#normalizedStats(),
      events: this.events.slice(-EVENT_BUFFER_SIZE),
      limits: {
        enemies: MAX_ENEMIES,
        projectiles: MAX_PROJECTILES,
        particles: MAX_PARTICLES,
        damagePopups: MAX_DAMAGE_POPUPS,
        events: EVENT_BUFFER_SIZE,
        pool: this.registry.poolStats(),
      },
    });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.paused = true;
    this.accumulator = 0;
    this.registry.clear();
    this.occupied.clear();
    this.onEvent = () => {};
    this.events.length = 0;
  }
}

export default BattleEngine;

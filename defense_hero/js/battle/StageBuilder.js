import { CONTENT, CONTENT_MAPS, firstDefined, normalizeCell, tagsFrom } from "./ContentAdapter.js";
import { SeededRng } from "./SeededRng.js";

const GRID = Object.freeze({ cols: 13, rows: 8 });
const ELEMENT_IDS = Object.freeze(["water", "fire", "nature", "light", "dark"]);
const STAGE_ELEMENT_WEIGHTS = Object.freeze({
  1: [0.7, 0.3],
  2: [0.6, 0.4],
  3: [0.6, 0.4],
  4: [0.6, 0.25, 0.15],
  5: [0.5, 0.3, 0.2],
  6: [0.5, 0.3, 0.2],
});

const FALLBACK_LAYOUTS = Object.freeze([
  {
    id: "serpentine_canyon",
    core: [10, 3],
    paths: [
      [[0, 1], [1, 1], [2, 1], [3, 2], [4, 2], [5, 2], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3]],
      [[0, 6], [1, 6], [2, 6], [3, 5], [4, 5], [5, 5], [6, 4], [7, 4], [8, 4], [9, 3], [10, 3]],
    ],
    obstacles: [[3, 0], [4, 4], [7, 1], [8, 6], [11, 5]],
    leaderNodes: [[2, 3], [6, 1], [9, 5]],
    specialTiles: [[1, 4, "conduit"], [5, 6, "forge"], [8, 1, "mycelium"]],
  },
  {
    id: "branch_merge",
    core: [10, 3],
    paths: [
      [[0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [5, 2], [6, 2], [7, 3], [8, 3], [9, 3], [10, 3]],
      [[0, 7], [1, 7], [2, 6], [3, 6], [4, 5], [5, 5], [6, 5], [7, 4], [8, 4], [9, 3], [10, 3]],
    ],
    obstacles: [[2, 3], [4, 0], [4, 7], [7, 1], [7, 6], [11, 2]],
    leaderNodes: [[1, 3], [6, 3], [10, 6]],
    specialTiles: [[3, 3, "conduit"], [5, 0, "forge"], [8, 6, "mycelium"]],
  },
  {
    id: "cliff_bend",
    core: [10, 3],
    paths: [
      [[0, 2], [1, 2], [2, 2], [3, 1], [4, 1], [5, 1], [6, 2], [7, 2], [8, 2], [9, 3], [10, 3]],
      [[0, 5], [1, 5], [2, 5], [3, 6], [4, 6], [5, 6], [6, 5], [7, 5], [8, 5], [9, 4], [10, 3]],
    ],
    obstacles: [[1, 0], [3, 4], [5, 3], [7, 0], [9, 6], [11, 4]],
    leaderNodes: [[2, 4], [6, 3], [9, 1]],
    specialTiles: [[1, 6, "mycelium"], [4, 3, "conduit"], [8, 0, "forge"]],
  },
  {
    id: "cross_fortress",
    core: [10, 3],
    paths: [
      [[0, 1], [1, 1], [2, 1], [3, 2], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3]],
      [[0, 6], [1, 6], [2, 6], [3, 5], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 3], [10, 3]],
    ],
    obstacles: [[2, 3], [3, 7], [5, 1], [7, 6], [9, 1], [11, 5]],
    leaderNodes: [[1, 4], [6, 1], [9, 6]],
    specialTiles: [[3, 3, "forge"], [6, 6, "mycelium"], [8, 1, "conduit"]],
  },
]);

const FALLBACK_PACKAGES = Object.freeze([
  { id: "wave_basic_column", threats: ["normal"], groups: [{ enemyId: "normal", count: 11, interval: 0.75 }] },
  { id: "wave_rush_charge", threats: ["rush"], groups: [{ enemyId: "rush", count: 13, interval: 0.42 }] },
  { id: "wave_swarm_flood", threats: ["swarm"], groups: [{ enemyId: "swarm", count: 16, interval: 0.28 }] },
  { id: "wave_armored_escort", threats: ["armored"], groups: [{ enemyId: "armored", count: 2, interval: 2 }, { enemyId: "normal", count: 8, interval: 0.65, delay: 0.5 }] },
  { id: "wave_magic_formation", threats: ["magic", "support"], groups: [{ enemyId: "magic", count: 4, interval: 1.1 }, { enemyId: "support", count: 1, interval: 1.2 }, { enemyId: "normal", count: 5, interval: 0.7 }] },
  { id: "wave_aerial_scatter", threats: ["aerial"], groups: [{ enemyId: "aerial", count: 8, interval: 0.55, alternatePaths: true }] },
  { id: "wave_split_chain", threats: ["split", "rush"], groups: [{ enemyId: "split", count: 5, interval: 0.9 }, { enemyId: "rush", count: 5, interval: 0.45, delay: 2 }] },
  { id: "wave_cleanse_column", threats: ["cleanse", "armored"], groups: [{ enemyId: "cleanse", count: 2, interval: 2 }, { enemyId: "armored", count: 2, interval: 1.7 }, { enemyId: "normal", count: 4, interval: 0.7 }] },
  { id: "wave_cross_pressure", threats: ["armored", "swarm"], groups: [{ enemyId: "armored", count: 3, interval: 1.5, pathIndex: 0 }, { enemyId: "swarm", count: 10, interval: 0.35, pathIndex: 1 }] },
  { id: "wave_aerial_cover", threats: ["aerial", "armored"], groups: [{ enemyId: "armored", count: 3, interval: 1.4, pathIndex: 0 }, { enemyId: "aerial", count: 7, interval: 0.55, pathIndex: 1 }] },
  { id: "wave_elite_hunt", threats: ["elite"], groups: [{ enemyId: "normal", count: 3, interval: 2, elite: true }, { enemyId: "normal", count: 4, interval: 0.8 }] },
  { id: "wave_mixed_trial", threats: ["mixed"], groups: [{ enemyId: "armored", count: 2, interval: 1.6 }, { enemyId: "aerial", count: 5, interval: 0.6 }, { enemyId: "swarm", count: 8, interval: 0.35, delay: 1 }] },
]);

const MUTATORS = Object.freeze([
  "mutator_frenzy",
  "mutator_fortified",
  "mutator_aerial",
  "mutator_split",
  "mutator_cleanse",
  "mutator_volatile",
  "mutator_leyline",
  "mutator_black_moon",
]);

// Package budgets are deliberately stage-scoped rather than difficulty-scoped:
// difficulty multipliers tune the resolved enemies, while the seeded package
// composition remains reproducible for a stage/node pair.
const STAGE_PACKAGE_BUDGETS = Object.freeze({
  1: 12,
  2: 24,
  3: 15,
  4: 28,
  5: 33,
  6: 18,
});

const ADVANCED_COUNTER_IDS = Object.freeze(new Set(["aerial", "cleanse", "armored"]));
const ELITE_PREFIX_POOL = Object.freeze(["swift", "steel", "regeneration", "unyielding"]);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeElitePrefix(prefix) {
  const value = String(prefix ?? "").replace(/^elite_/, "");
  return value === "regenerating" ? "regeneration" : value || null;
}

function packageCost(entry) {
  return Math.max(1, Math.floor(Number(entry?.budgetCost) || 10));
}

function packageCompositionTags(entry) {
  return unique([
    ...(entry?.threats ?? []),
    ...(entry?.groups ?? []).flatMap((group) => [group.enemyId, ...(group.enemyPool ?? [])]),
  ]);
}

function containsThreat(entry, threatId) {
  return packageCompositionTags(entry).includes(threatId);
}

function violatesDirectIncompatibility(packages) {
  const compositionTags = new Set(packages.flatMap(packageCompositionTags));
  return packages.some((entry) => (entry.incompatibleTags ?? []).some((tag) => compositionTags.has(tag)));
}

function selectPackageSequence({ candidates, count, budget, stageNumber, requireCleanse, rng }) {
  const sequences = [];

  const visit = (selected, spent, advancedCounters) => {
    if (selected.length === count) {
      if (requireCleanse && !selected.some((entry) => containsThreat(entry, "cleanse"))) return;
      if (violatesDirectIncompatibility(selected)) return;
      sequences.push([...selected]);
      return;
    }

    for (const entry of candidates) {
      if (candidates.length > 1 && selected.at(-1)?.id === entry.id) continue;
      const nextSpent = spent + packageCost(entry);
      if (nextSpent > budget) continue;
      const entryCounters = packageCompositionTags(entry).filter((id) => ADVANCED_COUNTER_IDS.has(id));
      const nextCounters = new Set([...advancedCounters, ...entryCounters]);
      if (stageNumber < 4 && nextCounters.size > 1) continue;
      visit([...selected, entry], nextSpent, nextCounters);
    }
  };

  visit([], 0, new Set());
  return rng.pick(sequences) ?? null;
}

function collectionId(entry, fallback) {
  return String(firstDefined(entry?.id, entry?.type, entry?.enemyId, fallback));
}

function normalizeLayout(raw, fallbackIndex) {
  const fallback = FALLBACK_LAYOUTS[fallbackIndex % FALLBACK_LAYOUTS.length];
  const sourcePaths = firstDefined(raw?.paths, raw?.groundPaths, raw?.routes, fallback.paths);
  const paths = (Array.isArray(sourcePaths) ? sourcePaths : fallback.paths).slice(0, 2).map((path, index) => {
    const cells = Array.isArray(path) ? path : firstDefined(path?.cells, path?.points, path?.waypoints, []);
    const normalized = cells.map(normalizeCell);
    return {
      id: String(firstDefined(path?.id, `path_${index + 1}`)),
      cells: normalized.length >= 2 ? normalized : fallback.paths[index].map(normalizeCell),
    };
  });
  while (paths.length < 2) {
    const index = paths.length;
    paths.push({ id: `path_${index + 1}`, cells: fallback.paths[index].map(normalizeCell) });
  }
  const obstacleSource = firstDefined(raw?.obstacles, raw?.blockedCells, fallback.obstacles);
  const leaderSource = firstDefined(raw?.leaderNodes, raw?.leaderSpots, fallback.leaderNodes);
  const tileSource = firstDefined(raw?.specialTiles, raw?.specialTileCandidates, raw?.tiles, fallback.specialTiles);
  return {
    id: String(firstDefined(raw?.id, fallback.id)),
    name: String(firstDefined(raw?.name, fallback.name, "전장")),
    description: String(firstDefined(raw?.description, fallback.description, "두 경로가 코어로 합류하는 전장입니다.")),
    cols: GRID.cols,
    rows: GRID.rows,
    core: normalizeCell(firstDefined(raw?.core, raw?.coreCell, fallback.core)),
    paths,
    obstacles: (Array.isArray(obstacleSource) ? obstacleSource : []).map(normalizeCell),
    leaderNodes: (Array.isArray(leaderSource) ? leaderSource : []).slice(0, 3).map(normalizeCell),
    specialTiles: (Array.isArray(tileSource) ? tileSource : []).map((tile, index) => ({
      ...normalizeCell(tile),
      id: String(firstDefined(tile?.id, `special_${index + 1}`)),
      type: String(firstDefined(tile?.type, Array.isArray(tile) ? tile[2] : undefined, ["conduit", "forge", "mycelium"][index % 3])),
    })),
  };
}

function elementProfilesThrough(stageNumber, seed) {
  const profiles = [];
  let previous;
  for (let stage = 1; stage <= stageNumber; stage += 1) {
    const rng = new SeededRng(`${seed}::element-profile::${stage}`);
    const shuffled = rng.shuffle(ELEMENT_IDS);
    if (shuffled[0] === previous) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }
    const weights = STAGE_ELEMENT_WEIGHTS[Math.min(6, Math.max(1, stage))];
    const elements = shuffled.slice(0, weights.length);
    const profile = {
      id: `element_profile_${elements.join("_")}_${stage}`,
      primaryElement: elements[0],
      secondaryElement: elements[1],
      optionalThirdElement: elements[2] ?? null,
      weights: Object.fromEntries(elements.map((element, index) => [element, weights[index]])),
      maxElementsPerGroup: 2,
    };
    profiles.push(profile);
    previous = profile.primaryElement;
  }
  return profiles;
}

function overrideElementProfile(profile, overrides = {}) {
  if (overrides.elementProfile && typeof overrides.elementProfile === "object") {
    const weights = overrides.elementProfile.weights ?? overrides.elementProfile;
    const entries = Object.entries(weights).filter(([element, weight]) => ELEMENT_IDS.includes(element) && Number(weight) > 0);
    if (entries.length > 0) {
      const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
      const normalized = Object.fromEntries(entries.map(([element, weight]) => [element, Number(weight) / total]));
      const elements = Object.keys(normalized);
      return {
        id: `element_profile_training_${elements.join("_")}`,
        primaryElement: elements[0],
        secondaryElement: elements[1] ?? elements[0],
        optionalThirdElement: elements[2] ?? null,
        weights: normalized,
        maxElementsPerGroup: 2,
      };
    }
  }
  const forced = firstDefined(overrides.primaryElement, overrides.element, overrides.enemyElement);
  if (!forced && Array.isArray(overrides.elementPool) && overrides.elementPool.length > 0) {
    const elements = unique(overrides.elementPool.filter((element) => ELEMENT_IDS.includes(element)))
      .slice(0, Math.max(1, Number(overrides.maxElements) || 2));
    if (elements.length > 0) {
      const weight = 1 / elements.length;
      return {
        ...profile,
        id: `element_profile_training_${elements.join("_")}`,
        primaryElement: elements[0],
        secondaryElement: elements[1] ?? elements[0],
        optionalThirdElement: elements[2] ?? null,
        weights: Object.fromEntries(elements.map((element) => [element, weight])),
        maxElementsPerGroup: Math.min(elements.length, Math.max(1, Number(overrides.maxElements) || 2)),
      };
    }
  }
  if (!ELEMENT_IDS.includes(forced)) return profile;
  const rest = ELEMENT_IDS.filter((element) => element !== forced);
  const secondary = rest[0];
  return {
    ...profile,
    id: `element_profile_training_${forced}_${secondary}`,
    primaryElement: forced,
    secondaryElement: secondary,
    optionalThirdElement: null,
    weights: { [forced]: 0.7, [secondary]: 0.3 },
  };
}

function enemyIdFor(requested) {
  if (CONTENT_MAPS.enemies.has(requested)) return requested;
  const alias = requested === "air" ? "aerial" : requested;
  const match = CONTENT.enemies.find((enemy) => {
    const tags = unique([enemy.id, enemy.type, enemy.enemyType, ...tagsFrom(enemy)]);
    return tags.includes(alias) || tags.includes(requested);
  });
  return match?.id ?? CONTENT.enemies[0]?.id ?? requested ?? "normal";
}

function bossIdFor(stageNumber, override) {
  if (override && CONTENT_MAPS.bosses.has(override)) return override;
  const preferred = stageNumber >= 6 ? ["iris_curse", "iris", "curse_iris"] : ["artificial_demon", "demon"];
  for (const id of preferred) {
    const match = CONTENT.bosses.find((boss) => boss.id === id || boss.id?.includes(id));
    if (match) return match.id;
  }
  return CONTENT.bosses[stageNumber >= 6 ? 1 : 0]?.id ?? preferred[0];
}

function normalizePackage(entry) {
  const id = collectionId(entry, "wave_basic_column");
  const rawGroups = firstDefined(entry?.groups, entry?.waveGroups, entry?.spawns, entry?.composition);
  let groups = [];
  if (Array.isArray(rawGroups)) {
    groups = rawGroups.map((group) => ({ ...group }));
  } else if (rawGroups && typeof rawGroups === "object") {
    groups = Object.entries(rawGroups).map(([enemyId, count]) => ({ enemyId, count }));
  }
  if (groups.length === 0 && entry?.enemyId) groups = [{ enemyId: entry.enemyId, count: entry.count ?? 1 }];
  return {
    ...entry,
    id,
    threats: unique(firstDefined(entry?.threats, entry?.threatTags, entry?.tags, []).map?.(String) ?? []),
    budgetCost: packageCost(entry),
    incompatibleTags: unique((Array.isArray(entry?.incompatibleTags) ? entry.incompatibleTags : []).map(String)),
    groups,
  };
}

function eligiblePackages(stageNumber) {
  const source = CONTENT.wavePackages.length > 0 ? CONTENT.wavePackages : FALLBACK_PACKAGES;
  const stageDefinition = CONTENT.stages.find((entry) => Number(entry.number ?? entry.stageNumber) === Number(stageNumber));
  const allowedIds = new Set(stageDefinition?.allowedWavePackageIds ?? []);
  const normalized = source.map(normalizePackage).filter((entry) => {
    if (allowedIds.size > 0 && !allowedIds.has(entry.id)) return false;
    const range = firstDefined(entry.stageRange, entry.stages);
    if (Array.isArray(range) && range.length >= 2) return stageNumber >= Number(range[0]) && stageNumber <= Number(range[1]);
    const min = Number(firstDefined(entry.minStage, entry.stageMin, 1));
    const max = Number(firstDefined(entry.maxStage, entry.stageMax, 6));
    return stageNumber >= min && stageNumber <= max;
  });
  return normalized.length > 0 ? normalized : FALLBACK_PACKAGES.map(normalizePackage);
}

function groupAllowedElements(profile, rng) {
  const entries = Object.entries(profile.weights).map(([element, weight]) => ({ element, weight }));
  if (entries.length <= 2) return entries;
  const primary = entries.find((entry) => entry.element === profile.primaryElement) ?? entries[0];
  const remainder = entries.filter((entry) => entry !== primary);
  return [primary, rng.weighted(remainder, (entry) => entry.weight)].filter(Boolean);
}

function pickGroupElement(allowed, rng) {
  return rng.weighted(allowed, (entry) => entry.weight)?.element ?? allowed[0]?.element ?? "water";
}

function resolveGroup(group, fallbackPathIndex) {
  const countSource = firstDefined(group.count, group.amount, group.quantity, 1);
  const lanePolicy = String(firstDefined(group.lanePolicy, ""));
  const pathIndex = lanePolicy === "path_b" || lanePolicy === "south" ? 1 : lanePolicy === "path_a" ? 0 : fallbackPathIndex;
  return {
    enemyId: firstDefined(group.enemyId, group.type, group.enemyType, null),
    enemyPool: Array.isArray(group.enemyPool) ? [...group.enemyPool] : [],
    count: typeof countSource === "object"
      ? { min: Math.max(1, Math.floor(Number(firstDefined(countSource.min, countSource.minimum, 1)) || 1)), max: Math.max(1, Math.floor(Number(firstDefined(countSource.max, countSource.maximum, countSource.min, 1)) || 1)) }
      : Math.max(1, Math.floor(Number(countSource) || 1)),
    interval: Math.max(0.08, Number(firstDefined(group.interval, group.spawnInterval, 0.7)) || 0.7),
    delay: Math.max(0, Number(firstDefined(group.delay, group.startDelay, 0)) || 0),
    pathIndex: Math.max(0, Math.floor(Number(firstDefined(group.pathIndex, group.path, pathIndex)) || 0)) % 2,
    alternatePaths: Boolean(firstDefined(group.alternatePaths, group.splitPaths, ["alternate", "alternate_bundles", "split", "escort", "counter_lane"].includes(lanePolicy))),
    elite: Boolean(firstDefined(group.elite, group.isElite, false)),
    elitePrefix: normalizeElitePrefix(firstDefined(group.elitePrefix, group.prefix, null)),
    element: firstDefined(group.element, null),
  };
}

function buildWave(packageEntry, waveIndex, waveStart, profile, rng, mutator = null) {
  const groups = packageEntry.groups.length > 0 ? packageEntry.groups : [{ enemyId: "normal", count: 8 }];
  const spawns = [];
  let waveEnd = waveStart;
  groups.forEach((rawGroup, groupIndex) => {
    const group = resolveGroup(rawGroup, groupIndex % 2);
    const count = typeof group.count === "object"
      ? rng.fork(`count:${groupIndex}`).int(group.count.min, Math.max(group.count.min, group.count.max))
      : group.count;
    const allowedElements = groupAllowedElements(profile, rng.fork(`elements:${groupIndex}`));
    for (let spawnIndex = 0; spawnIndex < count; spawnIndex += 1) {
      const spawnRng = rng.fork(`spawn:${groupIndex}:${spawnIndex}`);
      let pathIndex = group.alternatePaths ? (group.pathIndex + spawnIndex) % 2 : group.pathIndex;
      if (mutator === "mutator_split" && !group.alternatePaths && spawnIndex % 4 === 3) pathIndex = (pathIndex + 1) % 2;
      const spawnAt = waveStart + group.delay + spawnIndex * group.interval;
      const elitePrefix = group.elitePrefix ?? (group.elite ? spawnRng.pick(ELITE_PREFIX_POOL) : null);
      const element = ELEMENT_IDS.includes(group.element) ? group.element : pickGroupElement(allowedElements, spawnRng);
      spawns.push({
        id: `spawn_${waveIndex}_${groupIndex}_${spawnIndex}`,
        waveIndex,
        groupIndex,
        enemyId: enemyIdFor(group.enemyId ?? spawnRng.pick(group.enemyPool) ?? "normal"),
        element,
        pathId: `path_${pathIndex + 1}`,
        pathIndex,
        spawnAt,
        elitePrefix,
        rewardMultiplier: elitePrefix ? 1.2 : 1,
      });
      waveEnd = Math.max(waveEnd, spawnAt);
    }
  });
  return {
    id: `stage_wave_${waveIndex + 1}`,
    index: waveIndex,
    packageId: packageEntry.id,
    budgetCost: packageCost(packageEntry),
    incompatibleTags: [...(packageEntry.incompatibleTags ?? [])],
    startsAt: waveStart,
    endsSpawningAt: waveEnd,
    threats: packageEntry.threats,
    previewText: firstDefined(packageEntry.previewText, packageEntry.name, packageEntry.id),
    spawns,
  };
}

function addBossWave(waves, stageNumber, profile, overrideBossId, overrideElement) {
  const bossId = bossIdFor(stageNumber, overrideBossId);
  const previousEnd = waves.reduce((max, wave) => Math.max(max, wave.endsSpawningAt), 0);
  const waveIndex = waves.length;
  const element = ELEMENT_IDS.includes(overrideElement) ? overrideElement : stageNumber >= 6 ? "fire" : "water";
  const spawnAt = previousEnd + 6;
  waves.push({
    id: `stage_wave_${waveIndex + 1}_boss`,
    index: waveIndex,
    packageId: `boss_${bossId}`,
    budgetCost: 0,
    incompatibleTags: [],
    startsAt: spawnAt,
    endsSpawningAt: spawnAt,
    threats: ["boss", stageNumber >= 6 ? "cleanse" : "aerial"],
    previewText: CONTENT_MAPS.bosses.get(bossId)?.name ?? bossId,
    spawns: [{
      id: `spawn_${waveIndex}_boss`,
      waveIndex,
      groupIndex: 0,
      enemyId: bossId,
      bossId,
      isBoss: true,
      element,
      pathId: "path_1",
      pathIndex: 0,
      spawnAt,
      elitePrefix: null,
      rewardMultiplier: 1,
      summonElementProfile: profile,
    }],
  });
}

function stageWaveCount(stageNumber) {
  return [1, 2, 1, 2, 2, 1][Math.min(6, Math.max(1, stageNumber)) - 1];
}

export class StageBuilder {
  static buildStagePlan(options) {
    return buildStagePlan(options);
  }
}

export function buildStagePlan({
  stageNumber,
  seed,
  difficultyId,
  nodeVariant = 0,
  trainingOverrides = {},
} = {}) {
  const normalizedStage = Math.min(6, Math.max(1, Math.floor(Number(stageNumber) || 1)));
  const normalizedSeed = String(seed ?? "hero-defense-seed");
  const normalizedDifficulty = ["scout", "standard", "eclipse"].includes(difficultyId) ? difficultyId : "standard";
  const rng = new SeededRng(`${normalizedSeed}::stage:${normalizedStage}::node:${nodeVariant}`);
  let mutator = trainingOverrides.mutator ?? trainingOverrides.mutatorId ?? null;
  if (!mutator && normalizedStage >= 2) mutator = rng.fork("mutator").pick(MUTATORS);
  const layoutPool = CONTENT.mapLayouts.length > 0 ? CONTENT.mapLayouts : FALLBACK_LAYOUTS;
  const forcedLayout = trainingOverrides.layoutId
    ? layoutPool.find((layout) => layout.id === trainingOverrides.layoutId)
    : null;
  const layoutIndex = forcedLayout ? layoutPool.indexOf(forcedLayout) : rng.int(0, layoutPool.length - 1);
  const layout = normalizeLayout(forcedLayout ?? layoutPool[layoutIndex], layoutIndex);
  const specialCount = Math.min(
    layout.specialTiles.length,
    Math.max(2, Math.floor(Number(firstDefined(trainingOverrides.specialTileCount, rng.fork("special-count").int(2, 3))) || 2))
      + (mutator === "mutator_leyline" ? 1 : 0),
  );
  const specialTypes = ["conduit", "forge", "mycelium"];
  layout.specialTiles = rng.fork("special-tiles").shuffle(layout.specialTiles).slice(0, specialCount).map((tile, index) => ({
    ...tile,
    type: specialTypes[index % specialTypes.length],
  }));
  let elementProfile = elementProfilesThrough(normalizedStage, normalizedSeed)[normalizedStage - 1];
  elementProfile = overrideElementProfile(elementProfile, trainingOverrides);

  const candidates = eligiblePackages(normalizedStage);
  const waveCount = stageWaveCount(normalizedStage);
  const packageBudget = STAGE_PACKAGE_BUDGETS[normalizedStage];
  const forcedPackage = firstDefined(trainingOverrides.wavePackageId, trainingOverrides.packageId);
  const forcedEnemyId = firstDefined(trainingOverrides.enemyId, trainingOverrides.enemyType);
  const cleanseCandidates = candidates.filter((entry) => containsThreat(entry, "cleanse"));
  const requireCleanse = !forcedEnemyId
    && normalizedStage >= 4
    && mutator === "mutator_cleanse"
    && cleanseCandidates.length > 0;
  const selectedPackages = [];
  if (forcedEnemyId) {
    const trainingPackage = normalizePackage({
      id: `training_${forcedEnemyId}`,
      threats: [forcedEnemyId],
      budgetCost: Math.min(packageBudget, 10),
      groups: [{
        enemyId: forcedEnemyId,
        count: trainingOverrides.enemyCount ?? 10,
        interval: 0.5,
        alternatePaths: true,
        elitePrefix: trainingOverrides.elitePrefix ?? null,
      }],
    });
    for (let index = 0; index < waveCount; index += 1) selectedPackages.push(normalizePackage(trainingPackage));
  } else {
    const forcedEntry = forcedPackage ? candidates.find((entry) => entry.id === forcedPackage) : null;
    if (forcedEntry) {
      for (let index = 0; index < waveCount; index += 1) selectedPackages.push(normalizePackage(forcedEntry));
      if (requireCleanse && !selectedPackages.some((entry) => containsThreat(entry, "cleanse"))) {
        selectedPackages[selectedPackages.length - 1] = normalizePackage(cleanseCandidates[0]);
      }
    } else {
      const selected = selectPackageSequence({
        candidates,
        count: waveCount,
        budget: packageBudget,
        stageNumber: normalizedStage,
        requireCleanse,
        rng: rng.fork("package-sequence"),
      });
      selectedPackages.push(...(selected ?? [normalizePackage(FALLBACK_PACKAGES[0])]).map(normalizePackage));
    }
  }

  const highWeightTags = unique([...(trainingOverrides.highWeightTags ?? []), ...(trainingOverrides.threats ?? [])]);
  if (!forcedEnemyId && highWeightTags.length > 0) {
    const highWeightIds = highWeightTags.map(enemyIdFor).filter((id) => CONTENT_MAPS.enemies.has(id));
    selectedPackages.forEach((entry, packageIndex) => {
      entry.threats = unique([...entry.threats, ...highWeightTags]);
      entry.groups = entry.groups.map((group, groupIndex) => ({
        ...group,
        enemyId: highWeightIds[(packageIndex + groupIndex) % highWeightIds.length] ?? group.enemyId,
        enemyPool: [],
      }));
    });
  }
  const waves = [];
  let waveStart = 1.5;
  selectedPackages.forEach((packageEntry, index) => {
    const wave = buildWave(packageEntry, index, waveStart, elementProfile, rng.fork(`wave:${index}`), mutator);
    waves.push(wave);
    waveStart = wave.endsSpawningAt + 8;
  });
  const forcedBoss = trainingOverrides.bossId;
  if (normalizedStage === 3 || normalizedStage === 6 || forcedBoss) {
    addBossWave(waves, normalizedStage, elementProfile, forcedBoss, trainingOverrides.enemyElement);
  }
  if (trainingOverrides.bossOnly) {
    let bossWave = [...waves].reverse().find((wave) => wave.spawns.some((spawn) => spawn.isBoss));
    if (!bossWave) {
      const bossWaves = [];
      addBossWave(bossWaves, normalizedStage, elementProfile, forcedBoss, trainingOverrides.enemyElement);
      [bossWave] = bossWaves;
    }
    waves.splice(0, waves.length, bossWave);
  }

  const requestedBossPhaseRatio = Number(trainingOverrides.bossPhaseRatio);
  if (Number.isFinite(requestedBossPhaseRatio)) {
    const initialHpRatio = Math.min(1, Math.max(0.01, requestedBossPhaseRatio));
    for (const spawn of waves.flatMap((wave) => wave.spawns)) {
      if (spawn.isBoss || spawn.bossId) spawn.initialHpRatio = initialHpRatio;
    }
  }

  if (trainingOverrides.elitePrefix || trainingOverrides.statusId) {
    for (const spawn of waves.flatMap((wave) => wave.spawns)) {
      if (trainingOverrides.elitePrefix) spawn.elitePrefix = normalizeElitePrefix(trainingOverrides.elitePrefix);
      if (trainingOverrides.statusId) {
        spawn.initialStatuses = [{
          id: trainingOverrides.statusId,
          stacks: Math.max(1, Number(trainingOverrides.statusStacks) || 1),
          duration: Math.max(0.1, Number(trainingOverrides.statusDuration) || 30),
        }];
      }
    }
  }

  const threats = unique([
    ...waves.flatMap((wave) => wave.threats),
    ...(Array.isArray(trainingOverrides.threats) ? trainingOverrides.threats : []),
  ]);
  const spawnSpecs = waves.flatMap((wave) => wave.spawns).sort((left, right) => left.spawnAt - right.spawnAt || left.id.localeCompare(right.id));
  const isAerialSpawn = (spawn) => {
    const enemy = CONTENT_MAPS.enemies.get(spawn.enemyId);
    return spawn.enemyId === "aerial" || tagsFrom(enemy).includes("aerial") || tagsFrom(enemy).includes("air");
  };
  const incompatibleTags = unique(waves.flatMap((wave) => wave.incompatibleTags ?? []));
  if (!trainingOverrides.elitePrefix && incompatibleTags.includes("multiple_regeneration_elites")) {
    const regenerationElites = spawnSpecs.filter((spawn) => normalizeElitePrefix(spawn.elitePrefix) === "regeneration");
    regenerationElites.slice(1).forEach((spawn, index) => {
      spawn.elitePrefix = rng.fork(`incompatibility:regeneration:${index}`).pick(
        ELITE_PREFIX_POOL.filter((prefix) => prefix !== "regeneration"),
      );
    });
  }
  if (!forcedEnemyId && incompatibleTags.includes("air_only_stage")) {
    const nonBossSpawns = spawnSpecs.filter((spawn) => !spawn.isBoss);
    if (nonBossSpawns.length > 0 && nonBossSpawns.every(isAerialSpawn)) {
      nonBossSpawns[nonBossSpawns.length - 1].enemyId = "normal";
    }
  }
  const hpBudget = (spawn) => Number(CONTENT_MAPS.enemies.get(spawn.enemyId)?.hpMul) || 1;
  const requestedAerialRatio = Number(trainingOverrides.aerialHpBudgetRatio);
  const aerialCap = Number.isFinite(requestedAerialRatio)
    ? Math.max(0, Math.min(0.6, requestedAerialRatio))
    : mutator === "mutator_aerial" ? 0.6 : 0.45;
  if (!forcedEnemyId && Number.isFinite(requestedAerialRatio) && requestedAerialRatio > 0) {
    for (const spawn of spawnSpecs) {
      if (isAerialSpawn(spawn) || spawn.isBoss) continue;
      const currentAerial = spawnSpecs.filter(isAerialSpawn).reduce((sum, entry) => sum + hpBudget(entry), 0);
      const currentTotal = spawnSpecs.reduce((sum, entry) => sum + hpBudget(entry), 0);
      if (currentTotal > 0 && currentAerial / currentTotal >= aerialCap - 0.02) break;
      spawn.enemyId = "aerial";
    }
  }
  let totalHpBudget = spawnSpecs.reduce((sum, spawn) => sum + hpBudget(spawn), 0);
  let aerialHpBudget = spawnSpecs.filter(isAerialSpawn).reduce((sum, spawn) => sum + hpBudget(spawn), 0);
  for (const spawn of forcedEnemyId ? [] : [...spawnSpecs].reverse()) {
    if (totalHpBudget <= 0 || aerialHpBudget / totalHpBudget <= aerialCap + 1e-8) break;
    if (!isAerialSpawn(spawn)) continue;
    const previousBudget = hpBudget(spawn);
    spawn.enemyId = "normal";
    const nextBudget = hpBudget(spawn);
    aerialHpBudget -= previousBudget;
    totalHpBudget += nextBudget - previousBudget;
  }
  const packageBudgetUsed = waves.reduce((sum, wave) => sum + Math.max(0, Number(wave.budgetCost) || 0), 0);

  return {
    id: `stage_${normalizedStage}_${nodeVariant}_${layout.id}`,
    stageNumber: normalizedStage,
    seed: normalizedSeed,
    difficultyId: normalizedDifficulty,
    nodeVariant: Number(nodeVariant) || 0,
    cols: GRID.cols,
    rows: GRID.rows,
    grid: { ...GRID },
    layoutId: layout.id,
    layout,
    core: { ...layout.core },
    paths: layout.paths,
    obstacles: layout.obstacles,
    leaderNodes: layout.leaderNodes,
    specialTiles: layout.specialTiles,
    elementProfile,
    threats,
    mutator,
    packageBudget,
    packageBudgetUsed,
    packageBudgetRemaining: Math.max(0, packageBudget - packageBudgetUsed),
    packageBudgetExceeded: packageBudgetUsed > packageBudget,
    incompatibleTags,
    scoreMultiplier: mutator === "mutator_split" ? 1.15 : 1,
    waves,
    spawnSpecs,
    totalEnemies: spawnSpecs.length,
    aerialRatio: totalHpBudget > 0 ? aerialHpBudget / totalHpBudget : 0,
    maxActiveEnemies: 65,
    preview: {
      threats,
      elementWeights: { ...elementProfile.weights },
      mutator,
      packageBudget,
      packageBudgetUsed,
      bossId: spawnSpecs.find((spawn) => spawn.isBoss)?.bossId ?? null,
    },
  };
}

export default StageBuilder;

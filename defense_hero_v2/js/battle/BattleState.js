import { SeededRng } from '../core/SeededRng.js';
import { BATTLE_PHASE } from '../core/enums.js';
import { HERO_BY_ID } from '../content/heroes.js';
import { STAGE_BY_ID } from '../content/stages.js';
import { DIFFICULTY_BY_ID } from '../content/combat.js';
import { EntityRegistry } from './EntityRegistry.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

export function validateFormation(formation) {
  if (!formation || typeof formation !== 'object') throw new TypeError('Formation is required');
  const main = HERO_BY_ID[formation.mainId];
  if (!main || main.position !== 'main') throw new RangeError('Formation needs one valid main hero');
  if (!Array.isArray(formation.heroIds) || formation.heroIds.length !== 4) {
    throw new RangeError('Formation needs exactly four normal heroes');
  }
  const ids = [formation.mainId, ...formation.heroIds];
  if (new Set(ids).size !== 5) throw new RangeError('Formation heroes must be unique');
  for (const id of formation.heroIds) {
    if (HERO_BY_ID[id]?.position !== 'normal') throw new RangeError(`Invalid normal hero: ${id}`);
  }
  return Object.freeze({ mainId: formation.mainId, heroIds: Object.freeze([...formation.heroIds]) });
}

function createRuntimeHero(id, slot, checkpoint) {
  const definition = HERO_BY_ID[id];
  const placement = checkpoint?.placements?.[id];
  return {
    id,
    slot,
    definition,
    level: checkpoint?.levels?.[id] ?? 1,
    selectedTraits: clone(checkpoint?.traits?.[id] ?? { lv4: null, lv6: null }),
    x: placement?.x ?? null,
    y: placement?.y ?? null,
    placed: Boolean(placement),
    direction: 'front',
    attackTimer: 0,
    skillTimer: 0,
    lastTargetId: null,
    buffs: new Map(),
    stats: { damage: 0, kills: 0, basicAttacks: 0, skills: 0 },
  };
}

export function createBattleState({
  stageId,
  difficultyId = 'easy',
  formation,
  seed = `${stageId}:easy:v2`,
  checkpoint = null,
} = {}) {
  const stage = STAGE_BY_ID[stageId];
  if (!stage) throw new RangeError(`Unknown stage: ${stageId}`);
  const difficulty = DIFFICULTY_BY_ID[difficultyId];
  if (!difficulty || !difficulty.selectable) throw new RangeError(`Difficulty is not available: ${difficultyId}`);
  const normalizedFormation = validateFormation(formation);
  const ids = [normalizedFormation.mainId, ...normalizedFormation.heroIds];
  const rng = checkpoint?.rngSnapshot ? SeededRng.restore(checkpoint.rngSnapshot) : new SeededRng(seed);
  const heroes = ids.map((id, slot) => createRuntimeHero(id, slot, checkpoint));
  const registry = new EntityRegistry();
  for (const hero of heroes) registry.add('allies', hero);

  const runtimeStage = {
    ...stage,
    theme: stage.id === 'chaos_rift' ? 'chaos' : 'ruins',
    path: stage.map.pathCells,
    obstacles: stage.map.obstacles,
    placementCells: stage.map.placementCells ?? [],
    recommendedPlacements: stage.map.recommendedPlacements,
  };
  return {
    sessionId: checkpoint?.sessionId ?? `${Date.now().toString(36)}-${seed}`,
    stageId,
    stage: runtimeStage,
    difficultyId,
    difficulty,
    formation: normalizedFormation,
    seed,
    rng,
    tick: 0,
    elapsedSeconds: 0,
    phase: checkpoint && heroes.every((hero) => hero.placed) && checkpoint.nextWave > 1
      ? BATTLE_PHASE.INTERMISSION
      : BATTLE_PHASE.PREPARATION,
    speed: 1,
    paused: false,
    core: {
      maxDurability: 10,
      durability: checkpoint?.coreDurability ?? 10,
    },
    crystals: checkpoint?.crystals ?? 0,
    nextWave: checkpoint?.nextWave ?? 1,
    heroes,
    registry,
    enemies: registry.enemies,
    wave: {
      number: 0,
      spawnQueue: [],
      spawnIndex: 0,
      spawnTimer: 0,
      spawnSerial: 0,
      currentCoreDamaged: false,
      previousCoreDamaged: Boolean(checkpoint?.nextWaveFlags?.coreDamagedPreviousWave),
      completedCount: checkpoint ? Math.max(0, checkpoint.nextWave - 1) : 0,
    },
    nextWaveFlags: clone(checkpoint?.nextWaveFlags ?? {}),
    events: [],
    metrics: { updateSamples: [], renderSamples: [] },
    result: null,
  };
}

export function createCheckpointFromState(state) {
  const placements = {};
  const levels = {};
  const traits = {};
  for (const hero of state.heroes) {
    if (hero.placed) placements[hero.id] = { x: hero.x, y: hero.y };
    levels[hero.id] = hero.level;
    traits[hero.id] = clone(hero.selectedTraits);
  }
  return {
    schemaVersion: 1,
    sessionId: state.sessionId,
    stageId: state.stageId,
    difficultyId: state.difficultyId,
    formation: clone(state.formation),
    placements,
    nextWave: state.nextWave,
    coreDurability: state.core.durability,
    crystals: state.crystals,
    levels,
    traits,
    rngSnapshot: state.rng.snapshot(),
    nextWaveFlags: {
      ...clone(state.nextWaveFlags),
      coreDamagedPreviousWave: state.wave.previousCoreDamaged,
    },
  };
}

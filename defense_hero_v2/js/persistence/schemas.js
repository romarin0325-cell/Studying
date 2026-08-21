import { HERO_BY_ID } from '../content/heroes.js';
import { STAGE_BY_ID } from '../content/stages.js';

export const CHECKPOINT_SCHEMA_VERSION = 1;

export const SAVE_KEYS_V2 = Object.freeze({
  checkpoint: 'heroDefenseV2Checkpoint',
  checkpointBackup: 'heroDefenseV2Checkpoint_backup',
  settings: 'heroDefenseV2Settings',
  legacyMigration: 'heroDefenseV2Settings_migrated',
});

export const DEFAULT_SETTINGS = Object.freeze({
  sound: true,
  damageNumbers: true,
  screenShake: true,
  reducedEffects: false,
});

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function assert(condition, message) {
  if (!condition) throw new TypeError(message);
}

export function normalizeSettings(value = {}) {
  const source = isRecord(value) ? value : {};
  return Object.freeze(Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [
    key,
    typeof source[key] === 'boolean' ? source[key] : fallback,
  ])));
}

export function validateCheckpoint(value) {
  assert(isRecord(value), 'V2 checkpoint must be an object');
  assert(value.schemaVersion === CHECKPOINT_SCHEMA_VERSION, 'Unsupported V2 checkpoint schema');
  assert(typeof value.sessionId === 'string' && value.sessionId.length > 0, 'Checkpoint sessionId is required');
  assert(typeof value.stageId === 'string' && value.stageId.length > 0, 'Checkpoint stageId is required');
  const stage = STAGE_BY_ID[value.stageId];
  assert(Boolean(stage), 'Checkpoint stageId is unknown');
  assert(value.difficultyId === 'easy', 'Only easy checkpoints are supported');
  assert(isRecord(value.formation), 'Checkpoint formation is required');
  assert(typeof value.formation.mainId === 'string' && value.formation.mainId.length > 0, 'Checkpoint main hero is required');
  assert(Array.isArray(value.formation.heroIds) && value.formation.heroIds.length === 4, 'Checkpoint needs four normal heroes');
  assert(value.formation.heroIds.every((id) => typeof id === 'string' && id.length > 0), 'Checkpoint normal hero ids are invalid');
  const formationIds = [value.formation.mainId, ...value.formation.heroIds];
  assert(new Set(formationIds).size === 5, 'Checkpoint formation must be unique');
  assert(HERO_BY_ID[value.formation.mainId]?.position === 'main', 'Checkpoint main hero is invalid');
  assert(
    value.formation.heroIds.every((id) => HERO_BY_ID[id]?.position === 'normal'),
    'Checkpoint normal hero selection is invalid',
  );
  assert(isRecord(value.placements), 'Checkpoint placements must be an object');
  assert(Object.keys(value.placements).length === 5, 'Checkpoint must place all five heroes');
  assert(formationIds.every((id) => Object.hasOwn(value.placements, id)), 'Checkpoint placements must match formation');
  const occupiedCells = new Set();
  const blockedCells = new Set([
    ...stage.map.pathCells.map(({ x, y }) => `${x},${y}`),
    ...stage.map.obstacles.map(({ x, y }) => `${x},${y}`),
  ]);
  // 화이트리스트가 있으면, 화이트리스트 밖의 모든 셀을 blocked로 처리한다.
  if (stage.map.placementCells?.length) {
    const allowed = new Set(stage.map.placementCells.map(({ x, y }) => `${x},${y}`));
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 12; x += 1) {
        const key = `${x},${y}`;
        if (!allowed.has(key)) blockedCells.add(key);
      }
    }
  }
  for (const [heroId, placement] of Object.entries(value.placements)) {
    assert(typeof heroId === 'string' && heroId, 'Checkpoint placement hero id is invalid');
    assert(isRecord(placement), 'Checkpoint placement must be an object');
    assert(Number.isInteger(placement.x) && placement.x >= 0 && placement.x < 12, 'Checkpoint placement x is invalid');
    assert(Number.isInteger(placement.y) && placement.y >= 0 && placement.y < 16, 'Checkpoint placement y is invalid');
    const cell = `${placement.x},${placement.y}`;
    assert(!occupiedCells.has(cell), 'Checkpoint hero placements must be unique');
    assert(!blockedCells.has(cell), 'Checkpoint hero placement is blocked');
    occupiedCells.add(cell);
  }
  assert(Number.isInteger(value.nextWave) && value.nextWave >= 1 && value.nextWave <= 10, 'Checkpoint nextWave is invalid');
  assert(Number.isFinite(value.coreDurability) && value.coreDurability > 0 && value.coreDurability <= 10, 'Checkpoint core durability is invalid');
  assert(Number.isInteger(value.crystals) && value.crystals >= 0 && value.crystals <= 15, 'Checkpoint crystals are invalid');
  assert(isRecord(value.levels), 'Checkpoint levels must be an object');
  assert(Object.keys(value.levels).length === 5 && formationIds.every((id) => Object.hasOwn(value.levels, id)), 'Checkpoint levels must match formation');
  for (const level of Object.values(value.levels)) {
    assert(Number.isInteger(level) && level >= 1 && level <= 6, 'Checkpoint hero level is invalid');
  }
  assert(isRecord(value.traits), 'Checkpoint traits must be an object');
  assert(Object.keys(value.traits).length === 5 && formationIds.every((id) => Object.hasOwn(value.traits, id)), 'Checkpoint traits must match formation');
  for (const heroId of formationIds) {
    const selected = value.traits[heroId];
    const hero = HERO_BY_ID[heroId];
    const heroLevel = value.levels[heroId];
    assert(isRecord(selected), 'Checkpoint selected traits must be objects');
    assert(
      Object.keys(selected).every((key) => key === 'lv4' || key === 'lv6'),
      'Checkpoint selected trait keys are invalid',
    );
    for (const traitLevel of [4, 6]) {
      const key = `lv${traitLevel}`;
      const traitId = selected[key] ?? null;
      assert(traitId === null || typeof traitId === 'string', 'Checkpoint selected trait id is invalid');
      if (heroLevel >= traitLevel) {
        assert(
          hero.traits.some((trait) => trait.level === traitLevel && trait.id === traitId),
          `Checkpoint ${key} trait is invalid for ${heroId}`,
        );
      } else {
        assert(traitId === null, `Checkpoint ${key} trait is unavailable for ${heroId}`);
      }
    }
  }
  assert(isRecord(value.rngSnapshot), 'Checkpoint RNG snapshot is required');
  assert(value.rngSnapshot.version === 1 && value.rngSnapshot.algorithm === 'sfc32-v1', 'Checkpoint RNG snapshot version is invalid');
  assert(typeof value.rngSnapshot.seed === 'string', 'Checkpoint RNG seed is invalid');
  assert(
    Array.isArray(value.rngSnapshot.state)
      && value.rngSnapshot.state.length === 4
      && value.rngSnapshot.state.every((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 0xffff_ffff),
    'Checkpoint RNG state is invalid',
  );
  assert(isRecord(value.nextWaveFlags), 'Checkpoint next-wave flags are required');
  if (Object.hasOwn(value.nextWaveFlags, 'coreDamagedPreviousWave')) {
    assert(typeof value.nextWaveFlags.coreDamagedPreviousWave === 'boolean', 'Checkpoint core damage flag is invalid');
  }
  return value;
}

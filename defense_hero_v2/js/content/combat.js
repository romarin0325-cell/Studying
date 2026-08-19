export function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

export const ELEMENT_IDS = deepFreeze(['fire', 'water', 'nature', 'light', 'dark']);
export const ROLE_IDS = deepFreeze(['dealer', 'balancer', 'buffer', 'debuffer']);
export const POSITION_IDS = deepFreeze(['main', 'normal']);
export const ATTACK_ARCHETYPE_IDS = deepFreeze(['melee', 'burst', 'rapid', 'shotgun', 'area', 'nova', 'laser']);
export const SKILL_SHAPE_IDS = deepFreeze(['single', 'area', 'melee']);

export const ATTACK_TYPE_IDS = deepFreeze([
  'normal',
  'anti_air',
  'lethal',
  'magic',
  'flame',
  'holy',
]);

export const DEFENSE_TYPE_IDS = deepFreeze([
  'normal',
  'air',
  'heavy',
  'regeneration',
  'demon',
  'boss',
]);

export const ATTACK_FAMILIES = deepFreeze({
  physical: ['normal', 'anti_air', 'lethal'],
  magical: ['magic', 'flame', 'holy'],
});

export const ATTACK_TYPE_FAMILY = deepFreeze(Object.fromEntries(
  Object.entries(ATTACK_FAMILIES).flatMap(([family, ids]) => ids.map((id) => [id, family])),
));

export const MATCHUP_MULTIPLIERS = deepFreeze({
  normal: {
    normal: 1,
    anti_air: 1,
    lethal: 1,
    magic: 1,
    flame: 1,
    holy: 1,
  },
  air: {
    normal: 0.75,
    anti_air: 2,
    lethal: 0.5,
    magic: 0.5,
    flame: 0.5,
    holy: 0.5,
  },
  heavy: {
    normal: 1,
    anti_air: 0.75,
    lethal: 1,
    magic: 2,
    flame: 1,
    holy: 1,
  },
  regeneration: {
    normal: 1,
    anti_air: 1,
    lethal: 1,
    magic: 1,
    flame: 2,
    holy: 1,
  },
  demon: {
    normal: 1,
    anti_air: 1,
    lethal: 1,
    magic: 1,
    flame: 0.75,
    holy: 2,
  },
  boss: {
    normal: 1,
    anti_air: 0.75,
    lethal: 2,
    magic: 0.75,
    flame: 0.75,
    holy: 0.75,
  },
});

export function getMatchupMultiplier(attackType, defenseType) {
  return MATCHUP_MULTIPLIERS[defenseType]?.[attackType] ?? null;
}

export const CRITICAL_RULES = deepFreeze({
  baseChance: 0.10,
  baseDamageMultiplier: 1.50,
  chanceMinimum: 0,
  chanceMaximum: 1,
  poisonCanCrit: false,
  shotgunRollScope: 'pellet',
  areaRollScope: 'target',
});

export const DPS_TIERS = deepFreeze([4, 6, 8, 10, 12, 14, 16, 18]);
export const ROLE_DPS_TIER_OFFSETS = deepFreeze({
  dealer: 0,
  balancer: -1,
  buffer: -2,
  debuffer: -2,
  mainBonus: 1,
});

export const ATTACK_ARCHETYPE_DEFINITIONS = deepFreeze([
  {
    id: 'melee',
    displayName: '근접형',
    range: 2,
    intervalSeconds: 1,
    baseDamage: 16,
    standardDps: 16,
    hitEffectPreset: 'basic_melee_hit',
  },
  {
    id: 'burst',
    displayName: '한방형',
    range: 6,
    intervalSeconds: 3,
    baseDamage: 42,
    standardDps: 14,
    hitEffectPreset: 'basic_ranged_hit',
  },
  {
    id: 'rapid',
    displayName: '연사형',
    range: 4,
    intervalSeconds: 0.5,
    baseDamage: 6,
    standardDps: 12,
    hitEffectPreset: 'basic_ranged_hit',
  },
  {
    id: 'shotgun',
    displayName: '샷건형',
    range: 4,
    intervalSeconds: 2,
    pelletDamage: 10,
    pelletCount: 3,
    standardDpsTier: 16,
    spreadDegrees: [-12, 0, 12],
    normalCollisionRadius: 0.30,
    bossCollisionRadius: 0.45,
    hitEffectPreset: 'basic_shotgun_hit',
  },
  {
    id: 'area',
    displayName: '범위형',
    range: 5,
    intervalSeconds: 2,
    baseDamage: 20,
    standardDps: 10,
    radius: 2,
    hitEffectPreset: 'basic_area_hit',
  },
  {
    id: 'nova',
    displayName: '노바형',
    range: 4,
    intervalSeconds: 2.5,
    baseDamage: 20,
    standardDps: 8,
    radius: 2.5,
    hitEffectPreset: 'basic_nova_hit',
  },
  {
    id: 'laser',
    displayName: '레이저형',
    range: 8,
    intervalSeconds: 3,
    baseDamage: 24,
    standardDps: 8,
    normalCollisionRadius: 0.45,
    bossCollisionRadius: 0.6,
    hitEffectPreset: 'basic_laser_hit',
  },
]);

export const ATTACK_ARCHETYPE_BY_ID = deepFreeze(Object.fromEntries(
  ATTACK_ARCHETYPE_DEFINITIONS.map((definition) => [definition.id, definition]),
));
export const ATTACK_ARCHETYPES = ATTACK_ARCHETYPE_DEFINITIONS;

export const SKILL_BASE_DAMAGE_BY_ROLE = deepFreeze({
  5: { buffer: 30, debuffer: 30, balancer: 40, dealer: 50 },
  7: { buffer: 42, debuffer: 42, balancer: 56, dealer: 70 },
  9: { buffer: 54, debuffer: 54, balancer: 72, dealer: 90 },
});

export const SKILL_SHAPE_MULTIPLIERS = deepFreeze({ single: 1, area: 0.75, melee: 1.3 });
export const SKILL_AREA_RADIUS = 3;

export const LEVEL_DAMAGE_MULTIPLIERS = deepFreeze({
  1: 1.00,
  2: 1.10,
  3: 1.20,
  4: 1.30,
  5: 1.40,
  6: 1.50,
});

export const HERO_LEVEL_RULES = deepFreeze({
  startingLevel: 1,
  maximumLevel: 6,
  crystalCostPerLevel: 1,
  traitChoiceLevels: [4, 6],
  damageMultipliers: LEVEL_DAMAGE_MULTIPLIERS,
});

export const WAVE_HP_MULTIPLIERS = deepFreeze({
  1: 0.65,
  2: 0.75,
  3: 0.85,
  4: 1.00,
  5: 1.00,
  6: 1.05,
  7: 1.15,
  8: 1.25,
  9: 1.40,
  10: 1.00,
});

export const DREAM_CRYSTAL_REWARDS = deepFreeze([1, 1, 1, 1, 3, 2, 2, 2, 2, 0]);
export const TOTAL_DREAM_CRYSTALS = DREAM_CRYSTAL_REWARDS.reduce((sum, value) => sum + value, 0);

export const DIFFICULTY_DEFINITIONS = deepFreeze([
  {
    id: 'easy',
    displayName: '이지',
    hpMultiplier: 0.85,
    speedMultiplier: 0.95,
    spawnIntervalMultiplier: 1.10,
    bossHpMultiplier: 1,
    implemented: true,
    selectable: true,
  },
  {
    id: 'normal',
    displayName: '노멀',
    hpMultiplier: 1,
    speedMultiplier: 1,
    spawnIntervalMultiplier: 1,
    bossHpMultiplier: 1,
    implemented: false,
    selectable: false,
  },
  {
    id: 'hard',
    displayName: '하드',
    hpMultiplier: 1.30,
    speedMultiplier: 1.08,
    spawnIntervalMultiplier: 0.90,
    bossHpMultiplier: 1.10,
    implemented: false,
    selectable: false,
  },
]);

export const DIFFICULTY_BY_ID = deepFreeze(Object.fromEntries(
  DIFFICULTY_DEFINITIONS.map((definition) => [definition.id, definition]),
));
export const MATCHUP_TABLE = MATCHUP_MULTIPLIERS;
export const WAVE_REWARDS = DREAM_CRYSTAL_REWARDS;
export const DIFFICULTIES = DIFFICULTY_DEFINITIONS;

export const BOARD_RULES = deepFreeze({
  columns: 12,
  rows: 16,
  minimumX: 0,
  maximumX: 11,
  minimumY: 0,
  maximumY: 15,
  pathMovement: 'orthogonal',
  allowRepeatedPathCells: false,
  landscapeRotation: 'clockwise_90',
});

export const CORE_RULES = deepFreeze({
  maximumDurability: 10,
  enemyReachDamage: 1,
  bossReachDamage: 1,
  worldShieldDamageMultiplier: 0.5,
  defeatAtOrBelow: 0,
});

export const WAVE_RULES = deepFreeze({
  wavesPerStage: 10,
  normalEnemyCount: 30,
  bossEnemyCount: 1,
  midBossWave: 5,
  finalBossWave: 10,
  baseSpawnIntervalSeconds: 0.72,
  rewards: DREAM_CRYSTAL_REWARDS,
  hpMultipliers: WAVE_HP_MULTIPLIERS,
});

export const TARGETING_RULES = deepFreeze({
  order: ['pathProgressDescending', 'spawnOrderAscending', 'entityIdAscending'],
  hiddenBossPriority: false,
  rangeDistance: 'euclidean',
});

export const DAMAGE_FORMULA_ORDER = deepFreeze([
  'baseDamage',
  'levelMultiplier',
  'attackTypeMatchup',
  'additiveDamageBuffs',
  'additiveReceivedDamageDebuffs',
  'independentTraitMultipliers',
  'criticalMultiplier',
]);

export const BATTLE_TICK_ORDER = deepFreeze([
  'commands',
  'waveSpawn',
  'statuses',
  'movementAndBossDirection',
  'coreReach',
  'auras',
  'targeting',
  'skills',
  'basicAttacks',
  'sortActions',
  'resolveActions',
  'cleanup',
  'waveCompletion',
  'snapshot',
]);

export const PERFORMANCE_LIMITS = deepFreeze({
  targetFps: 60,
  minimumFps: 30,
  updateP95Milliseconds: 4,
  renderP95Milliseconds: 8,
  activeEnemies: 45,
  particles: 250,
  damagePopups: 40,
  maximumDpr: 2,
});

export const COMBAT_RULES = deepFreeze({
  elements: ELEMENT_IDS,
  roles: ROLE_IDS,
  positions: POSITION_IDS,
  attackTypes: ATTACK_TYPE_IDS,
  defenseTypes: DEFENSE_TYPE_IDS,
  attackFamilies: ATTACK_FAMILIES,
  matchups: MATCHUP_MULTIPLIERS,
  critical: CRITICAL_RULES,
  levels: HERO_LEVEL_RULES,
  board: BOARD_RULES,
  core: CORE_RULES,
  waves: WAVE_RULES,
  targeting: TARGETING_RULES,
  damageFormulaOrder: DAMAGE_FORMULA_ORDER,
  tickOrder: BATTLE_TICK_ORDER,
  performance: PERFORMANCE_LIMITS,
});

export default COMBAT_RULES;

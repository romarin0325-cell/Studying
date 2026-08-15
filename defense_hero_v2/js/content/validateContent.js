import {
  ATTACK_ARCHETYPE_IDS,
  ATTACK_TYPE_IDS,
  BOARD_RULES,
  DEFENSE_TYPE_IDS,
  DIFFICULTIES,
  DREAM_CRYSTAL_REWARDS,
  ELEMENT_IDS,
  LEVEL_DAMAGE_MULTIPLIERS,
  MATCHUP_TABLE,
  POSITION_IDS,
  ROLE_IDS,
  SKILL_SHAPE_IDS,
  TOTAL_DREAM_CRYSTALS,
  WAVE_HP_MULTIPLIERS,
  WAVE_RULES,
  deepFreeze,
} from './combat.js';
import { AURA_RANGE_TIERS, BUFF_EFFECT_TYPE_IDS, BUFFS } from './buffs.js';
import { DEBUFF_DEFINITIONS, STATUSES } from './statuses.js';
import {
  CONDITION_TYPE_IDS,
  EFFECT_PRESETS,
  OPERATION_TYPE_IDS,
} from './effects.js';
import {
  DEFAULT_FORMATION,
  HEROES,
  MAIN_HEROES,
  NORMAL_HEROES,
} from './heroes.js';
import { BOSSES, ENEMIES, NORMAL_ENEMIES } from './enemies.js';
import { STAGES, expandOrthogonalPath } from './stages.js';

const EXPECTED_HERO_IDS = [
  'rumi', 'luna', 'cinderella', 'zeke',
  'snow_rabbit', 'avalanche_maid', 'night_rabbit', 'guardian', 'storm_sage', 'lightning_sage',
];
const EXPECTED_ENEMY_IDS = [
  'ruin_scarab', 'ember_scarab', 'sand_wisp', 'stone_guard', 'regrowth_idol', 'flora', 'pharaoh',
  'rift_shade', 'rift_wing', 'abyss_armor', 'chaos_spawn', 'lesser_demon', 'reaper', 'demon_god',
];
const EXPECTED_STAGE_IDS = ['ancient_ruins', 'chaos_rift'];
const EXPECTED_BUFF_IDS = [
  'moon_bless', 'sun_bless', 'earth_bless', 'twinkle_party', 'sanctuary', 'star_powder', 'gale',
];
const EXPECTED_STATUS_IDS = ['slow', 'stun', 'corrosion', 'curse', 'darkness', 'poison', 'stun_immunity'];
const EXPECTED_EFFECT_PRESET_IDS = [
  'basic_melee_hit', 'basic_ranged_hit', 'basic_shotgun_hit', 'basic_area_hit',
  'skill_single_hit', 'skill_area_hit', 'status_apply', 'critical_hit', 'advantage_hit',
];
const EXPECTED_MATCHUPS = {
  normal: [1, 1, 1, 1, 1, 1],
  air: [0.75, 2, 0.5, 0.5, 0.5, 0.5],
  heavy: [1, 0.75, 1, 2, 1, 1],
  regeneration: [1, 1, 1, 1, 2, 1],
  demon: [1, 1, 1, 1, 0.75, 2],
  boss: [1, 0.75, 2, 0.75, 0.75, 0.75],
};

export const CONTENT_COUNTS = deepFreeze({
  heroes: 10,
  mainHeroes: 4,
  normalHeroes: 6,
  level4Traits: 20,
  level6Traits: 20,
  enemies: 14,
  normalEnemies: 10,
  bosses: 4,
  stages: 2,
  waves: 20,
  buffs: 7,
  statuses: 7,
  debuffs: 6,
  effectPresets: 9,
  directionalAssetIds: 66,
});

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isPositiveFinite = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const coordinateKey = (cell) => `${cell.x},${cell.y}`;

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function exactIdSet(definitions, expectedIds, label, errors) {
  const actual = definitions.map((definition) => definition?.id).sort();
  const expected = [...expectedIds].sort();
  if (!sameValues(actual, expected)) {
    errors.push(`${label}: expected ids [${expected.join(', ')}], received [${actual.join(', ')}].`);
  }
}

function uniqueIds(definitions, label, errors) {
  const seen = new Set();
  for (const definition of definitions) {
    const id = typeof definition?.id === 'string' ? definition.id.trim() : '';
    if (!id) {
      errors.push(`${label}: every definition requires a non-empty id.`);
      continue;
    }
    if (seen.has(id)) errors.push(`${label}: duplicate id '${id}'.`);
    seen.add(id);
  }
  return seen;
}

function assertDeepFrozen(value, label, errors, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (!Object.isFrozen(value)) errors.push(`${label}: content data must be Object.freeze'd.`);
  for (const [key, child] of Object.entries(value)) assertDeepFrozen(child, `${label}.${key}`, errors, seen);
}

function rejectFunctions(value, label, errors, seen = new WeakSet()) {
  if (typeof value === 'function') {
    errors.push(`${label}: runtime functions are forbidden in content data.`);
    return;
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) rejectFunctions(child, `${label}.${key}`, errors, seen);
}

function validateCombat(errors) {
  if (ATTACK_TYPE_IDS.length !== 6 || DEFENSE_TYPE_IDS.length !== 6) {
    errors.push('combat: matchup axes must both contain exactly six ids.');
  }
  for (const defenseType of DEFENSE_TYPE_IDS) {
    const row = ATTACK_TYPE_IDS.map((attackType) => MATCHUP_TABLE[defenseType]?.[attackType]);
    if (!sameValues(row, EXPECTED_MATCHUPS[defenseType])) {
      errors.push(`combat.matchups.${defenseType}: does not match the 6x6 specification.`);
    }
  }
  if (Object.keys(MATCHUP_TABLE).length !== 6) errors.push('combat.matchups: expected exactly six defense rows.');
  if (!sameValues(Object.values(LEVEL_DAMAGE_MULTIPLIERS), [1, 1.1, 1.2, 1.3, 1.4, 1.5])) {
    errors.push('combat.levels: Lv1-Lv6 damage multipliers are invalid.');
  }
  if (!sameValues(DREAM_CRYSTAL_REWARDS, [1, 1, 1, 1, 3, 2, 2, 2, 2, 0])) {
    errors.push('combat.crystals: wave rewards are invalid.');
  }
  if (TOTAL_DREAM_CRYSTALS !== 15) errors.push('combat.crystals: a stage must award exactly 15 crystals.');
  if (DIFFICULTIES.length !== 3) errors.push('combat.difficulties: easy/normal/hard are required.');
  const easy = DIFFICULTIES.find(({ id }) => id === 'easy');
  const normal = DIFFICULTIES.find(({ id }) => id === 'normal');
  const hard = DIFFICULTIES.find(({ id }) => id === 'hard');
  if (!easy?.selectable || normal?.selectable || hard?.selectable) {
    errors.push('combat.difficulties: only easy may be selectable in V2.');
  }
  if (BOARD_RULES.columns !== 12 || BOARD_RULES.rows !== 16) errors.push('combat.board: logical board must be 12x16.');
}

function validateBuffs(errors) {
  exactIdSet(BUFFS, EXPECTED_BUFF_IDS, 'buffs', errors);
  uniqueIds(BUFFS, 'buffs', errors);
  for (const buff of BUFFS) {
    if (!Array.isArray(buff.effects) || buff.effects.length === 0) errors.push(`buffs.${buff.id}: effects are required.`);
    for (const effect of buff.effects ?? []) {
      if (!BUFF_EFFECT_TYPE_IDS.includes(effect.type)) errors.push(`buffs.${buff.id}: unknown effect '${effect.type}'.`);
      if (!isPositiveFinite(effect.value)) errors.push(`buffs.${buff.id}.${effect.type}: value must be positive and finite.`);
    }
  }
  if (!sameValues(AURA_RANGE_TIERS, [4, 6, 8, 10])) errors.push('buffs: aura range tiers must be 4/6/8/10.');
}

function validateStatuses(errors) {
  exactIdSet(STATUSES, EXPECTED_STATUS_IDS, 'statuses', errors);
  uniqueIds(STATUSES, 'statuses', errors);
  if (DEBUFF_DEFINITIONS.length !== CONTENT_COUNTS.debuffs) errors.push('statuses: exactly six public debuffs are required.');
  for (const status of STATUSES) {
    if (!isPositiveFinite(status.duration)) errors.push(`statuses.${status.id}: duration must be positive.`);
    if (status.debuff !== (status.kind === 'debuff')) errors.push(`statuses.${status.id}: debuff flag disagrees with kind.`);
    if (!Array.isArray(status.effects) || status.effects.length === 0) errors.push(`statuses.${status.id}: effects are required.`);
  }
  const poison = STATUSES.find(({ id }) => id === 'poison');
  if (poison?.poison_dps !== 3 || poison?.max_stacks !== 3 || poison?.duration !== 10) {
    errors.push('statuses.poison: expected 3 DPS per stack, three stacks, and 10 seconds.');
  }
  const immunity = STATUSES.find(({ id }) => id === 'stun_immunity');
  if (immunity?.debuff !== false || immunity?.duration !== 2) errors.push('statuses.stun_immunity: invalid internal immunity contract.');
}

function validateEffectPresets(errors) {
  exactIdSet(EFFECT_PRESETS, EXPECTED_EFFECT_PRESET_IDS, 'effects', errors);
  uniqueIds(EFFECT_PRESETS, 'effects', errors);
  for (const preset of EFFECT_PRESETS) {
    if (!isPositiveFinite(preset.durationSeconds)) errors.push(`effects.${preset.id}: durationSeconds must be positive.`);
    if (typeof preset.shape !== 'string' || !preset.shape) errors.push(`effects.${preset.id}: shape is required.`);
  }
}

function validateCondition(condition, context, sets, errors) {
  if (!isRecord(condition) || !CONDITION_TYPE_IDS.includes(condition.type)) {
    errors.push(`${context}: invalid condition type '${String(condition?.type)}'.`);
    return;
  }
  if (condition.type === 'target_element' && !sets.elements.has(condition.element)) {
    errors.push(`${context}: unknown element '${String(condition.element)}'.`);
  }
  if (condition.type === 'target_defense_type' && !sets.defenseTypes.has(condition.defenseType)) {
    errors.push(`${context}: unknown defense type '${String(condition.defenseType)}'.`);
  }
  if (condition.type === 'target_has_status' && !sets.statuses.has(condition.statusId)) {
    errors.push(`${context}: unknown status '${String(condition.statusId)}'.`);
  }
  if (condition.type === 'source_has_buff' && !sets.buffs.has(condition.buffId)) {
    errors.push(`${context}: unknown buff '${String(condition.buffId)}'.`);
  }
  if (condition.type === 'attack_kind' && !['basic', 'skill'].includes(condition.attackKind)) {
    errors.push(`${context}: attackKind must be basic or skill.`);
  }
  if (condition.type === 'core_below_ratio' && (!(condition.ratio > 0) || condition.ratio > 1)) {
    errors.push(`${context}: core ratio must be in (0, 1].`);
  }
}

function validateOperation(effect, context, sets, errors) {
  if (!isRecord(effect) || !OPERATION_TYPE_IDS.includes(effect.type)) {
    errors.push(`${context}: invalid operation type '${String(effect?.type)}'.`);
    return;
  }
  if (effect.type === 'apply_status') {
    if (!sets.statuses.has(effect.statusId)) errors.push(`${context}: unknown status '${String(effect.statusId)}'.`);
    if (effect.chance !== undefined && (!(effect.chance >= 0) || effect.chance > 1)) errors.push(`${context}: chance must be in [0, 1].`);
  }
  if (effect.type === 'provide_aura') {
    if (!sets.buffs.has(effect.buffId)) errors.push(`${context}: unknown buff '${String(effect.buffId)}'.`);
    if (!AURA_RANGE_TIERS.includes(effect.range)) errors.push(`${context}: aura range must be a declared tier.`);
  }
  if (effect.type === 'random_damage_multiplier') {
    if (!Array.isArray(effect.choices) || !Array.isArray(effect.weights) || effect.choices.length < 2 || effect.choices.length !== effect.weights.length) {
      errors.push(`${context}: random multiplier choices and weights must have equal length.`);
    } else if (effect.choices.some((value) => !isPositiveFinite(value)) || effect.weights.some((value) => !isPositiveFinite(value))) {
      errors.push(`${context}: random multiplier choices and weights must be positive.`);
    }
  }
  if (['multiply_damage', 'multiply_skill_cooldown', 'floor_matchup_multiplier', 'multiply_core_damage'].includes(effect.type)
    && !isPositiveFinite(effect.value)) {
    errors.push(`${context}: value must be positive and finite.`);
  }
  if (['add_crit_chance', 'add_range', 'add_team_crit_chance'].includes(effect.type)
    && !isPositiveFinite(effect.value)) {
    errors.push(`${context}: value must be positive and finite.`);
  }
  if (effect.type === 'multiply_damage_by_debuff_count' && !isPositiveFinite(effect.amountPerDebuff)) {
    errors.push(`${context}: amountPerDebuff must be positive and finite.`);
  }
}

function validateHeroes(sets, errors) {
  exactIdSet(HEROES, EXPECTED_HERO_IDS, 'heroes', errors);
  uniqueIds(HEROES, 'heroes', errors);
  if (MAIN_HEROES.length !== CONTENT_COUNTS.mainHeroes || NORMAL_HEROES.length !== CONTENT_COUNTS.normalHeroes) {
    errors.push('heroes: expected four main and six normal heroes.');
  }
  const traitIds = new Set();
  let level4Traits = 0;
  let level6Traits = 0;
  for (const hero of HEROES) {
    const context = `heroes.${hero.id}`;
    if (!POSITION_IDS.includes(hero.position) || hero.kind !== hero.position) errors.push(`${context}: invalid position/kind.`);
    if (!sets.elements.has(hero.element)) errors.push(`${context}: unknown element '${hero.element}'.`);
    if (!ROLE_IDS.includes(hero.role)) errors.push(`${context}: unknown role '${hero.role}'.`);
    if (!ATTACK_ARCHETYPE_IDS.includes(hero.attack?.archetype)) errors.push(`${context}: invalid attack archetype.`);
    if (!sets.attackTypes.has(hero.attack?.attackType)) errors.push(`${context}: invalid basic attack type.`);
    if (!isPositiveFinite(hero.attack?.range) || !isPositiveFinite(hero.attack?.interval) || !isPositiveFinite(hero.attack?.damage)) {
      errors.push(`${context}: basic attack range/interval/damage must be positive.`);
    }
    if (!sets.effectPresets.has(hero.attack?.effectPreset)) errors.push(`${context}: unknown basic effect preset.`);
    if (!sets.attackTypes.has(hero.skill?.attackType) || !SKILL_SHAPE_IDS.includes(hero.skill?.shape)) errors.push(`${context}: invalid skill type/shape.`);
    if (![5, 7, 9].includes(hero.skill?.cooldown) || !isPositiveFinite(hero.skill?.damage)) errors.push(`${context}: invalid skill cooldown/damage.`);
    if (hero.skill?.shape === 'area' && hero.skill.radius !== 3) errors.push(`${context}: area skills must have radius 3.`);
    if (hero.skill?.shape === 'single' && hero.skill.radius !== 0) errors.push(`${context}: single skills must have radius 0.`);
    if (!sets.effectPresets.has(hero.skill?.effectPreset)) errors.push(`${context}: unknown skill effect preset.`);
    for (const [index, effect] of (hero.skill?.onHitEffects ?? []).entries()) {
      validateOperation(effect, `${context}.skill.onHitEffects[${index}]`, sets, errors);
    }
    if (!Array.isArray(hero.traits) || hero.traits.length !== 4) errors.push(`${context}: exactly four traits are required.`);
    const byLevel = { 4: 0, 6: 0 };
    for (const [traitIndex, definition] of (hero.traits ?? []).entries()) {
      const traitContext = `${context}.traits[${traitIndex}]`;
      if (traitIds.has(definition.id)) errors.push(`${traitContext}: duplicate trait id '${definition.id}'.`);
      traitIds.add(definition.id);
      if (![4, 6].includes(definition.level)) errors.push(`${traitContext}: trait level must be 4 or 6.`);
      else byLevel[definition.level] += 1;
      if (typeof definition.name !== 'string' || !definition.name) errors.push(`${traitContext}: name is required.`);
      if (!Array.isArray(definition.conditions) || !Array.isArray(definition.effects) || definition.effects.length === 0) {
        errors.push(`${traitContext}: conditions/effects contract is invalid.`);
        continue;
      }
      definition.conditions.forEach((condition, index) => validateCondition(condition, `${traitContext}.conditions[${index}]`, sets, errors));
      definition.effects.forEach((effect, index) => validateOperation(effect, `${traitContext}.effects[${index}]`, sets, errors));
    }
    if (byLevel[4] !== 2 || byLevel[6] !== 2) errors.push(`${context}: each choice level must contain exactly two traits.`);
    level4Traits += byLevel[4];
    level6Traits += byLevel[6];
    const expectedPortrait = `portrait/${hero.id}`;
    if (hero.assetIds?.portrait !== expectedPortrait) errors.push(`${context}: portrait asset id must be '${expectedPortrait}'.`);
    for (const direction of ['front', 'back', 'left', 'right']) {
      const expected = `battle/${hero.id}/${direction}`;
      if (hero.assetIds?.battle?.[direction] !== expected) errors.push(`${context}: directional asset id must be '${expected}'.`);
    }
  }
  if (level4Traits !== CONTENT_COUNTS.level4Traits || level6Traits !== CONTENT_COUNTS.level6Traits) {
    errors.push(`heroes: expected 20 Lv4 and 20 Lv6 traits, received ${level4Traits}/${level6Traits}.`);
  }
  if (!sets.heroes.has(DEFAULT_FORMATION.mainId)
    || DEFAULT_FORMATION.heroIds.length !== 4
    || new Set(DEFAULT_FORMATION.heroIds).size !== 4
    || DEFAULT_FORMATION.heroIds.some((id) => !sets.heroes.has(id))) {
    errors.push('heroes.defaultFormation: invalid default formation.');
  }
}

function validateEnemies(sets, errors) {
  exactIdSet(ENEMIES, EXPECTED_ENEMY_IDS, 'enemies', errors);
  uniqueIds(ENEMIES, 'enemies', errors);
  if (NORMAL_ENEMIES.length !== CONTENT_COUNTS.normalEnemies || BOSSES.length !== CONTENT_COUNTS.bosses) {
    errors.push('enemies: expected ten normal enemies and four bosses.');
  }
  for (const enemy of ENEMIES) {
    const context = `enemies.${enemy.id}`;
    if (!sets.elements.has(enemy.element) || !sets.defenseTypes.has(enemy.defenseType)) errors.push(`${context}: invalid element/defense type.`);
    if (!isPositiveFinite(enemy.baseHp) || enemy.hp !== enemy.baseHp || !isPositiveFinite(enemy.speed) || enemy.coreDamage !== 1) {
      errors.push(`${context}: invalid HP/speed/core damage.`);
    }
    if (enemy.isBoss !== (enemy.defenseType === 'boss')) errors.push(`${context}: boss flag and defense type disagree.`);
    if (enemy.isBoss) {
      for (const direction of ['front', 'back', 'left', 'right']) {
        const expected = `boss/${enemy.id}/${direction}`;
        if (enemy.assetIds?.battle?.[direction] !== expected) errors.push(`${context}: directional asset id must be '${expected}'.`);
      }
    } else if (enemy.assetIds !== undefined || enemy.renderMode !== 'defense_token') {
      errors.push(`${context}: normal enemies must use an asset-free defense token.`);
    }
  }
}

function withinBoard(cell) {
  return Number.isInteger(cell?.x)
    && Number.isInteger(cell?.y)
    && cell.x >= 0
    && cell.x < BOARD_RULES.columns
    && cell.y >= 0
    && cell.y < BOARD_RULES.rows;
}

function validateStageMap(stage, errors) {
  const context = `stages.${stage.id}.map`;
  const map = stage.map;
  if (map?.columns !== 12 || map?.rows !== 16) errors.push(`${context}: board must be 12x16.`);
  let expanded = [];
  try {
    expanded = expandOrthogonalPath(map?.pathWaypoints);
  } catch (error) {
    errors.push(`${context}: ${error.message}`);
    return;
  }
  if (!sameValues(expanded.map(coordinateKey), (map.pathCells ?? []).map(coordinateKey))) {
    errors.push(`${context}: pathCells do not match the expanded waypoints.`);
  }
  const pathKeys = expanded.map(coordinateKey);
  if (new Set(pathKeys).size !== pathKeys.length) errors.push(`${context}: path may not visit a cell twice.`);
  if (pathKeys.some((key, index) => !withinBoard(expanded[index]))) errors.push(`${context}: path leaves the board.`);
  if (coordinateKey(expanded[0]) !== coordinateKey(map.spawn)) errors.push(`${context}: first path cell must be spawn.`);
  if (coordinateKey(expanded.at(-1)) !== coordinateKey(map.core)) errors.push(`${context}: last path cell must be core.`);
  const obstacleKeys = new Set();
  for (const obstacle of map.obstacles ?? []) {
    const key = coordinateKey(obstacle);
    if (!withinBoard(obstacle)) errors.push(`${context}: obstacle ${key} leaves the board.`);
    if (obstacleKeys.has(key)) errors.push(`${context}: duplicate obstacle ${key}.`);
    if (pathKeys.includes(key)) errors.push(`${context}: obstacle ${key} overlaps the path.`);
    obstacleKeys.add(key);
  }
}

function validateStages(sets, errors) {
  exactIdSet(STAGES, EXPECTED_STAGE_IDS, 'stages', errors);
  uniqueIds(STAGES, 'stages', errors);
  for (const stage of STAGES) {
    const context = `stages.${stage.id}`;
    if (!sets.elements.has(stage.representativeElement)) errors.push(`${context}: invalid representative element.`);
    if (stage.featuredDefenseTypes?.length !== 3 || stage.featuredDefenseTypes.some((id) => !sets.defenseTypes.has(id))) {
      errors.push(`${context}: exactly three valid featured defense types are required.`);
    }
    if (!sameValues(stage.availableDifficultyIds, ['easy']) || !sameValues(stage.displayedDifficultyIds, ['easy', 'normal', 'hard'])) {
      errors.push(`${context}: invalid difficulty visibility contract.`);
    }
    if (!sets.enemies.has(stage.midBossId) || !sets.enemies.has(stage.finalBossId)) errors.push(`${context}: boss references are invalid.`);
    validateStageMap(stage, errors);
    if (!Array.isArray(stage.waves) || stage.waves.length !== 10) errors.push(`${context}: exactly ten waves are required.`);
    for (const [index, wave] of (stage.waves ?? []).entries()) {
      const waveNumber = index + 1;
      const waveContext = `${context}.waves[${waveNumber}]`;
      const bossWave = waveNumber === 5 || waveNumber === 10;
      if (wave.number !== waveNumber || wave.kind !== (bossWave ? 'boss' : 'normal')) errors.push(`${waveContext}: invalid number/kind.`);
      const expectedCount = bossWave ? 1 : 30;
      if (wave.enemyCount !== expectedCount || wave.spawnOrder?.length !== expectedCount) errors.push(`${waveContext}: expected ${expectedCount} enemies.`);
      if (wave.hpMultiplier !== WAVE_HP_MULTIPLIERS[waveNumber]) errors.push(`${waveContext}: invalid HP multiplier.`);
      if (wave.dreamCrystalReward !== DREAM_CRYSTAL_REWARDS[waveNumber - 1]) errors.push(`${waveContext}: invalid crystal reward.`);
      if (wave.spawnIntervalSeconds !== WAVE_RULES.baseSpawnIntervalSeconds) errors.push(`${waveContext}: invalid base spawn interval.`);
      const declaredCounts = new Map((wave.groups ?? []).map((group) => [group.enemyId, group.count]));
      const actualCounts = new Map();
      for (const enemyId of wave.spawnOrder ?? []) {
        if (!sets.enemies.has(enemyId)) errors.push(`${waveContext}: unknown enemy '${enemyId}'.`);
        actualCounts.set(enemyId, (actualCounts.get(enemyId) ?? 0) + 1);
      }
      if ([...declaredCounts.values()].reduce((sum, count) => sum + count, 0) !== expectedCount) errors.push(`${waveContext}: group total is invalid.`);
      for (const [enemyId, count] of declaredCounts) {
        if (actualCounts.get(enemyId) !== count) errors.push(`${waveContext}: spawn order count for '${enemyId}' is invalid.`);
      }
      if (actualCounts.size !== declaredCounts.size) errors.push(`${waveContext}: spawn order contains undeclared enemy types.`);
      if (bossWave) {
        const expectedBossId = waveNumber === 5 ? stage.midBossId : stage.finalBossId;
        if (wave.spawnOrder?.[0] !== expectedBossId) errors.push(`${waveContext}: expected boss '${expectedBossId}'.`);
      } else if ((wave.spawnOrder ?? []).some((enemyId) => sets.bosses.has(enemyId))) {
        errors.push(`${waveContext}: normal waves may not contain bosses.`);
      }
    }
  }
}

function expectedAssetIds() {
  const ids = [];
  for (const hero of HEROES) {
    ids.push(hero.assetIds.portrait);
    ids.push(...Object.values(hero.assetIds.battle));
  }
  for (const boss of BOSSES) ids.push(...Object.values(boss.assetIds.battle));
  return ids;
}

function normalizeAssetEntries(assets, errors) {
  if (assets === null || assets === undefined) return null;
  if (Array.isArray(assets)) return assets;
  if (isRecord(assets) && Array.isArray(assets.assets)) return assets.assets;
  if (isRecord(assets) && Array.isArray(assets.entries)) return assets.entries;
  errors.push('assets: optional manifest must be an array or contain an assets/entries array.');
  return [];
}

function validateAssets(assets, errors) {
  const entries = normalizeAssetEntries(assets, errors);
  if (entries === null) return null;
  const assetIds = uniqueIds(entries, 'assets', errors);
  for (const entry of entries) {
    if (entry.type !== 'image') errors.push(`assets.${entry.id}: V2 launch assets must be images.`);
    if (typeof entry.path !== 'string' || !entry.path.trim()) errors.push(`assets.${entry.id}: path is required.`);
    if (!Number.isFinite(entry.pivotX) || entry.pivotX < 0 || entry.pivotX > 1) errors.push(`assets.${entry.id}: pivotX must be in [0, 1].`);
    if (!Number.isFinite(entry.pivotY) || entry.pivotY < 0 || entry.pivotY > 1) errors.push(`assets.${entry.id}: pivotY must be in [0, 1].`);
  }
  const expected = expectedAssetIds();
  if (expected.length !== CONTENT_COUNTS.directionalAssetIds) errors.push('assets: internal expected asset count is invalid.');
  for (const id of expected) if (!assetIds.has(id)) errors.push(`assets: missing required logical id '${id}'.`);
  return entries.length;
}

export class ContentValidationError extends Error {
  constructor(errors) {
    super(`Hero Core Defense V2 content validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
    this.name = 'ContentValidationError';
    this.errors = Object.freeze([...errors]);
  }
}

export function validateContent({ throwOnError = false, assets = null, assetManifest = null } = {}) {
  const errors = [];
  const warnings = [];
  const sets = {
    elements: new Set(ELEMENT_IDS),
    attackTypes: new Set(ATTACK_TYPE_IDS),
    defenseTypes: new Set(DEFENSE_TYPE_IDS),
    buffs: new Set(BUFFS.map(({ id }) => id)),
    statuses: new Set(STATUSES.map(({ id }) => id)),
    effectPresets: new Set(EFFECT_PRESETS.map(({ id }) => id)),
    heroes: new Set(HEROES.map(({ id }) => id)),
    enemies: new Set(ENEMIES.map(({ id }) => id)),
    bosses: new Set(BOSSES.map(({ id }) => id)),
  };

  validateCombat(errors);
  validateBuffs(errors);
  validateStatuses(errors);
  validateEffectPresets(errors);
  validateHeroes(sets, errors);
  validateEnemies(sets, errors);
  validateStages(sets, errors);
  const assetCount = validateAssets(assets ?? assetManifest, errors);

  for (const [label, value] of [
    ['combat.matchups', MATCHUP_TABLE],
    ['buffs', BUFFS],
    ['statuses', STATUSES],
    ['effects', EFFECT_PRESETS],
    ['heroes', HEROES],
    ['enemies', ENEMIES],
    ['stages', STAGES],
  ]) {
    assertDeepFrozen(value, label, errors);
    rejectFunctions(value, label, errors);
  }

  const counts = deepFreeze({
    heroes: HEROES.length,
    mainHeroes: MAIN_HEROES.length,
    normalHeroes: NORMAL_HEROES.length,
    level4Traits: HEROES.flatMap(({ traits }) => traits).filter(({ level }) => level === 4).length,
    level6Traits: HEROES.flatMap(({ traits }) => traits).filter(({ level }) => level === 6).length,
    enemies: ENEMIES.length,
    normalEnemies: NORMAL_ENEMIES.length,
    bosses: BOSSES.length,
    stages: STAGES.length,
    waves: STAGES.reduce((sum, stage) => sum + stage.waves.length, 0),
    buffs: BUFFS.length,
    statuses: STATUSES.length,
    debuffs: DEBUFF_DEFINITIONS.length,
    effectPresets: EFFECT_PRESETS.length,
    assets: assetCount,
  });

  for (const [key, expected] of Object.entries(CONTENT_COUNTS)) {
    if (key === 'directionalAssetIds') continue;
    if (counts[key] !== expected) errors.push(`counts.${key}: expected ${expected}, received ${counts[key]}.`);
  }

  const result = deepFreeze({ valid: errors.length === 0, errors, warnings, counts });
  if (throwOnError && !result.valid) throw new ContentValidationError(result.errors);
  return result;
}

export default validateContent;

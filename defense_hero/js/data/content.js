import {
  ELEMENT_ADVANTAGE_MULTIPLIER,
  ELEMENT_BY_ID,
  ELEMENT_DEFINITIONS,
  ELEMENT_IDS,
  getElementMultiplier,
} from "./elements.js";
import {
  CHARACTER_BY_ID,
  CHARACTER_DEFINITIONS,
  COMPANION_DEFINITIONS,
  LEADER_DEFINITIONS,
} from "./characters.js";
import {
  BOSS_BY_ID,
  BOSS_DEFINITIONS,
  ELITE_PREFIX_DEFINITIONS,
  ENEMY_TYPE_BY_ID,
  ENEMY_TYPE_DEFINITIONS,
  STAGE_BASE_ENEMY_HP,
} from "./enemies.js";
import {
  FIELD_BUFF_BY_ID,
  FIELD_BUFF_DEFINITIONS,
  FIELD_BUFF_RULES,
  GLOBAL_FIELD_BUFF_SLOT_LIMIT,
  STATUS_BY_ID,
  STATUS_DEFINITIONS,
} from "./statuses.js";
import {
  DIFFICULTY_DEFINITIONS,
  DOCTRINE_DEFINITIONS,
  FIXED_CHALLENGE_DEFINITIONS,
  META_PROGRESSION,
  MUTATOR_DEFINITIONS,
  RELIC_DEFINITIONS,
  STARTING_BLESSING_DEFINITIONS,
} from "./progression.js";
import {
  BOARD_RULES,
  MAP_LAYOUT_BY_ID,
  MAP_LAYOUT_DEFINITIONS,
  SPECIAL_TILE_DEFINITIONS,
  STAGE_DEFINITIONS,
  STAGE_ELEMENT_PROFILE_RULES,
  STAGE_RULES,
  WAVE_PACKAGE_BY_ID,
  WAVE_PACKAGE_DEFINITIONS,
} from "./stages.js";
import { ASSET_MANIFEST } from "./assets.js";

export * from "./elements.js";
export * from "./characters.js";
export * from "./enemies.js";
export * from "./statuses.js";
export * from "./progression.js";
export * from "./stages.js";
export * from "./assets.js";

export const CONTENT_SCHEMA_VERSION = 1;

export const HERO_DEFENSE_CONTENT = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  elements: ELEMENT_DEFINITIONS,
  characters: CHARACTER_DEFINITIONS,
  enemies: ENEMY_TYPE_DEFINITIONS,
  elitePrefixes: ELITE_PREFIX_DEFINITIONS,
  bosses: BOSS_DEFINITIONS,
  statuses: STATUS_DEFINITIONS,
  fieldBuffs: FIELD_BUFF_DEFINITIONS,
  difficulties: DIFFICULTY_DEFINITIONS,
  doctrines: DOCTRINE_DEFINITIONS,
  relics: RELIC_DEFINITIONS,
  mutators: MUTATOR_DEFINITIONS,
  startingBlessings: STARTING_BLESSING_DEFINITIONS,
  fixedChallenges: FIXED_CHALLENGE_DEFINITIONS,
  maps: MAP_LAYOUT_DEFINITIONS,
  specialTiles: SPECIAL_TILE_DEFINITIONS,
  wavePackages: WAVE_PACKAGE_DEFINITIONS,
  stages: STAGE_DEFINITIONS,
  stageElementProfiles: STAGE_ELEMENT_PROFILE_RULES,
  assets: ASSET_MANIFEST,
});

// Runtime-facing aliases keep the data schema explicit while allowing
// lightweight systems to consume a stable, compact contract.
export const ELEMENTS = ELEMENT_DEFINITIONS;
export const CHARACTERS = CHARACTER_DEFINITIONS;
export const ENEMIES = ENEMY_TYPE_DEFINITIONS;
export const BOSSES = BOSS_DEFINITIONS;
export const WAVE_PACKAGES = WAVE_PACKAGE_DEFINITIONS;
export const MAP_LAYOUTS = MAP_LAYOUT_DEFINITIONS;
export const STATUSES = STATUS_DEFINITIONS;
export const FIELD_BUFFS = FIELD_BUFF_DEFINITIONS;
export const DIFFICULTIES = DIFFICULTY_DEFINITIONS;
export const DOCTRINES = DOCTRINE_DEFINITIONS;
export const RELICS = RELIC_DEFINITIONS;
export const MUTATORS = MUTATOR_DEFINITIONS;
export const STARTING_BLESSINGS = STARTING_BLESSING_DEFINITIONS;
export const FIXED_CHALLENGES = FIXED_CHALLENGE_DEFINITIONS;
export const SPECIAL_TILES = SPECIAL_TILE_DEFINITIONS;
export const ASSETS = ASSET_MANIFEST;

const EXPECTED_COUNTS = Object.freeze({
  elements: 5,
  leaders: 4,
  companions: 6,
  enemies: 9,
  elitePrefixes: 4,
  bosses: 2,
  statuses: 9,
  doctrines: 8,
  relics: 12,
  mutators: 8,
  startingBlessings: 3,
  fixedChallenges: 3,
  maps: 4,
  specialTiles: 3,
  wavePackages: 12,
  stages: 6,
  assets: 31,
});

function coordinateKey({ x, y }) {
  return `${x},${y}`;
}

function isIntegerCoordinate(value) {
  return value && Number.isInteger(value.x) && Number.isInteger(value.y);
}

function collectDuplicateIds(items, label, errors, globalIds) {
  const localIds = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== "string" || item.id.length === 0) {
      errors.push(`${label}: 비어 있거나 잘못된 id가 있습니다.`);
      continue;
    }
    if (localIds.has(item.id)) errors.push(`${label}: 중복 id '${item.id}'.`);
    localIds.add(item.id);

    if (globalIds.has(item.id)) {
      errors.push(`${label}: 전역 중복 id '${item.id}' (${globalIds.get(item.id)}와 충돌).`);
    } else {
      globalIds.set(item.id, label);
    }
  }
  return localIds;
}

function assertReference(id, validIds, context, errors, { optional = false } = {}) {
  if (optional && (id === null || id === undefined)) return;
  if (typeof id !== "string" || !validIds.has(id)) {
    errors.push(`${context}: 존재하지 않는 참조 '${String(id)}'.`);
  }
}

function validateAssetContract(errors, manifest) {
  if (!Array.isArray(manifest)) {
    errors.push("assets: manifest는 배열이어야 합니다.");
    return;
  }

  const assetIds = new Set();
  for (const entry of manifest) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push("assets: manifest entry는 객체여야 합니다.");
      continue;
    }
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    if (!id) {
      errors.push("assets: 비어 있거나 잘못된 id가 있습니다.");
      continue;
    }
    if (assetIds.has(id)) errors.push(`assets: 중복 id '${id}'.`);
    assetIds.add(id);
    if (!['image', 'audio'].includes(entry.type)) errors.push(`${id}: 지원하지 않는 asset type '${String(entry.type)}'.`);
    if (typeof entry.path !== "string" || entry.path.trim().length === 0) errors.push(`${id}: asset path가 비어 있습니다.`);
    if (entry.type === "image") {
      if (!Number.isFinite(entry.pivotX) || entry.pivotX < 0 || entry.pivotX > 1) errors.push(`${id}: pivotX는 0~1 숫자여야 합니다.`);
      if (!Number.isFinite(entry.pivotY) || entry.pivotY < 0 || entry.pivotY > 1) errors.push(`${id}: pivotY는 0~1 숫자여야 합니다.`);
    }
    if (entry.optional !== true || entry.fallbackAllowed !== true) {
      errors.push(`${id}: 최종 미디어가 없는 프로토타입 asset은 optional/fallbackAllowed여야 합니다.`);
    }
  }

  for (const character of CHARACTER_DEFINITIONS) {
    for (const slot of ["portrait", "battle"]) {
      assertReference(character.assetIds?.[slot], assetIds, `${character.id}.assetIds.${slot}`, errors);
    }
  }
  for (const enemy of ENEMY_TYPE_DEFINITIONS) {
    assertReference(enemy.assetId, assetIds, `${enemy.id}.assetId`, errors);
  }
  for (const boss of BOSS_DEFINITIONS) {
    assertReference(boss.assetId, assetIds, `${boss.id}.assetId`, errors);
  }
}

function validateCharacterDefinitions(errors, warnings) {
  const elementIds = new Set(ELEMENT_IDS);
  const statusIds = new Set(STATUS_DEFINITIONS.map(({ id }) => id));
  const fieldBuffIds = new Set(FIELD_BUFF_DEFINITIONS.map(({ id }) => id));
  const allSkillIds = new Set();
  const allUpgradeIds = new Set();

  for (const character of CHARACTER_DEFINITIONS) {
    assertReference(character.element, elementIds, `${character.id}.element`, errors);
    if (!Array.isArray(character.attackTags) || character.attackTags.length === 0) {
      errors.push(`${character.id}: attackTags가 비어 있습니다.`);
    }
    if (!Array.isArray(character.skills) || character.skills.length === 0) {
      errors.push(`${character.id}: skills가 비어 있습니다.`);
      continue;
    }

    const localSkillIds = new Set();
    for (const skill of character.skills) {
      if (allSkillIds.has(skill.id)) errors.push(`skills: 중복 id '${skill.id}'.`);
      allSkillIds.add(skill.id);
      localSkillIds.add(skill.id);
    }
    assertReference(character.basicSkillId, localSkillIds, `${character.id}.basicSkillId`, errors);
    assertReference(character.passiveId, localSkillIds, `${character.id}.passiveId`, errors);
    assertReference(character.activeSkillId, localSkillIds, `${character.id}.activeSkillId`, errors, { optional: true });

    const expectedCosts = character.levelCosts;
    const upgrades = character.upgrades ?? [];
    const ownerUpgradeIds = new Set(upgrades.map(({ id }) => id));
    for (const upgrade of upgrades) {
      if (allUpgradeIds.has(upgrade.id)) errors.push(`upgrades: 중복 id '${upgrade.id}'.`);
      allUpgradeIds.add(upgrade.id);
      if (upgrade.ownerId !== character.id) {
        errors.push(`${upgrade.id}: ownerId '${upgrade.ownerId}'가 소유자 '${character.id}'와 다릅니다.`);
      }
      if (!Number.isInteger(upgrade.level) || upgrade.level < 2 || upgrade.level > character.maxLevel) {
        errors.push(`${upgrade.id}: 잘못된 레벨 '${upgrade.level}'.`);
      }
      if (upgrade.cost !== expectedCosts[upgrade.level]) {
        errors.push(`${upgrade.id}: 레벨 ${upgrade.level} 비용은 ${expectedCosts[upgrade.level]}이어야 하지만 ${upgrade.cost}입니다.`);
      }
      if (upgrade.requiredUpgradeId) {
        assertReference(upgrade.requiredUpgradeId, ownerUpgradeIds, `${upgrade.id}.requiredUpgradeId`, errors);
      }
      if (upgrade.level < character.branchLevel && upgrade.branch !== null) {
        errors.push(`${upgrade.id}: 분기 전 레벨에는 branch가 없어야 합니다.`);
      }
      if (upgrade.level >= character.branchLevel && !["A", "B"].includes(upgrade.branch)) {
        errors.push(`${upgrade.id}: 분기 레벨 이후 branch는 A 또는 B여야 합니다.`);
      }
    }

    for (let level = 2; level < character.branchLevel; level += 1) {
      const matches = upgrades.filter((upgrade) => upgrade.level === level && upgrade.branch === null);
      if (matches.length !== 1) errors.push(`${character.id}: Lv.${level} 공통 업그레이드는 정확히 1개여야 합니다.`);
    }
    for (let level = character.branchLevel; level <= character.maxLevel; level += 1) {
      for (const branch of ["A", "B"]) {
        const matches = upgrades.filter((upgrade) => upgrade.level === level && upgrade.branch === branch);
        if (matches.length !== 1) errors.push(`${character.id}: Lv.${level} ${branch} 업그레이드는 정확히 1개여야 합니다.`);
      }
    }

    const describedStatusIds = JSON.stringify(character.skills).match(/\b(?:burn|corrosion|curse|darkness|slow|frost|stun|silence|divine)\b/g) ?? [];
    for (const id of describedStatusIds) assertReference(id, statusIds, `${character.id}.skills status`, errors);
    const describedFieldBuffIds = JSON.stringify(character.skills).match(/\b(?:moon_bless|sun_bless|star_powder|arena|sanctuary)\b/g) ?? [];
    for (const id of describedFieldBuffIds) assertReference(id, fieldBuffIds, `${character.id}.skills field buff`, errors);

    if (!character.assetIds?.portrait || !character.assetIds?.battle) {
      warnings.push(`${character.id}: 폴백은 가능하지만 portrait/battle asset ID가 모두 권장됩니다.`);
    }
  }

  const upgradeLookup = new Map(
    CHARACTER_DEFINITIONS.flatMap((character) => character.upgrades).map((upgrade) => [upgrade.id, upgrade]),
  );
  for (const character of CHARACTER_DEFINITIONS) {
    for (const upgrade of character.upgrades) {
      const seen = new Set([upgrade.id]);
      let cursor = upgrade;
      while (cursor.requiredUpgradeId) {
        if (seen.has(cursor.requiredUpgradeId)) {
          errors.push(`${upgrade.id}: 순환 업그레이드 참조가 있습니다.`);
          break;
        }
        seen.add(cursor.requiredUpgradeId);
        cursor = upgradeLookup.get(cursor.requiredUpgradeId);
        if (!cursor) break;
      }
    }
  }

  return { allSkillIds, allUpgradeIds };
}

function validateMapDefinitions(errors) {
  for (const layout of MAP_LAYOUT_DEFINITIONS) {
    if (layout.width !== BOARD_RULES.width || layout.height !== BOARD_RULES.height) {
      errors.push(`${layout.id}: 보드는 ${BOARD_RULES.width}x${BOARD_RULES.height}여야 합니다.`);
    }
    const inBounds = (coord) =>
      isIntegerCoordinate(coord) && coord.x >= 0 && coord.x < layout.width && coord.y >= 0 && coord.y < layout.height;
    const allCoordinateGroups = [
      ["core", [layout.core]],
      ["leaderNodes", layout.leaderNodes],
      ["obstacles", layout.obstacles],
      ["specialTileCandidates", layout.specialTileCandidates],
      ...layout.paths.map((path) => [`path:${path.id}`, path.points]),
    ];
    for (const [label, coordinates] of allCoordinateGroups) {
      for (const coord of coordinates ?? []) {
        if (!inBounds(coord)) errors.push(`${layout.id}.${label}: 범위를 벗어난 좌표 '${coordinateKey(coord ?? {})}'.`);
      }
      const keys = (coordinates ?? []).map(coordinateKey);
      if (new Set(keys).size !== keys.length) errors.push(`${layout.id}.${label}: 중복 좌표가 있습니다.`);
    }

    if (layout.leaderNodes.length !== BOARD_RULES.leaderNodeCount) {
      errors.push(`${layout.id}: 리더 거점은 정확히 ${BOARD_RULES.leaderNodeCount}개여야 합니다.`);
    }
    if (layout.obstacles.length < BOARD_RULES.obstaclesPerStage.min || layout.obstacles.length > BOARD_RULES.obstaclesPerStage.max) {
      errors.push(`${layout.id}: 장애물은 ${BOARD_RULES.obstaclesPerStage.min}~${BOARD_RULES.obstaclesPerStage.max}개여야 합니다.`);
    }
    if (layout.specialTileCandidates.length < BOARD_RULES.specialTilesPerStage.max) {
      errors.push(`${layout.id}: 특수 타일 후보는 최소 ${BOARD_RULES.specialTilesPerStage.max}개여야 합니다.`);
    }
    if (!Array.isArray(layout.paths) || layout.paths.length < 2) {
      errors.push(`${layout.id}: 경로는 최소 2개여야 합니다.`);
      continue;
    }

    const coreKey = coordinateKey(layout.core);
    const pathCells = new Set();
    for (const path of layout.paths) {
      if (coordinateKey(path.points.at(-1)) !== coreKey) errors.push(`${layout.id}.${path.id}: 마지막 좌표가 코어가 아닙니다.`);
      const first = path.points[0];
      if (!(first.x === 0 || first.x === layout.width - 1 || first.y === 0 || first.y === layout.height - 1)) {
        errors.push(`${layout.id}.${path.id}: 진입 좌표가 보드 경계에 없습니다.`);
      }
      for (let index = 0; index < path.points.length; index += 1) {
        pathCells.add(coordinateKey(path.points[index]));
        if (index > 0) {
          const previous = path.points[index - 1];
          const current = path.points[index];
          const manhattan = Math.abs(previous.x - current.x) + Math.abs(previous.y - current.y);
          if (manhattan !== 1) errors.push(`${layout.id}.${path.id}: ${index - 1}→${index} 좌표가 인접하지 않습니다.`);
        }
      }
    }

    const occupied = new Map([[coreKey, "core"]]);
    for (const [label, coordinates] of [
      ["leaderNodes", layout.leaderNodes],
      ["obstacles", layout.obstacles],
      ["specialTileCandidates", layout.specialTileCandidates],
    ]) {
      for (const coord of coordinates) {
        const key = coordinateKey(coord);
        if (pathCells.has(key)) errors.push(`${layout.id}.${label}: 좌표 ${key}가 경로와 겹칩니다.`);
        if (occupied.has(key)) errors.push(`${layout.id}.${label}: 좌표 ${key}가 ${occupied.get(key)}와 겹칩니다.`);
        occupied.set(key, label);
      }
    }
  }
}

function validateReferences(errors, allUpgradeIds) {
  const elementIds = new Set(ELEMENT_DEFINITIONS.map(({ id }) => id));
  const characterIds = new Set(CHARACTER_DEFINITIONS.map(({ id }) => id));
  const leaderIds = new Set(LEADER_DEFINITIONS.map(({ id }) => id));
  const companionIds = new Set(COMPANION_DEFINITIONS.map(({ id }) => id));
  const enemyIds = new Set(ENEMY_TYPE_DEFINITIONS.map(({ id }) => id));
  const bossIds = new Set(BOSS_DEFINITIONS.map(({ id }) => id));
  const relicIds = new Set(RELIC_DEFINITIONS.map(({ id }) => id));
  const difficultyIds = new Set(DIFFICULTY_DEFINITIONS.map(({ id }) => id));
  const challengeIds = new Set(FIXED_CHALLENGE_DEFINITIONS.map(({ id }) => id));
  const mapIds = new Set(MAP_LAYOUT_DEFINITIONS.map(({ id }) => id));
  const waveIds = new Set(WAVE_PACKAGE_DEFINITIONS.map(({ id }) => id));

  for (const element of ELEMENT_DEFINITIONS) {
    assertReference(element.advantageAgainst, elementIds, `${element.id}.advantageAgainst`, errors);
  }
  for (const enemy of ENEMY_TYPE_DEFINITIONS) {
    for (const elementId of enemy.allowedElements ?? []) assertReference(elementId, elementIds, `${enemy.id}.allowedElements`, errors);
    if (enemy.onDeath?.spawnEnemyId) assertReference(enemy.onDeath.spawnEnemyId, enemyIds, `${enemy.id}.onDeath.spawnEnemyId`, errors);
  }
  for (const boss of BOSS_DEFINITIONS) {
    assertReference(boss.element, elementIds, `${boss.id}.element`, errors);
    for (const pattern of boss.patterns) {
      for (const group of pattern.summonGroups ?? []) assertReference(group.enemyId, enemyIds, `${pattern.id}.summonGroups`, errors);
    }
  }
  for (const buff of FIELD_BUFF_DEFINITIONS) {
    for (const effect of buff.effects) {
      if (effect.requiresUpgradeId) assertReference(effect.requiresUpgradeId, allUpgradeIds, `${buff.id}.requiresUpgradeId`, errors);
    }
  }
  for (const wave of WAVE_PACKAGE_DEFINITIONS) {
    for (const group of wave.groups) {
      if (group.enemyId) assertReference(group.enemyId, enemyIds, `${wave.id}.groups.enemyId`, errors);
      for (const enemyId of group.enemyPool ?? []) assertReference(enemyId, enemyIds, `${wave.id}.groups.enemyPool`, errors);
    }
  }
  for (const stage of STAGE_DEFINITIONS) {
    for (const layoutId of stage.allowedLayoutIds) assertReference(layoutId, mapIds, `${stage.id}.allowedLayoutIds`, errors);
    for (const waveId of stage.allowedWavePackageIds) assertReference(waveId, waveIds, `${stage.id}.allowedWavePackageIds`, errors);
    assertReference(stage.bossId, bossIds, `${stage.id}.bossId`, errors, { optional: true });
    for (const waveId of stage.allowedWavePackageIds) {
      const wave = WAVE_PACKAGE_BY_ID[waveId];
      if (wave && (stage.number < wave.stageRange[0] || stage.number > wave.stageRange[1])) {
        errors.push(`${stage.id}: '${waveId}'는 허용 스테이지 범위 밖입니다.`);
      }
    }
  }
  for (const challenge of FIXED_CHALLENGE_DEFINITIONS) {
    assertReference(challenge.fixedDeck.leaderId, leaderIds, `${challenge.id}.fixedDeck.leaderId`, errors);
    if (challenge.fixedDeck.companionIds.length !== 4) errors.push(`${challenge.id}: 고정 동료는 정확히 4명이어야 합니다.`);
    for (const id of challenge.fixedDeck.companionIds) assertReference(id, companionIds, `${challenge.id}.fixedDeck.companionIds`, errors);
    if (new Set(challenge.fixedDeck.companionIds).size !== challenge.fixedDeck.companionIds.length) {
      errors.push(`${challenge.id}: 고정 동료가 중복됩니다.`);
    }
    for (const id of challenge.fixedRelicIds) assertReference(id, relicIds, `${challenge.id}.fixedRelicIds`, errors);
    if (challenge.enemyRules.fixedPrimaryElement) assertReference(challenge.enemyRules.fixedPrimaryElement, elementIds, `${challenge.id}.fixedPrimaryElement`, errors);
    for (const id of challenge.enemyRules.elementPool ?? []) assertReference(id, elementIds, `${challenge.id}.elementPool`, errors);
    if (challenge.enemyRules.bossOverride?.bossId) assertReference(challenge.enemyRules.bossOverride.bossId, bossIds, `${challenge.id}.bossOverride.bossId`, errors);
    if (challenge.enemyRules.bossOverride?.element) assertReference(challenge.enemyRules.bossOverride.element, elementIds, `${challenge.id}.bossOverride.element`, errors);
    if (challenge.unlock.challengeId) assertReference(challenge.unlock.challengeId, challengeIds, `${challenge.id}.unlock.challengeId`, errors);
  }
  for (const id of META_PROGRESSION.initiallyUnlocked.leaders) assertReference(id, leaderIds, "META_PROGRESSION.initiallyUnlocked.leaders", errors);
  for (const id of META_PROGRESSION.initiallyUnlocked.companions) assertReference(id, companionIds, "META_PROGRESSION.initiallyUnlocked.companions", errors);
  for (const id of META_PROGRESSION.initiallyUnlocked.difficulties) assertReference(id, difficultyIds, "META_PROGRESSION.initiallyUnlocked.difficulties", errors);
  for (const id of META_PROGRESSION.unlockable.leaders) assertReference(id, leaderIds, "META_PROGRESSION.unlockable.leaders", errors);
  for (const id of META_PROGRESSION.unlockable.companions) assertReference(id, companionIds, "META_PROGRESSION.unlockable.companions", errors);
  for (const id of META_PROGRESSION.unlockable.difficulties) assertReference(id, difficultyIds, "META_PROGRESSION.unlockable.difficulties", errors);
  for (const id of META_PROGRESSION.unlockable.challenges) assertReference(id, challengeIds, "META_PROGRESSION.unlockable.challenges", errors);
  if (new Set([...META_PROGRESSION.initiallyUnlocked.leaders, ...META_PROGRESSION.unlockable.leaders]).size !== leaderIds.size) {
    errors.push("META_PROGRESSION: 모든 리더가 초기 해금 또는 해금 가능 목록에 정확히 포함되어야 합니다.");
  }
  if (new Set([...META_PROGRESSION.initiallyUnlocked.companions, ...META_PROGRESSION.unlockable.companions]).size !== companionIds.size) {
    errors.push("META_PROGRESSION: 모든 동료가 초기 해금 또는 해금 가능 목록에 정확히 포함되어야 합니다.");
  }

  if (characterIds.size !== EXPECTED_COUNTS.leaders + EXPECTED_COUNTS.companions) {
    errors.push("캐릭터 총 수가 명세와 다릅니다.");
  }
}

export function validateContent({ throwOnError = false, assetManifest = ASSET_MANIFEST } = {}) {
  const errors = [];
  const warnings = [];
  const globalIds = new Map();
  const collections = [
    ["elements", ELEMENT_DEFINITIONS],
    ["characters", CHARACTER_DEFINITIONS],
    ["enemies", ENEMY_TYPE_DEFINITIONS],
    ["elitePrefixes", ELITE_PREFIX_DEFINITIONS],
    ["bosses", BOSS_DEFINITIONS],
    ["statuses", STATUS_DEFINITIONS],
    ["fieldBuffs", FIELD_BUFF_DEFINITIONS],
    ["difficulties", DIFFICULTY_DEFINITIONS],
    ["doctrines", DOCTRINE_DEFINITIONS],
    ["relics", RELIC_DEFINITIONS],
    ["mutators", MUTATOR_DEFINITIONS],
    ["startingBlessings", STARTING_BLESSING_DEFINITIONS],
    ["fixedChallenges", FIXED_CHALLENGE_DEFINITIONS],
    ["maps", MAP_LAYOUT_DEFINITIONS],
    ["specialTiles", SPECIAL_TILE_DEFINITIONS],
    ["wavePackages", WAVE_PACKAGE_DEFINITIONS],
    ["stages", STAGE_DEFINITIONS],
  ];
  for (const [label, definitions] of collections) collectDuplicateIds(definitions, label, errors, globalIds);

  const { allUpgradeIds } = validateCharacterDefinitions(errors, warnings);
  validateMapDefinitions(errors);
  validateReferences(errors, allUpgradeIds);
  validateAssetContract(errors, assetManifest);

  const counts = Object.freeze({
    elements: ELEMENT_DEFINITIONS.length,
    leaders: LEADER_DEFINITIONS.length,
    companions: COMPANION_DEFINITIONS.length,
    enemies: ENEMY_TYPE_DEFINITIONS.length,
    elitePrefixes: ELITE_PREFIX_DEFINITIONS.length,
    bosses: BOSS_DEFINITIONS.length,
    statuses: STATUS_DEFINITIONS.length,
    doctrines: DOCTRINE_DEFINITIONS.length,
    relics: RELIC_DEFINITIONS.length,
    mutators: MUTATOR_DEFINITIONS.length,
    startingBlessings: STARTING_BLESSING_DEFINITIONS.length,
    fixedChallenges: FIXED_CHALLENGE_DEFINITIONS.length,
    maps: MAP_LAYOUT_DEFINITIONS.length,
    specialTiles: SPECIAL_TILE_DEFINITIONS.length,
    wavePackages: WAVE_PACKAGE_DEFINITIONS.length,
    stages: STAGE_DEFINITIONS.length,
    assets: Array.isArray(assetManifest) ? assetManifest.length : 0,
  });
  for (const [label, expected] of Object.entries(EXPECTED_COUNTS)) {
    if (counts[label] !== expected) errors.push(`${label}: ${expected}개가 필요하지만 ${counts[label]}개입니다.`);
  }

  const shardTotal = STAGE_DEFINITIONS.filter(({ number }) => number < 6).reduce((sum, stage) => sum + stage.growthShards, 0);
  if (shardTotal !== STAGE_RULES.totalGrowthShardsBeforeFinalBoss) {
    errors.push(`최종 보스 전 성장 조각 합은 ${STAGE_RULES.totalGrowthShardsBeforeFinalBoss}이어야 하지만 ${shardTotal}입니다.`);
  }
  const stageNumbers = STAGE_DEFINITIONS.map(({ number }) => number).sort((a, b) => a - b);
  if (stageNumbers.join(",") !== "1,2,3,4,5,6") errors.push("스테이지 번호는 1~6을 정확히 한 번씩 포함해야 합니다.");

  const result = Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    counts,
  });
  if (throwOnError && !result.valid) {
    throw new Error(`Hero Defense 콘텐츠 검증 실패:\n${errors.join("\n")}`);
  }
  return result;
}

export {
  BOSS_BY_ID,
  CHARACTER_BY_ID,
  ELEMENT_ADVANTAGE_MULTIPLIER,
  ELEMENT_BY_ID,
  ENEMY_TYPE_BY_ID,
  FIELD_BUFF_BY_ID,
  FIELD_BUFF_RULES,
  GLOBAL_FIELD_BUFF_SLOT_LIMIT,
  MAP_LAYOUT_BY_ID,
  STAGE_BASE_ENEMY_HP,
  STATUS_BY_ID,
  WAVE_PACKAGE_BY_ID,
  getElementMultiplier,
};

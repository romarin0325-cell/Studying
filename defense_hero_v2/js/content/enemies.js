import { deepFreeze } from './combat.js';

const DIRECTION_IDS = ['front', 'back', 'left', 'right'];

function bossAssetIds(bossId) {
  return {
    battle: Object.fromEntries(DIRECTION_IDS.map((direction) => [direction, `boss/${bossId}/${direction}`])),
  };
}

function enemy({ id, name, element, defenseType, baseHp, speed, stageId, token }) {
  return {
    id,
    name,
    displayName: name,
    element,
    defenseType,
    baseHp,
    hp: baseHp,
    speed,
    speedCellsPerSecond: speed,
    coreDamage: 1,
    isBoss: false,
    stageId,
    renderMode: 'defense_token',
    token,
  };
}

function boss({ id, name, element, baseHp, speed, stageId }) {
  return {
    id,
    name,
    displayName: name,
    element,
    defenseType: 'boss',
    baseHp,
    hp: baseHp,
    speed,
    speedCellsPerSecond: speed,
    coreDamage: 1,
    isBoss: true,
    stageId,
    renderMode: 'directional_sprite',
    initialDirection: 'front',
    assetIds: bossAssetIds(id),
  };
}

export const ENEMIES = deepFreeze([
  enemy({
    id: 'ruin_scarab',
    name: '유적딱정벌레',
    element: 'nature',
    defenseType: 'normal',
    baseHp: 80,
    speed: 1.20,
    stageId: 'ancient_ruins',
    token: { shape: 'circle', symbol: '●' },
  }),
  enemy({
    id: 'ember_scarab',
    name: '화염딱정벌레',
    element: 'fire',
    defenseType: 'normal',
    baseHp: 85,
    speed: 1.25,
    stageId: 'ancient_ruins',
    token: { shape: 'circle', symbol: '●' },
  }),
  enemy({
    id: 'sand_wisp',
    name: '사막정령',
    element: 'light',
    defenseType: 'air',
    baseHp: 65,
    speed: 1.45,
    stageId: 'ancient_ruins',
    token: { shape: 'wing', symbol: '◇' },
  }),
  enemy({
    id: 'stone_guard',
    name: '석상수호자',
    element: 'nature',
    defenseType: 'heavy',
    baseHp: 160,
    speed: 0.85,
    stageId: 'ancient_ruins',
    token: { shape: 'square', symbol: '■' },
  }),
  enemy({
    id: 'regrowth_idol',
    name: '재생우상',
    element: 'nature',
    defenseType: 'regeneration',
    baseHp: 105,
    speed: 0.95,
    stageId: 'ancient_ruins',
    token: { shape: 'hexagon', symbol: '✚' },
  }),
  boss({
    id: 'flora',
    name: '플로라',
    element: 'nature',
    baseHp: 2500,
    speed: 0.70,
    stageId: 'ancient_ruins',
  }),
  boss({
    id: 'pharaoh',
    name: '파라오',
    element: 'nature',
    baseHp: 5200,
    speed: 0.65,
    stageId: 'ancient_ruins',
  }),
  enemy({
    id: 'rift_shade',
    name: '틈새의그림자',
    element: 'dark',
    defenseType: 'normal',
    baseHp: 95,
    speed: 1.25,
    stageId: 'chaos_rift',
    token: { shape: 'circle', symbol: '●' },
  }),
  enemy({
    id: 'rift_wing',
    name: '틈새의날개',
    element: 'dark',
    defenseType: 'air',
    baseHp: 75,
    speed: 1.50,
    stageId: 'chaos_rift',
    token: { shape: 'wing', symbol: '◇' },
  }),
  enemy({
    id: 'abyss_armor',
    name: '심연갑주',
    element: 'dark',
    defenseType: 'heavy',
    baseHp: 190,
    speed: 0.82,
    stageId: 'chaos_rift',
    token: { shape: 'square', symbol: '■' },
  }),
  enemy({
    id: 'chaos_spawn',
    name: '혼돈의태아',
    element: 'fire',
    defenseType: 'regeneration',
    baseHp: 125,
    speed: 1.00,
    stageId: 'chaos_rift',
    token: { shape: 'hexagon', symbol: '✚' },
  }),
  enemy({
    id: 'lesser_demon',
    name: '하급마족',
    element: 'dark',
    defenseType: 'demon',
    baseHp: 140,
    speed: 1.10,
    stageId: 'chaos_rift',
    token: { shape: 'diamond', symbol: '◆' },
  }),
  boss({
    id: 'reaper',
    name: '사신',
    element: 'dark',
    baseHp: 3200,
    speed: 0.72,
    stageId: 'chaos_rift',
  }),
  boss({
    id: 'demon_god',
    name: '마신',
    element: 'dark',
    baseHp: 6500,
    speed: 0.62,
    stageId: 'chaos_rift',
  }),
]);

export const ENEMY_BY_ID = deepFreeze(Object.fromEntries(ENEMIES.map((definition) => [definition.id, definition])));
export const NORMAL_ENEMIES = deepFreeze(ENEMIES.filter((definition) => !definition.isBoss));
export const BOSSES = deepFreeze(ENEMIES.filter((definition) => definition.isBoss));

export default ENEMIES;

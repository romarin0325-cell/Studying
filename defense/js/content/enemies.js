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

function boss({ id, name, element, baseHp, speed, stageId, ability }) {
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
    ability: { interval: 11, windup: 3.2, breakHpRatio: .07, recovery: 3, ...ability },
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
    name: '꽃의 여신 플로라',
    element: 'nature',
    baseHp: 2500,
    speed: 0.70,
    stageId: 'fairy_forest',
    ability: { kind: 'bloom', name: '만개', description: '시전이 끝나면 재생 우상 둘을 불러냅니다.', enemyId: 'regrowth_idol', count: 2, hpScale: .6 },
  }),
  boss({
    id: 'artificial_demon',
    name: '인조마신',
    element: 'light',
    baseHp: 3200,
    speed: 0.65,
    stageId: 'ancient_ruins',
    ability: { kind: 'guard', name: '프리즘 장벽', description: '시전이 끝나면 4초간 받는 피해가 35% 감소합니다.', duration: 4, damageTaken: .65 },
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
    id: 'love_iris',
    name: '사랑의 여신 아이리스',
    element: 'light',
    baseHp: 3200,
    speed: 0.72,
    stageId: 'crossroads',
    ability: { kind: 'heal', name: '장미의 약속', description: '시전이 끝나면 최대 생명력의 6%를 회복합니다.', healRatio: .06 },
  }),
  boss({
    id: 'beelzebub',
    name: '마신 벨제뷔트',
    element: 'dark',
    baseHp: 3800,
    speed: 0.62,
    stageId: 'chaos_rift',
    ability: { kind: 'doom', name: '검은 태양', description: '시전이 끝나면 코어에 피해 1을 줍니다.', coreDamage: 1, interval: 14 },
  }),
  boss({ id:'curse_iris',name:'저주의 여신 아이리스',element:'dark',baseHp:3200,speed:.68,stageId:'long_boulevard',
    ability:{kind:'seal',name:'일곱 번째 저주',description:'가까운 수호자 둘의 다음 스킬을 3초 늦춥니다.',count:2,delay:3} }),
  boss({ id:'poseidon',name:'해신 포세이돈',element:'water',baseHp:3500,speed:.63,stageId:'sunken_temple',
    ability:{kind:'tide',name:'대해일',description:'시전이 끝나면 4초간 이동 속도가 70% 증가합니다.',duration:4,speedMultiplier:1.7} }),
]);

export const ENEMY_BY_ID = deepFreeze(Object.fromEntries(ENEMIES.map((definition) => [definition.id, definition])));
export const NORMAL_ENEMIES = deepFreeze(ENEMIES.filter((definition) => !definition.isBoss));
export const BOSSES = deepFreeze(ENEMIES.filter((definition) => definition.isBoss));

export default ENEMIES;

import {
  BOARD_RULES,
  DREAM_CRYSTAL_REWARDS,
  WAVE_HP_MULTIPLIERS,
  WAVE_RULES,
  deepFreeze,
} from './combat.js';

function spot(x, y, role) { return { x, y, role }; }

function point(x, y) {
  return { x, y };
}

export function expandOrthogonalPath(waypoints) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    throw new TypeError('An orthogonal path requires at least two waypoints.');
  }
  const cells = [];
  for (let index = 0; index < waypoints.length; index += 1) {
    const current = waypoints[index];
    if (!Number.isInteger(current?.x) || !Number.isInteger(current?.y)) {
      throw new TypeError(`Waypoint ${index} must have integer x/y coordinates.`);
    }
    if (index === 0) {
      cells.push({ x: current.x, y: current.y });
      continue;
    }
    const previous = waypoints[index - 1];
    const deltaX = current.x - previous.x;
    const deltaY = current.y - previous.y;
    if (deltaX !== 0 && deltaY !== 0) {
      throw new RangeError(`Path segment ${index - 1}->${index} is not orthogonal.`);
    }
    if (deltaX === 0 && deltaY === 0) {
      throw new RangeError(`Path segment ${index - 1}->${index} has zero length.`);
    }
    const stepX = Math.sign(deltaX);
    const stepY = Math.sign(deltaY);
    const distance = Math.abs(deltaX) + Math.abs(deltaY);
    for (let step = 1; step <= distance; step += 1) {
      cells.push({ x: previous.x + stepX * step, y: previous.y + stepY * step });
    }
  }
  return cells;
}

function makeWave(number, groups, spawnOrder, { boss = false } = {}) {
  return {
    number,
    kind: boss ? 'boss' : 'normal',
    groups,
    spawnOrder,
    enemyCount: spawnOrder.length,
    hpMultiplier: WAVE_HP_MULTIPLIERS[number],
    dreamCrystalReward: DREAM_CRYSTAL_REWARDS[number - 1],
    spawnIntervalSeconds: WAVE_RULES.baseSpawnIntervalSeconds,
  };
}

// 전투 영역은 상단 12×12(y 0~11). 하단 y 12~15는 UI 밴드로 사용한다.
const ANCIENT_RUINS_WAYPOINTS = [
  point(0, 1),
  point(10, 1),
  point(10, 5),
  point(1, 5),
  point(1, 9),
  point(10, 9),
];

const CHAOS_RIFT_WAYPOINTS = [
  point(1, 0),
  point(1, 9),
  point(5, 9),
  point(5, 2),
  point(9, 2),
  point(9, 10),
  point(10, 10),
];

const CROSSROADS_WAYPOINTS = [
  point(1, 1),
  point(10, 1),
  point(10, 10),
  point(1, 10),
  point(1, 5),
  point(6, 5),
  point(6, 8),
  point(8, 8),
];

const LONG_BOULEVARD_WAYPOINTS = [
  point(1, 1),
  point(10, 1),
  point(10, 5),
  point(1, 5),
  point(1, 10),
  point(10, 10),
];

function singleWave(number, enemyId, count) {
  return makeWave(number, [{ enemyId, count }], Array(count).fill(enemyId));
}

// Phase 4: 모든 일반 웨이브는 단일 적 타입(20~30마리)으로 구성한다.
// 고대유적 게이트 보정은 스테이지 배율(일반 적 HP +10%, speed -10%)로만 적용한다.
// 같은 로스터를 재사용하는 long_boulevard에는 전하지 않는다.
const ancientRuinsWaves = [
  singleWave(1, 'ruin_scarab', 30),
  singleWave(2, 'sand_wisp', 30),
  singleWave(3, 'stone_guard', 22),
  singleWave(4, 'regrowth_idol', 26),
  makeWave(5, [{ enemyId: 'flora', count: 1 }], ['flora'], { boss: true }),
  singleWave(6, 'ember_scarab', 30),
  singleWave(7, 'sand_wisp', 30),
  singleWave(8, 'stone_guard', 24),
  singleWave(9, 'regrowth_idol', 28),
  makeWave(10, [{ enemyId: 'pharaoh', count: 1 }], ['pharaoh'], { boss: true }),
];

const chaosRiftWaves = [
  singleWave(1, 'rift_shade', 30),
  singleWave(2, 'rift_wing', 30),
  singleWave(3, 'abyss_armor', 20),
  singleWave(4, 'chaos_spawn', 24),
  makeWave(5, [{ enemyId: 'reaper', count: 1 }], ['reaper'], { boss: true }),
  singleWave(6, 'lesser_demon', 30),
  singleWave(7, 'rift_wing', 30),
  singleWave(8, 'abyss_armor', 22),
  singleWave(9, 'rift_shade', 30),
  makeWave(10, [{ enemyId: 'demon_god', count: 1 }], ['demon_god'], { boss: true }),
];

const crossroadsWaves = [
  singleWave(1, 'rift_shade', 30),
  singleWave(2, 'rift_wing', 30),
  singleWave(3, 'abyss_armor', 20),
  singleWave(4, 'chaos_spawn', 24),
  makeWave(5, [{ enemyId: 'reaper', count: 1 }], ['reaper'], { boss: true }),
  singleWave(6, 'lesser_demon', 30),
  singleWave(7, 'rift_wing', 30),
  singleWave(8, 'abyss_armor', 22),
  singleWave(9, 'chaos_spawn', 26),
  makeWave(10, [{ enemyId: 'demon_god', count: 1 }], ['demon_god'], { boss: true }),
];

const longBoulevardWaves = [
  singleWave(1, 'ruin_scarab', 30),
  singleWave(2, 'sand_wisp', 30),
  singleWave(3, 'stone_guard', 20),
  singleWave(4, 'regrowth_idol', 24),
  makeWave(5, [{ enemyId: 'flora', count: 1 }], ['flora'], { boss: true }),
  singleWave(6, 'ember_scarab', 30),
  singleWave(7, 'sand_wisp', 30),
  singleWave(8, 'stone_guard', 22),
  singleWave(9, 'regrowth_idol', 26),
  makeWave(10, [{ enemyId: 'pharaoh', count: 1 }], ['pharaoh'], { boss: true }),
];

export const STAGES = deepFreeze([
  {
    id: 'ancient_ruins',
    name: '고대유적',
    displayName: '고대유적',
    theme: 'ruins',
    enemyHpMultiplier: 1.1,
    enemySpeedMultiplier: 0.9,
    representativeElement: 'nature',
    featuredDefenseTypes: ['normal', 'heavy', 'regeneration'],
    midBossId: 'flora',
    finalBossId: 'pharaoh',
    availableDifficultyIds: ['easy', 'normal'],
    displayedDifficultyIds: ['easy', 'normal'],
    map: {
      columns: BOARD_RULES.columns,
      rows: BOARD_RULES.rows,
      spawn: point(0, 1),
      core: point(10, 9),
      pathWaypoints: ANCIENT_RUINS_WAYPOINTS,
      pathCells: expandOrthogonalPath(ANCIENT_RUINS_WAYPOINTS),
      obstacles: [point(3, 0), point(6, 0), point(0, 8)],
      placementCells: [
        spot(11, 1, 'line'),
        spot(0, 5, 'line'),
        spot(10, 6, 'line'),
        spot(9, 2, 'bend'),
        spot(9, 4, 'bend'),
        spot(2, 6, 'bend'),
        spot(2, 8, 'bend'),
        spot(4, 3, 'crossing'),
        spot(7, 3, 'crossing'),
        spot(4, 7, 'crossing'),
        spot(7, 7, 'crossing'),
        spot(5, 3, 'support'),
        spot(6, 7, 'support'),
        spot(11, 9, 'last'),
        spot(9, 10, 'last'),
      ],
      recommendedPlacements: {
        0: point(9, 2),
        1: point(7, 3),
        2: point(11, 1),
        3: point(2, 6),
        4: point(4, 7),
      },
    },
    waves: ancientRuinsWaves,
  },
  {
    id: 'chaos_rift',
    name: '혼돈의틈',
    displayName: '혼돈의틈',
    theme: 'chaos',
    representativeElement: 'dark',
    featuredDefenseTypes: ['air', 'heavy', 'demon'],
    midBossId: 'reaper',
    finalBossId: 'demon_god',
    availableDifficultyIds: ['easy', 'normal'],
    displayedDifficultyIds: ['easy', 'normal'],
    map: {
      columns: BOARD_RULES.columns,
      rows: BOARD_RULES.rows,
      spawn: point(1, 0),
      core: point(10, 10),
      pathWaypoints: CHAOS_RIFT_WAYPOINTS,
      pathCells: expandOrthogonalPath(CHAOS_RIFT_WAYPOINTS),
      obstacles: [point(0, 4), point(0, 6), point(11, 5)],
      placementCells: [
        spot(1, 10, 'line'),
        spot(5, 1, 'line'),
        spot(9, 1, 'line'),
        spot(2, 8, 'bend'),
        spot(4, 8, 'bend'),
        spot(6, 3, 'bend'),
        spot(8, 3, 'bend'),
        spot(3, 3, 'crossing'),
        spot(3, 6, 'crossing'),
        spot(7, 4, 'crossing'),
        spot(7, 7, 'crossing'),
        spot(3, 5, 'support'),
        spot(7, 5, 'support'),
        spot(10, 9, 'last'),
        spot(11, 10, 'last'),
      ],
      recommendedPlacements: {
        0: point(3, 3),
        1: point(7, 4),
        2: point(5, 1),
        3: point(4, 8),
        4: point(3, 6),
      },
    },
    waves: chaosRiftWaves,
  },
  {
    id: 'crossroads',
    name: '십자 교차로',
    displayName: '십자 교차로',
    theme: 'chaos',
    representativeElement: 'light',
    featuredDefenseTypes: ['air', 'heavy', 'demon'],
    midBossId: 'reaper',
    finalBossId: 'demon_god',
    availableDifficultyIds: ['easy', 'normal'],
    displayedDifficultyIds: ['easy', 'normal'],
    map: {
      columns: BOARD_RULES.columns,
      rows: BOARD_RULES.rows,
      spawn: point(1, 1),
      core: point(8, 8),
      pathWaypoints: CROSSROADS_WAYPOINTS,
      pathCells: expandOrthogonalPath(CROSSROADS_WAYPOINTS),
      obstacles: [point(3, 0), point(7, 0), point(11, 6)],
      placementCells: [
        spot(0, 1, 'line'),
        spot(1, 11, 'line'),
        spot(0, 10, 'line'),
        spot(9, 2, 'bend'),
        spot(9, 9, 'bend'),
        spot(2, 9, 'bend'),
        spot(2, 6, 'bend'),
        spot(5, 3, 'crossing'),
        spot(8, 4, 'crossing'),
        spot(4, 7, 'crossing'),
        spot(3, 8, 'crossing'),
        spot(4, 3, 'support'),
        spot(4, 6, 'support'),
        spot(8, 7, 'last'),
        spot(7, 9, 'last'),
      ],
      recommendedPlacements: {
        0: point(2, 6),
        1: point(5, 3),
        2: point(0, 1),
        3: point(9, 9),
        4: point(4, 7),
      },
    },
    waves: crossroadsWaves,
  },
  {
    id: 'long_boulevard',
    name: '긴 직선 대로',
    displayName: '긴 직선 대로',
    theme: 'ruins',
    representativeElement: 'fire',
    featuredDefenseTypes: ['normal', 'regeneration', 'heavy'],
    midBossId: 'flora',
    finalBossId: 'pharaoh',
    availableDifficultyIds: ['easy', 'normal'],
    displayedDifficultyIds: ['easy', 'normal'],
    map: {
      columns: BOARD_RULES.columns,
      rows: BOARD_RULES.rows,
      spawn: point(1, 1),
      core: point(10, 10),
      pathWaypoints: LONG_BOULEVARD_WAYPOINTS,
      pathCells: expandOrthogonalPath(LONG_BOULEVARD_WAYPOINTS),
      obstacles: [point(4, 0), point(7, 0), point(0, 7)],
      placementCells: [
        spot(0, 1, 'line'),
        spot(11, 5, 'line'),
        spot(10, 6, 'line'),
        spot(9, 2, 'bend'),
        spot(9, 4, 'bend'),
        spot(2, 6, 'bend'),
        spot(2, 9, 'bend'),
        spot(4, 3, 'crossing'),
        spot(7, 3, 'crossing'),
        spot(3, 7, 'crossing'),
        spot(6, 8, 'crossing'),
        spot(5, 3, 'support'),
        spot(5, 7, 'support'),
        spot(11, 10, 'last'),
        spot(9, 11, 'last'),
      ],
      recommendedPlacements: {
        0: point(9, 2),
        1: point(7, 3),
        2: point(11, 5),
        3: point(2, 6),
        4: point(6, 8),
      },
    },
    waves: longBoulevardWaves,
  },
]);

export const STAGE_BY_ID = deepFreeze(Object.fromEntries(STAGES.map((stage) => [stage.id, stage])));

export default STAGES;

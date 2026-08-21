import {
  BOARD_RULES,
  DREAM_CRYSTAL_REWARDS,
  WAVE_HP_MULTIPLIERS,
  WAVE_RULES,
  deepFreeze,
} from './combat.js';

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
  point(0, 11),
  point(0, 0),
  point(11, 0),
  point(11, 10),
  point(2, 10),
  point(2, 2),
  point(9, 2),
  point(9, 8),
  point(4, 8),
  point(4, 4),
  point(7, 4),
  point(7, 6),
  point(5, 6),
];

const CROSSROADS_WAYPOINTS = [
  point(0, 4),
  point(11, 4),
  point(11, 11),
  point(0, 11),
  point(0, 7),
  point(3, 7),
  point(3, 9),
  point(8, 9),
  point(8, 7),
  point(5, 7),
  point(5, 5),
];

const LONG_BOULEVARD_WAYPOINTS = [
  point(0, 1),
  point(11, 1),
  point(11, 5),
  point(0, 5),
  point(0, 10),
  point(11, 10),
];

function singleWave(number, enemyId, count) {
  return makeWave(number, [{ enemyId, count }], Array(count).fill(enemyId));
}

// Phase 4: 모든 일반 웨이브는 단일 적 타입(20~30마리)으로 구성한다.
// 고대유적 게이트 보정: 경로 압축으로 클리어 중앙값이 7분 게이트 아래로 내려가
// §5.5 허용 보정(수량 상한 30까지 증량 + baseHp +10%)에 더해 적 speed -10%로
// 이동 시간을 복원했다. 상세 근거는 BALANCE_DESIGN_SHEET.md 참고.
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
    representativeElement: 'nature',
    featuredDefenseTypes: ['normal', 'heavy', 'regeneration'],
    midBossId: 'flora',
    finalBossId: 'pharaoh',
    availableDifficultyIds: ['easy'],
    displayedDifficultyIds: ['easy', 'normal', 'hard'],
    map: {
      columns: BOARD_RULES.columns,
      rows: BOARD_RULES.rows,
      spawn: point(0, 1),
      core: point(10, 9),
      pathWaypoints: ANCIENT_RUINS_WAYPOINTS,
      pathCells: expandOrthogonalPath(ANCIENT_RUINS_WAYPOINTS),
      obstacles: [
        point(3, 3), point(7, 3),
        point(3, 7), point(7, 7),
        point(5, 0), point(5, 11),
      ],
      placementCells: [
        point(2, 3), point(4, 3), point(5, 3), point(6, 3), point(8, 3),
        point(5, 2), point(2, 7), point(4, 7), point(6, 7), point(8, 7),
        point(3, 10), point(6, 10), point(9, 10), point(11, 2), point(11, 10),
      ],
      recommendedPlacements: {
        0: point(5, 2),
        1: point(8, 3),
        2: point(11, 2),
        3: point(6, 7),
        4: point(2, 7),
      },
    },
    waves: ancientRuinsWaves,
  },
  {
    id: 'chaos_rift',
    name: '혼돈의틈',
    displayName: '혼돈의틈',
    representativeElement: 'dark',
    featuredDefenseTypes: ['air', 'heavy', 'demon'],
    midBossId: 'reaper',
    finalBossId: 'demon_god',
    availableDifficultyIds: ['easy'],
    displayedDifficultyIds: ['easy', 'normal', 'hard'],
    map: {
      columns: BOARD_RULES.columns,
      rows: BOARD_RULES.rows,
      spawn: point(0, 11),
      core: point(5, 6),
      pathWaypoints: CHAOS_RIFT_WAYPOINTS,
      pathCells: expandOrthogonalPath(CHAOS_RIFT_WAYPOINTS),
      obstacles: [
        point(1, 4), point(3, 1), point(5, 1),
        point(8, 3), point(10, 5), point(1, 6),
        point(8, 5), point(3, 9), point(6, 9), point(10, 9),
      ],
      placementCells: [
        point(1, 3), point(3, 3), point(5, 3), point(7, 3), point(10, 1),
        point(6, 1), point(3, 5), point(5, 5), point(6, 5), point(8, 7),
        point(3, 7), point(6, 7), point(5, 9), point(10, 7), point(3, 11),
      ],
      recommendedPlacements: {
        0: point(1, 3),
        1: point(5, 5),
        2: point(3, 3),
        3: point(8, 7),
        4: point(3, 5),
      },
    },
    waves: chaosRiftWaves,
  },
  {
    id: 'crossroads',
    name: '십자 교차로',
    displayName: '십자 교차로',
    representativeElement: 'light',
    featuredDefenseTypes: ['air', 'heavy', 'demon'],
    midBossId: 'reaper',
    finalBossId: 'demon_god',
    availableDifficultyIds: ['easy'],
    displayedDifficultyIds: ['easy', 'normal', 'hard'],
    map: {
      columns: BOARD_RULES.columns,
      rows: BOARD_RULES.rows,
      spawn: point(0, 4),
      core: point(5, 5),
      pathWaypoints: CROSSROADS_WAYPOINTS,
      pathCells: expandOrthogonalPath(CROSSROADS_WAYPOINTS),
      obstacles: [
        point(2, 6), point(7, 5), point(2, 8), point(9, 6),
        point(4, 10), point(7, 10), point(6, 2), point(9, 8),
      ],
      placementCells: [
        point(4, 6), point(6, 6), point(4, 5), point(6, 5), point(1, 5),
        point(9, 5), point(10, 6), point(4, 7), point(9, 7), point(1, 8),
        point(5, 8), point(2, 10), point(6, 10), point(9, 10), point(10, 8),
      ],
      recommendedPlacements: {
        0: point(4, 5),
        1: point(6, 6),
        2: point(5, 8),
        3: point(4, 6),
        4: point(9, 5),
      },
    },
    waves: crossroadsWaves,
  },
  {
    id: 'long_boulevard',
    name: '긴 직선 대로',
    displayName: '긴 직선 대로',
    representativeElement: 'fire',
    featuredDefenseTypes: ['normal', 'regeneration', 'heavy'],
    midBossId: 'flora',
    finalBossId: 'pharaoh',
    availableDifficultyIds: ['easy'],
    displayedDifficultyIds: ['easy', 'normal', 'hard'],
    map: {
      columns: BOARD_RULES.columns,
      rows: BOARD_RULES.rows,
      spawn: point(0, 1),
      core: point(11, 10),
      pathWaypoints: LONG_BOULEVARD_WAYPOINTS,
      pathCells: expandOrthogonalPath(LONG_BOULEVARD_WAYPOINTS),
      obstacles: [
        point(3, 3), point(7, 3), point(10, 3),
        point(3, 7), point(7, 7), point(10, 7),
        point(5, 0), point(5, 11),
      ],
      placementCells: [
        point(1, 2), point(2, 3), point(5, 3), point(9, 3), point(10, 2),
        point(4, 4), point(8, 4), point(2, 7), point(5, 7), point(9, 7),
        point(1, 8), point(4, 9), point(8, 9), point(3, 11), point(6, 11),
      ],
      recommendedPlacements: {
        0: point(10, 2),
        1: point(9, 3),
        2: point(4, 4),
        3: point(8, 9),
        4: point(2, 7),
      },
    },
    waves: longBoulevardWaves,
  },
]);

export const STAGE_BY_ID = deepFreeze(Object.fromEntries(STAGES.map((stage) => [stage.id, stage])));

export default STAGES;

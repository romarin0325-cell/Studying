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

function repeatPattern(pattern, repeatCount) {
  return Array.from({ length: repeatCount }, () => pattern).flat();
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

const ancientRuinsWaves = [
  makeWave(1, [{ enemyId: 'ruin_scarab', count: 30 }], Array(30).fill('ruin_scarab')),
  makeWave(2, [
    { enemyId: 'ruin_scarab', count: 20 },
    { enemyId: 'sand_wisp', count: 10 },
  ], repeatPattern(['ruin_scarab', 'ruin_scarab', 'sand_wisp'], 10)),
  makeWave(3, [
    { enemyId: 'ruin_scarab', count: 18 },
    { enemyId: 'stone_guard', count: 12 },
  ], repeatPattern(['ruin_scarab', 'ruin_scarab', 'ruin_scarab', 'stone_guard', 'stone_guard'], 6)),
  makeWave(4, [
    { enemyId: 'ruin_scarab', count: 10 },
    { enemyId: 'sand_wisp', count: 10 },
    { enemyId: 'regrowth_idol', count: 10 },
  ], repeatPattern(['ruin_scarab', 'sand_wisp', 'regrowth_idol'], 10)),
  makeWave(5, [{ enemyId: 'flora', count: 1 }], ['flora'], { boss: true }),
  makeWave(6, [
    { enemyId: 'ember_scarab', count: 15 },
    { enemyId: 'regrowth_idol', count: 15 },
  ], repeatPattern(['ember_scarab', 'regrowth_idol'], 15)),
  makeWave(7, [
    { enemyId: 'sand_wisp', count: 10 },
    { enemyId: 'stone_guard', count: 10 },
    { enemyId: 'ruin_scarab', count: 10 },
  ], repeatPattern(['sand_wisp', 'stone_guard', 'ruin_scarab'], 10)),
  makeWave(8, [
    { enemyId: 'regrowth_idol', count: 10 },
    { enemyId: 'stone_guard', count: 10 },
    { enemyId: 'ember_scarab', count: 10 },
  ], repeatPattern(['regrowth_idol', 'stone_guard', 'ember_scarab'], 10)),
  makeWave(9, [
    { enemyId: 'ruin_scarab', count: 6 },
    { enemyId: 'ember_scarab', count: 6 },
    { enemyId: 'sand_wisp', count: 6 },
    { enemyId: 'stone_guard', count: 6 },
    { enemyId: 'regrowth_idol', count: 6 },
  ], repeatPattern(['ruin_scarab', 'ember_scarab', 'sand_wisp', 'stone_guard', 'regrowth_idol'], 6)),
  makeWave(10, [{ enemyId: 'pharaoh', count: 1 }], ['pharaoh'], { boss: true }),
];

const chaosRiftWaves = [
  makeWave(1, [{ enemyId: 'rift_shade', count: 30 }], Array(30).fill('rift_shade')),
  makeWave(2, [
    { enemyId: 'rift_shade', count: 20 },
    { enemyId: 'rift_wing', count: 10 },
  ], repeatPattern(['rift_shade', 'rift_shade', 'rift_wing'], 10)),
  makeWave(3, [
    { enemyId: 'rift_shade', count: 15 },
    { enemyId: 'abyss_armor', count: 15 },
  ], repeatPattern(['rift_shade', 'abyss_armor'], 15)),
  makeWave(4, [
    { enemyId: 'rift_shade', count: 10 },
    { enemyId: 'chaos_spawn', count: 10 },
    { enemyId: 'lesser_demon', count: 10 },
  ], repeatPattern(['rift_shade', 'chaos_spawn', 'lesser_demon'], 10)),
  makeWave(5, [{ enemyId: 'reaper', count: 1 }], ['reaper'], { boss: true }),
  makeWave(6, [
    { enemyId: 'rift_wing', count: 15 },
    { enemyId: 'lesser_demon', count: 15 },
  ], repeatPattern(['rift_wing', 'lesser_demon'], 15)),
  makeWave(7, [
    { enemyId: 'abyss_armor', count: 10 },
    { enemyId: 'chaos_spawn', count: 10 },
    { enemyId: 'lesser_demon', count: 10 },
  ], repeatPattern(['abyss_armor', 'chaos_spawn', 'lesser_demon'], 10)),
  makeWave(8, [
    { enemyId: 'rift_wing', count: 8 },
    { enemyId: 'abyss_armor', count: 8 },
    { enemyId: 'chaos_spawn', count: 7 },
    { enemyId: 'lesser_demon', count: 7 },
  ], [
    ...repeatPattern(['rift_wing', 'abyss_armor', 'chaos_spawn', 'lesser_demon'], 7),
    'rift_wing',
    'abyss_armor',
  ]),
  makeWave(9, [
    { enemyId: 'rift_shade', count: 6 },
    { enemyId: 'rift_wing', count: 6 },
    { enemyId: 'abyss_armor', count: 6 },
    { enemyId: 'chaos_spawn', count: 6 },
    { enemyId: 'lesser_demon', count: 6 },
  ], repeatPattern(['rift_shade', 'rift_wing', 'abyss_armor', 'chaos_spawn', 'lesser_demon'], 6)),
  makeWave(10, [{ enemyId: 'demon_god', count: 1 }], ['demon_god'], { boss: true }),
];

function singleWave(number, enemyId, count) {
  return makeWave(number, [{ enemyId, count }], Array(count).fill(enemyId));
}

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

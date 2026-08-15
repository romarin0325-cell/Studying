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

const ANCIENT_RUINS_WAYPOINTS = [
  point(0, 1),
  point(10, 1),
  point(10, 4),
  point(1, 4),
  point(1, 7),
  point(10, 7),
  point(10, 10),
  point(1, 10),
  point(1, 13),
  point(10, 13),
  point(10, 15),
  point(11, 15),
];

const CHAOS_RIFT_WAYPOINTS = [
  point(0, 15),
  point(0, 0),
  point(11, 0),
  point(11, 14),
  point(2, 14),
  point(2, 3),
  point(9, 3),
  point(9, 11),
  point(4, 11),
  point(4, 6),
  point(7, 6),
  point(7, 9),
  point(6, 9),
  point(6, 8),
  point(5, 8),
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
      core: point(11, 15),
      pathWaypoints: ANCIENT_RUINS_WAYPOINTS,
      pathCells: expandOrthogonalPath(ANCIENT_RUINS_WAYPOINTS),
      obstacles: [
        point(4, 2), point(7, 2),
        point(3, 5), point(6, 5),
        point(4, 8), point(7, 8),
        point(3, 11), point(6, 11),
        point(5, 14), point(8, 14),
      ],
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
      spawn: point(0, 15),
      core: point(5, 8),
      pathWaypoints: CHAOS_RIFT_WAYPOINTS,
      pathCells: expandOrthogonalPath(CHAOS_RIFT_WAYPOINTS),
      obstacles: [
        point(1, 2), point(5, 1), point(10, 2),
        point(1, 8), point(3, 5), point(8, 5),
        point(3, 12), point(8, 13),
        point(5, 7), point(5, 10),
      ],
    },
    waves: chaosRiftWaves,
  },
]);

export const STAGE_BY_ID = deepFreeze(Object.fromEntries(STAGES.map((stage) => [stage.id, stage])));

export default STAGES;

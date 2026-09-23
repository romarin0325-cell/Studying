import { BOARD_RULES, DREAM_CRYSTAL_REWARDS, WAVE_HP_MULTIPLIERS, WAVE_RULES, deepFreeze } from './combat.js';

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


// Stable legacy stage IDs preserve progress/checkpoints. New chapters use new IDs.
// Placement role metadata is authoring-only; markers reveal no strategic hints.
const REALMS = [
  {
    "id": "ancient_ruins",
    "name": "마도제국",
    "theme": "ruins",
    "representativeElement": "light",
    "featuredDefenseTypes": [
      "normal",
      "heavy",
      "air"
    ],
    "boss": "artificial_demon",
    "enemyHpMultiplier": 1.1,
    "enemySpeedMultiplier": 0.9,
    "waveEnemies": [
      "ruin_scarab",
      "sand_wisp",
      "stone_guard",
      "regrowth_idol",
      "ember_scarab",
      "sand_wisp",
      "stone_guard",
      "regrowth_idol"
    ],
    "counts": [
      30,
      30,
      22,
      26,
      30,
      30,
      24,
      28
    ],
    "map": {
      "pathWaypoints": [
        {
          "x": 0,
          "y": 1
        },
        {
          "x": 10,
          "y": 1
        },
        {
          "x": 10,
          "y": 5
        },
        {
          "x": 1,
          "y": 5
        },
        {
          "x": 1,
          "y": 9
        },
        {
          "x": 10,
          "y": 9
        }
      ],
      "obstacles": [
        {
          "x": 3,
          "y": 0
        },
        {
          "x": 6,
          "y": 0
        },
        {
          "x": 0,
          "y": 8
        }
      ],
      "placementCells": [
        {
          "x": 11,
          "y": 1,
          "role": "line"
        },
        {
          "x": 0,
          "y": 5,
          "role": "line"
        },
        {
          "x": 10,
          "y": 6,
          "role": "line"
        },
        {
          "x": 9,
          "y": 2,
          "role": "bend"
        },
        {
          "x": 9,
          "y": 4,
          "role": "bend"
        },
        {
          "x": 2,
          "y": 6,
          "role": "bend"
        },
        {
          "x": 2,
          "y": 8,
          "role": "bend"
        },
        {
          "x": 4,
          "y": 3,
          "role": "crossing"
        },
        {
          "x": 7,
          "y": 3,
          "role": "crossing"
        },
        {
          "x": 4,
          "y": 7,
          "role": "crossing"
        },
        {
          "x": 7,
          "y": 7,
          "role": "crossing"
        },
        {
          "x": 5,
          "y": 3,
          "role": "support"
        },
        {
          "x": 6,
          "y": 7,
          "role": "support"
        },
        {
          "x": 11,
          "y": 9,
          "role": "last"
        },
        {
          "x": 9,
          "y": 10,
          "role": "last"
        }
      ],
      "recommendedPlacements": {
        "0": {
          "x": 9,
          "y": 2
        },
        "1": {
          "x": 7,
          "y": 3
        },
        "2": {
          "x": 11,
          "y": 1
        },
        "3": {
          "x": 2,
          "y": 6
        },
        "4": {
          "x": 4,
          "y": 7
        }
      }
    }
  },
  {
    "id": "crossroads",
    "name": "빛의 신전",
    "theme": "ruins",
    "representativeElement": "light",
    "featuredDefenseTypes": [
      "air",
      "heavy",
      "demon"
    ],
    "boss": "love_iris",
    "waveEnemies": [
      "ruin_scarab",
      "sand_wisp",
      "stone_guard",
      "lesser_demon",
      "ember_scarab",
      "sand_wisp",
      "abyss_armor",
      "lesser_demon"
    ],
    "counts": [
      30,
      30,
      20,
      24,
      30,
      30,
      22,
      26
    ],
    "map": {
      "pathWaypoints": [
        {
          "x": 1,
          "y": 1
        },
        {
          "x": 10,
          "y": 1
        },
        {
          "x": 10,
          "y": 10
        },
        {
          "x": 1,
          "y": 10
        },
        {
          "x": 1,
          "y": 5
        },
        {
          "x": 6,
          "y": 5
        },
        {
          "x": 6,
          "y": 8
        },
        {
          "x": 8,
          "y": 8
        }
      ],
      "obstacles": [
        {
          "x": 3,
          "y": 0
        },
        {
          "x": 7,
          "y": 0
        },
        {
          "x": 11,
          "y": 6
        }
      ],
      "placementCells": [
        {
          "x": 0,
          "y": 1,
          "role": "line"
        },
        {
          "x": 1,
          "y": 11,
          "role": "line"
        },
        {
          "x": 0,
          "y": 10,
          "role": "line"
        },
        {
          "x": 9,
          "y": 2,
          "role": "bend"
        },
        {
          "x": 9,
          "y": 9,
          "role": "bend"
        },
        {
          "x": 2,
          "y": 9,
          "role": "bend"
        },
        {
          "x": 2,
          "y": 6,
          "role": "bend"
        },
        {
          "x": 5,
          "y": 3,
          "role": "crossing"
        },
        {
          "x": 8,
          "y": 4,
          "role": "crossing"
        },
        {
          "x": 4,
          "y": 7,
          "role": "crossing"
        },
        {
          "x": 3,
          "y": 8,
          "role": "crossing"
        },
        {
          "x": 4,
          "y": 3,
          "role": "support"
        },
        {
          "x": 4,
          "y": 6,
          "role": "support"
        },
        {
          "x": 8,
          "y": 7,
          "role": "last"
        },
        {
          "x": 7,
          "y": 9,
          "role": "last"
        }
      ],
      "recommendedPlacements": {
        "0": {
          "x": 2,
          "y": 6
        },
        "1": {
          "x": 5,
          "y": 3
        },
        "2": {
          "x": 0,
          "y": 1
        },
        "3": {
          "x": 9,
          "y": 9
        },
        "4": {
          "x": 4,
          "y": 7
        }
      }
    }
  },
  {
    "id": "long_boulevard",
    "name": "어둠의 신전",
    "theme": "chaos",
    "representativeElement": "dark",
    "featuredDefenseTypes": [
      "normal",
      "air",
      "demon"
    ],
    "boss": "curse_iris",
    "waveEnemies": [
      "rift_shade",
      "rift_wing",
      "lesser_demon",
      "chaos_spawn",
      "rift_shade",
      "rift_wing",
      "abyss_armor",
      "lesser_demon"
    ],
    "counts": [
      30,
      30,
      22,
      24,
      30,
      30,
      22,
      26
    ],
    "map": {
      "pathWaypoints": [
        {
          "x": 1,
          "y": 1
        },
        {
          "x": 10,
          "y": 1
        },
        {
          "x": 10,
          "y": 5
        },
        {
          "x": 1,
          "y": 5
        },
        {
          "x": 1,
          "y": 10
        },
        {
          "x": 10,
          "y": 10
        }
      ],
      "obstacles": [
        {
          "x": 4,
          "y": 0
        },
        {
          "x": 7,
          "y": 0
        },
        {
          "x": 0,
          "y": 7
        }
      ],
      "placementCells": [
        {
          "x": 0,
          "y": 1,
          "role": "line"
        },
        {
          "x": 11,
          "y": 5,
          "role": "line"
        },
        {
          "x": 10,
          "y": 6,
          "role": "line"
        },
        {
          "x": 9,
          "y": 2,
          "role": "bend"
        },
        {
          "x": 9,
          "y": 4,
          "role": "bend"
        },
        {
          "x": 2,
          "y": 6,
          "role": "bend"
        },
        {
          "x": 2,
          "y": 9,
          "role": "bend"
        },
        {
          "x": 4,
          "y": 3,
          "role": "crossing"
        },
        {
          "x": 7,
          "y": 3,
          "role": "crossing"
        },
        {
          "x": 3,
          "y": 7,
          "role": "crossing"
        },
        {
          "x": 6,
          "y": 8,
          "role": "crossing"
        },
        {
          "x": 5,
          "y": 3,
          "role": "support"
        },
        {
          "x": 5,
          "y": 7,
          "role": "support"
        },
        {
          "x": 11,
          "y": 10,
          "role": "last"
        },
        {
          "x": 9,
          "y": 11,
          "role": "last"
        }
      ],
      "recommendedPlacements": {
        "0": {
          "x": 9,
          "y": 2
        },
        "1": {
          "x": 7,
          "y": 3
        },
        "2": {
          "x": 11,
          "y": 5
        },
        "3": {
          "x": 2,
          "y": 6
        },
        "4": {
          "x": 6,
          "y": 8
        }
      }
    }
  },
  {
    "id": "fairy_forest",
    "name": "요정의 숲",
    "theme": "ruins",
    "representativeElement": "nature",
    "featuredDefenseTypes": [
      "regeneration",
      "air",
      "heavy"
    ],
    "boss": "flora",
    "waveEnemies": [
      "ruin_scarab",
      "sand_wisp",
      "regrowth_idol",
      "stone_guard",
      "ember_scarab",
      "sand_wisp",
      "regrowth_idol",
      "stone_guard"
    ],
    "counts": [
      28,
      28,
      24,
      20,
      28,
      28,
      26,
      22
    ],
    "map": {
      "pathWaypoints": [
        {
          "x": 0,
          "y": 1
        },
        {
          "x": 9,
          "y": 1
        },
        {
          "x": 9,
          "y": 5
        },
        {
          "x": 2,
          "y": 5
        },
        {
          "x": 2,
          "y": 9
        },
        {
          "x": 8,
          "y": 9
        },
        {
          "x": 8,
          "y": 11
        }
      ],
      "obstacles": [
        {
          "x": 2,
          "y": 0
        },
        {
          "x": 6,
          "y": 0
        },
        {
          "x": 10,
          "y": 7
        }
      ],
      "placementCells": [
        {
          "x": 10,
          "y": 1,
          "role": "line"
        },
        {
          "x": 1,
          "y": 5,
          "role": "line"
        },
        {
          "x": 2,
          "y": 10,
          "role": "line"
        },
        {
          "x": 8,
          "y": 2,
          "role": "bend"
        },
        {
          "x": 8,
          "y": 4,
          "role": "bend"
        },
        {
          "x": 3,
          "y": 6,
          "role": "bend"
        },
        {
          "x": 3,
          "y": 8,
          "role": "bend"
        },
        {
          "x": 4,
          "y": 3,
          "role": "crossing"
        },
        {
          "x": 6,
          "y": 3,
          "role": "crossing"
        },
        {
          "x": 5,
          "y": 7,
          "role": "crossing"
        },
        {
          "x": 7,
          "y": 7,
          "role": "crossing"
        },
        {
          "x": 5,
          "y": 3,
          "role": "support"
        },
        {
          "x": 6,
          "y": 6,
          "role": "support"
        },
        {
          "x": 9,
          "y": 11,
          "role": "last"
        },
        {
          "x": 7,
          "y": 11,
          "role": "last"
        }
      ],
      "recommendedPlacements": {
        "0": {
          "x": 8,
          "y": 2
        },
        "1": {
          "x": 8,
          "y": 4
        },
        "2": {
          "x": 3,
          "y": 6
        },
        "3": {
          "x": 3,
          "y": 8
        },
        "4": {
          "x": 4,
          "y": 3
        }
      }
    }
  },
  {
    "id": "sunken_temple",
    "name": "해저 신전",
    "theme": "ruins",
    "representativeElement": "water",
    "featuredDefenseTypes": [
      "air",
      "heavy",
      "regeneration"
    ],
    "boss": "poseidon",
    "waveEnemies": [
      "ruin_scarab",
      "sand_wisp",
      "stone_guard",
      "regrowth_idol",
      "rift_shade",
      "rift_wing",
      "stone_guard",
      "regrowth_idol"
    ],
    "counts": [
      30,
      28,
      22,
      24,
      30,
      28,
      24,
      26
    ],
    "map": {
      "pathWaypoints": [
        {
          "x": 1,
          "y": 0
        },
        {
          "x": 1,
          "y": 9
        },
        {
          "x": 5,
          "y": 9
        },
        {
          "x": 5,
          "y": 2
        },
        {
          "x": 10,
          "y": 2
        },
        {
          "x": 10,
          "y": 10
        },
        {
          "x": 7,
          "y": 10
        },
        {
          "x": 7,
          "y": 6
        }
      ],
      "obstacles": [
        {
          "x": 0,
          "y": 5
        },
        {
          "x": 11,
          "y": 5
        },
        {
          "x": 11,
          "y": 9
        }
      ],
      "placementCells": [
        {
          "x": 1,
          "y": 10,
          "role": "line"
        },
        {
          "x": 5,
          "y": 1,
          "role": "line"
        },
        {
          "x": 11,
          "y": 2,
          "role": "line"
        },
        {
          "x": 2,
          "y": 8,
          "role": "bend"
        },
        {
          "x": 4,
          "y": 8,
          "role": "bend"
        },
        {
          "x": 6,
          "y": 3,
          "role": "bend"
        },
        {
          "x": 9,
          "y": 3,
          "role": "bend"
        },
        {
          "x": 3,
          "y": 3,
          "role": "crossing"
        },
        {
          "x": 3,
          "y": 6,
          "role": "crossing"
        },
        {
          "x": 8,
          "y": 4,
          "role": "crossing"
        },
        {
          "x": 8,
          "y": 8,
          "role": "crossing"
        },
        {
          "x": 3,
          "y": 5,
          "role": "support"
        },
        {
          "x": 8,
          "y": 7,
          "role": "support"
        },
        {
          "x": 7,
          "y": 5,
          "role": "last"
        },
        {
          "x": 6,
          "y": 6,
          "role": "last"
        }
      ],
      "recommendedPlacements": {
        "0": {
          "x": 2,
          "y": 8
        },
        "1": {
          "x": 4,
          "y": 8
        },
        "2": {
          "x": 6,
          "y": 3
        },
        "3": {
          "x": 9,
          "y": 3
        },
        "4": {
          "x": 3,
          "y": 3
        }
      }
    }
  },
  {
    "id": "chaos_rift",
    "name": "혼돈의 틈",
    "theme": "chaos",
    "representativeElement": "dark",
    "featuredDefenseTypes": [
      "air",
      "heavy",
      "demon"
    ],
    "boss": "beelzebub",
    "waveEnemies": [
      "rift_shade",
      "rift_wing",
      "abyss_armor",
      "chaos_spawn",
      "lesser_demon",
      "rift_wing",
      "abyss_armor",
      "rift_shade"
    ],
    "counts": [
      30,
      30,
      20,
      24,
      30,
      30,
      22,
      30
    ],
    "map": {
      "pathWaypoints": [
        {
          "x": 1,
          "y": 0
        },
        {
          "x": 1,
          "y": 9
        },
        {
          "x": 5,
          "y": 9
        },
        {
          "x": 5,
          "y": 2
        },
        {
          "x": 9,
          "y": 2
        },
        {
          "x": 9,
          "y": 10
        },
        {
          "x": 10,
          "y": 10
        }
      ],
      "obstacles": [
        {
          "x": 0,
          "y": 4
        },
        {
          "x": 0,
          "y": 6
        },
        {
          "x": 11,
          "y": 5
        }
      ],
      "placementCells": [
        {
          "x": 1,
          "y": 10,
          "role": "line"
        },
        {
          "x": 5,
          "y": 1,
          "role": "line"
        },
        {
          "x": 9,
          "y": 1,
          "role": "line"
        },
        {
          "x": 2,
          "y": 8,
          "role": "bend"
        },
        {
          "x": 4,
          "y": 8,
          "role": "bend"
        },
        {
          "x": 6,
          "y": 3,
          "role": "bend"
        },
        {
          "x": 8,
          "y": 3,
          "role": "bend"
        },
        {
          "x": 3,
          "y": 3,
          "role": "crossing"
        },
        {
          "x": 3,
          "y": 6,
          "role": "crossing"
        },
        {
          "x": 7,
          "y": 4,
          "role": "crossing"
        },
        {
          "x": 7,
          "y": 7,
          "role": "crossing"
        },
        {
          "x": 3,
          "y": 5,
          "role": "support"
        },
        {
          "x": 7,
          "y": 5,
          "role": "support"
        },
        {
          "x": 10,
          "y": 9,
          "role": "last"
        },
        {
          "x": 11,
          "y": 10,
          "role": "last"
        }
      ],
      "recommendedPlacements": {
        "0": {
          "x": 3,
          "y": 3
        },
        "1": {
          "x": 7,
          "y": 4
        },
        "2": {
          "x": 5,
          "y": 1
        },
        "3": {
          "x": 4,
          "y": 8
        },
        "4": {
          "x": 3,
          "y": 6
        }
      }
    }
  }
];

function makeWaves(realm) {
  let normalIndex = 0;
  return Array.from({length:10}, (_,index) => {
    const number=index+1, boss=number===5 || number===10;
    const enemyId=boss ? realm.boss : realm.waveEnemies[normalIndex];
    const count=boss ? 1 : realm.counts[normalIndex++];
    return {number, kind:boss?'boss':'normal', groups:[{enemyId,count}],
      spawnOrder:Array(count).fill(enemyId), enemyCount:count,
      hpMultiplier:WAVE_HP_MULTIPLIERS[number] * (number===5 ? .58 : 1),
      dreamCrystalReward:DREAM_CRYSTAL_REWARDS[index],
      spawnIntervalSeconds:WAVE_RULES.baseSpawnIntervalSeconds};
  });
}

export const STAGES = deepFreeze(REALMS.map(realm => {
  const {boss,waveEnemies,counts,map,...identity}=realm;
  const pathCells=expandOrthogonalPath(map.pathWaypoints);
  return {...identity,displayName:realm.name,midBossId:boss,finalBossId:boss,
    availableDifficultyIds:['easy','normal'],displayedDifficultyIds:['easy','normal'],
    map:{...map,columns:BOARD_RULES.columns,rows:BOARD_RULES.rows,
      pathCells,spawn:pathCells[0],core:pathCells[pathCells.length-1]},
    waves:makeWaves(realm)};
}));
export const STAGE_BY_ID = deepFreeze(Object.fromEntries(STAGES.map(stage=>[stage.id,stage])));
export default STAGES;

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveShotgunHits,
  updateBasicAttackForHero,
} from '../../js/battle/systems/BasicAttackSystem.js';
import { STAGE_BY_ID, expandOrthogonalPath } from '../../js/content/stages.js';

const SHOTGUN_ANGLES = [-12, 0, 12];
const DEG_TO_RAD = Math.PI / 180;

function enemyOnRay(id, degrees, distance = 3) {
  const radians = degrees * DEG_TO_RAD;
  return {
    id,
    x: Math.cos(radians) * distance,
    y: Math.sin(radians) * distance,
    dead: false,
    reachedCore: false,
    isBoss: false,
  };
}

test('shotgun ray collision deterministically resolves one, two, or three pellet hits', () => {
  const cases = [
    { rays: [0], pelletIndexes: [1] },
    { rays: [-12, 12], pelletIndexes: [0, 2] },
    { rays: [-12, 0, 12], pelletIndexes: [0, 1, 2] },
  ];

  for (const { rays, pelletIndexes } of cases) {
    const enemies = rays.map((degrees, index) => enemyOnRay(`enemy_${index}`, degrees));
    const hits = resolveShotgunHits({ x: 0, y: 0 }, { x: 4, y: 0 }, enemies, {
      range: 4,
      angles: SHOTGUN_ANGLES,
      normalRadius: 0.05,
      bossRadius: 0.05,
    });
    assert.equal(hits.length, rays.length);
    assert.deepEqual(hits.map((hit) => hit.pelletIndex), pelletIndexes);
    assert.equal(new Set(hits.map((hit) => hit.target.id)).size, rays.length);
    const pellets = resolveShotgunHits({ x: 0, y: 0 }, { x: 4, y: 0 }, enemies, {
      range: 4,
      angles: SHOTGUN_ANGLES,
      normalRadius: 0.05,
      bossRadius: 0.05,
      includeMisses: true,
    });
    assert.equal(pellets.length, 3);
    assert.equal(pellets.filter(({ target }) => target).length, rays.length);
    assert.equal(pellets.filter(({ target }) => !target).length, 3 - rays.length);
  }
});

test('each shotgun pellet independently deals damage, rolls critical, and applies on-hit status', () => {
  let rngDraws = 0;
  const hero = {
    id: 'shotgun_hero',
    x: 0,
    y: 0,
    placed: true,
    level: 1,
    attackTimer: 0,
    direction: 'front',
    lastTargetId: null,
    buffs: new Map(),
    selectedTraits: [],
    stats: { damage: 0, kills: 0, basicAttacks: 0, skills: 0 },
    definition: {
      element: 'nature',
      tags: [],
      traits: [],
      attack: {
        archetype: 'shotgun',
        attackType: 'normal',
        range: 4,
        interval: 2,
        damage: 10,
        spreadDegrees: SHOTGUN_ANGLES,
        normalCollisionRadius: 0.30,
        bossCollisionRadius: 0.45,
        statuses: [{ statusId: 'poison', chance: 1 }],
      },
    },
  };
  const target = {
    id: 'wide_target',
    x: 2.5,
    y: 0.5,
    hp: 100,
    maxHp: 100,
    defenseType: 'normal',
    isBoss: true,
    progress: 1,
    spawnOrder: 1,
    statuses: {},
    dead: false,
    reachedCore: false,
  };
  const state = {
    heroes: [hero],
    enemies: new Map([[target.id, target]]),
    rng: { next: () => { rngDraws += 1; return 0.99; } },
    core: { durability: 10, maxDurability: 10 },
    wave: { previousCoreDamaged: false },
    events: [],
  };

  assert.equal(updateBasicAttackForHero(state, hero, 0), true);
  assert.equal(hero.stats.basicAttacks, 1);
  assert.equal(hero.stats.damage, 30);
  assert.equal(hero.attackTimer, 2);
  assert.equal(target.hp, 70);
  assert.equal(target.statuses.poison.stacks, 3, 'on-hit poison is applied once for every pellet');
  assert.equal(rngDraws, 6, 'three pellets each make one critical roll and one status roll');
  const trails = state.events.filter((event) => event.visualOnly);
  assert.equal(trails.length, 3);
  assert.deepEqual(trails.map(({ pelletIndex }) => pelletIndex), [0, 1, 2]);
  assert.ok(trails.every(({ missed }) => !missed));
  assert.equal(state.events.filter((event) => (
    event.effectPreset === 'basic_shotgun_hit' && !event.visualOnly
  )).length, 3);
  assert.equal(state.events.filter((event) => event.effectPreset === 'status_apply').length, 3);
});

const EXPECTED_PATHS = Object.freeze({
  ancient_ruins: Object.freeze([
    { x: 0, y: 1 }, { x: 10, y: 1 }, { x: 10, y: 4 }, { x: 1, y: 4 },
    { x: 1, y: 7 }, { x: 10, y: 7 }, { x: 10, y: 10 }, { x: 1, y: 10 },
    { x: 1, y: 13 }, { x: 10, y: 13 }, { x: 10, y: 15 }, { x: 11, y: 15 },
  ]),
  chaos_rift: Object.freeze([
    { x: 0, y: 15 }, { x: 0, y: 0 }, { x: 11, y: 0 }, { x: 11, y: 14 },
    { x: 2, y: 14 }, { x: 2, y: 3 }, { x: 9, y: 3 }, { x: 9, y: 11 },
    { x: 4, y: 11 }, { x: 4, y: 6 }, { x: 7, y: 6 }, { x: 7, y: 9 },
    { x: 6, y: 9 }, { x: 6, y: 8 }, { x: 5, y: 8 },
  ]),
});

const EXPECTED_WAVES = Object.freeze({
  ancient_ruins: Object.freeze([
    [{ enemyId: 'ruin_scarab', count: 30 }],
    [{ enemyId: 'ruin_scarab', count: 20 }, { enemyId: 'sand_wisp', count: 10 }],
    [{ enemyId: 'ruin_scarab', count: 18 }, { enemyId: 'stone_guard', count: 12 }],
    [{ enemyId: 'ruin_scarab', count: 10 }, { enemyId: 'sand_wisp', count: 10 }, { enemyId: 'regrowth_idol', count: 10 }],
    [{ enemyId: 'flora', count: 1 }],
    [{ enemyId: 'ember_scarab', count: 15 }, { enemyId: 'regrowth_idol', count: 15 }],
    [{ enemyId: 'sand_wisp', count: 10 }, { enemyId: 'stone_guard', count: 10 }, { enemyId: 'ruin_scarab', count: 10 }],
    [{ enemyId: 'regrowth_idol', count: 10 }, { enemyId: 'stone_guard', count: 10 }, { enemyId: 'ember_scarab', count: 10 }],
    [
      { enemyId: 'ruin_scarab', count: 6 },
      { enemyId: 'ember_scarab', count: 6 },
      { enemyId: 'sand_wisp', count: 6 },
      { enemyId: 'stone_guard', count: 6 },
      { enemyId: 'regrowth_idol', count: 6 },
    ],
    [{ enemyId: 'pharaoh', count: 1 }],
  ]),
  chaos_rift: Object.freeze([
    [{ enemyId: 'rift_shade', count: 30 }],
    [{ enemyId: 'rift_shade', count: 20 }, { enemyId: 'rift_wing', count: 10 }],
    [{ enemyId: 'rift_shade', count: 15 }, { enemyId: 'abyss_armor', count: 15 }],
    [{ enemyId: 'rift_shade', count: 10 }, { enemyId: 'chaos_spawn', count: 10 }, { enemyId: 'lesser_demon', count: 10 }],
    [{ enemyId: 'reaper', count: 1 }],
    [{ enemyId: 'rift_wing', count: 15 }, { enemyId: 'lesser_demon', count: 15 }],
    [{ enemyId: 'abyss_armor', count: 10 }, { enemyId: 'chaos_spawn', count: 10 }, { enemyId: 'lesser_demon', count: 10 }],
    [
      { enemyId: 'rift_wing', count: 8 },
      { enemyId: 'abyss_armor', count: 8 },
      { enemyId: 'chaos_spawn', count: 7 },
      { enemyId: 'lesser_demon', count: 7 },
    ],
    [
      { enemyId: 'rift_shade', count: 6 },
      { enemyId: 'rift_wing', count: 6 },
      { enemyId: 'abyss_armor', count: 6 },
      { enemyId: 'chaos_spawn', count: 6 },
      { enemyId: 'lesser_demon', count: 6 },
    ],
    [{ enemyId: 'demon_god', count: 1 }],
  ]),
});

const EXPECTED_REWARDS = Object.freeze([1, 1, 1, 1, 3, 2, 2, 2, 2, 0]);

function frequencies(ids) {
  const counts = {};
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

test('both stage paths are fixed, orthogonal, in bounds, and never repeat a cell', () => {
  for (const [stageId, expectedWaypoints] of Object.entries(EXPECTED_PATHS)) {
    const stage = STAGE_BY_ID[stageId];
    assert.deepEqual(stage.map.pathWaypoints, expectedWaypoints, `${stageId} fixed waypoints`);
    assert.deepEqual(stage.map.pathCells, expandOrthogonalPath(expectedWaypoints));
    assert.deepEqual(stage.map.pathCells[0], stage.map.spawn);
    assert.deepEqual(stage.map.pathCells.at(-1), stage.map.core);

    const keys = stage.map.pathCells.map(({ x, y }) => `${x},${y}`);
    assert.equal(new Set(keys).size, keys.length, `${stageId} path cells must not repeat`);
    for (let index = 0; index < stage.map.pathCells.length; index += 1) {
      const cell = stage.map.pathCells[index];
      assert.ok(cell.x >= 0 && cell.x < stage.map.columns);
      assert.ok(cell.y >= 0 && cell.y < stage.map.rows);
      if (index === 0) continue;
      const previous = stage.map.pathCells[index - 1];
      assert.equal(Math.abs(cell.x - previous.x) + Math.abs(cell.y - previous.y), 1);
    }
  }
});

test('all 20 waves have the exact enemy counts, compositions, and crystal rewards', () => {
  let checkedWaves = 0;
  for (const [stageId, expectedGroups] of Object.entries(EXPECTED_WAVES)) {
    const stage = STAGE_BY_ID[stageId];
    assert.equal(stage.waves.length, 10);
    assert.deepEqual(stage.waves.map((wave) => wave.groups), expectedGroups);
    assert.deepEqual(stage.waves.map((wave) => wave.dreamCrystalReward), EXPECTED_REWARDS);

    stage.waves.forEach((wave, index) => {
      const expectedCount = expectedGroups[index].reduce((sum, group) => sum + group.count, 0);
      const expectedComposition = Object.fromEntries(
        expectedGroups[index].map(({ enemyId, count }) => [enemyId, count]),
      );
      assert.equal(wave.number, index + 1);
      assert.equal(wave.enemyCount, expectedCount);
      assert.equal(wave.spawnOrder.length, expectedCount);
      assert.deepEqual(frequencies(wave.spawnOrder), expectedComposition);
      assert.equal(wave.kind, [5, 10].includes(index + 1) ? 'boss' : 'normal');
      checkedWaves += 1;
    });
  }
  assert.equal(checkedWaves, 20);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  actionPriority,
  createBattleActions,
  resolveBattleActions,
} from '../../js/battle/systems/ActionSystem.js';
import {
  createBasicAttackAction,
  resolveBasicAttackAction,
} from '../../js/battle/systems/BasicAttackSystem.js';
import {
  createSkillAction,
  resolveSkillAction,
} from '../../js/battle/systems/SkillSystem.js';

function runtimeHero({
  id,
  slot = 0,
  archetype = 'burst',
  attackDamage = 10,
  attackInterval = 3,
  attackTimer = 0,
  skillDamage = 10,
  skillShape = 'single',
  skillCooldown = 5,
  skillTimer = 0,
  skillEffects = [],
} = {}) {
  return {
    id,
    slot,
    x: 0,
    y: 0,
    placed: true,
    level: 1,
    attackTimer,
    skillTimer,
    direction: 'front',
    lastTargetId: null,
    buffs: new Map(),
    selectedTraits: {},
    stats: { damage: 0, kills: 0, basicAttacks: 0, skills: 0 },
    definition: {
      element: 'light',
      tags: [],
      traits: [],
      attack: {
        archetype,
        attackType: 'normal',
        range: 6,
        interval: attackInterval,
        damage: attackDamage,
        radius: archetype === 'area' ? 2 : undefined,
      },
      skill: {
        attackType: 'normal',
        cooldown: skillCooldown,
        shape: skillShape,
        damage: skillDamage,
        radius: skillShape === 'area' ? 3 : undefined,
        onHitEffects: skillEffects,
      },
    },
  };
}

function runtimeEnemy({
  id,
  spawnOrder,
  progress = spawnOrder,
  hp = 100,
  x = 2.5,
  y = 0.5,
  isBoss = false,
} = {}) {
  return {
    id,
    spawnOrder,
    progress,
    hp,
    maxHp: hp,
    x,
    y,
    isBoss,
    defenseType: 'normal',
    statuses: {},
    dead: false,
    reachedCore: false,
  };
}

function runtimeState(heroes, enemies, draws = []) {
  let drawIndex = 0;
  return {
    tick: 41,
    heroes,
    enemies: new Map(enemies.map((enemy) => [enemy.id, enemy])),
    rng: {
      next() {
        const value = draws[drawIndex] ?? 0.99;
        drawIndex += 1;
        return value;
      },
      int(maximum) {
        return Math.min(maximum - 1, Math.floor(this.next() * maximum));
      },
    },
    core: { durability: 10, maxDurability: 10 },
    wave: { previousCoreDamaged: false },
    events: [],
    get rngDrawCount() { return drawIndex; },
  };
}

test('battle action comparator fixes tick, slot, skill/basic, then target spawn order', () => {
  const actions = [
    { label: 'slot-1', tick: 4, slot: 1, actionKind: 'skill', targetSpawnOrder: 1, target: { id: 'a' } },
    { label: 'basic', tick: 4, slot: 0, actionKind: 'basic', targetSpawnOrder: 1, target: { id: 'b' } },
    { label: 'target-2', tick: 4, slot: 0, actionKind: 'skill', targetSpawnOrder: 2, target: { id: 'c' } },
    { label: 'target-1', tick: 4, slot: 0, actionKind: 'skill', targetSpawnOrder: 1, target: { id: 'd' } },
    { label: 'prior-tick', tick: 3, slot: 4, actionKind: 'basic', targetSpawnOrder: 9, target: { id: 'e' } },
  ];
  assert.deepEqual(
    actions.sort(actionPriority).map(({ label }) => label),
    ['prior-tick', 'target-1', 'target-2', 'basic', 'slot-1'],
  );
});

test('all low-HP targets are locked before resolution and later actions never retarget', () => {
  const lateSlot = runtimeHero({ id: 'late', slot: 1 });
  const earlySlot = runtimeHero({ id: 'early', slot: 0 });
  const fallback = runtimeEnemy({ id: 'fallback', spawnOrder: 2, progress: 8, hp: 100 });
  const doomed = runtimeEnemy({ id: 'doomed', spawnOrder: 1, progress: 9, hp: 1 });
  const state = runtimeState([lateSlot, earlySlot], [fallback, doomed]);

  const actions = createBattleActions(state, 0);
  assert.deepEqual(
    actions.map(({ source, actionKind }) => `${source.id}:${actionKind}`),
    ['early:skill', 'early:basic', 'late:skill', 'late:basic'],
  );
  assert.deepEqual(actions.map(({ target }) => target.id), ['doomed', 'doomed', 'doomed', 'doomed']);

  resolveBattleActions(state, actions);
  assert.equal(doomed.dead, true);
  assert.equal(doomed.hp, 0);
  assert.equal(fallback.hp, 100, 'later actions are spent on their locked target instead of retargeting');
  assert.deepEqual(
    state.events.filter(({ actionKind }) => actionKind).map(({ sourceId, actionKind, targetId }) => (
      `${sourceId}:${actionKind}:${targetId}`
    )),
    [
      'early:skill:doomed',
      'early:basic:doomed',
      'late:skill:doomed',
      'late:basic:doomed',
    ],
  );
});

test('skill readiness does not reset or consume the independent basic timer', () => {
  const hero = runtimeHero({ id: 'independent', attackTimer: 0.75, skillTimer: 0 });
  const target = runtimeEnemy({ id: 'target', spawnOrder: 1 });
  const state = runtimeState([hero], [target]);
  const action = createSkillAction(state, hero, 0.25);

  assert.equal(action.actionKind, 'skill');
  assert.equal(hero.attackTimer, 0.75);
  assert.equal(hero.skillTimer, 5);
  resolveSkillAction(state, action);
  assert.equal(hero.attackTimer, 0.75);
});

test('area impacts and per-target status RNG resolve in ascending spawn order', () => {
  const hero = runtimeHero({
    id: 'area-caster',
    attackTimer: 99,
    skillShape: 'area',
    skillEffects: [{ type: 'apply_status', statusId: 'slow', chance: 0.5 }],
  });
  const spawn3 = runtimeEnemy({ id: 'spawn-3', spawnOrder: 3, progress: 30, x: 2.5, y: 0.5 });
  const spawn2 = runtimeEnemy({ id: 'spawn-2', spawnOrder: 2, progress: 20, x: 2.4, y: 0.7 });
  const spawn1 = runtimeEnemy({ id: 'spawn-1', spawnOrder: 1, progress: 10, x: 2.3, y: 0.3 });
  const state = runtimeState(
    [hero],
    [spawn3, spawn2, spawn1],
    [0.99, 0.40, 0.99, 0.60, 0.99, 0.30],
  );

  const action = createSkillAction(state, hero, 0);
  assert.equal(action.target.id, 'spawn-3', 'primary targeting still prioritizes path progress');
  assert.deepEqual(action.impacts.map(({ target }) => target.id), ['spawn-1', 'spawn-2', 'spawn-3']);
  resolveSkillAction(state, action);

  const damageEvents = state.events.filter(({ effectPreset }) => effectPreset === 'skill_area_hit');
  assert.deepEqual(
    damageEvents.map(({ targetId }) => targetId),
    ['spawn-1', 'spawn-2', 'spawn-3'],
  );
  assert.equal(damageEvents.filter(({ suppressEffect }) => !suppressEffect).length, 1);
  assert.equal(damageEvents.find(({ suppressEffect }) => !suppressEffect).targetId, 'spawn-3');
  assert.ok(damageEvents.every(({ actionKind, attackArchetype }) => (
    actionKind === 'skill' && attackArchetype === 'area'
  )));
  assert.ok(state.events.filter(({ effectPreset }) => effectPreset === 'status_apply')
    .every(({ actionKind, attackArchetype }) => actionKind === 'skill' && attackArchetype === 'area'));
  assert.equal(Boolean(spawn1.statuses.slow), true);
  assert.equal(Boolean(spawn2.statuses.slow), false);
  assert.equal(Boolean(spawn3.statuses.slow), true);
  assert.equal(state.rngDrawCount, 6, 'each target consumes its critical roll then its status roll');
});

test('shotgun impacts preserve pellet independence while resolving by target spawn order', () => {
  const hero = runtimeHero({ id: 'shotgun', archetype: 'shotgun', attackTimer: 0, skillTimer: 99 });
  Object.assign(hero.definition.attack, {
    range: 4,
    damage: 10,
    spreadDegrees: [-12, 0, 12],
    normalCollisionRadius: 0.05,
    bossCollisionRadius: 0.05,
    statuses: [{ statusId: 'poison', chance: 0.5 }],
  });
  const point = (degrees) => ({
    x: 0.5 + Math.cos(degrees * Math.PI / 180) * 3,
    y: 0.5 + Math.sin(degrees * Math.PI / 180) * 3,
  });
  const spawn3 = runtimeEnemy({ id: 'pellet-left', spawnOrder: 3, progress: 10, ...point(-12) });
  const spawn2 = runtimeEnemy({ id: 'pellet-center', spawnOrder: 2, progress: 30, ...point(0) });
  const spawn1 = runtimeEnemy({ id: 'pellet-right', spawnOrder: 1, progress: 20, ...point(12) });
  const state = runtimeState(
    [hero],
    [spawn3, spawn1, spawn2],
    [0.99, 0.40, 0.99, 0.60, 0.99, 0.30],
  );

  const action = createBasicAttackAction(state, hero, 0);
  assert.equal(action.target.id, 'pellet-center');
  assert.deepEqual(
    action.impacts.map(({ target, pelletIndex }) => `${target.id}:${pelletIndex}`),
    ['pellet-right:2', 'pellet-center:1', 'pellet-left:0'],
  );
  resolveBasicAttackAction(state, action);

  const trailEvents = state.events.filter(({ visualOnly }) => visualOnly);
  assert.equal(trailEvents.length, 3);
  assert.deepEqual(trailEvents.map(({ pelletIndex }) => pelletIndex), [0, 1, 2]);
  assert.ok(trailEvents.every(({ actionKind, attackArchetype }) => (
    actionKind === 'basic' && attackArchetype === 'shotgun'
  )));
  const damageEvents = state.events.filter(({ effectPreset, visualOnly }) => (
    effectPreset === 'basic_shotgun_hit' && !visualOnly
  ));
  assert.deepEqual(
    damageEvents.map(({ targetId }) => targetId),
    ['pellet-right', 'pellet-center', 'pellet-left'],
  );
  assert.deepEqual(damageEvents.map(({ pelletIndex }) => pelletIndex), [2, 1, 0]);
  assert.ok(damageEvents.every(({ suppressEffect }) => suppressEffect));
  assert.ok(damageEvents.every(({ sourceX, sourceY }) => sourceX === 0.5 && sourceY === 0.5));
  assert.deepEqual(
    damageEvents.map(({ vectorX, vectorY }) => [Math.sign(vectorX), Math.sign(vectorY)]),
    [[1, 1], [1, 0], [1, -1]],
  );
  assert.equal(Boolean(spawn1.statuses.poison), true);
  assert.equal(Boolean(spawn2.statuses.poison), false);
  assert.equal(Boolean(spawn3.statuses.poison), true);
  assert.equal(state.rngDrawCount, 6, 'each pellet consumes its critical roll then its own status roll');
});

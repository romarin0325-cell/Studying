import assert from 'node:assert/strict';
import test from 'node:test';

import { BattleSession } from '../../js/battle/BattleSession.js';
import { HEROES, MAIN_HEROES, NORMAL_HEROES } from '../../js/content/heroes.js';
import { BATTLE_PHASE, FIXED_TICK_SECONDS } from '../../js/core/enums.js';

const MAX_ACTION_TICKS = 60 * 20;

function traitsAtLevel(hero, level) {
  return hero.traits.filter((trait) => trait.level === level);
}

function enumerateFinalTraitBuilds() {
  return HEROES.flatMap((hero) => {
    const level4 = traitsAtLevel(hero, 4);
    const level6 = traitsAtLevel(hero, 6);
    assert.equal(level4.length, 2, `${hero.id}: expected two Lv4 choices`);
    assert.equal(level6.length, 2, `${hero.id}: expected two Lv6 choices`);
    return level4.flatMap((lv4) => level6.map((lv6) => ({
      hero,
      lv4: lv4.id,
      lv6: lv6.id,
    })));
  });
}

function formationContaining(hero) {
  if (hero.position === 'main') {
    return {
      mainId: hero.id,
      heroIds: NORMAL_HEROES.slice(0, 4).map(({ id }) => id),
    };
  }
  return {
    mainId: MAIN_HEROES[0].id,
    heroIds: [
      hero.id,
      ...NORMAL_HEROES.filter(({ id }) => id !== hero.id).slice(0, 3).map(({ id }) => id),
    ],
  };
}

function levelToFinalBuild(session, heroId, { lv4, lv6 }, label) {
  // Grant only the five crystals needed by this runtime fixture; every level
  // and trait selection still travels through BattleSession's command path.
  session.state.crystals = 5;
  for (let nextLevel = 2; nextLevel <= 6; nextLevel += 1) {
    const traitId = nextLevel === 4 ? lv4 : nextLevel === 6 ? lv6 : null;
    assert.equal(
      session.applyNow('level_up', { heroId, traitId }),
      true,
      `${label}: level-up to Lv${nextLevel}`,
    );
  }
  const hero = session.state.heroes.find(({ id }) => id === heroId);
  assert.equal(hero.level, 6, `${label}: final level`);
  assert.deepEqual(hero.selectedTraits, { lv4, lv6 }, `${label}: selected traits`);
  assert.equal(session.state.crystals, 0, `${label}: crystal spend`);
  return hero;
}

function assertFiniteRuntime(session, label) {
  const finite = (value, field) => assert.ok(
    Number.isFinite(value),
    `${label}: ${field} must be finite, received ${value}`,
  );
  const { state } = session;
  finite(state.tick, 'tick');
  finite(state.elapsedSeconds, 'elapsedSeconds');
  finite(state.core.durability, 'core.durability');
  finite(state.crystals, 'crystals');
  for (const hero of state.heroes) {
    finite(hero.level, `${hero.id}.level`);
    finite(hero.attackTimer, `${hero.id}.attackTimer`);
    finite(hero.skillTimer, `${hero.id}.skillTimer`);
    finite(hero.stats.damage, `${hero.id}.stats.damage`);
    finite(hero.stats.kills, `${hero.id}.stats.kills`);
    finite(hero.stats.basicAttacks, `${hero.id}.stats.basicAttacks`);
    finite(hero.stats.skills, `${hero.id}.stats.skills`);
  }
  for (const enemy of state.enemies.values()) {
    finite(enemy.hp, `${enemy.id}.hp`);
    finite(enemy.maxHp, `${enemy.id}.maxHp`);
    finite(enemy.x, `${enemy.id}.x`);
    finite(enemy.y, `${enemy.id}.y`);
    finite(enemy.progress, `${enemy.id}.progress`);
    for (const [statusId, status] of Object.entries(enemy.statuses ?? {})) {
      finite(status.remaining, `${enemy.id}.${statusId}.remaining`);
      if (status.stacks !== undefined) finite(status.stacks, `${enemy.id}.${statusId}.stacks`);
    }
  }
}

test('all 10 heroes execute all four final trait builds through the battle runtime', (context) => {
  const builds = enumerateFinalTraitBuilds();
  assert.equal(HEROES.length, 10);
  assert.equal(builds.length, 40, '10 heroes × (2 Lv4 × 2 Lv6) must produce 40 builds');
  assert.equal(
    new Set(builds.map(({ hero, lv4, lv6 }) => `${hero.id}:${lv4}:${lv6}`)).size,
    40,
    'every final build must be unique',
  );

  const executionByHero = new Map(HEROES.map(({ id }) => [id, {
    builds: 0,
    basicAttacks: 0,
    skills: 0,
  }]));

  for (const { hero: definition, lv4, lv6 } of builds) {
    const label = `${definition.id}/${lv4}+${lv6}`;
    const session = new BattleSession({
      stageId: 'ancient_ruins',
      difficultyId: 'easy',
      formation: formationContaining(definition),
      seed: `trait-matrix:${label}`,
    });
    const hitEvents = [];
    try {
      const hero = levelToFinalBuild(session, definition.id, { lv4, lv6 }, label);
      assert.equal(session.applyNow('auto_place'), true, `${label}: auto-place`);
      assert.equal(session.applyNow('start_wave'), true, `${label}: start wave`);

      let ticks = 0;
      while (
        session.state.phase === BATTLE_PHASE.WAVE_RUNNING
        && (hero.stats.basicAttacks === 0 || hero.stats.skills === 0)
        && ticks < MAX_ACTION_TICKS
      ) {
        session.step(FIXED_TICK_SECONDS);
        hitEvents.push(...session.consumeVisualEvents().filter((event) => (
          event.type === 'hit' && event.sourceId === definition.id
        )));
        assertFiniteRuntime(session, label);
        ticks += 1;
      }

      assert.ok(ticks < MAX_ACTION_TICKS, `${label}: action execution timed out`);
      assert.ok(hero.stats.basicAttacks > 0, `${label}: basic attack was not recorded`);
      assert.ok(hero.stats.skills > 0, `${label}: skill was not recorded`);
      assert.ok(hero.stats.damage > 0, `${label}: resolved actions dealt no damage`);
      assert.ok(
        hitEvents.some(({ actionKind }) => actionKind === 'basic'),
        `${label}: no resolved basic hit event`,
      );
      assert.ok(
        hitEvents.some(({ actionKind }) => actionKind === 'skill'),
        `${label}: no resolved skill hit event`,
      );
      assert.deepEqual(hero.selectedTraits, { lv4, lv6 }, `${label}: traits remained active`);

      const execution = executionByHero.get(definition.id);
      execution.builds += 1;
      execution.basicAttacks += hero.stats.basicAttacks;
      execution.skills += hero.stats.skills;
    } finally {
      session.destroy();
    }
  }

  assert.deepEqual([...executionByHero.keys()], HEROES.map(({ id }) => id));
  for (const [heroId, execution] of executionByHero) {
    assert.equal(execution.builds, 4, `${heroId}: all four builds executed`);
    assert.ok(execution.basicAttacks >= 4, `${heroId}: aggregate basic attacks`);
    assert.ok(execution.skills >= 4, `${heroId}: aggregate skills`);
  }
  context.diagnostic(`TRAIT_MATRIX ${JSON.stringify(Object.fromEntries(executionByHero))}`);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { createBattleState } from '../../js/battle/BattleState.js';
import { recomputeAuras } from '../../js/battle/systems/AuraSystem.js';
import { getAttackInterval } from '../../js/battle/systems/BasicAttackSystem.js';
import {
  applyPoisonDamage,
  calculateDirectDamage,
} from '../../js/battle/systems/DamageSystem.js';
import { damageCore } from '../../js/battle/systems/MovementSystem.js';
import { autoPlaceHeroes } from '../../js/battle/systems/PlacementSystem.js';
import { getSkillCooldown } from '../../js/battle/systems/SkillSystem.js';
import { applyStatus } from '../../js/battle/systems/StatusSystem.js';
import { completeWave, startWave } from '../../js/battle/systems/WaveSystem.js';

const FORMATION = Object.freeze({
  mainId: 'rumi',
  heroIds: Object.freeze(['snow_rabbit', 'avalanche_maid', 'night_rabbit', 'guardian']),
});

function makeState({
  formation = FORMATION,
  seed = 'trait-interactions',
} = {}) {
  return createBattleState({
    stageId: 'ancient_ruins',
    difficultyId: 'easy',
    formation: {
      mainId: formation.mainId,
      heroIds: [...formation.heroIds],
    },
    seed,
  });
}

function heroById(state, heroId) {
  const hero = state.heroes.find(({ id }) => id === heroId);
  assert.ok(hero, `formation must contain ${heroId}`);
  return hero;
}

function selectTrait(state, heroId, level, traitId) {
  const hero = heroById(state, heroId);
  assert.ok(
    hero.definition.traits.some((trait) => trait.id === traitId && trait.level === level),
    `${traitId} must be a real Lv${level} ${heroId} trait`,
  );
  hero.level = Math.max(hero.level, level);
  hero.selectedTraits[`lv${level}`] = traitId;
  return hero;
}

function enemyTarget(overrides = {}) {
  return {
    id: 'acceptance_target',
    element: 'nature',
    defenseType: 'normal',
    isBoss: false,
    hp: 10_000,
    maxHp: 10_000,
    x: 5.5,
    y: 5.5,
    statuses: {},
    dead: false,
    ...overrides,
  };
}

const fixedRoll = (value) => ({ next: () => value });

function directResult(state, source, target, attackKind, roll = 0.99) {
  const definition = attackKind === 'skill' ? source.definition.skill : source.definition.attack;
  return calculateDirectDamage({
    state,
    source,
    target,
    baseDamage: definition.damage,
    attackType: definition.attackType,
    attackKind,
    rng: fixedRoll(roll),
  });
}

function finishCurrentWaveWithoutCoreDamage(state) {
  state.wave.spawnIndex = state.wave.spawnQueue.length;
  assert.equal(state.registry.activeEnemyCount(), 0);
  assert.equal(completeWave(state), true);
}

test('two selected Rabbit Hole providers add exactly one +20 percentage-point team critical bonus', () => {
  const state = makeState({ seed: 'rabbit-hole-dedupe' });
  autoPlaceHeroes(state);
  const snowRabbit = selectTrait(state, 'snow_rabbit', 6, 'snow_rabbit_rabbit_hole');
  selectTrait(state, 'night_rabbit', 6, 'night_rabbit_rabbit_hole');
  const target = enemyTarget();

  const belowThirtyPercent = directResult(state, snowRabbit, target, 'basic', 0.299);
  const aboveThirtyPercent = directResult(state, snowRabbit, target, 'basic', 0.301);

  assert.equal(belowThirtyPercent.critical, true, 'base 10% + one Rabbit Hole 20% reaches 30%');
  assert.equal(
    aboveThirtyPercent.critical,
    false,
    'a second same-name provider must not raise the threshold above 30%',
  );
});

test('Moon Bless and Quick Service independently modify basic interval and skill cooldown', () => {
  const state = makeState({ seed: 'moon-quick-independent' });
  autoPlaceHeroes(state);
  selectTrait(state, 'rumi', 4, 'rumi_moon_form');
  const avalancheMaid = selectTrait(
    state,
    'avalanche_maid',
    4,
    'avalanche_maid_quick_service',
  );
  recomputeAuras(state);

  assert.equal(avalancheMaid.buffs.has('moon_bless'), true);
  assert.equal(
    getAttackInterval(state, avalancheMaid),
    avalancheMaid.definition.attack.interval * 0.85,
    'Moon Bless changes only the basic-attack timer',
  );
  assert.equal(
    getSkillCooldown(state, avalancheMaid),
    avalancheMaid.definition.skill.cooldown * 0.80,
    'Quick Service changes only the skill timer',
  );
});

test('Rumi Dream Form generically raises an allied aura provider by one range tier', () => {
  const state = makeState({ seed: 'dream-form-generic-aura' });
  const rumi = heroById(state, 'rumi');
  const guardian = selectTrait(state, 'guardian', 6, 'guardian_battlefield');
  const target = heroById(state, 'avalanche_maid');

  for (const hero of state.heroes) hero.placed = false;
  Object.assign(rumi, { placed: true, x: 0, y: 1 });
  Object.assign(guardian, { placed: true, x: 0, y: 0 });
  Object.assign(target, { placed: true, x: 5, y: 0 });

  recomputeAuras(state);
  assert.equal(target.buffs.has('earth_bless'), false, 'Guardian range 4 cannot reach five cells');

  selectTrait(state, 'rumi', 6, 'rumi_dream_form');
  recomputeAuras(state);
  assert.equal(target.buffs.has('earth_bless'), true);
  assert.equal(target.buffs.get('earth_bless').range, 6, 'Dream Form advances 4 -> 6');
  assert.deepEqual([...target.buffs.get('earth_bless').sources], ['guardian']);
});

test('Revenge Thunder applies to next-wave basic and skill direct damage only, then expires', () => {
  const state = makeState({
    formation: {
      mainId: 'luna',
      heroIds: ['lightning_sage', 'snow_rabbit', 'avalanche_maid', 'guardian'],
    },
    seed: 'revenge-thunder-next-wave',
  });
  autoPlaceHeroes(state);
  const lightningSage = selectTrait(
    state,
    'lightning_sage',
    6,
    'lightning_sage_revenge_thunder',
  );

  assert.equal(startWave(state), true);
  assert.equal(damageCore(state, 1), 1);
  finishCurrentWaveWithoutCoreDamage(state);
  assert.equal(state.nextWaveFlags.coreDamagedPreviousWave, true);
  assert.equal(state.wave.previousCoreDamaged, true);

  assert.equal(startWave(state), true);
  const target = enemyTarget();
  assert.equal(directResult(state, lightningSage, target, 'basic').factors.traitMultiplier, 2);
  assert.equal(directResult(state, lightningSage, target, 'skill').factors.traitMultiplier, 2);

  const poisonTarget = enemyTarget({ id: 'poison_target', hp: 100, maxHp: 100 });
  assert.equal(applyPoisonDamage(state, poisonTarget, 9), 9);
  assert.equal(poisonTarget.hp, 91, 'the next-wave direct-damage flag must not multiply poison');

  finishCurrentWaveWithoutCoreDamage(state);
  assert.equal(state.nextWaveFlags.coreDamagedPreviousWave, false);
  assert.equal(state.wave.previousCoreDamaged, false);
  assert.equal(startWave(state), true);
  assert.equal(
    directResult(state, lightningSage, enemyTarget(), 'basic').factors.traitMultiplier,
    1,
    'Revenge Thunder expires after exactly the following wave',
  );
});

test('World Shield reduces one real core reach hit from 1 durability to 0.5', () => {
  const state = makeState({ seed: 'world-shield-core' });
  autoPlaceHeroes(state);
  selectTrait(state, 'guardian', 4, 'guardian_world_shield');
  assert.equal(startWave(state), true);

  assert.equal(damageCore(state, 1), 0.5);
  assert.equal(state.core.durability, 9.5);
  assert.equal(state.wave.currentCoreDamaged, true);
});

test('Darkness increases direct damage by 25% but leaves fixed poison damage unchanged', () => {
  const state = makeState({ seed: 'darkness-direct-only' });
  autoPlaceHeroes(state);
  const source = heroById(state, 'guardian');
  const target = enemyTarget({ hp: 100, maxHp: 100 });
  const baseline = directResult(state, source, target, 'basic');

  assert.equal(applyStatus(target, 'darkness'), true);
  const darkened = directResult(state, source, target, 'basic');
  assert.equal(darkened.factors.debuffBonus, 0.25);
  assert.equal(darkened.amount, baseline.amount * 1.25);

  assert.equal(applyPoisonDamage(state, target, 9), 9);
  assert.equal(target.hp, 91, 'Darkness does not modify poison tick damage');
});

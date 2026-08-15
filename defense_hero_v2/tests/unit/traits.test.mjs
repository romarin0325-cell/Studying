import assert from 'node:assert/strict';
import test from 'node:test';

import { SeededRng } from '../../js/core/SeededRng.js';
import {
  CONDITION_TYPE_IDS,
  OPERATION_TYPE_IDS,
} from '../../js/content/effects.js';
import {
  HEROES,
  HERO_TRAITS,
} from '../../js/content/heroes.js';
import { CONDITION_REGISTRY } from '../../js/battle/effects/ConditionRegistry.js';
import {
  createModifierAccumulator,
  OPERATION_REGISTRY,
} from '../../js/battle/effects/OperationRegistry.js';
import {
  compileTraits,
  evaluateTraitHook,
} from '../../js/battle/effects/TraitCompiler.js';

const TEAM_EFFECT_TYPES = new Set(['add_team_crit_chance']);

function walkData(value, visit, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  visit(value);
  for (const child of Object.values(value)) walkData(child, visit, seen);
}

function runtimeHero(hero, selectedTraits) {
  return {
    id: hero.id,
    definition: hero,
    selectedTraits,
    buffs: new Map(),
    placed: true,
  };
}

function contextFor(source, overrides = {}) {
  return {
    state: {
      core: { durability: 10, maxDurability: 10 },
      wave: { previousCoreDamaged: false },
      heroes: [source],
    },
    source,
    target: {
      element: 'nature',
      defenseType: 'normal',
      isBoss: false,
      statuses: {},
    },
    attackKind: 'basic',
    rng: new SeededRng('trait-test'),
    ...overrides,
  };
}

test('all ten heroes expose exactly two Lv4 and two Lv6 generic trait choices', () => {
  assert.equal(HEROES.length, 10);
  assert.equal(HERO_TRAITS.length, 40);
  assert.equal(HERO_TRAITS.filter(({ level }) => level === 4).length, 20);
  assert.equal(HERO_TRAITS.filter(({ level }) => level === 6).length, 20);
  assert.equal(new Set(HERO_TRAITS.map(({ id }) => id)).size, 40);

  for (const hero of HEROES) {
    assert.equal(hero.traits.length, 4, hero.id);
    assert.equal(hero.traits.filter(({ level }) => level === 4).length, 2, `${hero.id} Lv4`);
    assert.equal(hero.traits.filter(({ level }) => level === 6).length, 2, `${hero.id} Lv6`);
    for (const trait of hero.traits) {
      assert.equal(typeof trait.id, 'string');
      assert.ok(trait.id.length > 0);
      assert.equal(typeof trait.name, 'string');
      assert.ok(Array.isArray(trait.conditions));
      assert.ok(Array.isArray(trait.effects));
      assert.ok(trait.effects.length > 0);
    }
  }
});

test('trait data is deeply frozen, function-free and covered by generic registries', () => {
  walkData(HEROES, (value) => assert.ok(Object.isFrozen(value)));
  const inspect = (value) => {
    if (typeof value === 'function') assert.fail('content data must not embed runtime functions');
    if (value && typeof value === 'object') {
      for (const child of Object.values(value)) inspect(child);
    }
  };
  inspect(HEROES);

  const conditionTypes = new Set();
  const effectTypes = new Set();
  for (const hero of HEROES) {
    for (const trait of hero.traits) {
      for (const condition of trait.conditions) conditionTypes.add(condition.type);
      for (const effect of trait.effects) effectTypes.add(effect.type);
    }
    for (const effect of hero.skill.onHitEffects ?? []) effectTypes.add(effect.type);
  }

  for (const type of conditionTypes) {
    assert.ok(CONDITION_TYPE_IDS.includes(type), `undeclared condition ${type}`);
    assert.equal(typeof CONDITION_REGISTRY[type], 'function', `uncompiled condition ${type}`);
  }
  for (const type of effectTypes) {
    assert.ok(OPERATION_TYPE_IDS.includes(type), `undeclared effect ${type}`);
    assert.ok(
      typeof OPERATION_REGISTRY[type] === 'function' || TEAM_EFFECT_TYPES.has(type),
      `uncompiled effect ${type}`,
    );
  }
});

test('all forty Lv4/Lv6 hero build combinations compile without character-specific dispatch', () => {
  let combinationCount = 0;
  const observedTraitIds = new Set();
  for (const hero of HEROES) {
    const level4 = hero.traits.filter(({ level }) => level === 4);
    const level6 = hero.traits.filter(({ level }) => level === 6);
    for (const first of level4) {
      for (const second of level6) {
        const source = runtimeHero(hero, { level4: first.id, level6: second.id });
        const compiled = compileTraits(source);
        assert.deepEqual(compiled.map(({ id }) => id), [first.id, second.id]);
        assert.ok(compiled.every(({ conditions, effects }) => Array.isArray(conditions) && Array.isArray(effects)));
        compiled.forEach(({ id }) => observedTraitIds.add(id));
        combinationCount += 1;
      }
    }
  }
  assert.equal(combinationCount, 40);
  assert.equal(observedTraitIds.size, 40);
});

test('representative conditions and effects execute through the shared trait compiler', () => {
  const lunaDefinition = HEROES.find(({ id }) => id === 'luna');
  const luna = runtimeHero(lunaDefinition, {
    level4: 'luna_assassin_nail',
    level6: 'luna_evil_eye',
  });
  const darkTarget = {
    element: 'nature',
    defenseType: 'air',
    isBoss: false,
    statuses: { darkness: { remaining: 5, debuff: true } },
  };
  const lunaModifier = evaluateTraitHook(
    luna,
    'before_damage',
    contextFor(luna, { target: darkTarget }),
    createModifierAccumulator(),
  );
  assert.equal(lunaModifier.damageMultiplier, 2);
  assert.equal(lunaModifier.matchupFloor, 1);

  const lightningDefinition = HEROES.find(({ id }) => id === 'lightning_sage');
  const lightning = runtimeHero(lightningDefinition, { level6: 'lightning_sage_chain_judgment' });
  const debuffedTarget = {
    element: 'dark',
    defenseType: 'normal',
    statuses: {
      slow: { remaining: 4, debuff: true },
      poison: { remaining: 4, debuff: true, stacks: 3 },
      stun_immunity: { remaining: 2, debuff: false, internal: true },
    },
  };
  const chainModifier = evaluateTraitHook(
    lightning,
    'before_damage',
    contextFor(lightning, { target: debuffedTarget }),
    createModifierAccumulator(),
  );
  assert.equal(chainModifier.damageMultiplier, 2, 'two unique debuff names add 50% each');

  const rumiDefinition = HEROES.find(({ id }) => id === 'rumi');
  const rumi = runtimeHero(rumiDefinition, { level4: 'rumi_star_form' });
  const auraModifier = evaluateTraitHook(
    rumi,
    'provide_aura',
    contextFor(rumi),
    createModifierAccumulator(),
  );
  assert.deepEqual(auraModifier.auras, [{ buffId: 'star_powder', range: 8 }]);
});

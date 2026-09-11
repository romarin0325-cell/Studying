import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ATTACK_FAMILIES,
  ATTACK_TYPE_IDS,
  COMBAT_RULES,
  DEFENSE_TYPE_IDS,
  DIFFICULTIES,
  LEVEL_DAMAGE_MULTIPLIERS,
  MATCHUP_TABLE,
  TOTAL_DREAM_CRYSTALS,
  WAVE_REWARDS,
} from '../../js/content/combat.js';
import {
  applyDirectDamage,
  calculateDirectDamage,
  getMatchupMultiplier,
} from '../../js/battle/systems/DamageSystem.js';
import { DISPLAY_EVENT_CONTRACT } from '../../js/content/effects.js';

const EXPECTED_MATCHUPS = Object.freeze({
  normal: Object.freeze([1, 1, 1, 1, 1, 1]),
  air: Object.freeze([0.75, 2, 0.5, 0.5, 0.5, 0.5]),
  heavy: Object.freeze([1, 0.75, 1, 2, 1, 1]),
  regeneration: Object.freeze([1, 1, 1, 1, 2, 1]),
  demon: Object.freeze([1, 1, 1, 1, 0.75, 2]),
  boss: Object.freeze([1, 0.75, 2, 0.75, 0.75, 0.75]),
});

const closeTo = (actual, expected, epsilon = 1e-12) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
};

function assertDeepFrozen(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

test('the complete 6x6 attack/defense matchup table matches the specification', () => {
  assert.deepEqual(ATTACK_TYPE_IDS, ['normal', 'anti_air', 'lethal', 'magic', 'flame', 'holy']);
  assert.deepEqual(DEFENSE_TYPE_IDS, ['normal', 'air', 'heavy', 'regeneration', 'demon', 'boss']);
  assert.deepEqual(ATTACK_FAMILIES, {
    physical: ['normal', 'anti_air', 'lethal'],
    magical: ['magic', 'flame', 'holy'],
  });

  let checkedCells = 0;
  for (const defenseType of DEFENSE_TYPE_IDS) {
    const row = ATTACK_TYPE_IDS.map((attackType) => getMatchupMultiplier(attackType, defenseType));
    assert.deepEqual(row, EXPECTED_MATCHUPS[defenseType], defenseType);
    checkedCells += row.length;
  }
  assert.equal(checkedCells, 36);
  assert.throws(() => getMatchupMultiplier('unknown', 'normal'), /Missing matchup/);
});

test('direct damage applies level, matchup, additive buffs/debuffs, traits and critical in the declared order', () => {
  const source = {
    id: 'generic_source',
    level: 3,
    placed: true,
    buffs: new Map([
      ['sun_bless', { sources: new Set(['provider-a']) }],
      ['earth_bless', { sources: new Set(['provider-b']) }],
    ]),
    stats: { damage: 0, kills: 0 },
    selectedTraits: { level4: 'generic_damage_trait' },
    definition: {
      tags: [],
      attack: { archetype: 'melee' },
      traits: [{
        id: 'generic_damage_trait',
        level: 4,
        name: 'generic',
        conditions: [],
        effects: [{ type: 'multiply_damage', value: 1.5 }],
      }],
    },
  };
  const target = {
    defenseType: 'air',
    statuses: {
      corrosion: { remaining: 5, debuff: true },
      darkness: { remaining: 3, debuff: true },
    },
  };
  const state = {
    heroes: [source],
    core: { durability: 10, maxDurability: 10 },
    wave: { previousCoreDamaged: false },
    rng: { next: () => 0.99 },
  };

  const result = calculateDirectDamage({
    state,
    source,
    target,
    baseDamage: 100,
    attackType: 'normal',
    attackKind: 'basic',
    forceCritical: true,
  });

  assert.equal(result.critical, true);
  assert.deepEqual(result.factors, {
    levelMultiplier: 1.2,
    matchup: 0.75,
    buffBonus: 0.4,
    debuffBonus: 0.5,
    traitMultiplier: 1.5,
    critMultiplier: 2,
  });
  closeTo(result.amount, 100 * 1.2 * 0.75 * (1 + 0.4) * (1 + 0.5) * 1.5 * 2);
  closeTo(result.amount, 567);
});

test('level growth, crystal economy and difficulty availability are immutable fixed rules', () => {
  assert.deepEqual(LEVEL_DAMAGE_MULTIPLIERS, {
    1: 1,
    2: 1.1,
    3: 1.2,
    4: 1.3,
    5: 1.4,
    6: 1.5,
  });
  assert.deepEqual(WAVE_REWARDS, [1, 1, 1, 1, 3, 2, 2, 2, 2, 0]);
  assert.equal(WAVE_REWARDS.reduce((sum, reward) => sum + reward, 0), 15);
  assert.equal(TOTAL_DREAM_CRYSTALS, 15);
  assert.deepEqual(DIFFICULTIES.map(({ id, selectable }) => ({ id, selectable })), [
    { id: 'easy', selectable: true },
    { id: 'normal', selectable: false },
    { id: 'hard', selectable: false },
  ]);
  assertDeepFrozen(COMBAT_RULES);
  assertDeepFrozen(MATCHUP_TABLE);
  assertDeepFrozen(LEVEL_DAMAGE_MULTIPLIERS);
  assertDeepFrozen(WAVE_REWARDS);
  assertDeepFrozen(DIFFICULTIES);
});

test('skill hit and overlay display events preserve the complete action contract', () => {
  const source = {
    id: 'contract_source',
    x: 1,
    y: 2,
    level: 1,
    placed: true,
    buffs: new Map(),
    selectedTraits: {},
    stats: { damage: 0, kills: 0 },
    definition: {
      element: 'light',
      tags: [],
      traits: [],
      attack: { archetype: 'burst' },
      skill: { shape: 'area' },
    },
  };
  const target = {
    id: 'contract_target',
    x: 3.5,
    y: 4.5,
    hp: 100,
    defenseType: 'boss',
    statuses: {},
    dead: false,
  };
  const state = {
    heroes: [source],
    events: [],
    core: { durability: 10, maxDurability: 10 },
    wave: { previousCoreDamaged: false },
    rng: { next: () => 0.99 },
  };

  applyDirectDamage({
    state,
    source,
    target,
    baseDamage: 10,
    attackType: 'lethal',
    attackKind: 'skill',
    effectPreset: 'skill_area_hit',
    radius: 3,
    forceCritical: true,
  });

  assert.deepEqual(state.events.map(({ effectPreset }) => effectPreset), [
    'skill_area_hit',
    'critical_hit',
    'advantage_hit',
  ]);
  for (const event of state.events) {
    for (const field of DISPLAY_EVENT_CONTRACT.requiredFields) {
      assert.ok(Object.hasOwn(event, field), `${event.effectPreset}.${field}`);
    }
    assert.equal(event.actionKind, 'skill');
    assert.equal(event.attackArchetype, 'area');
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buffEffects,
  increaseAuraRange,
  recomputeAuras,
} from '../../js/battle/systems/AuraSystem.js';
import {
  applyStatus,
  hasStatus,
  updateStatuses,
} from '../../js/battle/systems/StatusSystem.js';
import { HERO_BY_ID } from '../../js/content/heroes.js';

function makeHero(id, x, y, {
  placed = true,
  auraBuffId = null,
  auraRange = 4,
} = {}) {
  const traitId = `${id}_aura`;
  return {
    id,
    x,
    y,
    placed,
    buffs: new Map(),
    selectedTraits: auraBuffId ? [traitId] : [],
    definition: {
      traits: auraBuffId ? [{
        id: traitId,
        conditions: [],
        effects: [{ type: 'provide_aura', buffId: auraBuffId, range: auraRange }],
      }] : [],
    },
  };
}

const auraState = (heroes) => ({
  heroes,
  rng: { next: () => 0.99 },
});

test('aura range upgrades follow 4 -> 6 -> 8 -> 10 and cap at the final tier', () => {
  assert.equal(increaseAuraRange(4), 6);
  assert.equal(increaseAuraRange(6), 8);
  assert.equal(increaseAuraRange(8), 10);
  assert.equal(increaseAuraRange(10), 10);
  assert.equal(increaseAuraRange(4, 3), 10);
  assert.equal(increaseAuraRange(6, 99), 10);
  assert.throws(() => increaseAuraRange(5), /Unsupported aura range/);
});

test('auras include their provider and Euclidean boundary, exclude unplaced heroes, and clear after provider removal', () => {
  const provider = makeHero('provider', 0, 0, { auraBuffId: 'earth_bless' });
  const boundary = makeHero('boundary', 4, 0);
  const outside = makeHero('outside', 4, 1);
  const unplaced = makeHero('unplaced', 1, 0, { placed: false });
  const state = auraState([provider, boundary, outside, unplaced]);

  recomputeAuras(state);
  assert.equal(provider.buffs.has('earth_bless'), true, 'the provider receives its own aura');
  assert.equal(boundary.buffs.has('earth_bless'), true, 'distance exactly equal to range is included');
  assert.equal(outside.buffs.has('earth_bless'), false, 'Euclidean distance beyond range is excluded');
  assert.equal(unplaced.buffs.has('earth_bless'), false, 'unplaced targets do not receive auras');

  provider.placed = false;
  recomputeAuras(state);
  assert.equal(provider.buffs.size, 0);
  assert.equal(boundary.buffs.size, 0, 'recomputation removes an aura whose provider is no longer placed');
});

test('same-name auras track every provider but apply their buff effects only once', () => {
  const providerA = makeHero('provider_a', 0, 0, { auraBuffId: 'earth_bless' });
  const providerB = makeHero('provider_b', 0, 1, { auraBuffId: 'earth_bless' });
  const target = makeHero('target', 3, 0);

  recomputeAuras(auraState([providerA, providerB, target]));

  assert.deepEqual([...target.buffs.keys()], ['earth_bless']);
  assert.deepEqual([...target.buffs.get('earth_bless').sources].sort(), ['provider_a', 'provider_b']);
  assert.deepEqual(buffEffects(target, 'direct_damage_bonus'), [
    { type: 'direct_damage_bonus', value: 0.20, combine: 'add' },
  ]);
});

test('Rumi dream form generically increases another hero aura from range 4 to range 6', () => {
  const rumi = {
    ...makeHero('rumi', 0, 1),
    definition: HERO_BY_ID.rumi,
    selectedTraits: [],
  };
  const guardian = {
    ...makeHero('guardian', 0, 0),
    definition: HERO_BY_ID.guardian,
    selectedTraits: ['guardian_battlefield'],
  };
  const target = makeHero('target', 5, 0);
  const state = auraState([rumi, guardian, target]);

  recomputeAuras(state);
  assert.equal(target.buffs.has('earth_bless'), false, 'range 4 does not reach a target five cells away');

  rumi.selectedTraits = ['rumi_dream_form'];
  recomputeAuras(state);
  assert.equal(target.buffs.has('earth_bless'), true, 'dream form raises the aura to range 6');
  assert.equal(target.buffs.get('earth_bless').range, 6);
});

test('non-stacking statuses keep the longer remaining duration when refreshed', () => {
  const target = { statuses: {} };
  const state = { enemies: new Map([['enemy', target]]) };

  assert.equal(applyStatus(target, 'slow'), true);
  updateStatuses(state, 4, () => assert.fail('slow must not deal poison damage'));
  assert.equal(target.statuses.slow.remaining, 6);

  applyStatus(target, 'slow', { duration: 2 });
  assert.equal(target.statuses.slow.remaining, 6);
  assert.equal(target.statuses.slow.stacks, 1);

  applyStatus(target, 'slow', { duration: 9 });
  assert.equal(target.statuses.slow.remaining, 9);
  assert.equal(Object.keys(target.statuses).length, 1);
});

test('poison refreshes duration, caps at three stacks, and ticks fixed damage per stack', () => {
  const target = { id: 'enemy', hp: 100, dead: false, statuses: {} };
  const state = { enemies: new Map([[target.id, target]]) };

  applyStatus(target, 'poison');
  updateStatuses(state, 4, () => {});
  assert.equal(target.statuses.poison.remaining, 6);

  applyStatus(target, 'poison');
  applyStatus(target, 'poison');
  applyStatus(target, 'poison');
  assert.equal(target.statuses.poison.stacks, 3);
  assert.equal(target.statuses.poison.remaining, 10, 'each application resets poison duration');

  const ticks = [];
  updateStatuses(state, 1, (enemy, amount) => ticks.push({ enemy, amount }));
  assert.equal(ticks.length, 1);
  assert.strictEqual(ticks[0].enemy, target);
  assert.equal(ticks[0].amount, 9);
  assert.equal(target.statuses.poison.remaining, 9);
  assert.equal(target.statuses.poison.tickRemaining, 1);
});

test('poison reapplication preserves the existing one-second tick cadence', () => {
  const target = { id: 'enemy', hp: 100, dead: false, statuses: {} };
  const state = { enemies: new Map([[target.id, target]]) };
  const ticks = [];

  applyStatus(target, 'poison');
  updateStatuses(state, 0.5, (enemy, amount) => ticks.push({ enemy, amount }));
  assert.equal(target.statuses.poison.tickRemaining, 0.5);
  applyStatus(target, 'poison');
  assert.equal(target.statuses.poison.tickRemaining, 0.5, 'refresh must not postpone the pending tick');
  updateStatuses(state, 0.5, (enemy, amount) => ticks.push({ enemy, amount }));
  assert.equal(ticks.length, 1);
  assert.equal(ticks[0].amount, 6, 'both stacks tick together on the original cadence');
});

test('expired stun grants two seconds of immunity and stun can be applied again afterward', () => {
  const target = { statuses: {} };
  const state = { enemies: new Map([['enemy', target]]) };

  assert.equal(applyStatus(target, 'stun'), true);
  updateStatuses(state, 1, () => {});
  assert.equal(hasStatus(target, 'stun'), false);
  assert.equal(hasStatus(target, 'stun_immunity'), true);
  assert.equal(target.statuses.stun_immunity.remaining, 2);
  assert.equal(applyStatus(target, 'stun'), false, 'stun immunity blocks a new stun');

  updateStatuses(state, 2, () => {});
  assert.equal(hasStatus(target, 'stun_immunity'), false);
  assert.equal(applyStatus(target, 'stun'), true);
});

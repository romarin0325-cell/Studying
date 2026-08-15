import { deepFreeze } from './combat.js';

export const AURA_RANGE_TIERS = deepFreeze([4, 6, 8, 10]);

export function increaseAuraRangeTier(range) {
  const index = AURA_RANGE_TIERS.indexOf(Number(range));
  if (index < 0) return null;
  return AURA_RANGE_TIERS[Math.min(index + 1, AURA_RANGE_TIERS.length - 1)];
}

export const BUFF_EFFECT_TYPE_IDS = deepFreeze([
  'attack_interval_multiplier',
  'physical_damage_bonus',
  'magic_damage_bonus',
  'direct_damage_bonus',
  'crit_chance_add',
  'crit_damage_add',
  'range_add',
  'skill_cooldown_multiplier',
]);

export const AURA_BUFF_DEFINITIONS = deepFreeze([
  {
    id: 'moon_bless',
    displayName: '달의축복',
    stacking: 'unique_by_id',
    effects: [{ type: 'attack_interval_multiplier', value: 0.85 }],
  },
  {
    id: 'sun_bless',
    displayName: '태양의축복',
    stacking: 'unique_by_id',
    effects: [
      { type: 'physical_damage_bonus', value: 0.20, combine: 'add' },
      { type: 'crit_damage_add', value: 0.50, combine: 'add_percentage_points' },
    ],
  },
  {
    id: 'earth_bless',
    displayName: '대지의축복',
    stacking: 'unique_by_id',
    effects: [{ type: 'direct_damage_bonus', value: 0.20, combine: 'add' }],
  },
  {
    id: 'twinkle_party',
    displayName: '트윙클파티',
    stacking: 'unique_by_id',
    effects: [{ type: 'crit_chance_add', value: 0.20, combine: 'add_percentage_points' }],
  },
  {
    id: 'sanctuary',
    displayName: '성역',
    stacking: 'unique_by_id',
    effects: [{ type: 'magic_damage_bonus', value: 0.30, combine: 'add' }],
  },
  {
    id: 'star_powder',
    displayName: '스타파우더',
    stacking: 'unique_by_id',
    effects: [{ type: 'range_add', value: 1, combine: 'add' }],
  },
  {
    id: 'gale',
    displayName: '질풍',
    stacking: 'unique_by_id',
    effects: [{ type: 'skill_cooldown_multiplier', value: 0.80, combine: 'multiply' }],
  },
]);

export const AURA_BUFF_BY_ID = deepFreeze(Object.fromEntries(
  AURA_BUFF_DEFINITIONS.map((definition) => [definition.id, definition]),
));
export const BUFFS = AURA_BUFF_DEFINITIONS;
export const BUFF_IDS = deepFreeze(BUFFS.map((definition) => definition.id));

export const AURA_RULES = deepFreeze({
  distance: 'euclidean',
  includeBoundary: true,
  includeProvider: true,
  providerMustBePlaced: true,
  recalculateAfterPlacementChange: true,
  sameIdStacks: false,
  differentDamageBuffsCombine: 'add',
  attackIntervalMultipliersCombine: 'multiply',
  skillCooldownMultipliersCombine: 'multiply',
  criticalChanceCombine: 'add_percentage_points',
  criticalDamageCombine: 'add_percentage_points',
  rangeCombine: 'add',
  teamTraitDedupe: 'trait_id',
  rangeTiers: AURA_RANGE_TIERS,
});

export default AURA_BUFF_DEFINITIONS;

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
    description: '공격 속도 15% 증가',
    color: '#b48cff',
    stacking: 'unique_by_id',
    effects: [{ type: 'attack_interval_multiplier', value: 0.85 }],
  },
  {
    id: 'sun_bless',
    displayName: '태양의축복',
    description: '물리 피해 +20%, 치명타 피해 +50%',
    color: '#ffb35c',
    stacking: 'unique_by_id',
    effects: [
      { type: 'physical_damage_bonus', value: 0.20, combine: 'add' },
      { type: 'crit_damage_add', value: 0.50, combine: 'add_percentage_points' },
    ],
  },
  {
    id: 'earth_bless',
    displayName: '대지의축복',
    description: '직접 피해 +20%',
    color: '#8fd97a',
    stacking: 'unique_by_id',
    effects: [{ type: 'direct_damage_bonus', value: 0.20, combine: 'add' }],
  },
  {
    id: 'twinkle_party',
    displayName: '트윙클파티',
    description: '치명타 확률 +20%p',
    color: '#ff9ec6',
    stacking: 'unique_by_id',
    effects: [{ type: 'crit_chance_add', value: 0.20, combine: 'add_percentage_points' }],
  },
  {
    id: 'sanctuary',
    displayName: '성역',
    description: '마법 피해 +30%',
    color: '#7cc6ff',
    stacking: 'unique_by_id',
    effects: [{ type: 'magic_damage_bonus', value: 0.30, combine: 'add' }],
  },
  {
    id: 'star_powder',
    displayName: '스타파우더',
    description: '사거리 +1',
    color: '#ffe27a',
    stacking: 'unique_by_id',
    effects: [{ type: 'range_add', value: 1, combine: 'add' }],
  },
  {
    id: 'gale',
    displayName: '질풍',
    description: '스킬 쿨다운 20% 감소',
    color: '#82f0d4',
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

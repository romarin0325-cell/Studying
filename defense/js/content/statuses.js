import { deepFreeze } from './combat.js';

export const STATUS_DEFINITIONS = deepFreeze([
  {
    id: 'slow',
    displayName: '감속',
    kind: 'debuff',
    debuff: true,
    duration: 10,
    durationSeconds: 10,
    slow_multiplier: 0.50,
    refresh: 'max_remaining',
    maximumStacks: 1,
    effects: [{ type: 'multiply_move_speed', value: 0.50 }],
  },
  {
    id: 'stun',
    displayName: '기절',
    kind: 'debuff',
    debuff: true,
    duration: 1,
    durationSeconds: 1,
    refresh: 'max_remaining',
    maximumStacks: 1,
    blockedByStatusId: 'stun_immunity',
    onExpire: [{ type: 'apply_status', statusId: 'stun_immunity', durationSeconds: 2 }],
    effects: [{ type: 'prevent_actions_and_movement' }],
  },
  {
    id: 'corrosion',
    displayName: '부식',
    kind: 'debuff',
    debuff: true,
    duration: 10,
    durationSeconds: 10,
    physical_damage_taken: 0.25,
    refresh: 'max_remaining',
    maximumStacks: 1,
    effects: [{ type: 'add_received_damage', family: 'physical', value: 0.25, combine: 'add' }],
  },
  {
    id: 'curse',
    displayName: '저주',
    kind: 'debuff',
    debuff: true,
    duration: 10,
    durationSeconds: 10,
    magic_damage_taken: 0.25,
    refresh: 'max_remaining',
    maximumStacks: 1,
    effects: [{ type: 'add_received_damage', family: 'magical', value: 0.25, combine: 'add' }],
  },
  {
    id: 'darkness',
    displayName: '암흑',
    kind: 'debuff',
    debuff: true,
    duration: 5,
    durationSeconds: 5,
    direct_damage_taken: 0.25,
    refresh: 'max_remaining',
    maximumStacks: 1,
    effects: [{ type: 'add_received_damage', damageKind: 'direct', value: 0.25, combine: 'add' }],
  },
  {
    id: 'poison',
    displayName: '중독',
    kind: 'debuff',
    debuff: true,
    duration: 10,
    durationSeconds: 10,
    poison_dps: 3,
    max_stacks: 3,
    refresh: 'reset_duration',
    stackOnApply: true,
    maximumStacks: 3,
    countsAsOneDebuffRegardlessOfStacks: true,
    effects: [{
      type: 'periodic_fixed_damage',
      damagePerStack: 3,
      tickIntervalSeconds: 1,
      affectedByDirectDamageModifiers: false,
      canCrit: false,
    }],
  },
  {
    id: 'stun_immunity',
    displayName: '기절 면역',
    kind: 'internal',
    debuff: false,
    duration: 2,
    durationSeconds: 2,
    refresh: 'max_remaining',
    maximumStacks: 1,
    countsAsDebuff: false,
    visible: false,
    effects: [{ type: 'block_status', statusId: 'stun' }],
  },
]);

export const STATUS_BY_ID = deepFreeze(Object.fromEntries(
  STATUS_DEFINITIONS.map((definition) => [definition.id, definition]),
));
export const STATUSES = STATUS_DEFINITIONS;

export const DEBUFF_DEFINITIONS = deepFreeze(
  STATUS_DEFINITIONS.filter((definition) => definition.kind === 'debuff'),
);

export const DEBUFF_IDS = deepFreeze(DEBUFF_DEFINITIONS.map((definition) => definition.id));

export const STATUS_RULES = deepFreeze({
  sameNameStacks: false,
  defaultRefresh: 'max_remaining',
  poisonDurationRefresh: 'reset_duration',
  poisonMaximumStacks: 3,
  poisonCountsAsOneDebuff: true,
  stunImmunitySeconds: 2,
  bossesUseStandardControlRulesOnEasy: true,
});

export default STATUS_DEFINITIONS;

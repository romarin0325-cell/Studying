import { countActiveDebuffs } from './ConditionRegistry.js';

export function createModifierAccumulator() {
  return {
    damageMultiplier: 1,
    critChanceAdd: 0,
    rangeAdd: 0,
    skillCooldownMultiplier: 1,
    attackIntervalMultiplier: 1,
    matchupFloor: 0,
    coreDamageMultiplier: 1,
    auraRangeTierIncreases: 0,
    statuses: [],
    auras: [],
    nextWaveFlags: [],
  };
}

export const OPERATION_REGISTRY = Object.freeze({
  multiply_damage(effect, accumulator) {
    accumulator.damageMultiplier *= Number(effect.value);
  },
  multiply_damage_by_debuff_count(effect, accumulator, context) {
    accumulator.damageMultiplier *= 1 + Number(effect.amountPerDebuff ?? 0) * countActiveDebuffs(context.target);
  },
  add_crit_chance(effect, accumulator) {
    accumulator.critChanceAdd += Number(effect.value);
  },
  add_range(effect, accumulator) {
    accumulator.rangeAdd += Number(effect.value);
  },
  multiply_skill_cooldown(effect, accumulator) {
    accumulator.skillCooldownMultiplier *= Number(effect.value);
  },
  multiply_attack_interval(effect, accumulator) {
    accumulator.attackIntervalMultiplier *= Number(effect.value);
  },
  apply_status(effect, accumulator) {
    accumulator.statuses.push({
      statusId: effect.statusId,
      duration: effect.duration ?? effect.durationSeconds,
      chance: effect.chance ?? 1,
      stacks: effect.stacks ?? 1,
    });
  },
  provide_aura(effect, accumulator) {
    accumulator.auras.push({ buffId: effect.buffId, range: Number(effect.range) });
  },
  increase_aura_range_tier(effect, accumulator) {
    accumulator.auraRangeTierIncreases += Number(effect.value ?? 1);
  },
  floor_matchup_multiplier(effect, accumulator) {
    accumulator.matchupFloor = Math.max(accumulator.matchupFloor, Number(effect.value));
  },
  multiply_core_damage(effect, accumulator) {
    accumulator.coreDamageMultiplier *= Number(effect.value);
  },
  random_damage_multiplier(effect, accumulator, context) {
    const choices = effect.choices ?? effect.values ?? [];
    if (!choices.length) return;
    const index = context.rng.int(choices.length);
    accumulator.damageMultiplier *= Number(choices[index]);
  },
  set_next_wave_flag(effect, accumulator) {
    accumulator.nextWaveFlags.push({ id: effect.flagId, value: effect.value ?? true });
  },
});

export function applyOperation(effect, accumulator, context) {
  const operation = OPERATION_REGISTRY[effect?.type];
  if (!operation) throw new RangeError(`Unknown trait operation: ${effect?.type}`);
  operation(effect, accumulator, context);
  return accumulator;
}

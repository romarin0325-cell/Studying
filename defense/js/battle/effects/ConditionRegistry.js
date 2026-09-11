const hasStatus = (target, statusId) => Boolean(target?.statuses?.[statusId]?.remaining > 0);
const activeDebuffNames = (target) => Object.entries(target?.statuses ?? {})
  .filter(([, status]) => status?.remaining > 0 && status.debuff !== false && status.internal !== true)
  .map(([id]) => id);

export const CONDITION_REGISTRY = Object.freeze({
  target_element: (condition, context) => context.target?.element === (condition.element ?? condition.value),
  target_defense_type: (condition, context) => context.target?.defenseType === (condition.defenseType ?? condition.value),
  target_has_status: (condition, context) => hasStatus(context.target, condition.statusId ?? condition.value),
  target_has_any_debuff: (_condition, context) => activeDebuffNames(context.target).length > 0,
  source_has_buff: (condition, context) => context.source?.buffs?.has?.(condition.buffId ?? condition.value),
  source_has_no_named_buff: (_condition, context) => (context.source?.buffs?.size ?? 0) === 0,
  core_below_ratio: (condition, context) => (
    context.state.core.durability / context.state.core.maxDurability < Number(condition.ratio ?? condition.value)
  ),
  is_boss: (condition, context) => Boolean(context.target?.isBoss) === (condition.value ?? true),
  attack_kind: (condition, context) => context.attackKind === (condition.attackKind ?? condition.value),
  core_damaged_previous_wave: (_condition, context) => Boolean(context.state.wave.previousCoreDamaged),
  source_has_tag: (condition, context) => context.source?.definition?.tags?.includes(condition.value),
});

export function evaluateCondition(condition, context) {
  const evaluator = CONDITION_REGISTRY[condition?.type];
  if (!evaluator) throw new RangeError(`Unknown trait condition: ${condition?.type}`);
  return Boolean(evaluator(condition, context));
}

export function evaluateConditions(conditions = [], context) {
  return conditions.every((condition) => evaluateCondition(condition, context));
}

export function countActiveDebuffs(target) {
  return new Set(activeDebuffNames(target)).size;
}

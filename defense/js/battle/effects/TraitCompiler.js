import { evaluateConditions } from './ConditionRegistry.js';
import { applyOperation, createModifierAccumulator } from './OperationRegistry.js';

function flattenTraits(definition) {
  if (Array.isArray(definition?.traits)) return definition.traits;
  if (definition?.traits && typeof definition.traits === 'object') {
    return Object.values(definition.traits).flatMap((entry) => (Array.isArray(entry) ? entry : []));
  }
  return [];
}

export function selectedTraitDefinitions(hero) {
  const selected = new Set(
    Array.isArray(hero?.selectedTraits)
      ? hero.selectedTraits
      : Object.values(hero?.selectedTraits ?? {}).filter(Boolean),
  );
  return flattenTraits(hero?.definition).filter((trait) => selected.has(trait.id));
}

function effectHook(effect) {
  if (effect.hook) return effect.hook;
  if (effect.type === 'provide_aura') return 'provide_aura';
  if (['increase_aura_range_tier', 'add_team_crit_chance'].includes(effect.type)) return 'team_modifier';
  if (effect.type === 'multiply_core_damage') return 'core_damage';
  if (effect.type === 'apply_status') return 'after_hit';
  if (['add_range', 'multiply_skill_cooldown', 'multiply_attack_interval'].includes(effect.type)) return 'stat_modifier';
  return 'before_damage';
}

export function compileTraits(hero) {
  return selectedTraitDefinitions(hero).map((trait) => Object.freeze({
    id: trait.id,
    hooks: new Set(trait.hooks ?? []),
    conditions: trait.conditions ?? trait.when ?? [],
    effects: trait.effects ?? [],
  }));
}

export function evaluateTraitHook(hero, hook, context, accumulator = createModifierAccumulator()) {
  for (const trait of compileTraits(hero)) {
    if (!evaluateConditions(trait.conditions, context)) continue;
    for (const effect of trait.effects) {
      if (trait.hooks.size > 0 ? !trait.hooks.has(hook) : effectHook(effect) !== hook) continue;
      applyOperation(effect, accumulator, context);
    }
  }
  return accumulator;
}

export default compileTraits;

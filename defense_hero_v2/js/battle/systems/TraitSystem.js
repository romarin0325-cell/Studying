import { createModifierAccumulator } from '../effects/OperationRegistry.js';
import { evaluateTraitHook, selectedTraitDefinitions } from '../effects/TraitCompiler.js';

export function collectHeroTraitModifiers(state, hero, hook, context = {}) {
  return evaluateTraitHook(hero, hook, {
    state,
    source: hero,
    rng: state.rng,
    ...context,
  }, createModifierAccumulator());
}

export function collectUniqueTeamTraitEffects(state, hook) {
  const seen = new Set();
  const output = [];
  for (const hero of state.heroes) {
    if (!hero.placed) continue;
    for (const trait of selectedTraitDefinitions(hero)) {
      const effects = (trait.effects ?? []).filter((effect) => (
        effect.hook === hook
        || (hook === 'team_modifier' && effect.type === 'increase_aura_range_tier')
        || (hook === 'team_modifier' && effect.type === 'add_team_crit_chance')
        || (hook === 'core_damage' && effect.type === 'multiply_core_damage')
      ));
      if (!effects.length) continue;
      for (const effect of effects) {
        const key = effect.dedupeKey ?? trait.id;
        if (seen.has(key)) continue;
        seen.add(key);
        output.push({ traitId: trait.id, effect, source: hero });
      }
    }
  }
  return output;
}

export function hasSelectedTrait(hero, traitId) {
  return selectedTraitDefinitions(hero).some((trait) => trait.id === traitId);
}

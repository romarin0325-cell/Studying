import { AURA_BUFF_BY_ID, AURA_RANGE_TIERS } from '../../content/buffs.js';
import { evaluateTraitHook } from '../effects/TraitCompiler.js';
import { createModifierAccumulator } from '../effects/OperationRegistry.js';
import { collectUniqueTeamTraitEffects } from './TraitSystem.js';

export function increaseAuraRange(range, steps = 1) {
  let index = AURA_RANGE_TIERS.indexOf(range);
  if (index < 0) throw new RangeError(`Unsupported aura range: ${range}`);
  index = Math.min(AURA_RANGE_TIERS.length - 1, index + Math.max(0, steps));
  return AURA_RANGE_TIERS[index];
}

function distance(source, target) {
  return Math.hypot(source.x - target.x, source.y - target.y);
}

export function recomputeAuras(state) {
  for (const hero of state.heroes) hero.buffs = new Map();
  const teamIncreases = collectUniqueTeamTraitEffects(state, 'team_modifier')
    .filter(({ effect }) => effect.type === 'increase_aura_range_tier')
    .reduce((total, { effect }) => total + Number(effect.value ?? 1), 0);

  for (const source of state.heroes) {
    if (!source.placed) continue;
    const modifier = evaluateTraitHook(source, 'provide_aura', {
      state,
      source,
      rng: state.rng,
    }, createModifierAccumulator());
    for (const aura of modifier.auras) {
      if (!AURA_BUFF_BY_ID[aura.buffId]) throw new RangeError(`Unknown aura buff: ${aura.buffId}`);
      const range = increaseAuraRange(aura.range, teamIncreases);
      const sourcePoint = { x: source.x + 0.5, y: source.y + 0.5 };
      for (const target of state.heroes) {
        if (!target.placed) continue;
        const targetPoint = { x: target.x + 0.5, y: target.y + 0.5 };
        if (distance(sourcePoint, targetPoint) > range + Number.EPSILON) continue;
        if (!target.buffs.has(aura.buffId)) target.buffs.set(aura.buffId, { sources: new Set(), range });
        target.buffs.get(aura.buffId).sources.add(source.id);
      }
    }
  }
  return state.heroes.map((hero) => ({ id: hero.id, buffs: [...hero.buffs.keys()] }));
}

export function buffEffects(hero, effectType) {
  const effects = [];
  for (const buffId of hero.buffs.keys()) {
    for (const effect of AURA_BUFF_BY_ID[buffId]?.effects ?? []) {
      if (effect.type === effectType) effects.push(effect);
    }
  }
  return effects;
}

import { buffEffects } from './AuraSystem.js';
import { applyDirectDamage } from './DamageSystem.js';
import { updateHeroDirection } from './DirectionSystem.js';
import { applyOnHitStatuses } from './BasicAttackSystem.js';
import { findTarget, targetsInRadius } from './TargetingSystem.js';
import { collectHeroTraitModifiers } from './TraitSystem.js';

function productBuff(hero, type) {
  return buffEffects(hero, type).reduce((product, effect) => product * Number(effect.value), 1);
}

export function getSkillCooldown(state, hero) {
  const modifier = collectHeroTraitModifiers(state, hero, 'stat_modifier', { attackKind: 'skill' });
  return hero.definition.skill.cooldown
    * productBuff(hero, 'skill_cooldown_multiplier')
    * modifier.skillCooldownMultiplier;
}

function hitSkillTarget(state, hero, target, radius, metadata = {}) {
  const skill = hero.definition.skill;
  const result = applyDirectDamage({
    state,
    source: hero,
    target,
    baseDamage: skill.damage,
    attackType: skill.attackType,
    attackKind: 'skill',
    attackArchetype: skill.shape,
    effectPreset: skill.shape === 'area' ? 'skill_area_hit' : 'skill_single_hit',
    radius,
    ...metadata,
  });
  applyOnHitStatuses(state, hero, target, 'skill', skill.onHitEffects ?? skill.statuses ?? [], {
    ...metadata,
    attackArchetype: skill.shape,
  });
  return result;
}

export function createSkillAction(state, hero, deltaSeconds, landscape = false) {
  if (!hero.placed) return false;
  hero.skillTimer = Math.max(0, hero.skillTimer - deltaSeconds);
  if (hero.skillTimer > 0) return null;
  const target = findTarget(state, hero, 'skill');
  if (!target) return null;
  updateHeroDirection(hero, target, landscape);
  const skill = hero.definition.skill;
  hero.stats.skills += 1;
  const impacts = skill.shape === 'area'
    ? targetsInRadius(state, target, skill.radius ?? 3).map((enemy) => ({ target: enemy }))
    : [{ target }];
  hero.skillTimer = getSkillCooldown(state, hero);
  return {
    tick: state.tick ?? 0,
    slot: hero.slot ?? 0,
    actionKind: 'skill',
    source: hero,
    target,
    targetSpawnOrder: target.spawnOrder ?? Number.MAX_SAFE_INTEGER,
    impacts,
  };
}

export function resolveSkillAction(state, action) {
  const { source: hero, impacts } = action;
  const skill = hero.definition.skill;
  for (const { target } of impacts) {
    hitSkillTarget(
      state,
      hero,
      target,
      skill.shape === 'area' ? skill.radius ?? 3 : undefined,
      { suppressEffect: skill.shape === 'area' && target.id !== action.target.id },
    );
  }
  return true;
}

export function updateSkillForHero(state, hero, deltaSeconds, landscape = false) {
  const action = createSkillAction(state, hero, deltaSeconds, landscape);
  if (!action) return false;
  resolveSkillAction(state, action);
  return true;
}

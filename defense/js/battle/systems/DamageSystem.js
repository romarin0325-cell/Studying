import {
  COMBAT_RULES,
  LEVEL_DAMAGE_MULTIPLIERS,
  ATTACK_FAMILIES,
  MATCHUP_TABLE,
} from '../../content/combat.js';
import { STATUS_BY_ID } from '../../content/statuses.js';
import { buffEffects } from './AuraSystem.js';
import { hasStatus } from './StatusSystem.js';
import { collectHeroTraitModifiers, collectUniqueTeamTraitEffects } from './TraitSystem.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const PHYSICAL_ATTACK_TYPES = ATTACK_FAMILIES.physical;
const MAGIC_ATTACK_TYPES = ATTACK_FAMILIES.magical;

function sumBuff(hero, type) {
  return buffEffects(hero, type).reduce((sum, effect) => sum + Number(effect.value), 0);
}

function statusTakenBonus(target, attackType) {
  let bonus = 0;
  for (const [statusId, runtime] of Object.entries(target.statuses ?? {})) {
    if (runtime.remaining <= 0 || runtime.internal) continue;
    const definition = STATUS_BY_ID[statusId] ?? {};
    bonus += Number(definition.direct_damage_taken ?? definition.directDamageTaken ?? 0);
    if (PHYSICAL_ATTACK_TYPES.includes(attackType)) bonus += Number(definition.physical_damage_taken ?? definition.physicalDamageTaken ?? 0);
    if (MAGIC_ATTACK_TYPES.includes(attackType)) bonus += Number(definition.magic_damage_taken ?? definition.magicDamageTaken ?? 0);
    for (const effect of definition.effects ?? []) {
      if (effect.type === 'direct_damage_taken') bonus += Number(effect.value);
      if (effect.type === 'physical_damage_taken' && PHYSICAL_ATTACK_TYPES.includes(attackType)) bonus += Number(effect.value);
      if (effect.type === 'magic_damage_taken' && MAGIC_ATTACK_TYPES.includes(attackType)) bonus += Number(effect.value);
    }
  }
  return bonus;
}

export function getMatchupMultiplier(attackType, defenseType) {
  const value = MATCHUP_TABLE[defenseType]?.[attackType];
  if (!Number.isFinite(value)) throw new RangeError(`Missing matchup ${defenseType}/${attackType}`);
  return value;
}

function teamCritChance(state, source) {
  let total = 0;
  for (const { effect } of collectUniqueTeamTraitEffects(state, 'team_modifier')) {
    if (effect.type !== 'add_team_crit_chance') continue;
    if (effect.targetTag && !source.definition.tags?.includes(effect.targetTag)) continue;
    total += Number(effect.value);
  }
  return total;
}

export function calculateDirectDamage({
  state,
  source,
  target,
  baseDamage,
  attackType,
  attackKind,
  forceCritical = false,
  rng = state.waveRng ?? state.rng,
} = {}) {
  const context = { target, attackType, attackKind, rng };
  const trait = collectHeroTraitModifiers(state, source, 'before_damage', context);
  const stat = collectHeroTraitModifiers(state, source, 'stat_modifier', context);
  const levelMultiplier = LEVEL_DAMAGE_MULTIPLIERS[source.level] ?? 1;
  const rawMatchup = getMatchupMultiplier(attackType, target.defenseType);
  const matchup = Math.max(rawMatchup, trait.matchupFloor);

  let buffBonus = sumBuff(source, 'direct_damage_bonus');
  if (PHYSICAL_ATTACK_TYPES.includes(attackType)) buffBonus += sumBuff(source, 'physical_damage_bonus');
  if (MAGIC_ATTACK_TYPES.includes(attackType)) buffBonus += sumBuff(source, 'magic_damage_bonus');
  const debuffBonus = statusTakenBonus(target, attackType);
  const critChance = clamp(
    Number(COMBAT_RULES.critical.baseChance ?? 0.1)
      + sumBuff(source, 'crit_chance_add')
      + stat.critChanceAdd
      + trait.critChanceAdd
      + teamCritChance(state, source),
    0,
    1,
  );
  const critical = forceCritical || rng.next() < critChance;
  const critMultiplier = critical
    ? Number(COMBAT_RULES.critical.baseDamageMultiplier ?? 1.5) + sumBuff(source, 'crit_damage_add')
    : 1;
  const amount = Number(baseDamage)
    * levelMultiplier
    * matchup
    * (1 + buffBonus)
    * (1 + debuffBonus)
    * trait.damageMultiplier
    * critMultiplier;
  return {
    amount,
    critical,
    matchup,
    advantageous: matchup >= 2,
    factors: { levelMultiplier, matchup, buffBonus, debuffBonus, traitMultiplier: trait.damageMultiplier, critMultiplier },
  };
}

export function applyDirectDamage(options) {
  const result = calculateDirectDamage(options);
  const { state, source, target, attackKind, effectPreset } = options;
  const attackArchetype = options.attackArchetype
    ?? (attackKind === 'skill' ? source.definition.skill.shape : source.definition.attack.archetype);
  const sourceX = Number.isFinite(options.sourceX)
    ? options.sourceX
    : (Number.isFinite(source.x) ? source.x + 0.5 : target.x);
  const sourceY = Number.isFinite(options.sourceY)
    ? options.sourceY
    : (Number.isFinite(source.y) ? source.y + 0.5 : target.y);
  target.hp = Math.max(0, target.hp - result.amount);
  source.stats.damage += result.amount;
  if (target.hp <= 0 && !target.dead) {
    target.dead = true;
    source.stats.kills += 1;
  }
  state.events.push({
    type: 'hit',
    actionKind: attackKind,
    attackArchetype,
    effectPreset,
    element: source.definition.element,
    sourceId: source.id,
    sourceX,
    sourceY,
    targetId: target.id,
    x: target.x,
    y: target.y,
    radius: options.radius,
    amount: result.amount,
    critical: result.critical,
    advantageous: result.advantageous,
    pelletIndex: options.pelletIndex,
    vectorX: options.vectorX,
    vectorY: options.vectorY,
    suppressEffect: Boolean(options.suppressEffect),
  });
  if (result.critical) {
    state.events.push({
      type: 'hit', actionKind: attackKind, attackArchetype,
      effectPreset: 'critical_hit', element: source.definition.element,
      sourceId: source.id, sourceX, sourceY,
      targetId: target.id, x: target.x, y: target.y, amount: result.amount,
      pelletIndex: options.pelletIndex,
    });
  }
  if (result.advantageous) {
    state.events.push({
      type: 'hit', actionKind: attackKind, attackArchetype,
      effectPreset: 'advantage_hit', element: source.definition.element,
      sourceId: source.id, sourceX, sourceY,
      targetId: target.id, x: target.x, y: target.y,
      pelletIndex: options.pelletIndex,
    });
  }
  return result;
}

export function applyPoisonDamage(state, target, amount) {
  const actual = Math.max(0, Number(amount));
  target.hp = Math.max(0, target.hp - actual);
  if (target.hp <= 0) target.dead = true;
  state.events.push({
    type: 'poison_tick', effectPreset: 'status_apply', element: 'nature',
    targetId: target.id, x: target.x, y: target.y, amount: actual,
  });
  return actual;
}

export function directDamageStatusSnapshot(target) {
  return {
    corrosion: hasStatus(target, 'corrosion'),
    curse: hasStatus(target, 'curse'),
    darkness: hasStatus(target, 'darkness'),
  };
}

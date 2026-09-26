import { buffEffects } from './AuraSystem.js';
import { attackGeometry } from '../AttackGeometry.js';
import { applyDirectDamage } from './DamageSystem.js';
import { updateHeroDirection } from './DirectionSystem.js';
import { applyStatus } from './StatusSystem.js';
import {
  findTarget,
  getEffectiveRange,
  spawnOrderPriority,
  targetsInRadius,
} from './TargetingSystem.js';
import { collectHeroTraitModifiers } from './TraitSystem.js';

function productBuff(hero, type) {
  return buffEffects(hero, type).reduce((product, effect) => product * Number(effect.value), 1);
}

export function getAttackInterval(state, hero) {
  const modifiers = collectHeroTraitModifiers(state, hero, 'stat_modifier', { attackKind: 'basic' });
  return hero.definition.attack.interval
    * productBuff(hero, 'attack_interval_multiplier')
    * modifiers.attackIntervalMultiplier;
}

export function resolveShotgunHits(sourcePoint, targetPoint, enemies, {
  range = 4,
  angles = [-12, 0, 12],
  normalRadius = 0.3,
  bossRadius = 0.45,
  includeMisses = false,
} = {}) {
  const dx = targetPoint.x - sourcePoint.x;
  const dy = targetPoint.y - sourcePoint.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return [];
  const rays = attackGeometry({ archetype: 'shotgun', spreadDegrees: angles }, sourcePoint, targetPoint, range).rays;
  const pellets = rays.map(({ direction }, pelletIndex) => {
    let hit = null;
    let hitDistance = Number.POSITIVE_INFINITY;
    for (const enemy of enemies) {
      if (enemy.dead || enemy.reachedCore) continue;
      const relativeX = enemy.x - sourcePoint.x;
      const relativeY = enemy.y - sourcePoint.y;
      const projection = relativeX * direction.x + relativeY * direction.y;
      if (projection < 0 || projection > range || projection > hitDistance) continue;
      const perpendicular = Math.abs(relativeX * direction.y - relativeY * direction.x);
      const radius = enemy.isBoss ? bossRadius : normalRadius;
      const sameDistance = Math.abs(projection - hitDistance) <= Number.EPSILON;
      if (
        perpendicular <= radius + Number.EPSILON
        && (!sameDistance || !hit || spawnOrderPriority(enemy, hit) < 0)
      ) {
        hit = enemy;
        hitDistance = projection;
      }
    }
    return {
      pelletIndex,
      target: hit,
      distance: hit ? hitDistance : range,
      direction,
    };
  });
  return includeMisses ? pellets : pellets.filter(({ target }) => target);
}

export function resolveLaserHits(sourcePoint, targetPoint, enemies, {
  range = 8,
  normalRadius = 0.45,
  bossRadius = 0.6,
} = {}) {
  const dx = targetPoint.x - sourcePoint.x;
  const dy = targetPoint.y - sourcePoint.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return [];
  const direction = attackGeometry({ archetype: 'laser' }, sourcePoint, targetPoint, range).rays[0].direction;
  const hits = [];
  for (const enemy of enemies) {
    if (enemy.dead || enemy.reachedCore) continue;
    const relativeX = enemy.x - sourcePoint.x;
    const relativeY = enemy.y - sourcePoint.y;
    const projection = relativeX * direction.x + relativeY * direction.y;
    if (projection < 0 || projection > range) continue;
    const perpendicular = Math.abs(relativeX * direction.y - relativeY * direction.x);
    const radius = enemy.isBoss ? bossRadius : normalRadius;
    if (perpendicular <= radius + Number.EPSILON) hits.push({ target: enemy, distance: projection });
  }
  // Deterministic pierce order: distance along the beam, then spawn order.
  hits.sort((left, right) => left.distance - right.distance || spawnOrderPriority(left.target, right.target));
  return hits;
}

function applyStatuses(state, hero, target, attackKind, configuredStatuses = [], metadata = {}) {
  const rng = state.waveRng ?? state.rng;
  const trait = collectHeroTraitModifiers(state, hero, 'after_hit', { target, attackKind, rng, ...metadata });
  const statuses = [
    ...configuredStatuses
      .filter((entry) => typeof entry === 'string' || entry?.type === 'apply_status' || entry?.statusId)
      .map((entry) => (typeof entry === 'string' ? { statusId: entry } : {
        ...entry,
        duration: entry.duration ?? entry.durationSeconds,
      })),
    ...trait.statuses,
  ];
  for (const status of statuses) {
    if (rng.next() >= Number(status.chance ?? 1)) continue;
    if (!applyStatus(target, status.statusId, status)) continue;
    const attackArchetype = metadata.attackArchetype
      ?? (attackKind === 'skill' ? hero.definition.skill.shape : hero.definition.attack.archetype);
    state.events.push({
      type: 'hit', actionKind: attackKind, attackArchetype,
      effectPreset: 'status_apply', element: hero.definition.element,
      sourceId: hero.id, sourceX: hero.x + 0.5, sourceY: hero.y + 0.5,
      targetId: target.id, x: target.x, y: target.y, statusId: status.statusId,
      pelletIndex: metadata.pelletIndex,
    });
  }
}

function hitTarget(state, hero, target, baseDamage, effectPreset, radius, metadata = {}) {
  if (target.dead || target.reachedCore) return null;
  const attackArchetype = metadata.attackArchetype ?? hero.definition.attack.archetype;
  const result = applyDirectDamage({
    state,
    source: hero,
    target,
    baseDamage,
    attackType: hero.definition.attack.attackType,
    attackKind: 'basic',
    effectPreset,
    attackArchetype,
    radius,
    ...metadata,
  });
  applyStatuses(state, hero, target, 'basic', hero.definition.attack.statuses ?? [], {
    ...metadata,
    attackArchetype,
  });
  return result;
}

function impactPriority(left, right) {
  return spawnOrderPriority(left.target, right.target)
    || (left.pelletIndex ?? 0) - (right.pelletIndex ?? 0);
}

export function createBasicAttackAction(state, hero, deltaSeconds, landscape = false) {
  if (!hero.placed) return false;
  hero.attackTimer = Math.max(0, hero.attackTimer - deltaSeconds);
  if (hero.attackTimer > 0) return null;
  const target = findTarget(state, hero, 'basic');
  if (!target) return null;
  const attack = hero.definition.attack;
  const geometry = attackGeometry(attack, { x: hero.x + 0.5, y: hero.y + 0.5 }, target, getEffectiveRange(state, hero));
  if (attack.archetype === 'nova') {
    const center = { x: hero.x + 0.5, y: hero.y + 0.5 };
    const novaImpacts = targetsInRadius(state, center, geometry.radius)
      .map((enemy) => ({ target: enemy }));
    // Nova waits for enemies to enter the hero-centered radius instead of wasting the swing.
    if (novaImpacts.length === 0) return null;
    updateHeroDirection(hero, target, landscape);
    hero.stats.basicAttacks += 1;
    hero.lastTargetId = target.id;
    hero.attackTimer = getAttackInterval(state, hero);
    return {
      tick: state.tick ?? 0,
      slot: hero.slot ?? 0,
      actionKind: 'basic',
      source: hero,
      target,
      targetSpawnOrder: target.spawnOrder ?? Number.MAX_SAFE_INTEGER,
      impacts: novaImpacts,
      pellets: null,
      geometry,
      attackCount: hero.stats.basicAttacks,
    };
  }
  updateHeroDirection(hero, target, landscape);
  hero.stats.basicAttacks += 1;
  hero.lastTargetId = target.id;

  let impacts;
  let pellets = null;
  if (attack.archetype === 'shotgun') {
    const sourcePoint = { x: hero.x + 0.5, y: hero.y + 0.5 };
    pellets = resolveShotgunHits(sourcePoint, target, [...state.enemies.values()], {
      range: geometry.range,
      angles: attack.spreadDegrees,
      normalRadius: attack.normalCollisionRadius,
      bossRadius: attack.bossCollisionRadius,
      includeMisses: true,
    });
    impacts = pellets.filter(({ target: pelletTarget }) => pelletTarget).sort(impactPriority);
  } else if (attack.archetype === 'laser') {
    const sourcePoint = { x: hero.x + 0.5, y: hero.y + 0.5 };
    impacts = resolveLaserHits(sourcePoint, target, [...state.enemies.values()], {
      range: geometry.range,
      normalRadius: attack.normalCollisionRadius,
      bossRadius: attack.bossCollisionRadius,
    }).map(({ target: pierced }) => ({ target: pierced }));
  } else if (attack.archetype === 'area') {
    impacts = targetsInRadius(state, target, attack.radius ?? 2).map((enemy) => ({ target: enemy }));
  } else {
    impacts = [{ target }];
  }
  hero.attackTimer = getAttackInterval(state, hero);
  return {
    tick: state.tick ?? 0,
    slot: hero.slot ?? 0,
    actionKind: 'basic',
    source: hero,
    target,
    targetSpawnOrder: target.spawnOrder ?? Number.MAX_SAFE_INTEGER,
    impacts,
    pellets,
    geometry,
    attackCount: hero.stats.basicAttacks,
  };
}

// Refresh moving targets at release, without consuming a second attack/cooldown.
export function refreshBasicAction(state, action, target) {
  const hero = action.source, attack = hero.definition.attack;
  action.target = target;
  action.geometry = attackGeometry(attack, { x: hero.x + .5, y: hero.y + .5 }, target, getEffectiveRange(state, hero));
  const geometry = action.geometry, enemies = [...state.enemies.values()];
  if (attack.archetype === 'shotgun') {
    action.pellets = resolveShotgunHits(geometry.source, target, enemies, {
      range: geometry.range, angles: attack.spreadDegrees, normalRadius: attack.normalCollisionRadius,
      bossRadius: attack.bossCollisionRadius, includeMisses: true,
    });
    action.impacts = action.pellets.filter(p => p.target).sort(impactPriority);
  } else if (attack.archetype === 'laser') {
    action.impacts = resolveLaserHits(geometry.source, target, enemies, {
      range: geometry.range, normalRadius: attack.normalCollisionRadius, bossRadius: attack.bossCollisionRadius,
    });
  } else if (attack.archetype === 'nova') {
    action.impacts = targetsInRadius(state, geometry.source, geometry.radius).map(target => ({ target }));
  } else if (attack.archetype === 'area') {
    action.impacts = targetsInRadius(state, target, attack.radius ?? 2).map(target => ({ target }));
  } else action.impacts = [{ target }];
  return action;
}

export function resolveBasicAttackAction(state, action) {
  const { source: hero, impacts } = action;
  const attack = hero.definition.attack;
  if (attack.archetype === 'nova') {
    const sourceX = hero.x + 0.5;
    const sourceY = hero.y + 0.5;
    state.events.push({
      type: 'hit', actionKind: 'basic', attackArchetype: 'nova',
      effectPreset: 'basic_nova_hit', element: hero.definition.element,
      sourceId: hero.id, sourceX, sourceY,
      targetId: action.target.id, x: sourceX, y: sourceY,
      radius: action.geometry.radius,
      visualOnly: true,
    });
    for (const impact of impacts) {
      hitTarget(state, hero, impact.target, attack.damage, 'basic_nova_hit', action.geometry.radius, {
        attackArchetype: 'nova',
        suppressEffect: true,
        attackCount: action.attackCount,
      });
    }
    return true;
  }
  if (attack.archetype === 'laser') {
    const sourceX = hero.x + 0.5;
    const sourceY = hero.y + 0.5;
    const { direction, end } = action.geometry.rays[0];
    const vectorX = direction.x, vectorY = direction.y;
    state.events.push({
      type: 'hit', actionKind: 'basic', attackArchetype: 'laser',
      effectPreset: 'basic_laser_hit', element: hero.definition.element,
      sourceId: hero.id, sourceX, sourceY,
      targetId: action.target.id,
      x: end.x,
      y: end.y,
      effectiveRange: action.geometry.range,
      vectorX, vectorY,
      visualOnly: true,
    });
    for (const impact of impacts) {
      hitTarget(state, hero, impact.target, attack.damage, 'basic_laser_hit', undefined, {
        attackArchetype: 'laser',
        suppressEffect: true,
        vectorX,
        vectorY,
        attackCount: action.attackCount,
      });
    }
    return true;
  }
  if (attack.archetype === 'shotgun') {
    const { pellets } = action;
    const sourceX = hero.x + 0.5;
    const sourceY = hero.y + 0.5;
    for (const pellet of pellets ?? []) {
      const end = action.geometry.rays[pellet.pelletIndex].end;
      const x = pellet.target ? sourceX + pellet.direction.x * pellet.distance : end.x;
      const y = pellet.target ? sourceY + pellet.direction.y * pellet.distance : end.y;
      state.events.push({
        type: 'hit', actionKind: 'basic', attackArchetype: 'shotgun',
        effectPreset: 'basic_shotgun_hit', element: hero.definition.element,
        sourceId: hero.id, sourceX, sourceY,
        targetId: pellet.target?.id ?? null, x, y,
        pelletIndex: pellet.pelletIndex,
        effectiveRange: action.geometry.range,
        vectorX: pellet.direction.x,
        vectorY: pellet.direction.y,
        missed: !pellet.target,
        visualOnly: true,
      });
    }
    for (const impact of impacts) {
      hitTarget(state, hero, impact.target, attack.damage, 'basic_shotgun_hit', undefined, {
        pelletIndex: impact.pelletIndex,
        vectorX: impact.direction.x,
        vectorY: impact.direction.y,
        suppressEffect: true,
        attackCount: action.attackCount,
      });
    }
    return true;
  }
  if (attack.archetype === 'area') {
    const point = action.impactPoint ?? action.target;
    state.events.push({ type: 'hit', actionKind: 'basic', attackArchetype: 'area',
      effectPreset: 'basic_area_hit', element: hero.definition.element, sourceId: hero.id,
      sourceX: hero.x + .5, sourceY: hero.y + .5, x: point.x, y: point.y,
      radius: attack.radius ?? 2, visualOnly: true });
  }
  for (const impact of impacts) {
    if (attack.archetype === 'area') {
      hitTarget(state, hero, impact.target, attack.damage, 'basic_area_hit', attack.radius ?? 2, {
        suppressEffect: true, attackCount: action.attackCount,
      });
    } else {
      const preset = attack.archetype === 'melee' ? 'basic_melee_hit' : 'basic_ranged_hit';
      hitTarget(state, hero, impact.target, attack.damage, preset, undefined, { attackCount: action.attackCount });
    }
  }
  return true;
}

export function updateBasicAttackForHero(state, hero, deltaSeconds, landscape = false) {
  const action = createBasicAttackAction(state, hero, deltaSeconds, landscape);
  if (!action) return false;
  resolveBasicAttackAction(state, action);
  return true;
}

export { applyStatuses as applyOnHitStatuses };

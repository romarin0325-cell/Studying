import { refreshBasicAction, resolveBasicAttackAction } from './BasicAttackSystem.js';
import { resolveSkillAction } from './SkillSystem.js';
import { findTarget, targetsInRadius } from './TargetingSystem.js';
import { updateHeroDirection } from './DirectionSystem.js';

// All durations are simulation seconds. Visual afterglows use a separate
// presentation clock, but windup, projectile position and damage share this one.
export const ATTACK_TIMINGS = Object.freeze({
  skill: Object.freeze({ windup: .38, speed: 8, minFlight: .32, maxFlight: .72 }),
  skillMelee: Object.freeze({ windup: .38, speed: 0 }),
  rapid: Object.freeze({ windup: .10, speed: 16, minFlight: .10, maxFlight: .36 }),
  burst: Object.freeze({ windup: .24, speed: 11, minFlight: .18, maxFlight: .55 }),
  area: Object.freeze({ windup: .24, speed: 10, minFlight: .20, maxFlight: .60 }),
  laser: Object.freeze({ windup: .22, speed: 0 }),
  shotgun: Object.freeze({ windup: .18, speed: 0 }),
  melee: Object.freeze({ windup: .20, speed: 0 }),
  nova: Object.freeze({ windup: .28, speed: 0 }),
});

export function queueBattleActions(state, actions) {
  for (const action of actions) {
    const hero = action.source, skill = action.actionKind === 'skill';
    const archetype = skill ? hero.definition.skill.shape : hero.definition.attack.archetype;
    const timing = ATTACK_TIMINGS[skill ? (archetype === 'melee' ? 'skillMelee' : 'skill') : archetype];
    if (!timing) throw new RangeError(`Missing attack timing: ${archetype}`);
    const sourceX = hero.x + .5, sourceY = hero.y + .5;
    const projectile = state.registry.add('projectiles', {
      _action: action, _timing: timing, actionKind: action.actionKind,
      attackArchetype: archetype, sourceId: hero.id, element: hero.definition.element,
      skillName: skill ? hero.definition.skill.name : null,
      vfx: skill ? hero.definition.skill.vfx : null,
      phase: 'windup', elapsed: 0, duration: timing.windup, progress: 0,
      sourceX, sourceY, x: sourceX, y: sourceY,
      targetId: action.target.id, targetIsBoss: Boolean(action.target.isBoss),
      targetX: action.target.x, targetY: action.target.y,
      radius: skill ? hero.definition.skill.radius : hero.definition.attack.radius,
    });
    state.events.push({ ...publicProjectile(projectile), type: 'attack_prepare',
      effectPreset: skill ? 'skill_cast' : null, visualOnly: true });
    action.castEmitted = true;
  }
}

function live(enemy) { return enemy && !enemy.dead && !enemy.reachedCore; }

function impact(state, projectile) {
  const action = projectile._action;
  const area = projectile.attackArchetype === 'area';
  if (area) {
    action.impactPoint = { x: projectile.targetX, y: projectile.targetY };
    action.impacts = targetsInRadius(state, action.impactPoint, projectile.radius ?? 2)
      .map(target => ({ target }));
  } else action.impacts = action.impacts.filter(({ target }) => live(target));
  if (action.actionKind === 'skill') resolveSkillAction(state, action);
  else resolveBasicAttackAction(state, action);
  state.registry.remove('projectiles', projectile.id);
}

function release(state, projectile, landscape) {
  const action = projectile._action, hero = action.source;
  const target = findTarget(state, hero, action.actionKind);
  if (!target) {
    hero[action.actionKind === 'skill' ? 'skillTimer' : 'attackTimer'] = 0;
    state.registry.remove('projectiles', projectile.id);
    return false;
  }
  updateHeroDirection(hero, target, landscape);
  action.target = target;
  if (action.actionKind === 'basic') refreshBasicAction(state, action, target);
  else action.impacts = [{ target }];
  Object.assign(projectile, { targetId: target.id, targetIsBoss: Boolean(target.isBoss),
    targetX: target.x, targetY: target.y });
  const timing = projectile._timing, distance = Math.hypot(target.x-projectile.sourceX, target.y-projectile.sourceY);
  projectile.duration = timing.speed ? Math.max(timing.minFlight, Math.min(timing.maxFlight, distance / timing.speed)) : 0;
  projectile.phase = 'flight'; projectile.elapsed = 0; projectile.progress = 0;
  state.events.push({ ...publicProjectile(projectile), type: 'attack_launched', visualOnly: true });
  if (!projectile.duration) { impact(state, projectile); return false; }
  return true;
}

export function advanceAttackTimeline(state, deltaSeconds, { landscape = false } = {}) {
  for (const projectile of [...state.registry.projectiles.values()]) {
    let elapsed = deltaSeconds;
    if (projectile.phase === 'windup') {
      const target = projectile._action.target;
      if (live(target)) { projectile.targetX = target.x; projectile.targetY = target.y; }
      const remaining = projectile.duration - projectile.elapsed;
      projectile.elapsed += elapsed;
      projectile.progress = Math.min(1, projectile.elapsed / projectile.duration);
      if (projectile.elapsed + 1e-9 < projectile.duration) continue;
      elapsed = Math.max(0, elapsed - remaining);
      if (!release(state, projectile, landscape)) continue;
    }
    projectile.elapsed += elapsed;
    projectile.progress = Math.min(1, projectile.elapsed / projectile.duration);
    // Single-target missiles follow their committed target. AoE retains its
    // telegraphed landing position and checks who is there on the impact tick.
    const target = projectile._action.target;
    if (projectile.attackArchetype !== 'area' && live(target)) {
      projectile.targetX = target.x; projectile.targetY = target.y;
    }
    projectile.x = projectile.sourceX + (projectile.targetX - projectile.sourceX) * projectile.progress;
    projectile.y = projectile.sourceY + (projectile.targetY - projectile.sourceY) * projectile.progress;
    if (projectile.elapsed + 1e-9 >= projectile.duration) impact(state, projectile);
  }
}

function publicProjectile(projectile) {
  return Object.fromEntries(Object.entries(projectile).filter(([key]) => !key.startsWith('_')));
}

export function attackTimelineSnapshot(state) {
  return [...state.registry.projectiles.values()].map(publicProjectile);
}

export function clearAttackTimeline(state) {
  for (const id of [...state.registry.projectiles.keys()]) state.registry.remove('projectiles', id);
}

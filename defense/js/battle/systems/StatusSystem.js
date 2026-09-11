import { STATUS_BY_ID } from '../../content/statuses.js';

export function hasStatus(target, statusId) {
  return Boolean(target?.statuses?.[statusId]?.remaining > 0);
}

export function applyStatus(target, statusId, options = {}) {
  const definition = STATUS_BY_ID[statusId];
  if (!definition) throw new RangeError(`Unknown status: ${statusId}`);
  target.statuses ??= {};
  if (statusId === 'stun' && hasStatus(target, 'stun_immunity')) return false;
  const duration = Number(options.duration ?? definition.duration);
  if (statusId === 'poison') {
    const existing = target.statuses.poison;
    target.statuses.poison = {
      id: 'poison',
      debuff: true,
      remaining: duration,
      stacks: Math.min(definition.max_stacks ?? definition.maximumStacks ?? 3, (existing?.stacks ?? 0) + Number(options.stacks ?? 1)),
      tickRemaining: existing?.tickRemaining ?? 1,
    };
    return true;
  }
  const existing = target.statuses[statusId];
  target.statuses[statusId] = {
    id: statusId,
    debuff: definition.debuff !== false,
    internal: definition.internal === true,
    remaining: Math.max(existing?.remaining ?? 0, duration),
    stacks: 1,
  };
  return true;
}

export function movementSpeedMultiplier(target) {
  return hasStatus(target, 'slow') ? Number(STATUS_BY_ID.slow.slow_multiplier ?? 0.5) : 1;
}

export function isStunned(target) {
  return hasStatus(target, 'stun');
}

export function updateStatuses(state, deltaSeconds, applyPoisonDamage) {
  for (const target of state.enemies.values()) {
    for (const [statusId, status] of Object.entries(target.statuses ?? {})) {
      if (statusId === 'poison') {
        status.tickRemaining -= deltaSeconds;
        while (status.tickRemaining <= 0 && status.remaining > 0 && !target.dead) {
          applyPoisonDamage(target, Number(STATUS_BY_ID.poison.poison_dps ?? 3) * status.stacks);
          status.tickRemaining += 1;
        }
      }
      status.remaining -= deltaSeconds;
      if (status.remaining > 0) continue;
      delete target.statuses[statusId];
      if (statusId === 'stun') {
        applyStatus(target, 'stun_immunity', { duration: STATUS_BY_ID.stun_immunity.duration ?? 2 });
      }
    }
  }
}

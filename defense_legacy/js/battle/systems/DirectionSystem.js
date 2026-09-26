import { DIRECTION } from '../../core/enums.js';
import { logicalVectorToScreen } from '../../render/ViewportLayout.js';

export function directionFromScreenVector(dx, dy, fallback = DIRECTION.FRONT) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? DIRECTION.LEFT : DIRECTION.RIGHT;
  return dy < 0 ? DIRECTION.BACK : DIRECTION.FRONT;
}

export function directionFromLogicalVector(dx, dy, landscape = false, fallback = DIRECTION.FRONT) {
  const screen = logicalVectorToScreen(dx, dy, landscape);
  return directionFromScreenVector(screen.dx, screen.dy, fallback);
}

export function updateHeroDirection(hero, target, landscape = false) {
  if (!hero || !target) return hero?.direction ?? DIRECTION.FRONT;
  hero.direction = directionFromLogicalVector(
    target.x - (hero.x + 0.5),
    target.y - (hero.y + 0.5),
    landscape,
    hero.direction ?? DIRECTION.FRONT,
  );
  return hero.direction;
}

export function updateBossDirection(enemy, movementVector, landscape = false) {
  if (!enemy?.isBoss || enemy.statuses?.stun) return enemy?.direction ?? DIRECTION.FRONT;
  enemy.direction = directionFromLogicalVector(
    movementVector?.dx ?? 0,
    movementVector?.dy ?? 0,
    landscape,
    enemy.direction ?? DIRECTION.FRONT,
  );
  return enemy.direction;
}

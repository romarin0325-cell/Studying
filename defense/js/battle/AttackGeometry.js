// Logical ground-plane geometry. Rendering projects these exact rays, without
// recalculating range or changing combat when the viewport rotates.
export function attackGeometry(attack, source, target, effectiveRange) {
  const dx = target.x - source.x, dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const forward = { x: dx / length, y: dy / length };
  const angles = attack.archetype === 'shotgun' ? attack.spreadDegrees ?? [-12, 0, 12] : [0];
  const rays = angles.map(degrees => {
    const angle = degrees * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const direction = { x: forward.x * c - forward.y * s, y: forward.x * s + forward.y * c };
    return { direction, end: { x: source.x + direction.x * effectiveRange, y: source.y + direction.y * effectiveRange } };
  });
  return { source: { ...source }, target: { x: target.x, y: target.y }, range: effectiveRange,
    archetype: attack.archetype, rays, radius: attack.archetype === 'nova' ? effectiveRange : attack.radius ?? 0,
    normalRadius: attack.normalCollisionRadius, bossRadius: attack.bossCollisionRadius };
}

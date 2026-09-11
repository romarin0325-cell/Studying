export function cleanupEntities(state) {
  const removed = [];
  for (const [id, enemy] of state.enemies) {
    if (!enemy.dead && !enemy.reachedCore) continue;
    state.registry.remove('enemies', id);
    removed.push(id);
  }
  return removed;
}

import { BATTLE_PHASE } from '../../core/enums.js';

export function cleanupEntities(state) {
  const removed = [];
  for (const [id, enemy] of state.enemies) {
    // A remote boss attack can end the battle while enemies are still alive.
    // Release those entities without awarding kills or defeat effects.
    if (!enemy.dead && !enemy.reachedCore && state.phase !== BATTLE_PHASE.DEFEAT) continue;
    if (enemy.dead) state.events.push({ type: 'enemy_defeated', enemy: {
      id: enemy.id, enemyId: enemy.enemyId, name: enemy.name, element: enemy.element,
      defenseType: enemy.defenseType, isBoss: enemy.isBoss, x: enemy.x, y: enemy.y,
      progress: enemy.progress, direction: enemy.direction, hp: 0, maxHp: enemy.maxHp,
    } });
    state.registry.remove('enemies', id);
    removed.push(id);
  }
  return removed;
}

import { BATTLE_PHASE } from '../../core/enums.js';
import { collectUniqueTeamTraitEffects } from './TraitSystem.js';
import { isStunned, movementSpeedMultiplier } from './StatusSystem.js';
import { updateBossDirection } from './DirectionSystem.js';

function pathPosition(path, progress) {
  const clamped = Math.max(0, Math.min(path.length - 1, progress));
  const index = Math.min(path.length - 2, Math.floor(clamped));
  const fraction = clamped - index;
  const start = path[index];
  const end = path[Math.min(path.length - 1, index + 1)];
  return {
    x: start.x + 0.5 + (end.x - start.x) * fraction,
    y: start.y + 0.5 + (end.y - start.y) * fraction,
    dx: end.x - start.x,
    dy: end.y - start.y,
  };
}
export function coreDamageMultiplier(state) {
  return collectUniqueTeamTraitEffects(state, 'core_damage')
    .filter(({ effect }) => effect.type === 'multiply_core_damage')
    .reduce((product, { effect }) => product * Number(effect.value), 1);
}

export function damageCore(state, amount = 1) {
  const actual = amount * coreDamageMultiplier(state);
  state.core.durability = Math.max(0, state.core.durability - actual);
  state.wave.currentCoreDamaged = state.wave.currentCoreDamaged || actual > 0;
  state.events.push({ type: 'core_damaged', amount: actual, durability: state.core.durability });
  if (state.core.durability <= 0) {
    state.phase = BATTLE_PHASE.DEFEAT;
    state.result = { victory: false, wave: state.wave.number, elapsedSeconds: state.elapsedSeconds };
    state.events.push({ type: 'battle_defeated', wave: state.wave.number });
  }
  return actual;
}

export function updateMovement(state, deltaSeconds, landscape = false) {
  if (state.phase !== BATTLE_PHASE.WAVE_RUNNING) return;
  for (const enemy of state.enemies.values()) {
    if (enemy.dead || enemy.reachedCore || isStunned(enemy)) continue;
    enemy.progress += enemy.speed * movementSpeedMultiplier(enemy) * deltaSeconds;
    if (enemy.progress >= state.stage.path.length - 1) {
      enemy.progress = state.stage.path.length - 1;
      const end = state.stage.path.at(-1);
      enemy.x = end.x + 0.5;
      enemy.y = end.y + 0.5;
      enemy.reachedCore = true;
      damageCore(state, 1);
      continue;
    }
    const position = pathPosition(state.stage.path, enemy.progress);
    enemy.x = position.x;
    enemy.y = position.y;
    updateBossDirection(enemy, position, landscape);
  }
}

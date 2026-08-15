import { AURA_BUFF_BY_ID } from '../../content/buffs.js';
import { collectHeroTraitModifiers } from './TraitSystem.js';

export const distanceSquared = (left, right) => (left.x - right.x) ** 2 + (left.y - right.y) ** 2;

function buffEffectTotal(hero, type) {
  let total = 0;
  for (const buffId of hero.buffs.keys()) {
    const effects = AURA_BUFF_BY_ID[buffId]?.effects ?? [];
    for (const effect of effects) if (effect.type === type) total += Number(effect.value);
  }
  return total;
}

export function getEffectiveRange(state, hero, attackKind = 'basic') {
  const modifiers = collectHeroTraitModifiers(state, hero, 'stat_modifier', { attackKind });
  return hero.definition.attack.range + buffEffectTotal(hero, 'range_add') + modifiers.rangeAdd;
}

export function targetPriority(left, right) {
  return right.progress - left.progress || left.spawnOrder - right.spawnOrder || left.id.localeCompare(right.id);
}

export function spawnOrderPriority(left, right) {
  return (left.spawnOrder ?? Number.MAX_SAFE_INTEGER) - (right.spawnOrder ?? Number.MAX_SAFE_INTEGER)
    || String(left.id).localeCompare(String(right.id));
}

export function findTarget(state, hero, attackKind = 'basic') {
  if (!hero.placed) return null;
  const range = getEffectiveRange(state, hero, attackKind);
  const source = { x: hero.x + 0.5, y: hero.y + 0.5 };
  return [...state.enemies.values()]
    .filter((enemy) => !enemy.dead && !enemy.reachedCore && distanceSquared(source, enemy) <= range ** 2 + Number.EPSILON)
    .sort(targetPriority)[0] ?? null;
}

export function targetsInRadius(state, point, radius) {
  return [...state.enemies.values()]
    .filter((enemy) => !enemy.dead && !enemy.reachedCore && distanceSquared(point, enemy) <= radius ** 2 + Number.EPSILON)
    .sort(spawnOrderPriority);
}

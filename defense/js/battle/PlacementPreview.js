import { recomputeAuras } from './systems/AuraSystem.js';
import { findTarget, getEffectiveRange } from './systems/TargetingSystem.js';
import { resolveLaserHits } from './systems/BasicAttackSystem.js';
import { attackGeometry } from './AttackGeometry.js';

export function placementPreview(state, heroId, point) {
  const original = state.heroes.find(hero => hero.id === heroId);
  if (!original || !point) return null;
  const hero = { ...original, x: Math.floor(point.x), y: Math.floor(point.y), placed: true, buffs: new Map() };
  const preview = { ...state, heroes: state.heroes.map(h => h.id === heroId ? hero : { ...h, buffs: new Map() }) };
  recomputeAuras(preview);
  const source = { x: hero.x + .5, y: hero.y + .5 }, range = getEffectiveRange(preview, hero);
  const path = state.stage.path.map((p, i) => ({ x: p.x + .5, y: p.y + .5, spawnOrder: i, id: 'path-' + i }));
  const candidates = path.filter(p => Math.hypot(p.x - source.x, p.y - source.y) <= range);
  const target = findTarget(preview, hero) ?? candidates.sort((a, b) => {
    if (hero.definition.attack.archetype === 'laser') {
      const count = p => resolveLaserHits(source, p, path, { range, normalRadius: hero.definition.attack.normalCollisionRadius }).length;
      return count(b) - count(a) || b.spawnOrder - a.spawnOrder;
    }
    return Math.hypot(a.x - source.x, a.y - source.y) - Math.hypot(b.x - source.x, b.y - source.y);
  })[0] ?? { x: source.x + 1, y: source.y };
  const links = [];
  for (const recipient of preview.heroes) for (const [buffId, buff] of recipient.buffs) for (const sourceId of buff.sources) {
    if (sourceId === recipient.id || (sourceId !== heroId && recipient.id !== heroId)) continue;
    const provider = preview.heroes.find(h => h.id === sourceId);
    links.push({ buffId, source: { x: provider.x + .5, y: provider.y + .5 }, target: { x: recipient.x + .5, y: recipient.y + .5 } });
  }
  return { geometry: attackGeometry(hero.definition.attack, source, target, range), links,
    buffs: [...hero.buffs.keys()] };
}

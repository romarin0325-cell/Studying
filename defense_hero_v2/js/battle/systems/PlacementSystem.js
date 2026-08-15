import { BATTLE_PHASE, BOARD } from '../../core/enums.js';

const keyOf = (x, y) => `${x},${y}`;

export function stageBlockedCells(stage) {
  const blocked = new Set(stage.path.map(({ x, y }) => keyOf(x, y)));
  for (const { x, y } of stage.obstacles) blocked.add(keyOf(x, y));
  return blocked;
}
export function canPlaceHero(state, heroId, x, y) {
  if (![BATTLE_PHASE.PREPARATION, BATTLE_PHASE.INTERMISSION].includes(state.phase)) return false;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 0 || x >= BOARD.columns || y < 0 || y >= BOARD.rows) return false;
  if (stageBlockedCells(state.stage).has(keyOf(x, y))) return false;
  return !state.heroes.some((hero) => hero.id !== heroId && hero.placed && hero.x === x && hero.y === y);
}

export function placeHero(state, heroId, x, y) {
  const hero = state.heroes.find((candidate) => candidate.id === heroId);
  if (!hero) throw new RangeError(`Unknown formation hero: ${heroId}`);
  if (!canPlaceHero(state, heroId, x, y)) return false;
  hero.x = x;
  hero.y = y;
  hero.placed = true;
  return true;
}

export function allHeroesPlaced(state) {
  return state.heroes.length === 5 && state.heroes.every((hero) => hero.placed);
}

function pathDistanceSquared(stage, x, y) {
  let closest = Number.POSITIVE_INFINITY;
  for (const cell of stage.path) {
    closest = Math.min(closest, (cell.x - x) ** 2 + (cell.y - y) ** 2);
  }
  return closest;
}

export function autoPlaceHeroes(state) {
  const blocked = stageBlockedCells(state.stage);
  const cells = [];
  for (let y = 0; y < BOARD.rows; y += 1) {
    for (let x = 0; x < BOARD.columns; x += 1) {
      if (!blocked.has(keyOf(x, y))) cells.push({ x, y, score: pathDistanceSquared(state.stage, x, y) });
    }
  }
  cells.sort((left, right) => left.score - right.score || left.y - right.y || left.x - right.x);
  const used = new Set();
  for (const hero of state.heroes) {
    const preferred = state.stage.recommendedPlacements?.[hero.slot];
    let cell = preferred && canPlaceHero(state, hero.id, preferred.x, preferred.y) ? preferred : null;
    if (!cell) cell = cells.find((candidate) => !used.has(keyOf(candidate.x, candidate.y)) && canPlaceHero(state, hero.id, candidate.x, candidate.y));
    if (!cell) throw new Error('Could not find five legal hero cells');
    placeHero(state, hero.id, cell.x, cell.y);
    used.add(keyOf(cell.x, cell.y));
  }
  return state.heroes.map(({ id, x, y }) => ({ id, x, y }));
}

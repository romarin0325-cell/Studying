import { BATTLE_PHASE, BOARD } from '../../core/enums.js';
import { resolveLaserHits } from './BasicAttackSystem.js';

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
  const whitelist = state.stage.placementCells;
  if (whitelist?.length && !whitelist.some((cell) => cell.x === x && cell.y === y)) return false;
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
  const whitelist = state.stage.placementCells;
  const cells = [];
  if (whitelist?.length) {
    for (const { x, y } of whitelist) {
      if (!blocked.has(keyOf(x, y))) cells.push({ x, y, score: pathDistanceSquared(state.stage, x, y) });
    }
  } else {
    for (let y = 0; y < BOARD.rows; y += 1) {
      for (let x = 0; x < BOARD.columns; x += 1) {
        if (!blocked.has(keyOf(x, y))) cells.push({ x, y, score: pathDistanceSquared(state.stage, x, y) });
      }
    }
  }
  cells.sort((left, right) => left.score - right.score || left.y - right.y || left.x - right.x);
  const used = new Set();
  const path = state.stage.path.map((p,i) => ({ x:p.x+.5,y:p.y+.5,id:String(i),spawnOrder:i }));
  const rankedHeroes = [...state.heroes].sort((a,b)=>Number(Boolean(b.definition.innateAuras))-Number(Boolean(a.definition.innateAuras)) || a.slot-b.slot);
  for (const hero of rankedHeroes) {
    const attack = hero.definition.attack;
    const preferredRole = hero.definition.innateAuras ? 'support' : attack.archetype === 'laser' ? 'line' : ['melee','nova','shotgun'].includes(attack.archetype) ? 'bend' : 'crossing';
    const range = attack.archetype === 'nova' ? attack.radius : attack.range;
    const score = cell => {
      const source = {x:cell.x+.5,y:cell.y+.5}, role = whitelist?.find(p=>p.x===cell.x&&p.y===cell.y)?.role;
      const inRange = path.filter(p=>Math.hypot(p.x-source.x,p.y-source.y)<=range);
      const beam = attack.archetype === 'laser' ? Math.max(0,...inRange.map(p=>resolveLaserHits(source,p,path,{range,normalRadius:attack.normalCollisionRadius}).length)) : 0;
      const allies = state.heroes.filter(h=>h.id!==hero.id && used.has(keyOf(h.x,h.y)) && Math.hypot(h.x-cell.x,h.y-cell.y)<=4).length;
      return (role===preferredRole?14:0) + inRange.length + beam*4 + (hero.definition.innateAuras ? allies*5 : 0);
    };
    const cell = cells.filter(candidate => !used.has(keyOf(candidate.x,candidate.y)) && canPlaceHero(state,hero.id,candidate.x,candidate.y))
      .sort((a,b)=>score(b)-score(a)||a.y-b.y||a.x-b.x)[0];
    if (!cell) throw new Error('Could not find five legal hero cells');
    placeHero(state, hero.id, cell.x, cell.y);
    used.add(keyOf(cell.x, cell.y));
  }
  return state.heroes.map(({ id, x, y }) => ({ id, x, y }));
}

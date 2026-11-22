import { nextFloat, pick, shuffle } from './rng.js';
import { GRADE, gradeOf } from './roster.js';
import { ROSTER_LIMIT, usesTempo } from '../content/tempo.js';
import { runRoster } from './run.js';

export const RATES = {
  draw: { normal: 40, rare: 30, epic: 20, legend: 10 },
  pick: { normal: 25, rare: 30, epic: 25, legend: 20 }
};
export const COST = { draw: 1, pick: 3 };
export const BLESS = { normal: 0.4, rare: 0.3, epic: 0.2, legend: 0.1, transcendence: 0.1, event: 0.2 };
export const JACKPOT = { chance: 0.15, mult: 2.5 };
export const usesRepeatDraws = run => !run.daily && run.drawRuleVersion === 2;

export function canJoin(run, id, { allowReserved = false } = {}) {
  return run.pool.includes(id) && !run.bench.includes(id) && !run.fallen.includes(id)
    && !run.released.includes(id) && (allowReserved || run.reserved !== id);
}

export function seeCharacters(run, ids) {
  if (run.daily) return;
  run.seenCharacters = [...new Set([...run.seenCharacters, ...ids])];
}

export function seeRelic(run, id) {
  if (!run.daily && id && !run.seenRelics.includes(id)) run.seenRelics.push(id);
}

export function join(run, id) {
  run.bench.push(id);
  run.joinOrder.push(id);
  seeCharacters(run, [id]);
  if (run.introHeirlooms[id]) {
    run.heirlooms[id] = run.introHeirlooms[id];
    delete run.introHeirlooms[id];
  }
}

export function replacementCount(run, incoming, { enforceLimit = usesTempo(run) || usesRepeatDraws(run) } = {}) {
  return enforceLimit ? Math.max(0, run.bench.length + incoming - ROSTER_LIMIT) : 0;
}

export function validateReplacements(run, incoming, ids) {
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !run.bench.includes(id))) {
    return 'invalid_replacement';
  }
  const required = replacementCount(run, incoming);
  if (ids.length < required) return 'roster_full';
  if (ids.length > required) return 'invalid_replacement';
  return null;
}

export function release(run, id) {
  run.released.push(id);
  run.bench = run.bench.filter(other => other !== id);
  delete run.blessings[id];
  delete run.heirlooms[id];
}

function distribution(run, roster, rates, eligible) {
  const byGrade = {};
  for (const id of run.pool) {
    if (!eligible(id)) continue;
    const grade = gradeOf(roster.card(id).grade);
    (byGrade[grade] ||= []).push(id);
  }
  const total = Object.keys(rates).reduce((sum, group) => sum + (byGrade[group] ? rates[group] : 0), 0);
  return Object.keys(rates).map(group => ({
    group, ids: byGrade[group] ?? [], weight: byGrade[group] ? rates[group] : 0, total
  }));
}

function rollFrom(rng, groups) {
  const available = groups.filter(entry => entry.weight);
  if (!available.length) return null;
  let roll = nextFloat(rng) * available[0].total;
  for (const { ids, weight } of available) {
    roll -= weight;
    if (roll < 0) return pick(rng, ids);
  }
  return pick(rng, available.at(-1).ids);
}

// The opening and named guarantees still require a distinct new fighter.
export function drawFrom(run, roster, rates, exclude = []) {
  return rollFrom(run.rng, distribution(run, roster, rates, id => canJoin(run, id) && !exclude.includes(id)));
}

export function drawEncounter(run, roster, kind = 'draw') {
  return rollFrom(run.rng, distribution(run, roster, RATES[kind], id => usesRepeatDraws(run) || canJoin(run, id)));
}

// One offer shows different people: duplicates inside the same offer are redrawn. The same companion may still
// come back in later offers (boost/memory), which is the repeat-draw rule the owner asked for.
export function drawDistinct(run, roster, kind, count, taken = []) {
  const picked = [];
  for (let tries = 0; picked.length < count && tries < count * 12; tries++) {
    const id = drawEncounter(run, roster, kind);
    if (!id) break;
    if (!picked.includes(id) && !taken.includes(id)) picked.push(id);
  }
  return picked;
}

export function ratesView(run, kind = 'draw') {
  const rates = RATES[kind];
  if (!rates) throw new RangeError('invalid_draw_kind');
  return distribution(run, runRoster(run), rates, id => usesRepeatDraws(run) || canJoin(run, id))
    .map(({ group, ids, weight, total }) => ({
      group, label: group === 'legend' ? '전설군' : GRADE[group],
      percent: total ? (weight / total) * 100 : 0, count: ids.length
    }));
}

export function springDrawChance(run, id) {
  if (!run.pool.includes(id) || (!usesRepeatDraws(run) && !canJoin(run, id))) return 0;
  const grade = gradeOf(runRoster(run).card(id).grade);
  const { percent, count } = ratesView(run).find(rate => rate.group === grade);
  return percent / count;
}

export function drawKind(run, id) {
  if (run.fallen.includes(id) || run.released.includes(id)) return 'memory';
  return run.bench.includes(id) ? 'boost' : 'join';
}

export function applyDraw(run, id) {
  const kind = drawKind(run, id);
  if (kind === 'join') {
    join(run, id);
    if (id === run.reserved) {
      const available = [...new Set([...run.unchosen, ...run.pool])].filter(other => canJoin(run, other));
      run.reserved = available.find(other => !run.companions.includes(other)) ?? available[0] ?? null;
    }
    return { kind, id, targetId: id, stacks: 0 };
  }
  const targetId = kind === 'boost' ? id : run.joinOrder.find(other => run.bench.includes(other)) ?? null;
  seeCharacters(run, [id]);
  if (!targetId) return { kind, id, targetId, stacks: 0 };
  const stacks = (run.repeatStacks[targetId] ?? 0) + 1;
  run.repeatStacks[targetId] = stacks;
  return { kind, id, targetId, stacks };
}

export function choicesFor(run, roster, count, { priority = [], near = null } = {}) {
  const choices = [...new Set(priority)].filter(id => canJoin(run, id)).slice(0, count);
  const element = roster.card(near)?.element;
  if (element && choices.length < count && !choices.some(id => roster.card(id).element === element)) {
    const matching = run.pool.filter(id => canJoin(run, id) && roster.card(id).element === element);
    if (matching.length) choices.push(pick(run.rng, matching));
  }
  while (choices.length < count) {
    const id = drawFrom(run, roster, RATES.pick, choices);
    if (!id) break;
    choices.push(id);
  }
  return near ? shuffle(run.rng, choices) : choices;
}

export function rollBlessing(run, roster) {
  if (!run.bench.length) return null;
  const id = pick(run.rng, run.bench);
  const base = BLESS[roster.card(id).grade] || 0.2;
  const jackpot = nextFloat(run.rng) < JACKPOT.chance;
  return { id, multiplier: Math.round(base * (jackpot ? JACKPOT.mult : 1) * 100) / 100, jackpot };
}

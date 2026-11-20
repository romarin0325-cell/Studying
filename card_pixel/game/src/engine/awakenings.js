import { nextFloat, pick, shuffle } from './rng.js';
import { gradeOf } from './roster.js';

export const RATES = {
  draw: { normal: 40, rare: 30, epic: 20, legend: 10 },
  pick: { normal: 25, rare: 30, epic: 25, legend: 20 }
};
export const COST = { draw: 1, pick: 3 };
export const BLESS = { normal: 0.4, rare: 0.3, epic: 0.2, legend: 0.1, transcendence: 0.1, event: 0.2 };
export const JACKPOT = { chance: 0.15, mult: 2.5 };

export function canJoin(run, id, { allowReserved = false } = {}) {
  return run.pool.includes(id) && !run.bench.includes(id) && !run.fallen.includes(id)
    && !run.released.includes(id) && (allowReserved || run.reserved !== id);
}

export function seeCharacters(run, ids) {
  run.seenCharacters = [...new Set([...run.seenCharacters, ...ids])];
}

export function seeRelic(run, id) {
  if (id && !run.seenRelics.includes(id)) run.seenRelics.push(id);
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

export function drawFrom(run, roster, rates, exclude = []) {
  const byGrade = {};
  for (const id of run.pool) {
    if (!canJoin(run, id) || exclude.includes(id)) continue;
    const grade = gradeOf(roster.card(id).grade);
    (byGrade[grade] ||= []).push(id);
  }
  const grades = Object.keys(rates).filter(grade => byGrade[grade]);
  if (!grades.length) return null;
  let roll = nextFloat(run.rng) * grades.reduce((sum, grade) => sum + rates[grade], 0);
  for (const grade of grades) {
    roll -= rates[grade];
    if (roll < 0) return pick(run.rng, byGrade[grade]);
  }
  return pick(run.rng, byGrade[grades.at(-1)]);
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

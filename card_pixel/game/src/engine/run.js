/* RelayRun: one expedition. Floors and doors, what each door holds, awakenings (summons),
   the chaos altar, rewards, permadeath and heirlooms between battles. Pure functions over a
   plain run object, so the screen, the tests and the balance sim all play the same rules. */
import { pick, shuffle, mulberry32 } from './rng.js';
import { QUIRKS } from '../content/quirks.js';
import { AFFIXES } from '../content/affixes.js';

const FLOORS = 7;
const RATES = {
  draw: { normal: 40, rare: 30, epic: 20, legend: 10 },   // 깨우기: the card game's normal draw
  pick: { normal: 25, rare: 30, epic: 25, legend: 20 }    // 골라 깨우기: the card game's challenge draw
};
const COST = { draw: 1, pick: 3 };
const BLESS = { normal: 0.4, rare: 0.3, epic: 0.2, legend: 0.1, transcendence: 0.1, event: 0.2 };   // the card game's chaos blessing
const JACKPOT = { chance: 0.15, mult: 2.5 };
const TIER = [1, 1, 1.05, 1.12, 1.15, 1.28, 1.28, 1];                       // enemy strength by floor (1-based)
const QUIRK_IDS = Object.keys(QUIRKS);
const AFFIX_IDS = Object.keys(AFFIXES);
const GRADE_OF = g => (['normal', 'rare', 'epic', 'legend'].includes(g) ? g : 'legend');

function newRun(core, roster, seed, opts) {
  const o = opts || {};
  const rng = mulberry32(seed >>> 0);
  return {
    seed: seed >>> 0, rng, pool: roster.pool(o.pool || 'common'), plain: !!o.plain,
    floor: 0, doors: [], crystals: 1,
    bench: [], fallen: [], heirlooms: {}, blessings: {}, unchosen: [],
    boss: pick(rng, roster.bosses),
    stats: { battles: 0, turns: 0, best: 0, bestBy: '', heirloomsUsed: 0, lastStands: 0, jackpots: 0 },
    result: null
  };
}

/* ---------- awakenings ---------- */
const canRecruit = (run, id) => !run.bench.includes(id) && !run.fallen.includes(id);
function drawFrom(run, roster, rates, exclude = []) {
  const pool = run.pool.filter(id => canRecruit(run, id) && !exclude.includes(id));
  if (!pool.length) return null;
  const byGrade = {};
  for (const id of pool) (byGrade[GRADE_OF(roster.card(id).grade)] = byGrade[GRADE_OF(roster.card(id).grade)] || []).push(id);
  const grades = Object.keys(rates).filter(g => byGrade[g]);
  let r = run.rng() * grades.reduce((n, g) => n + rates[g], 0);
  for (const g of grades) { r -= rates[g]; if (r < 0) return pick(run.rng, byGrade[g]); }
  return pick(run.rng, byGrade[grades[grades.length - 1]]);
}
/** Three different candidates for 골라 깨우기. With `near` (a card id), one candidate shares its
    element, so the second start pick can build on the first (many traits count an element). */
function pickChoices(run, roster, n, opts) {
  const out = [], near = opts && opts.near && roster.card(opts.near);
  if (near) {
    const same = run.pool.filter(id => canRecruit(run, id) && roster.card(id).element === near.element);
    if (same.length) out.push(pick(run.rng, same));
  }
  for (let i = out.length; i < (n || 3); i++) { const id = drawFrom(run, roster, RATES.pick, out); if (id) out.push(id); }
  return near ? shuffle(run.rng, out) : out;
}
function takePick(run, choices, id) {
  if (!canRecruit(run, id)) return;
  run.bench.push(id);
  run.unchosen = run.unchosen.filter(x => !choices.includes(x)).concat(choices.filter(x => x !== id));
}
/** The start: two picks (the second leans toward the first's element), then three random wakings. */
const START = { picks: 2, draws: 3 };
/** 깨우기: one random character, paid unless free. */
function drawAwaken(run, roster, free) {
  if (!free) { if (run.crystals < COST.draw) return null; run.crystals -= COST.draw; }
  const id = drawFrom(run, roster, RATES.draw);
  if (id) run.bench.push(id);
  return id;
}
function payPick(run) { if (run.crystals < COST.pick) return false; run.crystals -= COST.pick; return true; }

/* ---------- chaos altar ---------- */
function altarRoll(run, roster) {
  if (!run.bench.length) return null;
  const id = pick(run.rng, run.bench), base = BLESS[roster.card(id).grade] || 0.2;
  const jackpot = run.rng() < JACKPOT.chance;
  return { id, mult: Math.round(base * (jackpot ? JACKPOT.mult : 1) * 100) / 100, jackpot };
}
function altarKeep(run, roll) { if (roll) { run.blessings[roll.id] = roll.mult; if (roll.jackpot) run.stats.jackpots++; } }

/* ---------- floors and doors ---------- */
function drawShadow(run, roster, grades, taken) {
  const pool = run.pool.filter(id => canRecruit(run, id) && !taken.includes(id) && grades.includes(GRADE_OF(roster.card(id).grade)));
  return pool.length ? pick(run.rng, pool) : null;
}
function affixes(run, n, allowTreasure) {
  const ids = shuffle(run.rng, AFFIX_IDS.filter(a => allowTreasure || a !== 'treasure'));
  return ids.slice(0, n);
}
function wildDoor(run, roster, f, o) {
  const rng = run.rng, mul = TIER[f], taken = [];
  const quirk = !run.plain && rng() < (o.quirk || 0) ? pick(rng, QUIRK_IDS) : null;
  const count = (o.count || 1) + (quirk === 'overflow' ? 1 : 0);
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const extra = !run.plain && rng() < (o.affix || 0) ? { affixes: affixes(run, 1, true) } : {};
    const sid = f >= 3 && rng() < 0.35 ? drawShadow(run, roster, ['normal', 'rare', 'epic'], taken) : null;
    if (sid) { taken.push(sid); enemies.push(roster.shadowOf(sid, mul, extra)); }
    else enemies.push(roster.wildOf(pick(rng, f <= 2 ? roster.wild.filter(w => w !== 'dark_knight') : roster.wild), mul, extra));
  }
  return { type: 'wild', name: count > 1 ? '몽마의 무리' : '몽마', enemies, quirk, reward: 1 + (quirk ? 1 : 0), bg: 'cave' };
}
function eliteDoor(run, roster, f, o) {
  const rng = run.rng, mul = TIER[f] * 1.12;
  const quirk = !run.plain && rng() < (o.quirk || 0) ? pick(rng, QUIRK_IDS.filter(q => q !== 'overflow')) : null;
  const extra = { affixes: run.plain ? [] : affixes(run, 2, true), elite: true };
  const sid = rng() < 0.5 ? drawShadow(run, roster, ['epic', 'legend'], []) : null;
  const enemy = sid ? roster.shadowOf(sid, mul, extra) : roster.wildOf(pick(rng, roster.LARGE.length ? roster.LARGE : roster.wild), mul * 1.1, extra);
  return { type: 'elite', name: '정예', enemies: [enemy], quirk, reward: 3, bg: 'gate' };
}
function gateDoor(run, roster, f) {
  const mul = TIER[f], taken = [];
  const first = run.unchosen.filter(id => canRecruit(run, id));
  const a = first.length ? pick(run.rng, first) : drawShadow(run, roster, ['rare', 'epic'], taken);
  if (a) taken.push(a);
  const b = drawShadow(run, roster, ['epic', 'legend'], taken) || drawShadow(run, roster, ['normal', 'rare', 'epic', 'legend'], taken);
  const enemies = [a, b].filter(Boolean).map(id => roster.shadowOf(id, mul));
  return { type: 'gate', name: '문지기', enemies, quirk: null, reward: 3, bg: 'gate', fromUnchosen: !!first.length };
}
function makeDoors(run, roster, f) {
  const svc = run.floor2Service || (run.floor2Service = run.rng() < 0.5 ? 'spring' : 'altar');
  const other = svc === 'spring' ? 'altar' : 'spring';
  const service = type => ({ type, name: type === 'spring' ? '소환의 샘' : '혼돈의 제단', enemies: [], bg: null });
  switch (f) {
    case 1: return [wildDoor(run, roster, f, { count: 1 })];
    case 2: return [wildDoor(run, roster, f, { count: 1, quirk: 0.7, affix: 0.4 }), service(svc)];
    case 3: return [wildDoor(run, roster, f, { count: run.rng() < 0.5 ? 2 : 1, quirk: 0.7, affix: 0.6 }), eliteDoor(run, roster, f, { quirk: 0.4 }), service(other)];
    case 4: return [gateDoor(run, roster, f)];
    case 5: return [wildDoor(run, roster, f, { count: 2, quirk: 1, affix: 0.8 }), eliteDoor(run, roster, f, { quirk: 0.5 })];
    case 6: return [service('spring'), service('altar')];
    case 7: return [{ type: 'boss', name: '꿈의 주인', enemies: [roster.bossOf(run.boss)], quirk: null, reward: 0, bg: 'throne' }];
  }
  return [];
}
function nextFloor(run, roster) {
  run.floor++;
  run.doors = run.floor <= FLOORS ? makeDoors(run, roster, run.floor) : [];
  return run.doors;
}

/* ---------- battles ---------- */
function battleOptions(run, door, order) {
  const party = (order || run.bench).slice(0, 3);
  return {
    party, enemies: door.enemies, quirk: door.quirk,
    seed: (run.seed + run.floor * 1013 + run.stats.battles * 7) >>> 0,
    heirlooms: Object.assign({}, run.heirlooms),
    blessings: Object.entries(run.blessings).map(([id, multiplier]) => ({ id, multiplier }))
  };
}
/** Apply a finished battle: permadeath, heirlooms, crystals. Returns what the screen announces. */
function applyBattle(run, roster, door, party, bridge, events) {
  const alive = bridge.survivors(), win = bridge.outcome === 'win';
  run.stats.battles++; run.stats.turns += bridge.state().turn;
  const fallen = party.filter((id, i) => id && !alive[i]);
  for (const id of fallen) { run.fallen.push(id); delete run.heirlooms[id]; delete run.blessings[id]; }
  run.bench = run.bench.filter(id => !fallen.includes(id));
  for (const g of bridge.heirloomsGained()) if (run.bench.includes(g.to)) run.heirlooms[g.to] = { from: g.from, name: g.name };
  let crystals = 0;
  if (win) {
    crystals = door.reward || 0;
    crystals += 2 * (events || []).filter(e => e.t === 'enemyDown' && e.treasure).length;
    if (party.some((id, i) => id && alive[i] && roster.card(id).trait && roster.card(id).trait.type === 'looter')) crystals += 1;
    run.crystals += crystals;
  }
  const wiped = win && run.bench.length === 0;
  if (!win || (wiped && door.type !== 'boss')) run.result = 'lose';
  else if (door.type === 'boss') run.result = 'win';
  return { win, wiped, fallen, crystals };
}
/** After the gate: the defeated shadows can be woken for free (pick one). */
function gateChoices(run, door) {
  if (run.result) return [];
  return door.enemies.map(e => e.source).filter(id => id && canRecruit(run, id));
}

export {
  FLOORS, RATES, COST, BLESS, JACKPOT, TIER, START,
  newRun, nextFloor, makeDoors, pickChoices, takePick, drawAwaken, payPick, altarRoll, altarKeep,
  battleOptions, applyBattle, gateChoices
};

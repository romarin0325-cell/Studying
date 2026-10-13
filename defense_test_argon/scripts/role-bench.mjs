// Solo role bench for the mobile merge-defense game.
// Measures the raw damage of K copies of one companion fielded alone
// (no other companions on the board) so damage dealers of the same role
// can be compared. Chapter index 2 is love Iris: that boss has no damage
// passive, same as defense_test/scripts/simulate.mjs.
//
// Ultimates. Nothing in these scenarios dies, and the live game fills the
// starlight gauge from kills. Each tick therefore also adds a fixed 2.5
// starlight per second, capped at engine.gaugeCap(s), so ultimates come up
// at a comparable rhythm for every hero. This is on top of the combat
// trickle engine.step already applies (1.2/s). The run still starts at the
// engine's opening gauge (90). --ult off skips casts; the income stays,
// and it does not change damage. A cast fires whenever the gauge is at
// least HERO[id].skill.cost (starfall included, so that ult spends about
// its cost rather than waiting for a full gauge).
//
// --wave-age 0|1|2 (default 1) sets every unit's birthWave to wave - age
// with wave fixed at 2. Age 1 is the neutral 100% step for star_boy and
// time_ruler. Aurora's even-count bonus is covered by K=2 and K=4.
//
//   node defense_test/scripts/role-bench.mjs --heroes id,id,... [--ranks 1,3,5] [--copies 1,2] [--scenarios stream,pack,walker,dummy] [--seeds 4] [--ult on] [--wave-age 1] [--json out.json]
import fs from 'node:fs/promises';
import {HEROES, HERO, MAX_RANK} from '../src/content.js';
import * as engine from '../src/combat/engine.js';
import {TEAM_SIZE} from '../src/team-config.js';

const DT = .05;
const GAUGE_PER_SECOND = 2.5;
const CHAPTER = 2;
const WAVE = 2;
const GOLD = 1e6;
const CORE_HEALTH = 1e9;
const ENEMY_HP = 1e12;
// Mixed crowd, the same kinds as simulate.mjs `crowd`, in this rotation.
const CROWD = ['grunt', 'grunt', 'runner', 'grunt', 'armor'];
const PLACEMENTS = {
  1: [[12], [17], [21], [22], [7]],
  2: [[11, 13], [16, 18], [21, 23], [12, 17]],
  4: [[11, 12, 13, 17], [16, 17, 18, 22], [6, 8, 16, 18]],
};
const crowdQueue = () => Array.from({length: 36}, (_, i) => ({kind: CROWD[i % 5], hp: ENEMY_HP}));
const bossQueue = () => [{kind: 'boss', hp: ENEMY_HP}];
const SCENARIOS = {
  // Passing stream. Leakers are removed by the engine; core health is pinned
  // so a leak cannot end the run. Interval is imposed by the spawnIn clamp.
  stream: {seconds: 40, interval: .55, holdHealth: true, queue: crowdQueue},
  pack: {seconds: 30, interval: .25, holdHealth: true, queue: crowdQueue},
  walker: {seconds: 40, interval: 1, queue: bossQueue},
  // Frozen mid-path boss, same anchor as simulate.mjs scenario `long`.
  dummy: {seconds: 30, interval: 1, start: 1394, freeze: true, queue: bossQueue},
};

const KNOWN = new Set(['heroes', 'ranks', 'copies', 'scenarios', 'seeds', 'ult', 'wave-age', 'json']);
const args = process.argv.slice(2);
const values = new Map();
for (let i = 0; i < args.length; i++) {
  const token = args[i];
  if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
  const name = token.slice(2);
  if (!KNOWN.has(name)) throw new Error(`Unknown option: ${token}`);
  const value = args[++i];
  if (value === undefined || value.startsWith('--')) throw new Error(`--${name} needs a value`);
  values.set(name, value);
}
const opt = (name, fallback) => values.has(name) ? values.get(name) : fallback;

function integers(text, name) {
  const parts = text.split(',').map(part => part.trim()).filter(Boolean);
  if (!parts.length) throw new Error(`--${name} needs a value`);
  return parts.map(part => {
    const n = Number(part);
    if (!Number.isInteger(n)) throw new Error(`--${name} must be integers: ${part}`);
    return n;
  });
}

const heroArg = opt('heroes', null);
if (!heroArg) throw new Error('--heroes is required');
const heroes = heroArg.split(',').map(id => id.trim()).filter(Boolean);
if (!heroes.length) throw new Error('--heroes is required');
for (const id of heroes) if (!HERO[id]) throw new Error(`Unknown hero: ${id}`);

const ranks = integers(opt('ranks', '1,3,5'), 'ranks');
for (const rank of ranks) if (rank < 1 || rank > MAX_RANK) throw new Error(`--ranks must be integers from 1 to ${MAX_RANK}: ${rank}`);

const copies = integers(opt('copies', '1,2'), 'copies');
for (const k of copies) if (!PLACEMENTS[k]) throw new Error(`--copies has no placement set for ${k} (use 1, 2, or 4)`);

const scenarioNames = opt('scenarios', 'stream,pack,walker,dummy').split(',').map(name => name.trim()).filter(Boolean);
if (!scenarioNames.length) throw new Error('--scenarios needs a value');
for (const name of scenarioNames) if (!SCENARIOS[name]) throw new Error(`Unknown scenario: ${name}`);

const seeds = Number(opt('seeds', '4'));
if (!Number.isInteger(seeds) || seeds < 1) throw new Error('--seeds must be a positive integer');

const ultFlag = opt('ult', 'on');
if (ultFlag !== 'on' && ultFlag !== 'off') throw new Error('--ult must be on or off');
const ult = ultFlag === 'on';

const waveAge = Number(opt('wave-age', '1'));
if (![0, 1, 2].includes(waveAge)) throw new Error('--wave-age must be 0, 1, or 2');

const jsonOut = opt('json', null);

function deckFor(id) {
  const filler = HEROES.map(hero => hero.id).filter(hero => hero !== id);
  const deck = [id, ...filler.slice(0, TEAM_SIZE - 1)];
  if (!engine.validDeck(deck)) throw new Error(`Could not build a deck for ${id}`);
  return deck;
}

// One companion, K copies, placed as plain unit objects (same fields as simulate.mjs).
function bench(id, cells, rank, scenario, seed) {
  const s = engine.newRun({deck: deckFor(id), chapter: CHAPTER, seed});
  s.wave = WAVE;
  s.board = Array(25).fill(null);
  s.nextId += 1000;
  const birthWave = s.wave - waveAge;
  for (const cell of cells) {
    s.board[cell] = {uid: s.nextId++, hero: id, rank, cooldown: .25, windup: 0, target: null, attacks: 0, pose: 0, born: 0, birthWave, harvest: 12, disabled: 0, facing: 'down', aim: Math.PI / 2, idleFor: 0, priority: HERO[id].bossDamage || HERO[id].bossPriority ? 'boss' : 'first'};
  }
  s.enemies = [];
  s.queue = scenario.queue();
  s.waveTotal = s.queue.length;
  s.spawnIn = 0;
  s.gold = GOLD;
  s.health = CORE_HEALTH;
  const seen = new Set();
  let t = 0;
  while (t < scenario.seconds && ['combat', 'intermission'].includes(s.phase)) {
    if (scenario.holdHealth) s.health = CORE_HEALTH;
    // Spawn spacing follows the scenario rather than the stage plan.
    if (s.queue.length && s.spawnIn > scenario.interval) s.spawnIn = scenario.interval;
    engine.step(s, DT);
    t += DT;
    // Fixed passive starlight. Nothing dies here, so kill gauge never arrives.
    s.gauge = Math.min(engine.gaugeCap(s), s.gauge + GAUGE_PER_SECOND * DT);
    for (const e of s.enemies) if (!seen.has(e.uid)) {
      seen.add(e.uid);
      if (scenario.start) e.progress = scenario.start;
      if (e.boss) {e.skillIn = 1e9; if (scenario.freeze) e.speed = 0;}
    }
    if (ult) {
      const cost = HERO[id].skill.cost, goldCost = engine.skillGoldCost(id);
      while (s.phase === 'combat' && s.enemies.some(e => e.hp > 0) && s.gauge >= cost && s.gold >= goldCost && engine.bestUnit(s, id)) {
        const before = s.gauge;
        if (!engine.cast(s, id).ok || s.gauge >= before) break;
      }
    }
  }
  return {damage: s.stats.damage, byHero: s.stats.byHero[id] || 0, casts: s.stats.skills};
}

function measure(id, cells, rank, scenario) {
  let damage = 0, byHero = 0, casts = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const run = bench(id, cells, rank, scenario, seed);
    damage += run.damage;
    byHero += run.byHero;
    casts += run.casts;
  }
  return {cells: cells.slice(), damage: damage / seeds, byHero: byHero / seeds, casts: casts / seeds};
}

function bestPlacement(id, rank, k, scenario) {
  let best = null;
  for (const cells of PLACEMENTS[k]) {
    const run = measure(id, cells, rank, scenario);
    // Equal totals keep the earliest candidate, so tied cells stay stable across seeds.
    if (!best || run.damage > best.damage) best = run;
  }
  return {...best, dps: best.damage / scenario.seconds / k};
}

const fmt = n => n.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});
const ratioText = n => n === null ? '—' : n.toFixed(2);

function printTable(rank, k, rows) {
  console.log(`\n## ${rank}성 · ${k}기\n`);
  const head = [...scenarioNames, ...scenarioNames.map(name => `${name} 셀`), ...scenarioNames.map(name => `${name} 필`), ...scenarioNames.map(name => `${name} 비`)];
  console.log(`| 동료 | 등급 | ${head.join(' | ')} |`);
  console.log(`|---|---|${head.map((_, i) => i < scenarioNames.length * 2 ? (i < scenarioNames.length ? '---:' : '---') : '---:').join('|')}|`);
  for (const row of rows) {
    const dps = scenarioNames.map(name => fmt(row.scenarios[name].dps));
    const cellText = scenarioNames.map(name => row.scenarios[name].cells.join(','));
    const casts = scenarioNames.map(name => row.scenarios[name].casts.toFixed(2));
    const ratios = scenarioNames.map(name => ratioText(row.scenarios[name].ratio));
    console.log(`| ${row.name} | ${row.rarity} | ${[...dps, ...cellText, ...casts, ...ratios].join(' | ')} |`);
  }
}

const started = Date.now();
console.log('# 단독 역할 벤치');
console.log(`동료 ${heroes.join(', ')} · 성급 ${ranks.join(',')} · 기수 ${copies.join(',')} · 시나리오 ${scenarioNames.join(', ')} · 시드 1..${seeds} · 필살기 ${ultFlag} · 웨이브 나이 ${waveAge}`);
console.log(`DPS = 총피해 / 시나리오 초 / 기수 (${scenarioNames.map(name => `${name} ${SCENARIOS[name].seconds}s`).join(', ')}). 비율은 목록의 첫 동료 대비. 처치가 없어 별빛을 초당 ${GAUGE_PER_SECOND} 추가로 채웁니다.`);

const report = {
  chapter: CHAPTER, wave: WAVE, waveAge, ult, gaugePerSecond: GAUGE_PER_SECOND,
  heroes, ranks, copies, scenarios: scenarioNames, seeds, sections: [],
};

for (const rank of ranks) {
  for (const k of copies) {
    const rows = [];
    for (const id of heroes) {
      const scenarios = {};
      for (const name of scenarioNames) {
        const best = bestPlacement(id, rank, k, SCENARIOS[name]);
        scenarios[name] = {...best, seconds: SCENARIOS[name].seconds};
      }
      rows.push({
        id,
        name: HERO[id].name,
        rarity: HERO[id].hidden ? 'UR(H)' : HERO[id].rarity,
        scenarios,
      });
    }
    const base = rows[0];
    for (const row of rows) {
      for (const name of scenarioNames) {
        const baseDps = base.scenarios[name].dps;
        row.scenarios[name].ratio = baseDps > 0 ? row.scenarios[name].dps / baseDps : null;
      }
    }
    printTable(rank, k, rows);
    report.sections.push({rank, copies: k, rows});
  }
}

const elapsed = (Date.now() - started) / 1000;
console.error(`\n${heroes.length} heroes × ${ranks.length} ranks × ${copies.length} copy counts × ${scenarioNames.length} scenarios × ${seeds} seeds · ${elapsed.toFixed(1)}s`);
if (jsonOut) await fs.writeFile(jsonOut, JSON.stringify(report, null, 2) + '\n');

// Run-level balance probe: plays whole expeditions with a simple player and prints clear rate,
// where runs end, and how often the "big moment" systems fire.
// Run: node card_pixel/game/tools/sim.mjs [runs] [--plain] [--no-heirloom] [--no-laststand]
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
// Share Math so the ESM bridge can seed the card core inside the VM.
import * as Bridge from '../src/engine/bridge.js';
import * as RelayRoster from '../src/engine/roster.js';
import * as R from '../src/engine/run.js';
import { coreBundle } from './core-bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const args = process.argv.slice(2);
const runs = Number(args.find(a => /^\d+$/.test(a)) || 300);
const flag = f => args.includes(f);

/* The sim assumes the full planned roster has sprites, so balance does not depend on how far the art batch got. */
const PLANNED = ['ash', 'luna', 'red_dragon', 'zeke', 'flame_sage', 'cherry_prince', 'gold_dragon', 'ancient_dragon', 'cinderella', 'queen', 'sunflower', 'siren',
  'storm_sage', 'lightning_sage', 'santa', 'jasmine', 'night_rabbit', 'snow_rabbit', 'silver_rabbit', 'guardian', 'behemoth', 'venom', 'aurora', 'avalanche_maid',
  'cure_master', 'galaxy_whale', 'great_detective', 'joker', 'miracle_larva', 'mushroom_king', 'phantom', 'rumi', 'time_magician', 'time_ruler', 'toffee_apple',
  'trauma', 'underdog', 'entropy', 'mawang', 'doom_luther', 'harmonius',
  'golem', 'emerald_beetle', 'magma_beetle', 'gold_moth', 'treant', 'wraith', 'night_bat', 'dark_knight', 'abyss_eye', 'artificial_demon_god', 'demon_god', 'ares',
  'iris_love', 'iris_curse', 'pharaoh', 'gray', 'thor', 'flora', 'poseidon', 'creator_god'];
const sp = {};
for (const id of PLANNED) sp[id + '-idle'] = { w: 60, h: 72, cx: 30, fy: 71 };

const sandbox = { console, Math, __relayCoreTimer: Bridge.scheduleTimer, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, RELAY_ASSETS: { sp } };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(coreBundle(repo), sandbox);
const core = sandbox.RelayCore;
const roster = RelayRoster.create(core, sandbox.RELAY_ASSETS);
const rules = { heirloom: !flag('--no-heirloom'), lastStand: !flag('--no-laststand') };

const isBuff = (o, ids) => o.effects.some(e => e.type === 'buff' && ids.includes(e.id));
const gradeRank = { normal: 0, rare: 1, epic: 2, legend: 3, transcendence: 3, event: 2 };
const strength = id => { const c = roster.card(id); return c.stats.hp / 4 + Math.max(c.stats.atk, c.stats.matk) + gradeRank[c.grade] * 30; };

/* The player reads the announced action, finishes when it can, otherwise takes the biggest hit. */
function choose(b, wait) {
  const state = b.state(), me = state.allies[state.cur];
  const usable = b.options().filter(o => o.usable);
  const kill = usable.filter(o => o.preview && o.preview.kill).sort((x, y) => x.cost - y.cost)[0];
  if (kill) return kill.index;
  const intent = wait.intent, incoming = intent.dmg ? intent.dmg[1] : 0;
  if (incoming > 0) {
    const exact = usable.find(o => (intent.kind === 'phy' && isBuff(o, ['barrier'])) || (intent.kind === 'mag' && isBuff(o, ['magic_guard'])));
    if (exact && (intent.name !== '일반 공격' || incoming >= me.hp)) return exact.index;
    const half = usable.find(o => isBuff(o, ['guard', 'damage_half']));
    if (half && !me.buffs.damage_half && (intent.ult || incoming >= me.maxHp * 0.33 || incoming >= me.hp)) return half.index;
  }
  const best = usable.filter(o => o.preview && o.preview.dmg > 0).sort((x, y) => y.preview.dmg - x.preview.dmg)[0];
  return best ? best.index : 0;
}

function fight(run, door, stat) {
  const order = run.bench.slice().sort((a, b) => strength(a) - strength(b)).slice(-3);   // the strongest three, weakest in front
  const opts = Object.assign(R.battleOptions(run, door, order), { rules });
  const b = Bridge.create(core, opts);
  let events = b.start(), all = events.slice(), turns = 0;
  while (b.awaiting && turns < 90) {
    const wait = events.filter(e => e.t === 'await').pop();
    const idx = choose(b, wait), opt = b.options()[idx];
    if (opt && opt.heirloom) stat.heirloomUses++;
    events = b.act(idx); all = all.concat(events); turns++;
  }
  for (const e of all) {
    if (e.t === 'hp' && e.who.side === 'enemy' && e.delta < 0) stat.best = Math.max(stat.best, e.amount);
    if (e.t === 'laststand') stat.lastStands++;
    if (e.t === 'heirloom') stat.heirloomsGained++;
    if (e.t === 'rule') stat.rules[e.rule] = (stat.rules[e.rule] || 0) + 1;
  }
  const res = R.applyBattle(run, roster, door, opts.party, b, all);
  if (res.win && all.some(e => e.t === 'laststand')) stat.clutch++;
  return res;
}

function playRun(seed) {
  const run = R.newRun(core, roster, seed, { plain: flag('--plain') });
  const stat = { best: 0, lastStands: 0, clutch: 0, heirloomsGained: 0, heirloomUses: 0, rules: {}, endFloor: 0, doors: {} };
  const start = flag('--old-start') ? { picks: 1, draws: 2 } : R.START;
  for (let p = 0; p < start.picks; p++) {
    const c = R.pickChoices(run, roster, 3, p ? { near: run.bench[0] } : null);
    R.takePick(run, c, c.slice().sort((a, b) => strength(b) - strength(a))[0]);
  }
  for (let d = 0; d < start.draws; d++) R.drawAwaken(run, roster, true);
  if (args.find(a => a.startsWith('--crystals='))) run.crystals = Number(args.find(a => a.startsWith('--crystals=')).slice(11));
  for (let f = 1; f <= R.FLOORS && !run.result; f++) {
    const doors = R.nextFloor(run, roster);
    const battles = doors.filter(d => d.enemies.length);
    let door = doors[0];
    if (doors.length > 1) {
      const svc = doors.find(d => d.type === 'spring');
      if (svc && run.crystals >= 3) door = svc;
      else if (doors.find(d => d.type === 'altar') && run.bench.length >= 3 && run.rng() < 0.5) door = doors.find(d => d.type === 'altar');
      else door = battles.length ? battles[Math.floor(run.rng() * battles.length)] : doors[0];
    }
    stat.doors[door.type] = (stat.doors[door.type] || 0) + 1;
    if (door.type === 'spring') {
      while (run.crystals >= 3) { const c = R.pickChoices(run, roster, 3); if (!c.length || !R.payPick(run)) break; R.takePick(run, c, c.slice().sort((a, b) => strength(b) - strength(a))[0]); }
      while (run.crystals >= 1 && run.bench.length < 6) if (!R.drawAwaken(run, roster, false)) break;
    } else if (door.type === 'altar') {
      let roll = null;
      for (let i = 0; i < 3; i++) { roll = R.altarRoll(run, roster); if (roll && (roll.jackpot || roll.mult >= 0.3)) break; }
      R.altarKeep(run, roll);
    } else {
      if (!run.bench.length) { run.result = 'lose'; break; }
      const res = fight(run, door, stat);
      if (res.win && door.type === 'gate') { const c = R.gateChoices(run, door); if (c.length) run.bench.push(c[0]); }
    }
    stat.endFloor = f;
  }
  return { run, stat };
}

const agg = { win: 0, end: {}, best: [], lastStands: 0, clutch: 0, heirG: 0, heirU: 0, jackpots: 0, battles: 0, turns: 0, rules: {}, fallen: 0, boss: {} };
for (let i = 1; i <= runs; i++) {
  const { run, stat } = playRun(i * 7919);
  const bs = agg.boss[run.boss] || (agg.boss[run.boss] = { n: 0, win: 0, reached: 0 });
  bs.n++; if (stat.endFloor >= 7) bs.reached++; if (run.result === 'win') bs.win++;
  if (run.result === 'win') agg.win++;
  else agg.end[stat.endFloor] = (agg.end[stat.endFloor] || 0) + 1;
  agg.best.push(stat.best); agg.lastStands += stat.lastStands; agg.clutch += stat.clutch;
  agg.heirG += stat.heirloomsGained; agg.heirU += stat.heirloomUses; agg.jackpots += run.stats.jackpots;
  agg.battles += run.stats.battles; agg.turns += run.stats.turns; agg.fallen += run.fallen.length;
  for (const [k, v] of Object.entries(stat.rules)) agg.rules[k] = (agg.rules[k] || 0) + v;
}
const pct = n => (n / runs * 100).toFixed(0) + '%';
agg.best.sort((a, b) => a - b);
const q = p => agg.best[Math.floor((agg.best.length - 1) * p)];
console.log(`runs ${runs}  ${flag('--plain') ? 'PLAIN (no quirks/affixes)' : 'quirks+affixes'}  heirloom ${rules.heirloom ? 'on' : 'off'}  last stand ${rules.lastStand ? 'on' : 'off'}`);
console.log(`  cleared ${pct(agg.win)}   lost on floor: ${Object.entries(agg.end).sort((a, b) => a[0] - b[0]).map(([f, n]) => f + ':' + pct(n)).join('  ')}`);
console.log(`  boss: ${Object.entries(agg.boss).map(([id, b]) => id + ' ' + b.win + '/' + b.reached).join(', ')}  (wins / reached)`);
console.log(`  per run: battles ${(agg.battles / runs).toFixed(1)}, turns ${(agg.turns / runs).toFixed(0)}, fallen ${(agg.fallen / runs).toFixed(1)}`);
console.log(`  biggest hit per run: median ${q(0.5)}, p90 ${q(0.9)}, max ${q(1)}; runs with a 1000+ hit ${pct(agg.best.filter(x => x >= 1000).length)}`);
console.log(`  heirlooms gained ${(agg.heirG / runs).toFixed(2)}/run, used ${(agg.heirU / runs).toFixed(2)}/run; last stands ${(agg.lastStands / runs).toFixed(2)}/run, won after a last stand ${(agg.clutch / runs).toFixed(2)}/run; jackpots ${(agg.jackpots / runs).toFixed(2)}/run`);
console.log(`  rule events per run: ${Object.entries(agg.rules).map(([k, v]) => k + ' ' + (v / runs).toFixed(2)).join(', ')}`);

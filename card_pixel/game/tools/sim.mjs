// node card_pixel/game/tools/sim.mjs [runs] [--all | --dungeon=<id>] [--difficulty=normal|nightmare]
// Add --contract=rescue|heirloom|elite for the nightmare audit seeds (120 per dungeon by default).
// Use --boss-order-audit for 160 paired first-boss runs in each of the two starting main dungeons.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { CONTRACTS } from '../src/content/contracts.js';
import { DUNGEONS } from '../src/content/dungeons.js';
import * as Bridge from '../src/engine/bridge.js';
import * as Meta from '../src/engine/meta.js';
import * as RelayRoster from '../src/engine/roster.js';
import * as R from '../src/engine/run.js';
import { coreBundle } from './core-bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const contract = args.find(arg => arg.startsWith('--contract='))?.slice('--contract='.length) ?? null;
const runs = Number(args.find(arg => /^\d+$/.test(arg)) || (contract === null ? 300 : 120));
const dungeon = args.find(arg => arg.startsWith('--dungeon='))?.slice('--dungeon='.length) || 'ember_volcano';
const difficulty = args.find(arg => arg.startsWith('--difficulty='))?.slice('--difficulty='.length)
  ?? (flag('--nightmare') || contract !== null ? 'nightmare' : 'normal');
const dungeons = flag('--all') ? Object.keys(DUNGEONS).filter(id => difficulty === 'normal' || DUNGEONS[id].nightmareRule) : [dungeon];
if (!['normal', 'nightmare'].includes(difficulty)) throw new RangeError('Invalid difficulty: ' + difficulty);
if (!runs || dungeons.some(id => !Object.hasOwn(DUNGEONS, id))) throw new RangeError('Invalid run count or dungeon');
if (contract !== null && (!Object.hasOwn(CONTRACTS, contract) || difficulty !== 'nightmare' || dungeons.some(id => !DUNGEONS[id].nightmareRule))) {
  throw new RangeError('Unavailable nightmare contract: ' + contract);
}

const manifest = JSON.parse(fs.readFileSync(path.join(here, '../assets/sprites.json'), 'utf8'));
const sp = Object.fromEntries(Object.entries(manifest).map(([name, sprite]) => [name.replace(/\.png$/, ''), sprite]));
const sandbox = { console, Math, __relayCoreTimer: Bridge.scheduleTimer, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(coreBundle(repo), sandbox);
const core = sandbox.RelayCore;
const roster = RelayRoster.create(core, { sp });
const rules = { heirloom: !flag('--no-heirloom'), lastStand: !flag('--no-laststand') };

const strength = id => RelayRoster.strength(roster.card(id));
const strongest = ids => ids.slice().sort((a, b) => strength(b) - strength(a));
const isBuff = (option, ids) => option.effects.some(effect => effect.type === 'buff' && ids.includes(effect.id));

function chooseAction(bridge, wait, allowDefense, naive, preferHeirloom) {
  const state = bridge.state();
  const fighter = state.allies[state.cur];
  const usable = bridge.options().filter(option => option.usable);
  const kills = usable.filter(option => option.preview?.kill);
  if (preferHeirloom) {
    const heirloom = kills.find(option => option.heirloom);
    if (heirloom) return heirloom.index;
  }
  const kill = naive ? kills[0] : kills.sort((a, b) => a.cost - b.cost)[0];
  if (kill) return kill.index;
  const intent = wait?.intent || {};
  const incoming = intent.dmg?.[1] || 0;
  if (incoming > 0 && allowDefense) {
    const exact = usable.find(option => (intent.kind === 'phy' && isBuff(option, ['barrier']))
      || (intent.kind === 'mag' && isBuff(option, ['magic_guard'])));
    if (exact && (intent.name !== '일반 공격' || incoming >= fighter.hp)) return exact.index;
    const half = usable.find(option => isBuff(option, ['guard', 'damage_half']));
    if (half && !fighter.buffs.damage_half && (intent.ult || incoming >= fighter.maxHp * 0.33 || incoming >= fighter.hp)) return half.index;
  }
  const best = usable.filter(option => option.preview?.dmg > 0).sort((a, b) => b.preview.dmg - a.preview.dmg)[0];
  return best?.index || 0;
}

function checked(result) {
  if (result.ok === false) throw new Error(result.reason);
  return result;
}

function fight(run, { naive, bossSuggestion }) {
  const fixed = run.room.type === 'borrowed';
  let order = run.bench.slice(0, 3);
  if (!fixed && naive && bossSuggestion && run.floor === 8) order = R.suggestOrder(run);
  else if (!fixed && !naive) {
    order = run.stats.retries % 2 ? strongest(run.bench).slice(0, 3) : R.suggestOrder(run);
  }
  checked(R.confirmOrder(run, order));
  const bridge = Bridge.create(core, { ...R.battleOptions(run), rules });
  let events = bridge.start();
  let defended = false;
  if (fixed && !naive && rules.heirloom && run.seed % 2 && bridge.canRetreat()) events = bridge.retreat();
  const targetFloor = (run.floor === 4 || run.floor === 6) && !run.contract?.met;
  for (let actions = 0; bridge.awaiting && actions < 500; actions++) {
    const wait = events.findLast(event => event.t === 'await');
    if (targetFloor && run.contract?.id === 'rescue' && bridge.canRetreat()) {
      const state = bridge.state();
      if (state.allies[state.cur].hp <= (wait?.intent?.dmg?.[0] || 0)) {
        events = bridge.retreat();
        defended = false;
        continue;
      }
    }
    const preferHeirloom = targetFloor && run.contract?.id === 'heirloom';
    const index = chooseAction(bridge, wait, !naive && !defended, naive, preferHeirloom);
    const option = bridge.options().find(item => item.index === index);
    defended = option?.type === 'sup';
    events = bridge.act(index);
  }
  if (!bridge.outcome) throw new Error('Battle did not finish: ' + run.id + ' floor ' + run.floor);
  const summary = bridge.summary();
  checked(R.settleBattle(run, summary));
  return summary.heirloomsGained.length;
}

function chooseDoor(run, naive) {
  const spring = run.doors.find(door => door.type === 'spring');
  const altar = run.doors.find(door => door.type === 'altar');
  if (naive) return spring || run.doors.find(door => door.type === 'treasure') || run.doors[0];
  if (run.contract?.id === 'elite') {
    if (run.floor === 2) return run.doors.find(door => door.risk);
    if (run.floor === 6) return run.doors.find(door => door.type === 'elite');
  }
  if (spring && run.crystals >= (run.bench.length < 3 ? 1 : 3)) return spring;
  if (altar) return altar;
  if (run.floor === 2 && run.doors[1]?.risk) return run.seed % 2 ? run.doors[1] : run.doors[0];
  if (run.doors.some(door => door.type === 'treasure')) {
    return run.doors.find(door => door.type === (run.seed % 3 ? 'treasure' : 'event')) || run.doors[0];
  }
  if (run.doors[1]?.type === 'elite' && run.bench.length >= 4 && run.seed % 4 === 0) return run.doors[1];
  if (run.doors[1]?.intent && run.seed % 2) return run.doors[1];
  return run.doors[0];
}

function resolveChoices(run, naive) {
  while (run.pending) {
    const pending = run.pending;
    if (pending.kind === 'start') {
      const id = naive ? pending.candidates[0] : strongest(pending.candidates)[0];
      checked(R.chooseStartPick(run, id || null));
    }
    else if (pending.kind === 'gate') {
      const id = naive ? pending.candidates[0] : strongest(pending.candidates)[0];
      if (id && (!pending.relic || (!naive && (run.bench.length < 4 || run.seed % 2)))) checked(R.chooseGateReward(run, { kind: 'join', id }));
      else if (pending.relic) checked(R.chooseGateReward(run, { kind: 'relic', id: pending.relic }));
      else break;
    } else if (pending.kind === 'altar') {
      for (let i = 0; i < 3; i++) {
        const roll = checked(R.altarRoll(run));
        if (roll.jackpot || roll.multiplier >= 0.3) break;
      }
      checked(R.altarKeep(run));
    } else if (pending.kind === 'event') {
      const choice = pending.choices.find(entry => entry.enabled && !entry.ops.some(op => op.type === 'release'));
      if (!choice) break;
      checked(R.chooseEvent(run, choice.id, choice.targets ? strongest(choice.targets)[0] : undefined));
    } else if (pending.kind === 'relic') {
      checked(R.equipRelic(run, pending.id, pending.replace[0]));
    } else {
      throw new Error('Unexpected pending choice: ' + pending.kind);
    }
  }
}

function playRun(dungeonId, seed, { profile, naive = false, bossSuggestion = false } = {}) {
  const profileView = profile ? Meta.startView(profile, dungeonId) : undefined;
  const run = R.createRun({ core, roster, dungeonId, difficulty, contract, seed, profileView, plain: flag('--plain') });
  let heirloomsGained = 0;
  resolveChoices(run, naive);
  while (run.phase !== 'done') {
    const door = chooseDoor(run, naive);
    checked(R.chooseDoor(run, door.index));
    if (door.enemies.length) {
      const retries = run.stats.retries;
      do {
        if (run.stats.retries - retries >= 20) throw new Error('Intro retry limit: ' + run.id);
        heirloomsGained += fight(run, { naive, bossSuggestion });
      } while (run.room.status === 'order');
    } else if (door.type === 'spring') {
      if (!naive && run.bench.length < 6 && R.springPick(run).ok) {
        checked(R.springTake(run, strongest(run.pending.candidates)[0]));
      }
      while (run.bench.length < 6 && R.springDraw(run).ok) { /* Draw only while the pool and crystals allow it. */ }
    } else if (door.type === 'treasure') {
      checked(R.takeTreasure(run));
    }
    resolveChoices(run, naive);
    if (run.phase !== 'done') {
      checked(R.leaveRoom(run));
      if (run.phase !== 'done') checked(R.nextFloor(run));
    }
  }
  const end = checked(R.finishRun(run));
  return { run, end, stats: run.stats, fallen: run.fallen.length, heirloomsGained };
}

function measureBossOrder() {
  const pairs = 160;
  let defaultTotal = 0;
  let suggestedTotal = 0;
  const rate = (wins, count) => `${wins}/${count} (${(100 * wins / count).toFixed(1)}%)`;
  console.log('| Dungeon | Default order | Boss suggestion |');
  console.log('| --- | ---: | ---: |');
  for (const id of ['ember_volcano', 'twilight_cathedral']) {
    let defaultWins = 0;
    let suggestedWins = 0;
    for (let i = 1; i <= pairs; i++) {
      const { run, end } = playRun('dawn_forest', 17 + 6151 * i, { naive: true });
      const recruits = end.recruitable.slice(0, 1);
      const intro = Meta.applyRunEnd(Meta.createProfile(), run, { recruits });
      checked(intro.announce);
      const seed = 1000003 + 7919 * i;
      const baseline = playRun(id, seed, { profile: intro.profile, naive: true });
      const suggested = playRun(id, seed, { profile: intro.profile, naive: true, bossSuggestion: true });
      defaultWins += Number(baseline.end.result === 'win');
      suggestedWins += Number(suggested.end.result === 'win');
    }
    defaultTotal += defaultWins;
    suggestedTotal += suggestedWins;
    console.log(`| ${id} | ${rate(defaultWins, pairs)} | ${rate(suggestedWins, pairs)} |`);
  }
  console.log(`| Total | ${rate(defaultTotal, pairs * 2)} | ${rate(suggestedTotal, pairs * 2)} |`);
}

function measureContracts() {
  console.log(`${difficulty} · ${contract} · ${runs} seeds per dungeon`);
  console.log('| Dungeon | Met | Paid | Stamped | Clear |');
  console.log('| --- | ---: | ---: | ---: | ---: |');
  const rate = n => `${n}/${runs} (${(100 * n / runs).toFixed(1)}%)`;
  for (const id of dungeons) {
    const profile = Meta.createProfile();
    profile.unlockedDungeons.push(id);
    profile.nightmareUnlocks.push(id);
    const counts = { met: 0, paid: 0, stamped: 0, clear: 0 };
    for (let i = 1; i <= runs; i++) {
      const { run, end } = playRun(id, 2000003 + 6151 * i, { profile });
      const { announce } = Meta.applyRunEnd(profile, run);
      checked(announce);
      counts.met += Number(run.contract.met);
      counts.paid += Number(run.contract.paid > 0);
      counts.stamped += Number(!!announce.stamp);
      counts.clear += Number(end.result === 'win');
    }
    console.log(`| ${id} | ${Object.values(counts).map(rate).join(' | ')} |`);
  }
}

function measureRuns() {
  console.log(difficulty + ' · ' + runs + ' seeds per dungeon');
  console.log('| Dungeon | Clear | 1,000+ hit | Battles/run | Fallen/run | Heirlooms gained/run | Heirlooms used/run | Last stands/run | Turns/battle | Recruitable/run |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  const percent = n => (n / runs * 100).toFixed(1) + '%';
  const average = n => (n / runs).toFixed(2);
  for (const id of dungeons) {
    const counts = { wins: 0, bigHits: 0, battles: 0, fallen: 0, gained: 0, used: 0, lastStands: 0, turns: 0, recruitable: 0 };
    for (let seed = 1; seed <= runs; seed++) {
      const { end, stats, fallen, heirloomsGained } = playRun(id, seed * 7919);
      counts.wins += Number(end.result === 'win');
      counts.bigHits += Number(stats.best >= 1000);
      counts.battles += stats.battles;
      counts.fallen += fallen;
      counts.gained += heirloomsGained;
      counts.used += stats.heirloomsUsed;
      counts.lastStands += stats.lastStands;
      counts.turns += stats.turns;
      counts.recruitable += end.recruitable.length;
    }
    console.log('| ' + [id, percent(counts.wins), percent(counts.bigHits), average(counts.battles),
      average(counts.fallen), average(counts.gained), average(counts.used), average(counts.lastStands),
      (counts.turns / counts.battles).toFixed(2), average(counts.recruitable)].join(' | ') + ' |');
  }
}

if (flag('--boss-order-audit')) {
  if (difficulty !== 'normal') throw new RangeError('Boss order audit uses normal difficulty');
  measureBossOrder();
} else if (contract !== null) measureContracts();
else measureRuns();

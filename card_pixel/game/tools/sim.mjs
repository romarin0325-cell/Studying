// node card_pixel/game/tools/sim.mjs [runs] [--all | --dungeon=<id>] [--difficulty=normal|nightmare] [--tempo=1|2]
// Add --contract=rescue|heirloom|elite for the nightmare audit seeds (120 per dungeon by default).
// Use --boss-order-audit for 160 paired first-boss runs in each of the two starting main dungeons.
// Use --daily-from=YYYY-MM-DD --days=60 for paired first attempts at the daily rift.
// Use --keep-party to retain careful battle actions while only filling vacant formation seats.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { CONTRACTS } from '../src/content/contracts.js';
import { DUNGEONS } from '../src/content/dungeons.js';
import { ROSTER_LIMIT, TEMPO_VERSION, usesTempo } from '../src/content/tempo.js';
import * as Bridge from '../src/engine/bridge.js';
import * as Daily from '../src/engine/daily-rift.js';
import * as Meta from '../src/engine/meta.js';
import * as RelayRoster from '../src/engine/roster.js';
import * as R from '../src/engine/run.js';
import { coreBundle } from './core-bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const argValue = name => args.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const tempoVersion = Number(argValue('--tempo') ?? TEMPO_VERSION);
const seedOffset = Number(argValue('--seed-offset') ?? 0);
const opening = argValue('--opening');
if (![1, TEMPO_VERSION].includes(tempoVersion) || !Number.isSafeInteger(seedOffset)
  || (opening && !['stand', 'rescue'].includes(opening))) throw new RangeError('Invalid tempo, seed offset or opening');
const dailyFrom = args.find(arg => arg.startsWith('--daily-from='))?.slice('--daily-from='.length);
const days = Number(args.find(arg => arg.startsWith('--days='))?.slice('--days='.length) ?? 60);
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

function shouldRetreat(bridge, wait, rescue = false) {
  if (!bridge.canRetreat() || (!rescue && bridge.options().some(option => option.usable && option.preview?.kill))) return false;
  const state = bridge.state();
  if (state.allies[state.cur].hp > (wait?.intent?.dmg?.[0] || 0)) return false;
  const retreat = bridge.previewRetreat();
  return retreat && !retreat.lethal;
}

function tempoParty(run) {
  const { blessing } = run.room.tempo;
  const scores = new Map(run.bench.map(id => {
    const card = roster.card(id);
    const boost = Math.max(1 + (run.blessings[id] || 0), blessing?.id === id ? blessing.multiplier : 1);
    const affinity = run.room.enemies.reduce((sum, enemy) => sum + core.Logic.getElementalMultiplier(card.element, enemy.element), 0)
      / run.room.enemies.length;
    return [id, (strength(id) + (run.heirlooms[id] ? 15 : 0)) * boost * Math.max(1, affinity)];
  }));
  return run.bench.slice().sort((a, b) => scores.get(b) - scores.get(a)).slice(0, 3).reverse();
}

function prepareRescue(bridge) {
  if (!bridge.canRetreat()) return null;
  const usable = bridge.options().filter(option => option.usable);
  if (!usable.some(option => option.preview?.kill)) return null;
  // Leave the wounded target standing while waiting for a blow that can be intercepted.
  return usable.filter(option => !option.preview?.kill && !option.preview?.delayed)
    .sort((a, b) => (b.preview?.dmg ?? 0) - (a.preview?.dmg ?? 0))[0] ?? null;
}

function fight(run, { naive, bossSuggestion, bossOrder, opening, onBattle }) {
  const fixed = run.room.type === 'borrowed';
  const rescueSetup = usesTempo(run) && run.floor === 6 && run.contract?.id === 'rescue' && !run.contract.met;
  let order = run.bench.slice(0, 3);
  if (run.daily) {
    order = naive ? R.defaultParty(run) : R.suggestOrder(run);
    if (run.room.type === 'boss' && bossOrder) order = bossOrder;
  } else if (!fixed && naive && bossSuggestion && run.floor === 8) order = R.suggestOrder(run);
  else if (!fixed && (naive || flag('--keep-party'))) order = R.defaultParty(run);
  else if (!fixed && !naive) {
    if (run.stats.retries % 2) order = strongest(run.bench).slice(0, 3);
    else order = run.room.tempo ? tempoParty(run) : R.suggestOrder(run);
    if (run.room.tempo && run.floor === 6 && run.contract?.id === 'elite') order.reverse();
    if (rescueSetup && order.length === 3) [order[1], order[2]] = [order[2], order[1]];
  }
  checked(R.confirmOrder(run, order));
  const bridge = Bridge.create(core, { ...R.battleOptions(run), rules });
  let events = bridge.start();
  let defended = false;
  if (fixed && (opening ? opening === 'rescue' : !naive && rules.heirloom && run.seed % 2) && bridge.canRetreat()) events = bridge.retreat();
  const targetFloor = (run.floor === 4 || run.floor === 6) && !run.contract?.met;
  for (let actions = 0; bridge.awaiting && actions < 500; actions++) {
    const wait = events.findLast(event => event.t === 'await');
    if (run.daily && !naive && run.room.type !== 'boss' && shouldRetreat(bridge, wait)) {
      events = bridge.retreat();
      defended = false;
      continue;
    }
    if (targetFloor && run.contract?.id === 'rescue' && shouldRetreat(bridge, wait, true)) {
      events = bridge.retreat();
      defended = false;
      continue;
    }
    const preferHeirloom = targetFloor && run.contract?.id === 'heirloom'
      && (!usesTempo(run) || bridge.enemyIndex === bridge.enemyCount - 1);
    const heirloom = fixed && opening === 'stand' && bridge.options().find(option => option.usable && option.heirloom);
    const setup = rescueSetup && !wait?.intent.lethal && bridge.state().cur === 0 && prepareRescue(bridge);
    const index = (heirloom || setup)?.index ?? chooseAction(bridge, wait, !naive && !defended, naive, preferHeirloom);
    const option = bridge.options().find(item => item.index === index);
    defended = option?.type === 'sup';
    events = bridge.act(index);
  }
  if (!bridge.outcome) throw new Error('Battle did not finish: ' + run.id + ' floor ' + run.floor);
  const summary = bridge.summary();
  const result = checked(R.settleBattle(run, summary));
  onBattle?.(run, bridge.state(), summary, result, order.filter(Boolean));
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
  if (usesTempo(run) && run.contract?.id === 'rescue' && !run.contract.met && run.floor === 6) {
    const shorter = run.doors.reduce((best, door) => door.enemies.length < best.enemies.length ? door : best);
    return shorter;
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
      if (id && (!pending.relic || (!naive && (run.bench.length < 4 || run.seed % 2)))) {
        const replaceId = usesTempo(run) && run.bench.length === ROSTER_LIMIT ? weakestReserve(run) : null;
        if (replaceId && naive) break;
        checked(R.chooseGateReward(run, { kind: 'join', id, replaceId }));
      }
      else if (pending.relic) checked(R.chooseGateReward(run, { kind: 'relic', id: pending.relic }));
      else break;
    } else if (pending.kind === 'reinforcement') {
      const id = naive ? pending.candidates[0] : strongest(pending.candidates)[0];
      const replaceId = run.bench.length === ROSTER_LIMIT ? weakestReserve(run) : null;
      const pass = replaceId && (naive || strength(id) <= strength(replaceId));
      checked(R.resolveReinforcement(run, { key: pending.key, id: pass ? null : id, replaceId: pass ? null : replaceId }));
    } else if (pending.kind === 'altar') {
      for (let i = 0; i < 3; i++) {
        const roll = checked(R.altarRoll(run));
        if (roll.jackpot || roll.multiplier >= 0.3) break;
      }
      checked(R.altarKeep(run));
    } else if (pending.kind === 'event') {
      const choice = pending.choices.find(entry => entry.enabled && !entry.ops.some(op => op.type === 'release')
        && (!usesTempo(run) || !entry.ops.some(op => op.type === 'join' && run.bench.length + (op.ids?.length ?? 1) > ROSTER_LIMIT)));
      if (!choice) break;
      checked(R.chooseEvent(run, choice.id, choice.targets ? strongest(choice.targets)[0] : undefined));
    } else if (pending.kind === 'relic') {
      checked(R.equipRelic(run, pending.id, pending.replace[0]));
    } else {
      throw new Error('Unexpected pending choice: ' + pending.kind);
    }
  }
}

function weakestReserve(run) {
  const reserves = run.bench.filter(id => !run.lastParty?.includes(id));
  return strongest(reserves.length ? reserves : run.bench).at(-1);
}

function playRun(dungeonId, seed, { profile, naive = false, bossSuggestion = false, opening, onBattle, firstMain = false } = {}) {
  const profileView = profile ? Meta.startView(profile, dungeonId) : { bossOrder: firstMain };
  const intro = DUNGEONS[dungeonId].layout === 'intro';
  const run = R.createRun({ core, roster, dungeonId, difficulty: intro ? 'normal' : difficulty,
    contract: intro ? null : contract, seed, profileView, tempoVersion, plain: flag('--plain') });
  let heirloomsGained = 0;
  resolveChoices(run, naive);
  while (run.phase !== 'done') {
    const door = chooseDoor(run, naive);
    checked(R.chooseDoor(run, door.index));
    if (door.enemies.length) {
      const retries = run.stats.retries;
      do {
        if (run.stats.retries - retries >= 20) throw new Error('Intro retry limit: ' + run.id);
        heirloomsGained += fight(run, { naive, bossSuggestion, opening, onBattle });
      } while (run.room.status === 'order');
    } else if (door.type === 'spring') {
      if (!naive && run.bench.length < ROSTER_LIMIT && R.springPick(run).ok) {
        checked(R.springTake(run, strongest(run.pending.candidates)[0]));
      }
      while (run.bench.length < ROSTER_LIMIT && R.springDraw(run).ok) { /* Draw only while the pool and crystals allow it. */ }
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

const DAILY_RELIC_ORDER = ['double_attack', 'gale_storm', 'support_boost', 'lucky_vicky', 'big_bang', 'frozen_body', 'reverse'];
const DAILY_EVENTS = { rumi: 'one', glass_pawprints: 'sand', jellyfish_vials: 'stun' };

function dailyDoor(run, naive) {
  const [left, right] = run.doors;
  if (naive || !right) return left;
  if (run.floor === 2) {
    return DAILY_RELIC_ORDER.indexOf(left.relic) < DAILY_RELIC_ORDER.indexOf(right.relic) ? left : right;
  }
  if (run.floor === 5) return DAILY_RELIC_ORDER.slice(0, 2).includes(left.relic) ? left : right;
  if (run.floor === 6 && run.bench.length >= 4 && !['tough', 'leech', 'glass'].includes(run.daily.spec.riskId)) return right;
  return left;
}

export function playDaily(key, { naive = false, bossOrder = null } = {}) {
  const spec = Daily.specFor(key, roster);
  const run = R.createRun({ core, roster, daily: { spec, kind: 'official', attemptNo: 1 } });
  while (run.phase !== 'done') {
    const door = dailyDoor(run, naive);
    checked(R.chooseDoor(run, door.index));
    if (door.enemies.length) fight(run, { naive, bossOrder });
    else if (door.type === 'treasure') checked(R.takeTreasure(run));
    else if (door.type === 'event') {
      const id = naive ? run.pending.choices[0].id : DAILY_EVENTS[spec.eventId];
      const choice = run.pending.choices.find(entry => entry.id === id);
      checked(R.chooseEvent(run, id, choice.targets ? strongest(choice.targets)[0] : undefined));
    }
    resolveChoices(run, naive);
    if (run.phase !== 'done') {
      checked(R.leaveRoom(run));
      checked(R.nextFloor(run));
    }
  }
  return run;
}

export function dailyTotals(from, count) {
  Daily.specFor(from, roster);
  if (!Number.isSafeInteger(count) || count < 1) throw new RangeError('Invalid daily sample size');
  return [true, false].map(naive => {
    const date = new Date(`${from}T00:00:00Z`);
    let wins = 0, turns = 0;
    for (let i = 0; i < count; i++) {
      const run = playDaily(date.toISOString().slice(0, 10), { naive });
      wins += Number(run.result === 'win');
      turns += run.stats.turns;
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return { policy: naive ? 'Careless' : 'Careful', wins, turns };
  });
}

function measureDaily() {
  const totals = dailyTotals(dailyFrom, days);
  console.log(`${dailyFrom} · ${days} days`);
  console.log('| Policy | Wins | Clear | Total turns |');
  console.log('| --- | ---: | ---: | ---: |');
  for (const { policy, wins, turns } of totals) {
    console.log(`| ${policy} | ${wins}/${days} | ${(100 * wins / days).toFixed(1)}% | ${turns} |`);
  }
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
  console.log(`tempo ${tempoVersion} · ${difficulty} · ${contract} · ${runs} seeds per dungeon`);
  console.log('| Dungeon | Met | Paid | Stamped | Clear |');
  console.log('| --- | ---: | ---: | ---: | ---: |');
  const rate = n => `${n}/${runs} (${(100 * n / runs).toFixed(1)}%)`;
  for (const id of dungeons) {
    const profile = Meta.createProfile();
    profile.unlockedDungeons.push(id);
    profile.nightmareUnlocks.push(id);
    const counts = { met: 0, paid: 0, stamped: 0, clear: 0 };
    for (let i = 1; i <= runs; i++) {
      const { run, end } = playRun(id, seedOffset + 2000003 + 6151 * i, { profile });
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

const ROOM_LABELS = ['B1', 'B2 safe', 'B2 risk', 'B3', 'B4 gate', 'B5 finale', 'B6 wild', 'B6 elite', 'B8 boss', 'Normal battles'];
const percent = (part, whole) => whole ? `${(100 * part / whole).toFixed(1)}%` : '—';

function measureFirstMain() {
  console.log(`tempo ${tempoVersion} · first main · ${runs} seeds per dungeon · careless, default formation`);
  console.log('| Dungeon | Gate pass | Gate reached | Clear |');
  console.log('| --- | ---: | ---: | ---: |');
  for (const id of ['ember_volcano', 'twilight_cathedral']) {
    let gates = 0, reached = 0, wins = 0;
    for (let i = 1; i <= runs; i++) {
      const intro = playRun('dawn_forest', seedOffset + 17 + 6151 * i, { naive: true, opening: i % 2 ? 'stand' : 'rescue' });
      const { profile } = Meta.applyRunEnd(Meta.createProfile(), intro.run, { recruits: intro.end.recruitable.slice(0, 1) });
      const { run } = playRun(id, seedOffset + 1000003 + 7919 * i, { profile, naive: true });
      reached += Number(run.floor >= 4);
      gates += Number(run.stats.gateWins > 0);
      wins += Number(run.result === 'win');
    }
    console.log(`| ${id} | ${gates}/${reached} · ${percent(gates, reached)} | ${reached}/${runs} · ${percent(reached, runs)} | ${wins}/${runs} · ${percent(wins, runs)} |`);
  }
}

function battleMetrics(rooms, run, state, summary, result) {
  const labels = [`B${run.floor}`];
  if (run.floor === 2) labels[0] += run.room.risk ? ' risk' : ' safe';
  if (run.floor === 4) labels[0] += ' gate';
  if (run.floor === 5) labels[0] += ' finale';
  if (run.floor === 6) labels[0] += ` ${run.room.type}`;
  if (run.floor === 8) labels[0] += ' boss';
  if (run.room.type === 'wild') labels.push('Normal battles');
  const allies = state.allies.filter(Boolean);
  const mp = allies.reduce((total, ally) => total + ally.mp, 0) / allies.reduce((total, ally) => total + ally.maxMp, 0);
  const fallen = summary.survivors.filter((alive, index) => !alive && !!state.allies[index]).length;
  for (const label of labels) {
    const row = rooms[label] ||= { count: 0, wins: 0, turns: 0, fallen: 0, loss: 0, mp: 0 };
    row.count++;
    row.wins += Number(result.win && (!result.wiped || run.result === 'win'));
    row.turns += summary.turns;
    row.fallen += fallen;
    row.loss += Number(fallen > 0);
    row.mp += mp;
  }
}

function measureRuns() {
  console.log(`tempo ${tempoVersion} · ${difficulty} · ${runs} seeds per dungeon · offset ${seedOffset}${opening ? ` · ${opening}` : ''}`);
  console.log('Rooms: turns / deaths / MP left / battles with a death / win rate.');
  const summaries = [];
  for (const id of dungeons) {
    const rooms = {};
    const counts = { wins: 0, bossLosses: 0, voluntary: 0, eligible: 0, bigHits: 0, retries: 0 };
    for (let seed = 1; seed <= runs; seed++) {
      let previous = null;
      const onBattle = (run, state, summary, result, party) => {
        battleMetrics(rooms, run, state, summary, result);
        if (previous?.allAlive) {
          counts.eligible++;
          if (party.length !== 3 || party.some(id => !previous.party.includes(id))) counts.voluntary++;
        }
        previous = { party, allAlive: party.length === 3 && result.survivors.length === 3 };
        if (result.result === 'lose' && run.room.type === 'boss') counts.bossLosses++;
      };
      const { end, stats } = playRun(id, seedOffset + seed * 7919, { opening, onBattle, naive: flag('--careless') });
      counts.wins += Number(end.result === 'win');
      counts.bigHits += Number(stats.best >= 1000);
      counts.retries += stats.retries;
    }
    console.log(`\n${id}`);
    console.log('| Room | Battles | Turns / deaths / MP / death chance / win rate |');
    console.log('| --- | ---: | --- |');
    for (const label of ROOM_LABELS) {
      const row = rooms[label];
      if (!row) continue;
      const { count, turns, fallen, loss, mp, wins } = row;
      console.log(`| ${label} | ${count} | ${(turns / count).toFixed(2)} / ${(fallen / count).toFixed(2)} / ${percent(mp, count)} / ${percent(loss, count)} / ${percent(wins, count)} |`);
    }
    summaries.push(`| ${id} | ${counts.wins}/${runs} · ${percent(counts.wins, runs)} | ${percent(counts.bossLosses, runs - counts.wins)} | ${counts.voluntary}/${counts.eligible} · ${percent(counts.voluntary, counts.eligible)} | ${percent(counts.bigHits, runs)} | ${counts.retries} |`);
  }
  console.log('\n| Dungeon | Clear | Final boss share of run losses | Voluntary change | 1,000+ hit | Intro retries |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
  console.log(summaries.join('\n'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (dailyFrom !== undefined) measureDaily();
  else if (flag('--first-main')) {
    if (difficulty !== 'normal') throw new RangeError('First main audit uses normal difficulty');
    measureFirstMain();
  }
  else if (flag('--boss-order-audit')) {
    if (difficulty !== 'normal') throw new RangeError('Boss order audit uses normal difficulty');
    measureBossOrder();
  } else if (contract !== null) measureContracts();
  else measureRuns();
}

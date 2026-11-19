import { DUNGEONS } from '../content/dungeons.js';
import { INTRO } from '../content/intro.js';
import { RELICS } from '../content/relics.js';
import { canJoin, choicesFor, COST, drawFrom, join, RATES, rollBlessing, seeCharacters } from './awakenings.js';
import { pick, shuffle } from './rng.js';
import { copy, eventChoices, grantRelic, invalid, makeDoors, observeDoors, RELIC_LIMIT, resolveEvent } from './rooms.js';

export { COST, RATES };
export const FLOORS = 8;
export const START = { picks: 2, draws: 3 };
const dependencies = new WeakMap();
const unique = ids => [...new Set(ids)];
const battleRoom = run => run.phase === 'room' && run.room?.status === 'battle';
const springRoom = run => run.phase === 'room' && run.room?.type === 'spring' && run.room.status === 'service';

// Keep the card core and sprite registry outside the persisted run.
export function bindRun(run, { core, roster }) {
  dependencies.set(run, { core, roster });
  return run;
}

export function createRun({ core, roster, dungeonId, difficulty = 'normal', seed = 0, profileView = {}, plain = false }) {
  dungeonId ??= profileView.dungeonId || 'dawn_forest';
  const dungeon = DUNGEONS[dungeonId];
  if (!Object.hasOwn(DUNGEONS, dungeonId)) throw new RangeError('Unknown dungeon: ' + dungeonId);
  if (!['normal', 'nightmare'].includes(difficulty) || (difficulty === 'nightmare' && !dungeon.nightmareRule)) {
    throw new RangeError('Unavailable difficulty: ' + difficulty);
  }
  if (profileView.unlockedDungeons && !profileView.unlockedDungeons.includes(dungeonId)) throw new RangeError('Locked dungeon: ' + dungeonId);
  if (difficulty === 'nightmare' && profileView.nightmareUnlocks && !profileView.nightmareUnlocks.includes(dungeonId)) {
    throw new RangeError('Locked nightmare: ' + dungeonId);
  }
  const intro = dungeon.layout === 'intro';
  const rng = { state: seed >>> 0 };
  const seals = profileView.seals || [];
  const companions = intro ? [] : (profileView.companions || []).filter(id => roster.allies.includes(id) && !seals.includes(id));
  const lead = !intro && roster.allies.includes(profileView.lead) && !seals.includes(profileView.lead) ? profileView.lead : null;
  const shard = !intro && roster.allies.includes(profileView.reserved) && !seals.includes(profileView.reserved) ? profileView.reserved : null;
  const pool = roster.pool(dungeon.pool, { seals, companions: [...companions, lead, shard].filter(Boolean) });
  const boss = difficulty === 'nightmare' && dungeon.hiddenBosses.length ? pick(rng, dungeon.hiddenBosses) : dungeon.boss;
  const preview = intro ? INTRO.boss : roster.bossOf(boss);
  const bossPreview = { id: boss, name: preview.name, note: preview.note, sprite: preview.sprite || null };
  const region = dungeon.region?.first ? pick(rng, dungeon.region.first) : dungeon.region;
  const laterRegions = dungeon.region?.second
    ? shuffle(rng, dungeon.region.second.filter(rule => rule.id !== region.id)).slice(0, 2) : null;
  const run = bindRun({
    id: [profileView.runNumber || 1, dungeonId, difficulty, seed >>> 0].join('/'),
    dungeonId, difficulty, floors: dungeon.floors, seed: seed >>> 0, rng, pool, plain,
    phase: 'start', floor: 0, doors: [], room: null, pending: null,
    lead, companions, preferredCompanion: profileView.preferredCompanion || null,
    recruited: (profileView.recruited || []).slice(), profileShard: shard,
    bench: [], fallen: [], released: [], heirlooms: {}, blessings: {}, relics: [], crystals: intro ? 0 : 1,
    eligible: [], gateSurvivors: [], reserved: null, unchosen: [], participated: [], seenCharacters: [], seenRelics: [],
    introCandidates: [], introHeirlooms: {}, firstIntroClear: intro && !profileView.introCleared,
    paidPickUsed: false, boss, bossPreview, region: copy(region), laterRegions: copy(laterRegions), nextBattle: null,
    stats: { battles: 0, turns: 0, best: 0, bestBy: '', bestHit: null, heirloomsUsed: 0, lastStands: 0, jackpots: 0, gateWins: 0, retries: 0 },
    result: null
  }, { core, roster });
  if (intro) {
    for (const id of INTRO.party) join(run, id);
    advance(run);
  } else {
    if (lead) join(run, lead);
    prepareStartPick(run, lead ? 1 : START.picks, lead, [shard].filter(Boolean));
  }
  return run;
}

function advance(run) {
  run.floor++;
  run.room = null;
  run.phase = 'map';
  run.doors = makeDoors(run, dependencies.get(run).roster);
  observeDoors(run);
}

function prepareStartPick(run, remaining, near, priority) {
  const candidates = choicesFor(run, dependencies.get(run).roster, 3, { near, priority });
  seeCharacters(run, candidates);
  run.pending = { kind: 'start', remaining, candidates, near, priority };
}

function completeStart(run) {
  const { roster } = dependencies.get(run);
  run.reserved = pick(run.rng, run.unchosen.filter(id => canJoin(run, id))) || null;
  const awakened = [];
  for (let i = 0; i < START.draws; i++) {
    const id = drawFrom(run, roster, RATES.draw);
    if (!id) break;
    join(run, id);
    awakened.push(id);
  }
  run.crystals = Math.max(1, run.crystals);
  run.pending = null;
  if (run.room) run.room.status = 'resolved';
  else advance(run);
  return awakened;
}

export function chooseStartPick(run, id) {
  const pending = run.pending;
  if (pending?.kind !== 'start') return invalid('no_start_pick');
  if (pending.candidates.length ? !pending.candidates.includes(id) || !canJoin(run, id) : id !== null) {
    return invalid('invalid_candidate');
  }
  if (id) join(run, id);
  run.unchosen = unique([...run.unchosen, ...pending.candidates]).filter(candidate => canJoin(run, candidate));
  if (pending.remaining > 1 && id) {
    // Priority candidates the player did not take yet (intro survivors, the reserved one) stay offered.
    const stillWaiting = (pending.priority || []).filter(other => other !== id && canJoin(run, other));
    prepareStartPick(run, pending.remaining - 1, id, stillWaiting);
    return { ok: true, id, pending: copy(run.pending), awakened: [] };
  }
  return { ok: true, id, awakened: completeStart(run), reserved: run.reserved, pending: null };
}

export function chooseDoor(run, index) {
  if (run.phase !== 'map' || !Number.isInteger(index) || !run.doors[index]) return invalid('invalid_door');
  run.room = { ...copy(run.doors[index]), status: 'service', party: null };
  run.phase = 'room';
  const { core, roster } = dependencies.get(run);
  if (run.room.regionChoice) run.region = copy(run.room.regionChoice);
  if (run.room.enemies.length) run.room.status = 'order';
  if (run.room.type === 'awakening') prepareStartPick(run, START.picks, null, run.introCandidates);
  if (run.room.type === 'altar') run.pending = { kind: 'altar', rolls: 0, roll: null };
  if (run.room.type === 'event') run.pending = { kind: 'event', choices: eventChoices(run, core, roster) };
  return { ok: true, room: copy(run.room), pending: copy(run.pending) };
}

export function confirmOrder(run, ids) {
  if (run.phase !== 'room' || run.room?.status !== 'order') return invalid('no_battle_to_order');
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 3) return invalid('invalid_party');
  const fighters = Array.from(ids).filter(id => id !== null);
  if (!fighters.length || new Set(fighters).size !== fighters.length || fighters.some(id => !run.bench.includes(id))) {
    return invalid('invalid_party');
  }
  const party = [...ids, ...Array(3 - ids.length).fill(null)];
  if (run.room.type === 'borrowed' && INTRO.party.some((id, index) => party[index] !== id)) return invalid('fixed_party');
  run.bench = [...fighters, ...run.bench.filter(id => !fighters.includes(id))];
  run.room.party = party;
  run.room.status = 'battle';
  return { ok: true, party: party.slice() };
}

export function battleOptions(run) {
  if (!battleRoom(run)) return null;
  const room = run.room;
  const next = run.nextBattle;
  const start = room.start || next?.start ? { ...room.start, ...next?.start } : null;
  if (start && (room.start?.field || next?.start?.field)) {
    start.field = unique([...(next?.start?.field || []), ...(room.start?.field || [])]).slice(0, 3);
  }
  const artifacts = unique([...run.relics, next?.relic].filter(Boolean)).slice(0, RELIC_LIMIT);
  return copy({
    party: room.party, enemies: room.enemies, quirk: room.quirk || null,
    seed: room.type === 'borrowed' ? INTRO.seed : (run.seed + run.floor * 1013 + run.stats.battles * 7) >>> 0,
    heirlooms: run.heirlooms, blessings: Object.entries(run.blessings).map(([id, multiplier]) => ({ id, multiplier })),
    artifacts, region: room.region, start, bet: next?.bet || null
  });
}

function summarizeStats(run, summary) {
  const stats = run.stats;
  stats.battles++;
  stats.turns += summary.turns;
  stats.heirloomsUsed += summary.heirloomsUsed;
  stats.lastStands += summary.lastStands;
  if (summary.bestHit?.amount > stats.best) {
    stats.bestHit = copy(summary.bestHit);
    stats.best = summary.bestHit.amount;
    stats.bestBy = summary.bestHit.by;
  }
}

function setGateReward(run, room, downs) {
  run.pending = {
    kind: 'gate',
    candidates: unique(downs.map(entry => room.enemies[entry.idx].source).filter(id => canJoin(run, id, { allowReserved: true }))),
    relic: room.relic
  };
  run.reserved = null;
}

function validSummary(summary, room) {
  return summary && ['win', 'lose'].includes(summary.outcome) && Array.isArray(summary.survivors)
    && room.party.every((id, index) => id === null || typeof summary.survivors[index] === 'boolean')
    && [summary.turns, summary.heirloomsUsed, summary.lastStands].every(n => Number.isInteger(n) && n >= 0)
    && Array.isArray(summary.retreated) && summary.retreated.every(retreated => typeof retreated === 'boolean')
    && (!summary.bestHit || (Number.isFinite(summary.bestHit.amount) && summary.bestHit.amount >= 0
      && typeof summary.bestHit.by === 'string' && typeof summary.bestHit.skill === 'string'))
    && (!summary.bet || (typeof summary.bet.kind === 'string' && typeof summary.bet.won === 'boolean'))
    && Array.isArray(summary.heirloomsGained) && summary.heirloomsGained.every(entry => typeof entry?.to === 'string'
      && typeof entry.from === 'string' && typeof entry.name === 'string')
    && Array.isArray(summary.enemyDowns) && summary.enemyDowns.every(entry => Number.isInteger(entry?.idx)
      && entry.idx >= 0 && entry.idx < room.enemies.length && typeof entry.treasure === 'boolean');
}

export function settleBattle(run, input) {
  if (!battleRoom(run)) return invalid('no_active_battle');
  const room = run.room;
  const summary = typeof input?.summary === 'function' ? input.summary() : input;
  if (!validSummary(summary, room)) return invalid('invalid_battle_summary');
  const win = summary.outcome === 'win';
  const alive = index => summary.survivors[index] || summary.retreated?.[index] === true;
  const survivors = room.party.filter((id, i) => id && alive(i));
  const fallen = room.party.filter((id, i) => id && !alive(i));
  const final = room.type === 'boss' || !!room.final;
  const gate = room.type === 'gate';
  summarizeStats(run, summary);
  run.participated = unique([...run.participated, ...room.party.filter(Boolean)]);
  if (!win && final && gate && run.firstIntroClear) {
    run.stats.retries++;
    room.status = 'order';
    room.party = null;
    return { ok: true, win, retry: true, fallen: [], crystals: 0, result: null };
  }

  const next = run.nextBattle;
  run.nextBattle = null;
  run.fallen.push(...fallen);
  run.bench = run.bench.filter(id => !fallen.includes(id));
  run.eligible = run.eligible.filter(id => !fallen.includes(id));
  for (const id of fallen) {
    delete run.blessings[id];
    delete run.heirlooms[id];
  }
  const heirloomsGained = summary.heirloomsGained.filter(entry => survivors.includes(entry.to));
  for (const { to, from, name } of heirloomsGained) run.heirlooms[to] = { from, name };
  if (gate && win) {
    run.stats.gateWins++;
    run.gateSurvivors = unique([...run.gateSurvivors, ...survivors]);
  }
  if (win && (gate || final)) run.eligible = unique([...run.eligible, ...survivors]);
  const wiped = win && run.bench.length === 0;
  if (!win || (wiped && !final)) run.result = 'lose';
  else if (final) run.result = 'win';

  const { roster } = dependencies.get(run);
  const downs = [...new Map(summary.enemyDowns.map(entry => [entry.idx, entry])).values()];
  let crystals = 0;
  const betWon = win && !!next?.bet && summary.bet?.kind === next.bet.kind && summary.bet?.won === true;
  let relic = null;
  if (win) {
    crystals = (room.reward || 0) + 2 * downs.filter(entry => entry.treasure).length;
    if (survivors.some(id => roster.card(id).trait?.type === 'looter')) crystals++;
    if (betWon) crystals += next.reward.crystals || 0;
    run.crystals += crystals;
    if (gate && !wiped) setGateReward(run, room, downs);
    if (room.type === 'elite' && room.relic && !wiped) relic = grantRelic(run, room.relic);
    if (betWon && next.reward.relic && !wiped) relic = grantRelic(run, next.reward.relic);
    if (room.type === 'borrowed' && !wiped) {
      run.introCandidates = survivors;
      run.introHeirlooms = run.heirlooms;
      run.heirlooms = {};
      run.bench = [];
    }
  }
  room.status = 'resolved';
  run.phase = run.result && !run.pending ? 'done' : 'reward';
  return {
    ok: true, win, wiped, fallen, survivors, heirloomsGained, crystals, relic,
    bet: next?.bet ? { ...next.bet, won: betWon } : null,
    result: run.result, pending: copy(run.pending)
  };
}

export function chooseGateReward(run, choice) {
  const pending = run.pending;
  if (run.phase !== 'reward' || pending?.kind !== 'gate') return invalid('no_gate_reward');
  if (choice?.kind === 'join' && pending.candidates.includes(choice.id) && canJoin(run, choice.id)) {
    join(run, choice.id);
    run.pending = null;
    return { ok: true, joined: choice.id };
  }
  if (choice?.kind === 'relic' && pending.relic && choice.id === pending.relic) {
    run.pending = null;
    return { ok: true, relic: grantRelic(run, choice.id), pending: copy(run.pending) };
  }
  return invalid('invalid_gate_reward');
}

export function springDraw(run) {
  if (!springRoom(run) || run.pending) return invalid('no_waking');
  if (run.crystals < COST.draw) return invalid('insufficient_crystals');
  const id = drawFrom(run, dependencies.get(run).roster, RATES.draw);
  if (!id) return invalid('empty_pool');
  join(run, id);
  run.crystals -= COST.draw;
  return { ok: true, id, cost: COST.draw };
}

export function springPick(run) {
  if (!springRoom(run) || run.pending) return invalid('no_pick_waking');
  if (run.crystals < COST.pick) return invalid('insufficient_crystals');
  const { roster } = dependencies.get(run);
  const available = run.paidPickUsed ? [] : run.companions.filter(id => canJoin(run, id));
  const companion = available.includes(run.preferredCompanion) ? run.preferredCompanion : pick(run.rng, available);
  const candidates = choicesFor(run, roster, 3, { priority: companion ? [companion] : [] });
  if (!candidates.length) return invalid('empty_pool');
  run.crystals -= COST.pick;
  run.paidPickUsed = true;
  run.pending = { kind: 'spring', candidates, cost: COST.pick };
  seeCharacters(run, candidates);
  return { ok: true, candidates: candidates.slice(), cost: COST.pick };
}

export function springTake(run, id) {
  if (!springRoom(run) || run.pending?.kind !== 'spring') return invalid('no_spring_pick');
  if (!run.pending.candidates.includes(id) || !canJoin(run, id)) return invalid('invalid_candidate');
  join(run, id);
  run.pending = null;
  return { ok: true, id };
}

export function altarRoll(run) {
  if (run.phase !== 'room' || run.pending?.kind !== 'altar' || run.pending.rolls >= 3) return invalid('no_altar_roll');
  const roll = rollBlessing(run, dependencies.get(run).roster);
  if (!roll) return invalid('empty_bench');
  run.pending.roll = roll;
  run.pending.rolls++;
  return { ok: true, ...roll, rollsLeft: 3 - run.pending.rolls };
}

export function altarKeep(run) {
  const roll = run.pending?.kind === 'altar' && run.pending.roll;
  if (run.phase !== 'room' || !roll) return invalid('no_altar_blessing');
  run.blessings[roll.id] = roll.multiplier;
  if (roll.jackpot) run.stats.jackpots++;
  run.pending = null;
  run.room.status = 'resolved';
  return { ok: true, ...roll };
}

export function chooseEvent(run, choiceId, targetId) {
  if (run.phase !== 'room' || run.pending?.kind !== 'event') return invalid('no_event');
  const { core, roster } = dependencies.get(run);
  return resolveEvent(run, core, roster, choiceId, targetId);
}

export function takeTreasure(run) {
  if (run.phase !== 'room' || run.room?.type !== 'treasure' || run.room.status !== 'service') return invalid('no_treasure');
  run.room.status = 'resolved';
  return { ok: true, relic: run.room.relic ? grantRelic(run, run.room.relic) : null, pending: copy(run.pending) };
}

export function equipRelic(run, id, replaceId) {
  const pending = run.pending;
  if (pending?.kind !== 'relic' || id !== pending.id || !Object.hasOwn(RELICS, id)
    || run.relics.includes(id) || !pending.replace.includes(replaceId) || !run.relics.includes(replaceId)) {
    return invalid('invalid_relic_replacement');
  }
  if (run.crystals < pending.cost) return invalid('insufficient_crystals');
  run.relics[run.relics.indexOf(replaceId)] = id;
  run.crystals -= pending.cost;
  run.pending = pending.after;
  return { ok: true, id, replaced: replaceId, cost: pending.cost, pending: copy(run.pending) };
}

export function leaveRoom(run) {
  const room = run.room;
  if (!room || !['room', 'reward'].includes(run.phase) || ['battle', 'order', 'left'].includes(room.status)) {
    return invalid('no_room_to_leave');
  }
  const skipped = [];
  if (run.pending?.kind === 'relic') {
    skipped.push(run.pending.id);
    run.pending = run.pending.after;
    if (run.pending) return { ok: true, skipped, pending: copy(run.pending), left: false };
  }
  if (['start', 'spring'].includes(run.pending?.kind) || (run.pending?.kind === 'altar' && run.pending.roll)) {
    return invalid('choice_required');
  }
  run.pending = null;
  room.status = 'left';
  run.phase = run.result ? 'done' : 'reward';
  return { ok: true, skipped, left: true, phase: run.phase };
}

export function nextFloor(run) {
  if (run.phase !== 'reward' || run.room?.status !== 'left' || run.floor >= run.floors) return invalid('cannot_advance');
  advance(run);
  return { ok: true, floor: run.floor, doors: copy(run.doors) };
}

export function runRewards(run) {
  return {
    result: run.result,
    recruitable: run.result === 'win' ? run.eligible.filter(id => run.bench.includes(id)
      && !run.fallen.includes(id) && !run.recruited.includes(id)) : [],
    recruitLimit: run.difficulty === 'nightmare' ? 2 : 1,
    shardCandidates: run.result === 'lose' ? run.participated.filter(id => !run.recruited.includes(id)) : []
  };
}

export function finishRun(run) {
  if (run.phase !== 'done' || !run.result) return invalid('run_not_done');
  const rewards = runRewards(run);
  run.pending ||= { kind: 'recruit', ...copy(rewards) };
  return rewards;
}

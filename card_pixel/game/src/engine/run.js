import { CONTRACTS, CONTRACT_PAYOUT, CONTRACT_RULE_VERSION, gateEscrow, LEGACY_CONTRACT_RULE_VERSION } from '../content/contracts.js';
import { LESSON_VERSION } from '../content/boss-lessons.js';
import { FLOORS as DAILY_FLOORS } from '../content/daily-rift.js';
import { DUNGEONS } from '../content/dungeons.js';
import { PROMISE_EVENTS } from '../content/events.js';
import { INTRO } from '../content/intro.js';
import { LAYOUTS, ROOM_NAMES } from '../content/layouts.js';
import { RELICS, relicPartners } from '../content/relics.js';
import { REINFORCE_CHOICES, REINFORCE_FLOORS, ROSTER_LIMIT, TEMPO_SEEDS, TEMPO_VERSION, usesTempo } from '../content/tempo.js';
import {
  applyDraw, canJoin, choicesFor, COST, drawDistinct, drawEncounter, drawFrom, drawKind, join, RATES,
  release as releaseCompanion, replacementCount, rollBlessing, seeCharacters, seeRelic, usesRepeatDraws, validateReplacements
} from './awakenings.js';
import { dayKey, doorsFor as dailyDoors, validAttempt } from './daily-rift.js';
import { hasFeature, openFeatures } from './entry.js';
import { pick, shuffle } from './rng.js';
import { applyDoorTempo, copy, eventChoices, floorRng, grantRelic, invalid, joinCount, makeDoors, observeDoors, resolveEvent } from './rooms.js';
import { expeditionPool, strength } from './roster.js';
import * as RunBattle from './run-battle.js';

export { COST, RATES };
export { doorEnemies } from './run-battle.js';
export const FLOORS = 8;
export const CHRONICLE_LIMIT = 32;
export const START = { picks: 2, draws: 3 };
const dependencies = new WeakMap();
const unique = ids => [...new Set(ids)];
const springRoom = run => run.phase === 'room' && run.room?.type === 'spring' && run.room.status === 'service';
export const runRoster = run => dependencies.get(run)?.roster;

// Keep the card core and sprite registry outside the persisted run.
export function bindRun(run, { core, roster }) {
  dependencies.set(run, { core, roster });
  let reward = run.pending;
  while (reward?.kind === 'relic') reward = reward.after;
  if (reward?.kind === 'gate' && run.relics?.includes(reward.relic)) reward.relic = null;
  return run;
}

export function createRun(options) {
  const { core, roster, daily = null, plain = false, contract = null } = options;
  let { dungeonId, seed = 0, profileView = {}, difficulty = 'normal' } = options;
  if (daily !== null) {
    if (options.seed !== undefined || dungeonId !== undefined || options.profileView !== undefined
      || difficulty !== 'normal' || plain || contract !== null || !validAttempt(daily, roster)) {
      throw new RangeError('invalid_daily_options');
    }
    ({ dungeonId, seed } = daily.spec);
  }
  dungeonId ??= profileView.dungeonId || 'dawn_forest';
  const dungeon = DUNGEONS[dungeonId];
  if (!Object.hasOwn(DUNGEONS, dungeonId)) throw new RangeError('Unknown dungeon: ' + dungeonId);
  const intro = dungeon.layout === 'intro';
  const features = daily ? null : { ...openFeatures, ...profileView.features };
  if (!intro && features?.difficultyChoice === false && ['normal', 'nightmare'].includes(difficulty)) difficulty = 'easy';
  if (!['easy', 'normal', 'nightmare'].includes(difficulty) || (difficulty === 'nightmare' && !dungeon.nightmareRule)
    || (difficulty === 'easy' && intro)) {
    throw new RangeError('Unavailable difficulty: ' + difficulty);
  }
  if (profileView.unlockedDungeons && !profileView.unlockedDungeons.includes(dungeonId)) throw new RangeError('Locked dungeon: ' + dungeonId);
  if (difficulty === 'nightmare' && profileView.nightmareUnlocks && !profileView.nightmareUnlocks.includes(dungeonId)) {
    throw new RangeError('Locked nightmare: ' + dungeonId);
  }
  const tempoVersion = daily?.spec.ruleVersion ?? options.tempoVersion ?? TEMPO_VERSION;
  if (tempoVersion !== 1 && tempoVersion !== TEMPO_VERSION) throw new RangeError('invalid_tempo_version');
  const lessonVersion = daily || intro || tempoVersion !== TEMPO_VERSION ? 0 : options.lessonVersion ?? LESSON_VERSION;
  if (![0, LESSON_VERSION].includes(lessonVersion)) throw new RangeError('invalid_lesson_version');
  if (contract !== null && (typeof contract !== 'string' || !Object.hasOwn(CONTRACTS, contract) || intro || difficulty !== 'nightmare'
    || !profileView.nightmareUnlocks?.includes(dungeonId))) {
    throw new RangeError('Unavailable contract: ' + String(contract));
  }
  const rng = { state: daily ? daily.spec.altarSeed : seed >>> 0 };
  const seals = features?.prepEditing === false ? [] : profileView.seals || [];
  const companions = intro || features?.prepEditing === false ? []
    : (profileView.companions || []).filter(id => roster.allies.includes(id) && !seals.includes(id));
  const lead = !intro && roster.allies.includes(profileView.lead) && !seals.includes(profileView.lead) ? profileView.lead : null;
  const shard = roster.allies.includes(profileView.reserved) && !seals.includes(profileView.reserved) ? profileView.reserved : null;
  const pool = daily ? daily.spec.loanIds.slice() : expeditionPool(roster, dungeonId, { seals, companions, lead, reserved: shard }).effectiveIds;
  const boss = daily?.spec.bossId
    ?? (difficulty === 'nightmare' && dungeon.hiddenBosses.length ? pick(rng, dungeon.hiddenBosses) : dungeon.boss);
  const preview = intro ? INTRO.boss : roster.bossOf(boss);
  const bossPreview = { id: boss, name: preview.name, note: preview.note, sprite: preview.sprite || null };
  const region = features?.regionRules === false ? null : dungeon.region?.first ? pick(rng, dungeon.region.first) : dungeon.region;
  const laterRegions = features?.regionRules !== false && dungeon.region?.second
    ? shuffle(rng, dungeon.region.second.filter(rule => rule.id !== region.id)).slice(0, 2) : null;
  const run = bindRun({
    id: daily ? `rift/v${daily.spec.ruleVersion}/${daily.spec.dayKey}/${daily.attemptNo}`
      : [profileView.runNumber || 1, dungeonId, difficulty, seed >>> 0].join('/'),
    daily: copy(daily),
    ...(!daily && {
      lessonVersion, entryRulesVersion: 1, features, drawRuleVersion: 2, repeatStacks: {},
      rewardRuleVersion: 2, participationTags: {}
    }),
    ...(lessonVersion && { blessingHistory: [] }),
    tempoVersion, openingLead: null,
    firstMainAssist: !daily && !intro && (difficulty === 'easy' || (tempoVersion === TEMPO_VERSION && difficulty === 'normal'
      && (profileView.firstMainAssist ?? profileView.bossOrder ?? true))),
    dungeonId, difficulty, floors: daily ? DAILY_FLOORS : dungeon.floors, seed: seed >>> 0, rng, pool, plain,
    phase: 'start', floor: 0, doors: [], room: null, pending: null,
    ...(!plain && lessonVersion && features?.pricedEvents && Object.hasOwn(PROMISE_EVENTS, dungeonId) && { promise: null }),
    lead, companions, preferredCompanion: profileView.preferredCompanion || null,
    recruited: (profileView.recruited || []).slice(), profileShard: shard,
    bench: [], joinOrder: [], lastParty: null, fallen: [], released: [], heirlooms: {}, blessings: {}, relics: [],
    chronicle: [],
    crystals: intro || daily ? 0 : 1,
    contract: contract === null ? null : {
      id: contract, ruleVersion: CONTRACT_RULE_VERSION, met: false, metAtFloor: null,
      riskDoorTaken: false, escrowed: 0, paid: 0, failed: false
    },
    guide: { bossOrder: daily ? false : profileView.bossOrder ?? true },
    eligible: [], gateSurvivors: [], reserved: null, unchosen: [], participated: [], seenCharacters: [], seenRelics: [],
    introCandidates: [], introHeirlooms: {}, firstIntroClear: intro && !profileView.introCleared,
    paidPickUsed: false, boss, bossPreview, region: copy(region), laterRegions: copy(laterRegions), nextBattle: null,
    stats: { battles: 0, turns: 0, best: 0, bestBy: '', bestHit: null, heirloomsUsed: 0, lastStands: 0, jackpots: 0, gateWins: 0, retries: 0 },
    result: null
  }, { core, roster });
  if (daily) {
    for (const id of daily.spec.loanIds) join(run, id);
    advance(run);
  } else if (intro) {
    for (const id of INTRO.party) join(run, id);
    advance(run);
  } else {
    if (lead) join(run, lead);
    prepareStartPick(run, lead ? 1 : START.picks, lead, [shard].filter(Boolean));
  }
  return run;
}

function advance(run, roster = dependencies.get(run).roster) {
  const dungeon = DUNGEONS[run.dungeonId];
  run.floor++;
  run.room = null;
  run.phase = 'map';
  if (run.daily) run.doors = dailyDoors(run.daily.spec, run.floor, roster).map(door => ({ ...door, tempo: null }));
  else {
    run.doors = dungeon.layout === 'intro' && run.floor === run.floors
      ? [introFinaleDoor(run, roster, dungeon)]
      : makeDoors(run, roster);
    observeDoors(run);
  }
}

export function previewNextFloor(run) {
  const roster = runRoster(run);
  if (!roster || run.floor >= run.floors) return null;
  const preview = copy(run);
  advance(preview, roster);
  return preview;
}

function introFinaleDoor(run, roster, dungeon) {
  const available = run.pool.filter(id => canJoin(run, id));
  const preferred = available.filter(id => ['rare', 'epic'].includes(roster.card(id).grade));
  const first = run.reserved || pick(run.rng, preferred) || pick(run.rng, available);
  const gentleShadows = run.pool.filter(id => id !== first && INTRO.finaleGrades.includes(roster.card(id).grade));
  const second = pick(run.rng, gentleShadows.filter(id => canJoin(run, id))) ||
    pick(run.rng, gentleShadows.filter(id => !run.fallen.includes(id) && !run.released.includes(id)));
  const tier = dungeon.tiers[run.floor - 1];
  const enemies = [first, second].map(id => id ? roster.shadowOf(id, tier) : roster.wildOf(dungeon.wild[0], tier));
  const template = LAYOUTS.intro[run.floor - 1][0];
  const door = {
    ...template, index: 0, name: ROOM_NAMES[template.type], bg: dungeon.background,
    region: null, enemies, quirk: null, start: null, relic: null
  };
  door.tempo = applyDoorTempo(run, roster, door);
  return door;
}

function prepareStartPick(run, remaining, near, priority) {
  const candidates = choicesFor(run, dependencies.get(run).roster, 3, { near, priority });
  seeCharacters(run, candidates);
  run.pending = { kind: 'start', remaining, candidates, near, priority };
}

function completeStart(run) {
  const { roster } = dependencies.get(run);
  const unchosen = run.unchosen.filter(id => canJoin(run, id));
  run.reserved = pick(run.rng, unchosen) || null;
  if (run.companions.includes(run.reserved)) {
    const spare = unchosen.find(id => !run.companions.includes(id));
    if (spare) run.reserved = spare;
    else if (run.reserved === run.preferredCompanion && unchosen.length > 1) {
      run.reserved = unchosen.find(id => id !== run.preferredCompanion);
    }
  }
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
  const door = Number.isInteger(index) ? run.doors[index] : null;
  if (run.phase !== 'map' || !door) return invalid('invalid_door');
  const promise = run.promise?.floor === run.floor ? run.promise : null;
  if (door.promiseId && (door.promiseId !== promise?.id || door.relic !== promise.relic)) return invalid('invalid_promise_door');
  run.room = { ...copy(door), status: 'service', party: null };
  run.phase = 'room';
  if (promise) {
    run.promise = null;
    // The promise door is appended, so removing it leaves the ordinary doors' indexes intact.
    run.doors = run.doors.filter(entry => !entry.promiseId);
  }
  if (door.promiseId) {
    run.room.status = 'resolved';
    const relic = grantRelic(run, door.relic);
    return { ok: true, room: copy(run.room), pending: copy(run.pending), relic };
  }
  if (run.contract && run.floor === 2 && run.room.risk) run.contract.riskDoorTaken = true;
  const { core, roster } = dependencies.get(run);
  if (run.room.regionChoice) run.region = copy(run.room.regionChoice);
  if (run.room.enemies.length) run.room.status = 'order';
  if (run.room.type === 'awakening') {
    const openingLead = usesTempo(run) && canJoin(run, run.openingLead) ? run.openingLead : null;
    if (openingLead) join(run, openingLead);
    prepareStartPick(run, openingLead ? 1 : START.picks, openingLead, [run.profileShard, ...run.introCandidates].filter(Boolean));
  }
  if (run.room.type === 'altar') run.pending = { kind: 'altar', rolls: 0, roll: null };
  if (run.room.type === 'event') {
    seeCharacters(run, run.room.event?.requires.present ?? []);
    run.pending = { kind: 'event', choices: eventChoices(run, core, roster) };
    for (const choice of run.pending.choices) {
      for (const op of choice.ops) if (op.type === 'promise') seeRelic(run, op.offer.relic);
    }
  }
  return { ok: true, room: copy(run.room), pending: copy(run.pending) };
}

function previewRun(run) {
  const context = dependencies.get(run);
  if (!context) return null;
  // Reuse the real room commands without changing the live RNG, discovery log or pending choice.
  const preview = copy(run);
  dependencies.set(preview, context);
  return preview;
}

export function previewServiceDoor(run, index) {
  const type = run.doors[index]?.type;
  if (run.phase !== 'map' || (type !== 'spring' && type !== 'altar')) return null;
  const preview = previewRun(run);
  if (!preview || !chooseDoor(preview, index).ok) return null;
  return type === 'spring' ? getSpringOffer(preview) : altarRoll(preview);
}

export function previewEventWake(run, index, choiceId) {
  const onMap = run.phase === 'map';
  if (!onMap && run.pending?.kind !== 'event') return null;
  const room = onMap ? run.doors[index] : run.room;
  const choice = room?.event?.choices.find(entry => entry.id === choiceId);
  if (!choice || choice.target || choice.ops.length !== 1) return null;
  const [op] = choice.ops;
  if (op.type !== 'join' || !op.random) return null;

  const preview = previewRun(run);
  if (!preview || (onMap && !chooseDoor(preview, index).ok)) return null;
  let outcome = chooseEvent(preview, choiceId);
  let requiredReleases = 0;
  if (outcome.reason === 'roster_full') {
    requiredReleases = outcome.requiredReleases ?? replacementCount(preview, joinCount(choice.ops));
    // A lone new arrival stays the same regardless of which companion makes room.
    const sample = preview.bench.filter(id => id !== preview.lead).slice(0, requiredReleases);
    outcome = chooseEvent(preview, choiceId, undefined, sample);
  }
  if (!outcome.ok) return null;
  const effect = outcome.effects.find(entry => entry.type === 'join');
  return { id: effect.draw?.id ?? effect.ids[0], kind: effect.draw?.kind ?? 'join', requiredReleases };
}

export function defaultParty(run) {
  const party = (run.lastParty || [null, null, null]).map(id => run.bench.includes(id) ? id : null);
  const reserves = (run.joinOrder ?? run.bench).filter(id => run.bench.includes(id) && !party.includes(id));
  return party.map(id => id ?? reserves.shift() ?? null);
}

export function suggestOrder(run) {
  const { roster } = dependencies.get(run);
  return run.bench.slice().sort((a, b) => strength(roster.card(b)) - strength(roster.card(a))).slice(0, 3).reverse();
}

export function confirmOrder(run, ids) {
  if (run.phase !== 'room' || run.room?.status !== 'order') return invalid('no_battle_to_order');
  const order = validateOrder(run, run.room, ids);
  return order.ok ? applyOrder(run, order) : order;
}

function validateOrder(run, door, ids) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 3) return invalid('invalid_party');
  const fighters = Array.from(ids).filter(id => id !== null);
  if (!fighters.length || new Set(fighters).size !== fighters.length || fighters.some(id => !run.bench.includes(id))) {
    return invalid('invalid_party');
  }
  if (run.daily && fighters.length !== Math.min(3, run.bench.length)) return invalid('invalid_party');
  const party = [...ids, ...Array(3 - ids.length).fill(null)];
  if (door.type === 'borrowed' && INTRO.party.some((id, index) => party[index] !== id)) return invalid('fixed_party');
  return { ok: true, party, fighters };
}

function applyOrder(run, { party, fighters }) {
  // Keep the existing bench order for seeded room choices; defaultParty refills seats by joinOrder.
  run.bench = [...fighters, ...run.bench.filter(id => !fighters.includes(id))];
  run.room.party = party;
  run.lastParty = party.slice();
  run.room.status = 'battle';
  return { ok: true, party: party.slice() };
}

export function enterBattleDoor(run, { floor, index, partyIds } = {}) {
  if (run.phase !== 'map' || floor !== run.floor || !Number.isInteger(index) || run.doors[index]?.index !== index) {
    return invalid('invalid_door');
  }
  const door = run.doors[index];
  if (!door.enemies.length) return invalid('no_battle_to_order');
  const order = validateOrder(run, door, partyIds);
  if (!order.ok) return order;
  chooseDoor(run, index);
  return applyOrder(run, order);
}

export function doorStart(run, index) {
  return RunBattle.doorStart(run, index, dependencies.get(run));
}

export function getTempoView(run, doorIndex) {
  return RunBattle.getTempoView(run, doorIndex, dependencies.get(run), { defaultParty });
}

export function getBlessingView(run, doorIndex, partyIds, id) {
  return RunBattle.getBlessingView(run, doorIndex, partyIds, id, dependencies.get(run));
}

export function battleOptions(run) {
  return RunBattle.battleOptions(run, dependencies.get(run));
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

function setGateReward(run, room, downs, betRelic) {
  run.pending = {
    kind: 'gate',
    candidates: unique(downs.map(entry => room.enemies[entry.idx].source).filter(id => canJoin(run, id, { allowReserved: true }))),
    relic: run.relics.includes(room.relic) || room.relic === betRelic ? null : room.relic
  };
  addGatePartner(run);
  run.reserved = null;
}

function addGatePartner(run) {
  if (run.floor !== 4 || !hasFeature(run, 'relicDoors') || run.pending?.kind !== 'gate') return;
  const partner = relicPartners(run.relics).find(entry => entry.id !== run.pending.relic && entry.id !== run.promise?.relic);
  if (partner) {
    run.pending.partner = partner;
    seeRelic(run, partner.id);
  } else delete run.pending.partner;
}

function setReinforcement(run, roster) {
  if (!usesTempo(run) || DUNGEONS[run.dungeonId].layout === 'intro' || !REINFORCE_FLOORS.includes(run.floor)) return;
  const full = hasFeature(run, 'fullReinforcement');
  if (!full && run.bench.length >= ROSTER_LIMIT) return;
  const count = full ? REINFORCE_CHOICES : 1;
  const preview = { ...run, rng: floorRng(run, TEMPO_SEEDS.reinforcement) };
  const candidates = usesRepeatDraws(run)
    // The reinforcement board shows no rates; three different people make it a real choice.
    ? drawDistinct(preview, roster, 'pick', count)
    : choicesFor(preview, roster, count);
  if (!candidates.length) return;
  seeCharacters(run, candidates);
  run.pending = { kind: 'reinforcement', key: `${run.id}/${run.floor}`, candidates, limit: ROSTER_LIMIT };
}

const PARTICIPATION_RANK = { bench: 0, battle: 1, gate: 2, boss: 3 };

function participationTag(run, id) {
  return run.participationTags?.[id] ?? (run.eligible.includes(id) && run.room?.type === 'boss' && run.room.party?.includes(id) ? 'boss'
    : run.gateSurvivors.includes(id) ? 'gate' : run.participated.includes(id) ? 'battle' : 'bench');
}

function appendChronicle(run, record) {
  const { floor, room } = run;
  run.chronicle = [...(run.chronicle ?? []), { floor, roomType: room.type, ...record }].slice(-CHRONICLE_LIMIT);
}

function release(run, id) {
  releaseCompanion(run, id);
  appendChronicle(run, { released: [id] });
}

function recordBattleChronicle(run, summary, fallen, retry) {
  const party = run.room.party.filter(Boolean);
  const original = id => Object.hasOwn(summary.forms ?? {}, id) ? summary.forms[id] : id;
  const fought = summary.fought?.map(original);
  const transfers = summary.heirloomTransfers
    ?? summary.heirloomsGained.map(({ to, from, name }) => ({ to, from, skill: name }));
  const lastHit = original(summary.lastEnemyKiller ?? null);
  appendChronicle(run, {
    result: summary.outcome, party, fallen: fallen.map(id => ({ id })),
    gained: transfers.map(({ to, from, skill }) => ({ to: original(to), from: original(from), skill })),
    used: (summary.heirloomUses ?? []).map(({ by, from, skill }) => ({ by: original(by), from: original(from), skill })),
    lastHit: party.includes(lastHit) ? lastHit : null,
    bossOrGate: ['boss', 'gate'].includes(run.room.type),
    ...(fought && { fought: party.filter(id => fought.includes(id)) }),
    ...(retry && { retry: true })
  });
}

function recordBattleResult(run, { outcome, wiped, fallen, survivors, heirloomsGained = [], crystals = 0, relics = [] }) {
  delete run.lastBattleRelic;
  delete run.lastBattleRelics;
  run.lastBattleResult = {
    v: 1, floor: run.floor, roomType: run.room.type, outcome, wiped,
    fallenIds: fallen.slice(), survivorIds: survivors.slice(),
    transfers: heirloomsGained.map(({ from, to, name }) => ({ fromId: from, toId: to, skillName: name })),
    rewardDelta: { crystals, relicIds: relics.slice() }
  };
  return run.lastBattleResult;
}

export function recordBattleLog(run, log) {
  if (!['reward', 'result'].includes(run.phase) || run.room?.status !== 'resolved' || !Array.isArray(log)) {
    return invalid('no_battle_result');
  }
  run.lastBattleLog = copy(log);
  return { ok: true };
}

function recordBattleRelic(run, id) {
  const previous = run.lastBattleRelics ?? run.lastBattleResult?.rewardDelta.relicIds ?? [];
  run.lastBattleRelics = unique([...previous.filter(relic => run.relics.includes(relic)), id]);
}

function meetsContract(run, summary, survivors) {
  const legacy = (run.contract.ruleVersion ?? LEGACY_CONTRACT_RULE_VERSION) === LEGACY_CONTRACT_RULE_VERSION;
  switch (run.contract.id) {
    case 'rescue':
      return summary.rescues?.some(({ retreated, incoming, lethal }) =>
        lethal && survivors.includes(retreated) && (!legacy || survivors.includes(incoming)));
    case 'heirloom':
      return (legacy || run.floor === 4) && summary.heirloomKills > 0;
    case 'elite':
      return run.floor === 6 && run.room.type === 'elite' && run.contract.riskDoorTaken && survivors.length >= 2;
  }
}

function settleContract(run, summary, survivors, wiped) {
  const contract = run.contract;
  if (!contract) return { progress: null, crystals: 0 };
  const won = summary.outcome === 'win';
  const { floor } = run;
  let crystals = 0;
  let metNow = false;
  if (won && (floor === 4 || floor === 6) && !contract.met && meetsContract(run, summary, survivors)) {
    contract.met = metNow = true;
    contract.metAtFloor = floor;
  }
  const escrow = won ? gateEscrow(floor, run.room.type) : 0;
  if (escrow) {
    contract.escrowed = escrow;
    crystals -= escrow;
  }
  if (floor === 6) {
    if (won && !wiped && contract.met) {
      contract.paid = CONTRACT_PAYOUT;
      crystals += CONTRACT_PAYOUT;
    } else {
      contract.failed = true;
    }
  }
  const { id, met, escrowed, paid, failed } = contract;
  return { progress: { id, met, metNow, escrowed, paid, failed }, crystals };
}

function validSummary(summary, room) {
  const id = value => typeof value === 'string' && value.length > 0;
  const facts = (values, key) => values === undefined || (Array.isArray(values) && Array.from(values).every(entry =>
    id(entry?.[key]) && id(entry.from) && id(entry.skill)));
  return summary && ['win', 'lose'].includes(summary.outcome) && Array.isArray(summary.survivors)
    && room.party.every((id, index) => id === null || typeof summary.survivors[index] === 'boolean')
    && [summary.turns, summary.heirloomsUsed, summary.lastStands].every(n => Number.isInteger(n) && n >= 0)
    && (summary.heirloomKills === undefined || (Number.isInteger(summary.heirloomKills) && summary.heirloomKills >= 0))
    && (summary.rescues === undefined || (Array.isArray(summary.rescues) && summary.rescues.every(entry =>
      typeof entry?.retreated === 'string' && typeof entry.incoming === 'string' && typeof entry.lethal === 'boolean')))
    && Array.isArray(summary.retreated) && summary.retreated.every(retreated => typeof retreated === 'boolean')
    && (!summary.bestHit || (Number.isFinite(summary.bestHit.amount) && summary.bestHit.amount >= 0
      && typeof summary.bestHit.by === 'string' && typeof summary.bestHit.skill === 'string'))
    && (!summary.bet || (typeof summary.bet.kind === 'string' && typeof summary.bet.won === 'boolean'))
    && Array.isArray(summary.heirloomsGained) && summary.heirloomsGained.every(entry => typeof entry?.to === 'string'
      && typeof entry.from === 'string' && typeof entry.name === 'string')
    && facts(summary.heirloomTransfers, 'to') && facts(summary.heirloomUses, 'by')
    && (summary.fought === undefined || (Array.isArray(summary.fought) && Array.from(summary.fought).every(id)))
    && (summary.forms === undefined || (summary.forms && typeof summary.forms === 'object' && !Array.isArray(summary.forms)
      && Object.values(summary.forms).every(id)))
    && (summary.lastEnemyKiller == null || id(summary.lastEnemyKiller))
    && Array.isArray(summary.enemyDowns) && summary.enemyDowns.every(entry => Number.isInteger(entry?.idx)
      && entry.idx >= 0 && entry.idx < room.enemies.length && typeof entry.treasure === 'boolean');
}

export function settleBattle(run, input) {
  if (!RunBattle.battleRoom(run)) return invalid('no_active_battle');
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
  if (!run.daily) {
    run.rewardRuleVersion = 2;
    run.participationTags ??= {};
    const tag = room.type === 'boss' ? 'boss' : gate ? 'gate' : 'battle';
    for (const id of room.party.filter(Boolean)) {
      const previous = participationTag(run, id);
      run.participationTags[id] = PARTICIPATION_RANK[tag] > PARTICIPATION_RANK[previous] ? tag : previous;
    }
  }
  if (!win && final && gate && run.firstIntroClear) {
    run.stats.retries++;
    recordBattleChronicle(run, summary, fallen, true);
    room.status = 'resolved';
    room.party = null;
    const lastBattleResult = recordBattleResult(run, {
      outcome: summary.outcome, wiped: run.bench.every(id => fallen.includes(id)), fallen, survivors
    });
    run.phase = 'result';
    return { ok: true, win, retry: true, fallen: [], crystals: 0, result: null, contract: null, relic: null, relics: [], lastBattleResult };
  }

  const next = run.nextBattle;
  run.nextBattle = null;
  if (run.lessonVersion) {
    run.blessingHistory = [...(run.blessingHistory ?? []), room.tempo?.blessing?.id ?? null].slice(-2);
  }
  run.fallen.push(...fallen);
  run.bench = run.bench.filter(id => !fallen.includes(id));
  run.eligible = run.eligible.filter(id => !fallen.includes(id));
  for (const id of fallen) {
    delete run.blessings[id];
    delete run.heirlooms[id];
  }
  const heirloomsGained = summary.heirloomsGained.filter(entry => survivors.includes(entry.to));
  for (const { to, ...heirloom } of heirloomsGained) run.heirlooms[to] = copy(heirloom);
  if (gate && win) {
    run.stats.gateWins++;
    run.gateSurvivors = unique([...run.gateSurvivors, ...survivors]);
  }
  if (!run.daily && win && (gate || final)) run.eligible = unique([...run.eligible, ...survivors]);
  const nobodyReturned = run.bench.length === 0;
  const wiped = win && nobodyReturned;
  if (!win || (wiped && !final)) run.result = 'lose';
  else if (final) run.result = 'win';
  if (run.result && run.promise) run.promise = null;

  const { roster } = dependencies.get(run);
  const downs = [...new Map(summary.enemyDowns.map(entry => [entry.idx, entry])).values()];
  const contract = settleContract(run, summary, survivors, wiped);
  let crystals = contract.crystals;
  const betWon = win && hasFeature(run, 'bets') && !!next?.bet && summary.bet?.kind === next.bet.kind && summary.bet?.won === true;
  const betRelic = betWon ? next.reward.relic : null;
  let relic = null;
  const relics = [];
  if (win) {
    if (!run.daily) {
      crystals += (room.reward || 0) + 2 * downs.filter(entry => entry.treasure).length;
      if (survivors.some(id => roster.card(id).trait?.type === 'looter')) crystals++;
      for (const id of survivors) crystals += run.firstSurvivalPay?.[id] ?? 0;
      if (betWon) crystals += next.reward.crystals || 0;
      run.crystals += crystals;
      if (gate && !final && !wiped) setGateReward(run, room, downs, betRelic);
      if (!final && !wiped) setReinforcement(run, roster);
    }
    if (!wiped) {
      for (const id of [(room.type === 'elite' || room.relicReward) && room.relic, betRelic].filter(Boolean)) {
        relic = grantRelic(run, id);
        if (relic.equipped) relics.push(id);
      }
    }
    if (room.type === 'borrowed' && !wiped) {
      if (usesTempo(run)) {
        const first = room.party[0];
        run.openingLead = survivors.includes(first) ? first : heirloomsGained.find(entry => entry.from === first)?.to ?? survivors[0];
      }
      run.introCandidates = survivors;
      run.introHeirlooms = run.heirlooms;
      run.heirlooms = {};
      run.bench = [];
      run.joinOrder = [];
    }
  }
  for (const id of room.party) {
    if (run.firstSurvivalPay) delete run.firstSurvivalPay[id];
  }
  recordBattleChronicle(run, summary, fallen);
  room.status = 'resolved';
  run.phase = run.result ? 'result' : 'reward';
  const lastBattleResult = recordBattleResult(run, {
    outcome: summary.outcome, wiped: nobodyReturned, fallen, survivors, heirloomsGained, crystals, relics
  });
  if (run.result) run.resultRewards = runRewards(run);
  return {
    ok: true, win, wiped, fallen, survivors, heirloomsGained, crystals, relic, relics,
    bet: next?.bet ? { ...next.bet, won: betWon } : null,
    contract: contract.progress,
    result: run.result, pending: copy(run.pending), lastBattleResult
  };
}

export function chooseGateReward(run, choice) {
  const pending = run.pending;
  if (run.phase !== 'reward' || pending?.kind !== 'gate') return invalid('no_gate_reward');
  if (choice?.kind === 'join' && pending.candidates.includes(choice.id) && canJoin(run, choice.id)) {
    const error = validateReplacements(run, 1, choice.replaceId == null ? [] : [choice.replaceId]);
    if (error) return invalid(error);
    if (choice.replaceId != null) release(run, choice.replaceId);
    join(run, choice.id);
    run.pending = null;
    return { ok: true, joined: choice.id };
  }
  const partner = pending.partner;
  const relicOffered = choice?.id && (choice.id === pending.relic ||
    (choice.id === partner?.id && run.relics.includes(partner.held)));
  if (choice?.kind === 'relic' && relicOffered && !run.relics.includes(choice.id)) {
    run.pending = null;
    const relic = grantRelic(run, choice.id);
    if (relic.equipped) recordBattleRelic(run, relic.id);
    return { ok: true, relic, pending: copy(run.pending) };
  }
  return invalid('invalid_gate_reward');
}

export function resolveReinforcement(run, { key, id, replaceId = null } = {}) {
  const pending = run.pending;
  if (run.phase !== 'reward' || pending?.kind !== 'reinforcement' || pending.key !== key) return invalid('invalid_reinforcement_key');
  let draw = null;
  if (id === null) {
    if (replaceId !== null) return invalid('invalid_replacement');
  } else {
    const repeat = usesRepeatDraws(run);
    if (!pending.candidates.includes(id) || !(repeat ? run.pool.includes(id) : canJoin(run, id))) return invalid('invalid_candidate');
    const incoming = Number(!repeat || drawKind(run, id) === 'join');
    const error = validateReplacements(run, incoming, replaceId === null ? [] : [replaceId]);
    if (error) return invalid(error);
    if (replaceId !== null) release(run, replaceId);
    if (repeat) draw = applyDraw(run, id);
    else join(run, id);
  }
  run.pending = null;
  return { ok: true, joined: draw && draw.kind !== 'join' ? null : id, released: replaceId, ...(draw && { draw }) };
}

export function springDraw(run, replaceId = null) {
  if (!springRoom(run) || run.pending) return invalid('no_waking');
  if (run.crystals < COST.draw) return invalid('insufficient_crystals');
  if (usesRepeatDraws(run)) {
    if (replaceId !== null) return invalid('invalid_replacement');
    const id = drawEncounter(run, dependencies.get(run).roster);
    if (!id) return invalid('empty_pool');
    if (drawKind(run, id) === 'join' && run.bench.length >= ROSTER_LIMIT) {
      const serial = (run.room.springDrawSerial ?? 0) + 1;
      run.room.springDrawSerial = serial;
      run.pending = { kind: 'springDraw', key: `${run.id}/${run.floor}/draw/${serial}`, id, cost: COST.draw };
      seeCharacters(run, [id]);
      return { ok: true, id, cost: COST.draw, charged: 0, pending: copy(run.pending) };
    }
    return takeSpringDraw(run, id, COST.draw);
  }
  const error = validateReplacements(run, 1, replaceId === null ? [] : [replaceId]);
  if (error) return invalid(error);
  const id = drawFrom(run, dependencies.get(run).roster, RATES.draw);
  if (!id) return invalid('empty_pool');
  if (replaceId !== null) release(run, replaceId);
  join(run, id);
  run.crystals -= COST.draw;
  return { ok: true, id, cost: COST.draw };
}

function takeSpringDraw(run, id, charged, replaceId = null) {
  if (replaceId !== null) release(run, replaceId);
  const draw = applyDraw(run, id);
  run.crystals -= charged;
  return { ok: true, id, cost: charged, charged, draw };
}

export function commitSpringDraw(run, { key, replaceId = null } = {}) {
  const pending = run.pending;
  if (!springRoom(run) || pending?.kind !== 'springDraw' || pending.key !== key) return invalid('invalid_spring_draw_key');
  if (run.crystals < pending.cost) return invalid('insufficient_crystals');
  const error = validateReplacements(run, 1, replaceId === null ? [] : [replaceId]);
  if (error) return invalid(error);
  run.pending = null;
  return takeSpringDraw(run, pending.id, pending.cost, replaceId);
}

export function springPick(run) {
  if (!hasFeature(run, 'springPick') && run.pending?.kind !== 'spring') return invalid('spring_pick_locked');
  if (usesRepeatDraws(run) || run.lessonVersion) return getSpringOffer(run);
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

export function springTake(run, id, replaceId = null) {
  if ((usesRepeatDraws(run) || run.lessonVersion) && run.room?.springOffer) {
    if (springRoom(run) && id === null && replaceId === null) return { ok: true, id };
    const result = commitSpringOffer(run, { key: run.room.springOffer.key, id, replaceId });
    return result.ok ? { ...result, id } : result;
  }
  if (!springRoom(run) || run.pending?.kind !== 'spring') return invalid('no_spring_pick');
  if (usesTempo(run) && id === null && replaceId === null) {
    run.pending = null;
    return { ok: true, id };
  }
  if (!run.pending.candidates.includes(id) || !canJoin(run, id)) return invalid('invalid_candidate');
  const error = validateReplacements(run, 1, replaceId === null ? [] : [replaceId]);
  if (error) return invalid(error);
  if (replaceId !== null) release(run, replaceId);
  join(run, id);
  run.pending = null;
  return { ok: true, id };
}

function springOfferView(run) {
  if (run.pending?.kind === 'spring') {
    const { candidates, cost } = run.pending;
    const key = `${run.id}/${run.floor}/prepaid`;
    return { ok: true, key, offerKey: key, candidates: candidates.slice(), slots: springSlots(candidates), cost, alreadyPaid: true };
  }
  const { key, candidates, invitedId, slots = springSlots(candidates, invitedId) } = run.room.springOffer;
  return { ok: true, key, offerKey: key, candidates: candidates.slice(), slots: copy(slots), cost: COST.pick, alreadyPaid: false };
}

function springSlots(candidates, invited = null) {
  return candidates.map((id, index) => ({
    slotId: String(index + 1), id, source: index === 0 && id === invited ? 'invite' : 'random'
  }));
}

function repeatSpringOffer(run) {
  if (!run.room.springOffer) {
    const roster = dependencies.get(run).roster;
    const serial = (run.room.springOfferSerial ?? 0) + 1;
    const rng = floorRng(run, 0x05b77a1e ^ Math.imul(serial, 0x9e3779b9));
    const available = run.paidPickUsed ? [] : run.companions.filter(id => canJoin(run, id, { allowReserved: true }));
    const invited = available.includes(run.preferredCompanion) ? run.preferredCompanion : pick(rng, available);
    const candidates = invited ? [invited] : [];
    // Each ◆3 slot is its own draw at the displayed rates, so a repeat is allowed here (표기 확률 = 실제 확률).
    while (candidates.length < 3) {
      const id = drawEncounter({ ...run, rng }, roster, 'pick');
      if (!id) break;
      candidates.push(id);
    }
    if (!candidates.length) return invalid('empty_pool');
    run.room.springOfferSerial = serial;
    run.room.springOffer = {
      key: `${run.id}/${run.floor}/spring/${serial}`, candidates, slots: springSlots(candidates, invited)
    };
  }
  const offer = springOfferView(run);
  seeCharacters(run, offer.candidates);
  return offer;
}

export function getSpringOffer(run) {
  if (!springRoom(run)) return invalid('no_pick_waking');
  if (run.pending?.kind === 'spring') return springOfferView(run);
  if (!hasFeature(run, 'springPick')) return invalid('spring_pick_locked');
  if (run.pending) return invalid('no_pick_waking');
  if (usesRepeatDraws(run)) return repeatSpringOffer(run);
  const prior = run.room.springOffer?.candidates;
  const remaining = prior?.filter(id => canJoin(run, id));
  if (!prior || remaining.length !== prior.length) {
    const { roster } = dependencies.get(run);
    const rng = { ...run.rng };
    let priority = remaining;
    let invitedId = run.room.springOffer?.invitedId ?? null;
    if (!prior) {
      const available = run.paidPickUsed ? [] : run.companions.filter(id => canJoin(run, id));
      invitedId = available.includes(run.preferredCompanion) ? run.preferredCompanion : pick(rng, available) ?? null;
      priority = invitedId ? [invitedId] : [];
    }
    let candidates = choicesFor({ ...run, rng }, roster, 3, { priority });
    if (!candidates.length) return invalid('empty_pool');
    if (prior) {
      const replacements = candidates.slice(remaining.length);
      candidates = prior.map(id => remaining.includes(id) ? id : replacements.shift()).concat(replacements).filter(Boolean);
    }
    const serial = (run.room.springOfferSerial ?? 0) + 1;
    run.room.springOfferSerial = serial;
    run.room.springOffer = {
      key: `${run.id}/${run.floor}/spring/${serial}`, candidates, invitedId, seed: run.rng.state, nextSeed: rng.state
    };
  }
  const offer = springOfferView(run);
  seeCharacters(run, offer.candidates);
  return offer;
}

export function commitSpringOffer(run, { offerKey, key = offerKey, slotId, id, replaceId = null } = {}) {
  if (!springRoom(run) || (run.pending ? run.pending.kind !== 'spring' : !run.room.springOffer)) return invalid('no_spring_pick');
  const offer = springOfferView(run);
  const repeat = usesRepeatDraws(run) && !offer.alreadyPaid;
  if (!offer.alreadyPaid && !hasFeature(run, 'springPick')) return invalid('spring_pick_locked');
  if (key !== offer.key || (offerKey !== undefined && offerKey !== key)
    || (!repeat && !offer.alreadyPaid && offer.candidates.some(id => !canJoin(run, id)))) return invalid('invalid_spring_key');
  if (slotId !== undefined) {
    const slot = offer.slots.find(entry => entry.slotId === slotId);
    if (!slot || (id !== undefined && id !== slot.id)) return invalid('invalid_spring_slot');
    id = slot.id;
  } else if (repeat && offer.candidates.filter(candidate => candidate === id).length > 1) {
    return invalid('ambiguous_spring_slot');
  }
  if (repeat) {
    if (!offer.candidates.includes(id)) return invalid('invalid_candidate');
    if (run.crystals < offer.cost) return invalid('insufficient_crystals');
    const error = validateReplacements(run, Number(drawKind(run, id) === 'join'), replaceId === null ? [] : [replaceId]);
    if (error) return invalid(error);
    const receipt = takeSpringDraw(run, id, offer.cost, replaceId);
    run.paidPickUsed = true;
    delete run.room.springOffer;
    return { ...receipt, joined: receipt.draw.kind === 'join' ? id : null, released: replaceId };
  }
  if (!offer.candidates.includes(id) || !canJoin(run, id)) return invalid('invalid_candidate');
  const error = validateReplacements(run, 1, replaceId === null ? [] : [replaceId]);
  if (error) return invalid(error);
  const charged = offer.alreadyPaid ? 0 : offer.cost;
  if (run.crystals < charged) return invalid('insufficient_crystals');
  if (replaceId !== null) release(run, replaceId);
  join(run, id);
  run.crystals -= charged;
  run.paidPickUsed = true;
  if (offer.alreadyPaid) run.pending = null;
  else {
    const { seed, nextSeed } = run.room.springOffer;
    if (run.rng.state === seed) run.rng.state = nextSeed;
    delete run.room.springOffer;
  }
  return { ok: true, joined: id, released: replaceId, charged };
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

export function chooseEvent(run, choiceId, targetId, replaceIds) {
  if (run.phase !== 'room' || run.pending?.kind !== 'event') return invalid('no_event');
  const { core, roster } = dependencies.get(run);
  const result = resolveEvent(run, core, roster, choiceId, targetId, replaceIds);
  if (!result.ok) return result;
  const released = result.effects.filter(effect => effect.type === 'release').map(({ id }) => id);
  const gained = result.effects.filter(effect => effect.type === 'heirloom')
    .map(({ id, from, name }) => ({ to: id, from, skill: name }));
  if (gained.length || released.length) appendChronicle(run, { eventId: run.room.event.id, gained, released });
  return result;
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
  if (run.pending?.kind === 'gate' && run.relics.includes(run.pending.relic)) run.pending.relic = null;
  addGatePartner(run);
  if (['reward', 'result'].includes(run.phase)) recordBattleRelic(run, id);
  return { ok: true, id, replaced: replaceId, cost: pending.cost, pending: copy(run.pending) };
}

export function confirmResult(run, now = new Date()) {
  if (run.phase !== 'result') return invalid('no_held_result');
  if (!run.result) {
    run.room.status = 'order';
    run.phase = 'room';
    return { ok: true, retry: true, phase: run.phase };
  }
  const exit = exitRoom(run);
  if (exit.left) finishRun(run, now);
  return exit;
}

export function leaveRoom(run) {
  const room = run.room;
  if (!room || !['room', 'reward'].includes(run.phase) || ['battle', 'order', 'left'].includes(room.status)) {
    return invalid('no_room_to_leave');
  }
  return exitRoom(run);
}

function exitRoom(run) {
  const skipped = [];
  if (run.pending?.kind === 'relic') {
    skipped.push(run.pending.id);
    run.pending = run.pending.after;
    if (run.pending) return { ok: true, skipped, pending: copy(run.pending), left: false };
  }
  if (['start', 'spring', 'reinforcement'].includes(run.pending?.kind) || (run.pending?.kind === 'altar' && run.pending.roll)) {
    return invalid('choice_required');
  }
  run.pending = null;
  run.room.status = 'left';
  run.phase = run.result ? 'done' : 'reward';
  return { ok: true, skipped, left: true, phase: run.phase };
}

export function nextFloor(run) {
  if (run.phase !== 'reward' || run.room?.status !== 'left' || run.floor >= run.floors) return invalid('cannot_advance');
  advance(run);
  return { ok: true, floor: run.floor, doors: copy(run.doors) };
}

export function runRewards(run) {
  if (run.daily) return { result: run.result, recruitable: [], recruitTags: {}, recruitLimit: 0, shardCandidates: [] };
  const snapshot = run.pending?.kind === 'recruit' ? run.pending : run.resultRewards;
  const recruitable = snapshot?.recruitable?.slice() ?? (run.result === 'win' ? unique(run.bench).filter(id =>
    !run.fallen.includes(id) && !run.released.includes(id) && !run.recruited.includes(id)) : []);
  return {
    result: run.result,
    recruitable,
    recruitTags: Object.fromEntries(recruitable.map(id => [id, snapshot?.recruitTags?.[id] ?? participationTag(run, id)])),
    recruitLimit: snapshot?.recruitLimit ?? (run.difficulty === 'nightmare' ? 2 : 1),
    shardCandidates: snapshot?.shardCandidates?.slice() ?? (run.result === 'lose' ? run.participated.filter(id => !run.recruited.includes(id)) : [])
  };
}

export function finishRun(run, now = new Date()) {
  if (run.phase !== 'done' || !run.result) return invalid('run_not_done');
  const rewards = runRewards(run);
  if (!run.daily) {
    run.endDayKey ??= dayKey(now);
    if (!run.pending) run.rewardRuleVersion = 2;
    run.pending ||= { kind: 'recruit', ...copy(rewards) };
  }
  delete run.resultRewards;
  return rewards;
}

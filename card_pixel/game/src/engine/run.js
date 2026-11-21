import { CONTRACTS, CONTRACT_ESCROW, CONTRACT_PAYOUT, CONTRACT_RULE_VERSION, LEGACY_CONTRACT_RULE_VERSION } from '../content/contracts.js';
import { LESSON_VERSION } from '../content/boss-lessons.js';
import { BOSSES } from '../content/bosses.js';
import { FLOORS as DAILY_FLOORS } from '../content/daily-rift.js';
import { DUNGEONS } from '../content/dungeons.js';
import { INTRO } from '../content/intro.js';
import { LAYOUTS, ROOM_NAMES } from '../content/layouts.js';
import { RELICS } from '../content/relics.js';
import { EASY_ENEMY_ATTACK, REINFORCE_CHOICES, REINFORCE_FLOORS, ROSTER_LIMIT, TEMPO_SEEDS, TEMPO_VERSION, usesTempo } from '../content/tempo.js';
import { canJoin, choicesFor, COST, drawFrom, join, RATES, release, rollBlessing, seeCharacters, validateReplacements } from './awakenings.js';
import { affixView, create as createBattle, enemyBeats, enemyStatsWithQuirk, fieldCap } from './bridge.js';
import { dayKey, doorsFor as dailyDoors, validAttempt } from './daily-rift.js';
import { pick, shuffle } from './rng.js';
import { applyDoorTempo, copy, eventChoices, floorRng, grantRelic, invalid, makeDoors, observeDoors, RELIC_LIMIT, resolveEvent } from './rooms.js';
import { expeditionPool, strength } from './roster.js';

export { COST, RATES };
export const FLOORS = 8;
export const START = { picks: 2, draws: 3 };
const dependencies = new WeakMap();
const unique = ids => [...new Set(ids)];
const battleRoom = run => run.phase === 'room' && run.room?.status === 'battle';
const springRoom = run => run.phase === 'room' && run.room?.type === 'spring' && run.room.status === 'service';
export const runRoster = run => dependencies.get(run)?.roster;
const enemyAttackScale = run => run.difficulty === 'easy' ? EASY_ENEMY_ATTACK : 1;

// Keep the card core and sprite registry outside the persisted run.
export function bindRun(run, { core, roster }) {
  dependencies.set(run, { core, roster });
  let reward = run.pending;
  while (reward?.kind === 'relic') reward = reward.after;
  if (reward?.kind === 'gate' && run.relics?.includes(reward.relic)) reward.relic = null;
  if (run.room?.type === 'gate' && run.room.final && run.result === 'win'
    && run.phase === 'reward' && (!run.pending || run.pending.kind === 'gate')) {
    run.pending = null;
    run.phase = 'done';
  }
  return run;
}

export function createRun(options) {
  const { core, roster, daily = null, difficulty = 'normal', plain = false, contract = null } = options;
  let { dungeonId, seed = 0, profileView = {} } = options;
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
  const seals = profileView.seals || [];
  const companions = intro ? [] : (profileView.companions || []).filter(id => roster.allies.includes(id) && !seals.includes(id));
  const lead = !intro && roster.allies.includes(profileView.lead) && !seals.includes(profileView.lead) ? profileView.lead : null;
  const shard = roster.allies.includes(profileView.reserved) && !seals.includes(profileView.reserved) ? profileView.reserved : null;
  const pool = daily ? daily.spec.loanIds.slice() : expeditionPool(roster, dungeonId, profileView).effectiveIds;
  const boss = daily?.spec.bossId
    ?? (difficulty === 'nightmare' && dungeon.hiddenBosses.length ? pick(rng, dungeon.hiddenBosses) : dungeon.boss);
  const preview = intro ? INTRO.boss : roster.bossOf(boss);
  const bossPreview = { id: boss, name: preview.name, note: preview.note, sprite: preview.sprite || null };
  const region = dungeon.region?.first ? pick(rng, dungeon.region.first) : dungeon.region;
  const laterRegions = dungeon.region?.second
    ? shuffle(rng, dungeon.region.second.filter(rule => rule.id !== region.id)).slice(0, 2) : null;
  const run = bindRun({
    id: daily ? `rift/v${daily.spec.ruleVersion}/${daily.spec.dayKey}/${daily.attemptNo}`
      : [profileView.runNumber || 1, dungeonId, difficulty, seed >>> 0].join('/'),
    daily: copy(daily),
    ...(!daily && { lessonVersion }),
    ...(lessonVersion && { blessingHistory: [] }),
    tempoVersion, openingLead: null,
    firstMainAssist: !daily && !intro && (difficulty === 'easy' || (tempoVersion === TEMPO_VERSION && difficulty === 'normal'
      && (profileView.firstMainAssist ?? profileView.bossOrder ?? true))),
    dungeonId, difficulty, floors: daily ? DAILY_FLOORS : dungeon.floors, seed: seed >>> 0, rng, pool, plain,
    phase: 'start', floor: 0, doors: [], room: null, pending: null,
    lead, companions, preferredCompanion: profileView.preferredCompanion || null,
    recruited: (profileView.recruited || []).slice(), profileShard: shard,
    bench: [], joinOrder: [], lastParty: null, fallen: [], released: [], heirlooms: {}, blessings: {}, relics: [],
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

function advance(run) {
  const { roster } = dependencies.get(run);
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
  if (run.phase !== 'map' || !Number.isInteger(index) || !run.doors[index]) return invalid('invalid_door');
  run.room = { ...copy(run.doors[index]), status: 'service', party: null };
  run.phase = 'room';
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
  }
  return { ok: true, room: copy(run.room), pending: copy(run.pending) };
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

function battleStart(run, door, artifacts) {
  const eventStart = run.nextBattle?.start;
  if (!door.start && !eventStart) return null;
  const start = { ...door.start, ...eventStart };
  if (door.start?.field || eventStart?.field) {
    const { core } = dependencies.get(run);
    start.field = unique([...(eventStart?.field || []), ...(door.start?.field || [])]).slice(0, fieldCap(core, artifacts));
  }
  return start;
}

function battleArtifacts(run) {
  return unique([...run.relics, run.nextBattle?.relic].filter(Boolean)).slice(0, RELIC_LIMIT);
}

export function doorStart(run, index) {
  const door = run.doors[index];
  if (!door?.enemies.length) return { field: [], enemyDebuffs: {} };
  const artifacts = battleArtifacts(run);
  const start = battleStart(run, door, artifacts);
  const field = unique([...(artifacts.includes('gale_storm') ? ['gale'] : []), ...(start?.field || [])]);
  return { field: field.slice(-fieldCap(dependencies.get(run).core, artifacts)), enemyDebuffs: copy(start?.enemyDebuffs || {}) };
}

export function doorEnemies(run, index) {
  const door = run.doors[index];
  return (door?.enemies || []).map(enemy => {
    const stats = enemyStatsWithQuirk(enemy.stats, door.quirk, enemyAttackScale(run));
    return { ...copy(enemy), stats, maxHp: stats.hp };
  });
}

export function getTempoView(run, doorIndex) {
  const door = run.doors[doorIndex];
  const { core } = dependencies.get(run);
  const suggested = door?.type === 'boss' && run.guide?.bossOrder ? suggestOrder(run) : null;
  return {
    party: door?.type === 'borrowed' ? INTRO.party.slice() : defaultParty(run),
    suggestedParty: suggested ? [suggested[0] ?? null, suggested[1] ?? null, suggested[2] ?? null] : null,
    enemies: doorEnemies(run, doorIndex).map((enemy, index) => ({
      id: enemy.id, name: enemy.name, maxHp: enemy.maxHp, element: enemy.element,
      beats: enemyBeats(core, enemy, door.tempo?.pattern, door.intent, index === 0 ? door.tempo?.lesson : null)
    })),
    pattern: door?.tempo?.pattern ?? null,
    blessing: copy(door?.tempo?.blessing ?? null),
    startMp: door?.tempo?.startMp ?? null,
    enemyKind: door?.enemies[0]?.kind ?? null,
    enemyIndex: door?.enemies.length ? 0 : null,
    enemyCount: door?.enemies.length ?? 0,
    lesson: copy(door?.tempo?.lesson ?? null),
    affixes: (door?.enemies[0]?.affixes ?? []).map(id => affixView(id)),
    bossRule: door?.type === 'boss' ? {
      bossId: run.boss, name: door.enemies[0].name, text: BOSSES[run.boss].note
    } : null
  };
}

function blessingBonus(blessing, id) {
  return blessing?.id === id ? Number((blessing.multiplier - 1).toFixed(2)) : 0;
}

function battleBlessings(run, door) {
  const blessings = { ...run.blessings };
  const blessing = door.tempo?.blessing;
  if (blessing) {
    // The card core stores blessings as a bonus over base stats.
    const bonus = blessingBonus(blessing, blessing.id);
    blessings[blessing.id] = Math.max(blessings[blessing.id] ?? 0, bonus);
  }
  return Object.entries(blessings).map(([id, multiplier]) => ({ id, multiplier }));
}

export function getBlessingView(run, doorIndex, partyIds, id) {
  const { core, roster } = dependencies.get(run);
  const door = run.doors[doorIndex];
  const expeditionBonus = run.blessings[id] ?? 0;
  const battleBonus = blessingBonus(door?.tempo?.blessing, id);
  const active = partyIds.includes(id);
  const effectiveBonus = Math.max(expeditionBonus, battleBonus) * (partyIds.includes('entropy') ? 2 : 1);
  let stats = null;
  if (roster.card(id)) {
    // A reserve has no assigned position. Show its own stats with the selected party's blessing multiplier.
    const party = active ? partyIds : id === 'entropy' || !partyIds.includes('entropy') ? [id] : [id, 'entropy'];
    const options = door?.enemies.length ? optionsForDoor(run, door, party) : {
      party, enemies: [roster.wildOf(INTRO.creature)], blessings: battleBlessings(run, {})
    };
    if (!active && id === 'entropy') {
      const blessing = options.blessings.find(entry => entry.id === id);
      if (blessing) blessing.multiplier /= 2;
    }
    const preview = createBattle(core, options);
    preview.start();
    stats = preview.allyStats(party.indexOf(id));
  }
  return { expeditionBonus, battleBonus, effectiveBonus, active, stats };
}

export function battleOptions(run) {
  if (!battleRoom(run)) return null;
  return copy(optionsForDoor(run, run.room, run.room.party));
}

function optionsForDoor(run, room, party) {
  const artifacts = battleArtifacts(run);
  return {
    party, enemies: room.enemies, quirk: room.quirk || null,
    ...(run.difficulty === 'easy' && { enemyAttackScale: enemyAttackScale(run) }),
    seed: room.type === 'borrowed' ? INTRO.seed : (run.seed + run.floor * 1013 + run.stats.battles * 7) >>> 0,
    heirlooms: run.heirlooms, blessings: battleBlessings(run, room),
    ...(room.tempo && { tempo: room.tempo, openingIntent: room.intent }),
    artifacts, region: room.region, start: battleStart(run, room, artifacts), bet: run.nextBattle?.bet || null
  };
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
  run.reserved = null;
}

function setReinforcement(run, roster) {
  if (!usesTempo(run) || DUNGEONS[run.dungeonId].layout === 'intro' || !REINFORCE_FLOORS.includes(run.floor)) return;
  const candidates = choicesFor({ ...run, rng: floorRng(run, TEMPO_SEEDS.reinforcement) }, roster, REINFORCE_CHOICES);
  if (!candidates.length) return;
  seeCharacters(run, candidates);
  run.pending = { kind: 'reinforcement', key: `${run.id}/${run.floor}`, candidates, limit: ROSTER_LIMIT };
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
  if (won && floor === 4 && run.room.type === 'gate') {
    contract.escrowed = CONTRACT_ESCROW;
    crystals -= CONTRACT_ESCROW;
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
    return { ok: true, win, retry: true, fallen: [], crystals: 0, result: null, contract: null, relic: null, relics: [] };
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
  const wiped = win && run.bench.length === 0;
  if (!win || (wiped && !final)) run.result = 'lose';
  else if (final) run.result = 'win';

  const { roster } = dependencies.get(run);
  const downs = [...new Map(summary.enemyDowns.map(entry => [entry.idx, entry])).values()];
  const contract = settleContract(run, summary, survivors, wiped);
  let crystals = contract.crystals;
  const betWon = win && !!next?.bet && summary.bet?.kind === next.bet.kind && summary.bet?.won === true;
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
      for (const id of [room.type === 'elite' && room.relic, betRelic].filter(Boolean)) {
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
  room.status = 'resolved';
  run.phase = run.result && !run.pending ? 'done' : 'reward';
  return {
    ok: true, win, wiped, fallen, survivors, heirloomsGained, crystals, relic, relics,
    bet: next?.bet ? { ...next.bet, won: betWon } : null,
    contract: contract.progress,
    result: run.result, pending: copy(run.pending)
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
  if (choice?.kind === 'relic' && pending.relic && choice.id === pending.relic && !run.relics.includes(choice.id)) {
    run.pending = null;
    return { ok: true, relic: grantRelic(run, choice.id), pending: copy(run.pending) };
  }
  return invalid('invalid_gate_reward');
}

export function resolveReinforcement(run, { key, id, replaceId = null } = {}) {
  const pending = run.pending;
  if (run.phase !== 'reward' || pending?.kind !== 'reinforcement' || pending.key !== key) return invalid('invalid_reinforcement_key');
  if (id === null) {
    if (replaceId !== null) return invalid('invalid_replacement');
  } else {
    if (!pending.candidates.includes(id) || !canJoin(run, id)) return invalid('invalid_candidate');
    const error = validateReplacements(run, 1, replaceId === null ? [] : [replaceId]);
    if (error) return invalid(error);
    if (replaceId !== null) release(run, replaceId);
    join(run, id);
  }
  run.pending = null;
  return { ok: true, joined: id, released: replaceId };
}

export function springDraw(run, replaceId = null) {
  if (!springRoom(run) || run.pending) return invalid('no_waking');
  if (run.crystals < COST.draw) return invalid('insufficient_crystals');
  const error = validateReplacements(run, 1, replaceId === null ? [] : [replaceId]);
  if (error) return invalid(error);
  const id = drawFrom(run, dependencies.get(run).roster, RATES.draw);
  if (!id) return invalid('empty_pool');
  if (replaceId !== null) release(run, replaceId);
  join(run, id);
  run.crystals -= COST.draw;
  return { ok: true, id, cost: COST.draw };
}

export function springPick(run) {
  if (run.lessonVersion) return getSpringOffer(run);
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
  if (run.lessonVersion && run.room?.springOffer) {
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
    return { ok: true, key: `${run.id}/${run.floor}/prepaid`, candidates: candidates.slice(), cost, alreadyPaid: true };
  }
  const { key, candidates } = run.room.springOffer;
  return { ok: true, key, candidates: candidates.slice(), cost: COST.pick, alreadyPaid: false };
}

export function getSpringOffer(run) {
  if (!springRoom(run)) return invalid('no_pick_waking');
  if (run.pending?.kind === 'spring') return springOfferView(run);
  if (run.pending) return invalid('no_pick_waking');
  const prior = run.room.springOffer?.candidates;
  const remaining = prior?.filter(id => canJoin(run, id));
  if (!prior || remaining.length !== prior.length) {
    const { roster } = dependencies.get(run);
    const rng = { ...run.rng };
    let priority = remaining;
    if (!prior) {
      const available = run.paidPickUsed ? [] : run.companions.filter(id => canJoin(run, id));
      const companion = available.includes(run.preferredCompanion) ? run.preferredCompanion : pick(rng, available);
      priority = companion ? [companion] : [];
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
      key: `${run.id}/${run.floor}/spring/${serial}`, candidates, seed: run.rng.state, nextSeed: rng.state
    };
  }
  const offer = springOfferView(run);
  seeCharacters(run, offer.candidates);
  return offer;
}

export function commitSpringOffer(run, { key, id, replaceId = null } = {}) {
  if (!springRoom(run) || (run.pending?.kind !== 'spring' && !run.room.springOffer)) return invalid('no_spring_pick');
  const offer = springOfferView(run);
  if (key !== offer.key || (!offer.alreadyPaid && offer.candidates.some(id => !canJoin(run, id)))) return invalid('invalid_spring_key');
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
  return resolveEvent(run, core, roster, choiceId, targetId, replaceIds);
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
  if (['start', 'spring', 'reinforcement'].includes(run.pending?.kind) || (run.pending?.kind === 'altar' && run.pending.roll)) {
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
  if (run.daily) return { result: run.result, recruitable: [], recruitLimit: 0, shardCandidates: [] };
  return {
    result: run.result,
    recruitable: run.result === 'win' ? run.eligible.filter(id => run.bench.includes(id)
      && !run.fallen.includes(id) && !run.recruited.includes(id)) : [],
    recruitLimit: run.difficulty === 'nightmare' ? 2 : 1,
    shardCandidates: run.result === 'lose' ? run.participated.filter(id => !run.recruited.includes(id)) : []
  };
}

export function finishRun(run, now = new Date()) {
  if (run.phase !== 'done' || !run.result) return invalid('run_not_done');
  const rewards = runRewards(run);
  if (!run.daily) {
    run.endDayKey ??= dayKey(now);
    run.pending ||= { kind: 'recruit', ...copy(rewards) };
  }
  return rewards;
}

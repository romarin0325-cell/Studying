export const HISTORY_LIMIT = 12;
const BATTLE_RANK = { battle: 1, gate: 2, boss: 3 };
const battleTag = type => type === 'boss' || type === 'gate' ? type : 'battle';

export function returnedCompanions(run) {
  return run.result === 'win'
    ? run.bench.filter(id => !run.fallen.includes(id) && !run.released.includes(id))
    : [];
}

export function chronicle(run) {
  const previousLineups = new Set(run.participated);
  const records = run.chronicle ?? [];
  const battles = records.filter(record => Object.hasOwn(record, 'party'));
  const tracked = battles.some(battle => battle.fought);
  const missingBattles = run.stats?.battles > battles.length;
  const fielded = new Map();
  const lineup = new Map();
  const untracked = new Set();
  const rank = (map, id, tag) => {
    if (BATTLE_RANK[tag] > (BATTLE_RANK[map.get(id)] ?? 0)) map.set(id, tag);
  };
  for (const battle of battles) {
    const tag = battleTag(battle.roomType);
    for (const id of battle.party) {
      rank(lineup, id, tag);
      if (!battle.fought) untracked.add(id);
    }
    for (const id of battle.fought ?? []) rank(fielded, id, tag);
  }
  const fallen = new Set(run.fallen);
  const released = new Set(run.released);
  const returned = new Set(returnedCompanions(run));
  const ids = new Set([...previousLineups, ...lineup.keys(), ...fallen, ...released, ...run.bench, ...(run.joinOrder ?? [])]);
  const entries = Object.fromEntries([...ids].map(id => {
    const fought = tracked ? fielded.has(id) : previousLineups.has(id);
    const uncertain = untracked.has(id) || (missingBattles && previousLineups.has(id));
    const participation = fielded.get(id) ?? (uncertain ? 'unrecorded'
      : lineup.has(id) ? `${lineup.get(id)}-standby` : 'bench');
    const outcome = fallen.has(id) ? 'fell' : released.has(id) ? 'released'
      : returned.has(id) ? fought || (tracked && uncertain) ? 'survived' : 'reserve' : undefined;
    return [id, {
      runId: run.id, dungeonId: run.dungeonId, difficulty: run.difficulty, floor: run.floor, result: run.result,
      fielded: fought, ...(outcome && { outcome }), ...(tracked && { participation }),
      given: [], inherited: [], used: [], victories: []
    }];
  }));

  function inherit(toId, fromId, skillName, source = {}) {
    if (!Object.hasOwn(entries, toId) || !fromId || !skillName) return;
    const inherited = entries[toId].inherited;
    if (!inherited.some(fact => fact.fromId === fromId && fact.skillName === skillName
      && (!source.eventId || (fact.eventId === source.eventId && fact.floor === source.floor)))) {
      inherited.push({ fromId, skillName, ...source });
    }
  }

  function transfer(fromId, toId, skillName, floor) {
    if (!Object.hasOwn(entries, fromId) || !Object.hasOwn(entries, toId) || !skillName) return;
    const given = entries[fromId].given;
    if (!given.some(fact => fact.toId === toId && fact.skillName === skillName && fact.floor === floor)) {
      given.push({ toId, skillName, ...(floor !== undefined && { floor }) });
    }
    inherit(toId, fromId, skillName);
  }

  for (const record of records) {
    const { floor, roomType } = record;
    if (!Object.hasOwn(record, 'party')) {
      for (const id of record.released) {
        if (released.has(id)) entries[id].releasedFloor = floor;
      }
      for (const { to, from, skill } of record.gained ?? []) {
        inherit(to, from, skill, { eventId: record.eventId, floor });
      }
      continue;
    }
    if (!record.retry) {
      for (const { id } of record.fallen) {
        if (fallen.has(id)) entries[id].fallenFloor = floor;
      }
    }
    for (const { to, from, skill } of record.gained) transfer(from, to, skill, floor);
    const won = record.result === 'win';
    for (const { by, from, skill } of record.used) {
      if (!Object.hasOwn(entries, by)) continue;
      inherit(by, from, skill);
      entries[by].used.push({ fromId: from, skillName: skill, floor, roomType, won });
    }
    if (won && record.bossOrGate) {
      for (const id of record.fought ?? []) {
        entries[id].victories.push({ roomType, floor, ...(record.lastHit === id && { lastHit: true }) });
      }
    }
  }

  const held = { ...run.introHeirlooms, ...run.heirlooms };
  if (battles.length) {
    for (const [toId, heirloom] of Object.entries(held)) inherit(toId, heirloom?.from, heirloom?.name);
    return entries;
  }

  // Saves made before battle records existed only have the most recent settlement and log.
  const last = run.lastBattleResult;
  const legacyTransfer = (fromId, toId, skillName) => {
    if (fallen.has(fromId)) transfer(fromId, toId, skillName);
  };
  for (const id of last?.fallenIds ?? []) {
    if (fallen.has(id)) entries[id].fallenFloor = last.floor;
  }
  for (const { fromId, toId, skillName } of last?.transfers ?? []) legacyTransfer(fromId, toId, skillName);
  for (const [toId, heirloom] of Object.entries(run.introHeirlooms ?? {})) {
    // This stock comes only from the borrowed battle. The main stock also gets event rewards.
    legacyTransfer(heirloom?.from, toId, heirloom?.name);
  }
  for (const [toId, heirloom] of Object.entries(held)) inherit(toId, heirloom?.from, heirloom?.name);

  const lastParty = new Set([...(last?.survivorIds ?? []), ...(last?.fallenIds ?? [])]);
  if (last && Array.isArray(run.lastBattleLog)) {
    for (const turn of run.lastBattleLog) {
      const rows = turn?.rows;
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!Array.isArray(row?.faces)) continue;
        const { kind, text: skillName, faces: [user, other] } = row;
        if (user?.side !== 'ally' || other?.side !== 'ally' || !lastParty.has(user.id) || !Object.hasOwn(entries, user.id)) continue;
        if (kind === 'heirloom' && lastParty.has(other.id)) legacyTransfer(user.id, other.id, skillName);
        if (!['heirloom-use', 'reserve', 'trigger', 'charge'].includes(kind) || !other.id || !skillName) continue;
        const heirloom = held[user.id];
        const fromId = heirloom?.name === skillName && [heirloom.from, heirloom.form, heirloom.skill?.heirFrom].includes(other.id)
          ? heirloom.from : other.id;
        inherit(user.id, fromId, skillName);
        const used = entries[user.id].used;
        if (!used.some(fact => fact.fromId === fromId && fact.skillName === skillName)) {
          used.push({ fromId, skillName, floor: last.floor, roomType: last.roomType, won: last.outcome === 'win' });
        }
      }
    }
  }

  if (last?.outcome === 'win' && ['gate', 'boss'].includes(last.roomType)) {
    for (const id of lastParty) {
      if (previousLineups.has(id)) entries[id].victories.push({ roomType: last.roomType, floor: last.floor });
    }
  }
  for (const id of run.gateSurvivors ?? []) {
    if (previousLineups.has(id) && !entries[id].victories.some(fact => fact.roomType === 'gate')) {
      entries[id].victories.push({ roomType: 'gate' });
    }
  }
  return entries;
}

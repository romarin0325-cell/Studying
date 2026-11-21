export const HISTORY_LIMIT = 12;

export function returnedCompanions(run) {
  return run.result === 'win'
    ? run.bench.filter(id => !run.fallen.includes(id) && !run.released.includes(id))
    : [];
}

export function chronicle(run) {
  const fielded = new Set(run.participated);
  const fallen = new Set(run.fallen);
  const released = new Set(run.released);
  const returned = new Set(returnedCompanions(run));
  const ids = new Set([...fielded, ...fallen, ...released, ...run.bench, ...(run.joinOrder ?? [])]);
  const last = run.lastBattleResult;
  const entries = Object.fromEntries([...ids].map(id => {
    const outcome = fallen.has(id) ? 'fell' : released.has(id) ? 'released'
      : returned.has(id) ? fielded.has(id) ? 'survived' : 'reserve' : undefined;
    return [id, {
      runId: run.id, dungeonId: run.dungeonId, difficulty: run.difficulty, floor: run.floor, result: run.result,
      fielded: fielded.has(id), ...(outcome && { outcome }),
      ...(outcome === 'fell' && last?.fallenIds.includes(id) && { fallenFloor: last.floor }),
      given: [], inherited: [], used: [], victories: []
    }];
  }));

  function inherit(toId, fromId, skillName) {
    if (!Object.hasOwn(entries, toId) || !fromId || !skillName) return;
    const inherited = entries[toId].inherited;
    if (!inherited.some(fact => fact.fromId === fromId && fact.skillName === skillName)) {
      inherited.push({ fromId, skillName });
    }
  }

  function transfer(fromId, toId, skillName) {
    if (!fallen.has(fromId) || !Object.hasOwn(entries, toId) || !skillName) return;
    const given = entries[fromId].given;
    if (!given.some(fact => fact.toId === toId && fact.skillName === skillName)) given.push({ toId, skillName });
    inherit(toId, fromId, skillName);
  }

  const held = { ...run.introHeirlooms, ...run.heirlooms };
  for (const { fromId, toId, skillName } of last?.transfers ?? []) transfer(fromId, toId, skillName);
  for (const [toId, heirloom] of Object.entries(run.introHeirlooms ?? {})) {
    // This stock comes only from the borrowed battle. The main stock also gets event rewards.
    transfer(heirloom?.from, toId, heirloom?.name);
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
        if (kind === 'heirloom' && lastParty.has(other.id)) transfer(user.id, other.id, skillName);
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
      if (fielded.has(id)) entries[id].victories.push({ roomType: last.roomType, floor: last.floor });
    }
  }
  for (const id of run.gateSurvivors ?? []) {
    if (fielded.has(id) && !entries[id].victories.some(fact => fact.roomType === 'gate')) {
      entries[id].victories.push({ roomType: 'gate' });
    }
  }
  return entries;
}

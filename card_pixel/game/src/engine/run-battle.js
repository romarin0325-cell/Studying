import { BOSSES } from '../content/bosses.js';
import { INTRO } from '../content/intro.js';
import { EASY_ENEMY_ATTACK } from '../content/tempo.js';
import { affixView, create as createBattle, enemyBeats, enemyStatsWithQuirk, fieldCap } from './bridge.js';
import { copy, RELIC_LIMIT } from './rooms.js';

const unique = ids => [...new Set(ids)];
const enemyAttackScale = run => run.difficulty === 'easy' ? EASY_ENEMY_ATTACK : 1;

export const battleRoom = run => run.phase === 'room' && run.room?.status === 'battle';

function battleStart(run, door, artifacts, binding) {
  const eventStart = run.nextBattle?.start;
  if (!door.start && !eventStart) return null;
  const start = { ...door.start, ...eventStart };
  if (door.start?.field || eventStart?.field) {
    const { core } = binding;
    start.field = unique([...(eventStart?.field || []), ...(door.start?.field || [])]).slice(0, fieldCap(core, artifacts));
  }
  return start;
}

function battleArtifacts(run) {
  return unique([...run.relics, run.nextBattle?.relic].filter(Boolean)).slice(0, RELIC_LIMIT);
}

export function doorStart(run, index, binding) {
  const door = run.doors[index];
  if (!door?.enemies.length) return { field: [], enemyDebuffs: {} };
  const artifacts = battleArtifacts(run);
  const start = battleStart(run, door, artifacts, binding);
  const field = unique([...(artifacts.includes('gale_storm') ? ['gale'] : []), ...(start?.field || [])]);
  return { field: field.slice(-fieldCap(binding.core, artifacts)), enemyDebuffs: copy(start?.enemyDebuffs || {}) };
}

export function doorEnemies(run, index) {
  const door = run.doors[index];
  return (door?.enemies || []).map(enemy => {
    const stats = enemyStatsWithQuirk(enemy.stats, door.quirk, enemyAttackScale(run));
    return { ...copy(enemy), stats, maxHp: stats.hp };
  });
}

export function getTempoView(run, doorIndex, binding, { defaultParty, suggestOrder }) {
  const door = run.doors[doorIndex];
  const { core } = binding;
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

export function getBlessingView(run, doorIndex, partyIds, id, binding) {
  const { core, roster } = binding;
  const door = run.doors[doorIndex];
  const expeditionBonus = run.blessings[id] ?? 0;
  const battleBonus = blessingBonus(door?.tempo?.blessing, id);
  const active = partyIds.includes(id);
  const effectiveBonus = Math.max(expeditionBonus, battleBonus) * (partyIds.includes('entropy') ? 2 : 1);
  let stats = null;
  if (roster.card(id)) {
    // A reserve has no assigned position. Show its own stats with the selected party's blessing multiplier.
    const party = active ? partyIds : id === 'entropy' || !partyIds.includes('entropy') ? [id] : [id, 'entropy'];
    const options = door?.enemies.length ? optionsForDoor(run, door, party, binding) : {
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

export function battleOptions(run, binding) {
  if (!battleRoom(run)) return null;
  return copy(optionsForDoor(run, run.room, run.room.party, binding));
}

function optionsForDoor(run, room, party, binding) {
  const artifacts = battleArtifacts(run);
  return {
    party, enemies: room.enemies, quirk: room.quirk || null,
    ...(run.difficulty === 'easy' && { enemyAttackScale: enemyAttackScale(run) }),
    seed: room.type === 'borrowed' ? INTRO.seed : (run.seed + run.floor * 1013 + run.stats.battles * 7) >>> 0,
    heirlooms: run.heirlooms, blessings: battleBlessings(run, room),
    ...(room.tempo && { tempo: room.tempo, openingIntent: room.intent }),
    artifacts, region: room.region, start: battleStart(run, room, artifacts, binding), bet: run.nextBattle?.bet || null
  };
}

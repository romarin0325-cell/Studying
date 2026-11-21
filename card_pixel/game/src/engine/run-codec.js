import { DUNGEONS } from '../content/dungeons.js';
import { CONTRACT_RULE_VERSION, CONTRACTS, LEGACY_CONTRACT_RULE_VERSION } from '../content/contracts.js';
import { calendarDate } from './dates.js';
import { bindRun } from './run.js';

export const RUN_VERSION = 1;
const PHASES = ['start', 'map', 'room', 'reward', 'done'];

export const dictionary = value => !!value && typeof value === 'object' && !Array.isArray(value);
export const count = value => Number.isSafeInteger(value) && value >= 0;
export const string = value => typeof value === 'string' && value.length > 0;
export const strings = value => Array.isArray(value) && Array.from(value).every(string);

export function parse(data) {
  try {
    return typeof data === 'string' ? JSON.parse(data) : structuredClone(data);
  } catch {
    return null;
  }
}

export function readVersion(data, version, migrate) {
  const decoded = parse(data);
  const migrated = decoded && decoded.version !== version ? migrate?.(decoded, version) : decoded;
  return migrated?.version === version ? migrated : null;
}

export function runData(run) {
  const fighting = run.phase === 'room' && run.room?.status === 'battle';
  const snapshot = fighting ? { ...run, room: { ...run.room, status: 'order' } } : run;
  return { version: RUN_VERSION, run: snapshot };
}

export function serializeRun(run) {
  return JSON.stringify(runData(run));
}

export function restoreRun(data, { core, roster, migrate } = {}) {
  const run = readVersion(data, RUN_VERSION, migrate)?.run;
  if (!dictionary(run) || !string(run.id) || !Object.hasOwn(DUNGEONS, run.dungeonId) || !PHASES.includes(run.phase)
    || !['easy', 'normal', 'nightmare'].includes(run.difficulty)
    || (run.difficulty !== 'normal' && (run.daily || DUNGEONS[run.dungeonId].layout === 'intro'))
    || !count(run.floor) || !count(run.floors) || run.floor > run.floors || !count(run.crystals)
    || !Number.isInteger(run.rng?.state) || run.rng.state < 0 || run.rng.state > 0xffffffff
    || !['pool', 'bench', 'fallen', 'released', 'relics', 'companions', 'recruited', 'eligible', 'gateSurvivors', 'participated',
      'seenCharacters', 'seenRelics', 'unchosen', 'introCandidates'].every(key => strings(run[key]))
    || !['heirlooms', 'blessings', 'stats', 'introHeirlooms'].every(key => dictionary(run[key]))
    || !count(run.stats.gateWins) || !count(run.stats.turns) || !count(run.stats.heirloomsUsed)
    || !Array.isArray(run.doors) || !Array.from(run.doors).every(validDoor)
    || (run.room !== null && (!validDoor(run.room) || !string(run.room.status)))
    || (run.phase === 'room' && !run.room) || (run.phase === 'map' && !run.doors.length)
    || (run.phase === 'done' && !['win', 'lose'].includes(run.result))
    || (run.endDayKey != null && !calendarDate(run.endDayKey))) return null;
  run.contract ??= null;
  if (run.contract !== null) {
    if (!dictionary(run.contract) || !Object.hasOwn(CONTRACTS, run.contract.id)) return null;
    run.contract.ruleVersion ??= LEGACY_CONTRACT_RULE_VERSION;
    if (![LEGACY_CONTRACT_RULE_VERSION, CONTRACT_RULE_VERSION].includes(run.contract.ruleVersion)) return null;
  }
  run.daily ??= null;
  run.tempoVersion ??= run.daily?.spec?.ruleVersion ?? 1;
  if (!run.daily) run.lessonVersion ??= 0;
  run.firstMainAssist ??= false;
  run.openingLead ??= null;
  for (const door of run.doors) door.tempo ??= null;
  if (run.room) run.room.tempo ??= null;
  run.lastParty ??= null;
  run.guide ??= { bossOrder: false };
  run.joinOrder ??= run.bench.slice();
  return bindRun(run, { core, roster });
}

function validDoor(door) {
  return dictionary(door) && string(door.type) && Array.isArray(door.enemies)
    && Array.from(door.enemies).every(enemy => dictionary(enemy) && string(enemy.id)
      && Array.isArray(enemy.skills) && ['hp', 'atk', 'matk', 'def', 'mdef'].every(key => Number.isFinite(enemy.stats?.[key])));
}

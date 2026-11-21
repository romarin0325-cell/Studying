import { DUNGEONS } from '../content/dungeons.js';
import { CONTRACT_RULE_VERSION, CONTRACTS, LEGACY_CONTRACT_RULE_VERSION } from '../content/contracts.js';
import { calendarDate } from './dates.js';
import { openFeatures } from './entry.js';
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
    || (run.endDayKey != null && !calendarDate(run.endDayKey)) || !validEntryRules(run)) return null;
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

const recruitTags = tags => dictionary(tags) && Object.values(tags).every(tag => ['boss', 'gate', 'battle', 'bench'].includes(tag));

function validEntryRules(run) {
  const { features, lastBattleResult, repeatStacks, participationTags, pending } = run;
  if (run.entryRulesVersion !== undefined && run.entryRulesVersion !== 1) return false;
  if (features !== undefined && (!dictionary(features) || !Object.keys(openFeatures).every(key => typeof features[key] === 'boolean'))) return false;
  if (run.drawRuleVersion !== undefined && run.drawRuleVersion !== 2) return false;
  if (run.rewardRuleVersion !== undefined && run.rewardRuleVersion !== 2) return false;
  if (run.drawRuleVersion === 2 && (!dictionary(repeatStacks) || !Object.values(repeatStacks).every(count))) return false;
  if (participationTags !== undefined && !recruitTags(participationTags)) return false;
  if (pending?.kind === 'recruit' && (!strings(pending.recruitable) || !strings(pending.shardCandidates)
    || !count(pending.recruitLimit) || (pending.recruitTags !== undefined && !recruitTags(pending.recruitTags)))) return false;
  if (pending?.kind === 'springDraw' && (run.drawRuleVersion !== 2 || run.phase !== 'room' || run.room?.type !== 'spring'
    || run.room.status !== 'service' || !string(pending.key) || !run.pool.includes(pending.id)
    || [run.bench, run.fallen, run.released].some(ids => ids.includes(pending.id)) || pending.cost !== 1)) return false;
  const offer = run.room?.springOffer;
  if (offer?.slots !== undefined && (!string(offer.key) || !strings(offer.candidates) || !Array.isArray(offer.slots)
    || offer.slots.length !== offer.candidates.length || new Set(offer.slots.map(slot => slot?.slotId)).size !== offer.slots.length
    || !Array.from(offer.slots).every((slot, index) => string(slot?.slotId)
      && slot.id === offer.candidates[index] && ['invite', 'random'].includes(slot.source)))) return false;
  return lastBattleResult === undefined || validBattleResult(lastBattleResult);
}

function validBattleResult(result) {
  return dictionary(result) && result.v === 1 && count(result.floor) && string(result.roomType)
    && ['win', 'lose'].includes(result.outcome) && typeof result.wiped === 'boolean'
    && strings(result.fallenIds) && strings(result.survivorIds)
    && Array.isArray(result.transfers) && Array.from(result.transfers).every(transfer => dictionary(transfer)
      && string(transfer.fromId) && string(transfer.toId) && string(transfer.skillName))
    && Number.isSafeInteger(result.rewardDelta?.crystals) && strings(result.rewardDelta?.relicIds);
}

function validDoor(door) {
  return dictionary(door) && string(door.type) && Array.isArray(door.enemies)
    && Array.from(door.enemies).every(enemy => dictionary(enemy) && string(enemy.id)
      && Array.isArray(enemy.skills) && ['hp', 'atk', 'matk', 'def', 'mdef'].every(key => Number.isFinite(enemy.stats?.[key])));
}

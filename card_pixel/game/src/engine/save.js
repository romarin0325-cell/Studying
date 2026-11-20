import { DUNGEONS } from '../content/dungeons.js';
import { backupSlots, DAILY_KEY, LAST_GOOD_KEY, SESSION_KEY, SETTINGS_KEY } from '../ui/storage.js';
import { restoreDailyData, withDailyCheckpoint } from './daily-store.js';
import { calendarDate } from './dates.js';
import { missionPeriodKeys, PROFILE_VERSION, recordRunProgress } from './meta.js';
import { bindRun } from './run.js';

export const RUN_VERSION = 1;
const SESSION_VERSION = 1;
const BACKUP_VERSION = 1;
const PHASES = ['start', 'map', 'room', 'reward', 'done'];
const DEFAULT_SETTINGS = { sound: true, music: true, rim: true, speed: 1, textScale: 1, markers: true };
const SETTING_VALUES = { speed: [1, 2], textScale: [1, 1.25] };
const dictionary = value => !!value && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const string = value => typeof value === 'string' && value.length > 0;
const nullableId = value => value === null || string(value);
const strings = value => Array.isArray(value) && Array.from(value).every(string);
const uniqueIds = value => strings(value) && new Set(value).size === value.length;
const validSetting = (key, value) => SETTING_VALUES[key]?.includes(value) ?? (typeof value === 'boolean');

function parse(data) {
  try {
    return typeof data === 'string' ? JSON.parse(data) : structuredClone(data);
  } catch {
    return null;
  }
}

function readVersion(data, version, migrate) {
  const decoded = parse(data);
  const migrated = decoded && decoded.version !== version ? migrate?.(decoded, version) : decoded;
  return migrated?.version === version ? migrated : null;
}

function runData(run) {
  const fighting = run.phase === 'room' && run.room?.status === 'battle';
  const snapshot = fighting ? { ...run, room: { ...run.room, status: 'order' } } : run;
  return { version: RUN_VERSION, run: snapshot };
}

export function normalizeSettings(raw) {
  return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [
    key, validSetting(key, raw?.[key]) ? raw[key] : fallback
  ]));
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

export function serializeProfile(profile) {
  return JSON.stringify(profile);
}

export function restoreProfile(data, { migrate } = {}) {
  const profile = readVersion(data, PROFILE_VERSION, migrate);
  if (!dictionary(profile?.recruits) || !Object.values(profile.recruits).every(entry => count(entry?.bond) && count(entry?.since))
    || !dictionary(profile.records) || !count(profile.records.runs) || !uniqueIds(profile.records.appliedRuns)
    || profile.records.appliedRuns.length !== profile.records.runs || !dictionary(profile.records.clears)
    || !Object.entries(profile.records.clears).every(([id, clear]) => Object.hasOwn(DUNGEONS, id) && dictionary(clear)
      && count(clear.normal) && count(clear.nightmare) && (clear.easy === undefined || count(clear.easy)))
    || !Array.isArray(profile.notebook?.chapters) || !Array.from(profile.notebook.chapters).every(id => Number.isInteger(id) && id >= 1 && id <= 7)
    || !['unlockedDungeons', 'nightmareUnlocks'].every(key => strings(profile[key]) && profile[key].every(id => Object.hasOwn(DUNGEONS, id)))
    || !profile.unlockedDungeons.includes('dawn_forest')
    || !['companions', 'seenCharacters', 'seenRelics'].every(key => strings(profile[key]))
    || !['lead', 'preferredCompanion', 'reserved'].every(key => nullableId(profile[key]))
    || !dictionary(profile.seals) || !Object.values(profile.seals).every(strings)) return null;
  profile.contractStamps ??= {};
  profile.missions ??= { periods: {} };
  profile.ui ??= {};
  if (!dictionary(profile.contractStamps) || !dictionary(profile.missions?.periods)
    || !Object.entries(profile.missions.periods).every(([key, period]) => validMissionPeriod(key, period, profile.recruits))
    || !dictionary(profile.ui) || (profile.ui.wantedCompanionId !== undefined && !nullableId(profile.ui.wantedCompanionId))) return null;
  profile.ui.wantedCompanionId ??= null;
  if (Object.hasOwn(profile.recruits, profile.ui.wantedCompanionId)) profile.ui.wantedCompanionId = null;
  for (const clear of Object.values(profile.records.clears)) clear.easy ??= 0;
  return profile;
}

function validMissionPeriod(key, period, recruits) {
  const date = key.startsWith('week:') ? key.slice(5) : key.startsWith('month:') ? key.slice(6) + '-01' : '';
  const keys = missionPeriodKeys(date);
  return (key === keys?.weekly || key === keys?.monthly) && dictionary(period) && count(period.gates)
    && uniqueIds(period.regionIds) && period.regionIds.every(id => DUNGEONS[id]?.layout === 'expedition' && id !== 'creation_tower')
    && ['tracking', 'earned', 'claimed'].includes(period.state) && uniqueIds(period.offerOrder)
    && (period.claimedId === null || (period.state === 'claimed' && period.offerOrder.includes(period.claimedId)
      && Object.hasOwn(recruits, period.claimedId)));
}

function sessionData(profile, run) {
  const progressed = run ? recordRunProgress(profile, run).profile : profile;
  return { version: SESSION_VERSION, profile: progressed, run: run ? runData(run) : null };
}

function decodeStored(value) {
  return value == null ? null : parse(value) ?? value;
}

const failed = reason => ({ ok: false, reason });

export function createSaveStore(storage, { key = SESSION_KEY, core, roster, migrateRun, migrateProfile } = {}) {
  const slots = backupSlots(storage);
  const deps = { core, roster };

  function readSession(raw) {
    if (raw == null) return { status: 'empty' };
    const data = readVersion(raw, SESSION_VERSION);
    let profile;
    try {
      profile = restoreProfile(data?.profile, { migrate: migrateProfile });
    } catch {
      return { status: 'profileDamaged' };
    }
    if (!profile) return { status: 'profileDamaged' };
    if (data.run == null) return { status: 'ok', profile, run: null };
    try {
      const run = restoreRun(data.run, { ...deps, migrate: migrateRun });
      if (run && !run.daily) return { status: 'ok', profile: recordRunProgress(profile, run).profile, run };
    } catch {
      // A run migration can fail independently of the profile.
    }
    return { status: 'runDamaged', profile, run: null };
  }

  function loadFrom(entry) {
    try {
      return readSession(slots.read(slots.active(), entry));
    } catch {
      return { status: 'unavailable' };
    }
  }

  function exportBackup(live = {}) {
    function read(entry) {
      try {
        return decodeStored(slots.read(slots.active(), entry));
      } catch {
        return null;
      }
    }
    const dailyRun = live.dailyRun ?? (live.run?.daily ? live.run : null);
    let daily = Object.hasOwn(live, 'daily') ? live.daily : read(DAILY_KEY);
    if (daily?.days && dailyRun) daily = withDailyCheckpoint(daily, dailyRun);
    return {
      format: 'relaymare', version: BACKUP_VERSION,
      session: live.profile ? sessionData(live.profile, live.run?.daily ? null : live.run) : read(key),
      daily,
      settings: live.settings ? normalizeSettings(live.settings) : read(SETTINGS_KEY) ?? normalizeSettings()
    };
  }

  function validateBackup(data) {
    if (!dictionary(data) || data.format !== 'relaymare' || data.version !== BACKUP_VERSION
      || !['session', 'daily', 'settings'].every(entry => Object.hasOwn(data, entry))) return failed('invalid_format');
    const session = readSession(data.session);
    if (session.status === 'profileDamaged') return failed('invalid_session');
    if (session.status === 'runDamaged') return failed('invalid_run');
    if (data.daily !== null && !restoreDailyData(data.daily, deps)) return failed('invalid_daily');
    if (!dictionary(data.settings) || Object.keys(DEFAULT_SETTINGS).some(entry => Object.hasOwn(data.settings, entry)
      && !validSetting(entry, data.settings[entry]))) return failed('invalid_settings');
    const days = Object.values(data.daily?.days ?? {});
    const active = data.daily?.active ?? null;
    const summary = {
      recruits: Object.keys(session.profile?.recruits ?? {}).length,
      dungeonId: session.run?.dungeonId ?? null, floor: session.run?.floor ?? null,
      dailyOfficialStarts: days.length, dailyOfficialResults: days.filter(day => day.official !== null).length,
      dailyActive: active ? { dayKey: active.dayKey, kind: active.kind, floor: active.checkpoint.floor } : null
    };
    return { ok: true, summary, session };
  }

  function inspectBackup(data) {
    const result = validateBackup(parse(data));
    return result.ok ? { ok: true, summary: result.summary } : { ...result, summary: null };
  }

  function restoreBackup(data) {
    const backup = parse(data);
    const checked = validateBackup(backup);
    if (!checked.ok) return checked;
    const { profile, run } = checked.session;
    const values = new Map([
      [key, profile ? JSON.stringify(sessionData(profile, run)) : null],
      [DAILY_KEY, backup.daily === null ? null : JSON.stringify(backup.daily)],
      [SETTINGS_KEY, JSON.stringify(normalizeSettings(backup.settings))],
      [LAST_GOOD_KEY, profile ? JSON.stringify(sessionData(profile, null)) : null]
    ]);
    try {
      const next = slots.active() === 'a' ? 'b' : 'a';
      for (const [entry, value] of values) slots.write(next, entry, value);
      const staged = new Map([...values.keys()].map(entry => [entry, slots.read(next, entry) ?? null]));
      if ([...values].some(([entry, value]) => value !== staged.get(entry))) return failed('storage_failed');
      const verified = validateBackup({
        format: 'relaymare', version: BACKUP_VERSION, session: decodeStored(staged.get(key)),
        daily: decodeStored(staged.get(DAILY_KEY)), settings: decodeStored(staged.get(SETTINGS_KEY))
      });
      if (!verified.ok) return failed('storage_failed');
      slots.activate(next);
      return { ok: true };
    } catch {
      return failed('storage_failed');
    }
  }

  return {
    save({ profile, run = null }) {
      if (run?.daily) return false;
      const slot = slots.active();
      const snapshot = JSON.stringify(sessionData(profile, run));
      slots.write(slot, key, snapshot);
      if (!run && profile.records.appliedRuns.length && readSession(snapshot).status === 'ok') {
        try {
          slots.write(slot, LAST_GOOD_KEY, snapshot);
        } catch {
          // The primary save is already durable. Keep the preceding good copy.
        }
      }
    },
    loadDetailed: () => loadFrom(key),
    load() {
      const { status, profile, run } = loadFrom(key);
      if (status === 'ok') return { profile, run };
      return status === 'runDamaged' ? { profile, run, runError: 'run_restore_failed' } : null;
    },
    loadLastGood: () => loadFrom(LAST_GOOD_KEY),
    restoreLastGood() {
      const { status, profile } = loadFrom(LAST_GOOD_KEY);
      if (status === 'unavailable') return failed('storage_failed');
      if (status !== 'ok') return failed('no_last_good');
      return restoreBackup(exportBackup({ profile }));
    },
    exportBackup,
    inspectBackup,
    restoreBackup,
    clear() {
      try {
        slots.clear(key);
        return true;
      } catch {
        return false;
      }
    }
  };
}

import { DUNGEONS } from '../content/dungeons.js';
import { backupSlots, DAILY_KEY, DAMAGED_DAILY_KEY, LAST_GOOD_KEY, SESSION_KEY, SETTINGS_KEY } from '../ui/storage.js';
import { restoreDailyData, withDailyCheckpoint } from './daily-store.js';
import { entryState } from './entry.js';
import { HISTORY_LIMIT } from './history.js';
import { missionPeriodKeys, PROFILE_VERSION, recordRunProgress, validPreparation } from './meta.js';
import { count, dictionary, parse, readVersion, restoreRun, runData, string, strings } from './run-codec.js';

export { RUN_VERSION, serializeRun, restoreRun } from './run-codec.js';

const SESSION_VERSION = 1;
const BACKUP_VERSION = 1;
const DEFAULT_SETTINGS = { sound: true, music: true, rim: true, speed: 1, textScale: 1, markers: true };
const SETTING_VALUES = { speed: [1, 2], textScale: [1, 1.25] };
const nullableId = value => value === null || string(value);
const uniqueIds = value => strings(value) && new Set(value).size === value.length;
const validSetting = (key, value) => SETTING_VALUES[key]?.includes(value) ?? (typeof value === 'boolean');

export function normalizeSettings(raw) {
  return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [
    key, validSetting(key, raw?.[key]) ? raw[key] : fallback
  ]));
}

export function serializeProfile(profile) {
  return JSON.stringify(profileData(profile));
}

function hasProgress(profile) {
  const { records, recruits, notebook, ui } = profile;
  return !!(records.runs || records.appliedRuns.length || Object.keys(recruits).length || notebook.chapters.length
    || notebook.firstLead || records.bestHit || records.longestServing || ui?.latestRun
    || Object.values(ui?.recent ?? {}).some(history => history.length)
    || Object.values(records.clears).some(clear => clear.easy || clear.normal || clear.nightmare));
}

function profileData(profile, activeRun = false) {
  const entry = profile.ui?.entry === undefined ? entryState(activeRun || hasProgress(profile)) : profile.ui.entry;
  if (!validEntry(entry)) throw new TypeError('invalid_entry_state');
  return { ...profile, history: profile.history ?? {}, ui: { ...profile.ui, entry } };
}

function validEntry(entry) {
  return dictionary(entry) && entry.v === 1 && typeof entry.legacy === 'boolean' && typeof entry.skipped === 'boolean'
    && ['done', 'tours'].every(key => uniqueIds(entry[key]) && entry[key].every(id => id.trim()));
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
  profile.history ??= {};
  profile.missions ??= { periods: {} };
  profile.ui ??= {};
  if (!dictionary(profile.contractStamps) || !dictionary(profile.missions?.periods)
    || !Object.entries(profile.missions.periods).every(([key, period]) => validMissionPeriod(key, period, profile.recruits))
    || !validProfileUi(profile.ui) || !validHistory(profile.history, profile.records)) return null;
  profile.ui.entry ??= entryState(hasProgress(profile));
  if (!validPreparation(profile, profile.ui.preparation)) profile.ui.preparation = null;
  for (const clear of Object.values(profile.records.clears)) clear.easy ??= 0;
  return profile;
}

const dungeonId = id => typeof id === 'string' && Object.hasOwn(DUNGEONS, id);
const optional = (value, validate) => value == null || validate(value);
const arrayOf = (value, validate) => Array.isArray(value) && Array.from(value).every(validate);
const runEntry = entry => dictionary(entry) && dungeonId(entry.dungeonId) && count(entry.floor)
  && ['win', 'lose'].includes(entry.result);

function validHistory(history, { appliedRuns, towerRunId }) {
  const ids = new Set(appliedRuns);
  const heirloom = (fact, key) => dictionary(fact) && string(fact[key]) && string(fact.skillName);
  return optional(towerRunId, id => ids.has(id)) && dictionary(history)
    && Object.values(history).every(entries => arrayOf(entries, entry => runEntry(entry) && ids.has(entry.runId)
      && ['easy', 'normal', 'nightmare'].includes(entry.difficulty) && typeof entry.fielded === 'boolean'
      && optional(entry.outcome, outcome => ['survived', 'reserve', 'fell', 'released'].includes(outcome))
      && (entry.fallenFloor === undefined || count(entry.fallenFloor))
      && arrayOf(entry.given, fact => heirloom(fact, 'toId'))
      && arrayOf(entry.inherited, fact => heirloom(fact, 'fromId'))
      && arrayOf(entry.used, fact => heirloom(fact, 'fromId') && count(fact.floor) && string(fact.roomType)
        && typeof fact.won === 'boolean')
      && arrayOf(entry.victories, fact => dictionary(fact) && ['gate', 'boss'].includes(fact.roomType)
        && (fact.floor === undefined || count(fact.floor)))) && entries.length <= HISTORY_LIMIT
      && new Set(entries.map(entry => entry.runId)).size === entries.length);
}

function validBattleLog(log) {
  return arrayOf(log, turn => dictionary(turn) && count(turn.turn) && arrayOf(turn.rows, row =>
    dictionary(row) && count(row.key) && typeof row.text === 'string' && typeof row.kind === 'string' && /^[a-z-]*$/.test(row.kind)
    && optional(row.faces, faces => arrayOf(faces, face => face === null || dictionary(face)))
    && optional(row.hits, hits => arrayOf(hits, hit => dictionary(hit) && count(hit.key) && count(hit.turn)))
    && optional(row.origin, count) && optional(row.amount, Number.isFinite)));
}

function validProfileUi(ui) {
  return dictionary(ui) && optional(ui.wantedCompanionId, string) && optional(ui.returners, uniqueIds)
    && (ui.entry === undefined || validEntry(ui.entry))
    && optional(ui.recruitChoices, choices => dictionary(choices) && string(choices.runId) && uniqueIds(choices.ids))
    && optional(ui.recent, recent => dictionary(recent) && Object.values(recent).every(history => arrayOf(history, runEntry)))
    && optional(ui.announcement, notice => dictionary(notice)
      && ['dungeons', 'nightmares'].every(key => optional(notice[key], ids => arrayOf(ids, dungeonId)))
      && optional(notice.chapters, chapters => arrayOf(chapters, id => Number.isInteger(id) && id >= 1 && id <= 7)))
    && optional(ui.latestRun, latest => runEntry(latest) && strings(latest.fallen) && dictionary(latest.stats)
      && optional(latest.lastBattleLog, validBattleLog));
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
  return { version: SESSION_VERSION, profile: profileData(progressed, !!run), run: run ? runData(run) : null };
}

function sessionRevision(raw) {
  const revision = parse(raw)?.revision;
  return count(revision) ? revision : 0;
}

function decodeStored(value) {
  return value == null ? null : parse(value) ?? value;
}

const failed = reason => ({ ok: false, reason });

export function createSaveStore(storage, { key = SESSION_KEY, core, roster, migrateRun, migrateProfile } = {}) {
  const slots = backupSlots(storage);
  const deps = { core, roster };
  let observed;
  let lastRevision = 0;
  let stale = false;
  let notified = false;

  function readHead() {
    const slot = slots.active();
    const raw = slots.read(slot, key) ?? null;
    return { slot, raw, revision: sessionRevision(raw) };
  }

  function isStale(head) {
    stale ||= observed ? head.slot !== observed.slot || head.revision !== observed.revision
      || (head.raw !== null) !== observed.hasSave : head.revision > 0;
    return stale;
  }

  function remember({ slot, raw, revision }) {
    observed = { slot, revision, hasSave: raw !== null };
    lastRevision = Math.max(lastRevision, revision);
  }

  function revisionAfter(head) {
    const revision = Math.max(head.revision, lastRevision,
      head.revision === 0 ? sessionRevision(slots.read(head.slot, LAST_GOOD_KEY)) : 0) + 1;
    if (!count(revision)) throw new RangeError('Invalid save revision');
    return revision;
  }

  function writeSession(slot, raw, revision) {
    slots.write(slot, key, raw);
    remember({ slot, raw, revision });
  }

  function readSession(raw) {
    if (raw == null) return { status: 'empty' };
    const data = readVersion(raw, SESSION_VERSION);
    if (data?.profile === null && data.run === null && sessionRevision(data) > 0) return { status: 'empty' };
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
      if (run && !run.daily) {
        if (data.profile?.ui?.entry === undefined) profile.ui.entry = entryState(true);
        return { status: 'ok', profile: recordRunProgress(profile, run).profile, run };
      }
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

  function loadDetailed() {
    try {
      const head = readHead();
      remember(head);
      stale = false;
      notified = false;
      return readSession(head.raw);
    } catch {
      return { status: 'unavailable' };
    }
  }

  function watchStale(events, notify) {
    events.addEventListener('storage', event => {
      if (notified || !slots.affectsSession(event.key, key)) return;
      try {
        if (!isStale(readHead())) return;
      } catch {
        return;
      }
      notified = true;
      notify();
    });
  }

  function exportBackup(live = {}) {
    function read(entry) {
      try {
        return slots.read(slots.active(), entry);
      } catch {
        return null;
      }
    }
    const dailyRun = live.dailyRun ?? (live.run?.daily ? live.run : null);
    const dailyRaw = Object.hasOwn(live, 'daily') ? live.daily : read(DAILY_KEY);
    let daily = dailyRaw == null ? null : parse(dailyRaw);
    if (daily?.days && dailyRun) daily = withDailyCheckpoint(daily, dailyRun);
    let damagedDaily = read(DAMAGED_DAILY_KEY);
    if (dailyRaw != null && !restoreDailyData(daily, deps)) {
      damagedDaily = typeof dailyRaw === 'string' ? dailyRaw : JSON.stringify(dailyRaw);
      daily = null;
    }
    return {
      format: 'relaymare', version: BACKUP_VERSION,
      session: live.profile ? sessionData(live.profile, live.run?.daily ? null : live.run) : decodeStored(read(key)),
      daily, ...(typeof damagedDaily === 'string' && { damagedDaily }),
      settings: live.settings ? normalizeSettings(live.settings) : decodeStored(read(SETTINGS_KEY)) ?? normalizeSettings()
    };
  }

  function validateBackup(data) {
    if (!dictionary(data) || data.format !== 'relaymare' || data.version !== BACKUP_VERSION
      || !['session', 'daily', 'settings'].every(entry => Object.hasOwn(data, entry))) return failed('invalid_format');
    const session = readSession(data.session);
    if (session.status === 'profileDamaged') return failed('invalid_session');
    if (session.status === 'runDamaged') return failed('invalid_run');
    if ((data.daily !== null && !restoreDailyData(data.daily, deps))
      || (data.damagedDaily !== undefined && typeof data.damagedDaily !== 'string')) return failed('invalid_daily');
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

  function dailyWarning(data) {
    return typeof data.damagedDaily === 'string' ? { warnings: ['invalid_daily'] } : {};
  }

  function inspectBackup(data) {
    const backup = parse(data);
    const result = validateBackup(backup);
    return result.ok ? { ok: true, summary: result.summary, ...dailyWarning(backup) } : { ...result, summary: null };
  }

  function restoreBackup(data) {
    const backup = parse(data);
    const checked = validateBackup(backup);
    if (!checked.ok) return checked;
    const { profile, run } = checked.session;
    try {
      const head = readHead();
      if (isStale(head)) return failed('stale_tab');
      const revision = revisionAfter(head);
      const raw = JSON.stringify({ ...(profile ? sessionData(profile, run)
        : { version: SESSION_VERSION, profile: null, run: null }), revision });
      const values = new Map([
        [key, raw],
        [DAILY_KEY, backup.daily === null ? null : JSON.stringify(backup.daily)],
        [DAMAGED_DAILY_KEY, backup.damagedDaily ?? null],
        [SETTINGS_KEY, JSON.stringify(normalizeSettings(backup.settings))],
        [LAST_GOOD_KEY, profile ? JSON.stringify({ ...sessionData(profile, null), revision }) : null]
      ]);
      const next = head.slot === 'a' ? 'b' : 'a';
      for (const [entry, value] of values) slots.write(next, entry, value);
      const staged = new Map([...values.keys()].map(entry => [entry, slots.read(next, entry) ?? null]));
      if ([...values].some(([entry, value]) => value !== staged.get(entry))) return failed('storage_failed');
      const verified = validateBackup({
        format: 'relaymare', version: BACKUP_VERSION, session: decodeStored(staged.get(key)),
        daily: decodeStored(staged.get(DAILY_KEY)), settings: decodeStored(staged.get(SETTINGS_KEY))
      });
      if (!verified.ok) return failed('storage_failed');
      slots.activate(next);
      remember({ slot: next, raw, revision });
      return { ok: true, ...dailyWarning(backup) };
    } catch {
      return failed('storage_failed');
    }
  }

  function saveEpisodeFlags(profile, field, flags) {
    const head = readHead();
    if (isStale(head)) return failed('stale_tab');
    const revision = revisionAfter(head);

    function patch(raw) {
      const session = readVersion(raw, SESSION_VERSION);
      const saved = restoreProfile(session?.profile);
      const applied = saved?.records.appliedRuns;
      const runs = profile.records.appliedRuns;
      if (applied?.length !== runs.length || !runs.every((id, index) => applied[index] === id)
        || !Object.keys(flags).every(id => saved.recruits[id]?.since === profile.recruits[id]?.since)) return null;
      const ui = (session.profile.ui ??= {});
      ui[field] = { ...ui[field], ...flags };
      return JSON.stringify({ ...session, revision });
    }

    // Preserve the saved expedition checkpoint while changing only the episode flags.
    const raw = patch(head.raw);
    if (raw === null) return failed('storage_failed');
    writeSession(head.slot, raw, revision);
    try {
      const good = patch(slots.read(head.slot, LAST_GOOD_KEY));
      if (good !== null) slots.write(head.slot, LAST_GOOD_KEY, good);
    } catch { /* Keep the preceding good copy. */ }
    return { ok: true };
  }

  return {
    save({ profile, run = null }) {
      if (run?.daily) return false;
      const head = readHead();
      if (isStale(head)) return failed('stale_tab');
      const revision = revisionAfter(head);
      const snapshot = JSON.stringify({ ...sessionData(profile, run), revision });
      writeSession(head.slot, snapshot, revision);
      if (!run && profile.records.appliedRuns.length && readSession(snapshot).status === 'ok') {
        try {
          slots.write(head.slot, LAST_GOOD_KEY, snapshot);
        } catch {
          // The primary save is already durable. Keep the preceding good copy.
        }
      }
      return { ok: true };
    },
    loadDetailed,
    load() {
      const { status, profile, run } = loadDetailed();
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
    saveEpisodeFlags,
    watchStale,
    clear() {
      try {
        if (isStale(readHead())) return failed('stale_tab');
        slots.clear(key);
        remember({ slot: 'a', raw: null, revision: 0 });
        return true;
      } catch {
        return false;
      }
    }
  };
}

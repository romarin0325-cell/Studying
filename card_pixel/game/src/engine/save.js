import { DUNGEONS } from '../content/dungeons.js';
import { PROFILE_VERSION, recordRunProgress } from './meta.js';
import { bindRun } from './run.js';

export const RUN_VERSION = 1;
const SESSION_VERSION = 1;
const PHASES = ['start', 'map', 'room', 'reward', 'done'];

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

export function serializeRun(run) {
  return JSON.stringify(runData(run));
}

export function restoreRun(data, { core, roster, migrate } = {}) {
  const run = readVersion(data, RUN_VERSION, migrate)?.run;
  if (!run || !Object.hasOwn(DUNGEONS, run.dungeonId) || !PHASES.includes(run.phase)
    || !Number.isInteger(run.rng?.state) || run.rng.state < 0 || run.rng.state > 0xffffffff
    || !Array.isArray(run.pool) || !Array.isArray(run.bench) || !Array.isArray(run.doors)) return null;
  run.contract ??= null;
  run.daily ??= null;
  run.tempoVersion ??= run.daily?.spec.ruleVersion ?? 1;
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

export function serializeProfile(profile) {
  return JSON.stringify(profile);
}

export function restoreProfile(data, { migrate } = {}) {
  const profile = readVersion(data, PROFILE_VERSION, migrate);
  if (!profile?.recruits || !profile.records || !Array.isArray(profile.notebook?.chapters)
    || !Array.isArray(profile.unlockedDungeons) || !Array.isArray(profile.nightmareUnlocks)) return null;
  profile.contractStamps ??= {};
  return profile;
}

export function createSaveStore(storage, { key = 'relaymare.session', core, roster, migrateRun, migrateProfile } = {}) {
  return {
    save({ profile, run = null }) {
      if (run?.daily) return false;
      const progressed = run ? recordRunProgress(profile, run).profile : profile;
      storage.setItem(key, JSON.stringify({ version: SESSION_VERSION, profile: progressed, run: run ? runData(run) : null }));
    },
    load() {
      const data = readVersion(storage.getItem(key), SESSION_VERSION);
      if (!data) return null;
      const profile = restoreProfile(data.profile, { migrate: migrateProfile });
      if (!profile) return null;
      if (data.run == null) return { profile, run: null };
      try {
        const run = restoreRun(data.run, { core, roster, migrate: migrateRun });
        if (run && !run.daily) return { profile: recordRunProgress(profile, run).profile, run };
      } catch {
        // Run migrations can fail independently of the profile.
      }
      return { profile, run: null, runError: 'run_restore_failed' };
    },
    clear() {
      storage.removeItem(key);
    }
  };
}

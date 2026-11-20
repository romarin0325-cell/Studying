import { FLOORS, RULE_VERSION } from '../content/daily-rift.js';
import { compare, dayKey, specFor, validAttempt } from './daily-rift.js';
import { dailyRiftUnlocked } from './meta.js';
import { invalid } from './rooms.js';
import { createRun } from './run.js';
import { restoreRun, serializeRun } from './save.js';

const KEY = 'relaymare.daily';
const VERSION = 1;
const empty = () => ({ version: VERSION, days: {}, active: null });
const emptyDay = spec => ({ spec, starts: 0, official: null, bestPractice: null, last: null });

function checkpointFor(run) {
  const { floor, bench, stats, daily } = run;
  if (!Number.isInteger(floor) || floor < 1 || floor > FLOORS || !Array.isArray(bench)
    || !Array.from(bench).every(id => daily.spec.loanIds.includes(id)) || new Set(bench).size !== bench.length
    || ![stats?.turns, stats?.heirloomsUsed].every(n => Number.isSafeInteger(n) && n >= 0)) return null;
  const livingIds = daily.spec.loanIds.filter(id => bench.includes(id));
  return { floor, turns: stats.turns, livingIds, heirloomsUsed: stats.heirloomsUsed };
}

function response(day, score, duplicate) {
  return { ok: true, score, official: day.official, bestPractice: day.bestPractice, duplicate };
}

function previousResult(data, runId) {
  if (typeof runId !== 'string') return null;
  const key = runId.split('/')[2];
  if (!Object.hasOwn(data.days, key)) return null;
  const day = data.days[key];
  if (day.official?.runId === runId) return response(day, day.official, true);
  if (day.bestPractice?.runId === runId) return response(day, day.bestPractice, true);
  if (day.last?.runId === runId) {
    const { receipts, ...score } = day.last;
    return response(day, score, true);
  }
  const score = day.last?.receipts?.[runId];
  return score ? response(day, score, true) : null;
}

export function create(storage, { core, roster }) {
  function read() {
    try {
      const saved = storage.getItem(KEY);
      if (saved == null) return empty();
      const data = JSON.parse(saved);
      if (data?.version === VERSION && data.days && typeof data.days === 'object'
        && !Array.isArray(data.days) && (data.active === null || typeof data.active === 'object')) return data;
    } catch {
      // A damaged save can still be cleared through settings.
    }
    return null;
  }

  function write(data) {
    try {
      return storage.setItem(KEY, JSON.stringify(data)) !== false;
    } catch {
      return false;
    }
  }

  function activeCheckpoint(data, run) {
    const { active } = data;
    const daily = run?.daily;
    const day = data.days[active.dayKey];
    if (!daily || !day || run.id !== active.runId || daily.kind !== active.kind || daily.attemptNo !== day.starts
      || !day.spec || daily.spec?.dayKey !== active.dayKey
      || run.seed !== day.spec.seed || run.dungeonId !== day.spec.dungeonId || run.floors !== FLOORS
      || run.difficulty !== 'normal' || run.contract !== null || run.crystals !== 0) return null;
    try {
      if (JSON.stringify(daily.spec) === JSON.stringify(day.spec)) return checkpointFor(run);
    } catch {
      // An invalid run may contain values that cannot be serialized.
    }
    return null;
  }

  function settle(data, outcome, checkpoint) {
    const { runId, dayKey, kind } = data.active;
    const day = data.days[dayKey];
    if (!day || !checkpoint) return invalid('invalid_save');
    const score = { runId, dayKey, kind, outcome, ...checkpoint };
    if (kind === 'official') day.official = score;
    else if (outcome !== 'abandon' && (!day.bestPractice || compare(score, day.bestPractice) > 0)) day.bestPractice = score;

    // Keep receipts for delayed callbacks even after the latest attempt moves on.
    const { receipts = {}, ...prior } = day.last || {};
    if (prior.runId) receipts[prior.runId] = prior;
    day.last = Object.keys(receipts).length ? { ...score, receipts } : score;
    data.active = null;
    return write(data) ? response(day, score, false) : invalid('storage_failed');
  }

  return {
    view(profile, now) {
      const key = dayKey(now);
      const unlocked = dailyRiftUnlocked(profile);
      const { days, active } = read() || empty();
      const today = days[key];
      return {
        dayKey: key, unlocked, spec: unlocked ? today?.spec ?? specFor(key, roster) : null,
        official: today?.official ?? null, bestPractice: today?.bestPractice ?? null,
        active: active ? { runId: active.runId, dayKey: active.dayKey, kind: active.kind, floor: active.checkpoint?.floor } : null
      };
    },

    start({ profile, now, expectedDayKey, kind }) {
      if (!dailyRiftUnlocked(profile)) return invalid('locked');
      const key = dayKey(now);
      if (key !== expectedDayKey) return invalid('date_changed');
      const data = read();
      if (!data) return invalid('invalid_save');
      if (data.active) return invalid('active_exists');
      if (kind !== 'official' && kind !== 'practice') return invalid('invalid_save');
      const day = data.days[key];
      if (kind === 'official' && day?.starts) return invalid('already_recorded');
      if (kind === 'practice' && !day?.official) return invalid('official_required');
      let run;
      try {
        const spec = day?.spec ?? specFor(key, roster);
        const record = data.days[key] ||= emptyDay(spec);
        const attemptNo = record.starts + 1;
        run = createRun({ core, roster, daily: { spec, kind, attemptNo } });
        record.starts = attemptNo;
        data.active = { runId: run.id, dayKey: key, kind, snapshot: serializeRun(run), checkpoint: checkpointFor(run) };
      } catch {
        return invalid('invalid_save');
      }
      return write(data) ? { ok: true, run } : invalid('storage_failed');
    },

    resume() {
      const data = read();
      if (!data) return invalid('invalid_save');
      if (!data.active) return invalid('no_active');
      try {
        const run = restoreRun(data.active.snapshot, { core, roster });
        if (activeCheckpoint(data, run) && validAttempt(run.daily, roster)) return { ok: true, run };
      } catch {
        // The separate checkpoint still lets the player abandon an unreadable snapshot.
      }
      return invalid('invalid_save');
    },

    save(run) {
      const data = read();
      if (!data) return invalid('invalid_save');
      if (!data.active) return invalid('no_active');
      const checkpoint = activeCheckpoint(data, run);
      if (!checkpoint) return invalid('invalid_save');
      let snapshot;
      try {
        snapshot = serializeRun(run);
        if (!restoreRun(snapshot, { core, roster })) return invalid('invalid_save');
      } catch {
        return invalid('invalid_save');
      }
      data.active = { ...data.active, snapshot, checkpoint };
      return write(data) ? { ok: true } : invalid('storage_failed');
    },

    finish(run) {
      const data = read();
      if (!data) return invalid('invalid_save');
      const duplicate = previousResult(data, run?.id);
      if (duplicate) return duplicate;
      if (!data.active) return invalid('no_active');
      const checkpoint = activeCheckpoint(data, run);
      if (!checkpoint) return invalid('invalid_save');
      if (run.phase !== 'done' || !['win', 'lose'].includes(run.result)) return invalid('run_not_done');
      return settle(data, run.result, checkpoint);
    },

    abandon(runId) {
      const data = read();
      if (!data) return invalid('invalid_save');
      const duplicate = previousResult(data, runId);
      if (duplicate) return duplicate;
      if (!data.active) return invalid('no_active');
      if (runId !== data.active.runId) return invalid('invalid_save');
      return settle(data, 'abandon', data.active.checkpoint);
    },

    history({ before = null, limit = 7 } = {}) {
      const { days } = read() || empty();
      const keys = Object.keys(days).filter(key => days[key]?.official && (before === null || key < before)).sort().reverse();
      const rows = keys.slice(0, limit).map(key => {
        const { spec, official, bestPractice } = days[key];
        return { dayKey: key, spec, official, bestPractice };
      });
      return { rows, nextBefore: keys.length > rows.length ? rows.at(-1)?.dayKey ?? null : null };
    },

    clear() {
      storage.removeItem(KEY);
    }
  };
}

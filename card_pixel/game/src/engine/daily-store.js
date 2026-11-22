import { FLOORS } from '../content/daily-rift.js';
import { RIFT_PUZZLES } from '../content/rift-puzzles.js';
import { DAILY_KEY as KEY, slotStorage } from '../ui/storage.js';
import { compare, dayKey, doorsFor, puzzleGoalMet, riftPuzzlesUnlocked, specFor, validAttempt } from './daily-rift.js';
import { dailyRiftUnlocked } from './meta.js';
import { invalid } from './rooms.js';
import { chooseDoor, createRun } from './run.js';
import { restoreRun, serializeRun } from './run-codec.js';

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

function activeCheckpoint(data, run) {
  const { active } = data;
  const daily = run?.daily;
  const day = data.days[active?.dayKey];
  if (!daily || daily.puzzleId || !day || run.id !== active.runId || daily.kind !== active.kind || daily.attemptNo !== day.starts
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

const dictionary = value => !!value && typeof value === 'object' && !Array.isArray(value);
const nonnegative = n => Number.isSafeInteger(n) && n >= 0;

function validCheckpoint(checkpoint, spec) {
  return dictionary(checkpoint) && Number.isInteger(checkpoint.floor) && checkpoint.floor >= 1 && checkpoint.floor <= FLOORS
    && nonnegative(checkpoint.turns) && nonnegative(checkpoint.heirloomsUsed) && Array.isArray(checkpoint.livingIds)
    && new Set(checkpoint.livingIds).size === checkpoint.livingIds.length
    && Array.from(checkpoint.livingIds).every(id => spec.loanIds.includes(id));
}

function validScore(score, day, kind) {
  if (!dictionary(score) || score.dayKey !== day.spec.dayKey || score.kind !== kind
    || !['win', 'lose', 'abandon'].includes(score.outcome) || !validCheckpoint(score, day.spec)) return false;
  const attempt = Number(score.runId?.split?.('/').at(-1));
  return score.runId === `rift/v${day.spec.ruleVersion}/${day.spec.dayKey}/${attempt}`
    && Number.isSafeInteger(attempt) && attempt <= day.starts && (kind === 'official' ? attempt === 1 : attempt > 1);
}

function puzzleBest(data, puzzle) {
  const best = data?.puzzleBests?.[puzzle.id];
  if (!['win', 'lose'].includes(best?.outcome) || best.floor !== puzzle.floor
    || !validCheckpoint(best, { loanIds: puzzle.rentals })) return null;
  return { ...best, goalMet: puzzleGoalMet(puzzle.goal, best) };
}

function comparePuzzle(a, b) {
  return Number(a.goalMet) - Number(b.goalMet) || Number(a.outcome === 'win') - Number(b.outcome === 'win')
    || a.livingIds.length - b.livingIds.length || b.turns - a.turns;
}

export function restoreDailyData(data, { core, roster }) {
  if (!dictionary(data) || data.version !== VERSION || !dictionary(data.days)
    || (data.active !== null && !dictionary(data.active))) return null;
  const { active } = data;
  try {
    for (const [key, day] of Object.entries(data.days)) {
      if (!Number.isSafeInteger(day?.starts) || day.starts < 1 || day.spec?.dayKey !== key
        || !validAttempt({ spec: day.spec, kind: 'official', attemptNo: 1 }, roster)) return null;
      if (day.official === null ? active?.dayKey !== key || active.kind !== 'official' || day.starts !== 1
        : !validScore(day.official, day, 'official')) return null;
      if (day.bestPractice !== null && (!validScore(day.bestPractice, day, 'practice') || day.bestPractice.outcome === 'abandon')) return null;
      if (day.last === null) {
        if (day.official !== null) return null;
      } else {
        if (!validScore(day.last, day, day.last?.kind) || !['official', 'practice'].includes(day.last.kind)) return null;
        if (day.last.receipts !== undefined && (!dictionary(day.last.receipts) || Object.entries(day.last.receipts)
          .some(([id, score]) => id !== score?.runId || !['official', 'practice'].includes(score.kind)
            || !validScore(score, day, score.kind)))) return null;
      }
    }
    if (active) {
      const day = data.days[active.dayKey];
      const run = restoreRun(active.snapshot, { core, roster });
      const checkpoint = activeCheckpoint(data, run);
      if (!checkpoint || !validAttempt(run.daily, roster) || !validCheckpoint(active.checkpoint, day.spec)
        || run.id !== `rift/v${day.spec.ruleVersion}/${active.dayKey}/${day.starts}`
        || run.pool.length !== day.spec.loanIds.length || run.pool.some((id, index) => id !== day.spec.loanIds[index])
        || (active.kind === 'official' && day.official !== null) || previousResult(data, run.id)
        || checkpoint.floor !== active.checkpoint.floor || checkpoint.turns !== active.checkpoint.turns
        || checkpoint.heirloomsUsed !== active.checkpoint.heirloomsUsed
        || checkpoint.livingIds.join(',') !== active.checkpoint.livingIds.join(',')) return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function withDailyCheckpoint(data, run) {
  const checkpoint = run && activeCheckpoint(data, run);
  if (!checkpoint) return data;
  return { ...data, active: { ...data.active, snapshot: serializeRun(run), checkpoint } };
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
  storage = slotStorage(storage);
  const puzzlesInPlay = new WeakMap();
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
    puzzles(profile) {
      if (!riftPuzzlesUnlocked(profile)) return [];
      const data = read();
      return RIFT_PUZZLES.map(puzzle => ({ ...puzzle, best: puzzleBest(data, puzzle) }));
    },

    startPuzzle({ profile, puzzleId }) {
      if (!riftPuzzlesUnlocked(profile)) return invalid('locked');
      const puzzle = RIFT_PUZZLES.find(item => item.id === puzzleId);
      if (!puzzle) return invalid('invalid_puzzle');
      try {
        const spec = specFor(puzzle.spec, roster);
        if (puzzle.rentals.some(id => !spec.loanIds.includes(id))) return invalid('invalid_puzzle');
        const run = createRun({ core, roster, daily: { spec, kind: 'practice', attemptNo: 2, puzzleId } });
        run.id = `puzzle/${puzzleId}`;
        run.floor = puzzle.floor;
        run.doors = doorsFor(spec, puzzle.floor, roster).map(door => ({ ...door, tempo: null }));
        run.joinOrder = puzzle.rentals.slice();
        run.bench = puzzle.rentals.slice();
        // Offset the boss seed to match the fixed entrance without counting earlier battles.
        run.seed += puzzle.setup?.seedOffset ?? 0;
        run.relics = puzzle.setup?.relics.slice() ?? [];
        run.blessings = { ...puzzle.setup?.blessings };
        if (!chooseDoor(run, 0).ok) return invalid('invalid_puzzle');
        puzzlesInPlay.set(run, puzzle);
        return { ok: true, run, puzzle };
      } catch {
        return invalid('invalid_puzzle');
      }
    },

    finishPuzzle(run) {
      const puzzle = puzzlesInPlay.get(run);
      if (!puzzle) return invalid('invalid_puzzle');
      if (run.phase !== 'done' || run.floor !== puzzle.floor || !['win', 'lose'].includes(run.result)) {
        return invalid('run_not_done');
      }
      const checkpoint = checkpointFor(run);
      if (!checkpoint) return invalid('invalid_puzzle');
      const score = { ...checkpoint, outcome: run.result };
      const result = { ...score, goalMet: puzzleGoalMet(puzzle.goal, score) };
      const data = read();
      if (!data) return { ...invalid('invalid_save'), score: result };
      const best = puzzleBest(data, puzzle);
      if (!best || comparePuzzle(result, best) > 0) {
        // Keep this map in the existing backup slot, independently of daily attempts.
        const puzzleBests = dictionary(data.puzzleBests) ? data.puzzleBests : {};
        if (!write({ ...data, puzzleBests: { ...puzzleBests, [puzzle.id]: score } })) {
          return { ...invalid('storage_failed'), score: result };
        }
      }
      return { ok: true, score: result };
    },

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

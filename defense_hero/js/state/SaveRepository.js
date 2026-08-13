import { META_SCHEMA_VERSION, createDefaultMetaState } from './MetaState.js';
import { RUN_SCHEMA_VERSION } from './RunState.js';

export const SAVE_KEYS = Object.freeze({
  meta: 'heroDefenseMeta',
  run: 'heroDefenseRun',
  metaBackup: 'heroDefenseMeta_backup',
  runBackup: 'heroDefenseRun_backup',
});

const SAVE_KINDS = Object.freeze({
  meta: {
    key: SAVE_KEYS.meta,
    backupKey: SAVE_KEYS.metaBackup,
    versionField: 'metaSchemaVersion',
    version: META_SCHEMA_VERSION,
  },
  run: {
    key: SAVE_KEYS.run,
    backupKey: SAVE_KEYS.runBackup,
    versionField: 'runSchemaVersion',
    version: RUN_SCHEMA_VERSION,
  },
});

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function deepMerge(base, patch) {
  if (!isRecord(base) || !isRecord(patch)) return clone(patch);
  const merged = clone(base);
  for (const [key, value] of Object.entries(patch)) {
    merged[key] = isRecord(value) && isRecord(merged[key])
      ? deepMerge(merged[key], value)
      : clone(value);
  }
  return merged;
}

const RUN_PHASES = new Set(['map', 'preview', 'deploy', 'battle', 'growth', 'reward', 'result']);
const META_BOOLEAN_SETTINGS = Object.freeze({
  sound: true,
  damageNumbers: true,
  particles: true,
  screenShake: true,
  vibration: true,
  flashes: true,
  debugOverlay: false,
  elementRules: true,
});
const STAT_FIELDS = Object.freeze([
  'kills',
  'damage',
  'advantageDamage',
  'advantageousDamage',
  'aerialDamage',
  'areaDamage',
  'controlSeconds',
  'controlTime',
  'statusesApplied',
  'statusApplications',
  'coreDamageTaken',
  'relocations',
  'activeUses',
  'elapsedSeconds',
  'elapsedTime',
  'goldEarned',
]);

function finiteNumber(value, fallback = 0, { min = 0, max = Number.POSITIVE_INFINITY, integer = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const normalized = integer ? Math.trunc(value) : value;
  return Math.min(max, Math.max(min, normalized));
}

function nonEmptyString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function stringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((entry) => typeof entry === 'string' && entry.trim())
    .map((entry) => entry.trim()))];
}

function numericRecord(value, options = {}) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => typeof entry === 'number' && Number.isFinite(entry))
    .map(([key, entry]) => [key, finiteNumber(entry, options.fallback ?? 0, options)]));
}

function stringArrayRecord(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => Array.isArray(entry))
    .map(([key, entry]) => [key, stringArray(entry)]));
}

function normalizeStats(value) {
  const source = isRecord(value) ? value : {};
  const normalized = { ...source };
  for (const field of STAT_FIELDS) {
    normalized[field] = finiteNumber(source[field], 0);
  }
  const byCharacter = isRecord(source.byCharacter) ? source.byCharacter : {};
  normalized.byCharacter = Object.fromEntries(Object.entries(byCharacter)
    .filter(([, entry]) => isRecord(entry))
    .map(([id, entry]) => {
      const characterStats = { ...entry };
      for (const field of STAT_FIELDS) {
        if (hasOwn(entry, field)) characterStats[field] = finiteNumber(entry[field], 0);
      }
      return [id, characterStats];
    }));
  return normalized;
}

function normalizeMetaState(state) {
  const unlocksSource = isRecord(state.unlocks) ? state.unlocks : {};
  const unlocks = { ...unlocksSource };
  for (const field of ['leaders', 'companions', 'difficulties', 'challenges']) {
    if (!hasOwn(unlocksSource, field)) continue;
    if (Array.isArray(unlocksSource[field])) unlocks[field] = stringArray(unlocksSource[field]);
    else delete unlocks[field];
  }

  const recordsSource = isRecord(state.records) ? state.records : {};
  const records = {
    ...recordsSource,
    clears: finiteNumber(recordsSource.clears, 0, { integer: true }),
    failures: finiteNumber(recordsSource.failures, 0, { integer: true }),
    bestScore: finiteNumber(recordsSource.bestScore, 0),
    highestDifficulty: nonEmptyString(recordsSource.highestDifficulty, 'scout'),
    recentSeeds: stringArray(recordsSource.recentSeeds).slice(0, 10),
    characterClears: numericRecord(recordsSource.characterClears, { integer: true }),
    challengeStars: numericRecord(recordsSource.challengeStars, { integer: true, max: 3 }),
  };

  const settingsSource = isRecord(state.settings) ? state.settings : {};
  const settings = { ...settingsSource };
  for (const [field, fallback] of Object.entries(META_BOOLEAN_SETTINGS)) {
    settings[field] = typeof settingsSource[field] === 'boolean' ? settingsSource[field] : fallback;
  }
  settings.elementMultiplier = finiteNumber(settingsSource.elementMultiplier, 1.2, { min: 0.01 });

  return {
    ...state,
    unlocks,
    affinity: numericRecord(state.affinity),
    records,
    settings,
    createdAt: finiteNumber(state.createdAt, Date.now()),
  };
}

function normalizeDeck(value, key) {
  if (!isRecord(value)) throw new InvalidSaveDataError('run save has an invalid deck', key);
  const leaderId = nonEmptyString(value.leaderId);
  const companionIds = Array.isArray(value.companionIds)
    ? value.companionIds.map((id) => nonEmptyString(id))
    : [];
  const uniqueIds = new Set([leaderId, ...companionIds]);
  if (!leaderId || companionIds.length !== 4 || companionIds.some((id) => !id) || uniqueIds.size !== 5) {
    throw new InvalidSaveDataError('run save has an invalid deck', key);
  }
  return { ...value, leaderId, companionIds };
}

function normalizeRunState(state, key) {
  const seed = nonEmptyString(state.seed);
  if (!seed) throw new InvalidSaveDataError('run save has an invalid seed', key);
  const deck = normalizeDeck(state.deck, key);
  const deckIds = [deck.leaderId, ...deck.companionIds];

  const levels = numericRecord(state.levels, { min: 1, integer: true, fallback: 1 });
  for (const id of deckIds) levels[id] = finiteNumber(levels[id], 1, { min: 1, integer: true });

  const branchesSource = isRecord(state.branches) ? state.branches : {};
  const branches = Object.fromEntries(Object.entries(branchesSource).filter(([, branch]) => (
    branch === null || typeof branch === 'string' || isRecord(branch)
  )));
  const resultSource = isRecord(state.result) ? state.result : null;
  const result = resultSource ? {
    ...resultSource,
    success: Boolean(resultSource.success),
    score: finiteNumber(resultSource.score, 0),
    stages: finiteNumber(resultSource.stages, 0, { integer: true, max: 6 }),
    elapsedSeconds: finiteNumber(resultSource.elapsedSeconds, 0),
    completedAt: finiteNumber(resultSource.completedAt, 0),
  } : null;
  const requestedPhase = RUN_PHASES.has(state.phase) ? state.phase : 'map';

  return {
    ...state,
    runId: nonEmptyString(state.runId, seed),
    seed,
    difficultyId: nonEmptyString(state.difficultyId, 'scout'),
    deck,
    blessingId: state.blessingId == null ? null : nonEmptyString(state.blessingId, null),
    phase: requestedPhase === 'result' && !result ? 'map' : requestedPhase,
    stageNumber: finiteNumber(state.stageNumber, 1, { min: 1, max: 6, integer: true }),
    selectedNode: state.selectedNode == null
      ? null
      : finiteNumber(state.selectedNode, 0, { integer: true }),
    selectedNodeByStage: numericRecord(state.selectedNodeByStage, { integer: true }),
    completedStages: [...new Set((Array.isArray(state.completedStages) ? state.completedStages : [])
      .filter((stage) => typeof stage === 'number' && Number.isFinite(stage))
      .map((stage) => finiteNumber(stage, 1, { min: 1, max: 6, integer: true })))],
    coreHp: finiteNumber(state.coreHp, 100, { max: 100 }),
    coreShield: finiteNumber(state.coreShield, 0),
    gold: finiteNumber(state.gold, 0, { integer: true }),
    shards: finiteNumber(state.shards, 0, { integer: true }),
    levels,
    branches,
    upgrades: stringArrayRecord(state.upgrades),
    doctrines: stringArray(state.doctrines).slice(0, 2),
    relics: stringArray(state.relics).slice(0, 2),
    rerolls: finiteNumber(state.rerolls, 0, { integer: true }),
    rewardChoices: stringArrayRecord(state.rewardChoices),
    stats: normalizeStats(state.stats),
    result,
    startedAt: finiteNumber(state.startedAt, 0),
    updatedAt: finiteNumber(state.updatedAt, 0),
    interruptedBattle: Boolean(state.interruptedBattle),
  };
}

function normalizeState(kind, state, key) {
  return kind === 'meta' ? normalizeMetaState(state) : normalizeRunState(state, key);
}

function countTruthyLeaves(value) {
  if (Array.isArray(value)) return value.length;
  if (!isRecord(value)) return value ? 1 : 0;
  return Object.values(value).reduce((sum, child) => sum + countTruthyLeaves(child), 0);
}

function collectMonotonicNumbers(value, matcher, path = '', output = new Map(), inheritedMatch = false) {
  if (!isRecord(value)) return output;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    const matches = inheritedMatch || matcher.test(key);
    if (typeof child === 'number' && Number.isFinite(child) && matches) {
      output.set(childPath, child);
    } else if (isRecord(child)) {
      collectMonotonicNumbers(child, matcher, childPath, output, matches);
    }
  }
  return output;
}

function countUnlocks(value) {
  if (!isRecord(value)) return 0;
  let count = 0;
  for (const [key, child] of Object.entries(value)) {
    if (/unlock/i.test(key)) count += countTruthyLeaves(child);
    else if (isRecord(child)) count += countUnlocks(child);
  }
  return count;
}

function hasLowerMetric(candidate, previous, matcher) {
  const candidateMetrics = collectMonotonicNumbers(candidate, matcher);
  const previousMetrics = collectMonotonicNumbers(previous, matcher);
  for (const [path, previousValue] of previousMetrics) {
    const candidateValue = candidateMetrics.get(path);
    if (candidateValue === undefined || candidateValue < previousValue) return true;
  }
  return false;
}

function sameRun(candidate, previous) {
  const identityKeys = ['runId', 'seed'];
  for (const key of identityKeys) {
    if (hasOwn(candidate, key) && hasOwn(previous, key)) return candidate[key] === previous[key];
  }
  return true;
}

function isBackupRegression(kind, candidate, previous) {
  if (kind === 'meta') {
    if (countUnlocks(candidate) < countUnlocks(previous)) return true;
    return hasLowerMetric(candidate, previous, /best|highest|max|clear/i);
  }

  if (!sameRun(candidate, previous)) return false;
  return hasLowerMetric(candidate, previous, /stage|wave|node|completed/i);
}

export class FutureSchemaVersionError extends Error {
  constructor(kind, foundVersion, supportedVersion, key) {
    super(`${kind} save uses schema ${foundVersion}; this build supports ${supportedVersion}`);
    this.name = 'FutureSchemaVersionError';
    this.code = 'FUTURE_SCHEMA_VERSION';
    this.kind = kind;
    this.key = key;
    this.foundVersion = foundVersion;
    this.supportedVersion = supportedVersion;
  }
}

export class InvalidSaveDataError extends Error {
  constructor(message, key, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'InvalidSaveDataError';
    this.code = 'INVALID_SAVE_DATA';
    this.key = key;
  }
}

export class MemoryStorage {
  constructor(entries = {}) {
    this._values = new Map(Object.entries(entries).map(([key, value]) => [key, String(value)]));
  }

  get length() {
    return this._values.size;
  }

  key(index) {
    return [...this._values.keys()][index] ?? null;
  }

  getItem(key) {
    return this._values.has(String(key)) ? this._values.get(String(key)) : null;
  }

  setItem(key, value) {
    this._values.set(String(key), String(value));
  }

  removeItem(key) {
    this._values.delete(String(key));
  }

  clear() {
    this._values.clear();
  }
}

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    if (globalThis.localStorage) return globalThis.localStorage;
  } catch {
    // Access to localStorage can be denied in privacy/sandboxed contexts.
  }
  return new MemoryStorage();
}

function assertStorage(storage) {
  for (const method of ['getItem', 'setItem', 'removeItem']) {
    if (typeof storage[method] !== 'function') {
      throw new TypeError(`SaveRepository storage must implement ${method}()`);
    }
  }
}

export class SaveRepository {
  constructor(options = {}) {
    const normalized = options && typeof options.getItem === 'function'
      ? { storage: options }
      : options;
    const {
      storage,
      logger = console,
      migrations = {},
    } = normalized;

    this.storage = resolveStorage(storage);
    assertStorage(this.storage);
    this.logger = logger;
    this.migrations = migrations;
  }

  loadMeta() {
    return this._loadWithFallback('meta') ?? createDefaultMetaState();
  }

  saveMeta(state, { backup = true } = {}) {
    return this._save('meta', state, backup);
  }

  loadRun() {
    return this._loadWithFallback('run');
  }

  saveRun(state, { backup = true } = {}) {
    return this._save('run', state, backup);
  }

  saveRunCheckpoint(state) {
    return this.saveRun(state, { backup: true });
  }

  hasRun() {
    return this.loadRun() !== null;
  }

  clearRun({ includeBackup = true } = {}) {
    this.storage.removeItem(SAVE_KEYS.run);
    if (includeBackup) this.storage.removeItem(SAVE_KEYS.runBackup);
  }

  migrate(kind, state, key = SAVE_KINDS[kind]?.key) {
    const config = SAVE_KINDS[kind];
    if (!config) throw new RangeError(`Unknown save kind: ${String(kind)}`);
    if (!isRecord(state)) throw new InvalidSaveDataError(`${kind} save must be an object`, config.key);

    let migrated = clone(state);
    let version = hasOwn(migrated, config.versionField) ? migrated[config.versionField] : 0;
    if (!Number.isInteger(version) || version < 0) {
      throw new InvalidSaveDataError(`${kind} save has an invalid schema version`, config.key);
    }
    if (version > config.version) {
      throw new FutureSchemaVersionError(kind, version, config.version, config.key);
    }

    while (version < config.version) {
      const migration = this.migrations?.[kind]?.[version];
      if (migration !== undefined) {
        if (typeof migration !== 'function') {
          throw new TypeError(`Migration ${kind}:${version} must be a function`);
        }
        const result = migration(clone(migrated));
        if (!isRecord(result)) {
          throw new InvalidSaveDataError(`Migration ${kind}:${version} returned invalid data`, config.key);
        }
        migrated = result;
      }
      version += 1;
      migrated[config.versionField] = version;
    }

    migrated[config.versionField] = config.version;
    return normalizeState(kind, migrated, key);
  }

  _loadWithFallback(kind) {
    const config = SAVE_KINDS[kind];
    const primary = this._read(kind, config.key);
    if (primary.status === 'valid') return primary.value;
    if (primary.status === 'future') throw primary.error;
    if (primary.status === 'invalid') this._warn(primary.error.message);

    const backup = this._read(kind, config.backupKey);
    if (backup.status === 'valid') return backup.value;
    if (backup.status === 'future') throw backup.error;
    if (backup.status === 'invalid') this._warn(backup.error.message);
    return null;
  }

  _read(kind, key) {
    let raw;
    try {
      raw = this.storage.getItem(key);
    } catch (cause) {
      return {
        status: 'invalid',
        error: new InvalidSaveDataError(`Could not read save key ${key}`, key, cause),
      };
    }
    if (raw === null || raw === undefined) return { status: 'missing' };

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      return {
        status: 'invalid',
        error: new InvalidSaveDataError(`Save key ${key} contains malformed JSON`, key, cause),
      };
    }

    try {
      return { status: 'valid', value: this.migrate(kind, parsed, key) };
    } catch (error) {
      if (error instanceof FutureSchemaVersionError) return { status: 'future', error };
      return {
        status: 'invalid',
        error: error instanceof InvalidSaveDataError
          ? error
          : new InvalidSaveDataError(`Save key ${key} is invalid`, key, error),
      };
    }
  }

  _save(kind, state, backup) {
    const config = SAVE_KINDS[kind];
    if (!isRecord(state)) throw new TypeError(`${kind} save must be an object`);

    const current = this._read(kind, config.key);
    if (current.status === 'future') throw current.error;
    const fallback = current.status === 'valid' ? current.value : this._loadWithFallback(kind);
    const merged = fallback ? deepMerge(fallback, state) : clone(state);
    const candidate = this.migrate(kind, merged);

    let serialized;
    try {
      serialized = JSON.stringify(candidate);
    } catch (cause) {
      throw new InvalidSaveDataError(`Could not serialize ${kind} save`, config.key, cause);
    }
    if (serialized === undefined) {
      throw new InvalidSaveDataError(`Could not serialize ${kind} save`, config.key);
    }

    this.storage.setItem(config.key, serialized);
    if (backup) this._updateBackup(kind, candidate, serialized);
    return clone(candidate);
  }

  _updateBackup(kind, candidate, serialized) {
    const config = SAVE_KINDS[kind];
    const previous = this._read(kind, config.backupKey);
    if (previous.status === 'future') {
      this._warn(`Preserving newer backup at ${config.backupKey}`);
      return false;
    }
    if (previous.status === 'valid' && isBackupRegression(kind, candidate, previous.value)) {
      this._warn(`Preserving ${config.backupKey} because the new save appears to regress progress`);
      return false;
    }
    this.storage.setItem(config.backupKey, serialized);
    return true;
  }

  _warn(message) {
    if (typeof this.logger?.warn === 'function') this.logger.warn(message);
  }
}

export default SaveRepository;

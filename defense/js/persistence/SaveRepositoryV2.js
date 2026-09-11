import {
  CHECKPOINT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  SAVE_KEYS_V2,
  normalizeSettings,
  validateCheckpoint,
} from './schemas.js';

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

export class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries).map(([key, value]) => [String(key), String(value)]));
  }

  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(String(key)) ?? null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
  clear() { this.values.clear(); }
}

function canPersist(storage) {
  const key = '__heroDefenseV2StorageProbe__';
  try {
    const previous = storage.getItem(key);
    storage.setItem(key, 'ok');
    const valid = storage.getItem(key) === 'ok';
    if (previous === null) storage.removeItem(key);
    else storage.setItem(key, previous);
    return valid;
  } catch {
    return false;
  }
}

function resolveStorage(explicitStorage) {
  if (explicitStorage) return { storage: explicitStorage, persistent: !(explicitStorage instanceof MemoryStorage) };
  try {
    if (globalThis.localStorage && canPersist(globalThis.localStorage)) {
      return { storage: globalThis.localStorage, persistent: true };
    }
  } catch {
    // Access can be denied for local files or privacy-restricted contexts.
  }
  return { storage: new MemoryStorage(), persistent: false };
}

function parseJson(raw) {
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export class SaveRepositoryV2 {
  constructor({ storage, logger = console } = {}) {
    const resolved = resolveStorage(storage);
    this.storage = resolved.storage;
    this.isPersistent = resolved.persistent;
    this.logger = logger;
    if (!this.isPersistent) this.#warn('저장 공간을 사용할 수 없어 이번 실행에서만 진행 상황이 유지돼요.');
  }

  loadCheckpoint() {
    for (const key of [SAVE_KEYS_V2.checkpoint, SAVE_KEYS_V2.checkpointBackup]) {
      const parsed = parseJson(this.storage.getItem(key));
      if (!parsed) continue;
      try {
        validateCheckpoint(parsed);
        return clone(parsed);
      } catch (error) {
        this.#warn(`V2 체크포인트를 읽지 못했어요: ${error.message}`);
      }
    }
    return null;
  }

  saveCheckpoint(checkpoint) {
    const candidate = clone({ ...checkpoint, schemaVersion: CHECKPOINT_SCHEMA_VERSION });
    validateCheckpoint(candidate);
    const serialized = JSON.stringify(candidate);
    const current = this.storage.getItem(SAVE_KEYS_V2.checkpoint);
    if (current !== null) this.storage.setItem(SAVE_KEYS_V2.checkpointBackup, current);
    this.storage.setItem(SAVE_KEYS_V2.checkpoint, serialized);
    return clone(candidate);
  }

  clearCheckpoint() {
    this.storage.removeItem(SAVE_KEYS_V2.checkpoint);
    this.storage.removeItem(SAVE_KEYS_V2.checkpointBackup);
  }

  loadSettings() {
    const current = parseJson(this.storage.getItem(SAVE_KEYS_V2.settings));
    if (current) return normalizeSettings(current);
    const migrated = this.#readLegacySettingsOnce();
    const settings = normalizeSettings(migrated ?? DEFAULT_SETTINGS);
    this.saveSettings(settings);
    return settings;
  }

  saveSettings(settings) {
    const normalized = normalizeSettings(settings);
    this.storage.setItem(SAVE_KEYS_V2.settings, JSON.stringify(normalized));
    return normalized;
  }

  #readLegacySettingsOnce() {
    if (this.storage.getItem(SAVE_KEYS_V2.legacyMigration) === '1') return null;
    this.storage.setItem(SAVE_KEYS_V2.legacyMigration, '1');
    const legacyMeta = parseJson(this.storage.getItem('heroDefenseMeta'));
    const legacy = legacyMeta?.settings;
    if (!legacy || typeof legacy !== 'object') return null;
    return {
      sound: legacy.sound,
      damageNumbers: legacy.damageNumbers,
      screenShake: legacy.screenShake,
      reducedEffects: typeof legacy.particles === 'boolean' ? !legacy.particles : undefined,
    };
  }

  #warn(message) {
    this.logger?.warn?.(message);
  }
}

export default SaveRepositoryV2;

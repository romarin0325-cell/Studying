import assert from 'node:assert/strict';
import test from 'node:test';

import { SeededRng } from '../../js/core/SeededRng.js';
import {
  MemoryStorage,
  SaveRepositoryV2,
} from '../../js/persistence/SaveRepositoryV2.js';
import {
  CHECKPOINT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  normalizeSettings,
  SAVE_KEYS_V2,
  validateCheckpoint,
} from '../../js/persistence/schemas.js';

const FORMATION = Object.freeze({
  mainId: 'rumi',
  heroIds: Object.freeze(['snow_rabbit', 'avalanche_maid', 'guardian', 'lightning_sage']),
});

function makeCheckpoint(overrides = {}) {
  const checkpoint = {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    sessionId: 'session-001',
    stageId: 'ancient_ruins',
    difficultyId: 'easy',
    formation: {
      mainId: FORMATION.mainId,
      heroIds: [...FORMATION.heroIds],
    },
    placements: {
      rumi: { x: 5, y: 3 },
      snow_rabbit: { x: 6, y: 7 },
      avalanche_maid: { x: 2, y: 7 },
      guardian: { x: 8, y: 3 },
      lightning_sage: { x: 11, y: 2 },
    },
    nextWave: 6,
    coreDurability: 7.5,
    crystals: 3,
    levels: {
      rumi: 4,
      snow_rabbit: 2,
      avalanche_maid: 1,
      guardian: 1,
      lightning_sage: 1,
    },
    traits: {
      rumi: { lv4: 'rumi_star_form', lv6: null },
      snow_rabbit: { lv4: null, lv6: null },
      avalanche_maid: { lv4: null, lv6: null },
      guardian: { lv4: null, lv6: null },
      lightning_sage: { lv4: null, lv6: null },
    },
    rngSnapshot: new SeededRng('checkpoint-seed').snapshot(),
    nextWaveFlags: { coreDamagedPreviousWave: true },
  };
  return { ...checkpoint, ...overrides };
}

test('validateCheckpoint accepts a complete wave-boundary checkpoint including fractional core durability', () => {
  const checkpoint = makeCheckpoint();
  assert.strictEqual(validateCheckpoint(checkpoint), checkpoint);
  assert.equal(checkpoint.coreDurability, 7.5);
});

test('validateCheckpoint rejects invalid identity, difficulty and formation data', () => {
  assert.throws(() => validateCheckpoint(null), /must be an object/);
  assert.throws(() => validateCheckpoint(makeCheckpoint({ schemaVersion: 99 })), /Unsupported/);
  assert.throws(() => validateCheckpoint(makeCheckpoint({ sessionId: '' })), /sessionId/);
  assert.throws(() => validateCheckpoint(makeCheckpoint({ stageId: '' })), /stageId/);
  assert.throws(() => validateCheckpoint(makeCheckpoint({ stageId: 'retired_stage' })), /stageId.*unknown/);
  assert.throws(() => validateCheckpoint(makeCheckpoint({ difficultyId: 'normal' })), /Only easy/);
  assert.throws(() => validateCheckpoint(makeCheckpoint({ formation: null })), /formation/);
  assert.throws(() => validateCheckpoint(makeCheckpoint({
    formation: { mainId: '', heroIds: [...FORMATION.heroIds] },
  })), /main hero/);
  assert.throws(() => validateCheckpoint(makeCheckpoint({
    formation: { mainId: FORMATION.mainId, heroIds: FORMATION.heroIds.slice(0, 3) },
  })), /four normal heroes/);
  assert.throws(() => validateCheckpoint(makeCheckpoint({
    formation: { mainId: FORMATION.mainId, heroIds: ['snow_rabbit', 'guardian', 'guardian', 'lightning_sage'] },
  })), /must be unique/);
  assert.throws(() => validateCheckpoint(makeCheckpoint({
    formation: { mainId: FORMATION.mainId, heroIds: ['snow_rabbit', 'avalanche_maid', 42, 'lightning_sage'] },
  })), /normal hero id/);
  assert.throws(() => validateCheckpoint(makeCheckpoint({
    formation: { mainId: 'retired_main', heroIds: [...FORMATION.heroIds] },
  })), /main hero.*invalid/);
  assert.throws(() => validateCheckpoint(makeCheckpoint({
    formation: { mainId: FORMATION.mainId, heroIds: ['luna', 'avalanche_maid', 'guardian', 'lightning_sage'] },
  })), /normal hero selection/);
});

test('validateCheckpoint requires exactly the five formed heroes on unique in-bounds cells', () => {
  const missingPlacement = makeCheckpoint();
  delete missingPlacement.placements.guardian;
  assert.throws(() => validateCheckpoint(missingPlacement), /place all five|placements.*formation/i);

  const outsider = makeCheckpoint();
  outsider.placements.unselected_hero = { x: 1, y: 1 };
  assert.throws(() => validateCheckpoint(outsider), /place all five|placements.*formation/i);

  const collision = makeCheckpoint();
  collision.placements.guardian = { ...collision.placements.rumi };
  assert.throws(() => validateCheckpoint(collision), /placement.*unique/i);

  const blocked = makeCheckpoint();
  blocked.placements.rumi = { x: 0, y: 1 };
  assert.throws(() => validateCheckpoint(blocked), /placement is blocked/);

  const offWhitelist = makeCheckpoint();
  offWhitelist.placements.rumi = { x: 6, y: 0 };
  assert.throws(() => validateCheckpoint(offWhitelist), /placement is blocked/);

  for (const [coordinate, value] of [['x', -1], ['x', 12], ['x', 1.5], ['y', -1], ['y', 16], ['y', 1.5]]) {
    const invalid = makeCheckpoint();
    invalid.placements.rumi[coordinate] = value;
    assert.throws(() => validateCheckpoint(invalid), new RegExp(`placement ${coordinate}`));
  }
});

test('validateCheckpoint enforces wave, durability, crystals, levels and RNG snapshot boundaries', () => {
  for (const nextWave of [0, 11, 1.5]) {
    assert.throws(() => validateCheckpoint(makeCheckpoint({ nextWave })), /nextWave/);
  }
  for (const coreDurability of [0, -0.5, 10.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => validateCheckpoint(makeCheckpoint({ coreDurability })), /core durability/);
  }
  for (const crystals of [-1, 16, 1.5]) {
    assert.throws(() => validateCheckpoint(makeCheckpoint({ crystals })), /crystals/);
  }

  for (const level of [0, 7, 1.5, Number.NaN]) {
    const checkpoint = makeCheckpoint();
    checkpoint.levels.rumi = level;
    assert.throws(() => validateCheckpoint(checkpoint), /hero level/);
  }
  const missingLevel = makeCheckpoint();
  delete missingLevel.levels.guardian;
  assert.throws(() => validateCheckpoint(missingLevel), /levels.*formation/i);
  const outsiderLevel = makeCheckpoint();
  outsiderLevel.levels.unselected_hero = 1;
  assert.throws(() => validateCheckpoint(outsiderLevel), /levels.*formation/i);

  assert.throws(() => validateCheckpoint(makeCheckpoint({ traits: [] })), /traits/);
  const missingTraitState = makeCheckpoint();
  delete missingTraitState.traits.guardian;
  assert.throws(() => validateCheckpoint(missingTraitState), /traits.*formation/i);
  assert.throws(() => validateCheckpoint(makeCheckpoint({ rngSnapshot: {} })), /RNG snapshot/);
  assert.throws(() => validateCheckpoint(makeCheckpoint({ nextWaveFlags: [] })), /next-wave flags/);

  const invalidTrait = makeCheckpoint();
  invalidTrait.traits.rumi.lv4 = 'retired_trait';
  assert.throws(() => validateCheckpoint(invalidTrait), /lv4 trait is invalid/);

  const prematureTrait = makeCheckpoint();
  prematureTrait.traits.snow_rabbit.lv4 = 'snow_rabbit_first_snow';
  assert.throws(() => validateCheckpoint(prematureTrait), /lv4 trait is unavailable/);

  const invalidFlag = makeCheckpoint();
  invalidFlag.nextWaveFlags.coreDamagedPreviousWave = 1;
  assert.throws(() => validateCheckpoint(invalidFlag), /core damage flag/);
});

test('SaveRepositoryV2 saves immutable copies, creates a backup and falls back from corrupt current data', () => {
  const storage = new MemoryStorage();
  const warnings = [];
  const repository = new SaveRepositoryV2({ storage, logger: { warn: (message) => warnings.push(message) } });
  const firstInput = makeCheckpoint({ schemaVersion: 999, nextWave: 2, crystals: 1 });
  const first = repository.saveCheckpoint(firstInput);
  assert.equal(first.schemaVersion, CHECKPOINT_SCHEMA_VERSION);
  firstInput.placements.rumi.x = 11;
  assert.equal(repository.loadCheckpoint().placements.rumi.x, 5);

  const loaded = repository.loadCheckpoint();
  loaded.placements.rumi.x = 9;
  assert.equal(repository.loadCheckpoint().placements.rumi.x, 5, 'loaded checkpoints must be detached clones');

  repository.saveCheckpoint(makeCheckpoint({ nextWave: 3, crystals: 2 }));
  assert.equal(JSON.parse(storage.getItem(SAVE_KEYS_V2.checkpointBackup)).nextWave, 2);
  storage.setItem(SAVE_KEYS_V2.checkpoint, '{broken json');
  assert.equal(repository.loadCheckpoint().nextWave, 2);

  storage.setItem(SAVE_KEYS_V2.checkpoint, JSON.stringify(makeCheckpoint({ coreDurability: 0 })));
  assert.equal(repository.loadCheckpoint().nextWave, 2);
  assert.ok(warnings.some((message) => message.includes('체크포인트')));
});

test('invalid checkpoint writes are rejected before replacing current or backup data', () => {
  const storage = new MemoryStorage();
  const repository = new SaveRepositoryV2({ storage, logger: { warn() {} } });
  repository.saveCheckpoint(makeCheckpoint({ nextWave: 4 }));
  const current = storage.getItem(SAVE_KEYS_V2.checkpoint);
  const backup = storage.getItem(SAVE_KEYS_V2.checkpointBackup);
  assert.throws(() => repository.saveCheckpoint(makeCheckpoint({ crystals: 99 })), /crystals/);
  assert.equal(storage.getItem(SAVE_KEYS_V2.checkpoint), current);
  assert.equal(storage.getItem(SAVE_KEYS_V2.checkpointBackup), backup);
});

test('V2 checkpoint operations never read, overwrite or clear V1 run storage', () => {
  const legacyRun = JSON.stringify({ phase: 'battle', stageNumber: 6 });
  const legacyMeta = JSON.stringify({ settings: { sound: false, damageNumbers: false, screenShake: false, particles: false } });
  const storage = new MemoryStorage({ heroDefenseRun: legacyRun, heroDefenseMeta: legacyMeta });
  const repository = new SaveRepositoryV2({ storage, logger: { warn() {} } });

  assert.equal(repository.loadCheckpoint(), null, 'V1 run must not be interpreted as a V2 checkpoint');
  repository.saveCheckpoint(makeCheckpoint());
  repository.clearCheckpoint();
  assert.equal(storage.getItem('heroDefenseRun'), legacyRun);
  assert.equal(storage.getItem('heroDefenseMeta'), legacyMeta);
  assert.equal(storage.getItem(SAVE_KEYS_V2.checkpoint), null);
  assert.equal(storage.getItem(SAVE_KEYS_V2.checkpointBackup), null);
});

test('safe legacy settings migrate once without modifying V1 storage', () => {
  const legacyMeta = JSON.stringify({
    unlocks: ['do-not-touch'],
    settings: { sound: false, damageNumbers: false, screenShake: false, particles: false, unknown: 'preserve' },
  });
  const storage = new MemoryStorage({ heroDefenseMeta: legacyMeta });
  const repository = new SaveRepositoryV2({ storage, logger: { warn() {} } });
  assert.deepEqual(repository.loadSettings(), {
    sound: false,
    damageNumbers: false,
    screenShake: false,
    reducedEffects: true,
  });
  assert.equal(storage.getItem('heroDefenseMeta'), legacyMeta);
  assert.equal(storage.getItem(SAVE_KEYS_V2.legacyMigration), '1');

  storage.removeItem(SAVE_KEYS_V2.settings);
  storage.setItem('heroDefenseMeta', JSON.stringify({ settings: { sound: false } }));
  const reopened = new SaveRepositoryV2({ storage, logger: { warn() {} } });
  assert.deepEqual(reopened.loadSettings(), DEFAULT_SETTINGS, 'legacy settings must not be migrated twice');
});

test('blocked browser storage falls back to volatile MemoryStorage and warns once', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const warnings = [];
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('blocked', 'SecurityError'); },
    });
    const repository = new SaveRepositoryV2({ logger: { warn: (message) => warnings.push(message) } });
    assert.equal(repository.isPersistent, false);
    assert.ok(repository.storage instanceof MemoryStorage);
    assert.equal(warnings.length, 1);
    repository.saveCheckpoint(makeCheckpoint());
    assert.equal(repository.loadCheckpoint().stageId, 'ancient_ruins');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('settings normalization is frozen, boolean-only and isolated under V2 keys', () => {
  const normalized = normalizeSettings({
    sound: false,
    damageNumbers: 'yes',
    screenShake: true,
    reducedEffects: true,
    extra: false,
  });
  assert.deepEqual(normalized, {
    sound: false,
    damageNumbers: true,
    screenShake: true,
    reducedEffects: true,
  });
  assert.ok(Object.isFrozen(normalized));

  const storage = new MemoryStorage({ heroDefenseRun: 'legacy-run' });
  const repository = new SaveRepositoryV2({ storage, logger: { warn() {} } });
  const saved = repository.saveSettings({ sound: false, damageNumbers: false });
  assert.deepEqual(saved, {
    sound: false,
    damageNumbers: false,
    screenShake: true,
    reducedEffects: false,
  });
  assert.equal(storage.getItem('heroDefenseRun'), 'legacy-run');
  assert.deepEqual(JSON.parse(storage.getItem(SAVE_KEYS_V2.settings)), saved);
});

test('MemoryStorage implements Web Storage string conversion and stable key access', () => {
  const storage = new MemoryStorage({ first: 1 });
  assert.equal(storage.length, 1);
  assert.equal(storage.key(0), 'first');
  assert.equal(storage.getItem('first'), '1');
  storage.setItem('second', 2);
  assert.equal(storage.getItem('second'), '2');
  storage.removeItem('first');
  assert.equal(storage.getItem('first'), null);
  storage.clear();
  assert.equal(storage.length, 0);
  assert.equal(storage.key(0), null);
});

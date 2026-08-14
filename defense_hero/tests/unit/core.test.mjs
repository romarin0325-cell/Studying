import test from 'node:test';
import assert from 'node:assert/strict';

import { SeededRng } from '../../js/core/SeededRng.js';
import {
  ElementRules,
  ELEMENTS,
  DEFAULT_ELEMENT_ADVANTAGES,
} from '../../js/core/ElementRules.js';
import { EventBus } from '../../js/core/EventBus.js';
import {
  GameLoop,
  FIXED_TIME_STEP,
  MAX_CATCH_UP_STEPS,
  MAX_FRAME_DELTA,
} from '../../js/core/GameLoop.js';
import {
  FutureSchemaVersionError,
  MemoryStorage,
  SAVE_KEYS,
  SaveRepository,
} from '../../js/state/SaveRepository.js';

function validRun(overrides = {}) {
  return {
    runSchemaVersion: 1,
    runId: 'TEST-RUN-1',
    seed: 'TEST-SEED',
    difficultyId: 'standard',
    deck: {
      leaderId: 'rumi',
      companionIds: ['guardian', 'silver_rabbit', 'snow_rabbit', 'gray'],
    },
    phase: 'map',
    stageNumber: 1,
    selectedNode: null,
    selectedNodeByStage: {},
    completedStages: [],
    coreHp: 100,
    coreShield: 0,
    gold: 180,
    shards: 0,
    levels: {
      rumi: 1,
      guardian: 1,
      silver_rabbit: 1,
      snow_rabbit: 1,
      gray: 1,
    },
    branches: {},
    upgrades: {},
    doctrines: [],
    relics: [],
    rerolls: 1,
    rewardChoices: {},
    stats: { byCharacter: {} },
    startedAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

test('SeededRng reproduces all core operations for the same string seed', () => {
  const makeResult = () => {
    const rng = new SeededRng('hero-core-defense:test-seed');
    const source = ['a', 'b', 'c', 'd', 'e'];
    return {
      next: Array.from({ length: 8 }, () => rng.next()),
      integers: Array.from({ length: 8 }, () => rng.int(-4, 9)),
      pick: rng.pick(source),
      shuffle: rng.shuffle(source),
      source,
    };
  };

  const first = makeResult();
  const second = makeResult();
  assert.deepEqual(first, second);
  assert.deepEqual(first.source, ['a', 'b', 'c', 'd', 'e']);
  assert.ok(first.next.every((value) => value >= 0 && value < 1));
  assert.ok(first.integers.every((value) => value >= -4 && value < 9));
});

test('SeededRng forks are labelled, deterministic, and independent of parent draws', () => {
  const first = new SeededRng('expedition-42');
  first.next();
  first.next();
  const wavesA = first.fork('waves');
  const rewardsA = first.fork('rewards');

  const second = new SeededRng('expedition-42');
  const wavesB = second.fork('waves');
  const rewardsB = second.fork('rewards');

  assert.deepEqual(
    Array.from({ length: 6 }, () => wavesA.next()),
    Array.from({ length: 6 }, () => wavesB.next()),
  );
  assert.deepEqual(
    Array.from({ length: 6 }, () => rewardsA.next()),
    Array.from({ length: 6 }, () => rewardsB.next()),
  );
  assert.notDeepEqual(
    Array.from({ length: 3 }, () => first.fork('waves').next()),
    Array.from({ length: 3 }, () => first.fork('rewards').next()),
  );
});

test('SeededRng snapshot and restore continue at the exact next draw', () => {
  const rng = new SeededRng('snapshot-seed');
  Array.from({ length: 11 }, () => rng.next());
  const snapshot = rng.snapshot();
  const expected = Array.from({ length: 8 }, () => rng.next());

  rng.restore(snapshot);
  assert.deepEqual(Array.from({ length: 8 }, () => rng.next()), expected);
  const restored = SeededRng.restore(snapshot);
  assert.deepEqual(Array.from({ length: 8 }, () => restored.next()), expected);
  assert.throws(() => rng.restore({ ...snapshot, version: 99 }), /Unsupported/);
});

test('ElementRules implements all five advantages without a disadvantage penalty', () => {
  const rules = new ElementRules();
  assert.deepEqual([...ELEMENTS].sort(), ['dark', 'fire', 'light', 'nature', 'water']);

  for (const [attacker, defender] of Object.entries(DEFAULT_ELEMENT_ADVANTAGES)) {
    assert.equal(rules.getAdvantageAgainst(attacker), defender);
    assert.equal(rules.getMultiplier(attacker, defender), 1.2);
    assert.equal(rules.getMultiplier(attacker, attacker), 1);
  }
  assert.equal(rules.getMultiplier('fire', 'water'), 1);
  assert.equal(rules.getMultiplier('nature', 'fire'), 1);
  assert.equal(rules.getMultiplier('water', 'nature'), 1);

  const tuned = new ElementRules({ advantageMultiplier: 1.15 });
  assert.equal(tuned.getMultiplier('water', 'fire'), 1.15);
  assert.equal(tuned.validateElement('void'), false);
  assert.throws(() => tuned.getMultiplier('void', 'water'), /Unknown element/);
});

test('EventBus subscriptions can be removed safely during emission', () => {
  const bus = new EventBus();
  const received = [];
  let removeSecond;
  bus.on('damage', (amount) => {
    received.push(`first:${amount}`);
    removeSecond();
  });
  removeSecond = bus.on('damage', (amount) => received.push(`second:${amount}`));
  bus.once('damage', (amount) => received.push(`once:${amount}`));

  assert.equal(bus.emit('damage', 7), 3);
  assert.equal(bus.emit('damage', 8), 1);
  assert.deepEqual(received, ['first:7', 'second:7', 'once:7', 'first:8']);
  assert.equal(bus.listenerCount('damage'), 1);
});

test('GameLoop caps frame delta and performs at most five fixed updates', () => {
  let now = 0;
  let queuedFrame = null;
  let nextHandle = 0;
  const updates = [];
  const renders = [];
  const cancelled = [];
  const loop = new GameLoop({
    update: (dt, simulationTime) => updates.push({ dt, simulationTime }),
    render: (alpha, info) => renders.push({ alpha, info }),
    now: () => now,
    requestFrame: (callback) => {
      queuedFrame = callback;
      nextHandle += 1;
      return nextHandle;
    },
    cancelFrame: (handle) => cancelled.push(handle),
  });

  assert.equal(loop.start(), true);
  assert.equal(loop.start(), false);
  now = 10_000;
  const result = queuedFrame(now);

  assert.equal(result.elapsed, MAX_FRAME_DELTA);
  assert.equal(result.updates, MAX_CATCH_UP_STEPS);
  assert.equal(updates.length, MAX_CATCH_UP_STEPS);
  assert.ok(updates.every(({ dt }) => dt === FIXED_TIME_STEP));
  assert.equal(renders.length, 1);
  assert.ok(loop.droppedUpdates >= 1);
  assert.equal(loop.stop(), true);
  assert.equal(cancelled.length, 1);
});

test('SaveRepository falls back from malformed JSON and rejects future schemas', () => {
  const storage = new MemoryStorage();
  const logger = { warnings: [], warn(message) { this.warnings.push(message); } };
  const repository = new SaveRepository({ storage, logger });

  storage.setItem(SAVE_KEYS.metaBackup, JSON.stringify({
    metaSchemaVersion: 1,
    records: { bestScore: 480 },
    extension: { retained: true },
  }));
  storage.setItem(SAVE_KEYS.meta, '{broken');
  assert.equal(repository.loadMeta().records.bestScore, 480);
  assert.equal(logger.warnings.length, 1);

  storage.setItem(SAVE_KEYS.meta, JSON.stringify({ metaSchemaVersion: 99 }));
  assert.throws(() => repository.loadMeta(), FutureSchemaVersionError);
});

test('SaveRepository reports volatile fallback when browser storage cannot persist', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const logger = { warnings: [], warn(message) { this.warnings.push(message); } };
  const blockedStorage = {
    getItem() { return null; },
    setItem() { throw new Error('blocked'); },
    removeItem() {},
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => blockedStorage,
  });
  try {
    const repository = new SaveRepository({ logger });
    assert.equal(repository.isPersistent, false);
    assert.equal(repository.persistence.kind, 'memory');
    assert.equal(repository.persistence.reason, 'unavailable');
    assert.ok(repository.storage instanceof MemoryStorage);
    assert.equal(logger.warnings.length, 1);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('SaveRepository preserves unknown fields and refuses to regress a meta backup', () => {
  const storage = new MemoryStorage();
  const repository = new SaveRepository({ storage, logger: { warn() {} } });
  repository.saveMeta({
    unlockedCharacters: ['rumi', 'zeke', 'luna'],
    records: { bestScore: 900, clearsByCharacter: { rumi: 4 } },
    extension: { modName: 'future-field', nested: { keep: 1 } },
  });

  repository.saveMeta({
    unlockedCharacters: ['rumi'],
    records: { bestScore: 100, clearsByCharacter: { rumi: 1 } },
    extension: { nested: { changed: 2 } },
  });

  const primary = JSON.parse(storage.getItem(SAVE_KEYS.meta));
  const backup = JSON.parse(storage.getItem(SAVE_KEYS.metaBackup));
  assert.equal(primary.extension.modName, 'future-field');
  assert.deepEqual(primary.extension.nested, { keep: 1, changed: 2 });
  assert.equal(primary.records.bestScore, 100);
  assert.equal(backup.records.bestScore, 900);
  assert.equal(backup.unlockedCharacters.length, 3);
});

test('SaveRepository restores run backups, prevents same-run rollback, and clears both keys', () => {
  const storage = new MemoryStorage();
  const repository = new SaveRepository({ storage, logger: { warn() {} } });
  repository.saveRun(validRun({ seed: 'same-seed', stageIndex: 4, custom: { retained: true } }));
  repository.saveRun(validRun({ seed: 'same-seed', stageIndex: 2 }));

  const backup = JSON.parse(storage.getItem(SAVE_KEYS.runBackup));
  assert.equal(backup.stageIndex, 4);
  storage.setItem(SAVE_KEYS.run, 'not-json');
  assert.equal(repository.loadRun().stageIndex, 4);
  assert.equal(repository.loadRun().custom.retained, true);

  repository.clearRun();
  assert.equal(storage.getItem(SAVE_KEYS.run), null);
  assert.equal(storage.getItem(SAVE_KEYS.runBackup), null);
  assert.equal(repository.loadRun(), null);
});

test('SaveRepository rejects an unusable run deck and falls back to a valid backup', () => {
  const storage = new MemoryStorage();
  const logger = { warnings: [], warn(message) { this.warnings.push(message); } };
  const repository = new SaveRepository({ storage, logger });
  storage.setItem(SAVE_KEYS.runBackup, JSON.stringify(validRun({
    stageNumber: 3,
    extension: { retained: true },
  })));
  storage.setItem(SAVE_KEYS.run, JSON.stringify(validRun({ deck: null, stageNumber: 5 })));

  const restored = repository.loadRun();
  assert.equal(restored.stageNumber, 3);
  assert.equal(restored.deck.leaderId, 'rumi');
  assert.equal(restored.extension.retained, true);
  assert.equal(logger.warnings.length, 1);

  storage.setItem(SAVE_KEYS.runBackup, JSON.stringify(validRun({
    deck: { leaderId: 'rumi', companionIds: ['guardian', 'guardian'] },
  })));
  assert.equal(repository.loadRun(), null);
});

test('SaveRepository normalizes malformed nested state without dropping unknown fields', () => {
  const storage = new MemoryStorage();
  const repository = new SaveRepository({ storage, logger: { warn() {} } });
  storage.setItem(SAVE_KEYS.meta, JSON.stringify({
    metaSchemaVersion: 1,
    unlocks: {
      leaders: null,
      companions: ['guardian', '', 'guardian'],
      futureGroup: ['future_character'],
    },
    affinity: [],
    records: {
      clears: -4,
      failures: null,
      bestScore: -100,
      recentSeeds: { invalid: true },
      characterClears: [],
      challengeStars: { trial: 99 },
      extension: { retained: true },
    },
    settings: { sound: 'yes', elementMultiplier: null, extensionToggle: 'future' },
    extension: { retained: true },
  }));

  const meta = repository.loadMeta();
  assert.equal(meta.unlocks.leaders, undefined);
  assert.deepEqual(meta.unlocks.companions, ['guardian']);
  assert.deepEqual(meta.unlocks.futureGroup, ['future_character']);
  assert.deepEqual(meta.affinity, {});
  assert.equal(meta.records.clears, 0);
  assert.equal(meta.records.failures, 0);
  assert.equal(meta.records.bestScore, 0);
  assert.deepEqual(meta.records.recentSeeds, []);
  assert.deepEqual(meta.records.characterClears, {});
  assert.equal(meta.records.challengeStars.trial, 3);
  assert.equal(meta.records.extension.retained, true);
  assert.equal(meta.settings.sound, true);
  assert.equal(meta.settings.elementMultiplier, 1.2);
  assert.equal(meta.settings.extensionToggle, 'future');
  assert.equal(meta.extension.retained, true);

  storage.setItem(SAVE_KEYS.run, JSON.stringify(validRun({
    phase: 'unknown-phase',
    stageNumber: -8,
    selectedNode: -2,
    selectedNodeByStage: [],
    completedStages: { invalid: true },
    coreHp: -10,
    coreShield: -3,
    gold: -50,
    shards: null,
    levels: [],
    branches: [],
    upgrades: null,
    doctrines: { invalid: true },
    relics: null,
    rerolls: -1,
    rewardChoices: {
      broken: { invalid: true },
      future: ['doctrine_future'],
    },
    stats: {
      kills: -2,
      damage: null,
      byCharacter: {
        rumi: null,
        guardian: { damage: -9, futureMetric: 7 },
      },
      extension: { retained: true },
    },
    extension: { retained: true },
  })));

  const run = repository.loadRun();
  assert.equal(run.phase, 'map');
  assert.equal(run.stageNumber, 1);
  assert.equal(run.selectedNode, 0);
  assert.deepEqual(run.selectedNodeByStage, {});
  assert.deepEqual(run.completedStages, []);
  assert.equal(run.coreHp, 0);
  assert.equal(run.coreShield, 0);
  assert.equal(run.gold, 0);
  assert.equal(run.shards, 0);
  assert.equal(run.rerolls, 0);
  assert.equal(run.levels.rumi, 1);
  assert.deepEqual(run.branches, {});
  assert.deepEqual(run.upgrades, {});
  assert.deepEqual(run.doctrines, []);
  assert.deepEqual(run.relics, []);
  assert.deepEqual(run.rewardChoices, { future: ['doctrine_future'] });
  assert.equal(run.stats.kills, 0);
  assert.equal(run.stats.damage, 0);
  assert.equal(run.stats.byCharacter.rumi, undefined);
  assert.equal(run.stats.byCharacter.guardian.damage, 0);
  assert.equal(run.stats.byCharacter.guardian.futureMetric, 7);
  assert.equal(run.stats.extension.retained, true);
  assert.equal(run.extension.retained, true);
});

test('SaveRepository sanitizes non-finite numbers before serializing a run', () => {
  const storage = new MemoryStorage();
  const repository = new SaveRepository({ storage, logger: { warn() {} } });
  const saved = repository.saveRun(validRun({
    coreHp: Number.NaN,
    gold: Number.POSITIVE_INFINITY,
    stats: { damage: Number.NaN, elapsedSeconds: -4, byCharacter: {} },
    extension: { retained: true },
  }));

  assert.equal(saved.coreHp, 100);
  assert.equal(saved.gold, 0);
  assert.equal(saved.stats.damage, 0);
  assert.equal(saved.stats.elapsedSeconds, 0);
  assert.equal(saved.extension.retained, true);
  assert.doesNotMatch(storage.getItem(SAVE_KEYS.run), /NaN|Infinity/);
});

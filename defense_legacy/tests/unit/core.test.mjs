import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FIXED_TIME_STEP,
  GameLoop,
  MAX_CATCH_UP_STEPS,
  MAX_FRAME_DELTA,
} from '../../js/core/GameLoop.js';
import { EventBus } from '../../js/core/EventBus.js';
import { SeededRng } from '../../js/core/SeededRng.js';
import { CommandQueue } from '../../js/core/CommandQueue.js';
import {
  ENTITY_ACTIVE_CAPS,
  ENTITY_POOL_CAPS,
  EntityRegistry,
} from '../../js/battle/EntityRegistry.js';

test('SeededRng reproduces draws, integer ranges, picks and non-mutating shuffles', () => {
  const left = new SeededRng('V2-DETERMINISM');
  const right = new SeededRng('V2-DETERMINISM');
  assert.deepEqual(
    Array.from({ length: 16 }, () => left.next()),
    Array.from({ length: 16 }, () => right.next()),
  );

  const ranged = new SeededRng('integer-ranges');
  for (let index = 0; index < 100; index += 1) {
    const zeroBased = ranged.int(4);
    assert.ok(zeroBased >= 0 && zeroBased < 4);
    const value = ranged.int(-3, 7);
    assert.ok(value >= -3 && value < 7);
  }
  assert.ok(['a', 'b', 'c'].includes(ranged.pick(['a', 'b', 'c'])));
  const source = [1, 2, 3, 4, 5];
  const shuffled = ranged.shuffle(source);
  assert.deepEqual(source, [1, 2, 3, 4, 5]);
  assert.deepEqual([...shuffled].sort(), source);

  assert.throws(() => new SeededRng(42), /seed must be a string/);
  assert.throws(() => ranged.int(0), /greater than/);
  assert.throws(() => ranged.int(1.5, 3), /safe integers/);
  assert.throws(() => ranged.pick([]), /empty array/);
  assert.throws(() => ranged.shuffle('nope'), /expects an array/);
});

test('SeededRng labelled forks do not consume their parent and snapshots restore the exact next draw', () => {
  const parent = new SeededRng('root-seed');
  const untouched = new SeededRng('root-seed');
  const spawnA = parent.fork('spawn');
  const spawnB = parent.fork('spawn');
  const critical = parent.fork('critical');

  assert.deepEqual(
    Array.from({ length: 8 }, () => spawnA.next()),
    Array.from({ length: 8 }, () => spawnB.next()),
  );
  assert.notDeepEqual(
    Array.from({ length: 4 }, () => parent.fork('spawn').next()),
    Array.from({ length: 4 }, () => critical.next()),
  );
  assert.equal(parent.next(), untouched.next(), 'forking must not advance the parent stream');

  const rng = new SeededRng('checkpoint-rng');
  Array.from({ length: 11 }, () => rng.next());
  const snapshot = rng.snapshot();
  const expected = Array.from({ length: 12 }, () => rng.next());
  const replayA = SeededRng.restore(snapshot);
  const replayB = SeededRng.restore(snapshot);
  assert.deepEqual(Array.from({ length: 12 }, () => replayA.next()), expected);
  assert.deepEqual(Array.from({ length: 12 }, () => replayB.next()), expected);
  assert.throws(() => SeededRng.restore({ ...snapshot, version: 99 }), /Unsupported/);
  assert.throws(() => SeededRng.restore({ ...snapshot, state: [0, 1, 2] }), /four uint32/);
});

test('EventBus snapshots listeners during emit and supports once, symbols, removal and clearing', () => {
  const bus = new EventBus();
  const calls = [];
  let unsubscribeSecond;
  bus.on('tick', (value) => {
    calls.push(`first:${value}`);
    unsubscribeSecond();
  });
  unsubscribeSecond = bus.on('tick', (value) => calls.push(`second:${value}`));
  bus.once('tick', (value) => calls.push(`once:${value}`));

  assert.equal(bus.listenerCount('tick'), 3);
  assert.equal(bus.emit('tick', 1), 3);
  assert.deepEqual(calls, ['first:1', 'second:1', 'once:1']);
  assert.equal(bus.listenerCount('tick'), 1);
  assert.equal(bus.emit('tick', 2), 1);
  assert.deepEqual(calls, ['first:1', 'second:1', 'once:1', 'first:2']);

  const symbol = Symbol('battle');
  bus.on(symbol, () => calls.push('symbol'));
  assert.equal(bus.emit(symbol), 1);
  bus.clear(symbol);
  assert.equal(bus.listenerCount(symbol), 0);
  bus.clear();
  assert.equal(bus.listenerCount('tick'), 0);
  assert.throws(() => bus.on(3, () => {}), /string or symbol/);
  assert.throws(() => bus.on('bad', null), /must be a function/);
});

test('GameLoop caps frame delta, performs at most five fixed updates and records dropped work', () => {
  let now = 1_000;
  const scheduled = [];
  const cancelled = [];
  const updates = [];
  const renders = [];
  let nextHandle = 1;
  const loop = new GameLoop({
    update: (...args) => updates.push(args),
    render: (...args) => renders.push(args),
    now: () => now,
    requestFrame: (callback) => {
      scheduled.push(callback);
      return nextHandle++;
    },
    cancelFrame: (handle) => cancelled.push(handle),
  });

  assert.equal(loop.start(), true);
  assert.equal(loop.start(), false);
  assert.equal(scheduled.length, 1);
  const result = scheduled.shift()(1_500);
  assert.equal(result.elapsed, MAX_FRAME_DELTA);
  assert.equal(result.updates, MAX_CATCH_UP_STEPS);
  assert.equal(updates.length, MAX_CATCH_UP_STEPS);
  assert.ok(updates.every(([delta]) => delta === FIXED_TIME_STEP));
  assert.ok(loop.droppedUpdates >= 1);
  assert.equal(renders.length, 1);
  assert.equal(renders[0][1].updates, MAX_CATCH_UP_STEPS);
  assert.ok(result.alpha >= 0 && result.alpha <= 1);
  assert.ok(Math.abs(loop.simulationTime - FIXED_TIME_STEP * MAX_CATCH_UP_STEPS) < 1e-12);

  now = 2_000;
  loop.reset();
  assert.equal(loop.simulationTime, 0);
  assert.equal(loop.droppedUpdates, 0);
  assert.equal(loop.stop(), true);
  assert.equal(cancelled.length, 1);
  assert.equal(loop.stop(), false);
  assert.equal(loop.tick(3_000), null);
});

test('GameLoop stops immediately when update throws', () => {
  const loop = new GameLoop({
    update: () => { throw new Error('update exploded'); },
    now: () => 0,
    requestFrame: () => 1,
    cancelFrame: () => {},
  });
  loop.start();
  assert.throws(() => loop.tick(1_000), /update exploded/);
  assert.equal(loop.running, false);
});

test('CommandQueue drains by tick and insertion order while preserving future commands', () => {
  const queue = new CommandQueue();
  const late = queue.enqueue('late', { id: 1 }, 5);
  const earlyA = queue.enqueue('early-a', { id: 2 }, 2);
  const earlyB = queue.enqueue('early-b', { id: 3 }, 2);
  assert.ok(Object.isFrozen(late));
  assert.deepEqual(queue.drainThrough(2), [earlyA, earlyB]);
  assert.deepEqual(queue.drainThrough(4), []);
  assert.deepEqual(queue.drainThrough(), [late]);
  assert.throws(() => queue.enqueue('', {}, 0), /type is required/);
  queue.enqueue('discard');
  queue.clear();
  assert.deepEqual(queue.drainThrough(), []);
});

test('EntityRegistry enforces 45 active enemies and excludes resolved enemies from its active count', () => {
  assert.equal(ENTITY_ACTIVE_CAPS.enemies, 45);
  const registry = new EntityRegistry();
  const enemies = Array.from({ length: ENTITY_ACTIVE_CAPS.enemies }, (_, index) => registry.add('enemies', {
    hp: 10,
    dead: index === 0,
    reachedCore: index === 1,
  }));
  assert.equal(registry.enemies.size, 45);
  assert.equal(registry.activeEnemyCount(), 43);
  assert.throws(() => registry.add('enemies', { hp: 10 }), /active entity cap/);
  registry.remove('enemies', enemies[0].id);
  assert.doesNotThrow(() => registry.add('enemies', { hp: 10 }));
});

test('EntityRegistry enforces 250 active particles and 40 active damage popups, then caps their pools', () => {
  assert.equal(ENTITY_POOL_CAPS.particles, 250);
  assert.equal(ENTITY_POOL_CAPS.damagePopups, 40);
  const registry = new EntityRegistry();
  const particles = Array.from({ length: 250 }, () => registry.add('particles', { life: 1 }));
  const popups = Array.from({ length: 40 }, () => registry.add('damagePopups', { value: 1 }));
  assert.throws(() => registry.add('particles', { life: 1 }), /active entity cap/);
  assert.throws(() => registry.add('damagePopups', { value: 1 }), /active entity cap/);

  for (const particle of particles) registry.remove('particles', particle.id);
  for (const popup of popups) registry.remove('damagePopups', popup.id);
  assert.equal(registry.poolStats().particles, 250);
  assert.equal(registry.poolStats().damagePopups, 40);
});

test('EntityRegistry reuses cleared pool objects and returns detached public snapshots', () => {
  const registry = new EntityRegistry();
  const projectile = registry.add('projectiles', {
    x: 1,
    nested: { value: 2 },
    _privateCounter: 9,
  });
  const originalId = projectile.id;
  registry.remove('projectiles', originalId);
  const reused = registry.add('projectiles', { x: 7 });
  assert.strictEqual(reused, projectile);
  assert.equal(reused.nested, undefined);
  assert.equal(reused._privateCounter, undefined);
  assert.notEqual(reused.id, originalId);

  reused.nested = { value: 4 };
  reused._secret = 'hidden';
  const snapshot = registry.snapshot();
  assert.equal(snapshot.projectiles[0]._secret, undefined);
  snapshot.projectiles[0].nested.value = 99;
  assert.equal(reused.nested.value, 4);
  assert.strictEqual(registry.get(reused.id), reused);
  registry.clear();
  assert.equal(registry.get(reused.id), undefined);
  assert.equal(registry.poolStats().available, 0);
  assert.equal(registry.nextId('enemy'), 'enemy_0001');
});

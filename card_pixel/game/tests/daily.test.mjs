import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as Bridge from '../src/engine/bridge.js';
import * as Daily from '../src/engine/daily-rift.js';
import * as DailyStore from '../src/engine/daily-store.js';
import * as Meta from '../src/engine/meta.js';
import { create as makeRoster } from '../src/engine/roster.js';
import * as Run from '../src/engine/run.js';
import * as Save from '../src/engine/save.js';
import { coreBundle } from '../tools/core-bundle.mjs';
import { dailyTotals, playDaily } from '../tools/sim.mjs';

process.env.TZ = 'Asia/Tokyo';
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const sandbox = { console, Math, __relayCoreTimer: Bridge.scheduleTimer, location: { search: '?seed=7' } };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(coreBundle(repo), sandbox);
const core = sandbox.RelayCore;
const manifest = JSON.parse(fs.readFileSync(new URL('../assets/sprites.json', import.meta.url), 'utf8'));
const sp = Object.fromEntries(Object.entries(manifest).map(([name, sprite]) => [name.replace(/\.png$/, ''), sprite]));
const roster = makeRoster(core, { sp });
const deps = { core, roster };
const FIRST = '2026-11-21';
const SECOND = '2026-11-22';
const STARLIT = '2026-11-25';
const KEY = 'relaymare.daily';
const nowOn = key => new Date(`${key}T12:00:00`);

function memoryStorage() {
  return {
    values: {}, failWrite: false,
    getItem(key) { return this.values[key] ?? null; },
    setItem(key, value) {
      if (this.failWrite) throw new Error('Storage is unavailable');
      this.values[key] = value;
    },
    removeItem(key) { delete this.values[key]; }
  };
}

function unlockedProfile() {
  const profile = Meta.createProfile();
  profile.notebook.chapters.push(1, 2, 4);
  profile.recruits.ash = { bond: 3, since: 1 };
  profile.lead = 'ash';
  profile.seals.midnight_trench = ['werebear'];
  profile.reserved = 'void_knight';
  profile.seenCharacters = ['ash'];
  profile.seenRelics = ['reverse'];
  profile.contractStamps = { ember_volcano: { rescue: 'earlier-run' } };
  return profile;
}

function ok(result) {
  assert.equal(result.ok, true, result.reason);
  return result;
}

function reason(result, expected) {
  assert.deepEqual(result, { ok: false, reason: expected });
}

function start(store, key, kind = 'official', profile = unlockedProfile()) {
  return store.start({ profile, now: nowOn(key), expectedDayKey: key, kind });
}

function attempt(key, overrides = {}) {
  return Run.createRun({ ...deps, daily: { spec: Daily.specFor(key, roster), kind: 'official', attemptNo: 1 }, ...overrides });
}

function settle(run, changes = {}) {
  const { party, enemies } = Run.battleOptions(run);
  return Run.settleBattle(run, {
    outcome: 'win', survivors: party.map(Boolean), retreated: [false, false, false],
    turns: 3, heirloomsUsed: 0, lastStands: 0, heirloomsGained: [],
    enemyDowns: enemies.map((_, idx) => ({ idx, treasure: true })), ...changes
  });
}

function advance(run) {
  ok(Run.leaveRoom(run));
  ok(Run.nextFloor(run));
}

function reach(run, floor, { treasure = 0, event = false, altarRolls = 0 } = {}) {
  while (run.floor < floor) {
    const index = run.floor === 2 ? treasure : Number(run.floor === 5 && altarRolls > 0);
    ok(Run.chooseDoor(run, index));
    if (run.room.enemies.length) {
      ok(Run.confirmOrder(run, Run.defaultParty(run)));
      ok(settle(run));
    } else if (run.room.type === 'treasure') {
      ok(Run.takeTreasure(run));
    } else if (run.room.type === 'event' && event) {
      ok(Run.chooseEvent(run, run.pending.choices[0].id));
    } else if (run.room.type === 'altar') {
      for (let i = 0; i < altarRolls; i++) ok(Run.altarRoll(run));
      ok(Run.altarKeep(run));
    }
    advance(run);
  }
  return run;
}

test('the first rift is fixed by date alone and opens at notebook chapter four', () => {
  const storage = memoryStorage();
  const store = DailyStore.create(storage, deps);
  const locked = Meta.createProfile();
  locked.notebook.chapters.push(3);
  assert.equal(Meta.dailyRiftUnlocked(locked), false);
  assert.equal(store.view(locked, nowOn(FIRST)).spec, null);
  reason(start(store, FIRST, 'official', locked), 'locked');
  const profile = unlockedProfile();
  assert.equal(Meta.dailyRiftUnlocked(profile), true);
  const spec = Daily.specFor(FIRST, roster);
  assert.deepEqual(spec, {
    ruleVersion: 1, dayKey: FIRST, seed: 20261121, dungeonId: 'midnight_trench', bossId: 'poseidon',
    loanIds: ['werebear', 'void_knight', 'cure_master', 'succubus', 'archangel'],
    gateIds: ['silent_librarian', 'red_dragon'], wildIds: { 1: ['night_bat'], 6: ['wraith'] },
    relicIds: ['double_attack', 'big_bang', 'lucky_vicky', 'gale_storm'], eventId: 'glass_pawprints', riskId: 'martyr',
    sky: { 1: null, 4: null, 6: null, 7: null }, altarSeed: 4035896521
  });
  assert.deepEqual(store.view(profile, nowOn(FIRST)).spec, spec);
  sandbox.location.search = '?seed=42';
  locked.notebook.chapters.push(4);
  assert.deepEqual(store.view(locked, nowOn(FIRST)).spec, spec);
  assert.equal(storage.getItem(KEY), null);
  reason(start(store, FIRST, 'practice'), 'official_required');
  const run = ok(start(store, FIRST)).run;
  assert.deepEqual(run.daily, { spec, kind: 'official', attemptNo: 1 });
  assert.equal(run.id, `rift/v1/${FIRST}/1`);
  assert.deepEqual([run.floor, run.floors, run.phase, run.crystals, run.contract], [1, 7, 'map', 0, null]);
  for (const ids of [run.pool, run.bench, run.joinOrder]) {
    assert.deepEqual(ids, spec.loanIds);
    assert.notEqual(ids, run.daily.spec.loanIds);
  }
  assert.deepEqual(Run.defaultParty(run), spec.loanIds.slice(0, 3));
  assert.equal(run.rng.state, spec.altarSeed);
  ok(Run.chooseDoor(run, 0));
  reason(Run.confirmOrder(run, run.bench.slice(0, 2)), 'invalid_party');
  ok(Run.confirmOrder(run, [run.joinOrder[3], run.joinOrder[1], run.joinOrder[4]]));

  for (const opts of [{ seed: 7 }, { dungeonId: spec.dungeonId }, { profileView: {} }, { difficulty: 'nightmare' },
    { contract: 'rescue' }, { plain: true }, { daily: { spec, kind: 'practice', attemptNo: 1 } },
    { daily: { spec: { ...spec, loanIds: spec.loanIds.map(() => 'werebear') }, kind: 'official', attemptNo: 1 } },
    { daily: { spec: { ...spec, ruleVersion: 2 }, kind: 'official', attemptNo: 1 } }]) {
    assert.throws(() => attempt(FIRST, opts), { name: 'RangeError', message: 'invalid_daily_options' });
  }
});

test('the fixed starlit sky and battle seeds survive alternate doors, events and altar rolls', () => {
  assert.deepEqual(Daily.specFor(STARLIT, roster).sky, { 1: [], 4: ['sun_bless', 'star_powder'], 6: [], 7: [] });
  assert.equal(Daily.specFor('2024-02-29', roster).dayKey, '2024-02-29');
  assert.throws(() => Daily.specFor('2026-02-29', roster), RangeError);
  const play = (options, index) => {
    const run = reach(attempt(STARLIT), 6, options);
    const doors = run.doors;
    ok(Run.chooseDoor(run, index));
    ok(Run.confirmOrder(run, Run.defaultParty(run)));
    const six = Run.battleOptions(run);
    ok(settle(run));
    advance(run);
    ok(Run.chooseDoor(run, 0));
    ok(Run.confirmOrder(run, Run.defaultParty(run)));
    return { doors, six, boss: Run.battleOptions(run) };
  };
  const left = play({ treasure: 0, event: true, altarRolls: 1 }, 0);
  const right = play({ treasure: 1, event: false, altarRolls: 3 }, 1);
  assert.deepEqual(left.doors, right.doors);
  assert.deepEqual(left.six.enemies, right.six.enemies.map(({ affixes, ...enemy }) => enemy));
  assert.deepEqual(right.six.enemies[0].affixes, ['thorns']);
  assert.deepEqual(left.six.start, right.six.start);
  assert.equal(left.six.seed, right.six.seed);
  assert.deepEqual(left.boss.enemies, right.boss.enemies);
  assert.equal(left.boss.seed, right.boss.seed);
  const ember = attempt('2026-12-03');
  assert.deepEqual(ember.doors[0].enemies, ember.daily.spec.wildIds[1].map(id => roster.wildOf(id, 0.84 * 0.65)));
});

test('swapping the arena boss order changes the real fight to a 46-turn win with a named heirloom', () => {
  const lost = playDaily(SECOND, { bossOrder: ['hellhound', 'trauma', 'time_ruler'] });
  const won = playDaily(SECOND, { bossOrder: ['hellhound', 'time_ruler', 'trauma'] });
  assert.deepEqual([lost.result, lost.floor, lost.stats.turns, lost.bench], ['lose', 7, 31, ['discipline_captain', 'entropy']]);
  assert.deepEqual([won.result, won.floor, won.stats.turns, won.bench.length], ['win', 7, 46, 3]);
  assert.equal(won.heirlooms.trauma.from, 'time_ruler');
  assert.equal(won.heirlooms.trauma.name, '종언의예고');
});

test('battle settlement pays zero crystals, grants risk D once, and accepts a zero-survivor boss win', () => {
  const store = DailyStore.create(memoryStorage(), deps);
  const key = '2026-12-03';
  ok(start(store, key));
  const win = playDaily(key, { naive: true });
  const ended = ok(store.finish(win));
  assert.deepEqual([ended.official.outcome, ended.score.turns, ended.score.livingIds], ['win', 49, []]);
  assert.deepEqual(Run.finishRun(win), { result: 'win', recruitable: [], recruitLimit: 0, shardCandidates: [] });
  assert.equal(win.pending, null);

  const wiped = attempt(FIRST);
  ok(Run.chooseDoor(wiped, 0));
  ok(Run.confirmOrder(wiped, Run.defaultParty(wiped)));
  const first = ok(settle(wiped, { survivors: [false, false, false], retreated: [true, false, false] }));
  assert.deepEqual(first.survivors, ['werebear']);
  assert.deepEqual(Run.defaultParty(wiped), ['werebear', 'succubus', 'archangel']);
  advance(wiped);
  reach(wiped, 4);
  ok(Run.chooseDoor(wiped, 0));
  ok(Run.confirmOrder(wiped, Run.defaultParty(wiped)));
  assert.equal(ok(settle(wiped, { survivors: [false, false, false] })).result, 'lose');

  const run = reach(attempt(FIRST), 4);
  ok(Run.chooseDoor(run, 0));
  ok(Run.confirmOrder(run, Run.defaultParty(run)));
  const gate = ok(settle(run));
  assert.deepEqual([gate.crystals, gate.contract, gate.pending, run.crystals], [0, null, null, 0]);
  advance(run);
  reach(run, 6);
  ok(Run.chooseDoor(run, 1));
  ok(Run.confirmOrder(run, Run.defaultParty(run)));
  const turns = run.stats.turns;
  const id = run.daily.spec.relicIds[3];
  assert.deepEqual(ok(settle(run)).relic, { id, equipped: true });
  reason(Run.settleBattle(run, { turns: 30 }), 'no_active_battle');
  assert.equal(run.stats.turns, turns + 3);
  assert.equal(run.relics.filter(relic => relic === id).length, 1);
  assert.deepEqual([run.seenCharacters, run.seenRelics, run.eligible], [[], [], []]);
});

test('Tokyo midnight changes new attempts, while the active date and local clock history stay independent', () => {
  const storage = memoryStorage();
  const store = DailyStore.create(storage, deps);
  const profile = unlockedProfile();
  const before = new Date('2026-11-21T14:59:59Z');
  const after = new Date('2026-11-21T15:00:00Z');
  assert.equal(Daily.dayKey(before), FIRST);
  assert.equal(Daily.dayKey(after), SECOND);
  const seen = store.view(profile, before);
  reason(store.start({ profile, now: after, expectedDayKey: seen.dayKey, kind: 'official' }), 'date_changed');
  assert.equal(storage.getItem(KEY), null);
  const run = ok(store.start({ profile, now: before, expectedDayKey: FIRST, kind: 'official' })).run;
  assert.deepEqual(store.view(profile, after).active, { runId: run.id, dayKey: FIRST, kind: 'official', floor: 1 });
  reason(start(store, SECOND), 'active_exists');
  reason(store.finish(run), 'run_not_done');
  assert.equal(ok(store.finish(playDaily(FIRST, { naive: true }))).score.dayKey, FIRST);
  assert.equal(store.view(profile, after).official, null);
  reason(start(store, FIRST), 'already_recorded');
  assert.equal(ok(start(store, FIRST, 'practice')).run.id, `rift/v1/${FIRST}/2`);
  ok(store.abandon(ok(store.resume()).run.id));
  ok(store.abandon(ok(start(store, '2027-01-19')).run.id));
  ok(store.abandon(ok(start(store, SECOND)).run.id));
  ok(store.abandon(ok(start(store, '2020-02-29')).run.id));
});

test('restoring battle and altar checkpoints preserves the independent main session for all outcomes', () => {
  const storage = memoryStorage();
  const session = Save.createSaveStore(storage, deps);
  const profile = unlockedProfile();
  const main = Run.createRun({ ...deps, dungeonId: 'ember_volcano', seed: 7, profileView: { reserved: profile.reserved } });
  while (main.pending?.kind === 'start') ok(Run.chooseStartPick(main, main.pending.candidates[0]));
  reach(main, 4);
  ok(Run.chooseDoor(main, 0));
  ok(Run.confirmOrder(main, Run.defaultParty(main)));
  ok(settle(main));
  session.save({ profile, run: main });
  const savedMain = storage.getItem('relaymare.session');
  const store = DailyStore.create(storage, deps);
  assert.equal(store.view(session.load().profile, nowOn(FIRST)).unlocked, true);
  assert.equal(store.view(profile, nowOn(FIRST)).active, null);
  reason(store.resume(), 'no_active');
  let run = ok(start(store, FIRST)).run;
  ok(Run.chooseDoor(run, 0));
  const order = Run.suggestOrder(run);
  ok(Run.confirmOrder(run, order));
  const battle = Run.battleOptions(run);
  Bridge.create(core, battle).start();
  ok(store.save(run));
  const reopened = DailyStore.create(storage, deps);
  run = ok(reopened.resume()).run;
  assert.equal(run.room.status, 'order');
  assert.deepEqual(Run.defaultParty(run), order);
  assert.equal(run.stats.turns, 0);
  assert.deepEqual(run.fallen, []);
  ok(Run.confirmOrder(run, order));
  assert.deepEqual(Run.battleOptions(run), battle);
  ok(settle(run));
  advance(run);
  reach(run, 5, { event: true });
  ok(Run.chooseDoor(run, 1));
  ok(Run.altarRoll(run));
  const second = ok(Run.altarRoll(run));
  ok(reopened.save(run));
  const restored = ok(store.resume()).run;
  const { id, multiplier, jackpot } = second;
  assert.deepEqual(restored.pending, { kind: 'altar', rolls: 2, roll: { id, multiplier, jackpot } });
  assert.deepEqual(restored.rng, run.rng);
  assert.deepEqual(restored.relics, run.relics);
  assert.equal(ok(Run.altarRoll(restored)).rollsLeft, 0);
  assert.deepEqual(Meta.recordRunProgress(profile, restored), { profile, announce: { ok: true, chapters: [] } });
  assert.equal(session.save({ profile, run: restored }), false);
  assert.equal(storage.getItem('relaymare.session'), savedMain);
  for (const [key, options] of [[FIRST, {}], [SECOND, { bossOrder: ['hellhound', 'trauma', 'time_ruler'] }]]) {
    if (key !== FIRST) ok(start(store, key));
    const ended = playDaily(key, options);
    assert.equal(Meta.applyRunEnd(profile, ended).announce.reason, 'daily_run');
    assert.equal(session.save({ profile, run: ended }), false);
    assert.equal(ok(store.finish(ended)).score.outcome, key === FIRST ? 'win' : 'lose');
    assert.equal(storage.getItem('relaymare.session'), savedMain);
  }
  const abandoned = ok(start(store, STARLIT)).run;
  assert.equal(ok(store.abandon(abandoned.id)).score.outcome, 'abandon');
  assert.equal(storage.getItem('relaymare.session'), savedMain);
  assert.deepEqual(session.load().profile, JSON.parse(savedMain).profile);
});

test('the first record and stamp stay fixed while practice best and duplicate receipts update independently', () => {
  const storage = memoryStorage();
  const store = DailyStore.create(storage, deps);
  ok(start(store, FIRST));
  const first = playDaily(FIRST, { naive: true });
  const official = ok(store.finish(first)).score;
  assert.deepEqual([official.outcome, official.turns, official.livingIds.length], ['win', 27, 1]);
  const pinnedRoster = { ...roster, pool() { throw new Error('The stored spec should be used'); } };
  const reopened = DailyStore.create(storage, { core, roster: pinnedRoster });
  const run = ok(start(reopened, FIRST, 'practice')).run;
  assert.deepEqual(run.daily.spec, first.daily.spec);
  const better = playDaily(FIRST);
  better.id = run.id;
  better.daily = run.daily;
  const scored = ok(reopened.finish(better));
  assert.deepEqual(scored.official, official);
  assert.deepEqual([scored.bestPractice.outcome, scored.bestPractice.turns, scored.bestPractice.livingIds.length], ['win', 33, 3]);
  assert.equal(scored.duplicate, false);
  const abandon = ok(start(store, FIRST, 'practice')).run;
  const abandoned = ok(store.abandon(abandon.id));
  assert.deepEqual(abandoned.bestPractice, scored.bestPractice);
  const another = ok(start(store, FIRST, 'practice')).run;
  ok(store.abandon(another.id));
  const before = storage.getItem(KEY);
  assert.deepEqual(ok(reopened.finish(first)), { ...scored, score: official, duplicate: true });
  assert.deepEqual(ok(reopened.finish(better)), { ...scored, duplicate: true });
  assert.deepEqual(ok(reopened.abandon(abandon.id)), { ...abandoned, duplicate: true });
  assert.equal(storage.getItem(KEY), before);
  const history = reopened.history();
  assert.equal(history.rows.length, 1);
  assert.equal(history.rows.filter(row => row.official.outcome === 'win').length, 1);
  assert.deepEqual(history.rows[0].bestPractice, scored.bestPractice);
  const score = (outcome, floor, turns, livingIds) => ({ outcome, floor, turns, livingIds });
  assert.equal(Daily.compare(score('win', 7, 100, []), score('lose', 7, 1, ['a'])), 1);
  assert.equal(Daily.compare(score('lose', 4, 10, []), score('abandon', 7, 20, ['a'])), 1);
  assert.equal(Daily.compare(score('lose', 4, 10, ['a']), score('lose', 6, 20, [])), -1);
  assert.equal(Daily.compare(score('lose', 4, 10, ['a']), score('lose', 4, 20, [])), 0);
  assert.equal(Daily.compare(score('win', 7, 20, ['a']), score('win', 7, 10, ['b'])), -1);
  assert.equal(Daily.compare(scored.bestPractice, official), 1);
  assert.equal(Daily.compare(official, official), 0);
});

test('failed writes preserve the active checkpoint and history paginates completed dates', () => {
  const storage = memoryStorage();
  const store = DailyStore.create(storage, deps);
  storage.failWrite = true;
  reason(start(store, FIRST), 'storage_failed');
  assert.equal(storage.getItem(KEY), null);
  storage.failWrite = false;
  const run = ok(start(store, FIRST)).run;
  const checkpoint = storage.getItem(KEY);
  storage.failWrite = true;
  reason(store.save(run), 'storage_failed');
  reason(store.abandon(run.id), 'storage_failed');
  const end = playDaily(FIRST, { naive: true });
  reason(store.finish(end), 'storage_failed');
  assert.equal(storage.getItem(KEY), checkpoint);
  storage.failWrite = false;
  ok(store.finish(end));
  for (let day = 22; day <= 28; day++) {
    const next = ok(start(store, `2026-11-${day}`)).run;
    ok(store.abandon(next.id));
  }
  ok(start(store, '2026-11-29'));
  const page = store.history();
  assert.deepEqual(page.rows.map(row => row.dayKey), [28, 27, 26, 25, 24, 23, 22].map(day => `2026-11-${day}`));
  assert.equal(page.nextBefore, SECOND);
  assert.deepEqual(store.history({ before: page.nextBefore }).rows.map(row => row.dayKey), [FIRST]);
  assert.equal(store.history({ before: page.nextBefore }).nextBefore, null);
  store.clear();
  assert.equal(storage.getItem(KEY), null);
  assert.deepEqual(store.history(), { rows: [], nextBefore: null });
});

test('an unreadable snapshot can be abandoned using the last written checkpoint', () => {
  const storage = memoryStorage();
  const store = DailyStore.create(storage, deps);
  const run = reach(ok(start(store, FIRST)).run, 4);
  ok(store.save(run));
  const data = JSON.parse(storage.getItem(KEY));
  data.active.snapshot = '{';
  storage.setItem(KEY, JSON.stringify(data));
  reason(store.resume(), 'invalid_save');
  const { score } = ok(store.abandon(run.id));
  assert.deepEqual([score.outcome, score.floor, score.turns, score.livingIds], ['abandon', 4, 3, run.daily.spec.loanIds]);
});

test('the daily sim reproduces both design policy totals across 60 first attempts', () => {
  assert.deepEqual(dailyTotals(FIRST, 60), [
    { policy: 'Careless', wins: 33, turns: 2040 },
    { policy: 'Careful', wins: 37, turns: 2229 }
  ]);
});

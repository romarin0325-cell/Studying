import assert from 'node:assert/strict';
import test from 'node:test';
import { episodeState } from '../src/engine/episodes.js';
import { applyRunEnd, createProfile } from '../src/engine/meta.js';
import { createSaveStore } from '../src/engine/save.js';
import { saveEpisodeFlags } from '../src/ui/screens/collection.js';
import { LAST_GOOD_KEY, SESSION_KEY } from '../src/ui/storage.js';
import { playRun } from '../tools/sim.mjs';
import { createCoreRoster } from './support/core.mjs';

const { core, roster } = createCoreRoster();
const night = 'night_rabbit';
const snow = 'snow_rabbit';
const stale = { ok: false, reason: 'stale_tab' };

function storageFixture() {
  const values = new Map();
  const writes = [];
  let failKey;
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) {
      if (key === failKey) return false;
      writes.push(key);
      values.set(key, value);
    },
    removeItem(key) {
      writes.push(key);
      values.delete(key);
    }
  };
  return { storage, writes, failOn(key) { failKey = key; } };
}

function openTabs() {
  const { storage, writes } = storageFixture();
  const profile = createProfile();
  profile.ui.entry.legacy = true;
  const { run, end } = playRun('dawn_forest', 1007919, { profile, naive: true, opening: 'stand' });
  assert.equal(run.phase, 'done');
  assert.equal(run.pending.kind, 'recruit');
  assert.ok([night, snow].every(id => end.recruitable.includes(id)));
  const a = createSaveStore(storage, { core, roster });
  const b = createSaveStore(storage, { core, roster });
  assert.ok(a.save({ profile, run }).ok);
  return { storage, writes, a, b, tabA: a.load(), tabB: b.load() };
}

function select(store, { profile, run }, id) {
  return store.save({ profile: { ...profile, ui: { ...profile.ui, recruitChoices: { runId: run.id, ids: [id] } } }, run });
}

function confirm(store, { profile, run }, id) {
  const settled = applyRunEnd(profile, run, { recruits: [id] });
  assert.ok(settled.announce.ok);
  return store.save({ profile: settled.profile });
}

function storageEvent(events, key, newValue = null) {
  events.dispatchEvent(Object.assign(new Event('storage'), { key, newValue }));
}

for (const first of ['A', 'B']) {
  test(`tab ${first}'s confirmed recruit and good backup survive stale selection and confirmation`, () => {
    const { storage, writes, a, b, tabA, tabB } = openTabs();
    const [winner, loser, winnerTab, loserTab, recruited, staleChoice] = first === 'A'
      ? [a, b, tabA, tabB, night, snow] : [b, a, tabB, tabA, snow, night];
    assert.ok(confirm(winner, winnerTab, recruited).ok);
    const live = storage.getItem(SESSION_KEY);
    const backup = storage.getItem(LAST_GOOD_KEY);
    assert.equal(JSON.parse(live).revision, 2);
    assert.equal(backup, live);
    const writeCount = writes.length;

    assert.deepEqual(select(loser, loserTab, staleChoice), stale);
    assert.deepEqual(confirm(loser, loserTab, staleChoice), stale);
    assert.equal(writes.length, writeCount);
    assert.equal(storage.getItem(SESSION_KEY), live);
    assert.equal(storage.getItem(LAST_GOOD_KEY), backup);
    assert.equal(JSON.parse(live).profile.records.runs, 1);
    assert.deepEqual(Object.keys(loser.load().profile.recruits), [recruited]);
    assert.deepEqual(Object.keys(loser.loadLastGood().profile.recruits), [recruited]);
  });
}

test('the storage listener makes the older tab stale, and reloading lets it confirm the latest pending settlement', () => {
  const { storage, a, b, tabA, tabB } = openTabs();
  const events = new EventTarget();
  let notices = 0;
  b.watchStale(events, () => { notices++; });
  assert.ok(select(a, tabA, night).ok);
  storageEvent(events, LAST_GOOD_KEY);
  storageEvent(events, 'relaymare.settings');
  assert.equal(notices, 0);
  storageEvent(events, SESSION_KEY, storage.getItem(SESSION_KEY));
  storageEvent(events, SESSION_KEY, storage.getItem(SESSION_KEY));
  assert.equal(notices, 1);
  assert.deepEqual(confirm(b, tabB, snow), stale);

  const reloaded = createSaveStore(storage, { core, roster });
  const latest = reloaded.load();
  assert.deepEqual(latest.profile.ui.recruitChoices.ids, [night]);
  assert.ok(confirm(reloaded, latest, snow).ok);
  assert.equal(JSON.parse(storage.getItem(SESSION_KEY)).revision, 3);
  assert.deepEqual(Object.keys(reloaded.loadLastGood().profile.recruits), [snow]);
  assert.deepEqual(confirm(a, tabA, night), stale);
});

test('the active slot changes only after a current tab successfully restores a backup', () => {
  const { storage, a, b, tabA, tabB } = openTabs();
  const old = a.exportBackup();
  assert.ok(confirm(a, tabA, night).ok);
  assert.deepEqual(b.restoreBackup(old), stale);
  assert.deepEqual(b.restoreLastGood(), stale);
  assert.deepEqual(b.clear(), stale);

  let notices = 0;
  const events = new EventTarget();
  b.load();
  b.watchStale(events, () => { notices++; });
  storageEvent(events, 'relaymare.slotB.' + SESSION_KEY, JSON.stringify({ revision: 99 }));
  assert.equal(notices, 0);
  assert.ok(a.restoreBackup({ ...old, session: null }).ok);
  storageEvent(events, 'relaymare.activeSlot', 'b');
  assert.equal(notices, 1);
  assert.equal(JSON.parse(storage.getItem('relaymare.slotB.' + SESSION_KEY)).revision, 3);
  assert.deepEqual(select(b, tabB, snow), stale);
  assert.equal(b.load(), null);
});

test('an older tab stays stale when repeated recovery reuses its session slot and revision', () => {
  const { storage } = storageFixture();
  const old = createSaveStore(storage);
  const profile = createProfile();
  assert.ok(old.save({ profile }).ok);
  assert.ok(old.save({ profile }).ok);
  const file = JSON.stringify(old.exportBackup({ profile }));
  storage.setItem(SESSION_KEY, '{');

  const recovery = createSaveStore(storage);
  assert.equal(recovery.loadDetailed().status, 'profileDamaged');
  assert.ok(recovery.restoreBackup(file).ok);
  assert.ok(recovery.restoreBackup(file).ok);
  assert.equal(JSON.parse(storage.getItem(SESSION_KEY)).revision, 2);
  assert.deepEqual(old.save({ profile }), stale);
  assert.ok(recovery.save({ profile }).ok);
});

test('a revision-less session opens and its first save starts at revision 1', () => {
  const { storage } = storageFixture();
  const profile = createProfile();
  storage.setItem(SESSION_KEY, JSON.stringify({ version: 1, profile, run: null }));
  const store = createSaveStore(storage);
  assert.deepEqual(store.load(), { profile, run: null });
  assert.ok(store.save({ profile }).ok);
  assert.equal(JSON.parse(storage.getItem(SESSION_KEY)).revision, 1);
});

test('a failed backup write keeps the preceding good copy after the live save commits', () => {
  const { storage, failOn } = storageFixture();
  const store = createSaveStore(storage, { core, roster });
  const { tabA } = openTabs();
  assert.ok(confirm(store, tabA, night).ok);
  const good = storage.getItem(LAST_GOOD_KEY);
  const { profile } = store.load();
  failOn(LAST_GOOD_KEY);
  assert.ok(store.save({ profile: { ...profile, ui: { ...profile.ui, endingSeen: true } } }).ok);
  assert.equal(store.load().profile.ui.endingSeen, true);
  assert.equal(storage.getItem(LAST_GOOD_KEY), good);
});

test('episode flags stay uncommitted when the save fails, then write successfully on retry', () => {
  const { a, tabA } = openTabs();
  assert.ok(confirm(a, tabA, snow).ok);
  const { profile: recruited } = a.load();
  const { run } = playRun('ember_volcano', 7, { profile: recruited, difficulty: 'easy' });
  const { profile, announce } = applyRunEnd(recruited, run);
  assert.ok(announce.ok);
  assert.equal(episodeState(profile, snow), 'new');

  const { storage: target, failOn } = storageFixture();
  const store = createSaveStore(target, { core, roster });
  assert.ok(store.save({ profile }).ok);
  const good = target.getItem(LAST_GOOD_KEY);
  const checkpoint = playRun('ember_volcano', 21, { profile, difficulty: 'easy' }).run;
  assert.ok(store.save({ profile, run: checkpoint }).ok);
  const primary = target.getItem(SESSION_KEY);
  const writeFlags = (field, writer = store) => saveEpisodeFlags(profile, field, [snow], writer.saveEpisodeFlags);

  failOn(SESSION_KEY);
  assert.equal(writeFlags('episodesUnlocked'), false);
  assert.equal(writeFlags('episodesRead'), false);
  assert.equal(profile.ui.episodesUnlocked, undefined);
  assert.equal(episodeState(profile, snow), 'new');
  assert.equal(target.getItem(SESSION_KEY), primary);
  assert.equal(target.getItem(LAST_GOOD_KEY), good);

  failOn(undefined);
  assert.equal(writeFlags('episodesUnlocked'), true);
  assert.equal(writeFlags('episodesRead'), true);
  assert.equal(episodeState(profile, snow), 'read');
  const saved = JSON.parse(target.getItem(SESSION_KEY));
  assert.equal(saved.revision, 4);
  assert.deepEqual(saved.run, JSON.parse(primary).run);
  assert.equal(episodeState(store.load().profile, snow), 'read');
  assert.equal(episodeState(store.loadLastGood().profile, snow), 'read');
  assert.deepEqual(Object.keys(JSON.parse(target.getItem(LAST_GOOD_KEY)).profile.recruits), [snow]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { DUNGEONS } from '../src/content/dungeons.js';
import { EVENTS } from '../src/content/events.js';
import { INTRO } from '../src/content/intro.js';
import { LAYOUTS } from '../src/content/layouts.js';
import { RELICS } from '../src/content/relics.js';
import * as Bridge from '../src/engine/bridge.js';
import * as Meta from '../src/engine/meta.js';
import { create as makeRoster, GRADE_BUCKETS, gradeOf } from '../src/engine/roster.js';
import * as Run from '../src/engine/run.js';
import * as Save from '../src/engine/save.js';
import { mulberry32, nextFloat, shuffle } from '../src/engine/rng.js';
import { coreBundle } from '../tools/core-bundle.mjs';

const sandbox = { console, Math, __relayCoreTimer: Bridge.scheduleTimer };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(coreBundle(fileURLToPath(new URL('../../../', import.meta.url))), sandbox);
const core = sandbox.RelayCore;
const manifest = JSON.parse(fs.readFileSync(new URL('../assets/sprites.json', import.meta.url), 'utf8'));
const sp = Object.fromEntries(Object.entries(manifest).map(([name, sprite]) => [name.replace(/\.png$/, ''), sprite]));
const roster = makeRoster(core, { sp });
const make = (opts = {}) => Run.createRun({ core, roster, dungeonId: 'ember_volcano', seed: 7, ...opts });

function ok(result) {
  assert.equal(result.ok, true, result.reason);
  return result;
}

function startPicks(run) {
  while (run.pending?.kind === 'start') ok(Run.chooseStartPick(run, run.pending.candidates[0] || null));
}

function settle(run, extra = {}) {
  const opts = Run.battleOptions(run);
  return ok(Run.settleBattle(run, {
    summary: () => ({
      outcome: 'win', survivors: opts.party.map(Boolean), retreated: [false, false, false],
      heirloomsGained: [], heirloomsUsed: 0, lastStands: 0,
      enemyDowns: opts.enemies.map((enemy, idx) => ({ idx, treasure: false })), bestHit: null,
      turns: 3, bet: null, ...extra
    })
  }));
}

function enter(run, index = 0, party) {
  ok(Run.chooseDoor(run, index));
  if (run.room.status === 'order') ok(Run.confirmOrder(run, party || run.bench.slice(0, 3)));
}

function advance(run) {
  ok(Run.leaveRoom(run));
  if (run.phase !== 'done') ok(Run.nextFloor(run));
}

function reach(run, floor) {
  startPicks(run);
  while (run.floor < floor) {
    enter(run);
    if (Run.battleOptions(run)) settle(run);
    startPicks(run);
    advance(run);
  }
  return run;
}

function clear(run) {
  reach(run, run.floors);
  enter(run);
  settle(run);
  if (run.phase !== 'done') advance(run);
  Run.finishRun(run);
  return run;
}

function roundTrip(run, actualRoster = roster) {
  const restored = Save.restoreRun(Save.serializeRun(run), { core, roster: actualRoster });
  assert.ok(restored);
  assert.deepEqual(restored, run);
  return restored;
}

test('dungeons, events and relics resolve against the card core and current sprite manifest', () => {
  for (const dungeon of Object.values(DUNGEONS)) {
    const cards = roster.pool(dungeon.pool);
    assert.ok(cards.length >= 12, dungeon.id);
    for (const grade of GRADE_BUCKETS) assert.ok(cards.some(id => gradeOf(roster.card(id).grade) === grade), dungeon.id + '/' + grade);
    assert.ok(cards.every(id => roster.has(id)));
    assert.equal(dungeon.floors, LAYOUTS[dungeon.layout].length);
    assert.equal(dungeon.floors, dungeon.tiers.length);
    assert.deepEqual(LAYOUTS[dungeon.layout].map(floor => floor.length),
      dungeon.layout === 'intro' ? [1, 1, 2, 2, 1] : [1, 2, 3, 1, 2, 2, 2, 1]);
    assert.ok(dungeon.wild.every(id => roster.wild.includes(id)));
    for (const boss of [dungeon.boss, ...dungeon.hiddenBosses]) {
      if (boss === 'shadow_pair') assert.ok(LAYOUTS[dungeon.layout].at(-1)[0].final);
      else assert.equal(roster.bossOf(boss).id, boss);
    }
  }
  for (const event of EVENTS) {
    for (const ids of Object.values(event.requires)) {
      for (const id of ids) assert.ok(roster.card(id), event.id + '/' + id);
    }
  }
  for (const id of Object.keys(RELICS)) assert.ok(core.ARTIFACT_LIST.some(artifact => artifact.id === id), id);
});

test('role-prefixed creature and boss assets coexist with allies of the same id', () => {
  const roleRoster = makeRoster(core, { sp: {
    'golem-idle': { kind: 'ally' }, 'wild_golem-idle': { facing: 'left' },
    'gray-idle': { kind: 'ally' }, 'boss_gray-idle': { facing: 'right' }
  } });
  assert.ok(roleRoster.allies.includes('golem') && roleRoster.allies.includes('gray'));
  assert.equal(roleRoster.wildOf('golem').sprite, 'wild_golem');
  assert.equal(roleRoster.wildOf('golem').facing, 'left');
  assert.equal(roleRoster.bossOf('gray').sprite, 'boss_gray');
  assert.equal(roster.wildOf('golem').sprite, 'golem');
  assert.equal(roster.bossOf('gray').sprite, 'gray');
});

test('serialized RNG matches the bridge sequence and a seeded expedition repeats', () => {
  const rng = { state: 173 }, bridgeRng = mulberry32(173);
  for (let i = 0; i < 30; i++) assert.equal(nextFloat(rng), bridgeRng());
  assert.deepEqual(shuffle(structuredClone(rng), [1, 2, 3, 4]), shuffle(rng, [1, 2, 3, 4]));
  assert.deepEqual(clear(make()), clear(make()));
});

for (const dungeonId of Object.keys(DUNGEONS)) {
  test(dungeonId + ' reaches done through every floor with battle summaries', () => {
    const run = clear(make({ dungeonId, seed: 413 }));
    assert.equal(run.phase, 'done');
    assert.equal(run.result, 'win');
    assert.equal(run.floor, run.floors);
    assert.equal(run.stats.battles, dungeonId === 'dawn_forest' ? 3 : 5);
    assert.equal(run.stats.gateWins, 1);
    assert.ok(Run.finishRun(run).recruitable.length > 0);
  });
}

test('start picks preserve seals, reserve an unchosen shadow, and guarantee an available companion at the spring', () => {
  const run = make({ profileView: {
    lead: 'ash', companions: ['snow_rabbit'], preferredCompanion: 'snow_rabbit',
    reserved: 'luna', seals: ['siren']
  } });
  assert.deepEqual(run.bench, ['ash']);
  assert.ok(run.pending.candidates.includes('luna'));
  assert.ok(run.pending.candidates.some(id => roster.card(id).element === 'fire'));
  assert.ok(!run.pool.includes('siren'));
  startPicks(run);
  assert.equal(run.bench.length, 5);
  assert.equal(run.crystals, 1);
  assert.ok(run.unchosen.includes(run.reserved) && !run.bench.includes(run.reserved));
  const reserved = run.reserved;
  reach(run, 3);
  enter(run);
  assert.ok(!run.bench.includes('snow_rabbit') && run.reserved !== 'snow_rabbit');
  const picked = ok(Run.springPick(run));
  assert.ok(picked.candidates.includes('snow_rabbit'));
  ok(Run.springTake(run, picked.candidates[0]));
  advance(run);
  assert.equal(run.doors[0].enemies[0].source, reserved);
});

test('invalid or exhausted wakings do not charge crystals', () => {
  const limited = { ...roster, pool: () => ['ash', 'siren', 'luna', 'queen', 'santa'] };
  const run = reach(make({ roster: limited }), 3);
  enter(run);
  const state = Save.serializeRun(run);
  assert.equal(Run.springDraw(run).reason, 'empty_pool');
  assert.equal(Run.springPick(run).reason, 'empty_pool');
  assert.equal(Save.serializeRun(run), state);
});

test('the expedition restores start, map, battle entrance, spring, gate and recruitment choices', () => {
  let run = roundTrip(make());
  startPicks(run);
  run = roundTrip(run);
  enter(run);
  const options = Run.battleOptions(run);
  run = Save.restoreRun(Save.serializeRun(run), { core, roster });
  assert.equal(run.room.status, 'order');
  ok(Run.confirmOrder(run, options.party));
  assert.deepEqual(Run.battleOptions(run), options);
  settle(run);
  advance(run);
  reach(run, 3);
  enter(run);
  const before = run.crystals;
  const { candidates } = ok(Run.springPick(run));
  run = roundTrip(run);
  assert.deepEqual(run.pending.candidates, candidates);
  assert.equal(run.crystals, before - Run.COST.pick);
  assert.equal(Run.springPick(run).ok, false);
  ok(Run.springTake(run, candidates[0]));
  assert.equal(run.crystals, before - Run.COST.pick);
  advance(run);
  enter(run);
  settle(run);
  const gate = structuredClone(run.pending);
  const gateCrystals = run.crystals;
  run = roundTrip(run);
  assert.deepEqual(run.pending, gate);
  const id = gate.candidates[0];
  ok(Run.chooseGateReward(run, { kind: 'join', id }));
  assert.equal(Run.chooseGateReward(run, { kind: 'join', id }).ok, false);
  assert.equal(run.crystals, gateCrystals);
  assert.ok(!run.eligible.includes(id));
  advance(run);
  run = roundTrip(clear(run));
  assert.deepEqual(Run.finishRun(run), {
    result: run.result, recruitable: run.pending.recruitable, recruitLimit: 1, shardCandidates: []
  });
});

for (const retreat of [false, true]) {
  test('borrowed battle ' + (retreat ? 'retreat saves all three' : 'Ash falls and Snow Rabbit keeps Armageddon'), () => {
    const run = make({ dungeonId: 'dawn_forest', seed: 490 });
    enter(run);
    const opts = Run.battleOptions(run);
    assert.deepEqual(opts.party, INTRO.party);
    assert.equal(opts.enemies[0].stats.hp, 220);
    assert.deepEqual(opts.start, { allyStart: { 0: { hp: 40, mp: 0 } } });
    const bridge = Bridge.create(core, opts);
    bridge.start();
    if (retreat) bridge.retreat();
    else bridge.act(0);
    if (bridge.awaiting) {
      const skill = bridge.options().find(option => retreat ? option.name === '실버스톰' : option.heirloom);
      assert.ok(skill);
      bridge.act(skill.index);
    }
    assert.equal(bridge.outcome, 'win');
    ok(Run.settleBattle(run, bridge));
    advance(run);
    enter(run);
    if (retreat) assert.deepEqual(run.pending.candidates, INTRO.party);
    else {
      assert.deepEqual(run.pending.candidates.slice(0, 2), INTRO.party.slice(1));
      assert.ok(!run.pending.candidates.includes('ash'));
      ok(Run.chooseStartPick(run, 'snow_rabbit'));
      assert.deepEqual(run.heirlooms.snow_rabbit, { from: 'ash', name: '아마겟돈' });
    }
  });
}

test('first intro floor-five loss restores the bench and choices at room entrance', () => {
  const run = reach(make({ dungeonId: 'dawn_forest' }), 5);
  enter(run);
  const bench = run.bench.slice();
  const fate = run.fallen.slice();
  const crystals = run.crystals;
  const enemies = structuredClone(run.room.enemies);
  const result = settle(run, { outcome: 'lose', survivors: [false, false, false], enemyDowns: [] });
  assert.equal(result.retry, true);
  assert.equal(run.result, null);
  assert.equal(run.room.status, 'order');
  assert.deepEqual(run.bench, bench);
  assert.deepEqual(run.fallen, fate);
  assert.equal(run.crystals, crystals);
  assert.deepEqual(run.room.enemies, enemies);
  assert.equal(roundTrip(run).stats.retries, 1);
  ok(Run.confirmOrder(run, bench.slice(1, 4)));
  settle(run);
  advance(run);
  assert.equal(Run.finishRun(run).result, 'win');
  const replay = reach(make({ dungeonId: 'dawn_forest', profileView: { introCleared: true } }), 5);
  enter(replay);
  assert.equal(settle(replay, { outcome: 'lose', survivors: [false, false, false] }).result, 'lose');
});

test('order, summary and rewards reject replay and exclude the fallen', () => {
  const run = reach(make(), 4);
  const [lead, second, third] = run.bench;
  enter(run, 0, [null, second, lead]);
  assert.deepEqual(Run.battleOptions(run).party, [null, second, lead]);
  assert.deepEqual(run.bench.slice(0, 3), [second, lead, third]);
  assert.equal(Run.settleBattle(run, { outcome: 'win' }).reason, 'invalid_battle_summary');
  const before = run.crystals;
  settle(run, {
    survivors: [false, false, false], retreated: [false, false, true], heirloomsUsed: 1, lastStands: 1,
    enemyDowns: [{ idx: 0, treasure: true }, { idx: 0, treasure: true }],
    bestHit: { amount: 1234, by: lead, skill: '시험' }
  });
  assert.ok(run.fallen.includes(second));
  assert.deepEqual(run.eligible, [lead]);
  assert.equal(run.stats.heirloomsUsed, 1);
  assert.equal(run.stats.lastStands, 1);
  assert.equal(run.stats.best, 1234);
  assert.equal(run.crystals, before + 5 + Number(roster.card(lead).trait?.type === 'looter'));
  assert.equal(run.pending.candidates.length, 1);
  assert.equal(Run.chooseGateReward(run, { kind: 'join', id: second }).ok, false);
  assert.equal(Run.settleBattle(run, { outcome: 'win' }).reason, 'no_active_battle');
  advance(run);
  clear(run);
  assert.ok(!Run.finishRun(run).recruitable.includes(second));
});

test('self-destruct wipes resolve as defeat unless this was the boss', () => {
  const limited = { ...roster, pool: () => ['ash'] };
  for (const [floor, result] of [[1, 'lose'], [4, 'lose'], [8, 'win']]) {
    const run = reach(make({ roster: limited }), floor);
    enter(run);
    assert.equal(settle(run, { survivors: [false, false, false] }).wiped, true);
    assert.equal(Run.finishRun(run).result, result);
  }
});

test('tower chooses a different second rule and nightmare uses the hidden boss', () => {
  const run = reach(make({ dungeonId: 'creation_tower' }), 5);
  assert.equal(new Set([run.region.id, ...run.doors.map(door => door.regionChoice.id)]).size, 3);
  const chosen = run.doors[1].regionChoice;
  enter(run, 1);
  ok(Run.takeTreasure(run));
  advance(run);
  enter(run);
  assert.deepEqual(Run.battleOptions(run).region, chosen);
  const nightmare = make({ dungeonId: 'midnight_trench', difficulty: 'nightmare' });
  assert.equal(nightmare.boss, 'demon_god');
  reach(nightmare, 8);
  enter(nightmare);
  assert.equal(Run.battleOptions(nightmare).enemies[0].id, 'demon_god');
  assert.ok(Run.battleOptions(nightmare).enemies[0].affixes.length);
});

test('event bets and start modifiers pay at most once and expire after the next fight', () => {
  const findEvent = id => {
    for (let seed = 0; seed < 200; seed++) {
      const run = reach(make({ dungeonId: 'creation_tower', seed }), 3);
      if (run.doors[2].event?.id === id) return run;
    }
    assert.fail('Event never offered: ' + id);
  };
  let run = findEvent('armor_test');
  enter(run, 2);
  ok(Run.chooseEvent(run, 'heat'));
  advance(run);
  enter(run);
  assert.deepEqual(Run.battleOptions(run).start.enemyDebuffs, { burn: 2 });
  settle(run);
  assert.equal(run.nextBattle, null);

  run = findEvent('fifth_bell');
  enter(run, 2);
  ok(Run.chooseEvent(run, 'timing'));
  advance(run);
  enter(run);
  assert.deepEqual(Run.battleOptions(run).bet, { kind: 'kill_on_turn', turn: 5 });
  const before = run.crystals;
  const result = settle(run, { bet: { kind: 'kill_on_turn', won: true } });
  assert.equal(run.crystals, before + result.crystals);
  assert.ok(result.crystals >= 6);
  assert.equal(run.nextBattle, null);
  assert.equal(Run.settleBattle(run, {}).ok, false);
});

test('merchant appears with a sprite-backed merchant and charges only for completed purchases', () => {
  const merchantRoster = makeRoster(core, { sp: { ...sp, 'grand_merchant-idle': { kind: 'ally' } } });
  let run;
  for (let seed = 0; seed < 200; seed++) {
    run = reach(make({ dungeonId: 'creation_tower', roster: merchantRoster, seed, profileView: { lead: 'ash' } }), 5);
    if (run.doors[0].event?.id === 'grand_merchant') break;
  }
  assert.equal(run.doors[0].event.id, 'grand_merchant');
  enter(run);
  const relic = run.room.relic;
  const before = run.crystals;
  const sale = roundTrip(run, merchantRoster);
  assert.equal(Run.chooseEvent(sale, 'release', 'ash').ok, false);
  const id = sale.bench.find(candidate => candidate !== 'ash');
  ok(Run.chooseEvent(sale, 'release', id));
  assert.ok(!sale.bench.includes(id) && sale.released.includes(id));
  assert.ok(sale.crystals > before);
  const buy = ok(Run.chooseEvent(run, 'relic'));
  assert.equal(buy.crystals, -4);
  assert.ok(run.relics.includes(relic));
  assert.equal(Run.chooseEvent(run, 'waking').ok, false);
  assert.equal(run.crystals, before - 4);

  const full = JSON.parse(Save.serializeRun(sale));
  full.run.room.status = 'service';
  full.run.pending = { kind: 'event' };
  full.run.relics = Object.keys(RELICS).filter(id => id !== relic).slice(0, 4);
  const account = Save.restoreRun(full, { core, roster: merchantRoster });
  const crystals = account.crystals;
  ok(Run.chooseEvent(account, 'relic'));
  assert.equal(account.crystals, crystals);
  const restored = roundTrip(account, merchantRoster);
  const replace = restored.pending.replace[0];
  assert.equal(Run.equipRelic(restored, relic, 'unknown').ok, false);
  ok(Run.equipRelic(restored, relic, replace));
  assert.equal(restored.relics.length, 4);
  assert.ok(restored.relics.includes(relic) && !restored.relics.includes(replace));
  assert.equal(restored.crystals, crystals - 4);
  assert.equal(Run.equipRelic(restored, relic, replace).ok, false);
});

test('the altar resumes the latest roll and limits one visit to three rolls', () => {
  let run = reach(make(), 3);
  enter(run, 1);
  ok(Run.altarRoll(run));
  ok(Run.altarRoll(run));
  const latest = ok(Run.altarRoll(run));
  run = roundTrip(run);
  assert.equal(Run.altarRoll(run).ok, false);
  assert.equal(Run.leaveRoom(run).ok, false);
  const kept = ok(Run.altarKeep(run));
  assert.equal(kept.id, latest.id);
  assert.equal(run.blessings[kept.id], latest.multiplier);
  assert.equal(Run.altarKeep(run).ok, false);
});

test('meta enforces recruitment limits, bonds, seals and all seven notebook chapters', () => {
  let profile = Meta.createProfile();
  assert.deepEqual(Meta.availableDungeons(profile).map(entry => entry.id), ['dawn_forest']);
  assert.throws(() => make({ profileView: Meta.startView(profile) }), /Locked dungeon/);
  const play = (dungeonId, difficulty = 'normal') => clear(make({
    dungeonId, difficulty, profileView: Meta.startView(profile, dungeonId)
  }));
  const apply = (run, choices) => {
    const result = Meta.applyRunEnd(profile, run, choices);
    ok(result.announce);
    profile = result.profile;
    return result.announce;
  };
  const intro = play('dawn_forest');
  const firstLead = intro.eligible[0];
  assert.equal(Meta.applyRunEnd(profile, intro, { recruits: intro.eligible.slice(0, 2) }).announce.ok, false);
  apply(intro, { recruits: [firstLead] });
  assert.equal(profile.lead, firstLead);
  assert.equal(Meta.applyRunEnd(profile, intro).announce.reason, 'already_applied');
  assert.deepEqual(Meta.availableDungeons(profile).map(entry => entry.id), ['dawn_forest', 'ember_volcano', 'twilight_cathedral']);

  const ember = play('ember_volcano');
  const nextLead = Run.finishRun(ember).recruitable[0];
  assert.ok(nextLead);
  assert.equal(apply(ember, { recruits: [nextLead] }).bonds[0].id, firstLead);
  assert.equal(profile.recruits[firstLead].bond, 1);
  assert.deepEqual(profile.notebook.chapters, [1, 2, 3, 4]);
  assert.ok(profile.nightmareUnlocks.includes('ember_volcano'));
  const limited = { ...roster, pool: () => ['siren', 'ash', 'snow_rabbit', 'luna'] };
  assert.equal(Meta.setSeals(profile, 'ember_volcano', ['siren'], limited).announce.reason, 'empty_grade');
  profile = Meta.setSeals(profile, 'ember_volcano', ['sunflower'], roster).profile;
  assert.deepEqual(Meta.startView(profile, 'ember_volcano').seals, ['sunflower']);
  profile = Meta.setExpeditionParty(profile, { lead: nextLead, companions: [firstLead] }).profile;

  const nightmare = play('ember_volcano', 'nightmare');
  assert.equal(Run.finishRun(nightmare).recruitLimit, 2);
  const recruits = Run.finishRun(nightmare).recruitable.slice(0, 2);
  assert.equal(recruits.length, 2);
  apply(nightmare, { recruits });
  assert.equal(Meta.startView(profile, 'ember_volcano').sealSlots, 3);
  assert.equal(Meta.startView(profile, 'ember_volcano').companionSlots, 3);
  apply(play('twilight_cathedral'));
  apply(play('midnight_trench'));
  apply(play('creation_tower'));
  assert.ok(Meta.notebookView(profile).every(chapter => chapter.completed));
});

test('a loss can reserve one fought character for a future start without recruiting them', () => {
  const profile = Meta.createProfile();
  const run = reach(make(), 1);
  enter(run);
  const [id] = Run.battleOptions(run).party;
  settle(run, { outcome: 'lose', survivors: [false, false, false], enemyDowns: [] });
  assert.ok(run.fallen.includes(id));
  assert.equal(Meta.applyRunEnd(profile, run, { recruits: [id] }).announce.ok, false);
  const done = Meta.applyRunEnd(profile, run, { shard: id });
  ok(done.announce);
  assert.equal(done.profile.reserved, id);
  assert.deepEqual(done.profile.recruits, {});
  const next = make({ dungeonId: 'midnight_trench', profileView: { reserved: done.profile.reserved } });
  assert.ok(next.pending.candidates.includes(id));
});

test('profile migration and injected session storage keep profile and run together', () => {
  const profile = Meta.createProfile();
  assert.deepEqual(Save.restoreProfile(Save.serializeProfile(profile)), profile);
  const oldProfile = { ...profile, version: 0 };
  assert.equal(Save.restoreProfile(oldProfile), null);
  assert.deepEqual(Save.restoreProfile(oldProfile, { migrate: (data, version) => ({ ...data, version }) }), profile);
  const entries = new Map();
  const storage = {
    getItem: key => entries.get(key),
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key)
  };
  const save = Save.createSaveStore(storage, { core, roster });
  const run = make();
  assert.equal(save.load(), null);
  save.save({ profile, run });
  assert.deepEqual(save.load(), { profile, run });
  save.save({ profile });
  assert.deepEqual(save.load(), { profile, run: null });
  save.clear();
  assert.equal(save.load(), null);
});

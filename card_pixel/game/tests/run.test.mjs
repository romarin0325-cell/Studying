import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { CONTRACT_ESCROW, CONTRACT_PAYOUT } from '../src/content/contracts.js';
import { DUNGEONS } from '../src/content/dungeons.js';
import { EVENTS } from '../src/content/events.js';
import { INTRO } from '../src/content/intro.js';
import { LAYOUTS } from '../src/content/layouts.js';
import { RELICS } from '../src/content/relics.js';
import * as Bridge from '../src/engine/bridge.js';
import * as Meta from '../src/engine/meta.js';
import { openingModel } from '../src/engine/opening.js';
import { create as makeRoster, GRADE_BUCKETS, gradeOf } from '../src/engine/roster.js';
import { makeDoors } from '../src/engine/rooms.js';
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
// Retain the original seeded fixtures on v1. The tempo tests below use the new-run default.
const make = (opts = {}) => Run.createRun({ core, roster, dungeonId: 'ember_volcano', seed: 7, tempoVersion: 1, ...opts });
const makeTempo = (opts = {}) => Run.createRun({ core, roster, dungeonId: 'ember_volcano', seed: 7, ...opts });

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
  if (run.pending?.kind === 'reinforcement') ok(Run.resolveReinforcement(run, { key: run.pending.key, id: null }));
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

function profileWithSnowRabbit() {
  const intro = reach(make({ dungeonId: 'dawn_forest', seed: 7 }), 2);
  enter(intro);
  ok(Run.chooseStartPick(intro, 'snow_rabbit'));
  startPicks(intro);
  advance(intro);
  const result = Meta.applyRunEnd(Meta.createProfile(), clear(intro), { recruits: ['snow_rabbit'] });
  ok(result.announce);
  return result.profile;
}

test('review 3: a gate relic paid by the championship bet leaves the shadow choice open', () => {
  const run = reach(make({
    dungeonId: 'arena', seed: 1103811, profileView: { lead: 'luna', companions: ['underdog'] }
  }), 3);
  enter(run, 2);
  assert.equal(run.room.event.id, 'championship');
  ok(Run.chooseEvent(run, 'team'));
  advance(run);
  enter(run);
  assert.equal(run.room.relic, 'double_attack');
  settle(run, { bet: { kind: 'same_grade_full', won: true } });
  assert.ok(run.relics.includes('double_attack'));
  assert.equal(run.pending.relic, null);
  assert.equal(Run.chooseGateReward(run, { kind: 'relic', id: 'double_attack' }).ok, false);
  const shadow = run.pending.candidates[0];
  assert.equal(ok(Run.chooseGateReward(run, { kind: 'join', id: shadow })).joined, shadow);
});

test('review 4: the intro seed 7 first awakening gives a saved Siren shard priority', () => {
  const run = make({ dungeonId: 'dawn_forest', seed: 7, profileView: { reserved: 'siren' } });
  enter(run, 0, INTRO.party);
  settle(run, { survivors: [false, true, true] });
  advance(run);
  enter(run);
  assert.deepEqual(run.pending.candidates, ['siren', 'snow_rabbit', 'silver_rabbit']);
});

test('review 5: seed 91 reserves an unchosen gatekeeper while Snow Rabbit is guaranteed at the spring', () => {
  const run = make({ seed: 91, profileView: {
    lead: 'ash', companions: ['snow_rabbit'], preferredCompanion: 'snow_rabbit'
  } });
  assert.ok(run.pending.candidates.includes('snow_rabbit'));
  ok(Run.chooseStartPick(run, 'zeke'));
  assert.ok(run.unchosen.includes(run.reserved));
  assert.notEqual(run.reserved, 'snow_rabbit');
  reach(run, 3);
  enter(run);
  assert.ok(!run.bench.includes('snow_rabbit'));
  assert.ok(ok(Run.springPick(run)).candidates.includes('snow_rabbit'));
});

test('review 6: an Aurora Wing heirloom survives settlement and reload with its form and skill', () => {
  let run = make({ seed: 0, profileView: { lead: 'miracle_larva', companions: ['executor'], reserved: 'executor' } });
  ok(Run.chooseStartPick(run, 'executor'));
  enter(run, 0, ['miracle_larva', 'executor']);
  const options = Run.battleOptions(run);
  const enemy = { ...options.enemies[0], stats: { hp: 1500, atk: 0, matk: 0, def: 0, mdef: 0 }, skills: [] };
  const battle = Bridge.create(core, { ...options, enemies: [enemy] });
  battle.start();
  const act = name => battle.act(battle.options().find(o => o.name === name).index);
  act('기적의우화');
  act('기적의우화 → 오로라윙');
  battle.host.battle.players[0].hp = 1;
  battle.host.battle.enemy.atk = 5000;
  battle.host.battle.enemy.baseAtk = 5000;
  battle.act(0);
  assert.equal(battle.options().find(o => o.heirloom).name, '뷰티토네이도');
  battle.host.battle.enemy.hp = 1;
  battle.act(0);
  ok(Run.settleBattle(run, battle));
  run = roundTrip(run);
  advance(run);
  enter(run, 0, ['executor']);
  const next = Bridge.create(core, Run.battleOptions(run));
  next.start();
  assert.equal(next.options().find(o => o.heirloom).name, '뷰티토네이도');
  assert.equal(run.heirlooms.executor.form, 'aurora_wing');
  assert.equal(run.heirlooms.executor.skill.name, '뷰티토네이도');
});

test('review 9: a normal risky door has exactly one quirk or affix', () => {
  for (const seed of [2, 3, 21, 91]) {
    const door = reach(make({ seed }), 2).doors[1];
    const affixes = door.enemies.flatMap(enemy => enemy.affixes || []);
    assert.equal(Number(!!door.quirk) + affixes.length, 1, 'seed ' + seed);
  }
});

test('review 11: representative and gate progress persist before the expedition ends', () => {
  const profile = profileWithSnowRabbit();
  const run = make({ seed: 0, profileView: Meta.startView(profile, 'ember_volcano') });
  let persisted;
  const store = Save.createSaveStore({
    getItem: () => persisted, setItem: (_, value) => { persisted = value; }
  }, { core, roster });
  store.save({ profile, run });
  let saved = store.load();
  assert.deepEqual(saved.profile.notebook, { chapters: [1, 2], firstLead: 'snow_rabbit' });
  reach(run, 4);
  enter(run);
  settle(run);
  store.save({ profile: saved.profile, run });
  saved = store.load();
  assert.deepEqual(saved.profile.notebook.chapters, [1, 2, 3]);
  assert.ok(saved.profile.seenRelics.includes(run.room.relic));
  assert.deepEqual(saved.run.pending, run.pending);

  const oldSession = JSON.parse(persisted);
  assert.deepEqual(oldSession.profile, saved.profile, 'progress was written with the session');
  persisted = JSON.stringify({ ...oldSession, profile });
  assert.deepEqual(store.load().profile, saved.profile, 'older saves recover already-earned progress');
});

test('review 12: an in-battle reload keeps empty front and middle seats at the room entrance', () => {
  for (const order of [[null, 'mawang', 'night_rabbit'], ['mawang', null, 'night_rabbit']]) {
    const run = make({
      dungeonId: 'twilight_cathedral', seed: 0, profileView: { lead: 'mawang', reserved: 'night_rabbit' }
    });
    ok(Run.chooseStartPick(run, 'night_rabbit'));
    reach(run, 6);
    enter(run, 0, order);
    const saved = Save.restoreRun(Save.serializeRun(run), { core, roster });
    assert.equal(saved.room.status, 'order');
    assert.deepEqual(saved.room.party, order);
    ok(Run.confirmOrder(saved, saved.room.party));
    assert.deepEqual(Run.battleOptions(saved), Run.battleOptions(run));
  }
});

test('review 15: Flora casts on enemy turns 5 and 10 and halves hits on player turns 6 and 11', () => {
  const flora = roster.bossOf('flora');
  const battle = Bridge.create(core, {
    seed: 0, party: ['red_dragon'],
    enemies: [{ ...flora, stats: { hp: 99999, atk: 0, matk: 0, def: 60, mdef: 60 } }]
  });
  battle.start();
  const casts = [];
  const halved = [];
  for (let turn = 1; turn <= 11; turn++) {
    if (battle.host.battle.enemy.buffs.damage_half) halved.push(turn);
    if (battle.act(0).some(e => e.t === 'act' && e.who.side === 'enemy' && e.skill.name === '제네시스블룸')) casts.push(turn);
  }
  assert.deepEqual(casts, [5, 10]);
  assert.deepEqual(halved, [6, 11]);
  assert.match(flora.note, /적의 5턴·10턴.*플레이어의 6턴·11턴/);
});

test('review 17: the Starlit Garden door exposes the Star Powder that the cake event adds', () => {
  const run = reach(make({ seed: 0, dungeonId: 'starlit_garden' }), 3);
  enter(run, 2);
  assert.equal(run.room.event.id, 'hidden_cake_crown');
  ok(Run.chooseEvent(run, 'powder'));
  advance(run);
  const start = Run.doorStart(run, 0);
  assert.deepEqual(start, { field: ['star_powder'], enemyDebuffs: {} });
  enter(run);
  const battle = Bridge.create(core, Run.battleOptions(run));
  const begin = battle.start().find(e => e.t === 'begin');
  assert.deepEqual(Array.from(begin.s.field), start.field);
});

test('review 18: door stats agree with battle HP on the seed 3 Echo door', () => {
  const run = reach(make({ seed: 3 }), 2);
  const door = run.doors[1];
  // A v1 save can still carry both Echo and Treasure on a normal door.
  door.quirk = 'echo';
  door.enemies[0].affixes = ['treasure'];
  const enemies = Run.doorEnemies(run, 1);
  assert.equal(enemies[0].maxHp, Math.floor(door.enemies[0].stats.hp * 1.2));
  assert.deepEqual(enemies[0].affixes, ['treasure']);
  assert.equal(door.reward, 2);
  enter(run, 1);
  const battle = Bridge.create(core, Run.battleOptions(run));
  battle.start();
  assert.equal(battle.host.battle.enemy.maxHp, enemies[0].maxHp);
});

test('review 22: a winning run lists living participants separately from the fallen lead', () => {
  const profile = profileWithSnowRabbit();
  const run = reach(make({ seed: 21, profileView: Meta.startView(profile, 'ember_volcano') }), 8);
  enter(run);
  const [lead, retreated, survivor] = run.room.party;
  assert.equal(lead, 'snow_rabbit');
  settle(run, { survivors: [false, false, true], retreated: [false, true, false] });
  const { announce } = Meta.applyRunEnd(profile, run);
  assert.equal(run.result, 'win');
  assert.ok(run.participated.includes(lead));
  assert.ok(!announce.returned.includes(lead));
  assert.ok(announce.returned.includes(retreated) && announce.returned.includes(survivor));
});

test('review SAVE: an unreadable run version or throwing migration keeps the recruited profile', () => {
  const profile = Meta.createProfile();
  profile.recruits.snow_rabbit = { bond: 2, since: 1 };
  let persisted;
  const storage = {
    getItem: () => persisted, setItem: (_, value) => { persisted = value; }
  };
  const store = Save.createSaveStore(storage, { core, roster });
  store.save({ profile, run: make() });
  const corrupt = JSON.parse(persisted);
  corrupt.run.version = 2;
  persisted = JSON.stringify(corrupt);
  const restored = store.load();
  assert.deepEqual(restored?.profile, profile);
  assert.equal(restored.run, null);
  assert.equal(typeof restored.runError, 'string');
  const migrating = Save.createSaveStore(storage, {
    core, roster, migrateRun() { throw new Error('migration failed'); }
  });
  assert.deepEqual(migrating.load(), restored);
  store.save(restored);
  assert.deepEqual(store.load(), { profile, run: null });
});

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
      assert.deepEqual(run.heirlooms.snow_rabbit, {
        from: 'ash', name: '아마겟돈', form: 'ash', skill: Bridge.heirloomSkill(roster.card('ash'))
      });
    }
  });
}

test('intro floor five keeps the reserved shadow and draws a normal or rare rival', () => {
  for (const seed of [7, 21, 413, 490]) {
    const run = reach(make({ dungeonId: 'dawn_forest', seed }), 5);
    const [reserved, rival] = run.doors[0].enemies;
    assert.equal(reserved.source, run.reserved);
    assert.notEqual(rival.source, reserved.source);
    assert.ok(['normal', 'rare'].includes(roster.card(rival.source).grade), 'seed ' + seed);
  }
});

test('intro floor five goes straight from victory to recruitment', () => {
  const run = reach(make({ dungeonId: 'dawn_forest' }), 5);
  assert.equal(run.doors[0].relic, null);
  enter(run);
  const { pending, survivors } = settle(run);
  assert.equal(pending, null);
  assert.equal(run.phase, 'done');
  assert.equal(run.stats.gateWins, 1);
  assert.deepEqual(Run.finishRun(run).recruitable, survivors);
});

test('a saved intro finale gate reward resumes at recruitment', () => {
  const run = reach(make({ dungeonId: 'dawn_forest' }), 5);
  enter(run);
  const { survivors } = settle(run);
  run.phase = 'reward';
  run.pending = { kind: 'gate', candidates: run.room.enemies.map(enemy => enemy.source), relic: 'reverse' };
  const restored = Save.restoreRun(Save.serializeRun(run), { core, roster });
  assert.equal(restored.phase, 'done');
  assert.equal(restored.pending, null);
  assert.deepEqual(Run.finishRun(restored).recruitable, survivors);
});

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
  assert.equal(run.phase, 'done');
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

test('intro: the borrowed-battle survivor not taken in the first pick is offered again in the second', () => {
  const run = make({ dungeonId: 'dawn_forest', seed: 7 });
  enter(run, 0, INTRO.party);
  // Ash falls, both rabbits survive (the stay-and-fight path)
  settle(run, { survivors: [false, true, true] });
  advance(run);
  enter(run);
  assert.equal(run.pending.kind, 'start');
  assert.ok(run.pending.candidates.includes('snow_rabbit') && run.pending.candidates.includes('silver_rabbit'));
  ok(Run.chooseStartPick(run, 'snow_rabbit'));
  assert.equal(run.pending.kind, 'start');
  assert.ok(run.pending.candidates.includes('silver_rabbit'), 'the other survivor is still a candidate');
});

const ember = 'ember_volcano';
const emptyStamps = { rescue: null, heirloom: null, elite: null };

function nightmareProfile() {
  const profile = profileWithSnowRabbit();
  const journey = clear(make({ profileView: Meta.startView(profile, ember) }));
  return Meta.applyRunEnd(profile, journey).profile;
}

function contractedRun(contract, opts = {}) {
  return make({ difficulty: 'nightmare', contract, profileView: { nightmareUnlocks: [ember] }, ...opts });
}

test('contracts require this dungeon’s unlocked nightmare and default to none', () => {
  const profile = profileWithSnowRabbit();
  const lockedView = Meta.startView(profile, ember);
  assert.deepEqual(Meta.contractsFor(profile, ember), { unlocked: false, stamps: emptyStamps });
  assert.throws(() => make({ difficulty: 'nightmare', contract: 'rescue', profileView: lockedView }), /Locked nightmare/);
  assert.throws(() => make({ difficulty: 'nightmare', contract: 'rescue' }), /Unavailable contract/);
  assert.throws(() => make({ dungeonId: 'dawn_forest', difficulty: 'nightmare', contract: 'rescue' }), /Unavailable difficulty/);

  const unlocked = nightmareProfile();
  const profileView = Meta.startView(unlocked, ember);
  assert.deepEqual(Meta.contractsFor(unlocked, ember), { unlocked: true, stamps: emptyStamps });
  assert.deepEqual(Meta.contractsFor(unlocked, 'twilight_cathedral'), { unlocked: false, stamps: emptyStamps });
  assert.throws(() => make({ contract: 'rescue', profileView }), /Unavailable contract/);
  assert.throws(() => make({ difficulty: 'nightmare', contract: 'toString', profileView }), /Unavailable contract/);
  assert.throws(() => make({ difficulty: 'nightmare', contract: ['rescue'], profileView }), /Unavailable contract/);
  assert.equal(make({ difficulty: 'nightmare', profileView }).contract, null);
  assert.deepEqual(contractedRun('rescue', { profileView }).contract, {
    id: 'rescue', met: false, metAtFloor: null, riskDoorTaken: false, escrowed: 0, paid: 0, failed: false
  });
});

test('rescue needs the fighter who withdrew from a lethal blow to survive a floor-four or floor-six win', () => {
  for (const { floor, lethal, retreatedAlive = true, incomingAlive, outcome, met } of [
    { floor: 4, lethal: true, incomingAlive: true, outcome: 'win', met: true },
    { floor: 6, lethal: true, incomingAlive: false, outcome: 'win', met: true },
    { floor: 4, lethal: false, incomingAlive: true, outcome: 'win', met: false },
    { floor: 6, lethal: true, retreatedAlive: false, incomingAlive: true, outcome: 'win', met: false },
    { floor: 6, lethal: true, incomingAlive: true, outcome: 'lose', met: false },
    { floor: 2, lethal: true, incomingAlive: true, outcome: 'win', met: false }
  ]) {
    const run = reach(contractedRun('rescue'), floor);
    enter(run);
    const [retreated, incoming] = run.room.party;
    const result = settle(run, {
      outcome, retreated: [retreatedAlive, false, false], survivors: [false, incomingAlive, true],
      rescues: [{ retreated, incoming, lethal }]
    });
    assert.equal(result.contract.metNow, met);
    assert.equal(run.contract.met, met);
    assert.equal(run.contract.metAtFloor, met ? floor : null);
    assert.equal(result.contract.failed, floor === 6 && !met);
  }
});

test('heirloom requires a killing hit and victory at the floor-four gate', () => {
  for (const [floor, kills, outcome, met] of [[4, 1, 'win', true], [4, 0, 'win', false],
    [4, 1, 'lose', false], [6, 1, 'win', false], [2, 1, 'win', false]]) {
    const run = reach(contractedRun('heirloom'), floor);
    enter(run);
    const result = settle(run, { outcome, heirloomsUsed: 1, heirloomKills: kills });
    assert.equal(result.contract.metNow, met);
    assert.equal(run.contract.metAtFloor, met ? 4 : null);
    assert.equal(result.contract.paid, 0);
    assert.equal(result.contract.failed, floor === 6);
  }
});

test('an heirloom received in an event qualifies at the gate', () => {
  const run = reach(contractedRun('heirloom'), 3);
  const door = run.doors.find(entry => entry.type === 'event');
  door.event = EVENTS.find(event => event.id === 'red_moon_scabbard');
  enter(run, door.index);
  const heir = run.bench[0];
  ok(Run.chooseEvent(run, 'blade', heir));
  advance(run);
  enter(run, 0, [heir]);

  const options = Run.battleOptions(run);
  const enemies = options.enemies.map(enemy => ({ ...enemy, stats: { hp: 1, atk: 0, matk: 0, def: 0, mdef: 0 }, skills: [] }));
  const battle = Bridge.create(core, { ...options, enemies });
  battle.start();
  battle.act(battle.options().find(move => move.heirloom).index);
  battle.act(0);
  assert.equal(battle.summary().heirloomKills, 1);
  assert.equal(ok(Run.settleBattle(run, battle)).contract.metNow, true);
});

test('elite requires both target doors and at least two winning survivors, including retreats', () => {
  for (const [risk, elite, survivors, outcome, met] of [
    [1, 1, [false, true, false], 'win', true],
    [0, 1, [false, true, true], 'win', false],
    [1, 0, [false, true, true], 'win', false],
    [1, 1, [false, false, false], 'win', false],
    [1, 1, [false, true, false], 'lose', false]
  ]) {
    const run = reach(contractedRun('elite'), 2);
    enter(run, risk);
    assert.equal(run.contract.riskDoorTaken, Boolean(risk));
    settle(run);
    advance(run);
    reach(run, 6);
    enter(run, elite);
    const result = settle(run, { outcome, survivors, retreated: [true, false, false] });
    assert.equal(result.contract.metNow, met);
    assert.equal(result.contract.failed, !met);
  }
});

test('contract escrow, payout and failure each settle once across saves', () => {
  for (const [gateKill, floorSixWin] of [[true, true], [false, true], [true, false]]) {
    let run = reach(contractedRun('heirloom'), 4);
    const gateCrystals = run.crystals;
    enter(run);
    const gateParty = run.room.party.slice();
    const gate = settle(run, { heirloomKills: Number(gateKill) });
    const looter = party => Number(party.some(id => roster.card(id).trait?.type === 'looter'));
    assert.equal(gate.crystals, run.room.reward + looter(gateParty) - CONTRACT_ESCROW);
    assert.equal(run.crystals, gateCrystals + gate.crystals);
    assert.deepEqual(gate.contract, {
      id: 'heirloom', met: gateKill, metNow: gateKill, escrowed: CONTRACT_ESCROW, paid: 0, failed: false
    });
    run = roundTrip(run);
    assert.equal(Run.settleBattle(run, {}).reason, 'no_active_battle');
    assert.equal(run.crystals, gateCrystals + gate.crystals);
    advance(run);
    reach(run, 6);
    enter(run);
    const crystalsBeforeSix = run.crystals;
    const sixParty = run.room.party.slice();
    const battle = Bridge.create(core, Run.battleOptions(run));
    battle.start();
    battle.act(0);
    assert.equal(battle.awaiting, true);
    run = Save.restoreRun(Save.serializeRun(run), { core, roster });
    assert.equal(run.room.status, 'order');
    assert.deepEqual(Run.defaultParty(run), sixParty);
    assert.equal(run.crystals, crystalsBeforeSix);
    assert.equal(run.contract.metAtFloor, gateKill ? 4 : null);
    assert.equal(run.contract.escrowed, CONTRACT_ESCROW);
    ok(Run.confirmOrder(run, sixParty));
    const six = settle(run, { outcome: floorSixWin ? 'win' : 'lose', heirloomKills: 0 });
    const paid = gateKill && floorSixWin ? CONTRACT_PAYOUT : 0;
    const sixReward = floorSixWin ? run.room.reward + looter(sixParty) + paid : 0;
    assert.equal(six.crystals, sixReward);
    assert.deepEqual(six.contract, {
      id: 'heirloom', met: gateKill, metNow: false, escrowed: CONTRACT_ESCROW, paid, failed: paid === 0
    });
    run = roundTrip(run);
    assert.equal(Run.settleBattle(run, {}).reason, 'no_active_battle');
    assert.equal(run.crystals, crystalsBeforeSix + sixReward);
    if (floorSixWin) {
      advance(run);
      assert.equal(run.floor, 7);
      assert.equal(run.crystals, crystalsBeforeSix + sixReward);
    }
  }
});

test('a contract stamps the first return per dungeon and contract, once across save and replay', () => {
  const profile = nightmareProfile();
  const play = (seed, met, win = true) => {
    const run = reach(contractedRun('heirloom', { seed }), 4);
    enter(run);
    settle(run, { heirloomKills: Number(met) });
    advance(run);
    reach(run, 8);
    enter(run);
    settle(run, { outcome: win ? 'win' : 'lose' });
    return roundTrip(run);
  };
  const bossLoss = play(7, true, false);
  assert.equal(bossLoss.contract.paid, CONTRACT_PAYOUT);
  assert.equal(Meta.applyRunEnd(profile, bossLoss).announce.stamp, null);
  assert.equal(Meta.applyRunEnd(profile, play(8, false)).announce.stamp, null);

  const success = play(9, true);
  const first = Meta.applyRunEnd(profile, success);
  assert.deepEqual(ok(first.announce).stamp, { dungeonId: ember, contractId: 'heirloom' });
  const restored = Save.restoreProfile(Save.serializeProfile(first.profile));
  assert.deepEqual(restored.contractStamps, { [ember]: { heirloom: success.id } });
  assert.deepEqual(Meta.contractsFor(restored, ember).stamps, { ...emptyStamps, heirloom: success.id });
  const replay = Meta.applyRunEnd(restored, success);
  assert.equal(replay.announce.reason, 'already_applied');
  assert.equal(replay.announce.stamp, null);
  const later = Meta.applyRunEnd(restored, play(10, true));
  assert.equal(ok(later.announce).stamp, null);
  assert.deepEqual(later.profile.contractStamps, restored.contractStamps);
});

test('legacy saves default new metadata and use the saved bench for the initial lineup', () => {
  const oldProfile = Meta.createProfile();
  delete oldProfile.contractStamps;
  assert.deepEqual(Save.restoreProfile(oldProfile).contractStamps, {});
  const old = JSON.parse(Save.serializeRun(reach(make(), 1)));
  for (const key of ['contract', 'daily', 'lastParty', 'guide', 'joinOrder']) delete old.run[key];
  const run = Save.restoreRun(old, { core, roster });
  assert.equal(run.contract, null);
  assert.equal(run.daily, null);
  assert.equal(run.lastParty, null);
  assert.deepEqual(run.guide, { bossOrder: false });
  assert.deepEqual(Run.defaultParty(run), old.run.bench.slice(0, 3));
});

test('default party keeps surviving seats and refills a fall in join order after reordering', () => {
  const run = reach(make(), 1);
  const [a, b, c, d, e] = run.bench;
  assert.deepEqual(Run.defaultParty(run), [a, b, c]);
  enter(run, 0, [d, a, e]);
  settle(run);
  advance(run);
  assert.deepEqual(Run.defaultParty(run), [d, a, e]);
  enter(run, 0, [a, d, c]);
  settle(run, { survivors: [true, false, true] });
  const restored = roundTrip(run);
  assert.deepEqual(restored.lastParty, [a, d, c]);
  assert.deepEqual(Run.defaultParty(restored), [a, b, c]);

  const short = Run.bindRun({ bench: [a], joinOrder: [a], lastParty: [null, a, null] }, { core, roster });
  assert.deepEqual(Run.defaultParty(short), [null, a, null]);
});

test('suggestion selects the strongest three and places the highest score last', () => {
  const cards = {
    lowest: { stats: { hp: 100, atk: 10, matk: 10 }, grade: 'normal' },
    mage: { stats: { hp: 200, atk: 10, matk: 40 }, grade: 'normal' },
    rare: { stats: { hp: 80, atk: 30, matk: 10 }, grade: 'rare' },
    legend: { stats: { hp: 100, atk: 20, matk: 20 }, grade: 'legend' }
  };
  const run = Run.bindRun({ bench: ['legend', 'lowest', 'mage', 'rare'] }, { roster: { card: id => cards[id] } });
  assert.deepEqual(Run.suggestOrder(run), ['rare', 'mage', 'legend']);
  assert.deepEqual(run.bench, ['legend', 'lowest', 'mage', 'rare']);
  run.bench = ['mage', 'rare'];
  assert.deepEqual(Run.suggestOrder(run), ['rare', 'mage']);
});

test('the boss order guide stays on after the intro and turns off for new runs after a main clear', () => {
  const profile = profileWithSnowRabbit();
  const run = make({ profileView: Meta.startView(profile, ember) });
  assert.deepEqual(run.guide, { bossOrder: true });
  assert.deepEqual(roundTrip(run).guide, { bossOrder: true });
  const firstWin = Meta.applyRunEnd(profile, clear(run));
  ok(firstWin.announce);
  const next = make({ profileView: Meta.startView(firstWin.profile, ember) });
  assert.deepEqual(next.guide, { bossOrder: false });
  assert.deepEqual(run.guide, { bossOrder: true });
});

test('tempo 2 preserves both fixed openings and makes their outcomes the first awakening pick', () => {
  for (const rescue of [false, true]) {
    const run = makeTempo({ dungeonId: 'dawn_forest' });
    assert.equal(run.tempoVersion, 2);
    enter(run);
    const bridge = Bridge.create(core, Run.battleOptions(run));
    bridge.start();
    const before = bridge.state();
    const model = openingModel(bridge);
    assert.deepEqual(model, openingModel(bridge));
    assert.deepEqual(bridge.state(), before);
    assert.equal(before.allies[0].mp, 0);
    assert.deepEqual(model.stand, { optionIndex: 0, actorId: 'ash', targetId: 'wild_golem', damageRange: [80, 80] });
    assert.deepEqual(model.rescue, {
      actorId: 'ash', incomingId: 'snow_rabbit', damageRange: [141, 141], incomingHpAfter: 149
    });
    if (rescue) {
      bridge.retreat();
      assert.equal(bridge.state().allies[1].hp, model.rescue.incomingHpAfter);
    } else bridge.act(model.stand.optionIndex);
    const skill = bridge.options().find(option => rescue ? option.name === '실버스톰' : option.heirloom);
    assert.equal(skill.cost, rescue ? 20 : 0);
    bridge.act(skill.index);
    assert.equal(bridge.summary().turns, 2);
    assert.equal(bridge.outcome, 'win');
    const result = ok(Run.settleBattle(run, bridge));
    assert.equal(result.survivors.length, rescue ? 3 : 2);
    assert.equal(run.openingLead, rescue ? 'ash' : 'snow_rabbit');
    advance(run);
    enter(run);
    const saved = roundTrip(run);
    assert.deepEqual(saved.bench, [run.openingLead]);
    assert.equal(saved.pending.remaining, 1);
    const companion = saved.pending.candidates[0];
    const pick = ok(Run.chooseStartPick(saved, companion));
    assert.equal(pick.awakened.length, 3);
    assert.deepEqual(saved.bench, [run.openingLead, companion, ...pick.awakened]);
    assert.equal(saved.crystals, 1);
    assert.equal(saved.heirlooms.snow_rabbit?.from, rescue ? undefined : 'ash');
    assert.equal(Run.chooseStartPick(saved, companion).ok, false);
    roundTrip(saved);
  }
});

test('tempo 2 Dawn doors forecast the exact first physical or magic attack', () => {
  const run = reach(makeTempo({ dungeonId: 'dawn_forest' }), 3);
  for (const [index, type] of ['phy', 'mag'].entries()) {
    const saved = roundTrip(run);
    const preview = Run.getTempoView(saved, index);
    assert.equal(preview.pattern, 'introFixed');
    assert.equal(preview.enemies[0].beats[0].type, type);
    enter(saved, index);
    const bridge = Bridge.create(core, Run.battleOptions(saved));
    const wait = bridge.start().find(event => event.t === 'await');
    const swing = bridge.act(0).find(event => event.t === 'act' && event.who.side === 'enemy');
    assert.equal(wait.intent.name, preview.enemies[0].beats[0].name);
    assert.equal(wait.intent.type, type);
    assert.equal(swing.skill.type, type);
    assert.equal(swing.skill.name, wait.intent.name);
  }
});

test('tempo views are read-only and blessing is stable, per-battle and merged with altar', () => {
  const run = reach(makeTempo(), 2);
  const before = Save.serializeRun(run);
  const preview = Run.getTempoView(run, 1);
  assert.deepEqual(Run.getTempoView(run, 1), preview);
  assert.deepEqual(Run.getTempoView(roundTrip(run), 1), preview);
  assert.deepEqual(Run.getTempoView(run, 0).blessing, preview.blessing);
  assert.equal(Save.serializeRun(run), before);
  const { id } = preview.blessing;
  run.blessings[id] = 0.1;
  enter(run, 1, [id]);
  let options = Run.battleOptions(run);
  assert.ok(Math.abs(options.blessings.find(entry => entry.id === id).multiplier - (preview.blessing.multiplier - 1)) < 1e-10);
  const bridge = Bridge.create(core, options);
  const wait = bridge.start().find(event => event.t === 'await');
  assert.equal(wait.s.allies[0].mp, preview.startMp);
  assert.equal(wait.s.enemy.maxHp, preview.enemies[0].maxHp);
  run.blessings[id] = 1;
  options = Run.battleOptions(run);
  assert.deepEqual(options.blessings.filter(entry => entry.id === id), [{ id, multiplier: 1 }]);
  settle(run);
  assert.equal(run.blessings[id], 1);
});

test('v1 saves without tempo fields restore the same doors, formation, MP and reward rules', () => {
  const control = reach(make(), 2);
  const old = JSON.parse(Save.serializeRun(control));
  delete old.run.tempoVersion;
  delete old.run.firstMainAssist;
  delete old.run.openingLead;
  for (const door of old.run.doors) delete door.tempo;
  const restored = Save.restoreRun(old, { core, roster });
  assert.deepEqual(restored, control);
  for (const run of [control, restored]) {
    enter(run, 0);
    const opts = Run.battleOptions(run);
    assert.equal(opts.tempo, undefined);
    const begin = Bridge.create(core, opts).start().find(event => event.t === 'begin');
    assert.equal(begin.s.allies[0].mp, 100);
    assert.equal(settle(run).pending, null);
    advance(run);
  }
  assert.deepEqual(restored, control);
});

test('tempo 2 reinforcement joins, passes and replaces atomically across save and repeat input', () => {
  let run = reach(makeTempo(), 1);
  enter(run);
  const { pending } = settle(run);
  assert.equal(pending.kind, 'reinforcement');
  assert.equal(pending.limit, 6);
  assert.equal(pending.candidates.length, 3);
  assert.ok(!pending.candidates.includes(run.reserved));
  assert.equal(Run.leaveRoom(run).reason, 'choice_required');
  const { key, candidates: [id] } = pending;
  run = roundTrip(run);
  assert.deepEqual(ok(Run.resolveReinforcement(run, { key, id })), { ok: true, joined: id, released: null });
  assert.equal(run.bench.length, 6);
  assert.equal(Run.resolveReinforcement(run, { key, id }).ok, false);
  advance(run);
  enter(run);
  const offer = settle(run).pending;
  const pick = { key: offer.key, id: offer.candidates[0] };
  const snapshot = Save.serializeRun(run);
  assert.equal(Run.resolveReinforcement(run, pick).reason, 'roster_full');
  assert.equal(Run.resolveReinforcement(run, { ...pick, replaceId: pick.id }).reason, 'invalid_replacement');
  assert.equal(Save.serializeRun(run), snapshot);
  const passed = roundTrip(run);
  assert.deepEqual(ok(Run.resolveReinforcement(passed, { key: pick.key, id: null })), { ok: true, joined: null, released: null });
  assert.deepEqual(passed.bench, run.bench);
  const replaceId = run.bench[0];
  const crystals = run.crystals;
  assert.deepEqual(ok(Run.resolveReinforcement(run, { ...pick, replaceId })), { ok: true, joined: pick.id, released: replaceId });
  assert.equal(run.bench.length, 6);
  assert.ok(run.released.includes(replaceId));
  assert.ok(!run.fallen.includes(replaceId));
  assert.equal(run.crystals, crystals);
});

test('reinforcement skips exhausted pools and waits behind an elite relic replacement', () => {
  const exhausted = reach(makeTempo(), 1);
  exhausted.pool = exhausted.bench.slice();
  enter(exhausted);
  assert.equal(settle(exhausted).pending, null);
  const run = reach(makeTempo(), 6);
  const { relic } = run.doors[1];
  run.relics = Object.keys(RELICS).filter(id => id !== relic).slice(0, 4);
  enter(run, 1);
  const pending = settle(run).pending;
  assert.equal(pending.kind, 'relic');
  assert.equal(pending.after.kind, 'reinforcement');
  assert.equal(Run.resolveReinforcement(run, { key: pending.after.key, id: null }).ok, false);
  const saved = roundTrip(run);
  assert.equal(ok(Run.equipRelic(saved, relic, pending.replace[0])).pending.kind, 'reinforcement');
  assert.equal(Run.leaveRoom(saved).reason, 'choice_required');
  ok(Run.resolveReinforcement(saved, { key: pending.after.key, id: null }));
  advance(saved);
  assert.equal(saved.floor, 7);
});

test('tempo 2 two-recruit event validates both releases and price before applying either join', () => {
  const run = reach(makeTempo({ dungeonId: 'creation_tower' }), 3);
  const event = EVENTS.find(entry => entry.id === 'rabbit_tracks');
  const rabbits = event.choices[1].ops[0].ids;
  run.bench = run.pool.filter(id => !rabbits.includes(id) && id !== run.reserved).slice(0, 6);
  run.joinOrder = run.bench.slice();
  if (rabbits.includes(run.reserved)) run.reserved = null;
  run.doors[2].event = event;
  enter(run, 2);
  const [a, b] = run.bench;
  const before = Save.serializeRun(run);
  assert.equal(Run.chooseEvent(run, 'both', null, [a]).reason, 'roster_full');
  assert.equal(Run.chooseEvent(run, 'both', null, [a, a]).reason, 'invalid_replacement');
  assert.equal(Save.serializeRun(run), before);
  const result = ok(Run.chooseEvent(run, 'both', null, [a, b]));
  assert.equal(result.crystals, -1);
  assert.equal(run.bench.length, 6);
  assert.deepEqual(run.bench.slice(-2), rabbits);
  assert.deepEqual(run.released.slice(-2), [a, b]);
  assert.equal(Run.chooseEvent(run, 'both', null, [a, b]).ok, false);
  roundTrip(run);
});

test('tempo 2 event doors offer 11 events per theme and 40 in the tower', () => {
  const newEvents = EVENTS.filter(event => event.minTempoVersion === 2);
  assert.equal(newEvents.length, 12);
  const collect = run => {
    const offered = new Set();
    for (let state = 0; state < 512; state++) {
      const door = makeDoors({ ...run, rng: { state } }, roster).find(entry => entry.type === 'event');
      if (door?.event) offered.add(door.event.id);
    }
    return offered;
  };
  for (const dungeonId of Object.keys(DUNGEONS).filter(id => id !== 'dawn_forest')) {
    const tower = dungeonId === 'creation_tower';
    for (const difficulty of ['normal', 'nightmare']) {
      for (const floor of [3, 5]) {
        const run = reach(makeTempo({ dungeonId, difficulty }), floor);
        const offered = collect(run);
        const expectedNew = newEvents.filter(event => !event.dungeons || event.dungeons.includes(dungeonId));
        assert.equal(offered.size, tower ? 40 : 11, `${dungeonId}/${difficulty}/B${floor}`);
        assert.equal(expectedNew.length, tower ? 12 : 4);
        for (const event of expectedNew) assert.ok(offered.has(event.id), `${dungeonId}/${event.id}`);
        assert.equal(collect({ ...run, tempoVersion: 1 }).size, tower ? 28 : 7);
      }
    }
  }
  assert.equal(collect(reach(makeTempo({ dungeonId: 'dawn_forest' }), 3)).size, 0);
  // Bringing a visitor from another region does not move its exclusive event.
  const arena = reach(makeTempo({ dungeonId: 'arena', profileView: { companions: ['ash'] } }), 3);
  assert.ok(arena.pool.includes('ash'));
  assert.ok(!collect(arena).has('ash_split_wick'));
});

function testTempoEvent(id, choices) {
  test(`tempo 2 event ${id}`, async t => {
    const event = EVENTS.find(entry => entry.id === id);
    assert.deepEqual(Object.keys(choices), event.choices.map(choice => choice.id));
    const pass = run => {
      const { bench, crystals, blessings, nextBattle } = structuredClone(run);
      advance(run);
      assert.deepEqual({ bench: run.bench, crystals: run.crystals, blessings: run.blessings, nextBattle: run.nextBattle },
        { bench, crystals, blessings, nextBattle });
      assert.equal(run.pending, null);
    };
    const cases = [...Object.entries(choices), ['pass', pass]];
    for (const difficulty of ['normal', 'nightmare']) {
      for (const floor of [3, 5]) {
        for (const [choiceId, check] of cases) {
          await t.test(`${difficulty}/B${floor}/${choiceId}`, () => {
            const run = reach(makeTempo({ dungeonId: event.dungeons?.[0] || 'ember_volcano', difficulty }), floor);
            // Keep named recruits available and start at the cap to exercise the replacement prompt.
            run.reserved = null;
            run.bench = run.pool.filter(id => !event.requires.present.includes(id) && roster.card(id).trait.type !== 'looter').slice(0, 6);
            run.joinOrder = run.bench.slice();
            run.crystals = 10;
            const door = run.doors.find(entry => entry.type === 'event');
            door.event = event;
            enter(run, door.index);
            const choose = ({ cost = 0, delta = 0 - cost, target, replace = [] } = {}) => {
              const crystals = run.crystals;
              if (cost) {
                run.crystals = cost - 1;
                const before = Save.serializeRun(run);
                assert.equal(Run.chooseEvent(run, choiceId, target, replace).reason, 'invalid_event_choice');
                assert.equal(Save.serializeRun(run), before);
                run.crystals = crystals;
              }
              if (replace.length) {
                const before = Save.serializeRun(run);
                assert.equal(Run.chooseEvent(run, choiceId, target, replace.slice(1)).reason, 'roster_full');
                assert.equal(Save.serializeRun(run), before);
              }
              const result = ok(Run.chooseEvent(run, choiceId, target, replace));
              assert.equal(result.crystals, delta);
              assert.equal(run.crystals, crystals + delta);
              assert.ok(run.bench.length <= 6);
              return result;
            };
            check(run, choose);
          });
        }
      }
    }
  });
}

function eventBattle(run, party, safe = false) {
  advance(run);
  enter(run, 0, party);
  const options = Run.battleOptions(run);
  assert.equal(options.tempo.startMp, 65);
  assert.equal(options.tempo.pattern, run.dungeonId === 'midnight_trench' ? 'tide' : 'threeBeat');
  assert.ok(run.bench.includes(options.tempo.blessing.id));
  if (safe) {
    for (const enemy of options.enemies) Object.assign(enemy.stats, { hp: 99999, atk: 0, matk: 0 });
  }
  const battle = Bridge.create(core, options);
  const events = battle.start();
  const start = events.find(entry => entry.t === 'begin').s;
  assert.equal(start.allies[0].mp, Math.min(65, start.allies[0].maxMp));
  const intent = events.find(entry => entry.t === 'await').intent;
  return { battle, options, start, intent };
}

function verifyRecruit(run, choose, ids, cost) {
  const count = Math.max(0, run.bench.length + ids.length - 6);
  const replace = count ? run.bench.slice(-count) : [];
  const result = choose({ cost, replace });
  assert.deepEqual(result.effects, [...replace.map(id => ({ type: 'release', id })), { type: 'join', ids }]);
  assert.deepEqual(run.released, replace);
  assert.deepEqual(run.bench.slice(-ids.length), ids);
}

function eventHeirloom(run, choose, from, name, cost) {
  const target = run.bench[0];
  choose({ cost, target });
  const combat = eventBattle(run, undefined, true);
  const skill = combat.battle.options().find(option => option.heirloom);
  assert.ok(skill, name);
  assert.equal(skill.name, name);
  assert.equal(skill.heirFrom, from);
  assert.equal(skill.cost, 0);
  return { ...combat, skill };
}

testTempoEvent('kobold_boot_exchange', {
  mend(run, choose) {
    const [target, other] = run.bench;
    run.blessings = { [target]: 0.8, [other]: 0.4 };
    choose({ target });
    assert.deepEqual(run.blessings, { [target]: 0.2, [other]: 0.4 });
    const { options } = eventBattle(run);
    const { id, multiplier } = options.tempo.blessing;
    const bonus = id === target ? Math.round((multiplier - 1) * 100) / 100 : 0;
    assert.equal(options.blessings.find(entry => entry.id === target).multiplier, Math.max(0.2, bonus));
  },
  exchange(run, choose) {
    // Set a known sale grade and distinct lead to exercise the existing event target rules.
    const target = 'kobold';
    run.bench[5] = target;
    run.lead = run.bench[0];
    run.blessings[target] = 0.4;
    run.heirlooms[target] = { from: 'ash', name: '아마겟돈' };
    const before = Save.serializeRun(run);
    assert.equal(Run.chooseEvent(run, 'exchange').reason, 'invalid_event_choice');
    assert.equal(Run.chooseEvent(run, 'exchange', run.lead).reason, 'invalid_event_choice');
    assert.equal(Run.chooseEvent(run, 'exchange', target, [run.bench[1]]).reason, 'invalid_replacement');
    assert.equal(Save.serializeRun(run), before);
    const candidates = run.pool.filter(id => !run.bench.includes(id));
    const result = choose({ cost: 1, delta: 0, target });
    const replacement = run.bench.at(-1);
    assert.equal(run.bench.length, 6);
    assert.ok(candidates.includes(replacement));
    assert.deepEqual(result.effects, [{ type: 'release', id: target }, { type: 'join', ids: [replacement] }]);
    assert.deepEqual(run.released, [target]);
    assert.equal(run.blessings[target], undefined);
    assert.equal(run.heirlooms[target], undefined);
    eventBattle(run, [replacement, ...run.bench.slice(0, 2)]);
  }
});

testTempoEvent('mimic_paybox', {
  cash(run, choose) {
    choose({ delta: 2 });
    assert.ok(!run.bench.includes('mimic'));
    eventBattle(run);
  },
  porter(run, choose) {
    verifyRecruit(run, choose, ['mimic'], 0);
    const bench = run.difficulty === 'nightmare' && run.floor === 5;
    const retreat = run.difficulty === 'nightmare' && run.floor === 3;
    const fallen = run.difficulty === 'normal' && run.floor === 5;
    eventBattle(run, bench ? undefined : ['mimic', ...run.bench.slice(0, 2)]);
    const { crystals } = settle(run, { survivors: [!fallen && !retreat, true, true], retreated: [retreat, false, false] });
    assert.equal(crystals, run.room.reward + Number(!bench && !fallen));
  }
});

testTempoEvent('ash_split_wick', {
  veil(run, choose) {
    const { skill, battle } = eventHeirloom(run, choose, 'ash', '드림파이어', 0);
    assert.equal(skill.val, 2.25);
    assert.ok(battle.act(skill.index).some(entry => entry.t === 'buff' && entry.id === 'evasion' && entry.to === 1));
  },
  flare(run, choose) {
    const { skill, battle } = eventHeirloom(run, choose, 'ash', '아마겟돈', 2);
    assert.equal(skill.val, 10.5);
    const hp = battle.state().allies[0].hp;
    const events = battle.act(skill.index);
    assert.ok(events.some(entry => entry.t === 'hp' && entry.who.side === 'ally' && Math.abs(entry.delta + hp / 2) <= 1));
    assert.ok(events.some(entry => entry.t === 'buff' && entry.who.side === 'ally' && entry.id === 'stun' && entry.to === 1));
  }
});

function keepEventAltar(run, expected) {
  assert.equal(run.pending.kind, 'altar');
  // Roll a value in the last seat's interval to check the altar uses the current roster.
  run.rng.state = Array.from({ length: 100 }, (_, seed) => seed).find(seed => mulberry32(seed)() >= 5 / 6);
  const roll = ok(Run.altarRoll(run));
  assert.equal(roll.id, expected);
  ok(Run.altarKeep(run));
  assert.equal(run.blessings[expected], roll.multiplier);
  eventBattle(run);
}

testTempoEvent('miko_lottery_cups', {
  old_circle(run, choose) {
    const original = run.bench.slice();
    choose();
    assert.deepEqual(run.bench, original);
    keepEventAltar(run, original.at(-1));
  },
  one_more(run, choose) {
    if (run.difficulty === 'normal' && run.floor === 3) run.bench.pop();
    verifyRecruit(run, choose, ['dragon_miko'], 1);
    keepEventAltar(run, 'dragon_miko');
  }
});

testTempoEvent('holy_bomb_last_verse', {
  singer(run, choose) {
    verifyRecruit(run, choose, ['holy_bomb'], 1);
    const { battle } = eventBattle(run, ['holy_bomb', ...run.bench.slice(0, 2)], true);
    const skill = battle.options().find(option => option.name === '라스트캐럴');
    assert.equal(skill.heirloom, false);
    assert.equal(skill.cost, 30);
    battle.act(skill.index);
    assert.equal(battle.state().allies[0].dead, true);
  },
  sign(run, choose) {
    const { skill, battle } = eventHeirloom(run, choose, 'holy_bomb', '라스트캐럴', 0);
    battle.act(skill.index);
    assert.equal(battle.state().allies[0].dead, true);
    assert.equal(battle.heirloomsGained()[0].from, run.bench[0]);
  }
});

testTempoEvent('whale_third_peal', {
  peal(run, choose) {
    choose();
    const won = run.difficulty === 'normal';
    const { battle, start } = eventBattle(run, undefined, true);
    assert.equal(start.enemy.buffs.divine, 1);
    const turn = won ? 3 : 4;
    for (let i = 1; i < turn; i++) battle.act(0);
    assert.equal(battle.state().turn, turn);
    for (let i = 0; i < battle.enemyCount && !battle.outcome; i++) {
      battle.host.battle.enemy.hp = 1;
      battle.act(0);
    }
    assert.equal(battle.outcome, 'win');
    assert.deepEqual(ok(Run.settleBattle(run, battle)).bet, { kind: 'kill_on_turn', turn: 3, won });
    assert.equal(run.relics.includes('over_divine'), won);
    assert.equal(run.nextBattle, null);
  },
  buy_bell(run, choose) {
    const full = run.floor === 5;
    if (full) run.relics = ['reverse', 'double_attack', 'over_flame', 'ice_break'];
    choose({ cost: 3, delta: full ? 0 : -3 });
    if (full) {
      assert.equal(run.pending.cost, 3);
      ok(Run.equipRelic(run, 'over_divine', 'reverse'));
      assert.equal(run.crystals, 7);
    }
    assert.ok(eventBattle(run).options.artifacts.includes('over_divine'));
  },
  white_note(run, choose) {
    const { skill } = eventHeirloom(run, choose, 'galaxy_whale', '앱솔루트라이트', 2);
    assert.ok(skill.effects.some(effect => effect.type === 'dmg_boost' && effect.element === 'dark' && effect.mult === 3));
  }
});

testTempoEvent('two_garden_chairs', {
  middle(run, choose) {
    verifyRecruit(run, choose, ['mummy'], 1);
    const [front, rear] = run.bench;
    assert.deepEqual(eventBattle(run, [front, 'mummy', rear]).options.party, [front, 'mummy', rear]);
  },
  rear(run, choose) {
    verifyRecruit(run, choose, ['victoria'], 3);
    const [front, middle] = run.bench;
    assert.deepEqual(eventBattle(run, [front, middle, 'victoria']).options.party, [front, middle, 'victoria']);
  },
  lanterns(run, choose) {
    choose();
    const { start } = eventBattle(run);
    assert.deepEqual([...start.field].slice(0, 2), ['goddess_descent', 'twinkle_party']);
    assert.deepEqual(run.released, []);
  }
});

testTempoEvent('dainichi_alms_bowl', {
  level(run, choose) {
    run.blessings[run.bench[0]] = 0.75;
    choose({ delta: 2 });
    assert.deepEqual(run.blessings, Object.fromEntries(run.bench.map(id => [id, 0.1])));
    const { options } = eventBattle(run);
    const { id, multiplier } = options.tempo.blessing;
    for (const blessing of options.blessings) {
      assert.equal(blessing.multiplier, blessing.id === id ? Math.round((multiplier - 1) * 100) / 100 : 0.1);
    }
  },
  mantra(run, choose) {
    const target = run.bench.find(id => roster.card(id).skills.some(skill => skill.type === 'sup' && skill.cost > 0));
    assert.ok(target);
    run.blessings[target] = 0.75;
    choose();
    const party = [target, ...run.bench.filter(id => id !== target).slice(0, 2)];
    const { battle, options } = eventBattle(run, party);
    assert.deepEqual(run.blessings, { [target]: 0.75 });
    assert.ok(options.artifacts.includes('support_boost'));
    const support = battle.options().filter(skill => skill.type === 'sup');
    assert.ok(support.length && support.every(skill => skill.cost === 0));
    settle(run);
    assert.equal(run.nextBattle, null);
    assert.ok(!run.relics.includes('support_boost'));
  }
});

testTempoEvent('penguin_ice_seam', {
  break(run, choose) {
    choose();
    const { start, intent } = eventBattle(run);
    assert.equal(start.enemy.buffs.stun, 1);
    assert.equal(intent.kind, 'stun');
  },
  carry(run, choose) {
    run.relics = ['reverse', 'double_attack', 'over_flame', 'ice_break'];
    assert.equal(Run.chooseEvent(run, 'carry').reason, 'invalid_event_choice');
    run.relics = [];
    choose();
    const first = run.bench.find(id => roster.card(id).element === 'water');
    assert.ok(first);
    const party = [first, ...run.bench.filter(id => id !== first).slice(0, 2)];
    const { options, battle, start } = eventBattle(run, party, true);
    assert.ok(options.artifacts.includes('frozen_body') && !run.relics.includes('frozen_body'));
    assert.equal(start.enemy.buffs.stun, undefined);
    if (run.difficulty === 'nightmare') {
      assert.ok(!battle.retreat().some(entry => entry.t === 'buff' && entry.id === 'stun'));
    } else {
      battle.host.battle.players[0].hp = 1;
      Object.assign(battle.host.battle.enemy, { atk: 10000, baseAtk: 10000 });
      assert.ok(battle.act(0).some(entry => entry.t === 'buff' && entry.who.side === 'enemy' && entry.id === 'stun' && entry.to === 1));
    }
  }
});

testTempoEvent('venom_five_knots', {
  hold(run, choose) {
    const { skill, battle } = eventHeirloom(run, choose, 'venom', '플레이그', 2);
    const hits = events => events.filter(entry => entry.t === 'act' && entry.delayed && entry.skill.name === '플레이그').length;
    let landed = hits(battle.act(skill.index));
    const retreat = run.difficulty === 'nightmare';
    if (retreat) {
      // Retreat after the first scheduled hit. Remaining knots cannot hit from the reserve.
      assert.equal(landed, 1);
      landed += hits(battle.retreat());
    }
    for (let i = 0; i < 5; i++) landed += hits(battle.act(0));
    assert.equal(landed, retreat ? 1 : 5);
  },
  brace(run, choose) {
    const target = run.bench[1];
    run.blessings[target] = 0.75;
    choose({ target });
    assert.deepEqual(run.blessings, { [target]: 0.25 });
    const { battle, options } = eventBattle(run);
    const { id, multiplier } = options.tempo.blessing;
    const bonus = id === target ? Math.round((multiplier - 1) * 100) / 100 : 0;
    assert.equal(options.blessings.find(entry => entry.id === target).multiplier, Math.max(0.25, bonus));
    assert.ok(battle.retreat().some(entry => entry.t === 'retreat'));
    assert.equal(battle.state().allies[battle.state().cur].form, target);
  }
});

testTempoEvent('arena_chalk_lines', {
  grind(run, choose) {
    choose();
    const { start } = eventBattle(run);
    assert.equal(start.field[0], 'arena');
    assert.equal(start.enemy.buffs.corrosion, 1);
  },
  cut(run, choose) {
    const target = run.bench[1];
    choose({ cost: 2, target });
    const { battle, start } = eventBattle(run, undefined, true);
    assert.equal(start.field[0], 'arena');
    battle.act(0);
    battle.act(0);
    battle.retreat();
    const skill = battle.options().find(option => option.name === '듀얼브레이커' && option.heirloom);
    assert.ok(skill?.usable);
    const events = battle.act(skill.index);
    assert.ok(events.some(entry => entry.t === 'rule' && entry.rule === 'arena_charge' && entry.multiplier === 2));
    assert.ok(!battle.state().field.includes('arena'));
  }
});

testTempoEvent('rollcall_ends', {
  pair(run, choose) {
    const recruits = ['discipline_captain', 'werebear'];
    if (run.difficulty === 'normal') run.bench.length = run.floor === 3 ? 4 : 5;
    const before = Save.serializeRun(run);
    assert.equal(Run.chooseEvent(run, 'pair', null, [run.bench[0], run.bench[0]]).reason, 'invalid_replacement');
    assert.equal(Save.serializeRun(run), before);
    verifyRecruit(run, choose, recruits, 1);
    const middle = run.bench.find(id => roster.card(id).grade === 'normal' && !recruits.includes(id));
    assert.ok(middle);
    const party = [recruits[0], middle, recruits[1]];
    assert.deepEqual(eventBattle(run, party).options.party, party);
  },
  rebuke(run, choose) {
    choose();
    const { start, intent } = eventBattle(run);
    assert.equal(start.enemy.buffs.silence, 1);
    assert.equal(start.enemy.buffs.weak, 1);
    assert.equal(intent.name, '일반 공격');
  }
});

test('tempo 2 spring draws and gate claims share the roster limit without automatic release', () => {
  const run = reach(makeTempo(), 1);
  enter(run);
  const { key, candidates: [id] } = settle(run).pending;
  ok(Run.resolveReinforcement(run, { key, id }));
  advance(run);
  reach(run, 3);
  enter(run);
  const before = Save.serializeRun(run);
  assert.equal(Run.springDraw(run).reason, 'roster_full');
  assert.equal(Save.serializeRun(run), before);
  const replace = run.bench[0];
  const crystals = run.crystals;
  assert.ok(ok(Run.springDraw(run, replace)).id);
  assert.equal(run.crystals, crystals - Run.COST.draw);
  assert.equal(run.bench.length, 6);
  assert.deepEqual(run.released, [replace]);
  advance(run);
  enter(run);
  const { candidates: [captive] } = settle(run).pending;
  const pick = { kind: 'join', id: captive };
  assert.equal(Run.chooseGateReward(run, pick).reason, 'roster_full');
  assert.deepEqual(run.released, [replace]);
  ok(Run.chooseGateReward(run, { ...pick, replaceId: run.bench[0] }));
  assert.equal(run.bench.length, 6);
  assert.ok(run.bench.includes(captive));
});

test('main assist follows the first-main guide while nightmare keeps its separate floor scale', () => {
  const assisted = reach(makeTempo(), 4);
  const regular = reach(makeTempo({ profileView: { bossOrder: false } }), 4);
  const nightmare = reach(makeTempo({ difficulty: 'nightmare' }), 4);
  assert.equal(assisted.firstMainAssist, true);
  assert.equal(roundTrip(assisted).firstMainAssist, true);
  assert.equal(regular.firstMainAssist, false);
  assert.equal(nightmare.firstMainAssist, false);
  assert.deepEqual(assisted.doors[0].enemies.map(enemy => enemy.id), regular.doors[0].enemies.map(enemy => enemy.id));
  assert.ok(assisted.doors[0].enemies[0].stats.atk < regular.doors[0].enemies[0].stats.atk);
});

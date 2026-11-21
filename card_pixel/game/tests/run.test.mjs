import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_ESCROW, CONTRACT_PAYOUT, CONTRACT_RULE_VERSION, LEGACY_CONTRACT_RULE_VERSION } from '../src/content/contracts.js';
import { DUNGEONS } from '../src/content/dungeons.js';
import { EVENTS, eventForRun } from '../src/content/events.js';
import { INTRO } from '../src/content/intro.js';
import { LAYOUTS } from '../src/content/layouts.js';
import { RELICS } from '../src/content/relics.js';
import * as Bridge from '../src/engine/bridge.js';
import { canJoin } from '../src/engine/awakenings.js';
import * as DailyStore from '../src/engine/daily-store.js';
import * as Meta from '../src/engine/meta.js';
import { openingModel } from '../src/engine/opening.js';
import { create as makeRoster, expeditionPool, GRADE_BUCKETS, gradeOf } from '../src/engine/roster.js';
import { makeDoors } from '../src/engine/rooms.js';
import * as Run from '../src/engine/run.js';
import * as Save from '../src/engine/save.js';
import { mulberry32, nextFloat, shuffle } from '../src/engine/rng.js';
import { DAILY_KEY, DAMAGED_DAILY_KEY, SESSION_KEY, SETTINGS_KEY, slotStorage } from '../src/ui/storage.js';
import { playRun as simulateRun } from '../tools/sim.mjs';
import { registerEntryTests } from './run/entry.mjs';
import { registerTempoEventTests } from './run/tempo-events.mjs';
import { createCoreRoster } from './support/core.mjs';

const { core, roster, sp } = createCoreRoster();
// Retain the old draw rules for the historical seeded fixtures.
const oldDraws = run => { delete run.drawRuleVersion; return run; };
const make = (opts = {}) => oldDraws(Run.createRun({ core, roster, dungeonId: 'ember_volcano', seed: 7, tempoVersion: 1, ...opts }));
const makeTempo = (opts = {}) => Run.createRun({ core, roster, dungeonId: 'ember_volcano', seed: 7, ...opts });
const makeOldTempo = opts => oldDraws(makeTempo(opts));
const playRun = (id, seed, opts) => simulateRun(id, seed, { legacyDraws: true, ...opts });
const legacyProfile = () => {
  const profile = Meta.createProfile();
  profile.ui.entry.legacy = true;
  return profile;
};

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

function clear(run, date) {
  reach(run, run.floors);
  enter(run);
  settle(run);
  if (run.phase !== 'done') advance(run);
  Run.finishRun(run, date);
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
  const result = Meta.applyRunEnd(legacyProfile(), clear(intro), { recruits: ['snow_rabbit'] });
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
    result: run.result, recruitable: run.pending.recruitable, recruitTags: run.pending.recruitTags, recruitLimit: 1, shardCandidates: []
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
  const { pending } = settle(run);
  assert.equal(pending, null);
  assert.equal(run.phase, 'done');
  assert.equal(run.stats.gateWins, 1);
  assert.deepEqual(Run.finishRun(run).recruitable, run.bench);
});

test('a saved intro finale gate reward resumes at recruitment', () => {
  const run = reach(make({ dungeonId: 'dawn_forest' }), 5);
  enter(run);
  settle(run);
  run.phase = 'reward';
  run.pending = { kind: 'gate', candidates: run.room.enemies.map(enemy => enemy.source), relic: 'reverse' };
  const restored = Save.restoreRun(Save.serializeRun(run), { core, roster });
  assert.equal(restored.phase, 'done');
  assert.equal(restored.pending, null);
  assert.deepEqual(Run.finishRun(restored).recruitable, restored.bench);
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
  let profile = legacyProfile();
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
    id: 'rescue', ruleVersion: CONTRACT_RULE_VERSION, met: false, metAtFloor: null,
    riskDoorTaken: false, escrowed: 0, paid: 0, failed: false
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
  let run = reach(makeOldTempo(), 1);
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
  const exhausted = reach(makeOldTempo(), 1);
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

registerTempoEventTests({ core, roster, makeTempo: makeOldTempo, reach, advance, enter, settle, ok });
registerEntryTests({ core, roster, makeTempo, reach, advance, enter, settle, clear, ok, roundTrip, reviewTwoStorage });

test('one command validates a previewed battle door and saves its exact lineup once', () => {
  const run = reach(makeTempo(), 2);
  const partyIds = Run.defaultParty(run).reverse();
  const profile = Meta.createProfile();
  let writes = 0, checkpoint;
  const store = Save.createSaveStore({
    getItem: () => checkpoint,
    setItem(key, value) { writes++; checkpoint = value; }
  }, { core, roster });
  function enter(request) {
    const result = Run.enterBattleDoor(run, request);
    if (result.ok) store.save({ profile, run });
    return result;
  }
  const before = Save.serializeRun(run);
  for (const request of [
    { floor: 1, index: 1, partyIds }, { floor: 2, index: 5, partyIds },
    { floor: 2, index: 1, partyIds: [partyIds[0], partyIds[0]] },
    { floor: 2, index: 1, partyIds: ['someone_else'] }, { floor: 2, index: 1, partyIds: [null] }
  ]) {
    assert.equal(enter(request).ok, false);
    assert.equal(Save.serializeRun(run), before);
  }
  const equivalent = roundTrip(run);
  ok(Run.chooseDoor(equivalent, 1));
  ok(Run.confirmOrder(equivalent, partyIds));
  ok(enter({ floor: 2, index: 1, partyIds }));
  assert.deepEqual(run, equivalent);
  assert.equal(writes, 1);
  assert.deepEqual(store.load().run.room.party, partyIds);
  assert.equal(enter({ floor: 2, index: 1, partyIds }).ok, false);
  assert.equal(writes, 1);

  for (const floor of [1, 2, 4, 6]) {
    const candidate = reach(makeTempo(), floor);
    if (floor > 1) assert.equal(Run.enterBattleDoor(candidate, { floor, index: 2, partyIds: Run.defaultParty(candidate) }).ok, false);
    ok(Run.enterBattleDoor(candidate, { floor, index: 0, partyIds: Run.defaultParty(candidate) }));
    const { pending } = settle(candidate);
    assert.equal(pending.kind, floor === 4 ? 'gate' : 'reinforcement');
    if (floor !== 4) ok(Run.resolveReinforcement(candidate, { key: pending.key, id: pending.candidates[0] }));
    else if (pending.candidates.length) ok(Run.chooseGateReward(candidate, { kind: 'join', id: pending.candidates[0] }));
    else ok(Run.chooseGateReward(candidate, { kind: 'relic', id: pending.relic }));
    assert.equal(candidate.pending, null);
  }
});

test('a named spring pick is available across reload and only charges a successful commit', () => {
  const run = reach(makeOldTempo({ profileView: { companions: ['snow_rabbit'], preferredCompanion: 'snow_rabbit' } }), 3);
  enter(run);
  if (run.bench.includes('snow_rabbit')) run.bench = run.bench.filter(id => id !== 'snow_rabbit');
  run.crystals = 7;
  const before = run.crystals;
  const seed = run.rng.state;
  const offer = ok(Run.getSpringOffer(run));
  assert.ok(offer.candidates.includes('snow_rabbit'));
  assert.equal(offer.alreadyPaid, false);
  assert.equal(run.crystals, before);
  assert.equal(run.paidPickUsed, false);
  assert.equal(run.rng.state, seed);
  const restored = roundTrip(run);
  assert.deepEqual(ok(Run.getSpringOffer(restored)), offer);
  assert.equal(Run.commitSpringOffer(restored, { key: offer.key + 'invalid', id: offer.candidates[0] }).ok, false);
  assert.equal(Run.commitSpringOffer(restored, { key: offer.key, id: 'missing' }).ok, false);
  assert.equal(restored.crystals, before);
  assert.deepEqual(ok(Run.commitSpringOffer(restored, { key: offer.key, id: 'snow_rabbit' })),
    { ok: true, joined: 'snow_rabbit', released: null, charged: 3 });
  assert.equal(restored.crystals, before - 3);
  assert.equal(restored.paidPickUsed, true);
  assert.equal(Run.commitSpringOffer(restored, offer).ok, false);

  const full = roundTrip(run);
  full.bench = full.bench.concat(full.pool.filter(id => !full.bench.includes(id) && !offer.candidates.includes(id))).slice(0, 6);
  const replaceId = full.bench.at(-1);
  full.blessings[replaceId] = 0.4;
  full.heirlooms[replaceId] = { from: 'ash', name: '아마겟돈' };
  assert.equal(Run.commitSpringOffer(full, { key: offer.key, id: 'snow_rabbit' }).reason, 'roster_full');
  assert.equal(full.crystals, before);
  assert.deepEqual(ok(Run.commitSpringOffer(full, { key: offer.key, id: 'snow_rabbit', replaceId })),
    { ok: true, joined: 'snow_rabbit', released: replaceId, charged: 3 });
  assert.equal(full.blessings[replaceId], undefined);
  assert.equal(full.heirlooms[replaceId], undefined);
  assert.ok(full.released.includes(replaceId));

  const legacy = reach(makeOldTempo({ lessonVersion: 0 }), 3);
  enter(legacy);
  legacy.crystals = 3;
  ok(Run.springPick(legacy));
  const prepaid = roundTrip(legacy);
  const pending = ok(Run.getSpringOffer(prepaid));
  assert.equal(pending.alreadyPaid, true);
  assert.equal(ok(Run.commitSpringOffer(prepaid, { key: pending.key, id: pending.candidates[0] })).charged, 0);
  assert.equal(prepaid.crystals, 0);
});

test('blessing views use the live core stats and streaks use only settled battles', () => {
  const run = reach(makeTempo(), 1);
  const door = run.doors[0];
  const stats = view => [view.stats.hp, view.stats.atk, view.stats.crit, view.stats.evasion];
  run.bench = ['snow_rabbit', 'entropy'];
  door.tempo.blessing = null;
  const rabbit = ['snow_rabbit'];
  assert.deepEqual(stats(Run.getBlessingView(run, 0, rabbit, rabbit[0])), [290, 60, 10, 5]);
  run.blessings.snow_rabbit = 0.4;
  door.tempo.blessing = { id: rabbit[0], multiplier: 1.6 };
  const preview = Run.getBlessingView(run, 0, rabbit, rabbit[0]);
  assert.deepEqual([preview.expeditionBonus, preview.battleBonus, preview.effectiveBonus, preview.active], [0.4, 0.6, 0.6, true]);
  assert.deepEqual(stats(preview), [464, 96, 20, 10]);
  const party = ['snow_rabbit', 'entropy'];
  const doubled = Run.getBlessingView(run, 0, party, rabbit[0]);
  assert.equal(doubled.effectiveBonus, 1.2);
  assert.deepEqual(stats(doubled), [638, 132, 20, 10]);
  assert.deepEqual(run.blessingHistory, []);
  enter(run, 0, party);
  const b = Bridge.create(core, Run.battleOptions(run));
  b.start();
  assert.deepEqual(b.allyStats(0), doubled.stats);
  assert.deepEqual(run.blessingHistory, []);
  settle(run);
  advance(run);
  assert.equal(run.doors[0].tempo.blessing.id, 'snow_rabbit');
  enter(run, 0, party);
  settle(run);
  assert.deepEqual(roundTrip(run).blessingHistory, ['snow_rabbit', 'snow_rabbit']);
  advance(run);
  enter(run, 0);
  advance(run);
  assert.equal(run.doors[0].tempo.blessing.id, 'entropy');
});

test('a missing lesson version restores pre-lesson v2 rooms and rewards', () => {
  const source = reach(makeTempo({ lessonVersion: 0 }), 1);
  const raw = JSON.parse(Save.serializeRun(source));
  delete raw.run.lessonVersion;
  const restored = Save.restoreRun(raw, { core, roster });
  assert.equal(restored.lessonVersion, 0);
  reach(restored, 6);
  reach(source, 6);
  assert.deepEqual(restored, source);
  assert.ok(restored.doors.every(door => !door.tempo.lesson));
  assert.equal(restored.blessingHistory, undefined);
});

test('both lesson doors in all six regions use the same local-turn window in either difficulty', () => {
  const wait = events => events.findLast(event => event.t === 'await');
  const enemyAction = events => events.find(event => event.t === 'act' && event.who.side === 'enemy');
  for (const dungeonId of Object.keys(DUNGEONS).filter(id => id !== 'dawn_forest')) {
    for (const difficulty of ['normal', 'nightmare']) {
      const run = reach(makeTempo({ dungeonId, difficulty }), 2);
      const expected = difficulty === 'nightmare' && DUNGEONS[dungeonId].hiddenBosses[0]
        ? DUNGEONS[dungeonId].hiddenBosses[0] : DUNGEONS[dungeonId].boss;
      for (const floor of [2, 6]) {
        reach(run, floor);
        for (const { index, tempo, enemies } of run.doors) {
          const label = [dungeonId, difficulty, floor, index].join('/');
          const { lesson } = Run.getTempoView(run, index);
          assert.deepEqual(lesson, tempo.lesson, label);
          assert.equal(lesson.bossId, expected, label);
          assert.equal(lesson.floor, floor, label);
          assert.deepEqual(roundTrip(run).doors[index].tempo.lesson, lesson, label);
          assert.equal(lesson.transferBeforeLocalTurn, 2);
          assert.equal(lesson.maxUsesPerRoom, 1);
          if (floor === 6 && index === 1) assert.ok(enemies[0].affixes.length >= 2);

          function ready() {
            const entered = roundTrip(run);
            ok(Run.enterBattleDoor(entered, { floor, index, partyIds: entered.bench.slice(0, 3) }));
            const opts = Run.battleOptions(entered);
            opts.quirk = null;
            // Keep the real door's first enemy and affixes. Use a second for the transfer check
            // even when the sampled door naturally has only one.
            opts.enemies = [opts.enemies[0], structuredClone(opts.enemies.at(-1)), structuredClone(opts.enemies.at(-1))];
            for (const enemy of opts.enemies) Object.assign(enemy.stats, { hp: 99999, atk: 0, matk: 0 });
            const bridge = Bridge.create(core, opts);
            const first = wait(bridge.start());
            assert.equal(first.intent.localTurn, 1, label);
            if (enemies[0].affixes?.includes('tough')) assert.equal(first.affixes.find(affix => affix.id === 'tough').turns, 3);
            return bridge;
          }
          function kill(bridge) {
            bridge.host.battle.enemy.hp = 1;
            const events = bridge.act(0);
            assert.ok(events.some(event => event.t === 'enemyDown'), label);
            return events;
          }

          const early = ready();
          assert.equal(wait(kill(early)).enemyIndex, 1, label);
          assert.equal(wait(early.act(0)).intent.localTurn, 2, label);
          assert.deepEqual(early.summary().lesson, { bossId: expected, previewed: true, resolved: false, enemyIndex: 1 }, label);
          assert.equal(wait(kill(early)).enemyIndex, 2, label);
          early.act(0);
          assert.equal(early.summary().lesson.enemyIndex, 1, label);

          const late = ready();
          const telegraph = wait(late.act(0)).intent;
          if (lesson.steps[1]) assert.equal(telegraph.name, lesson.steps[1].name, label);
          const canceled = kill(late);
          if (telegraph.rule) {
            assert.ok(canceled.some(event => event.actionId === telegraph.actionId && event.preventedBy === 'enemy_down'), label);
          }
          late.act(0);
          assert.equal(late.summary().lesson.enemyIndex, 0, label);
          assert.equal(late.summary().lesson.resolved, false, label);

          const stunned = ready();
          const intent = wait(stunned.act(0)).intent;
          stunned.host.battle.enemy.buffs.stun = 1;
          const stopped = stunned.act(0);
          assert.equal(enemyAction(stopped), undefined, label);
          if (intent.rule) assert.ok(stopped.some(event => event.actionId === intent.actionId && event.preventedBy === 'stun'), label);
          assert.equal(stunned.summary().lesson.resolved, true, label);

          const acted = ready();
          const announced = wait(acted.act(0)).intent;
          const response = acted.act(0);
          assert.equal(enemyAction(response)?.skill.name, announced.name, label);
          assert.equal(acted.summary().lesson.resolved, true, label);
        }
      }
    }
  }
});

test('adjusted events expose the actual payment, eligibility, replacement count and blessing change', () => {
  function open(id, floor, dungeonId, party) {
    const run = reach(makeTempo({ dungeonId }), floor);
    const event = EVENTS.find(entry => entry.id === id);
    run.reserved = null;
    run.bench = party ?? run.pool.filter(id => !event.requires.present.includes(id)).slice(0, 6);
    run.joinOrder = run.bench.slice();
    run.crystals = 10;
    const door = run.doors.find(candidate => candidate.type === 'event');
    door.event = eventForRun(event, run);
    enter(run, door.index);
    return run;
  }
  const choice = (run, id) => run.pending.choices.find(entry => entry.id === id);
  const mimic = open('mimic_paybox', 3, 'arena');
  const sent = mimic.bench.at(-1);
  assert.equal(ok(Run.chooseEvent(mimic, 'porter', null, [sent])).crystals, 1);
  advance(mimic);
  enter(mimic, 0, ['mimic']);
  assert.equal(settle(mimic).crystals, mimic.room.reward + 2);
  assert.equal(mimic.firstSurvivalPay.mimic, undefined);
  ok(Run.chooseGateReward(mimic, { kind: 'relic', id: mimic.pending.relic }));
  advance(mimic);
  enter(mimic, mimic.doors.findIndex(door => door.type === 'treasure'));
  advance(mimic);
  enter(mimic, 0, ['mimic']);
  assert.equal(settle(mimic).crystals, mimic.room.reward + 1);

  const early = open('venom_five_knots', 3, 'midnight_trench');
  const late = open('venom_five_knots', 5, 'midnight_trench');
  assert.deepEqual([choice(early, 'hold').cost, choice(late, 'hold').cost], [2, 1]);
  assert.match(choice(late, 'hold').text, /최대 5회/);

  const roll = open('rollcall_ends', 3, 'arena');
  assert.deepEqual([choice(roll, 'captain').requiredReleases, choice(roll, 'pair').requiredReleases], [1, 2]);
  roll.released.push('werebear');
  assert.equal(Run.chooseEvent(roll, 'pair', null, roll.bench.slice(-2)).ok, false);
  assert.equal(ok(Run.chooseEvent(roll, 'captain', null, roll.bench.slice(-1))).crystals, 0);

  const penguin = open('penguin_ice_seam', 5, 'midnight_trench', ['ash']);
  assert.deepEqual(choice(penguin, 'carry').waterAllies, []);
  assert.match(choice(penguin, 'carry').text, /물 동료 없음/);
  const whale = open('whale_third_peal', 5, 'twilight_cathedral');
  assert.match(choice(whale, 'peal').text, /3턴에 적 하나 처치 후 승리/);

  const bowl = open('dainichi_alms_bowl', 3, 'starlit_garden');
  assert.deepEqual(choice(bowl, 'level').blessingChanges[bowl.bench[0]], { before: 0, after: 0.1 });
  const boots = open('kobold_boot_exchange', 3, 'arena');
  assert.deepEqual(choice(boots, 'mend').blessingChanges[boots.bench[0]], { before: 0, after: 0.2 });
  assert.deepEqual(Object.keys(choice(boots, 'exchange').netCrystals), choice(boots, 'exchange').targets);
});

test('tempo 2 spring draws and gate claims share the roster limit without automatic release', () => {
  const run = reach(makeOldTempo(), 1);
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

test('expedition listing matches all seven default pools and overlapping departure modifiers without consuming a draw', () => {
  const sizes = [14, 39, 40, 39, 40, 37, 130];
  assert.deepEqual(Object.keys(DUNGEONS).map(id => expeditionPool(roster, id).baseIds.length), sizes);
  const profile = Meta.createProfile();
  assert.deepEqual(profile.unlockedDungeons, ['dawn_forest']);
  const before = structuredClone(profile);
  const base = expeditionPool(roster, ember).baseIds;
  const [lead, reserved, sealedOutside] = roster.allies.filter(id => !base.includes(id));
  const sealed = base[0];
  const profileView = { lead, companions: [lead, sealed, lead, base[1], reserved], reserved, seals: [sealed, sealedOutside] };
  const run = makeTempo({ profileView });
  const pristine = Save.serializeRun(run);
  const view = expeditionPool(roster, ember, profileView);
  assert.equal(view.setName, '홍련의 계승');
  assert.deepEqual(view.addedIds, [lead, reserved]);
  assert.deepEqual(view.sealedIds, [sealed]);
  assert.deepEqual(view.effectiveIds, run.pool);
  assert.deepEqual(view.effectiveIds, [...base.slice(1), lead, reserved]);
  assert.equal(Save.serializeRun(run), pristine);
  assert.deepEqual(profile, before);
  const reference = makeTempo({ profileView });
  startPicks(run);
  startPicks(reference);
  assert.equal(Save.serializeRun(run), Save.serializeRun(reference));
});

test('easy and journey seed 7 share HP, enemy actions and the carried heirloom, including the risk door', t => {
  function opening(difficulty) {
    const run = reach(makeTempo({ difficulty, profileView: { lead: 'ash' } }), 1);
    enter(run);
    const [, recipient] = Run.battleOptions(run).party;
    const { name } = Bridge.heirloomSkill(roster.card('ash'));
    settle(run, { survivors: [false, true, true], heirloomsGained: [{ to: recipient, from: 'ash', name }] });
    advance(run);
    return run;
  }
  const normal = opening('normal');
  const easy = opening('easy');
  assert.equal(easy.firstMainAssist, true);
  for (const { index } of normal.doors) {
    assert.deepEqual(Run.getTempoView(normal, index), Run.getTempoView(easy, index));
    const scaled = Run.doorEnemies(normal, index).map(enemy => ({
      ...enemy, stats: { ...enemy.stats, atk: Math.round(enemy.stats.atk * 0.65), matk: Math.round(enemy.stats.matk * 0.65) }
    }));
    assert.deepEqual(Run.doorEnemies(easy, index), scaled);
  }
  const riskIndex = normal.doors.findIndex(door => door.risk);
  for (const run of [normal, easy]) enter(run, riskIndex, Run.defaultParty(run));
  const { enemyAttackScale, ...easyOptions } = Run.battleOptions(easy);
  const normalOptions = Run.battleOptions(normal);
  assert.equal(enemyAttackScale, 0.65);
  assert.deepEqual(easyOptions, normalOptions);
  assert.ok(Object.keys(normalOptions.heirlooms).length);
  const stats = [normal, easy].map(run => {
    const battle = Bridge.create(core, Run.battleOptions(run));
    battle.start();
    const { maxHp, baseAtk, baseMatk } = battle.host.battle.enemy;
    return [maxHp, baseAtk, baseMatk];
  });
  assert.deepEqual(stats[1], [stats[0][0], Math.round(stats[0][1] * 0.65), Math.round(stats[0][2] * 0.65)]);
  t.diagnostic(JSON.stringify({ seed: normal.seed, stats, actions: Run.getTempoView(normal, riskIndex).enemies[0].beats,
    heirlooms: normalOptions.heirlooms }));
});

test('easy returns unlock the campaign and ending while journey alone unlocks nightmare and the first seal', () => {
  let profile = profileWithSnowRabbit();
  assert.equal(Meta.nextGoal(profile).reward, '샘 초대 1칸 열림');
  assert.throws(() => makeTempo({ dungeonId: 'dawn_forest', difficulty: 'easy' }), /Unavailable difficulty/);
  assert.deepEqual(Meta.availableDungeons(profile).find(entry => entry.id === ember).difficulties, ['easy', 'normal']);
  for (const dungeonId of [ember, 'twilight_cathedral', 'starlit_garden', 'creation_tower']) {
    const run = clear(makeTempo({ difficulty: 'easy', profileView: Meta.startView(profile, dungeonId), dungeonId }));
    const recruit = Run.runRewards(run).recruitable[0];
    profile.ui.wantedCompanionId = recruit;
    const result = Meta.applyRunEnd(profile, roundTrip(run), { recruits: [recruit] });
    ok(result.announce);
    assert.deepEqual(result.announce.nightmares, []);
    assert.equal(result.profile.ui.wantedCompanionId, recruit);
    profile = result.profile;
    assert.equal(profile.records.clears[dungeonId].easy, 1);
    assert.equal(Meta.startView(profile, dungeonId).sealSlots, 0);
    assert.equal(Meta.startView(profile, dungeonId).firstMainAssist, true);
  }
  assert.ok(profile.notebook.chapters.includes(7));
  assert.equal(Meta.dailyRiftUnlocked(profile), true);
  assert.equal(Meta.nextGoal(profile).target.dungeonId, 'midnight_trench');
  assert.throws(() => makeTempo({ difficulty: 'nightmare', profileView: Meta.startView(profile, ember) }), /Locked nightmare/);
  const journey = makeTempo({ profileView: Meta.startView(profile, ember) });
  assert.equal(journey.firstMainAssist, true);
  const result = Meta.applyRunEnd(profile, clear(journey));
  assert.deepEqual(ok(result.announce).nightmares, [ember]);
  assert.equal(Meta.startView(result.profile, ember).sealSlots, 1);
  assert.equal(makeTempo({ profileView: Meta.startView(result.profile, ember) }).firstMainAssist, false);
  assert.equal(makeTempo({ difficulty: 'easy', profileView: Meta.startView(result.profile, ember) }).firstMainAssist, true);
});

const localTime = stamp => new Date(stamp);

const reviewTwoRoute = (...indices) => run => run.doors[indices[run.floor - 1]];

function reviewTwoReturns() {
  let profile = legacyProfile();
  for (const [dungeonId, seed] of [['dawn_forest', 17], [ember, 0]]) {
    const { run, end } = playRun(dungeonId, seed, { profile, opening: 'stand' });
    assert.equal(end.result, 'win');
    const returned = Meta.applyRunEnd(profile, run, { recruits: end.recruitable.slice(0, 1) });
    ok(returned.announce);
    profile = returned.profile;
  }
  return profile;
}

function reviewTwoStorage() {
  const entries = new Map();
  return slotStorage({
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key)
  });
}

test('review 2.2: unversioned Ember seed 0 contracts retain the old heirloom payout and rescue rule', () => {
  const seed = 0;
  const checkpoint = reach(contractedRun('heirloom', { seed }), 6);
  assert.equal(checkpoint.contract.ruleVersion, CONTRACT_RULE_VERSION);
  const raw = JSON.parse(Save.serializeRun(checkpoint));
  delete raw.run.contract.ruleVersion;
  const legacy = Save.restoreRun(raw, { core, roster });
  assert.equal(legacy.contract.ruleVersion, LEGACY_CONTRACT_RULE_VERSION);
  const settled = [legacy, checkpoint].map(run => {
    enter(run, 1);
    return settle(run, { heirloomsUsed: 1, heirloomKills: 1 });
  });
  assert.deepEqual(settled.map(result => result.contract.paid), [3, 0]);
  assert.deepEqual(settled.map(result => result.contract.metNow), [true, false]);
  assert.equal(legacy.crystals - checkpoint.crystals, 3);
  assert.equal(legacy.contract.metAtFloor, 6);
  assert.equal(roundTrip(legacy).contract.ruleVersion, LEGACY_CONTRACT_RULE_VERSION);

  const rescue = reach(contractedRun('rescue', { seed }), 6);
  const oldSave = JSON.parse(Save.serializeRun(rescue));
  delete oldSave.run.contract.ruleVersion;
  const oldRescue = Save.restoreRun(oldSave, { core, roster });
  for (const [run, met] of [[oldRescue, false], [rescue, true]]) {
    enter(run, 1);
    const [retreated, incoming] = run.room.party;
    assert.equal(settle(run, { survivors: [false, false, true], retreated: [true, false, false],
      rescues: [{ retreated, incoming, lethal: true }] }).contract.metNow, met);
  }
});

test('review 2.3: Ember seed 2 fills only expired spring slots and issues a fresh key', () => {
  const { end } = playRun(ember, 2, {
    firstMain: true, doorOverride: reviewTwoRoute(0, 1, 1, 0, 1, 1, 0, 0),
    serviceOverride(run) {
      if (run.floor !== 7) return false;
      assert.equal(run.crystals, 10);
      const first = ok(Run.getSpringOffer(run));
      const draw = () => ok(Run.springDraw(run, run.bench.length === 6 ? run.bench[0] : null)).id;
      const removed = draw();
      const slot = first.candidates.indexOf(removed);
      assert.notEqual(slot, -1);
      assert.equal(Run.commitSpringOffer(run, { key: first.key, id: removed }).reason, 'invalid_spring_key');
      const partial = ok(Run.getSpringOffer(run));
      assert.notEqual(partial.key, first.key);
      first.candidates.forEach((id, index) => {
        if (index !== slot) assert.equal(partial.candidates[index], id);
      });
      const drawn = [removed, ...Array.from({ length: 4 }, draw)];
      assert.ok(first.candidates.every(id => drawn.includes(id)));
      assert.equal(run.crystals, 5);
      const refreshed = ok(Run.getSpringOffer(run));
      assert.notEqual(refreshed.key, partial.key);
      assert.equal(refreshed.candidates.length, 3);
      assert.ok(refreshed.candidates.every(id => canJoin(run, id)));
      assert.deepEqual(ok(Run.getSpringOffer(roundTrip(run))), refreshed);
      return true;
    }
  });
  assert.equal(end.result, 'win');
});

test('review 2.4: Twilight seed 0 forecasts the second turn Soul Drain and its flat MP loss', () => {
  const run = reach(makeTempo({ dungeonId: 'twilight_cathedral', seed: 0 }), 2);
  const [enemy] = Run.getTempoView(run, 0).enemies;
  assert.equal(enemy.id, 'wild_dark_knight');
  const beat = enemy.beats.find(entry => entry.turn === 2);
  assert.deepEqual(beat, {
    turn: 2, name: '소울드레인 예행', type: 'mag', power: 0, val: 0, rule: 'mana_drain', drainFlat: 12, lesson: true
  });
  enter(run);
  const battle = Bridge.create(core, Run.battleOptions(run));
  battle.start();
  const { intent } = battle.act(0).find(event => event.t === 'await');
  assert.equal(intent.name, beat.name);
  assert.equal(intent.kind, beat.type);
  assert.deepEqual(intent.damageRange, [0, 0]);
  assert.equal(intent.resourceEffect.amount, beat.drainFlat);
  const effect = battle.act(0).find(event => event.t === 'rule' && event.actionId === intent.actionId);
  assert.deepEqual([effect.before, effect.after], [65, 53]);
});

test('review 2.5: Tower seed 1 forecasts the same ripple in intent, countdown, and tide warning', () => {
  const run = reach(makeTempo({ dungeonId: 'creation_tower', seed: 1, profileView: { lead: 'black_swan' } }), 2);
  assert.equal(run.doors[0].enemies[0].id, 'wild_abyss_eye');
  assert.equal(run.doors[0].region.id, 'tide_cycle');
  enter(run, 0, ['black_swan']);
  const battle = Bridge.create(core, Run.battleOptions(run));
  battle.start();
  const evade = battle.options().find(move => move.name === '회피태세').index;
  const second = battle.act(evade).find(event => event.t === 'await');
  const ripple = { name: '잔물결', kind: 'phy', power: 0.75, inTurns: 1 };
  assert.equal(second.intent.name, '저지먼트 예행');
  assert.deepEqual(second.intent.nextDistinct, ripple);
  assert.deepEqual(second.countdown, { ...ripple, charge: false });
  assert.deepEqual(second.region.tide, ripple);
  const third = battle.act(evade).find(event => event.t === 'await');
  assert.equal(third.intent.name, ripple.name);
  assert.equal(third.intent.kind, ripple.kind);
  assert.equal(third.intent.power, ripple.power);
  assert.deepEqual(third.region.tide, { ...ripple, inTurns: 0 });
  const actual = battle.act(0).find(event => event.t === 'act' && event.who.side === 'enemy');
  assert.equal(actual.skill.name, ripple.name);
  assert.equal(actual.skill.type, ripple.kind);
});

const gardenReviewRoute = reviewTwoRoute(0, 0, 1, 0, 0, 1, 0, 0);

test('review 2.6: Starlit seed 37 previews and starts all four fields with Buff Overload', () => {
  const expected = ['goddess_descent', 'twinkle_party', 'sun_bless', 'star_powder'];
  let verified = false;
  playRun('starlit_garden', 37, {
    difficulty: 'easy', firstMain: true,
    doorOverride(run) {
      if (run.floor === 6) {
        assert.ok(run.relics.includes('buff_overload'));
        for (const [keepRelic, fields] of [[true, expected], [false, expected.slice(0, 3)]]) {
          const checkpoint = roundTrip(run);
          if (!keepRelic) checkpoint.relics = checkpoint.relics.filter(id => id !== 'buff_overload');
          assert.deepEqual(Run.doorStart(checkpoint, 1).field, fields);
          enter(checkpoint, 1);
          const battle = Bridge.create(core, Run.battleOptions(checkpoint));
          const start = battle.start().find(event => event.t === 'begin');
          assert.deepEqual(Array.from(start.s.field), fields);
        }
        verified = true;
      }
      return gardenReviewRoute(run);
    },
    onBattle(run) {
      if (run.floor === 4) ok(Run.chooseGateReward(run, { kind: 'relic', id: 'buff_overload' }));
    },
    serviceOverride(run) {
      if (run.floor !== 5) return false;
      assert.equal(run.room.event.id, 'two_garden_chairs');
      return ok(Run.chooseEvent(run, 'lanterns')).ok;
    }
  });
  assert.equal(verified, true);
});

test('review 2.7: Twilight seed 64 settles both elite and third-peal bet relics', () => {
  let checkpoint;
  playRun('twilight_cathedral', 64, {
    difficulty: 'easy', firstMain: true, doorOverride: gardenReviewRoute,
    onRoom(run) {
      if (run.floor !== 5) return;
      assert.equal(run.room.event.id, 'whale_third_peal');
      checkpoint = roundTrip(run);
    }
  });
  advance(checkpoint);
  enter(checkpoint, 1, ['galaxy_whale', 'victoria', 'eclipse_queen']);
  const battle = Bridge.create(core, Run.battleOptions(checkpoint));
  battle.start();
  for (const index of [3, 0, 4]) battle.act(index);
  assert.deepEqual(battle.summary().bet, { kind: 'kill_on_turn', won: true });
  const result = ok(Run.settleBattle(checkpoint, battle));
  assert.deepEqual(result.relics, ['big_bang', 'over_divine']);
  assert.deepEqual(result.relic, { id: 'over_divine', equipped: true });
  assert.ok(result.relics.every(id => checkpoint.relics.includes(id)));
  assert.equal(Run.settleBattle(checkpoint, battle).reason, 'no_active_battle');
});

test('review 2.8: Dawn seed 17 reveals named candidates at two crystals and charges only on commit', () => {
  let verified = false;
  playRun('dawn_forest', 17, {
    opening: 'stand',
    serviceOverride(run) {
      if (run.room.type !== 'spring') return false;
      assert.equal(run.crystals, 3);
      assert.equal(ok(Run.springDraw(run)).id, 'siren');
      assert.equal(run.crystals, 2);
      const seed = run.rng.state;
      const offer = ok(Run.getSpringOffer(run));
      assert.equal(offer.cost, 3);
      assert.ok(offer.candidates.length > 0);
      assert.equal(Run.commitSpringOffer(run, { key: offer.key, id: offer.candidates[0], replaceId: run.bench[0] }).reason,
        'insufficient_crystals');
      assert.equal(run.crystals, 2);
      assert.equal(run.rng.state, seed);
      assert.deepEqual(ok(Run.getSpringOffer(roundTrip(run))), offer);
      verified = true;
      return true;
    }
  });
  assert.equal(verified, true);
});

test('review 2.9: revealed Ember spring candidates and the Starlit event cast stay seen on return', () => {
  let firstSeen;
  const emberRun = playRun(ember, 0, {
    firstMain: true,
    serviceOverride(run) {
      if (run.floor !== 7) return false;
      const seen = run.seenCharacters.slice();
      firstSeen = ok(Run.getSpringOffer(run)).candidates.filter(id => !seen.includes(id));
      assert.ok(firstSeen.length > 0);
      assert.ok(firstSeen.every(id => roundTrip(run).seenCharacters.includes(id)));
      return true;
    }
  }).run;
  assert.equal(emberRun.result, 'win');
  const returned = Meta.applyRunEnd(Meta.createProfile(), emberRun);
  ok(returned.announce);
  assert.ok(firstSeen.every(id => returned.profile.seenCharacters.includes(id)));

  const garden = playRun('starlit_garden', 37, {
    difficulty: 'easy', firstMain: true,
    doorOverride(run) {
      if (run.floor === 5) assert.ok(!run.seenCharacters.includes('victoria'));
      return gardenReviewRoute(run);
    },
    serviceOverride(run) {
      if (run.floor !== 5) return false;
      assert.equal(run.room.event.id, 'two_garden_chairs');
      assert.ok(run.seenCharacters.includes('victoria'));
      return ok(Run.chooseEvent(run, 'lanterns')).ok;
    },
    onBattle(run) {
      if (run.floor === 4) ok(Run.chooseGateReward(run, { kind: 'relic', id: 'buff_overload' }));
    }
  }).run;
  const gardenReturn = Meta.applyRunEnd(returned.profile, garden);
  ok(gardenReturn.announce);
  assert.ok(gardenReturn.profile.seenCharacters.includes('victoria'));
  assert.ok(!Object.hasOwn(gardenReturn.profile.recruits, 'victoria'));
});

test('review 2.10: a seeded Nightmare draft survives reload and clears on cancel or departure', () => {
  const profile = reviewTwoReturns();
  const store = Save.createSaveStore(reviewTwoStorage(), { core, roster });
  const draft = { dungeonId: ember, difficulty: 'nightmare', contract: 'heirloom' };
  const prepared = Meta.setPreparation(profile, draft);
  assert.equal(profile.ui.preparation, null);
  store.save({ profile: prepared });
  const restored = store.load().profile;
  assert.deepEqual(restored.ui.preparation, draft);
  const cancelled = Meta.clearPreparation(restored);
  store.save({ profile: cancelled });
  assert.equal(store.load().profile.ui.preparation, null);
  const run = makeTempo({ ...draft, seed: 0, profileView: Meta.startView(restored, ember) });
  store.save({ profile: restored, run });
  const departed = store.load();
  assert.equal(departed.profile.ui.preparation, null);
  assert.equal(departed.run.contract.id, 'heirloom');
  assert.equal(departed.run.contract.ruleVersion, CONTRACT_RULE_VERSION);
});

test('review 2 reference 1: a truncated rift is reported and set aside through main export and last-good recovery', () => {
  const profile = reviewTwoReturns();
  const storage = reviewTwoStorage();
  const store = Save.createSaveStore(storage, { core, roster });
  const daily = DailyStore.create(storage, { core, roster });
  const main = reach(makeTempo({ seed: 0, profileView: Meta.startView(profile, ember) }), 2);
  store.save({ profile });
  store.save({ profile, run: main });
  const date = '2026-11-21';
  ok(daily.start({ profile, now: localTime(date + 'T12:00:00'), expectedDayKey: date, kind: 'official' }));
  const damaged = storage.getItem(DAILY_KEY).slice(0, -10);
  storage.setItem(DAILY_KEY, damaged);
  assert.equal(store.loadDetailed().run.floor, 2);
  const backup = store.exportBackup();
  assert.equal(backup.daily, null);
  assert.equal(backup.damagedDaily, damaged);
  assert.deepEqual(ok(store.inspectBackup(backup)).warnings, ['invalid_daily']);
  const target = Save.createSaveStore(reviewTwoStorage(), { core, roster });
  assert.deepEqual(ok(target.restoreBackup(backup)).warnings, ['invalid_daily']);
  assert.equal(target.load().run.floor, 2);

  storage.setItem(SESSION_KEY, '{');
  assert.equal(store.loadDetailed().status, 'profileDamaged');
  assert.deepEqual(ok(store.restoreLastGood()).warnings, ['invalid_daily']);
  assert.deepEqual(store.load().profile, profile);
  assert.equal(store.load().run, null);
  assert.equal(storage.getItem(DAILY_KEY), null);
  assert.equal(storage.getItem(DAMAGED_DAILY_KEY), damaged);
});

test('review 2 reference 2: unsafe UI arrays are rejected before a backup replaces either session', () => {
  const storage = reviewTwoStorage();
  const store = Save.createSaveStore(storage, { core, roster });
  const profile = reviewTwoReturns();
  const id = Object.keys(profile.recruits)[0];
  profile.ui.returners = [id];
  store.save({ profile });
  const valid = store.exportBackup();
  for (const patch of [
    { returners: {} }, { returners: [null] }, { recruitChoices: { runId: 'saved-run', ids: {} } },
    { recent: { [id]: [{}] } }, { announcement: { dungeons: ['unknown'] } },
    { latestRun: { dungeonId: ember, floor: 8, result: 'win', fallen: {}, stats: {} } }
  ]) {
    const damaged = structuredClone(valid);
    Object.assign(damaged.session.profile.ui, patch);
    assert.equal(store.inspectBackup(damaged).reason, 'invalid_session');
    assert.equal(store.restoreBackup(damaged).reason, 'invalid_session');
    assert.deepEqual(store.loadLastGood().profile, profile);
    assert.deepEqual(store.exportBackup(), valid);
  }
});

function returnRun(profile, dungeonId, date, seed = 7) {
  return clear(makeTempo({ dungeonId, seed, difficulty: 'easy', profileView: Meta.startView(profile, dungeonId) }), localTime(date));
}

test('mission dates are pinned at the first settlement and survive Sunday, month-end, reload and duplicate submission', () => {
  let profile = profileWithSnowRabbit();
  const sunday = returnRun(profile, ember, '2026-11-22T23:59:00');
  profile = Meta.applyRunEnd(profile, sunday).profile;
  const firstWeek = 'week:2026-11-16';
  const nextWeek = 'week:2026-11-23';
  const november = 'month:2026-11';
  assert.equal(profile.missions.periods[firstWeek].gates, 1);
  const failedRun = reach(makeTempo({ seed: 21, profileView: Meta.startView(profile, ember) }), 6);
  enter(failedRun);
  settle(failedRun, { outcome: 'lose', survivors: [false, false, false], enemyDowns: [] });
  Run.finishRun(failedRun, localTime('2026-11-23T00:01:00'));
  const loss = Meta.applyRunEnd(profile, failedRun);
  ok(loss.announce);
  profile = loss.profile;
  assert.equal(profile.missions.periods[nextWeek].gates, 1);
  assert.deepEqual(profile.missions.periods[november].regionIds, [ember]);
  const repeated = Meta.applyRunEnd(profile, failedRun);
  assert.equal(repeated.announce.reason, 'already_applied');
  assert.equal(repeated.profile, profile);
  const twilight = 'twilight_cathedral';
  const firstOffer = Meta.applyRunEnd(profile, returnRun(profile, twilight, '2026-11-29T23:59:00'));
  profile = firstOffer.profile;
  assert.deepEqual(ok(firstOffer.announce).missions, [nextWeek]);
  const lastDay = roundTrip(returnRun(profile, 'starlit_garden', '2026-11-30T23:59:00'));
  Run.finishRun(lastDay, localTime('2026-12-01T00:01:00'));
  const monthReturn = Meta.applyRunEnd(profile, lastDay);
  assert.deepEqual(ok(monthReturn.announce).missions, [november]);
  profile = monthReturn.profile;
  assert.equal(lastDay.endDayKey, '2026-11-30');
  assert.equal(profile.missions.periods['month:2026-12'], undefined);
  assert.deepEqual(profile.missions.periods[november].regionIds, [ember, twilight, 'starlit_garden']);
  assert.equal(Meta.applyRunEnd(profile, lastDay).announce.reason, 'already_applied');
  const fromSave = Save.restoreProfile(Save.serializeProfile(profile));
  const afterBoundary = Meta.missionsView(fromSave, roster, localTime('2026-12-07T12:00:00'));
  assert.deepEqual(afterBoundary.claimable.map(period => period.key), [november, nextWeek]);
  const [month, week] = afterBoundary.claimable;
  assert.ok(month.candidates.every(id => roster.card(id).grade === 'legend'));
  assert.ok(week.candidates.every(id => ['normal', 'rare'].includes(roster.card(id).grade)));
  assert.ok(month.candidates.length <= 3 && week.candidates.length <= 3);

  const [alreadyTaken] = week.candidates;
  fromSave.reserved = alreadyTaken;
  const regular = returnRun(fromSave, ember, '2026-12-07T12:00:00');
  const ordinary = Meta.applyRunEnd(fromSave, regular, { recruits: [alreadyTaken] });
  profile = ordinary.profile;
  ok(ordinary.announce);
  assert.deepEqual(profile.missions.periods[nextWeek].offerOrder, fromSave.missions.periods[nextWeek].offerOrder);
  assert.equal(Meta.claimMission(profile, nextWeek, alreadyTaken, roster).announce.reason, 'invalid_mission_companion');
  const options = Meta.missionsView(profile, roster).claimable.find(period => period.key === nextWeek).candidates;
  assert.ok(!options.includes(alreadyTaken));
  profile.ui.wantedCompanionId = options[0];
  const invite = Meta.claimMission(profile, nextWeek, options[0], roster);
  assert.deepEqual(ok(invite.announce).recruits, [options[0]]);
  assert.equal(invite.profile.ui.wantedCompanionId, options[0]);
  assert.equal(Meta.claimMission(invite.profile, nextWeek, options[0], roster).announce.reason, 'mission_not_claimable');
  const monthlyInvite = Meta.claimMission(invite.profile, november, month.candidates[0], roster);
  assert.deepEqual(ok(monthlyInvite.announce).recruits, [month.candidates[0]]);
  assert.equal(monthlyInvite.profile.missions.periods[november].claimedId, month.candidates[0]);
  assert.equal(Meta.claimMission(monthlyInvite.profile, november, month.candidates[0], roster).announce.reason, 'mission_not_claimable');
});

test('mission rewards fall back through the fixed pool and award a completion stamp when everyone is owned', () => {
  let profile = profileWithSnowRabbit();
  profile = Meta.applyRunEnd(profile, returnRun(profile, ember, '2026-11-23T12:00:00')).profile;
  const key = 'week:2026-11-23';
  const second = returnRun(profile, ember, '2026-11-24T12:00:00');
  const { profile: earned } = Meta.applyRunEnd(profile, second);
  const { offerOrder } = earned.missions.periods[key];
  for (const id of offerOrder.filter(id => ['normal', 'rare'].includes(roster.card(id).grade))) earned.recruits[id] = { since: 1, bond: 0 };
  const [fallback] = Meta.missionsView(earned, roster).claimable[0].candidates;
  assert.ok(['epic', 'legend'].includes(roster.card(fallback).grade));
  ok(Meta.claimMission(earned, key, fallback, roster).announce);
  for (const id of roster.allies) profile.recruits[id] = { since: 1, bond: 0 };
  const allOwned = Meta.applyRunEnd(profile, second);
  assert.deepEqual(allOwned.profile.missions.periods[key], { gates: 2, regionIds: [], state: 'claimed', offerOrder: [], claimedId: null });
  assert.deepEqual(ok(allOwned.announce).missions, []);
  assert.equal(Meta.missionsView(allOwned.profile, roster).claimable.length, 0);
});

test('last good and file recovery preserve real checkpoints and allow a new real battle recruit settlement', t => {
  const entries = new Map();
  let failWrite = () => false;
  const raw = {
    getItem: key => entries.get(key) ?? null,
    setItem(key, value) {
      if (failWrite(key)) throw new Error('quota exceeded');
      entries.set(key, value);
    },
    removeItem: key => entries.delete(key)
  };
  const storage = slotStorage(raw);
  assert.deepEqual(Save.normalizeSettings({ sound: false, music: false, rim: false }), {
    sound: false, music: false, rim: false, speed: 1, textScale: 1, markers: true
  });
  const store = Save.createSaveStore(storage, { core, roster });
  const daily = DailyStore.create(storage, { core, roster });
  assert.deepEqual(store.loadDetailed(), { status: 'empty' });
  const offline = Save.createSaveStore({ getItem() { throw new Error('denied'); } });
  assert.deepEqual(offline.loadDetailed(), { status: 'unavailable' });
  let profile = legacyProfile();
  for (const dungeonId of ['dawn_forest', ember]) {
    const { run, end } = playRun(dungeonId, 7, { profile, difficulty: 'easy', opening: 'stand' });
    assert.equal(end.result, 'win');
    const result = Meta.applyRunEnd(profile, run, { recruits: [end.recruitable[0]] });
    profile = result.profile;
    ok(result.announce);
  }
  const legacy = structuredClone(profile);
  delete legacy.missions;
  delete legacy.ui;
  for (const clear of Object.values(legacy.records.clears)) delete clear.easy;
  storage.setItem(SESSION_KEY, JSON.stringify({ version: 1, profile: legacy, run: null }));
  const upgraded = store.loadDetailed();
  assert.equal(upgraded.status, 'ok');
  assert.deepEqual(upgraded.profile.recruits, profile.recruits);
  assert.equal(upgraded.profile.records.clears[ember].easy, 0);
  assert.deepEqual(upgraded.profile.missions.periods, {});
  assert.equal(upgraded.profile.ui.entry.legacy, true);
  store.save({ profile });
  assert.deepEqual(store.loadLastGood(), { status: 'ok', profile, run: null });

  const official = key => ok(daily.start({
    profile, now: localTime(key + 'T12:00:00'), expectedDayKey: key, kind: 'official'
  })).run;
  const first = official('2026-11-21');
  ok(daily.abandon(first.id));
  const active = official('2026-11-22');
  const main = reach(makeTempo({ seed: 21, profileView: Meta.startView(profile, ember) }), 2);
  store.save({ profile, run: main });
  const latestWritten = storage.getItem(SESSION_KEY);
  const brokenRun = JSON.parse(latestWritten);
  delete brokenRun.run.run.rng;
  storage.setItem(SESSION_KEY, JSON.stringify(brokenRun));
  const damaged = store.loadDetailed();
  assert.equal(damaged.status, 'runDamaged');
  assert.equal(damaged.run, null);
  assert.deepEqual(damaged.profile.recruits, profile.recruits);
  assert.deepEqual(damaged.profile.notebook, profile.notebook);
  storage.setItem(SESSION_KEY, latestWritten);

  reach(main, 3);
  enter(main);
  const offer = ok(Run.getSpringOffer(main));
  enter(active);
  const settings = { sound: false, music: true, rim: false, speed: 2, textScale: 1.25, markers: true };
  failWrite = () => true;
  assert.throws(() => store.save({ profile, run: main }), /quota exceeded/);
  assert.equal(daily.save(active).reason, 'storage_failed');
  assert.equal(store.loadDetailed().run.floor, 2);
  const backup = store.exportBackup({ profile, run: main, dailyRun: active, settings });
  const summary = ok(store.inspectBackup(JSON.stringify(backup))).summary;
  assert.deepEqual(summary, {
    recruits: 2, dungeonId: ember, floor: 3, dailyOfficialStarts: 2, dailyOfficialResults: 1,
    dailyActive: { dayKey: '2026-11-22', kind: 'official', floor: 1 }
  });
  failWrite = () => false;

  storage.setItem(SESSION_KEY, '{');
  assert.equal(store.loadDetailed().status, 'profileDamaged');
  ok(store.restoreLastGood());
  assert.deepEqual(store.loadDetailed().profile, profile);
  assert.equal(ok(daily.resume()).run.id, active.id);
  assert.equal(daily.history().rows.length, 1);
  const missingLedger = JSON.parse(storage.getItem(SESSION_KEY));
  delete missingLedger.profile.records.appliedRuns;
  storage.setItem(SESSION_KEY, JSON.stringify(missingLedger));
  assert.equal(store.loadDetailed().status, 'profileDamaged');

  for (const [part, change, reason] of [
    ['session', missingLedger, 'invalid_session'],
    ['daily', { ...backup.daily, active: { ...backup.daily.active, checkpoint: { ...backup.daily.active.checkpoint, turns: 99 } } }, 'invalid_daily'],
    ['settings', { ...settings, speed: 3 }, 'invalid_settings']
  ]) assert.equal(store.inspectBackup({ ...backup, [part]: change }).reason, reason);
  ok(store.restoreLastGood());
  const beforeImport = store.exportBackup();
  for (const failureKey of [DAILY_KEY, 'relaymare.activeSlot']) {
    failWrite = key => key.endsWith(failureKey);
    assert.equal(store.restoreBackup(backup).reason, 'storage_failed');
    assert.deepEqual(store.exportBackup(), beforeImport);
    assert.equal(store.loadDetailed().status, 'ok');
  }
  failWrite = () => false;
  ok(store.restoreBackup(backup));
  const restored = store.loadDetailed();
  assert.equal(restored.status, 'ok');
  assert.deepEqual(ok(Run.getSpringOffer(restored.run)), offer);
  assert.equal(restored.run.crystals, main.crystals);
  assert.deepEqual(restored.profile.notebook, backup.session.profile.notebook);
  assert.deepEqual(restored.profile.recruits, profile.recruits);
  assert.deepEqual(restored.profile.missions, profile.missions);
  assert.deepEqual(JSON.parse(storage.getItem(SETTINGS_KEY)), settings);
  assert.deepEqual(ok(store.inspectBackup(store.exportBackup())).summary, summary);
  assert.equal(ok(daily.resume()).run.room.status, 'order');
  assert.equal(daily.history().rows[0].official.runId, first.id);
  assert.equal(daily.abandon(first.id).duplicate, true);
  assert.equal(daily.start({ profile, now: localTime('2026-11-22T12:00:00'), expectedDayKey: '2026-11-22', kind: 'official' }).reason, 'active_exists');

  const { run, end } = playRun('twilight_cathedral', 21, { profile: restored.profile, difficulty: 'easy' });
  assert.equal(end.result, 'win');
  assert.equal(run.stats.battles, 5);
  const recruit = 'void_knight';
  assert.equal(end.recruitable[0], recruit);
  const recruited = Meta.applyRunEnd(restored.profile, run, { recruits: [recruit] });
  assert.deepEqual(ok(recruited.announce).recruits, [recruit]);
  store.save({ profile: recruited.profile });
  assert.deepEqual(store.loadDetailed().profile.recruits[recruit], { bond: 0, since: 3 });
  assert.equal(Meta.applyRunEnd(store.loadDetailed().profile, run).announce.reason, 'already_applied');
  t.diagnostic(`Restored the floor-3 spring, ${summary.dailyOfficialStarts} official attempts, then recruited ${recruit} after ${run.stats.battles} battles.`);
  assert.equal(store.clear(), true);
  assert.equal(entries.size, 0);
  assert.equal(store.loadLastGood().status, 'empty');
});

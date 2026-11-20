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
  const run = Run.createRun({ core, roster, dungeonId: 'dawn_forest', seed: 7 });
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

test('rescue needs a lethal retreat and both fighters alive in a won floor-four or floor-six battle', () => {
  for (const { floor, lethal, incomingAlive, outcome, met } of [
    { floor: 4, lethal: true, incomingAlive: true, outcome: 'win', met: true },
    { floor: 6, lethal: true, incomingAlive: true, outcome: 'win', met: true },
    { floor: 4, lethal: false, incomingAlive: true, outcome: 'win', met: false },
    { floor: 6, lethal: true, incomingAlive: false, outcome: 'win', met: false },
    { floor: 6, lethal: true, incomingAlive: true, outcome: 'lose', met: false },
    { floor: 2, lethal: true, incomingAlive: true, outcome: 'win', met: false }
  ]) {
    const run = reach(contractedRun('rescue'), floor);
    enter(run);
    const [retreated, incoming] = run.room.party;
    const result = settle(run, {
      outcome, retreated: [true, false, false], survivors: [false, incomingAlive, true],
      rescues: [{ retreated, incoming, lethal }]
    });
    assert.equal(result.contract.metNow, met);
    assert.equal(run.contract.met, met);
    assert.equal(run.contract.metAtFloor, met ? floor : null);
    assert.equal(result.contract.failed, floor === 6 && !met);
  }
});

test('heirloom counts the killing hit on floors four and six and requires victory', () => {
  for (const [floor, kills, outcome, met] of [[4, 1, 'win', true], [6, 1, 'win', true], [6, 0, 'win', false],
    [6, 1, 'lose', false], [2, 1, 'win', false]]) {
    const run = reach(contractedRun('heirloom'), floor);
    enter(run);
    const result = settle(run, { outcome, heirloomsUsed: 1, heirloomKills: kills });
    assert.equal(result.contract.metNow, met);
    assert.equal(result.contract.paid, floor === 6 && met ? CONTRACT_PAYOUT : 0);
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

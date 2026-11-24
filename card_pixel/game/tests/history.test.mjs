import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENTS } from '../src/content/events.js';
import * as Bridge from '../src/engine/bridge.js';
import { chronicle } from '../src/engine/history.js';
import * as Meta from '../src/engine/meta.js';
import * as Run from '../src/engine/run.js';
import * as Save from '../src/engine/save.js';
import { outcomeText, retreatStoryLine, storyLine } from '../src/ui/story-lines.js';
import { playRun } from '../tools/sim.mjs';
import { createCoreRoster } from './support/core.mjs';

const names = { ash: '애쉬', siren: '세이렌', silver_rabbit: '은토끼' };
const card = id => names[id] && { name: names[id] };

test('retreat story requires a recorded retreat and survival in the same battle', () => {
  const run = {
    chronicle: [{ floor: 8, party: ['ash', 'siren'] }],
    lastBattleResult: { floor: 8, survivorIds: ['ash'] },
    lastBattleLog: [{ turn: 4, rows: [{ kind: 'retreat', faces: [{ id: 'ash', side: 'ally' }] }] }]
  };
  assert.equal(retreatStoryLine(run, card), '애쉬가 물러나 살아남았다.');
  assert.equal(retreatStoryLine({ ...run, lastBattleLog: [] }, card), '');
  assert.equal(retreatStoryLine({ ...run, lastBattleResult: { floor: 8, survivorIds: ['siren'] } }, card), '');
  assert.equal(retreatStoryLine({ ...run, chronicle: undefined }, card), '');
});

function finishedRun(changes = {}) {
  return {
    id: 'test-run', dungeonId: 'ember_volcano', difficulty: 'easy', floor: 8, phase: 'done', result: 'win',
    bench: ['ash', 'sunflower'], participated: ['ash'], fallen: [], released: [], eligible: ['ash'],
    gateSurvivors: [], recruited: [], seenCharacters: [], seenRelics: [], stats: { gateWins: 0 },
    ...changes
  };
}

const { core, roster } = createCoreRoster();

function ok(result) {
  assert.equal(result.ok, true, result.reason);
  return result;
}

function runAt(floor, bench) {
  const run = Run.createRun({ core, roster, dungeonId: 'ember_volcano', seed: 7, plain: true });
  while (run.pending?.kind === 'start') ok(Run.chooseStartPick(run, run.pending.candidates[0]));
  run.bench = bench.slice();
  run.joinOrder = bench.slice();
  while (run.floor < floor) {
    ok(Run.chooseDoor(run, 0));
    run.room.status = 'resolved';
    advance(run);
  }
  return run;
}

function advance(run) {
  if (run.pending?.kind === 'reinforcement') {
    ok(Run.resolveReinforcement(run, { key: run.pending.key, id: null }));
  }
  ok(Run.leaveRoom(run));
  ok(Run.nextFloor(run));
}

function battleAt(run, party, hp = 1, atk = 0) {
  // Supply a battle fixture on floor 3, whose main route normally has service rooms.
  if (run.floor === 3) run.doors[0] = { ...run.doors[0], type: 'wild', reward: 1 };
  const door = run.doors[0];
  door.enemies = [{
    id: 'test_shadow', name: '시험용 적', element: 'nature', ...door.enemies[0],
    skills: [], stats: { hp, atk, matk: atk, def: 0, mdef: 0 }
  }];
  ok(Run.enterBattleDoor(run, { floor: run.floor, index: 0, partyIds: party }));
  const battle = Bridge.create(core, { ...Run.battleOptions(run), tempo: null });
  battle.start();
  return battle;
}

test('floor-three fall and inheritance survive later battles and distinguish fighting, waiting and bench', () => {
  let run = runAt(3, ['ash', 'siren', 'silver_rabbit', 'sunflower']);
  const third = battleAt(run, ['ash', 'siren'], 1000, 5000);
  third.host.battle.players[0].baseEva = 0;
  third.act(0);
  assert.equal(third.state().cur, 1);
  third.host.battle.enemy.hp = 1;
  third.act(0);
  ok(Run.settleBattle(run, third));
  const afterThird = structuredClone(run);
  assert.equal(Run.settleBattle(run, third).reason, 'no_active_battle');
  assert.deepEqual(run, afterThird);

  run = Save.restoreRun(Save.serializeRun(run), { core, roster });
  assert.deepEqual(run, afterThird);
  advance(run);
  const fourth = battleAt(run, ['siren', 'silver_rabbit']);
  fourth.act(fourth.options().find(move => move.heirloom).index);
  ok(Run.settleBattle(run, fourth));
  assert.deepEqual(run.chronicle.at(-1), {
    floor: 4, roomType: 'gate', result: 'win', party: ['siren', 'silver_rabbit'], fought: ['siren'], fallen: [],
    gained: [], used: [{ by: 'siren', from: 'ash', skill: '아마겟돈' }], lastHit: 'siren', bossOrGate: true
  });

  advance(run);
  ok(Run.chooseDoor(run, run.doors.find(door => door.type === 'treasure').index));
  ok(Run.takeTreasure(run));
  advance(run);
  const sixth = battleAt(run, ['siren']);
  sixth.act(0);
  ok(Run.settleBattle(run, sixth));
  advance(run);
  ok(Run.chooseDoor(run, 0));
  advance(run);
  const boss = battleAt(run, ['siren']);
  boss.act(0);
  ok(Run.settleBattle(run, boss));
  ok(Run.confirmResult(run));

  const facts = chronicle(run);
  assert.equal(facts.ash.fallenFloor, 3);
  assert.deepEqual(facts.ash.given, [{ toId: 'siren', skillName: '아마겟돈', floor: 3 }]);
  assert.deepEqual(facts.siren.used, [{ fromId: 'ash', skillName: '아마겟돈', floor: 4, roomType: 'gate', won: true }]);
  assert.deepEqual(facts.siren.victories, [
    { roomType: 'gate', floor: 4, lastHit: true }, { roomType: 'boss', floor: 8, lastHit: true }
  ]);
  assert.equal(facts.siren.participation, 'boss');
  assert.equal(facts.silver_rabbit.participation, 'gate-standby');
  assert.equal(facts.silver_rabbit.fielded, false);
  assert.deepEqual(facts.silver_rabbit.victories, []);
  assert.equal(facts.sunflower.participation, 'bench');
  assert.equal(storyLine(facts.ash, card), '홍련 화산 3층에서 쓰러져 세이렌에게 아마겟돈을 남겼다.');
  assert.equal(storyLine(facts.siren, card), '홍련 화산 8층 보스전에서 마지막 일격을 날렸다.');
  assert.equal(storyLine(facts.silver_rabbit, card), '싸울 차례가 오기 전에 전투가 끝나 함께 돌아왔다.');
  assert.equal(storyLine(facts.sunflower, card), '예비석에 남아 함께 돌아왔다.');
  const { profile, announce } = Meta.applyRunEnd(Meta.createProfile(), run);
  assert.equal(announce.ok, true);
  assert.deepEqual(Save.restoreProfile(Save.serializeProfile(profile)).history.siren, [facts.siren]);
});

test('the event source survives use by a transformed companion without adding the form or event donor to the party', () => {
  const run = runAt(5, ['miracle_larva']);
  const eventDoor = run.doors.find(door => door.type === 'event');
  eventDoor.event = EVENTS.find(event => event.id === 'ash_split_wick');
  ok(Run.chooseDoor(run, eventDoor.index));
  assert.equal(Run.chooseEvent(run, 'veil', 'ash').ok, false);
  assert.deepEqual(run.chronicle, []);
  ok(Run.chooseEvent(run, 'veil', 'miracle_larva'));
  assert.equal(Run.chooseEvent(run, 'veil', 'miracle_larva').ok, false);
  assert.deepEqual(run.chronicle, [
    { floor: 5, roomType: 'event', eventId: 'ash_split_wick',
      gained: [{ to: 'miracle_larva', from: 'ash', skill: '드림파이어' }], released: [] }
  ]);
  const before = chronicle(run).miracle_larva;
  assert.equal(storyLine(before, card), '홍련 화산 5층 ‘애쉬의 갈라진 심지’에서 애쉬의 드림파이어를 이어받았다.');
  advance(run);

  const battle = battleAt(run, ['miracle_larva']);
  battle.act(battle.options().find(move => move.name === '기적의우화').index);
  battle.act(battle.options().find(move => move.name.includes('오로라윙')).index);
  battle.act(battle.options().find(move => move.heirloom).index);
  assert.deepEqual(battle.summary().forms, { mirror_cocoon: 'miracle_larva', aurora_wing: 'miracle_larva' });
  assert.deepEqual(battle.summary().heirloomUses, [{ by: 'miracle_larva', from: 'ash', skill: '드림파이어' }]);
  ok(Run.settleBattle(run, battle));

  const facts = chronicle(run);
  assert.deepEqual(Object.keys(facts), ['miracle_larva']);
  assert.deepEqual(facts.miracle_larva.inherited, [
    { fromId: 'ash', skillName: '드림파이어', eventId: 'ash_split_wick', floor: 5 }
  ]);
  assert.deepEqual(facts.miracle_larva.used, [
    { fromId: 'ash', skillName: '드림파이어', floor: 6, roomType: 'wild', won: true }
  ]);
  assert.equal(run.chronicle.at(-1).lastHit, 'miracle_larva');
});

test('a real old run save opens without records and retains its latest battle facts', () => {
  const run = runAt(8, ['siren']);
  const boss = battleAt(run, ['siren']);
  boss.act(0);
  ok(Run.settleBattle(run, boss));
  ok(Run.confirmResult(run));
  delete run.chronicle;
  const restored = Save.restoreRun(Save.serializeRun(run), { core, roster });
  assert.ok(restored);
  assert.equal(Object.hasOwn(restored, 'chronicle'), false);
  assert.deepEqual(chronicle(restored).siren.victories, [{ roomType: 'boss', floor: 8 }]);
  assert.equal(storyLine(chronicle(restored).siren, card), '홍련 화산 8층 보스전에서 함께 이겼다.');
});

test('audit seeds 17/1000197 let Sunflower return and join from reserve with bond zero', () => {
  const initial = Meta.createProfile();
  const intro = playRun('dawn_forest', 17, { profile: initial, opening: 'rescue' });
  const { profile } = Meta.applyRunEnd(initial, intro.run, { recruits: intro.end.recruitable.slice(0, 1) });
  const { run, end } = playRun('ember_volcano', 1000197, { profile, difficulty: 'easy' });
  assert.equal(run.result, 'win');
  assert.ok(end.recruitable.includes('sunflower'));
  assert.ok(run.bench.includes('sunflower'));
  assert.ok(!run.participated.includes('sunflower'));
  const settled = Meta.applyRunEnd(profile, run, { recruits: ['sunflower'] });
  assert.equal(settled.announce.ok, true, settled.announce.reason);
  assert.ok(settled.announce.returned.includes('sunflower'));
  assert.ok(!settled.announce.fielded.includes('sunflower'));
  assert.ok(!settled.announce.bonds.some(bond => bond.id === 'sunflower'));
  assert.equal(settled.profile.recruits.sunflower.bond, 0);
  const [entry] = settled.profile.history.sunflower;
  assert.equal(entry.fielded, false);
  assert.equal(outcomeText(entry), '예비로 생환');
  assert.equal(storyLine(entry, card), '예비석에 남아 함께 돌아왔다.');
});

test('chronicle separates fielded, reserve, fell and released outcomes', () => {
  const run = finishedRun({
    fallen: ['silver_rabbit', 'siren'], released: ['night_rabbit'],
    participated: ['ash', 'silver_rabbit', 'siren'], seenCharacters: ['luna'],
    lastBattleResult: { floor: 8, roomType: 'boss', outcome: 'win', fallenIds: ['silver_rabbit'], survivorIds: ['ash'], transfers: [] },
    gateSurvivors: ['ash', 'siren']
  });
  const original = structuredClone(run);
  const facts = chronicle(run);
  assert.deepEqual(run, original);
  assert.equal(outcomeText(facts.ash), '생환');
  assert.equal(outcomeText(facts.sunflower), '예비로 생환');
  assert.equal(outcomeText(facts.silver_rabbit), '쓰러짐');
  assert.equal(outcomeText(facts.night_rabbit), '보냄');
  assert.equal(facts.silver_rabbit.fallenFloor, 8);
  assert.ok(!Object.hasOwn(facts.siren, 'fallenFloor'));
  assert.ok(!Object.hasOwn(facts, 'luna'));
  assert.deepEqual(facts.ash.victories, [{ roomType: 'boss', floor: 8 }, { roomType: 'gate' }]);
  assert.deepEqual(facts.silver_rabbit.victories, [{ roomType: 'boss', floor: 8 }]);
  assert.deepEqual(facts.siren.victories, [{ roomType: 'gate' }]);
  assert.deepEqual(facts.sunflower.victories, []);
  assert.equal(storyLine(facts.night_rabbit, card), '홍련 화산 원정 도중 일행과 헤어졌다.');
  assert.equal(storyLine(facts.ash, card), '홍련 화산 8층 보스전에서 함께 이겼다.');

  const loss = finishedRun({ result: 'lose' });
  const { announce } = Meta.applyRunEnd(Meta.createProfile(), loss);
  assert.deepEqual(announce.returned, []);
  assert.deepEqual(announce.fielded, ['ash']);
  assert.equal(storyLine(chronicle(loss).ash, card), '홍련 화산 원정에서 전투에 나섰다.');
  assert.equal(storyLine(chronicle(loss).sunflower, card), '');
});

test('heirloom transfers and recorded uses carry the skill, floor and battle result', () => {
  const face = id => ({ id, side: 'ally' });
  const run = finishedRun({
    floor: 4, bench: ['siren'], fallen: ['ash'], participated: ['ash', 'siren'],
    heirlooms: { siren: { from: 'ash', name: '아마겟돈' } },
    lastBattleResult: {
      floor: 4, roomType: 'gate', outcome: 'win', fallenIds: ['ash'], survivorIds: ['siren'],
      transfers: [{ fromId: 'ash', toId: 'siren', skillName: '아마겟돈' }]
    },
    lastBattleLog: [{ turn: 2, rows: [
      { kind: 'heirloom', text: '아마겟돈', faces: [face('ash'), face('siren')] },
      { kind: 'heirloom-use', text: '아마겟돈', faces: [face('siren'), face('ash')], amount: 900 },
      { kind: 'down', faces: [{ id: 'gate_shadow', side: 'enemy' }] }
    ] }]
  });
  const facts = chronicle(run);
  assert.deepEqual(facts.ash.given, [{ toId: 'siren', skillName: '아마겟돈' }]);
  assert.deepEqual(facts.siren.used, [{ fromId: 'ash', skillName: '아마겟돈', floor: 4, roomType: 'gate', won: true }]);
  assert.equal(storyLine(facts.ash, card), '홍련 화산 4층에서 쓰러져 세이렌에게 아마겟돈을 남겼다.');
  assert.equal(storyLine(facts.siren, card), '애쉬의 아마겟돈을 쓴 홍련 화산 4층 문지기전에서 이겼다.');

  run.lastBattleResult.outcome = 'lose';
  run.result = 'lose';
  assert.equal(storyLine(chronicle(run).siren, card), '애쉬의 아마겟돈을 쓴 홍련 화산 4층 문지기전에서 패했다.');
  assert.deepEqual(chronicle(run).siren.victories, []);
});

test('held heirlooms, the strongest hit and a loss do not invent past acts or locations', () => {
  const run = finishedRun({
    bench: ['siren'], fallen: ['ash'], participated: ['ash', 'siren'],
    heirlooms: { siren: { from: 'ash', name: '아마겟돈' } },
    stats: { gateWins: 1, heirloomsUsed: 3, bestHit: { by: 'siren', amount: 5000, skill: '아마겟돈' } }
  });
  const facts = chronicle(run);
  assert.deepEqual(facts.ash.given, []);
  assert.deepEqual(facts.siren.used, []);
  assert.deepEqual(facts.siren.victories, []);
  assert.equal(storyLine(facts.ash, card), '홍련 화산 원정에서 쓰러졌다.');
  assert.equal(storyLine(facts.siren, card), '애쉬의 아마겟돈을 이어받았다.');
  assert.equal(storyLine(facts.luna, card), '');
});

test('settlement applies history once, keeps twelve newest entries and leaves bond eligibility intact', () => {
  let profile = Meta.createProfile();
  profile.recruits = { ash: { bond: 0, since: 0 }, sunflower: { bond: 0, since: 0 } };
  const first = finishedRun({ id: 'test-run/0' });
  const applied = Meta.applyRunEnd(profile, first);
  assert.equal(applied.announce.ok, true);
  assert.deepEqual(applied.announce.bonds, [{ id: 'ash', bond: 1 }]);
  assert.deepEqual(profile.history, {});
  const duplicate = Meta.applyRunEnd(applied.profile, first);
  assert.equal(duplicate.announce.reason, 'already_applied');
  assert.equal(duplicate.profile, applied.profile);
  assert.equal(duplicate.profile.history.sunflower.length, 1);
  profile = applied.profile;
  for (let i = 1; i < 14; i++) {
    const next = Meta.applyRunEnd(profile, finishedRun({ id: `test-run/${i}` }));
    assert.equal(next.announce.ok, true);
    profile = next.profile;
  }
  assert.deepEqual(profile.history.sunflower.map(entry => entry.runId),
    Array.from({ length: 12 }, (_, i) => `test-run/${13 - i}`));
  assert.equal(profile.recruits.sunflower.bond, 0);
  assert.equal(profile.recruits.ash.bond, 14);
  assert.deepEqual(Save.restoreProfile(Save.serializeProfile(profile)), profile);
});

test('old saves start with empty history and ambiguous legacy return statuses stay unrecorded', () => {
  const old = Meta.createProfile();
  delete old.history;
  const entry = { dungeonId: 'ember_volcano', floor: 8, result: 'win' };
  old.ui.recent = { sunflower: [{ ...entry, returned: false }, entry, { ...entry, returned: true }] };
  const restored = Save.restoreProfile(JSON.stringify(old));
  assert.deepEqual(restored.history, {});
  assert.deepEqual(restored.ui.recent.sunflower.map(outcomeText), ['귀환 여부 미기록', '귀환 여부 미기록', '생환']);
});

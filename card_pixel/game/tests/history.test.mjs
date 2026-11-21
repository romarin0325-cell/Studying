import assert from 'node:assert/strict';
import test from 'node:test';
import { chronicle } from '../src/engine/history.js';
import * as Meta from '../src/engine/meta.js';
import * as Save from '../src/engine/save.js';
import { outcomeText, storyLine } from '../src/ui/story-lines.js';
import { playRun } from '../tools/sim.mjs';

const names = { ash: '애쉬', siren: '세이렌', silver_rabbit: '은토끼' };
const card = id => names[id] && { name: names[id] };

function finishedRun(changes = {}) {
  return {
    id: 'test-run', dungeonId: 'ember_volcano', difficulty: 'easy', floor: 8, phase: 'done', result: 'win',
    bench: ['ash', 'sunflower'], participated: ['ash'], fallen: [], released: [], eligible: ['ash'],
    gateSurvivors: [], recruited: [], seenCharacters: [], seenRelics: [], stats: { gateWins: 0 },
    ...changes
  };
}

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

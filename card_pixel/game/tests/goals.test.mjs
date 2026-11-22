import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTRACTS } from '../src/content/contracts.js';
import { NOTEBOOK_GOALS } from '../src/content/notebook.js';
import { applyRunEnd, nextGoal, unrecruitedCompanions, validPreparation } from '../src/engine/meta.js';
import { restoreProfile, serializeProfile } from '../src/engine/save.js';
import { resumeLabel } from '../src/ui/glossary.js';
import { dreamClearProfile } from './screens/goals.mjs';
import { createCoreRoster } from './support/core.mjs';

const { roster } = createCoreRoster();
const ember = 'ember_volcano';
const clearOnJourney = profile => {
  for (const id of profile.unlockedDungeons.filter(id => id !== 'dawn_forest')) {
    profile.records.clears[id].normal = 1;
    profile.nightmareUnlocks.push(id);
  }
};

test('after the tower, unreturned regions outrank Journey unlocks and an all-Dream profile selects Journey', () => {
  const profile = dreamClearProfile();
  const original = structuredClone(profile);
  const goal = nextGoal(profile, null);
  assert.deepEqual(goal, {
    text: '홍련 화산 여정 생환 → 악몽 해금', reward: '',
    target: { screen: 'dungeons', dungeonId: ember, difficulty: 'normal' }
  });
  assert.ok(validPreparation(profile, { ...goal.target, contract: null }));
  assert.deepEqual(profile, original);
  delete profile.records.clears.arena;
  assert.equal(nextGoal(profile, null).text, '투기장에서 생환');
  assert.equal(nextGoal(profile, null).target.dungeonId, 'arena');
  profile.records.clears.arena = { easy: 0, normal: 0, nightmare: 1 };
  assert.equal(nextGoal(profile, null).target.dungeonId, ember);
});

test('unfinished notebook chapters beat untaken contracts, and untaken contracts beat unowned encounters', () => {
  const profile = dreamClearProfile();
  clearOnJourney(profile);
  profile.records.clears.creation_tower.normal = 0;
  assert.equal(nextGoal(profile).target.dungeonId, 'creation_tower');
  profile.records.clears.creation_tower.normal = 1;
  assert.deepEqual(nextGoal(profile, null), {
    ...NOTEBOOK_GOALS[5], target: { screen: 'dungeons', dungeonId: 'twilight_cathedral', difficulty: 'normal' }
  });
  profile.notebook.chapters = profile.notebook.chapters.filter(chapter => chapter !== 2);
  assert.equal(nextGoal(profile).text, NOTEBOOK_GOALS[2].text);
  profile.notebook.chapters.push(2, 5);
  profile.contractStamps[ember] = { rescue: 'return-again' };
  const goal = nextGoal(profile, null, roster);
  assert.equal(goal.text, '홍련 화산 · 마지막 유품');
  assert.deepEqual(goal.target, { screen: 'dungeons', dungeonId: ember, difficulty: 'nightmare', contractId: 'heirloom' });
  assert.ok(validPreparation(profile, { ...goal.target, contract: goal.target.contractId }));

  for (const id of profile.nightmareUnlocks) {
    profile.contractStamps[id] = Object.fromEntries(Object.keys(CONTRACTS).map(contract => [contract, 'return-again']));
  }
  const encounter = nextGoal(profile, null, roster);
  assert.equal(encounter.text, '영입 전 동료 2명 · 별빛 정원에서 만날 수 있음');
  assert.equal(encounter.target.dungeonId, 'starlit_garden');
  assert.equal(nextGoal(profile).target.dungeonId, 'creation_tower');
  profile.seenCharacters.push('behemoth');
  assert.equal(nextGoal(profile, null, roster).text, '영입 전 동료 3명 · 창조의 탑에서 만날 수 있음');
  profile.seals.creation_tower = ['behemoth'];
  assert.equal(nextGoal(profile, null, roster).target.dungeonId, 'starlit_garden');
  for (const id of ['marshmallow', 'deep_lord', 'behemoth']) profile.recruits[id] = { bond: 0, since: 8 };
  assert.equal(nextGoal(profile, null, roster).text, '동료 도감 보기');
  assert.equal(nextGoal(profile, null, roster).target.screen, 'collection');
});

test('settlement and old saves supply candidate, bench, and recent sightings without a new profile field', () => {
  const profile = dreamClearProfile();
  const run = {
    id: 'new-run', dungeonId: ember, difficulty: 'easy', floor: 8, phase: 'done', result: 'win',
    bench: ['kobold', 'sunflower'], participated: [], fallen: [], released: [], eligible: [],
    gateSurvivors: [], recruited: ['sunflower'], seenCharacters: ['mimic', 'marshmallow'], seenRelics: [],
    stats: { gateWins: 0 }, endDayKey: '2026-11-22'
  };
  assert.deepEqual(new Set(unrecruitedCompanions(profile, roster)), new Set(['deep_lord', 'marshmallow']));
  const settled = applyRunEnd(profile, run);
  assert.equal(settled.announce.ok, true);
  const restored = restoreProfile(serializeProfile(settled.profile));
  assert.ok(restored);
  assert.deepEqual(new Set(unrecruitedCompanions(restored, roster)), new Set(['kobold', 'mimic', 'deep_lord', 'marshmallow']));
  assert.equal(applyRunEnd(restored, run).announce.reason, 'already_applied');
});

test('active goals share the resume checkpoint wording and saved door', () => {
  const profile = dreamClearProfile();
  const run = {
    id: 'active-run', dungeonId: ember, floor: 4, phase: 'map',
    doors: [{ type: 'gate', index: 0, enemies: [{ id: 'gate' }] }]
  };
  const text = '홍련 화산 4층 · 문지기 전투 입구부터';
  assert.deepEqual(nextGoal(profile, run), { text, reward: '', target: { screen: 'resume', dungeonId: ember } });
  assert.equal(nextGoal(profile, run).text, resumeLabel(run, profile.ui));
  run.floor = 3;
  run.doors = [{ type: 'spring', index: 0, enemies: [] }, { type: 'elite', index: 1, enemies: [{ id: 'elite' }] }];
  profile.ui.entryDoor = { runId: run.id, index: 1 };
  assert.equal(nextGoal(profile, run).text, '홍련 화산 3층 · 강한 적 전투 입구부터');
});

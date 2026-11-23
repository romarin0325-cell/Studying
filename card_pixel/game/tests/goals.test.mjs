import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTRACTS } from '../src/content/contracts.js';
import { NOTEBOOK_GOALS } from '../src/content/notebook.js';
import { ratesView, springDrawChance } from '../src/engine/awakenings.js';
import { applyRunEnd, companionSpringRates, nextGoal, setExpeditionParty, setPreparation, setSeals, startView, unrecruitedCompanions, validPreparation } from '../src/engine/meta.js';
import { gradeOf } from '../src/engine/roster.js';
import { chooseStartPick, createRun } from '../src/engine/run.js';
import { restoreProfile, serializeProfile } from '../src/engine/save.js';
import { resumeLabel } from '../src/ui/glossary.js';
import { preparationSheet } from '../src/ui/screens/dungeons.js';
import { playRun } from '../tools/sim.mjs';
import { dreamClearProfile, firstMainReturnProfile, readyStartCompanionProfile, rescueContractProfile } from './screens/goals.mjs';
import { createCoreRoster } from './support/core.mjs';

const { core, roster } = createCoreRoster();
const ember = 'ember_volcano';
const arena = 'arena';
const guardian = 'guardian';
const tower = 'creation_tower';
const springRateIn = (profile, companion, dungeonId) => companionSpringRates(profile, roster, companion)
  .find(rate => rate.dungeonId === dungeonId);

const clearOnJourney = profile => {
  for (const id of profile.unlockedDungeons.filter(id => id !== 'dawn_forest')) {
    profile.records.clears[id].normal = 1;
    profile.nightmareUnlocks.push(id);
  }
};

function renderPreparation(t, profile, target) {
  const documentBefore = globalThis.document;
  const clicks = new Map();
  const view = { html: '', focused: null, click: selector => clicks.get(selector)() };
  globalThis.document = {
    querySelector(selector) {
      if (selector === '[data-goal-focus]' && !view.html.includes(' data-goal-focus')) return null;
      return {
        focus: () => { view.focused = selector; },
        addEventListener: (event, handler) => { if (event === 'click') clicks.set(selector, handler); }
      };
    },
    querySelectorAll: () => []
  };
  t.after(() => {
    if (documentBefore === undefined) delete globalThis.document;
    else globalThis.document = documentBefore;
  });
  preparationSheet({ ...target, roster, currentProfile: () => profile, widgets: { face: () => '' },
    updateProfile: () => assert.fail('Opening the sheet changed the party'),
    savePreparation: () => assert.fail('Opening the sheet changed the draft'),
    sheets: { openSheet(_title, html) { view.html = html; } }
  });
  return view;
}

test('following the different-start goal names and focuses the change while the player keeps their own choice', t => {
  const profile = firstMainReturnProfile();
  const original = structuredClone(profile);
  const goal = nextGoal(profile, null, roster);
  assert.equal(goal.text, NOTEBOOK_GOALS[5].text);
  assert.deepEqual(goal.target, {
    screen: 'dungeons', dungeonId: 'twilight_cathedral', difficulty: 'normal', startCompanionNot: 'red_dragon'
  });
  const view = renderPreparation(t, profile, goal.target);
  assert.match(view.html, /<div class="meta-prep-lead">[\s\S]*?<b>레드드래곤<\/b><button[^>]+id="meta-change-lead"[^>]+data-goal-focus>바꾸기<\/button>\s*<\/div>\s*<p[^>]+id="meta-prep-lead-hint">레드드래곤 말고 다른 시작 동료<\/p>/);
  assert.equal(view.focused, '[data-goal-focus]');
  assert.deepEqual(profile, original);

  const { dungeonId, difficulty } = goal.target;
  const originalLeadWin = playRun(dungeonId, 2023757, { profile, difficulty });
  assert.equal(originalLeadWin.end.result, 'win');
  assert.equal(nextGoal(applyRunEnd(profile, originalLeadWin.run).profile).text, goal.text);

  const alternate = setExpeditionParty(profile, { lead: 'phoenix', companions: profile.companions });
  assert.ok(alternate.announce.ok);
  assert.equal(nextGoal(alternate.profile).target.startCompanionNot, 'red_dragon');
  const returning = playRun(dungeonId, 2023758, { profile: alternate.profile, difficulty });
  assert.equal(returning.end.result, 'win');
  assert.ok(returning.run.gateSurvivors.includes('phoenix') && returning.run.bench.includes('phoenix'));
  const settled = applyRunEnd(alternate.profile, returning.run);
  assert.ok(settled.announce.ok && settled.profile.notebook.chapters.includes(5));
  assert.notEqual(nextGoal(settled.profile).text, goal.text);
});

test('the different-start goal confirms an already eligible start companion without moving focus', t => {
  const profile = readyStartCompanionProfile();
  const original = structuredClone(profile);
  const goal = nextGoal(profile, null, roster);
  assert.equal(goal.text, NOTEBOOK_GOALS[5].text);
  assert.equal(goal.target.startCompanionNot, 'ash');
  const view = renderPreparation(t, profile, goal.target);
  assert.match(view.html, /id="meta-prep-lead-hint">조건 충족 · 시작 동료 눈토끼<\/p>/);
  assert.doesNotMatch(view.html, /data-goal-focus/);
  assert.equal(view.focused, null);
  assert.deepEqual(profile, original);
});

test('the different-start goal offers and focuses a change if the start companion is missing', t => {
  const profile = readyStartCompanionProfile();
  profile.lead = null;
  const original = structuredClone(profile);
  const goal = nextGoal(profile, null, roster);
  const view = renderPreparation(t, profile, goal.target);
  assert.match(view.html, /id="meta-prep-lead-hint">애쉬 말고 다른 시작 동료<\/p>/);
  assert.equal(view.focused, '[data-goal-focus]');
  assert.deepEqual(profile, original);
});

test('the Ember rescue contract picker requires achievement before either reward', t => {
  const target = { dungeonId: ember, difficulty: 'nightmare', contract: null };
  const profile = setPreparation(rescueContractProfile(), target);
  const view = renderPreparation(t, profile, target);
  assert.equal(view.focused, null);
  view.click('#meta-contract-choice');
  const option = view.html.match(/<button[^>]+data-contract="rescue"[^>]*>([\s\S]*?)<\/button>/)?.[1];
  assert.ok(option);
  const rewards = option.match(/<small class="meta-contract-rewards">(.*?)<\/small>/)?.[1];
  assert.equal(rewards?.replace(/<[^>]+>/g, ''), '계약 달성 시 · 결정 ◆3은 6층 승리 뒤 / 도장은 원정 생환 뒤');
  assert.match(option, /문지기 보상에서 ◆1 맡김/);
  assert.match(option, /도장 없음/);
});

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
    text: NOTEBOOK_GOALS[5].text, reward: NOTEBOOK_GOALS[5].reward,
    target: { screen: 'dungeons', dungeonId: 'twilight_cathedral', difficulty: 'normal', startCompanionNot: 'snow_rabbit' }
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

test('the encounter recommendation rotates after two visits unless the region has a progression goal', () => {
  const profile = dreamClearProfile();
  clearOnJourney(profile);
  profile.notebook.chapters.push(5);
  for (const id of profile.nightmareUnlocks) {
    profile.contractStamps[id] = Object.fromEntries(Object.keys(CONTRACTS).map(contract => [contract, 'return-again']));
  }
  profile.seenCharacters.push('behemoth');
  profile.records.appliedRuns.push(`9/${tower}/normal/21`);
  profile.records.runs++;
  assert.equal(nextGoal(profile, null, roster).target.dungeonId, tower);
  profile.records.appliedRuns.push(`10/${tower}/nightmare/7`);
  profile.records.runs++;
  assert.equal(nextGoal(profile, null, roster).target.dungeonId, 'starlit_garden');
  assert.equal(nextGoal(profile, null).target.screen, 'collection');

  profile.records.clears[tower].normal = 0;
  assert.deepEqual(nextGoal(profile, null, roster).target, { screen: 'dungeons', dungeonId: tower, difficulty: 'normal' });
});

test('Guardian ranks Arena over the Creation Tower and the new tutorial has no spring', () => {
  const profile = dreamClearProfile();
  const original = structuredClone(profile);
  const ranked = companionSpringRates(profile, roster, guardian);
  assert.deepEqual(ranked.slice(0, 2), [
    { dungeonId: arena, unlocked: true, percent: 2 },
    { dungeonId: tower, unlocked: true, percent: 20 / 31 }
  ]);
  assert.equal(ranked.find(rate => rate.dungeonId === 'dawn_forest').percent, 0);
  assert.deepEqual(profile, original);

  profile.unlockedDungeons = profile.unlockedDungeons.filter(id => id !== arena);
  assert.deepEqual(springRateIn(profile, guardian, arena), { dungeonId: arena, unlocked: false, percent: 2 });
  profile.ui.entry.legacy = true;
  assert.ok(springRateIn(profile, guardian, 'dawn_forest').percent > 0);
});

test('spring previews apply same-grade invitations, out-of-pool reservations and regional seals', () => {
  const profile = dreamClearProfile();
  const invite = 'storm_sage';
  profile.recruits[invite] = { bond: 0, since: 1 };
  assert.equal(springRateIn(profile, invite, arena).percent, 0);
  const invited = setExpeditionParty(profile, { lead: profile.lead, companions: [invite] });
  assert.ok(invited.announce.ok);
  assert.equal(springRateIn(invited.profile, invite, arena).percent, 20 / 11);
  assert.equal(springRateIn(invited.profile, guardian, arena).percent, 20 / 11);

  assert.equal(springRateIn(profile, guardian, ember).percent, 0);
  invited.profile.reserved = guardian;
  assert.ok(springRateIn(invited.profile, guardian, ember).percent > 0);
  invited.profile.records.clears.arena.normal = 1;
  const sealed = setSeals(invited.profile, arena, [guardian], roster);
  assert.ok(sealed.announce.ok);
  assert.equal(springRateIn(sealed.profile, guardian, arena).percent, 0);
  assert.equal(springRateIn(sealed.profile, invite, arena).percent, 2);
  assert.equal(springRateIn(sealed.profile, guardian, tower).percent, 20 / 31);
});

test('individual spring slot chances use the displayed grade rate for the same run', () => {
  const profile = dreamClearProfile();
  const run = createRun({ core, roster, profileView: startView(profile, arena), seed: 7 });
  assert.ok(chooseStartPick(run, run.pending.candidates[0]).ok);
  assert.ok(run.reserved);
  const original = structuredClone(run);
  const rates = ratesView(run);
  for (const id of run.pool) {
    const { percent, count } = rates.find(rate => rate.group === gradeOf(roster.card(id).grade));
    assert.equal(springDrawChance(run, id), percent / count, id);
  }
  assert.equal(springDrawChance(run, guardian), springRateIn(profile, guardian, arena).percent);
  assert.ok(springDrawChance(run, run.reserved) > 0);
  assert.deepEqual(run, original);

  delete run.drawRuleVersion;
  assert.equal(springDrawChance(run, run.reserved), 0);
  assert.equal(springDrawChance(run, run.bench[0]), 0);
  run.pool = [guardian];
  assert.equal(springDrawChance(run, guardian), 100);
  run.pool = [];
  assert.equal(springDrawChance(run, guardian), 0);
  assert.ok(ratesView(run).every(rate => rate.percent === 0 && rate.count === 0));

  const emptyRoster = { ...roster, allies: [], pool: () => [] };
  assert.ok(companionSpringRates(profile, emptyRoster, guardian).every(rate => rate.percent === 0));
});

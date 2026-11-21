import assert from 'node:assert/strict';
import test from 'node:test';
import * as Awakening from '../../src/engine/awakenings.js';
import * as Bridge from '../../src/engine/bridge.js';
import * as Meta from '../../src/engine/meta.js';
import * as Run from '../../src/engine/run.js';
import * as Save from '../../src/engine/save.js';
import { EVENTS } from '../../src/content/events.js';
import { DUNGEONS } from '../../src/content/dungeons.js';
import { ENTRY_FIRST_MAIN_ENEMY_HP, FIRST_MAIN_ASSIST, ROOM_MULTIPLIERS } from '../../src/content/tempo.js';
import { gradeOf } from '../../src/engine/roster.js';
import { applyDoorTempo } from '../../src/engine/rooms.js';
import { SESSION_KEY } from '../../src/ui/storage.js';
import { playRun } from '../../tools/sim.mjs';

const intro = 'dawn_forest';
const ember = 'ember_volcano';
const lateFeatures = ['difficultyChoice', 'regionRules', 'riskDoors', 'quirks', 'affixes', 'battleBlessing',
  'bets', 'altar', 'pricedEvents', 'springPick', 'fullReinforcement', 'prepEditing', 'missions', 'dailyRift'];

export function registerEntryTests({ core, roster, makeTempo, reach, advance, enter, settle, clear, ok, roundTrip, reviewTwoStorage }) {
  const introClear = () => {
    const profile = Meta.createProfile();
    const { run } = playRun(intro, 7, { profile, opening: 'stand', naive: true });
    return Meta.applyRunEnd(profile, run, { recruits: ['snow_rabbit'] }).profile;
  };
  const start = (profile, dungeonId = ember, seed = 7) =>
    makeTempo({ dungeonId, seed, profileView: Meta.startView(profile, dungeonId) });
  const newSpring = (options = {}) => {
    const run = reach(makeTempo(options), 3);
    enter(run);
    run.crystals = 10;
    return run;
  };
  const fillBench = (run, exclude = []) => {
    run.bench = [...roster.allies].filter(id => !exclude.includes(id)).slice(0, 6);
    run.joinOrder = run.bench.slice();
  };

  test('entry state is immutable, idempotent, validated, and settings-only saves stay new', () => {
    const blank = Meta.createProfile();
    let profile = Meta.markEntryStep(blank, 'retreat');
    assert.equal(Meta.markEntryStep(profile, 'retreat'), profile);
    profile = Meta.markTour(profile, 'spring');
    assert.equal(Meta.markTour(profile, 'spring'), profile);
    profile = Meta.skipTutorial(profile);
    assert.equal(Meta.skipTutorial(profile), profile);
    assert.deepEqual(profile.ui.entry, { v: 1, legacy: false, done: ['retreat'], tours: ['spring'], skipped: true });
    assert.deepEqual(Save.restoreProfile(Save.serializeProfile(profile)), profile);
    assert.deepEqual(Meta.featureFlags(profile), Meta.featureFlags(blank));
    assert.deepEqual(blank.ui.entry.done, []);
    const bad = structuredClone(profile);
    bad.ui.entry.tours.push('spring');
    assert.equal(Save.restoreProfile(bad), null);
    assert.throws(() => Save.serializeProfile(bad), /invalid_entry_state/);
    delete blank.ui.entry;
    blank.ui.settings = { speed: 2 };
    assert.equal(Save.restoreProfile(blank).ui.entry.legacy, false);
  });

  test('old progress and a standalone old active expedition migrate to open access', () => {
    for (const progress of [
      profile => { profile.records.runs = 1; profile.records.appliedRuns.push('old'); },
      profile => { profile.recruits.ash = { since: 1, bond: 0 }; },
      profile => profile.notebook.chapters.push(1),
      profile => { profile.records.clears[intro] = { normal: 1, nightmare: 0 }; }
    ]) {
      const old = Meta.createProfile();
      delete old.ui.entry;
      old.ui.wantedCompanionId = 'ash';
      progress(old);
      const restored = Save.restoreProfile(old);
      assert.equal(restored.ui.wantedCompanionId, 'ash');
      assert.equal(restored.ui.entry.legacy, true);
      assert.ok(Object.values(Meta.featureFlags(restored)).every(Boolean));
    }
    const old = Meta.createProfile();
    delete old.ui.entry;
    const run = reach(makeTempo({ dungeonId: intro }), 4);
    delete run.features;
    delete run.entryRulesVersion;
    delete run.drawRuleVersion;
    const storage = reviewTwoStorage();
    storage.setItem(SESSION_KEY, JSON.stringify({ version: 1, profile: old, run: JSON.parse(Save.serializeRun(run)) }));
    const restored = Save.createSaveStore(storage, { core, roster }).load();
    assert.equal(restored.profile.ui.entry.legacy, true);
    assert.equal(restored.run.features, undefined);
    assert.ok(restored.run.doors.some(door => door.type === 'spring'));
  });

  test('new intro opens only the treasure on B4 and the first main gates rules at every door', () => {
    const profile = Meta.createProfile();
    const lesson = reach(start(profile, intro), 4);
    assert.deepEqual(lesson.doors.map(door => door.type), ['treasure']);
    assert.equal(lesson.entryRulesVersion, 1);
    assert.ok(lesson.features.heirlooms && lesson.features.retreat && lesson.features.lastStand);
    const next = introClear();
    assert.ok(Meta.featureFlags(next).introCleared);
    assert.deepEqual(Meta.availableDungeons(next).find(dungeon => dungeon.id === ember).difficulties, ['easy']);
    assert.equal(Meta.setExpeditionParty(next, {}).announce.reason, 'prep_locked');
    assert.equal(Meta.setSeals(next, ember, [], roster).announce.reason, 'prep_locked');
    assert.equal(Meta.dailyRiftUnlocked(next), false);
    assert.equal(Meta.missionsView(next, roster).unlocked, false);
    for (const id of [ember, 'twilight_cathedral']) {
      const run = start(next, id);
      assert.equal(run.difficulty, 'easy');
      assert.equal(run.lead, 'snow_rabbit');
      assert.ok(lateFeatures.every(key => run.features[key] === false));
      for (let floor = 1; floor <= 8; floor++) {
        reach(run, floor);
        assert.equal(run.region, null);
        for (const door of run.doors) {
          assert.equal(door.region, null);
          assert.ok(!door.regionChoice && !door.quirk && !door.risk && !door.tempo?.blessing);
          assert.ok(!['altar', 'elite'].includes(door.type));
          assert.ok(door.enemies.every(enemy => !enemy.affixes?.length));
          if (door.type === 'wild') assert.equal(door.enemies.length, 1);
          if (floor === 1) {
            const enemy = door.enemies[0];
            const baseline = roster.wildOf(enemy.id.slice(5), DUNGEONS[id].tiers[0]).stats;
            assert.equal(enemy.stats.hp, Math.round(baseline.hp * (ROOM_MULTIPLIERS.wild[0] * ENTRY_FIRST_MAIN_ENEMY_HP)));
            assert.equal(enemy.stats.atk, Math.round(baseline.atk * ROOM_MULTIPLIERS.wild[1]));
          }
          if (door.type === 'event') {
            assert.ok(floor >= 5 && door.event?.choices.length);
            assert.ok(door.event.choices.every(choice => !choice.cost && choice.ops.every(op =>
              !['bet', 'altar', 'field', 'start', 'firstSurvivalPay', 'relic'].includes(op.type))));
          }
          if (door.enemies.length) {
            const branch = roundTrip(run);
            enter(branch, door.index);
            const options = Run.battleOptions(branch);
            assert.equal(options.region, null);
            assert.equal(options.bet, null);
            assert.deepEqual(options.blessings, []);
          }
        }
        if ([2, 6].includes(floor)) assert.ok(run.doors[0].tempo.lesson);
        if (floor === 4) assert.equal(run.doors[0].type, 'gate');
        if (floor === 8) assert.equal(run.doors[0].type, 'boss');
      }
    }
  });

  test('only first-main entry scales wild, gate and boss HP without changing attack', () => {
    const first = start(introClear());
    const legacy = makeTempo({ difficulty: 'easy' });
    const beforeEntryRules = { ...legacy, features: undefined };
    const variants = [first, legacy, beforeEntryRules];
    for (const [type, floor, [hp, attack]] of [
      ['wild', 1, ROOM_MULTIPLIERS.wild],
      ['gate', 4, FIRST_MAIN_ASSIST.gate],
      ['boss', 8, FIRST_MAIN_ASSIST[ember].boss]
    ]) {
      // Ember has its own wild tuning when region rules are active.
      for (const run of variants) {
        const door = { type, enemies: [{ stats: { hp: 10000, atk: 100, matk: 200 } }] };
        applyDoorTempo({ ...run, floor, lessonVersion: 0 }, roster, door);
        const hpMultiplier = run === first ? hp * ENTRY_FIRST_MAIN_ENEMY_HP : type === 'wild' ? 0.64 : hp;
        const attackMultiplier = run !== first && type === 'wild' ? 2.35 : attack;
        assert.deepEqual(door.enemies[0].stats, {
          hp: Math.round(10000 * hpMultiplier), atk: Math.round(100 * attackMultiplier), matk: Math.round(200 * attackMultiplier)
        });
      }
    }
  });

  test('the first main clear opens the next departure while the old expedition keeps its flags', () => {
    const profile = introClear();
    const expedition = start(profile);
    const inProgress = roundTrip(reach(expedition, 2));
    const returned = Meta.applyRunEnd(profile, clear(expedition)).profile;
    assert.ok(lateFeatures.every(key => Meta.featureFlags(returned)[key]));
    assert.equal(Meta.missionsView(returned, roster).unlocked, true);
    assert.equal(Meta.dailyRiftUnlocked(returned), true);
    assert.deepEqual(roundTrip(inProgress).features, expedition.features);
    assert.equal(reach(inProgress, 6).doors[1].type, 'wild');
    const restoredRules = new Set();
    for (let seed = 0; seed < 36; seed++) {
      const run = start(returned, seed % 2 ? ember : 'twilight_cathedral', seed);
      assert.equal(run.difficulty, 'normal');
      for (const floor of [1, 2, 3, 5, 6]) {
        reach(run, floor);
        for (const door of run.doors) {
          if (door.region) restoredRules.add('region');
          if (door.type === 'wild' && door.enemies.length > 1) restoredRules.add('companion');
          if (door.quirk) restoredRules.add('quirk');
          if (door.enemies.some(enemy => enemy.affixes?.length)) restoredRules.add('affix');
          if (door.tempo?.blessing) restoredRules.add('blessing');
          if (door.risk) restoredRules.add('risk');
          if (door.type === 'elite') restoredRules.add('elite');
          if (door.type === 'altar') restoredRules.add('altar');
          if (door.event?.choices.some(choice => choice.cost)) restoredRules.add('price');
          if (door.event?.choices.some(choice => choice.ops.some(op => op.type === 'bet'))) restoredRules.add('bet');
        }
      }
    }
    assert.deepEqual([...restoredRules].sort(), ['affix', 'altar', 'bet', 'blessing', 'companion', 'elite', 'price', 'quirk', 'region', 'risk']);
  });

  test('first main spring and reinforcement use the snapshotted simple variants', () => {
    const run = reach(start(introClear()), 1);
    assert.ok(new Set(run.bench).size >= 3);
    enter(run);
    const pending = settle(run).pending;
    assert.equal(pending.candidates.length, 1);
    const crystals = run.crystals;
    ok(Run.resolveReinforcement(run, { key: pending.key, id: pending.candidates[0] }));
    assert.equal(run.crystals, crystals);
    advance(run);
    fillBench(run);
    enter(run);
    assert.equal(settle(run).pending, null);
    advance(run);
    enter(run);
    assert.equal(Run.springPick(run).reason, 'spring_pick_locked');
    assert.equal(Run.getSpringOffer(run).reason, 'spring_pick_locked');
    assert.ok(Run.springDraw(run).ok);
  });

  test('the seed 1 intro spring distribution still includes owned, fallen and reserved IDs', () => {
    const run = reach(makeTempo({ dungeonId: intro, seed: 1 }), 4);
    enter(run);
    run.bench = ['siren', 'snow_rabbit', 'silver_rabbit', 'night_rabbit', 'sunflower'];
    run.fallen = ['ash'];
    run.reserved = 'aurora';
    run.crystals = 2;
    const draw = Awakening.ratesView(run, 'draw');
    const paid = Awakening.ratesView(run, 'pick');
    assert.deepEqual(draw.map(row => row.percent), [40, 30, 20, 10]);
    assert.deepEqual(paid.map(row => row.percent), [25, 30, 25, 20]);
    assert.equal(draw.at(-1).label, '전설군');
    for (const rates of [draw, paid]) {
      const allIds = rates.flatMap(row => Array(row.count).fill(row.percent / (row.count * 100)));
      assert.ok(Math.abs(allIds.reduce((sum, rate) => sum + rate, 0) - 1) < 1e-12);
    }
    delete run.drawRuleVersion;
    const old = Awakening.ratesView(run, 'draw');
    assert.deepEqual(old.map(row => row.count), [0, 0, 3, 4]);
    assert.deepEqual(old.map(row => row.percent), [0, 0, 20 / 30 * 100, 10 / 30 * 100]);
  });

  test('full-roster repeats boost or recall without sending anyone and stats apply once', () => {
    const run = newSpring();
    fillBench(run);
    const [first, owned] = run.joinOrder;
    const [dead, sent] = roster.allies.filter(id => !run.bench.includes(id));
    run.bench.reverse();
    run.pool = [owned];
    for (const stacks of [1, 2]) {
      assert.deepEqual(ok(Run.springDraw(run)).draw, { kind: 'boost', id: owned, targetId: owned, stacks });
    }
    run.fallen = [dead];
    run.released = [sent];
    for (const [id, stacks] of [[dead, 1], [sent, 2]]) {
      run.pool = [id];
      assert.deepEqual(ok(Run.springDraw(run)).draw, { kind: 'memory', id, targetId: first, stacks });
    }
    assert.equal(run.crystals, 6);
    assert.equal(run.bench.length, 6);
    assert.deepEqual(run.fallen, [dead]);
    assert.deepEqual(run.released, [sent]);
    const restored = roundTrip(run);
    advance(restored);
    restored.blessings[first] = 0.4;
    const party = [first, null, null];
    const prediction = Run.getBlessingView(restored, 0, party, first).stats;
    enter(restored, 0, party);
    const opts = Run.battleOptions(restored);
    function stats(options) {
      const battle = Bridge.create(core, options);
      battle.start();
      return battle.allyStats(0);
    }
    const base = stats({ ...opts, repeatStacks: {} });
    const boosted = stats(opts);
    for (const key of ['atk', 'matk']) assert.equal(boosted[key], Math.floor(base[key] * 1.2));
    for (const key of ['hp', 'def', 'mdef']) assert.equal(boosted[key], base[key]);
    assert.deepEqual(boosted, prediction);
  });

  test('a full ◆1 new draw waits across reload and moves a consumed shadow reservation', () => {
    let run = newSpring();
    const [id, alternative] = run.pool;
    fillBench(run, [id, alternative]);
    run.unchosen = [alternative];
    run.reserved = id;
    const replaceId = run.bench[0];
    run.pool = [id, alternative];
    for (let seed = 0; ; seed++) {
      run.rng.state = seed;
      if (Awakening.drawEncounter({ ...run, rng: { state: seed } }, roster) === id) break;
    }
    const receipt = ok(Run.springDraw(run));
    const { key } = receipt.pending;
    assert.equal(receipt.pending.kind, 'springDraw');
    assert.equal(receipt.id, id);
    assert.equal(run.crystals, 10);
    run = roundTrip(run);
    assert.equal(Run.springDraw(run).reason, 'no_waking');
    assert.equal(Run.commitSpringDraw(run, { key }).reason, 'roster_full');
    assert.deepEqual(ok(Run.commitSpringDraw(run, { key, replaceId })).draw, { kind: 'join', id, targetId: id, stacks: 0 });
    assert.equal(run.reserved, alternative);
    assert.equal(run.crystals, 9);
    assert.equal(run.bench.length, 6);
    assert.equal(Run.commitSpringDraw(run, { key, replaceId }).reason, 'invalid_spring_draw_key');
  });

  test('◆3 slots are fixed by key, allow repeated random results, and do not charge on refresh', () => {
    let run = newSpring();
    const invited = run.pool.find(id => !run.bench.includes(id));
    const [owned] = run.bench;
    run.companions = [invited];
    run.pool = [owned, invited];
    const offer = ok(Run.getSpringOffer(run));
    assert.deepEqual(offer.slots[0], { slotId: '1', id: invited, source: 'invite' });
    assert.ok(offer.slots.slice(1).every(slot => slot.source === 'random'));
    assert.deepEqual(ok(Run.getSpringOffer(roundTrip(run))), offer);
    const command = { offerKey: offer.offerKey, slotId: offer.slots[0].slotId };
    assert.equal(Run.commitSpringOffer(run, { ...command, slotId: 'missing' }).reason, 'invalid_spring_slot');
    run.bench = [owned, ...[...roster.allies].filter(id => id !== owned && id !== invited).slice(0, 5)];
    run.joinOrder = run.bench.slice();
    assert.equal(Run.commitSpringOffer(run, command).reason, 'roster_full');
    assert.deepEqual(ok(Run.getSpringOffer(run)), offer);
    assert.equal(run.crystals, 10);
    assert.equal(ok(Run.commitSpringOffer(run, { ...command, replaceId: run.bench.at(-1) })).draw.kind, 'join');
    assert.equal(run.crystals, 7);
    assert.equal(Run.commitSpringOffer(run, command).ok, false);
    run.pool = [owned];
    const next = ok(Run.getSpringOffer(run));
    assert.notEqual(next.key, offer.key);
    assert.deepEqual(next.candidates, [owned, owned, owned]);
    assert.ok(next.slots.every(slot => slot.source === 'random'));
    assert.equal(new Set(next.slots.map(slot => slot.slotId)).size, 3);
    assert.equal(Run.commitSpringOffer(run, { key: next.key, id: owned }).reason, 'ambiguous_spring_slot');
    run = roundTrip(run);
    assert.equal(ok(Run.commitSpringOffer(run, { key: next.key, slotId: '2' })).draw.kind, 'boost');
    assert.equal(run.crystals, 4);
  });

  test('deceased invitations fall back to random and prepaid old offers retain their payment', () => {
    const run = newSpring();
    const invited = run.pool.find(id => !run.bench.includes(id));
    run.companions = [invited];
    run.fallen.push(invited);
    assert.ok(ok(Run.getSpringOffer(run)).slots.every(slot => slot.source === 'random'));
    const legacy = newSpring({ lessonVersion: 0 });
    delete legacy.drawRuleVersion;
    const original = ok(Run.springPick(legacy));
    const restored = roundTrip(legacy);
    const offer = ok(Run.getSpringOffer(restored));
    assert.equal(offer.alreadyPaid, true);
    assert.deepEqual(offer.candidates, original.candidates);
    assert.equal(ok(Run.commitSpringOffer(restored, { key: offer.key, slotId: offer.slots[0].slotId })).charged, 0);
    assert.equal(restored.crystals, 7);
  });

  test('random event replacement can turn the departed character into a memory', () => {
    const run = reach(makeTempo(), 5);
    const target = 'kobold';
    const ally = run.bench.find(id => id !== target);
    run.bench = [target, ally];
    run.joinOrder = [target, ally];
    run.pool = [target];
    run.doors[0].event = EVENTS.find(event => event.id === 'kobold_boot_exchange');
    enter(run);
    const result = ok(Run.chooseEvent(run, 'exchange', target));
    assert.deepEqual(result.effects[1].draw, { kind: 'memory', id: target, targetId: ally, stacks: 1 });
    assert.deepEqual(run.bench, [ally]);
    assert.ok(run.released.includes(target));
  });

  test('entry prep combines start, invitations, exclusions and static appearance regions', () => {
    const initial = introClear();
    const profile = Meta.applyRunEnd(initial, clear(start(initial))).profile;
    profile.records.clears[ember].normal = 1;
    const base = roster.pool(DUNGEONS[ember].pool);
    const outside = roster.allies.find(id => !base.includes(id));
    profile.recruits[outside] = { since: 2, bond: 0 };
    const { profile: invited, announce } = Meta.setExpeditionParty(profile, { lead: 'snow_rabbit', companions: [outside] });
    ok(announce);
    const view = Meta.prepView(invited, ember, roster);
    assert.equal(view.start.id, 'snow_rabbit');
    assert.deepEqual(view.invite.ids, [outside]);
    assert.ok(view.pool.some(row => row.id === outside && row.added && row.invited));
    assert.ok(!Meta.appearanceRegions(roster, outside).includes(ember));
    assert.equal(start(invited).bench[0], view.start.id);
    const lead = base.find(id => base.some(other => other !== id && gradeOf(roster.card(other).grade) === gradeOf(roster.card(id).grade)));
    invited.recruits[lead] ??= { since: 2, bond: 0 };
    invited.seals[ember] = [lead];
    invited.lead = lead;
    const conflict = Meta.prepView(invited, ember, roster).pool.find(row => row.id === lead);
    assert.ok(conflict.start && conflict.excluded);
    assert.equal(conflict.reason, '시작 동료는 제외할 수 없습니다');
    assert.equal(start(invited).pool.includes(lead), false);
    const unsealed = Meta.setSeals(invited, ember, [], roster);
    ok(unsealed.announce);
    assert.equal(Meta.setSeals(unsealed.profile, ember, [lead], roster).announce.reason, 'lead_excluded');
    const onePerGrade = base.filter((id, index) => base.findIndex(other => gradeOf(roster.card(other).grade) === gradeOf(roster.card(id).grade)) === index);
    const limited = { ...roster, pool: () => onePerGrade };
    const last = onePerGrade.find(id => id !== lead);
    assert.equal(Meta.prepView(unsealed.profile, ember, limited).pool.find(row => row.id === last).reason, '등급마다 한 명은 남겨야 합니다');
    assert.equal(Meta.setSeals(unsealed.profile, ember, [last], limited).announce.reason, 'empty_grade');
  });

  test('battle results record the borrowed party before clearing it and survive serialization', () => {
    for (const falls of [false, true]) {
      const run = start(Meta.createProfile(), intro);
      enter(run);
      const result = settle(run, {
        survivors: [!falls, true, true], retreated: [!falls, false, false],
        heirloomsGained: falls ? [{ from: 'ash', to: 'snow_rabbit', name: '아마겟돈' }] : []
      });
      assert.equal(result.lastBattleResult, run.lastBattleResult);
      assert.deepEqual(run.bench, []);
      assert.deepEqual(run.lastBattleResult, {
        v: 1, floor: 1, roomType: 'borrowed', outcome: 'win', wiped: false,
        fallenIds: falls ? ['ash'] : [], survivorIds: falls ? ['snow_rabbit', 'silver_rabbit'] : ['ash', 'snow_rabbit', 'silver_rabbit'],
        transfers: falls ? [{ fromId: 'ash', toId: 'snow_rabbit', skillName: '아마겟돈' }] : [],
        rewardDelta: { crystals: 0, relicIds: [] }
      });
      assert.deepEqual(roundTrip(run).lastBattleResult, result.lastBattleResult);
    }
    const boss = reach(makeTempo(), 8);
    boss.bench = boss.bench.slice(0, 3);
    enter(boss);
    const result = settle(boss, { survivors: [false, false, false] });
    assert.equal(result.lastBattleResult.outcome, 'win');
    assert.equal(result.lastBattleResult.wiped, true);
    assert.deepEqual(Run.runRewards(roundTrip(boss)).recruitable, []);
    const loss = reach(makeTempo(), 1);
    loss.bench = loss.bench.slice(0, 3);
    enter(loss);
    const lost = settle(loss, { outcome: 'lose', survivors: [false, false, false], enemyDowns: [] });
    assert.equal(lost.wiped, false);
    assert.equal(roundTrip(loss).lastBattleResult.wiped, true);
    const elite = reach(makeTempo(), 6);
    enter(elite, 1);
    const before = elite.crystals;
    const reward = settle(elite);
    assert.deepEqual(roundTrip(elite).lastBattleResult.rewardDelta,
      { crystals: elite.crystals - before, relicIds: reward.relics });
  });

  test('seed 7 recruits five surviving fighters and old pending recruitment retains its list', () => {
    const profile = Meta.createProfile();
    const { run, end } = playRun(intro, 7, { profile, opening: 'stand', naive: true });
    const gate = ['night_rabbit', 'snow_rabbit', 'silver_rabbit'];
    assert.deepEqual(end.recruitable, [...gate, 'aurora', 'sunflower']);
    assert.deepEqual(end.recruitTags, { night_rabbit: 'gate', snow_rabbit: 'gate', silver_rabbit: 'gate', aurora: 'bench', sunflower: 'bench' });
    const result = Meta.applyRunEnd(profile, run, { recruits: ['aurora'] });
    ok(result.announce);
    assert.deepEqual(result.announce.bonds, []);
    assert.equal(result.profile.recruits.aurora.bond, 0);
    assert.equal(Meta.applyRunEnd(result.profile, run).announce.reason, 'already_applied');
    delete run.rewardRuleVersion;
    run.pending.recruitable = gate;
    delete run.pending.recruitTags;
    const old = roundTrip(run);
    assert.deepEqual(Run.finishRun(old).recruitable, gate);
    assert.equal(Meta.applyRunEnd(profile, old, { recruits: ['aurora'] }).announce.reason, 'invalid_recruits');
    old.pending = null;
    old.recruited = ['night_rabbit'];
    old.released.push('aurora');
    assert.deepEqual(Run.runRewards(old).recruitable, ['snow_rabbit', 'silver_rabbit', 'sunflower']);
  });

  test('a discarded formation and stale confirmation leave the unentered door untouched', () => {
    const run = reach(makeTempo({ seed: 0 }), 2);
    const before = Save.serializeRun(run);
    const party = Run.getTempoView(run, 1).party;
    assert.equal(Object.hasOwn(Run.getTempoView(run, 1), 'suggestedParty'), false);
    assert.equal(Run.enterBattleDoor(run, { floor: 1, index: 1, partyIds: party }).reason, 'invalid_door');
    assert.equal(Save.serializeRun(run), before);
    const direct = roundTrip(run);
    ok(Run.enterBattleDoor(run, { floor: 2, index: 0, partyIds: party }));
    ok(Run.enterBattleDoor(direct, { floor: 2, index: 0, partyIds: party }));
    assert.equal(Save.serializeRun(run), Save.serializeRun(direct));
    assert.equal(Run.enterBattleDoor(run, { floor: 2, index: 0, partyIds: party }).reason, 'invalid_door');
  });
}

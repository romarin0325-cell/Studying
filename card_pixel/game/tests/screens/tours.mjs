import assert from 'node:assert/strict';
import { AFFIXES } from '../../src/content/affixes.js';
import { DUNGEONS } from '../../src/content/dungeons.js';
import { INTRO } from '../../src/content/intro.js';
import { QUIRKS } from '../../src/content/quirks.js';
import { REGIONS } from '../../src/content/regions.js';
import * as Meta from '../../src/engine/meta.js';
import { openingModel } from '../../src/engine/opening.js';
import { eventChoices, grantRelic, RELIC_LIMIT } from '../../src/engine/rooms.js';
import * as Run from '../../src/engine/run.js';
import * as Save from '../../src/engine/save.js';
import { TERMS } from '../../src/ui/glossary.js';
import { battleLog } from '../../src/ui/battle/log.js';
import { checkCoachPlacement } from './coach.mjs';

const lines = {
  heirloom: '쓰러진 동료가 남긴 기술이야. 전투에서 한 번, MP 없이 쓸 수 있어.',
  'last-stand': '마지막 한 명은 공격·마공 ×1.5, 치명타율 +25%p를 받아.',
  relic: '이 유물은 이번 원정 동안 적용돼.',
  'relic-replace': '네 칸이 찼어. 새 유물로 바꿀 칸을 골라.',
  'spring-draw': '결정 1개로 한 번 뽑아. 새 동료가 합류하거나, 강화 또는 기억을 얻어.',
  'spring-pick': '후보 3칸은 무료로 보고, 한 명을 고를 때 결정 3개를 써.',
  preparation: TERMS.springInvite.firstUse,
  difficulty: '여정은 보통 난이도야. 이 지역을 여정으로 클리어하면 악몽이 열려.',
  altar: '세 번까지 굴려. 받으면 그 동료의 기존 축복을 바꿔.',
  wager: '조건을 달성하고 그 전투에서 이기면 보상을 받아.',
  mission: '이번 주나 달의 목표를 달성하면 동료를 영입하거나 완료 도장을 받아.',
  'daily-rift': '오늘은 모두 같은 대여 동료로 시작해. 첫 도전과 연습은 따로 기록해.'
};

export function createTourCases({
  core, roster, sessionKey, command, makeRun, startBattle, settleWin, storedSession, snowRabbitProfile,
  mainReturn, applyReturn, enterObservatory, openBattle, battleIdle, riftDate, riftFixture
}) {
  const dungeonId = 'ember_volcano';
  const introProfile = () => Meta.markEntryStep(snowRabbitProfile(7, Meta.createProfile()), 'departure');
  const unlockedProfile = () => {
    const profile = introProfile();
    return applyReturn(profile, mainReturn(profile, dungeonId, 'easy')).profile;
  };
  const expedition = (profile, options) => {
    const id = options.dungeonId ?? dungeonId;
    return makeRun({ tempoVersion: 2, profileView: Meta.startView(profile, id), ...options });
  };

  function tour(id, { profile, run, selector, open, proof, previous = [], now, daily, activate, after, line = lines[id] }) {
    // Seed only the earlier guides that would take precedence on the same screen.
    assert.equal(profile.ui.entry.legacy, false);
    assert.deepEqual(profile.ui.entry.tours, []);
    const session = storedSession({ profile: previous.reduce(Meta.markTour, profile), run });
    const savedEntry = JSON.parse(session).profile.ui.entry;
    assert.deepEqual(savedEntry.tours, previous);
    assert.equal(savedEntry.legacy, false);
    assert.ok(line && selector);
    return {
      session, now, daily, proof: `${proof} · ${selector}`,
      async show(page, tools) {
        const { text, capture } = tools;
        const step = `tour-${id}`;
        const coach = page.locator('.coach:not([hidden])');
        const layer = page.locator(`.coach:not([hidden])[data-coach-step="${step}"]`);
        const target = page.locator(selector).first();
        const savedTours = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).profile.ui.entry.tours, sessionKey);
        assert.deepEqual(await savedTours(), previous);
        await open(page);
        try {
          await layer.waitFor();
        } catch (error) {
          const active = await coach.getAttribute('data-coach-step', { timeout: 100 }).catch(() => null);
          const state = await target.evaluate(node => ({
            rendered: !!node.getClientRects().length, disabled: !!node.disabled, hidden: node.hidden
          }), null, { timeout: 100 }).catch(() => 'missing');
          throw new Error(`${step} did not open · active coach ${active ?? 'none'} · ${selector} ${JSON.stringify(state)}`, { cause: error });
        }
        assert.equal(await coach.count(), 1);
        await text(layer.locator('.coach-line'), line, { exact: true });
        await capture();
        await checkCoachPlacement(page, step, selector);
        if (activate) await activate(page, page.locator(selector), tools);
        else await layer.getByRole('button', { name: '알겠어', exact: true }).click();
        await layer.waitFor({ state: 'hidden' });
        assert.deepEqual(await savedTours(), [...previous, id]);
        await after?.(page, tools);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await open(page);
        if (!activate) await target.waitFor();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await layer.count(), 0, `${step} reappeared after reopening ${selector}`);
        assert.deepEqual(await savedTours(), [...previous, id]);
      }
    };
  }

  async function resume(page) {
    const button = page.locator('#hub.on #meta-depart');
    if (await button.isVisible()) await button.click();
  }

  async function battleEvent(page, event) {
    await battleIdle(page);
    assert.ok(await page.evaluate(type => window.__game.B.all.some(entry => entry.t === type), event),
      `Battle did not emit ${event}`);
  }

  function heirloom(restored = false) {
    const profile = Meta.skipTutorial(Meta.createProfile());
    const run = expedition(profile, { dungeonId: 'dawn_forest', seed: 7 });
    const battle = startBattle(run, { party: INTRO.party });
    const events = battle.act(openingModel(battle).stand.optionIndex);
    assert.ok(events.some(event => event.t === 'heirloom'));
    assert.ok(battle.options().some(option => option.heirloom && option.usable));
    if (restored) {
      const skill = battle.options().find(option => option.heirloom && option.usable);
      events.push(...battle.act(skill.index));
      assert.equal(battle.outcome, 'win');
      command(Run.settleBattle, run, battle.summary());
      return tour('heirloom', {
        profile, run, selector: '#result.on [data-coach="heirloom-transfer"]', open: resume,
        proof: 'Restored result targets the Snow Rabbit and Armageddon transfer line',
        after: (page, { text }) => text(page.locator('#result [data-coach="heirloom-transfer"]'), '눈토끼가 아마겟돈을 물려받았습니다.')
      });
    }
    return tour('heirloom', {
      profile, run, selector: '#battle.on #b-heir.on', proof: 'Ash falls and Snow Rabbit inherits a usable skill',
      async open(page) {
        await battleIdle(page);
        await page.locator('#battle.on .opening-choice.stand').click();
        await battleEvent(page, 'heirloom');
      },
      async after(page, { text }) {
        await text(page.locator('#b-heir.on .heirloom-use'), 'MP 0 · 1회', { exact: true });
      }
    });
  }

  function lastStand(restored = false) {
    const profile = introProfile();
    const run = expedition(profile, { seed: 7 });
    const battle = startBattle(run, { party: run.bench.slice(0, 2) });
    const events = battle.retreat();
    const triggered = events.find(event => event.t === 'laststand');
    assert.ok(triggered);
    assert.ok(battle.options().some(option => option.index === 0 && option.usable));
    if (restored) {
      const survivor = run.room.party[triggered.who.idx];
      const summary = battle.summary();
      settleWin(run, { survivors: summary.survivors, retreated: summary.retreated, lastStands: summary.lastStands });
      run.lastBattleLog = battleLog(events, run.room.party, run.room.enemies);
      assert.equal(run.lastBattleLog.flatMap(turn => turn.rows).find(row => row.kind === 'last-stand').faces[0].id, survivor);
      return tour('last-stand', { profile, run, selector: '#result.on [data-coach="last-stand"]', open: resume,
        proof: `Restored victory highlights ${survivor}'s last-stand chip` });
    }
    return tour('last-stand', {
      profile, run, selector: '#battle.on #pa-chips [data-coach="last-stand"]', proof: 'A retreat leaves one fighter in a two-person battle',
      async open(page) {
        await resume(page);
        await openBattle(page);
        const retreat = page.locator('#battle.on #b-retreat');
        await retreat.click();
        await retreat.click();
        await battleEvent(page, 'laststand');
      }
    });
  }

  function treasure(replace) {
    const profile = introProfile();
    const run = expedition(profile, { seed: 1, floor: 5 });
    const door = run.doors.find(door => door.type === 'treasure');
    command(Run.chooseDoor, run, door.index);
    assert.ok(run.room.relic);
    if (replace) {
      const equipment = ['double_attack', 'reverse', 'support_boost', 'buff_overload', 'ice_break']
        .filter(id => id !== run.room.relic).slice(0, RELIC_LIMIT);
      for (const id of equipment) assert.equal(grantRelic(run, id).equipped, true);
      assert.equal(run.relics.length, RELIC_LIMIT);
      const { pending } = command(Run.takeTreasure, run);
      assert.deepEqual(pending.replace, equipment);
    } else {
      const copy = Save.restoreRun(Save.serializeRun(run), { core, roster });
      assert.equal(command(Run.takeTreasure, copy).relic.equipped, true);
    }
    return tour(replace ? 'relic-replace' : 'relic', {
      profile, run, open: resume,
      selector: replace ? '#treasure.on [data-replace]' : '#treasure.on #b-equip',
      proof: replace ? 'Selecting the fourth relic slot completes the tour and opens its comparison' : 'Equipping the first treasure completes its tour',
      async activate(page, targets) {
        if (replace) {
          assert.equal(await targets.count(), 4);
          const slot = targets.last();
          await slot.click();
          assert.equal(await slot.getAttribute('aria-pressed'), 'true');
          assert.equal(await page.locator('#b-equip').isEnabled(), true);
        } else {
          await targets.click();
          assert.ok(await page.evaluate(id => window.__game.run.relics.includes(id), run.room.relic));
        }
      }
    });
  }

  function service(id, type, selector, proof, verify, options = {}, setup) {
    const profile = unlockedProfile();
    const run = expedition(profile, { seed: 7, floor: 3 });
    const door = run.doors.find(door => door.type === type);
    command(Run.chooseDoor, run, door.index);
    setup?.(run);
    const copy = Save.restoreRun(Save.serializeRun(run), { core, roster });
    verify(copy);
    return tour(id, { profile, run, selector, proof, ...options, open: resume });
  }

  function prepare(id, selector, proof, previous, line) {
    const profile = unlockedProfile();
    const flags = Meta.featureFlags(profile);
    assert.ok(flags.prepEditing && flags.difficultyChoice && flags.regionRules);
    assert.ok(Meta.availableDungeons(profile).find(entry => entry.id === dungeonId)?.difficulties.includes('normal'));
    const { pool } = Meta.prepView(profile, dungeonId, roster);
    assert.ok(pool.length);
    if (id === 'preparation') {
      const candidate = pool.find(row => !row.start && row.base && !profile.recruits[row.id]);
      assert.ok(candidate);
      profile.recruits[candidate.id] = { bond: 0, since: profile.records.runs };
      assert.ok(Meta.prepView(profile, dungeonId, roster).pool.find(row => row.id === candidate.id).canInvite);
      selector = `#sheet.on [data-prep-id="${candidate.id}"][data-can-invite]`;
    }
    return tour(id, {
      profile, selector, proof, previous, line,
      async open(page) {
        await enterObservatory(page);
        const hub = page.locator('#hub.on');
        // After reload, the title automatically restores the saved open preparation sheet.
        if (await page.locator('#sheet.on .meta-prep').count()) return;
        await hub.locator('#meta-telescope').click();
        await page.locator(`#dungeons.on [data-dungeon="${dungeonId}"]`).click();
      }
    });
  }

  function modifiedDoor(id) {
    const profile = unlockedProfile();
    const run = expedition(profile, { seed: 7, floor: 2 });
    const door = run.doors[0];
    assert.ok(run.features.quirks && run.features.affixes && door.enemies.length);
    door.quirk = 'overheat';
    door.enemies[0].affixes = ['tough', 'leech'];
    const rules = id === 'quirk' ? [QUIRKS.overheat] : [AFFIXES.tough, AFFIXES.leech];
    return tour(id, {
      profile, run, open: resume, selector: `#map.on .door-entry[data-door="${door.index}"]`,
      previous: id === 'affix' ? ['quirk'] : [],
      line: rules.map(rule => rule.name + ' · ' + rule.desc).join(' / '), proof: `Separate acknowledgement for ${rules.map(rule => rule.name).join(', ')}`
    });
  }

  function regionBattle() {
    const profile = unlockedProfile();
    const run = expedition(profile, { seed: 7 });
    startBattle(run);
    const region = REGIONS[run.room.region.id];
    assert.ok(region && run.features.regionRules);
    return tour('region', {
      profile, run, selector: '#battle.on #b-field', line: region.desc, proof: 'Battlefield opens the actual regional rule',
      async open(page) { await resume(page); await openBattle(page); },
      async after(page, { text }) {
        await text(page.locator('#b-field'), '전장', { exact: true });
        assert.equal(await page.locator('#b-field').getAttribute('aria-label'), '전장·유물');
        await page.locator('#b-field').click();
        await text(page.locator('#sheet.on #sh-body'), region.desc);
      }
    });
  }

  function regionBattleMap() {
    const profile = unlockedProfile();
    const run = expedition(profile, { seed: 7, floor: 2 });
    const door = run.doors.find(door => door.enemies.length && REGIONS[door.region?.id]);
    assert.ok(door);
    return tour('region', {
      profile, run, previous: ['quirk', 'affix'], open: resume,
      selector: `#map.on .door-entry[data-door="${door.index}"]`,
      line: REGIONS[door.region.id].desc, proof: 'Regional guidance highlights a battle door'
    });
  }

  function regionServiceMap() {
    const profile = unlockedProfile();
    const run = expedition(profile, { seed: 7, floor: 3 });
    assert.ok(run.doors.every(door => REGIONS[door.region?.id] && !door.enemies.length));
    return {
      session: storedSession({ profile, run }), proof: 'No region tour on a map with only service doors',
      async show(page) {
        await resume(page);
        await page.locator('#map.on').waitFor();
        assert.equal(await page.locator('.coach[data-coach-step="tour-region"]').count(), 0);
      }
    };
  }

  function wager() {
    const profile = unlockedProfile();
    const run = expedition(profile, { dungeonId: 'starlit_garden', seed: 7, floor: 3 });
    command(Run.chooseDoor, run, run.doors.find(door => door.type === 'event').index);
    const choice = eventChoices(run, core, roster).find(choice => choice.enabled && choice.ops.some(op => op.type === 'bet'));
    assert.ok(run.features.bets && choice, 'Expected an enabled floor 3 wager');
    const copy = Save.restoreRun(Save.serializeRun(run), { core, roster });
    command(Run.chooseEvent, copy, choice.id);
    assert.ok(copy.nextBattle?.bet);
    return tour('wager', {
      profile, run, open: resume, selector: `#event.on [data-choice="${choice.id}"]`,
      proof: `Seed ${run.seed} · ${run.room.event.name} · ${choice.id}`
    });
  }

  function mission() {
    const profile = unlockedProfile();
    const view = Meta.missionsView(profile, roster, new Date(...riftDate));
    assert.ok(Meta.featureFlags(profile).missions && view.unlocked && view.current[0]?.kind === 'weekly');
    assert.equal(view.claimable.length, 0);
    const { key, target } = view.current[0];
    profile.missions.periods[key] = { gates: target, regionIds: [], state: 'claimed', offerOrder: [], claimedId: null };
    return tour('mission', {
      profile, now: riftDate, selector: '#notebook.on [data-mission-guide="weekly"]', proof: 'No recruits remained for the completed weekly mission',
      async open(page) {
        await enterObservatory(page);
        await page.locator('#hub.on [data-meta-page="notebook"]').click();
      },
      after: (page, { text }) => text(page.locator('[data-mission-guide="weekly"]'), '완료 도장')
    });
  }

  function dailyRift() {
    const profile = unlockedProfile();
    assert.ok(Meta.dailyRiftUnlocked(profile));
    return tour('daily-rift', {
      profile, now: riftDate, selector: '#sheet.on #meta-daily-start', proof: 'First main clear unlocks an unused official rift attempt',
      async open(page) {
        await enterObservatory(page);
        await page.locator('#hub.on #meta-daily-rift').click();
      }
    });
  }

  function savedRift() {
    const profile = unlockedProfile();
    const fixture = riftFixture(profile);
    fixture.start();
    const { now, daily } = fixture.page(null, [2026, 10, 22, 0, 0, 0]);
    return tour('daily-rift', {
      profile, now, daily, selector: '#sheet.on #meta-rift-resume', proof: 'Coach identifies the saved 11.21 rift on 11.22',
      line: '11.21 균열은 저장한 대여 동료로 이어가. 첫 도전과 연습은 따로 기록해.',
      async open(page) {
        await enterObservatory(page);
        await page.locator('#hub.on #meta-daily-rift').click();
      }
    });
  }

  return {
    'tour-heirloom': () => heirloom(),
    'tour-heirloom-result': () => heirloom(true),
    'tour-last-stand': () => lastStand(),
    'tour-last-stand-result': () => lastStand(true),
    'tour-relic': () => treasure(false),
    'tour-relic-replace': () => treasure(true),
    'tour-spring-draw': () => service('spring-draw', 'spring', '#spring.on #b-draw', 'Floor 3 one-crystal draw', run =>
      command(Run.springDraw, run), {
      async after(page, { text }) {
        await text(page.locator('#b-draw'), TERMS.spring.detail, { exact: true });
        await page.locator('.spring-rates summary').first().click();
        await text(page.locator('.spring-rates').first(), TERMS.memory.detail);
      }
    }),
    'tour-spring-pick': () => service('spring-pick', 'spring', '#spring.on #b-pick', 'Floor 3 free preview of the three-crystal offer', run => {
      assert.ok(run.features.springPick && run.crystals >= Run.COST.pick);
      assert.equal(command(Run.getSpringOffer, run).slots.length, 3);
    }, {
      previous: ['spring-draw'],
      async activate(page, target) {
        const crystals = await page.evaluate(() => window.__game.run.crystals);
        await target.click();
        assert.equal(await page.locator('#spring.on [data-slot-id]').count(), 3);
        assert.equal(await page.evaluate(() => window.__game.run.crystals), crystals);
      }
    }),
    'tour-preparation': () => prepare('preparation', null, 'First editable expedition roster with a real spring invite'),
    'tour-difficulty': () => prepare('difficulty', '#sheet.on [data-difficulty="normal"]', 'Journey difficulty in preparation', ['preparation']),
    'tour-region': () => prepare('region', '#sheet.on #meta-region-rule', 'Ember Volcano regional rule in preparation',
      ['preparation', 'difficulty'], REGIONS[DUNGEONS[dungeonId].region.id].desc),
    'tour-region-battle': regionBattle,
    'tour-region-map': regionBattleMap,
    'tour-region-service-map': regionServiceMap,
    'tour-quirk': () => modifiedDoor('quirk'),
    'tour-affix': () => modifiedDoor('affix'),
    'tour-altar': () => service('altar', 'altar', '#altar.on #b-roll', 'Floor 3 altar with a living party', run =>
      command(Run.altarRoll, run), {
      async after(page, { text }) {
        await page.locator('#b-roll').click();
        await text(page.locator('#slot'), '기존 축복 +100%');
        await text(page.locator('#slot strong'), /새 축복 \+\d+%/);
      }
    }, run => { for (const id of run.bench) run.blessings[id] = 1; }),
    'tour-wager': wager,
    'tour-mission': mission,
    'tour-daily-rift': dailyRift,
    'tour-daily-rift-resume': savedRift
  };
}

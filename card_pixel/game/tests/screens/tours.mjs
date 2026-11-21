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

const lines = {
  heirloom: '쓰러진 동료가 남긴 기술이야. 전투에서 한 번, MP 없이 쓸 수 있어.',
  'last-stand': '마지막 한 명은 공격·마공 ×1.5, 치명타율 +25%p를 받아.',
  relic: '이 유물은 이번 원정 동안 적용돼.',
  'relic-replace': '네 칸이 찼어. 새 유물로 바꿀 칸을 골라.',
  'spring-draw': '결정 1개로 한 번 뽑아. 이미 함께라면 강해져.',
  'spring-pick': '후보 3칸은 무료로 보고, 한 명을 고를 때 결정 3개를 써.',
  preparation: TERMS.springInvite.firstUse,
  difficulty: '여정은 보통 난이도야. 이 지역을 여정으로 클리어하면 악몽이 열려.',
  altar: '제단을 굴리면 동료 한 명이 이번 원정 동안 강해져.',
  wager: '다음 전투에서 적힌 조건을 달성하면 보상을 받아.',
  mission: '이번 주나 달의 목표를 달성하면 동료를 영입할 수 있어.',
  'daily-rift': '오늘은 모두 같은 대여 동료로 시작해. 첫 도전과 연습은 따로 기록해.'
};

function contains(outer, inner) {
  return outer.x <= inner.x && outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width && outer.y + outer.height >= inner.y + inner.height;
}

async function checkPlacement(page, layer, target) {
  const [box, hole, bubble] = await Promise.all([
    target.boundingBox(), layer.locator('.coach-ring').boundingBox(), layer.locator('.coach-say').boundingBox()
  ]);
  assert.ok(box?.width && box.height && hole?.width && hole.height && bubble?.width && bubble.height,
    'Expected nonempty target, coach hole and bubble');
  const edges = ({ x, y, width, height }) => [x, y, x + width, y + height];
  assert.ok(edges(hole).every((edge, i) => Math.abs(edge - edges(box)[i]) <= 8) &&
    hole.x < box.x + box.width && box.x < hole.x + hole.width &&
    hole.y < box.y + box.height && box.y < hole.y + hole.height,
    `Coach hole ${JSON.stringify(hole)} does not match target ${JSON.stringify(box)} within 8px`);
  const viewport = { x: 0, y: 0, ...page.viewportSize() };
  assert.ok(contains(viewport, bubble), `Coach bubble ${JSON.stringify(bubble)} extends past ${viewport.width}×${viewport.height}`);
}

export function createTourCases({
  core, roster, sessionKey, command, makeRun, startBattle, storedSession, snowRabbitProfile,
  mainReturn, applyReturn, enterObservatory, openBattle, battleIdle, riftDate
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

  function tour(id, { profile, run, selector, open, proof, previous = [], now, line = lines[id] }) {
    // Seed only the earlier guides that would take precedence on the same screen.
    assert.equal(profile.ui.entry.legacy, false);
    assert.deepEqual(profile.ui.entry.tours, []);
    const session = storedSession({ profile: previous.reduce(Meta.markTour, profile), run });
    const savedEntry = JSON.parse(session).profile.ui.entry;
    assert.deepEqual(savedEntry.tours, previous);
    assert.equal(savedEntry.legacy, false);
    assert.ok(line && selector);
    return {
      session, now, proof: `${proof} · ${selector}`,
      async show(page, { text, capture }) {
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
        await checkPlacement(page, layer, target);
        const next = layer.getByRole('button', { name: '알겠어', exact: true });
        await next.click();
        await coach.waitFor({ state: 'hidden' });
        assert.deepEqual(await savedTours(), [...previous, id]);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await open(page);
        await target.waitFor();
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

  function heirloom() {
    const profile = Meta.skipTutorial(Meta.createProfile());
    const run = expedition(profile, { dungeonId: 'dawn_forest', seed: 7 });
    const battle = startBattle(run, { party: INTRO.party });
    const events = battle.act(openingModel(battle).stand.optionIndex);
    assert.ok(events.some(event => event.t === 'heirloom'));
    assert.ok(battle.options().some(option => option.heirloom && option.usable));
    return tour('heirloom', {
      profile, run, selector: '#battle.on #b-heir.on', proof: 'Ash falls and Snow Rabbit inherits a usable skill',
      async open(page) {
        await battleIdle(page);
        await page.locator('#battle.on .opening-choice.stand').click();
        await battleEvent(page, 'heirloom');
      }
    });
  }

  function lastStand() {
    const profile = introProfile();
    const run = expedition(profile, { seed: 7 });
    const battle = startBattle(run, { party: run.bench.slice(0, 2) });
    const events = battle.retreat();
    assert.ok(events.some(event => event.t === 'laststand'));
    assert.ok(battle.options().some(option => option.index === 0 && option.usable));
    return tour('last-stand', {
      profile, run, selector: '#battle.on #acts .act[data-i="0"]', proof: 'A retreat leaves one fighter in a two-person battle',
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
      proof: replace ? 'Four equipped relics and a pending treasure replacement' : 'First treasure relic can be equipped'
    });
  }

  function service(id, type, selector, proof, verify, previous) {
    const profile = unlockedProfile();
    const run = expedition(profile, { seed: 7, floor: 3 });
    const door = run.doors.find(door => door.type === type);
    command(Run.chooseDoor, run, door.index);
    const copy = Save.restoreRun(Save.serializeRun(run), { core, roster });
    verify(copy);
    return tour(id, { profile, run, selector, proof, previous, open: resume });
  }

  function prepare(id, selector, proof, previous, line) {
    const profile = unlockedProfile();
    const flags = Meta.featureFlags(profile);
    assert.ok(flags.prepEditing && flags.difficultyChoice && flags.regionRules);
    assert.ok(Meta.availableDungeons(profile).find(entry => entry.id === dungeonId)?.difficulties.includes('normal'));
    const { start, pool } = Meta.prepView(profile, dungeonId, roster);
    assert.ok(pool.length);
    if (id === 'preparation') assert.deepEqual(start.candidates, [start.id], 'The first roster cell is the coach target with no alternate lead');
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

  function modifiedDoor() {
    const profile = unlockedProfile();
    const run = expedition(profile, { seed: 7, floor: 2 });
    const door = run.doors.find(door => door.quirk || door.enemies.some(enemy => enemy.affixes?.length));
    assert.ok(run.features.quirks && run.features.affixes && door, 'Expected a door with a quirk or affix');
    const rule = QUIRKS[door.quirk] ?? AFFIXES[door.enemies.flatMap(enemy => enemy.affixes ?? [])[0]];
    return tour('modified-door', {
      profile, run, open: resume, selector: `#map.on .door-entry[data-door="${door.index}"]`,
      line: rule.name + ' · ' + rule.desc, proof: `Floor 2 · ${rule.name} door`
    });
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
    return tour('mission', {
      profile, now: riftDate, selector: '#notebook.on [data-mission-guide="weekly"]', proof: 'First main clear unlocks weekly and monthly missions',
      async open(page) {
        await enterObservatory(page);
        await page.locator('#hub.on [data-meta-page="notebook"]').click();
      }
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

  return {
    'tour-heirloom': heirloom,
    'tour-last-stand': lastStand,
    'tour-relic': () => treasure(false),
    'tour-relic-replace': () => treasure(true),
    'tour-spring-draw': () => service('spring-draw', 'spring', '#spring.on #b-draw', 'Floor 3 one-crystal draw', run =>
      command(Run.springDraw, run)),
    'tour-spring-pick': () => service('spring-pick', 'spring', '#spring.on #b-pick', 'Floor 3 free preview of the three-crystal offer', run => {
      assert.ok(run.features.springPick && run.crystals >= Run.COST.pick);
      assert.equal(command(Run.getSpringOffer, run).slots.length, 3);
    }, ['spring-draw']),
    'tour-preparation': () => prepare('preparation', '#sheet.on .meta-prep-cell:first-child', 'First editable expedition roster'),
    'tour-difficulty': () => prepare('difficulty', '#sheet.on [data-difficulty="normal"]', 'Journey difficulty in preparation', ['preparation']),
    'tour-region': () => prepare('region', '#sheet.on #meta-region-rule', 'Ember Volcano regional rule in preparation',
      ['preparation', 'difficulty'], REGIONS[DUNGEONS[dungeonId].region.id].desc),
    'tour-modified-door': modifiedDoor,
    'tour-altar': () => service('altar', 'altar', '#altar.on #b-roll', 'Floor 3 altar with a living party', run =>
      command(Run.altarRoll, run)),
    'tour-wager': wager,
    'tour-mission': mission,
    'tour-daily-rift': dailyRift
  };
}

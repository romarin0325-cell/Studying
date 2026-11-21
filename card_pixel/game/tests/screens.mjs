// node card_pixel/game/tests/screens.mjs [--case <name>] [--validate-only]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { CONTRACTS, CONTRACT_ESCROW, CONTRACT_PAYOUT } from '../src/content/contracts.js';
import { DUNGEONS } from '../src/content/dungeons.js';
import { EVENTS, eventForRun } from '../src/content/events.js';
import { INTRO } from '../src/content/intro.js';
import * as Bridge from '../src/engine/bridge.js';
import * as Meta from '../src/engine/meta.js';
import { openingModel } from '../src/engine/opening.js';
import { expeditionPool, gradeOf, POSITION } from '../src/engine/roster.js';
import * as Run from '../src/engine/run.js';
import { eventChoices } from '../src/engine/rooms.js';
import * as Save from '../src/engine/save.js';
import { battleLog } from '../src/ui/battle/log.js';
import { affixLines, intentLines, skyRelics } from '../src/ui/battle/hud.js';
import { commandRelics, killLabel } from '../src/ui/battle/tiles.js';
import { relicEffect } from '../src/ui/relics.js';
import { ratesView } from '../src/engine/awakenings.js';
import { TERMS } from '../src/ui/glossary.js';
import { blessingText } from '../src/ui/widgets.js';
import { playRun } from '../tools/sim.mjs';
import { createRiftCases, riftDate } from './screens/rift.mjs';
import { createEntryCases } from './screens/entry.mjs';
import { createCoreRoster } from './support/core.mjs';

const sessionKey = 'relaymare.session';
const dailyKey = 'relaymare.daily';
const gameUrl = new URL('../dist/Relaymare.html', import.meta.url).href;
// RELAY_VIEWPORT=430x900 shoots the launcher window size into shots/screens-430x900/ instead.
const viewportSize = /^(\d+)x(\d+)$/.exec(process.env.RELAY_VIEWPORT ?? '');
const viewport = viewportSize ? { width: Number(viewportSize[1]), height: Number(viewportSize[2]) } : { width: 390, height: 844 };
const shots = fileURLToPath(new URL(viewportSize ? `shots/screens-${viewportSize[0]}/` : 'shots/screens/', import.meta.url));

const { core, roster } = createCoreRoster();

function command(action, run, ...args) {
  const result = action(run, ...args);
  assert.equal(result.ok, true, `${action.name} on floor ${run.floor}: ${result.reason}`);
  return result;
}

function startPicks(run, firstPick) {
  while (run.pending?.kind === 'start') {
    command(Run.chooseStartPick, run, firstPick ?? run.pending.candidates[0] ?? null);
    firstPick = undefined;
  }
}

// Advance setup floors through the same settlement API used by run.test.mjs.
function settleWin(run, overrides = {}) {
  const { party, enemies } = Run.battleOptions(run);
  return command(Run.settleBattle, run, {
    outcome: 'win', survivors: party.map(Boolean), retreated: [false, false, false],
    heirloomsGained: [], heirloomsUsed: 0, lastStands: 0,
    enemyDowns: enemies.map((_, idx) => ({ idx, treasure: false })),
    bestHit: null, turns: 3, bet: null, ...overrides
  });
}

function advance(run) {
  if (run.pending?.kind === 'reinforcement') {
    command(Run.resolveReinforcement, run, { key: run.pending.key, id: null, replaceId: null });
  }
  command(Run.leaveRoom, run);
  command(Run.nextFloor, run);
}

function reachFloor(run, floor, visit = () => {}) {
  while (run.floor < floor) {
    command(Run.chooseDoor, run, 0);
    if (run.room.status === 'order') {
      command(Run.confirmOrder, run, run.bench.slice(0, 3));
      settleWin(run);
    }
    startPicks(run);
    visit(run);
    advance(run);
  }
  return run;
}

function makeRun({ dungeonId = 'ember_volcano', seed, floor = 1, difficulty, contract, profileView, firstPick, visit, tempoVersion = 1 }) {
  const run = Run.createRun({ core, roster, dungeonId, seed, difficulty, contract, profileView, tempoVersion });
  startPicks(run, firstPick);
  return reachFloor(run, floor, visit);
}

function startBattle(run, { door = 0, party = run.bench.slice(0, 3) } = {}) {
  command(Run.chooseDoor, run, door);
  command(Run.confirmOrder, run, party);
  const battle = Bridge.create(core, Run.battleOptions(run));
  battle.start();
  return battle;
}

function act(battle, name) {
  const skill = battle.options().find(option => option.name === name);
  assert.ok(skill?.usable, `Expected usable skill: ${name}`);
  return battle.act(skill.index);
}

function storedSession({ run = null, profile = legacyProfile(), unsupportedRun = false }) {
  const storage = new Map();
  const store = Save.createSaveStore({
    getItem: key => storage.get(key),
    setItem: (key, value) => storage.set(key, value)
  }, { core, roster });
  store.save({ profile, run });
  if (unsupportedRun) {
    const invalid = JSON.parse(storage.get(sessionKey));
    invalid.run.version = Save.RUN_VERSION + 1;
    storage.set(sessionKey, JSON.stringify(invalid));
  }
  const loaded = store.load();
  assert.ok(loaded, 'The session must round-trip through the save store');
  assert.deepEqual(loaded.profile.recruits, profile.recruits);
  if (unsupportedRun) {
    assert.equal(loaded.runError, 'run_restore_failed');
    assert.equal(loaded.run, null);
  } else if (run?.room?.status === 'battle') {
    assert.equal(loaded.run.room.status, 'order');
    assert.deepEqual(loaded.run.room.party, run.room.party);
  } else {
    // The save is JSON. Arrays built inside the card core's vm realm carry another Array prototype,
    // so compare against the JSON form; jsonSafe still fails on values JSON would silently drop.
    assert.deepEqual(loaded.run, jsonSafe(run));
  }
  return storage.get(sessionKey);
}

function jsonSafe(value, path = 'run') {
  const tag = Object.prototype.toString.call(value);
  assert.ok(!['[object Map]', '[object Set]', '[object Function]'].includes(tag), `${path} is a ${tag}; the JSON save would lose it`);
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) jsonSafe(child, path + '.' + key);
  }
  return path === 'run' ? JSON.parse(JSON.stringify(value)) : value;
}

function legacyProfile() {
  const profile = Meta.createProfile();
  profile.ui.entry.legacy = true;
  return profile;
}

function snowRabbitProfile(seed = 7, profile = legacyProfile()) {
  const intro = makeRun({ dungeonId: 'dawn_forest', seed, floor: 2 });
  command(Run.chooseDoor, intro, 0);
  startPicks(intro, 'snow_rabbit');
  advance(intro);
  reachFloor(intro, 5);
  startBattle(intro);
  settleWin(intro);
  const result = Meta.applyRunEnd(profile, intro, { recruits: ['snow_rabbit'] });
  assert.equal(result.announce.ok, true, result.announce.reason);
  return result.profile;
}

function tileRange() {
  const run = makeRun({ dungeonId: 'starlit_garden', seed: 1, profileView: { lead: 'avalanche_maid' } });
  const battle = startBattle(run);
  const skill = '아이스에이지';
  act(battle, '일반 공격');
  act(battle, '빙하의일격');
  const { hp, maxHp } = battle.state().enemy;
  const { min, max, kill } = battle.options().find(option => option.name === skill).preview;
  assert.ok(min < hp && hp <= max && !kill, 'The enemy should only die to some rolls');
  assert.equal(killLabel({ min, max, kill }, max + 1), '');
  act(battle, '일반 공격');
  const lethalHp = battle.state().enemy.hp;
  const lethal = battle.options().find(option => option.name === skill).preview;
  assert.ok(lethalHp > 0 && lethalHp <= lethal.min && lethal.kill, 'The minimum roll should now kill');
  return {
    session: storedSession({ run }), proof: `${skill} ${min}~${max} at HP ${hp}, 처치 at HP ${lethalHp}`,
    async show(page, { text, capture }) {
      await openBattle(page);
      await tapTile(page, '일반 공격');
      await tapTile(page, '빙하의일격');
      const tile = skillTile(page, skill);
      await text(page.locator('#pf-hpn'), `${hp} / ${maxHp}`, { exact: true });
      await text(tile.locator('.r2 strong'), `${min}~${max}`);
      await text(tile.locator('.r2 u'), '명중 시 처치', { exact: true });
      await capture();
      await tapTile(page, '일반 공격');
      await text(page.locator('#pf-hpn'), `${lethalHp} / ${maxHp}`, { exact: true });
      await text(tile.locator('.r2 strong'), `${lethal.min}~${lethal.max}`);
      await text(tile.locator('.r2 u'), '처치');
      await capture('kill');
    }
  };
}

function tileInstant() {
  const run = makeRun({ seed: 1, profileView: { lead: 'guardian', companions: ['time_magician'], reserved: 'time_magician' },
    firstPick: 'time_magician' });
  const battle = startBattle(run);
  const skill = '판게아리버스';
  const { preview } = battle.options().find(option => option.name === skill);
  assert.ok(preview.instant && preview.dmg > 0);
  return {
    session: storedSession({ run }), proof: `${skill} ${preview.dmg} · 즉시`,
    async show(page, { text }) {
      await openBattle(page);
      const forecast = skillTile(page, skill).locator('.r2');
      await text(forecast.locator('strong'), String(preview.dmg), { exact: true });
      await text(forecast.locator('small').filter({ hasText: '즉시' }), '즉시');
      assert.doesNotMatch(await forecast.innerText(), /예약/, `${skill} must display an instant forecast`);
    }
  };
}

function fieldSupport() {
  function prepare(lead, skill, field) {
    const run = makeRun({ seed: 1, profileView: { lead } });
    const battle = startBattle(run);
    act(battle, skill);
    assert.ok(battle.state().field.includes(field));
    return storedSession({ run });
  }
  const session = prepare('guardian', '배틀필드', 'arena');
  const cureMaster = prepare('cure_master', '레모네이드', 'star_powder');
  return {
    session, proof: '배틀필드 → 아레나, 레모네이드 → 스타파우더',
    async show(page, { text, capture, revisit }) {
      async function check(source, name, line, field, description, label) {
        await openBattle(source);
        const tile = skillTile(source, name);
        await text(tile.locator('.r2'), line, { exact: true });
        await text(tile.locator('.r3'), field);
        await capture(label, source);
        await tile.hover();
        await source.mouse.down();
        const sheet = source.locator('#sheet.on');
        await sheet.waitFor();
        await source.mouse.up();
        await text(sheet.locator('#sh-title'), name);
        await text(sheet.locator('#sh-body p'), field + ' · 아군 ' + description);
        await capture(label ? label + '-detail' : 'detail', source);
      }
      await check(page, '배틀필드', '일반 공격 피해 2배', '아레나', '일반 공격 피해 2배');
      await revisit(cureMaster, source => check(source, '레모네이드', '방어·마방 +40%', '스타파우더', '방어력·마법방어력 +40%', 'lemonade'));
    }
  };
}

function retreatWarning() {
  const run = makeRun({ dungeonId: 'arena', seed: 1, profileView: { lead: 'prism_twin' } });
  const battle = startBattle(run);
  const skill = '일루미네이션';
  act(battle, skill);
  const state = battle.state();
  assert.equal(state.turn, 2);
  assert.ok(battle.canRetreat() && state.delayed.some(attack => attack.by === state.cur && attack.name === skill));
  const warning = '예약한 일루미네이션 취소됨';
  return {
    session: storedSession({ run }), proof: `turn 2, ${skill} queued and retreat available`,
    async show(page, { text }) {
      await openBattle(page);
      await tapTile(page, skill);
      await page.locator('#b-retreat').click();
      await text(page.locator('#ticker'), warning);
      await text(page.locator('#turn'), '2턴');
    }
  };
}

function doorSky() {
  const run = makeRun({ dungeonId: 'starlit_garden', seed: 0, floor: 3 });
  assert.equal(run.doors[2].event.id, 'hidden_cake_crown');
  const session = storedSession({ run });
  command(Run.chooseDoor, run, 2);
  command(Run.chooseEvent, run, 'powder');
  advance(run);
  assert.deepEqual(Run.doorStart(run, 0).field, ['star_powder']);
  const sky = '시작 필드 · 스타파우더';
  return {
    session, proof: `cake event → floor ${run.floor} start field: star_powder`,
    async show(page, { text, capture }) {
      await page.locator('#map.on [data-door="2"]').click();
      await page.locator('#event.on [data-choice="powder"]').click();
      await page.locator('#event.on #b-leave').click();
      await page.locator('#order.on #b-order-back').click();
      const forecast = page.locator('#map.on [data-door="0"] .door-risk');
      await text(forecast, sky);
      await forecast.scrollIntoViewIfNeeded();
      await capture('card');
      const sheet = await openDoorInfo(page, 0);
      await text(sheet.getByText(sky, { exact: true }), sky);
      await capture();
    }
  };
}

function doorHp() {
  // Review seed 3 now rolls Treasure alone. Seed 64 rolls Echo on the same enemy.
  const echo = makeRun({ seed: 64, floor: 2 });
  const treasure = makeRun({ seed: 3, floor: 2 });
  assert.equal(echo.doors[1].quirk, 'echo');
  assert.equal(Run.doorEnemies(echo, 1)[0].maxHp, 546);
  assert.equal(treasure.doors[1].reward, 2);
  assert.ok(treasure.doors[1].enemies[0].affixes.includes('treasure'));
  const treasureSession = storedSession({ run: treasure });
  return {
    session: storedSession({ run: echo }), proof: 'seed 64 Echo: HP 546, seed 3 Treasure: fixed 2 and bonus 2',
    async show(page, { text, capture, revisit }) {
      const echoSheet = await openDoorInfo(page, 1);
      await text(echoSheet.locator('.run-foe-detail').first().locator('p').filter({ hasText: 'HP 546' }), 'HP 546');
      await text(echoSheet.getByRole('heading', { name: '메아리' }), '메아리');
      await capture();
      await revisit(treasureSession, async treasurePage => {
        const treasureSheet = await openDoorInfo(treasurePage, 1);
        await text(treasureSheet.getByText('확정 결정 +2', { exact: true }), '확정 결정 +2');
        const bonus = '추가 보상 · 보물 적 처치 후 승리 시 1명당 결정 +2';
        await text(treasureSheet.getByText(bonus, { exact: true }), bonus);
        await capture('treasure', treasurePage);
      });
    }
  };
}

function betText() {
  const run = makeRun({ dungeonId: 'starlit_garden', seed: 2, floor: 3 });
  const session = storedSession({ run });
  command(Run.chooseDoor, run, 2);
  assert.equal(run.room.event.id, 'odd_even_chart');
  for (const [id, turn] of [['third', 3], ['fourth', 4]]) {
    const choice = run.pending.choices.find(choice => choice.id === id);
    assert.ok(choice.enabled && choice.ops.some(effect => effect.kind === 'kill_on_turn' && effect.turn === turn));
  }
  return {
    session, proof: 'floor 3 별판 offers kill_on_turn bets for turns 3 and 4',
    async show(page, { text }) {
      await page.locator('#map.on [data-door="2"]').click();
      await text(page.locator('#event.on h2'), '점성술사의 별판');
      await text(page.locator('#event.on [data-choice="third"] span'), '3턴에 적 하나 처치 후 승리');
      const fourth = page.locator('#event.on [data-choice="fourth"] span');
      await text(fourth, '4턴에 적 하나 처치 후 승리');
      await fourth.scrollIntoViewIfNeeded();
    }
  };
}

function saveFail() {
  const run = makeRun({ seed: 1 });
  const session = storedSession({ run });
  command(Run.chooseDoor, run, 0);
  assert.equal(run.room.status, 'order');
  const store = Save.createSaveStore({
    getItem: () => null,
    setItem(key) {
      assert.equal(key, sessionKey);
      throw new DOMException('Forced session write failure', 'QuotaExceededError');
    }
  }, { core, roster });
  assert.throws(() => store.save({ profile: Meta.createProfile(), run }), { name: 'QuotaExceededError' });
  return {
    session, proof: 'floor 1 map enters battle; session write propagates QuotaExceededError',
    async show(page, { text }) {
      await page.locator('#order.on #b-go').waitFor();
      await page.evaluate(key => {
        const write = Storage.prototype.setItem;
        Storage.prototype.setItem = function (item, value) {
          if (item === key) throw new DOMException('Forced session write failure', 'QuotaExceededError');
          return write.call(this, item, value);
        };
      }, sessionKey);
      await page.locator('#order.on #b-go').click();
      await page.locator('#battle.on').waitFor();
      await text(page.locator('#session-notices p'), '저장에 실패했습니다');
    }
  };
}

function runLost() {
  const profile = snowRabbitProfile();
  const run = makeRun({ seed: 1, profileView: Meta.startView(profile, 'ember_volcano') });
  assert.ok(profile.recruits.snow_rabbit);
  return {
    session: storedSession({ profile, run, unsupportedRun: true }),
    proof: `run version ${Save.RUN_VERSION + 1} rejected; ${profile.lead} remains recruited`,
    async show(page, { text, capture }) {
      await text(page.locator('#title.on .title-save-notice'), '원정만 손상 · 동료와 수첩 유지');
      await capture();
      await page.locator('#title.on #b-start').click();
      await page.locator('#hub.on [data-meta-page="collection"]').click();
      const recruit = page.locator('#collection.on [data-companion="snow_rabbit"]');
      await text(recruit.locator('b'), '눈토끼');
      await text(recruit.locator('small'), '인연 0');
      await recruit.scrollIntoViewIfNeeded();
      await capture('recruit');
    }
  };
}

function recordFallen() {
  const profile = snowRabbitProfile();
  const dungeonId = 'ember_volcano';
  const run = makeRun({ dungeonId, seed: 21, floor: 8, profileView: Meta.startView(profile, dungeonId) });
  startBattle(run);
  assert.equal(run.room.party[0], 'snow_rabbit');
  settleWin(run, { survivors: [false, false, true], retreated: [false, true, false] });
  assert.equal(run.result, 'win');
  assert.ok(run.fallen.includes('snow_rabbit') && run.participated.includes('snow_rabbit'));
  const { announce } = Meta.applyRunEnd(profile, run);
  assert.ok(announce.ok && !announce.returned.includes('snow_rabbit'));
  return {
    session: storedSession({ profile, run }), proof: 'floor 8 won with recruited snow_rabbit fallen and absent from returned',
    async show(page, { text }) {
      // Let the actual return handler write the per-companion history.
      await page.locator('#recruit.on #meta-recruit-confirm').click();
      await page.locator('#hub.on [data-meta-page="collection"]').click();
      await page.locator('#collection.on [data-companion="snow_rabbit"]').click();
      await text(page.locator('#sheet.on #sh-title'), '눈토끼');
      const record = '홍련 화산 · 8층 · 원정 승리 · 미귀환';
      const entry = page.locator('#sheet.on #sh-body').getByText(record, { exact: true });
      await text(entry, record);
      await entry.scrollIntoViewIfNeeded();
    }
  };
}

function fieldCap() {
  const relic = 'buff_overload';
  const skill = '오지관정';
  const run = makeRun({
    dungeonId: 'starlit_garden', seed: 88, floor: 6, profileView: { lead: 'dainichi_nyorai' },
    visit(current) {
      if (current.floor === 4) command(Run.chooseGateReward, current, { kind: 'relic', id: relic });
    }
  });
  const battle = startBattle(run, { door: 1 });
  assert.ok(Run.battleOptions(run).artifacts.includes(relic));
  assert.equal(skyRelics({ artifacts: Run.battleOptions(run).artifacts, D: battle.state() })[0], relic);
  for (let i = 0; i < 3; i++) act(battle, skill);
  const { field } = battle.state();
  assert.equal(field.length, 5);
  return {
    session: storedSession({ run }), proof: `${relic} equipped; ${field.join(', ')}`,
    async show(page, { text, capture }) {
      await openBattle(page);
      const slots = page.locator('#sky-slots i');
      assert.equal(await slots.count(), 5, 'Buff Overload must display five HUD slots before they are filled');
      await page.locator('#sky [data-relic-mark="buff_overload"]').waitFor();
      await text(skillTile(page, skill).locator('.r2'), '무작위 아군 강화 1종', { exact: true });
      for (let i = 0; i < 3; i++) await tapTile(page, skill);
      assert.equal(await page.locator('#sky-slots i.on').count(), 5, 'All five HUD slots must be filled');
      await text(page.locator('#skyname'), field.map(id => core.BUFF_NAMES[id]).join(' · '), { exact: true });
      await capture('hud');
      await page.locator('#b-field').click();
      const battlefield = page.locator('#sheet.on #sh-body');
      await battlefield.getByRole('button', { name: /버프오버로드/ }).click();
      assert.equal(await page.evaluate(() => window.__game.clock.paused), true);
      await text(page.locator('#sh-title'), '버프오버로드', { exact: true });
      await text(battlefield.locator('.relic-sheet p'), relicEffect(core.GameUtils.getArtifactById(relic)), { exact: true });
      await battlefield.locator('[data-relic-back]').click();
      await text(page.locator('#sh-title'), '전장·유물', { exact: true });
      assert.equal(await page.evaluate(() => window.__game.clock.paused), true);
      await page.locator('#b-sheetclose').click();
      assert.equal(await page.evaluate(() => window.__game.clock.paused), false);
      await page.locator('#sky').click();
      const sheet = page.locator('#sheet.on #sh-body');
      assert.equal(await sheet.locator('.stl li').count(), 5, 'Field sheet must list all five buffs');
      await text(sheet.locator('p.sm'), '최대 5개');
    }
  };
}

function relicMap(showDetails) {
  const relic = 'buff_overload';
  const run = makeRun({
    dungeonId: 'starlit_garden', seed: 88, floor: 5, profileView: { lead: 'dainichi_nyorai' },
    visit(current) {
      if (current.floor === 4) command(Run.chooseGateReward, current, { kind: 'relic', id: relic });
    }
  });
  assert.deepEqual(run.relics, [relic]);
  const effect = relicEffect(core.GameUtils.getArtifactById(relic));
  return {
    session: storedSession({ run }), proof: `gate reward equipped ${relic}; three empty slots; ${effect}`,
    async show(page, { text }) {
      const strip = page.locator('#map.on .relic-strip');
      await strip.waitFor();
      const slots = strip.locator('.relic-slot');
      const sizes = await slots.evaluateAll(nodes => nodes.map(node => [node.offsetWidth, node.offsetHeight]));
      assert.deepEqual(sizes, Array.from({ length: 4 }, () => [52, 52]));
      assert.equal(await strip.locator('.empty').count(), 3);
      assert.equal(await slots.first().locator('img').count(), 1);
      const top = (await strip.boundingBox()).y;
      await page.locator('#map.on .run-route').evaluate(node => { node.scrollTop = node.scrollHeight; });
      assert.equal((await strip.boundingBox()).y, top);
      await page.locator('#map.on .run-route').evaluate(node => { node.scrollTop = 0; });
      if (!showDetails) return;
      await slots.nth(1).click();
      await text(page.locator('#sheet.on #sh-title'), '빈 칸', { exact: true });
      await page.locator('#b-sheetclose').click();
      await slots.first().click();
      await text(page.locator('#sheet.on #sh-title'), '버프오버로드', { exact: true });
      await text(page.locator('#sheet.on .relic-sheet p'), effect, { exact: true });
    }
  };
}

function fillRelicSlots(run, incoming) {
  run.relics = ['double_attack', 'reverse', 'support_boost', 'buff_overload', 'ice_break']
    .filter(id => id !== incoming).slice(0, 4);
}

function relicComparison(run, session, arrive, source) {
  assert.equal(run.pending?.kind, 'relic');
  const { id, cost } = run.pending;
  const equipped = run.relics.slice();
  const replace = equipped[0];
  const incoming = core.GameUtils.getArtifactById(id);
  const outgoing = core.GameUtils.getArtifactById(replace);
  const label = replace === 'double_attack' ? '더블어택을 빼고 장착' : '리버스를 빼고 장착';
  const crystals = run.crystals;
  const keep = Save.restoreRun(Save.serializeRun(run), { core, roster });
  command(Run.leaveRoom, keep);
  assert.deepEqual(keep.relics, equipped);
  assert.equal(keep.crystals, crystals);
  command(Run.equipRelic, run, id, replace);
  const swapped = [id, ...equipped.slice(1)];
  assert.deepEqual(run.relics, swapped);
  assert.equal(run.crystals, crystals - cost);
  return {
    session, proof: `${source}: ${id} vs ${replace}, cost ${cost}; both equip and skip verified`,
    async show(page, { text, capture, revisit }) {
      async function select(sourcePage) {
        if (source === 'gate' || source === 'bet') await sourcePage.locator('#result.on #b-next').click();
        await arrive?.(sourcePage);
        const screen = sourcePage.locator(source === 'bet' || source === 'gate' ? '#result.on .victory-decision' : '#treasure.on');
        const equip = screen.locator('#b-equip');
        await equip.waitFor();
        assert.equal(await equip.isDisabled(), true);
        await screen.locator(`[data-replace="${replace}"]`).click();
        return screen;
      }
      async function saved(sourcePage) {
        return sourcePage.evaluate(key => JSON.parse(localStorage.getItem(key)).run.run, sessionKey);
      }
      const screen = await select(page);
      const compare = screen.locator('.run-relic-compare');
      await text(compare.locator('.incoming h3'), incoming.name, { exact: true });
      await text(compare.locator('.incoming p'), relicEffect(incoming), { exact: true });
      await text(compare.locator('.outgoing h3'), outgoing.name, { exact: true });
      await text(compare.locator('.outgoing p'), relicEffect(outgoing), { exact: true });
      const left = await compare.locator('.incoming').boundingBox();
      const right = await compare.locator('.outgoing').boundingBox();
      assert.ok(left.x < right.x && left.y === right.y && left.height === right.height);
      if (cost) await text(screen.locator('.relic-cost'), `결정 ${cost}`, { exact: true });
      await text(screen.locator('#b-equip'), label, { exact: true });
      await text(screen.locator('#b-leave'), '두고 가기', { exact: true });
      await capture();
      await screen.locator('#b-leave').click();
      const kept = await saved(page);
      assert.deepEqual(kept.relics, equipped);
      assert.equal(kept.crystals, crystals);
      assert.notEqual(kept.pending?.id, id);
      await revisit(session, async sourcePage => {
        const offer = await select(sourcePage);
        await offer.locator('#b-equip').click();
        const accepted = await saved(sourcePage);
        assert.deepEqual(accepted.relics, swapped);
        assert.equal(accepted.crystals, crystals - cost);
      });
    }
  };
}

function treasureRelicCompare() {
  const run = makeRun({ seed: 1, floor: 5 });
  command(Run.chooseDoor, run, 1);
  fillRelicSlots(run, run.room.relic);
  const session = storedSession({ run });
  command(Run.takeTreasure, run);
  return relicComparison(run, session, null, 'treasure');
}

function gateRelicCompare() {
  const run = makeRun({ seed: 1, floor: 4 });
  startBattle(run);
  fillRelicSlots(run, run.room.relic);
  settleWin(run);
  const id = run.pending.relic;
  const session = storedSession({ run });
  command(Run.chooseGateReward, run, { kind: 'relic', id });
  return relicComparison(run, session, async page => {
    await page.locator(`#result.on [data-relic="${id}"]`).click();
    await page.locator('#result.on #b-gate-take').click();
  }, 'gate');
}

function championship() {
  const run = makeRun({ dungeonId: 'arena', seed: 1103811, floor: 3,
    profileView: { lead: 'luna', companions: ['underdog'] } });
  command(Run.chooseDoor, run, 2);
  assert.equal(run.room.event.id, 'championship');
  command(Run.chooseEvent, run, 'team');
  advance(run);
  return run;
}

function betRelicCompare() {
  const run = championship();
  fillRelicSlots(run, 'double_attack');
  startBattle(run);
  settleWin(run, { bet: { kind: 'same_grade_full', won: true } });
  assert.equal(run.pending.id, 'double_attack');
  assert.equal(run.pending.after.kind, 'gate');
  return relicComparison(run, storedSession({ run }), null, 'bet');
}

function eventRelicCompare() {
  for (let seed = 1; seed <= 40; seed++) {
    const run = makeRun({ dungeonId: 'starlit_garden', seed, floor: 3 });
    command(Run.chooseDoor, run, 2);
    const choice = run.pending?.choices?.find(entry => entry.enabled && !entry.targets && entry.cost > 0 &&
      entry.ops.length === 1 && entry.ops[0].type === 'relic' && !entry.ops[0].temporary);
    if (!choice) continue;
    const { id } = choice.ops[0];
    fillRelicSlots(run, id === 'offered' ? run.room.relic : id);
    const session = storedSession({ run });
    command(Run.chooseEvent, run, choice.id);
    return relicComparison(run, session, page => page.locator(`#event.on [data-choice="${choice.id}"]`).click(), 'event');
  }
  assert.fail('Expected a paid relic event in the starlit garden');
}

function relicTileMark() {
  const run = championship();
  startBattle(run);
  settleWin(run, { bet: { kind: 'same_grade_full', won: true } });
  advance(run);
  reachFloor(run, 6);
  const battle = startBattle(run);
  const options = battle.options();
  const artifacts = Run.battleOptions(run).artifacts;
  assert.deepEqual(artifacts, ['double_attack']);
  const state = battle.state();
  assert.deepEqual(options.filter(option => commandRelics(artifacts, option, roster.card(run.room.party[0]), state).length)
    .map(option => option.name), ['일반 공격']);
  const base = Bridge.create(core, { ...Run.battleOptions(run), artifacts: [] });
  base.start();
  assert.ok(options[0].preview.dmg > base.options()[0].preview.dmg);
  assert.deepEqual(options.slice(1).map(option => option.preview), base.options().slice(1).map(option => option.preview));
  return {
    session: storedSession({ run }), proof: `championship reward: normal attack ${base.options()[0].preview.dmg} → ${options[0].preview.dmg}; skills unchanged`,
    async show(page) {
      await openBattle(page);
      const tile = skillTile(page, '일반 공격');
      await tile.locator('[data-relic-mark="double_attack"]').waitFor();
      assert.equal(await page.locator('#battle.on [data-relic-mark="double_attack"]').count(), 1);
      assert.equal(await page.locator('#battle.on .relic-strip').count(), 0);
    }
  };
}

function formSheet() {
  const run = makeRun({ seed: 0, profileView: { lead: 'miracle_larva', reserved: 'executor' }, firstPick: 'executor' });
  const battle = startBattle(run, { party: ['miracle_larva', 'executor'] });
  const transform = '기적의우화';
  act(battle, transform);
  act(battle, `${transform} → 오로라윙`);
  assert.equal(battle.state().allies[0].form, 'aurora_wing');
  const skills = Array.from(roster.card('aurora_wing').skills, skill => skill.name);
  return {
    session: storedSession({ run }), proof: `aurora_wing on turn 3: ${skills.join(', ')}`,
    async show(page, { text }) {
      await openBattle(page);
      await tapTile(page, transform);
      await skillTile(page, transform).click();
      await page.locator('#sheet.on [data-form]').filter({ hasText: '오로라윙' }).click();
      await battleIdle(page);
      await page.locator('#party .pm[data-i="0"]').click();
      await text(page.locator('#sheet.on #sh-title'), '동료 전투 정보');
      const sheet = page.locator('#sheet.on #sh-body');
      await text(sheet.getByText('오로라윙', { exact: true }), '오로라윙');
      const shown = sheet.locator('.skl > b');
      assert.deepEqual(await shown.allTextContents(), skills, 'The detail must list the current form’s skills');
      for (const skill of skills) await text(shown.filter({ hasText: skill }), skill);
      await shown.last().scrollIntoViewIfNeeded();
    }
  };
}

function resumeSeats() {
  const run = makeRun({ dungeonId: 'twilight_cathedral', seed: 0, floor: 6,
    profileView: { lead: 'mawang', reserved: 'night_rabbit' }, firstPick: 'night_rabbit' });
  const party = [null, 'mawang', 'night_rabbit'];
  startBattle(run, { party });
  assert.deepEqual(Run.battleOptions(run).party, party);
  return {
    session: storedSession({ run }), proof: 'floor 6 battle round-trips to order with [null, mawang, night_rabbit]',
    async show(page, { text }) {
      await openBattle(page);
      // The init script seeds only the initial navigation. Reload reads the UI’s own write.
      await page.reload({ waitUntil: 'domcontentloaded' });
      const names = ['빈 자리', '마왕', '밤토끼'];
      for (const [index, name] of names.entries()) {
        await text(page.locator(`#order.on [data-slot="${index}"] b`), name, { exact: true });
      }
    }
  };
}

function mapSeats() {
  const run = makeRun({ seed: 21 });
  const previous = run.bench.slice(0, 3);
  startBattle(run, { party: previous });
  settleWin(run, { survivors: [true, false, true] });
  advance(run);
  const party = Run.defaultParty(run);
  assert.equal(party[0], previous[0]);
  assert.equal(party[2], previous[2]);
  assert.ok(party[1] && party[1] !== previous[1]);
  assert.notDeepEqual(party, run.bench.slice(0, 3));
  const reserves = run.bench.filter(id => !party.includes(id));
  return {
    session: storedSession({ run }), proof: 'A reserve refills only the fallen middle seat: ' + party.join(' → '),
    async show(page, { text, capture }) {
      const map = page.locator('#map.on'), actors = map.locator('.map-actor');
      const names = party.map(id => roster.card(id).name);
      assert.deepEqual(await actors.evaluateAll(nodes => nodes.map(node => node.dataset.sheet)), party);
      for (const [index, name] of names.entries()) {
        const actor = actors.nth(index);
        await text(actor.locator('small'), POSITION[index], { exact: true });
        assert.equal(await actor.getAttribute('aria-label'), POSITION[index] + ' ' + name);
      }
      await capture();
      await map.locator('[data-door="0"]').click();
      const order = page.locator('#order.on');
      assert.deepEqual(await order.locator('[data-bench]').evaluateAll(nodes => nodes.map(node => node.dataset.bench)), reserves);
      for (const [index, name] of names.entries()) {
        await text(order.locator(`.relay-seat[data-slot="${index}"] b`), name, { exact: true });
      }
      await openBattle(page);
      assert.deepEqual(await page.evaluate(() => window.__game.B.party), party);
    }
  };
}

function countdownCharge() {
  // Floor eight and its four preceding battles contribute to the 32-bit battle seed.
  const seed = (2 - 8 * 1013 - 4 * 7) >>> 0;
  const run = makeRun({ dungeonId: 'creation_tower', seed, floor: 8, profileView: { lead: 'red_dragon' } });
  const battle = startBattle(run);
  const options = Run.battleOptions(run);
  assert.equal(options.seed, 2);
  assert.equal(options.enemies[0].id, 'creator_god');
  act(battle, '일반 공격');
  const ready = act(battle, '일반 공격').findLast(event => event.t === 'await');
  assert.equal(battle.state().turn, 3);
  assert.equal(ready.intent.kind, 'charge');
  assert.deepEqual(ready.countdown, { name: '디바인블레이드', inTurns: 0, charge: true });
  return {
    session: storedSession({ run }), proof: `expedition seed ${seed}, battle seed 2, turn 3 charge → 디바인블레이드`,
    async show(page, { text }) {
      await openBattle(page);
      await tapTile(page, '일반 공격');
      await tapTile(page, '일반 공격');
      await text(page.locator('#turn'), '3턴');
      await text(page.locator('#pf-cd.on'), '다음 턴 디바인블레이드');
    }
  };
}

function nightmareProfile() {
  const profile = snowRabbitProfile();
  const view = Meta.startView(profile, 'ember_volcano');
  // The fixture is a Journey clear, which unlocks Nightmare and its contracts.
  view.features = { ...view.features, difficultyChoice: true };
  const run = makeRun({ seed: 7, floor: 8, profileView: view });
  startBattle(run);
  settleWin(run);
  const result = Meta.applyRunEnd(profile, run);
  assert.ok(result.announce.ok);
  assert.equal(Meta.contractsFor(result.profile, run.dungeonId).unlocked, true);
  return result.profile;
}

function eliteContractRun(profile) {
  return makeRun({ seed: 21, floor: 2, difficulty: 'nightmare', contract: 'elite',
    profileView: Meta.startView(profile, 'ember_volcano') });
}

function completeContractFloor(run, door) {
  startBattle(run, { door });
  return settleWin(run);
}

function eliteSettlement(profile, eliteDoor = 1) {
  const run = eliteContractRun(profile);
  completeContractFloor(run, 1);
  assert.equal(run.contract.riskDoorTaken, true);
  advance(run);
  reachFloor(run, 6);
  assert.equal(run.contract.escrowed, CONTRACT_ESCROW);
  const result = completeContractFloor(run, eliteDoor);
  return { run, result };
}

function contractSheet() {
  const profile = nightmareProfile();
  const session = storedSession({ profile });
  const { name, rule } = CONTRACTS.heirloom;
  const terms = `문지기 보상에서 ◆${CONTRACT_ESCROW} 맡김 · 6층까지 달성하면 ◆${CONTRACT_PAYOUT}`;
  assert.equal(Meta.contractsFor(profile, 'ember_volcano').stamps.heirloom, null);
  return {
    session, proof: 'normal clear unlocked the three nightmare contracts in ember_volcano',
    async show(page, { text, capture }) {
      await page.locator('#title.on #b-start').click();
      await page.locator('#hub.on #meta-telescope').click();
      await page.locator('#dungeons.on [data-dungeon="ember_volcano"]').click();
      assert.equal(await page.locator('#meta-contract-choice').count(), 0);
      await page.locator('#sheet.on [data-difficulty="nightmare"]').click();
      const choice = page.locator('#sheet.on #meta-contract-choice');
      await text(choice, '악몽 계약 · 없음');
      await choice.click();
      await text(page.locator('#sheet.on [data-contract=""]'), '계약 없음');
      const option = page.locator('#sheet.on [data-contract="heirloom"]');
      await text(option.locator('b'), name);
      await text(option.locator('small').filter({ hasText: rule }), rule);
      await text(option.locator('small').filter({ hasText: terms }), terms);
      await text(option.locator('small').filter({ hasText: '도장 없음' }), '도장 없음');
      await capture();
      await option.click();
      await text(choice, '악몽 계약 · ' + name);
      await page.locator('#sheet.on #meta-start-expedition').click();
      await page.waitForFunction(() => window.__game.run?.contract?.id === 'heirloom');
    }
  };
}

function contractBattleSheet() {
  const run = eliteContractRun(nightmareProfile());
  const { name, rule } = CONTRACTS.elite;
  assert.equal(run.floor, 2);
  assert.equal(run.doors[1].risk, true);
  return {
    session: storedSession({ run }), proof: 'elite contract active at floor 2 before taking the risky door',
    async show(page, { text, capture }) {
      const safe = await openDoorInfo(page, 0);
      assert.doesNotMatch(await safe.innerText(), /둘이 돌아온 정예전/);
      await page.locator('#b-sheetclose').click();
      const risk = await openDoorInfo(page, 1);
      await text(risk.locator('h4').filter({ hasText: name }), name);
      await capture('risk-door');
      await page.locator('#b-sheetclose').click();
      await page.locator('#map.on [data-door="1"]').click();
      await openBattle(page);
      assert.doesNotMatch(await page.locator('#battle.on').innerText(), /둘이 돌아온 정예전/);
      await page.locator('#battle.on #b-field').click();
      const sheet = page.locator('#sheet.on #sh-body');
      await text(sheet.locator('h4').filter({ hasText: name }), `계약 · ${name} · 진행 중`);
      await text(sheet.getByText(rule, { exact: true }), rule);
    }
  };
}

function contractImpossible() {
  const run = eliteContractRun(nightmareProfile());
  assert.equal(run.floor, 2);
  assert.equal(Boolean(run.doors[0].risk), false);
  startBattle(run, { door: 0 });
  assert.equal(run.contract.riskDoorTaken, false);
  const safeSession = storedSession({ run });
  settleWin(run);
  advance(run);
  reachFloor(run, 4);
  startBattle(run);
  assert.equal(run.contract.riskDoorTaken, false);
  assert.equal(run.contract.met, false);
  assert.equal(run.contract.failed, false);
  const name = CONTRACTS.elite.name;
  return {
    session: safeSession, proof: 'Safe floor-2 door forecloses elite on floors 2 and 4 before settlement failure is recorded',
    async show(page, { text, capture, revisit }) {
      async function check(source) {
        await openBattle(source);
        await source.locator('#b-field').click();
        const sheet = source.locator('#sheet.on #sh-body');
        await text(sheet.locator('h4').filter({ hasText: name }), `계약 · ${name} · 이번 원정 불가`, { exact: true });
      }
      await check(page);
      await revisit(storedSession({ run }), async source => {
        await check(source);
        await capture('floor-4', source);
      });
    }
  };
}

function contractPayout() {
  const profile = nightmareProfile();
  const { run, result } = eliteSettlement(profile);
  assert.ok(result.contract.metNow && result.relic?.equipped);
  assert.equal(result.contract.paid, CONTRACT_PAYOUT);
  const failure = eliteSettlement(profile, 0);
  assert.equal(failure.result.contract.failed, true);
  return {
    session: storedSession({ run }),
    proof: `floor 6 elite settlement pays ${result.contract.paid}; the regular door forfeits ${failure.result.contract.escrowed}`,
    async show(page, { text, capture, revisit }) {
      await text(page.locator('#result.on .contract-met'), '계약 달성');
      await text(page.locator('#result.on .gain').filter({ hasText: '7층 앞에서' }), '7층 앞에서 ◆' + CONTRACT_PAYOUT);
      await text(page.locator('#result.on .relic-receipt'), '장착 완료');
      await capture();
      await page.locator('#result.on #b-next').click();
      // This fixture is a tempo-1 run: no reinforcement follows the floor-6 win, the next button goes on.
      const pass = page.locator('#result.on #b-reinforce-pass');
      if (await pass.isVisible()) await pass.click();
      await page.locator('#map.on').waitFor();
      await revisit(storedSession({ run: failure.run }), async failurePage => {
        const resultSheet = failurePage.locator('#result.on');
        await text(resultSheet.locator('.contract-failed'), '계약 실패 · 맡긴 ◆' + CONTRACT_ESCROW + ' 사라짐');
        await capture('failed', failurePage);
        await resultSheet.locator('#b-next').click();
        if (await resultSheet.locator('#b-reinforce-pass').isVisible()) await resultSheet.locator('#b-reinforce-pass').click();
        await failurePage.waitForFunction(() => window.__game.run?.floor === 7);
      });
    }
  };
}

function returnStamp() {
  const profile = nightmareProfile();
  const { run } = eliteSettlement(profile);
  advance(run);
  reachFloor(run, 8);
  completeContractFloor(run, 0);
  assert.deepEqual(Meta.applyRunEnd(profile, run).announce.stamp, { dungeonId: run.dungeonId, contractId: 'elite' });
  const { name } = CONTRACTS.elite;
  return {
    session: storedSession({ run, profile }), proof: `${run.dungeonId} nightmare clear awards a new elite contract stamp`,
    async show(page, { text, capture }) {
      await text(page.locator('#recruit.on .meta-contract-stamp'), '홍련 화산 · ' + name);
      await capture();
      await page.locator('#recruit.on #meta-recruit-confirm').click();
      await page.locator('#hub.on [data-meta-page="records"]').click();
      await page.locator('#records.on [data-nightmare-record="ember_volcano"]').click();
      const stamps = page.locator('#sheet.on tr');
      await text(stamps.filter({ hasText: name }).locator('td'), '획득', { exact: true });
      for (const contract of [CONTRACTS.rescue, CONTRACTS.heirloom]) {
        await text(stamps.filter({ hasText: contract.name }).locator('td'), '미획득', { exact: true });
      }
      await capture('records');
    }
  };
}

function orderHint() {
  const profile = snowRabbitProfile();
  const run = makeRun({ seed: 21, floor: 6, tempoVersion: 2, profileView: Meta.startView(profile, 'ember_volcano') });
  const suggested = Run.suggestOrder(run);
  const reserve = run.bench.find(id => !suggested.includes(id));
  const party = [suggested[2], reserve, suggested[0]];
  startBattle(run, { party });
  settleWin(run);
  advance(run);
  reachFloor(run, 8);
  assert.equal(run.doors[0].type, 'boss');
  const session = storedSession({ run, profile });
  command(Run.chooseDoor, run, 0);
  const defaults = Run.defaultParty(run);
  const alternate = Run.suggestOrder(run);
  assert.ok(run.guide.bossOrder);
  assert.deepEqual(defaults, party);
  assert.notDeepEqual(defaults, alternate);
  const name = id => roster.card(id).name;
  return {
    session, proof: `${defaults.join(' → ')} is preserved on entering the boss formation`,
    async show(page, { text }) {
      await page.locator('#hub.on #meta-depart').click();
      const order = page.locator('#order.on');
      for (const [index, id] of defaults.entries()) {
        await text(order.locator(`[data-slot="${index}"] b`), name(id), { exact: true });
      }
      assert.equal(await order.locator('#b-alternate-order').count(), 0);
      await text(order.locator('#b-go'), '이대로 전투 시작', { exact: true });
      assert.equal(await page.evaluate(() => window.__game.run.phase), 'map');
    }
  };
}

function springCount() {
  const run = makeRun({ seed: 7 });
  startBattle(run);
  settleWin(run, { survivors: [true, false, false] });
  advance(run);
  reachFloor(run, 6);
  startBattle(run);
  settleWin(run, { survivors: [true, true, false] });
  advance(run);
  assert.equal(run.floor, 7);
  assert.equal(run.bench.length, 2);
  assert.ok(run.crystals >= Run.COST.draw);
  const spring = TERMS.spring.detail;
  const altar = '현재 2명 중 한 명 축복';
  return {
    session: storedSession({ run }), proof: `floor 7 with ${run.bench.length} living fighters and ${run.crystals} crystals`,
    async show(page, { text, capture }) {
      await text(page.locator('#map.on [data-door="0"] .door-risk'), spring);
      await text(page.locator('#map.on [data-door="1"] .door-risk'), altar);
      await capture();
      const springInfo = await openDoorInfo(page, 0);
      await text(springInfo.getByText(spring, { exact: true }), spring);
      await text(springInfo.getByText(`보유 결정 ${run.crystals}개`), `보유 결정 ${run.crystals}개`);
      await capture('info');
      await page.locator('#b-sheetclose').click();
      const altarInfo = await openDoorInfo(page, 1);
      await text(altarInfo.getByText(altar, { exact: true }), altar);
    }
  };
}

function retreatOutcomes() {
  const run = makeRun({ dungeonId: 'dawn_forest', seed: 7 });
  command(Run.chooseDoor, run, 0);
  command(Run.confirmOrder, run, INTRO.party);
  const battle = Bridge.create(core, Run.battleOptions(run));
  const ready = battle.start().findLast(event => event.t === 'await');
  const { allies, cur } = battle.state();
  const preview = battle.previewRetreat();
  const next = allies[preview.next.idx];
  const [low, high] = preview.dmg;
  const after = Math.max(0, next.hp - high);
  const maxAfter = Math.max(0, next.hp - low);
  assert.ok(allies[cur].hp <= ready.intent.dmg[0]);
  const retreat = `${next.name} HP ${next.hp} → ${after === maxAfter ? after : `${after}~${maxAfter}`}`;
  return {
    session: storedSession({ run }), proof: `${allies[cur].hp} HP vs. minimum ${ready.intent.dmg[0]} damage; ${retreat}`,
    async show(page, { text }) {
      await battleIdle(page);
      await page.locator('#b-retreat').click();
      const button = page.locator('#b-retreat.armed');
      await text(button, '애쉬 생존 · 다음 동료가 이번 공격을 받음');
      await text(button, retreat);
      await text(page.locator('#turn'), '1턴');
    }
  };
}

function openingFixture(rescue) {
  const run = makeRun({ dungeonId: 'dawn_forest', seed: 7, tempoVersion: 2 });
  const battle = startBattle(run, { party: INTRO.party });
  const model = openingModel(battle);
  assert.equal(model.stand.actorId, 'ash');
  assert.deepEqual(model.stand.damageRange, [80, 80]);
  assert.equal(model.rescue.incomingHpAfter, 149);
  const first = rescue ? battle.retreat() : battle.act(model.stand.optionIndex);
  const second = act(battle, rescue ? '실버스톰' : '아마겟돈');
  const summary = battle.summary();
  assert.equal(summary.outcome, 'win');
  assert.equal(summary.survivors.filter(Boolean).length, rescue ? 3 : 2);
  command(Run.settleBattle, run, summary);
  assert.equal(run.openingLead, rescue ? 'ash' : 'snow_rabbit');
  return { run, first, second, model };
}

function openingChoices() {
  openingFixture(false);
  openingFixture(true);
  return {
    session: null, seed: 7, proof: 'Seed 7: rescue leaves snow_rabbit at 149 HP and Ash leads; stand leaves Armageddon and snow_rabbit leads',
    async show(page, { text, capture }) {
      await text(page.locator('#title.on .title-relay'), '쓰러진 동료가 다음 동료의 힘이 된다');
      await capture('title');
      await page.locator('#b-start').click();
      await battleIdle(page);
      const choice = page.locator('#acts .opening-choice');
      assert.equal(await choice.count(), 2);
      await text(page.locator('#opening-face'), 'HP 40 / 420');
      await text(choice.nth(0), '눈토끼 HP 290 → 149');
      for (const id of ['b-speed', 'b-log', 'b-field']) assert.equal(await page.locator('#' + id).isVisible(), false);
      await text(choice.nth(1), '쓰러지면 눈토끼가 아마겟돈을 계승');
      await capture();
      await page.locator('.coach-skip').click();
      await choice.nth(0).click();
      await battleIdle(page);
      const tour = page.locator('.coach[data-coach-step="tour-last-stand"] .coach-next');
      if (await tour.isVisible()) await tour.click();
      await skillTile(page, '실버스톰').click();
      await text(page.locator('#result.on #b-next'), '다음 동료 고르기');
      await capture('rescue');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('#result.on #b-result-log').click();
      await text(page.locator('#sheet.on .battle-log-row.retreat'), '애쉬');
    }
  };
}

function openingAwaken() {
  const { run } = openingFixture(false);
  advance(run);
  command(Run.chooseDoor, run, 0);
  const session = storedSession({ run });
  assert.equal(run.pending.remaining, 1);
  assert.deepEqual(run.bench, ['snow_rabbit']);
  const id = run.pending.candidates[0];
  const { awakened } = command(Run.chooseStartPick, run, id);
  assert.equal(awakened.length, 3);
  assert.deepEqual(run.bench, ['snow_rabbit', id, ...awakened]);
  return {
    session, motion: 'no-preference', proof: ['snow_rabbit', id, ...awakened].join(' + '),
    async show(page, { text, capture }) {
      await text(page.locator('#awaken.on .wake-lead'), '눈토끼');
      await text(page.locator('#awaken.on .wake-lead'), '아마겟돈');
      await capture('companion');
      await page.locator(`#wake-choices [data-id="${id}"]`).click();
      await page.locator('#b-wake').click();
      await page.locator('#b-wake-skip').click();
      await text(page.locator('.wake-summary'), '선택 동료 2명 · 추가 합류 3명 · 결정 1', { exact: true });
      assert.deepEqual(await page.locator('.wake-slot.landed [data-sheet]').evaluateAll(nodes => nodes.map(node => node.dataset.sheet)), awakened);
      await capture();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await text(page.locator('.wake-summary'), '선택 동료 2명 · 추가 합류 3명 · 결정 1');
    }
  };
}

function formationBoard() {
  const run = makeRun({ seed: 7, tempoVersion: 2 });
  command(Run.chooseDoor, run, 0);
  const { blessing, party } = Run.getTempoView(run, 0);
  run.blessings[blessing.id] = .4;
  const blessed = blessingText(Run.getBlessingView(run, 0, party, blessing.id));
  const reserve = run.bench.find(id => !party.includes(id));
  const expected = [reserve, party[2], party[1]];
  const session = storedSession({ run });
  command(Run.confirmOrder, run, expected);
  assert.deepEqual(Run.battleOptions(run).party, expected);
  return {
    session, proof: `${blessing.id} ×${blessing.multiplier}, bench to front, then middle and rear swap`,
    async show(page, { text, capture }) {
      const order = page.locator('#order.on');
      const slot = i => order.locator(`[data-slot="${i}"]`);
      await text(order.locator('.seat-blessing'), blessed, { exact: true });
      const blessedSlot = party.indexOf(blessing.id);
      const blessedButton = blessedSlot < 0 ? order.locator(`[data-bench="${blessing.id}"]`) : slot(blessedSlot);
      await blessedButton.click();
      await order.locator('#b-formation-info').click();
      await text(page.locator('#sheet.on .seat-blessing'), blessed, { exact: true });
      await page.locator('#b-sheetclose').click();
      await blessedButton.click();
      const positions = await Promise.all([0, 1, 2].map(i => slot(i).boundingBox()));
      assert.equal(new Set(positions.map(pos => pos.y)).size, 1);
      const sprites = await Promise.all([0, 1, 2].map(i => slot(i).locator('.relay-seat-art img').boundingBox()));
      const native = await order.locator('.relay-seat-art img').evaluateAll(images => images.map(img => [img.naturalWidth, img.naturalHeight]));
      assert.deepEqual(sprites.map(pos => [pos.width, pos.height]), native, 'Formation uses native 1× art');
      const feet = await page.evaluate(ids => ids.map(id => window.RELAY_ASSETS.sp[id + '-idle'].fy + 1), party);
      assert.equal(new Set(sprites.map((pos, index) => pos.y + feet[index])).size, 1);
      for (const [i, seat] of positions.slice(0, 2).entries()) {
        const link = await order.locator(`[data-link="${i}"]`).boundingBox();
        assert.ok(link.x >= seat.x + seat.width && link.x + link.width <= positions[i + 1].x);
        assert.ok(Math.abs(link.y + link.height / 2 - (seat.y + seat.height / 2)) <= 1);
      }
      const reserveFace = await order.locator(`[data-bench="${reserve}"] .run-face`).boundingBox();
      assert.deepEqual([reserveFace.width, reserveFace.height], [40, 40]);
      const depart = await order.locator('#b-go').boundingBox();
      assert.ok(depart && depart.y >= 0 && depart.y + depart.height <= viewport.height);
      await order.locator(`[data-bench="${reserve}"]`).click();
      await slot(0).click();
      await slot(1).click();
      await slot(2).click();
      for (const [i, id] of expected.entries()) await text(slot(i).locator('b'), roster.card(id).name, { exact: true });
      assert.equal(await page.evaluate(() => window.__game.run.room.party), null);
      await capture();
      await order.locator('.relay-link:not([disabled])').first().click();
      await text(page.locator('#sheet.on #sh-title'), '쓰러진 동료가 남긴 기술');
      await capture('heirloom');
      await page.locator('#b-sheetclose').click();
      await openBattle(page);
      assert.deepEqual(await page.evaluate(() => window.__game.run.room.party), expected);
    }
  };
}

function settlePlayedWin(run) {
  const battle = startBattle(run, { party: Run.suggestOrder(run).reverse() });
  for (let i = 0; !battle.outcome && i < 30; i++) {
    const options = battle.options().filter(option => option.usable);
    const power = option => option.preview?.min ?? option.preview?.dmg ?? 0;
    const choice = options.find(option => option.preview?.kill) ?? options.sort((a, b) => power(b) - power(a))[0];
    battle.act(choice.index);
  }
  if (battle.outcome !== 'win') return false;
  command(Run.settleBattle, run, battle.summary());
  return run.pending?.kind === 'reinforcement';
}

function reinforcementBoard() {
  let empty, full, join;
  for (let seed = 0; seed < 32 && !full; seed++) {
    const run = makeRun({ seed, tempoVersion: 2, profileView: { lead: 'red_dragon' } });
    if (!settlePlayedWin(run) || run.bench.length !== 5) continue;
    empty = storedSession({ run });
    join = run.pending.candidates[0];
    command(Run.resolveReinforcement, run, { key: run.pending.key, id: join, replaceId: null });
    advance(run);
    if (settlePlayedWin(run) && run.bench.length === run.pending.limit) full = run;
  }
  assert.ok(full, 'A live seed reaches floor 2 reinforcement at capacity');
  const { key, candidates } = full.pending;
  const id = candidates[0], replaceId = full.bench[0];
  full.blessings[replaceId] = .4;
  const held = Bridge.heirloomSkill(roster.card(id));
  full.heirlooms[replaceId] = { from: id, name: held.name };
  const session = storedSession({ run: full });
  assert.equal(Run.resolveReinforcement(full, { key, id, replaceId: null }).ok, false);
  command(Run.resolveReinforcement, full, { key, id, replaceId });
  assert.equal(Run.resolveReinforcement(full, { key, id, replaceId }).ok, false);
  assert.ok(full.released.includes(replaceId) && full.bench.includes(id));
  return {
    session, proof: `actual battles: join ${join}, then ${replaceId} → ${id} at 6/6; duplicate key rejected`,
    async show(page, { text, capture, revisit }) {
      const screen = page.locator('#result.on .victory-decision');
      await page.locator('#result.on #b-next').click();
      await text(screen.locator('.lead'), '동료 6/6명');
      await screen.locator(`[data-candidate="${id}"]`).click();
      await text(screen.locator(`[data-candidate="${id}"] .heir-offer`), '쓰러질 때 남김 · ' + held.name);
      assert.equal(await screen.locator('#b-reinforce-take').isDisabled(), true);
      await screen.locator(`[data-release="${replaceId}"]`).click();
      await text(screen.locator('.release-loss'), '원정 축복 +40% · 보유 유품 ' + held.name + ' 소실 · 이번 원정 재합류 불가');
      await capture();
      await screen.locator('#b-reinforce-take').click();
      await text(screen.locator('[data-draw-kind="join"]'), '이번 원정 합류');
      await screen.locator('#b-reinforce-done').click();
      await page.locator('#map.on').waitFor();
      assert.deepEqual(await page.evaluate(() => window.__game.run.bench), full.bench);
      await revisit(empty, async source => {
        await source.locator('#result.on #b-next').click();
        await text(source.locator('#result.on .victory-decision .lead'), '무료 합류 · 5/6명');
        await capture('vacancy', source);
        await source.locator('#b-reinforce-pass').click();
        await source.locator('#map.on').waitFor();
        assert.equal(await source.evaluate(() => window.__game.run.bench.length), 5);
      });
    }
  };
}

function tempoTelegraph() {
  const run = makeRun({ seed: 1, tempoVersion: 2, dungeonId: 'starlit_garden', profileView: { lead: 'avalanche_maid' } });
  const battle = startBattle(run);
  const intent = battle.state().turn && battle.previewRetreat().intent;
  assert.equal(intent.kind, 'phy');
  const block = act(battle, '배리어');
  assert.ok(block.some(event => event.t === 'miss' && event.why === 'barrier'));
  const next = block.findLast(event => event.t === 'await');
  assert.equal(next.countdown.inTurns, 0);
  assert.equal(next.intent.name, next.countdown.name);
  const range = ([min, max]) => min === max ? String(min) : min + '~' + max;
  return {
    session: storedSession({ run }), proof: `Barrier stops turn 1; turn 2 announces ${next.intent.name} ${range(next.intent.dmg)}`,
    async show(page, { text, capture }) {
      await openBattle(page);
      await text(skillTile(page, '배리어').locator('.r3'), '다음 물리 차단');
      await tapTile(page, '배리어');
      await text(page.locator('#intent.on'), next.intent.name);
      await text(page.locator('#intent.on'), 'HP ' + range(next.intent.dmg));
      assert.doesNotMatch(await page.locator('#pf-cd').textContent(), new RegExp(next.intent.name));
      await capture();
    }
  };
}

function lastHit() {
  const { second } = openingFixture(false);
  const hit = second.find(event => event.t === 'hp' && event.who.side === 'enemy');
  assert.ok(hit.amount > -hit.delta, 'The last hit must show damage beyond remaining HP');
  const run = makeRun({ dungeonId: 'dawn_forest', seed: 7, tempoVersion: 2 });
  return {
    session: storedSession({ run }), motion: 'no-preference', mute: true,
    proof: `Armageddon ${hit.amount} damage, enemy HP delta ${hit.delta}, Ash's heirloom`,
    async show(page, { text, capture }) {
      await battleIdle(page);
      await page.locator('#acts .stand').click();
      await battleIdle(page);
      await page.evaluate(() => {
        const observer = new MutationObserver(() => {
          if (!document.querySelector('.finish-cast')) return;
          observer.disconnect();
          window.__game.clock.paused = true;
        });
        observer.observe(document.querySelector('#fx'), { childList: true });
      });
      await page.locator('#b-heir').click();
      await text(page.locator('.finish-damage'), String(hit.amount), { exact: true });
      await text(page.locator('.finish-cast'), '유품 원주인');
      await capture('impact', page, { duringBattle: true });
      await page.evaluate(() => { window.__game.clock.paused = false; });
      await text(page.locator('#result.on #b-next'), '다음 동료 고르기');
      const result = page.locator('#result.on #result-in');
      await text(result.locator('h3'), '새벽의 숲 1층 돌파', { exact: true });
      await text(result.locator('.result-fallen'), '애쉬가 쓰러졌습니다.', { exact: true });
      await text(result.locator('.heirline'), '눈토끼가 아마겟돈을 물려받았습니다.');
      assert.equal(await result.locator('img').count(), 1);
      await capture();
      const before = await result.innerHTML();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await result.waitFor();
      assert.equal(await result.innerHTML(), before);
    }
  };
}

function resultOrdinary() {
  const run = makeRun({ dungeonId: 'dawn_forest', seed: 7, floor: 3, tempoVersion: 2 });
  startBattle(run);
  run.crystals = 2;
  run.room.reward = 2;
  const { lastBattleResult } = settleWin(run);
  assert.deepEqual(lastBattleResult.fallenIds, []);
  assert.equal(lastBattleResult.rewardDelta.crystals, 2);
  assert.equal(run.crystals, 4);
  return {
    session: storedSession({ run }), proof: 'Regular win, ◆+2 and balance 4, no death or inheritance',
    async show(page, { text, capture }) {
      const result = page.locator('#result.on');
      await text(result.locator('h3'), '새벽의 숲 3층 돌파', { exact: true });
      await text(result.locator('.gain'), '결정 +2 · 보유 4개', { exact: true });
      assert.equal(await result.locator('.result-fallen, .heirline, img').count(), 0);
      await text(result.locator('#b-next'), '4층으로', { exact: true });
      await capture();
      await result.locator('#b-next').click();
      await page.waitForFunction(() => window.__game.run.floor === 4);
    }
  };
}

function resultBossWipe() {
  const run = makeRun({ seed: 21, floor: 8, tempoVersion: 2 });
  const id = roster.allies.find(id => roster.card(id).skills.some(skill => skill.name === '카오스카니발'));
  run.bench = run.joinOrder = [id];
  const door = run.doors[0];
  door.enemies[0].stats.hp = 1;
  const battle = startBattle(run, { party: [id, null, null] });
  const session = storedSession({ run });
  act(battle, '카오스카니발');
  const { lastBattleResult } = command(Run.settleBattle, run, battle.summary());
  assert.equal(run.result, 'win');
  assert.equal(lastBattleResult.wiped, true);
  assert.deepEqual(lastBattleResult.survivorIds, []);
  assert.deepEqual(Run.runRewards(run).recruitable, []);
  return {
    session, proof: '카오스카니발 defeats the boss and its caster; one return click persists the victory',
    async show(page, { text, capture }) {
      await openBattle(page);
      await skillTile(page, '카오스카니발').click();
      const result = page.locator('#result.on');
      await text(result.locator('h3'), '홍련 화산 8층 돌파', { exact: true });
      await text(result.locator('.result-return'), '보스 격파 · 돌아온 동료 0명', { exact: true });
      await text(result.locator('#b-next'), '관측소로', { exact: true });
      await capture();
      const content = await result.locator('#result-in').innerHTML();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await result.waitFor();
      assert.equal(await result.locator('#result-in').innerHTML(), content);
      await result.locator('#b-next').click();
      await page.locator('#hub.on').waitFor();
      assert.equal(await page.evaluate(() => window.__game.run), null);
    }
  };
}

function compactStage() {
  const run = makeRun({ seed: 21, tempoVersion: 2 });
  const party = ['prism_twin', 'ash', 'silver_rabbit'];
  run.bench = run.joinOrder = party.slice();
  startBattle(run, { party });
  return {
    session: storedSession({ run }), proof: 'Compact stage retains the whole rear silver rabbit and the full Prism Twin name',
    async show(page, { text }) {
      await page.setViewportSize({ width: 390, height: 640 });
      await openBattle(page);
      await text(page.locator('#party [data-i="0"] .top b'), roster.card('prism_twin').name, { exact: true });
      const fits = await page.evaluate(() => {
        const label = document.querySelector('#party [data-i="0"] .top b');
        const actor = window.__game.B.allies[2];
        const source = window.RELAY_ASSETS.sp['silver_rabbit-idle'];
        const height = document.querySelector('#cv').height;
        return label.scrollWidth <= label.clientWidth && height - 22 + actor.y - (source.fy + 1) >= 0;
      });
      assert.equal(fits, true);
    }
  };
}

function repeatSpring(mode) {
  const run = makeRun({ seed: 21, floor: 3, tempoVersion: 2 });
  command(Run.chooseDoor, run, 0);
  run.crystals = 5;
  run.bench = run.joinOrder = ['snow_rabbit', ...roster.allies.filter(id => !['snow_rabbit', 'ash'].includes(id)).slice(0, 5)];
  run.fallen = ['ash'];
  run.pool = [mode === 'memory' ? 'ash' : 'snow_rabbit'];
  run.repeatStacks = { snow_rabbit: 1 };
  const session = storedSession({ run });
  const result = command(Run.springDraw, run);
  assert.deepEqual(result.draw, { kind: mode, id: run.pool[0], targetId: 'snow_rabbit', stacks: 2 });
  assert.equal(run.bench.length, 6);
  return {
    session, proof: mode === 'memory' ? 'Ash memory powers Snow Rabbit to ★2 at 6/6' : 'Snow Rabbit repeat powers up to ★2 at 6/6',
    async show(page, { text }) {
      await page.locator('#spring.on #b-draw').click();
      await text(page.locator(`#fresh [data-draw-kind="${mode}"] .draw-receipt`), mode === 'memory'
        ? '애쉬의 기억 → 눈토끼 · 공격·마공 +10%' : '눈토끼 · 이미 함께 · 강화 ★2 · 공격·마공 +10%', { exact: true });
      await text(page.locator('#fresh .repeat-stack'), '★2', { exact: true });
      await text(page.locator('#spring.on .gems'), '◆ 4', { exact: true });
      assert.equal(await page.locator('#sheet.on').count(), 0);
      assert.equal(await page.evaluate(() => window.__game.run.bench.length), 6);
    }
  };
}

function springRates() {
  const run = makeRun({ seed: 21, floor: 3, tempoVersion: 2 });
  command(Run.chooseDoor, run, 0);
  run.crystals = 5;
  const owned = run.bench[0];
  const grade = gradeOf(roster.card(owned).grade);
  const invited = roster.allies.find(id => !run.bench.includes(id) && gradeOf(roster.card(id).grade) === grade);
  run.pool = [owned, invited];
  run.companions = [invited];
  const expected = ['draw', 'pick'].map(kind => ratesView(run, kind));
  assert.deepEqual(expected.map(groups => groups.map(group => group.percent).sort((a, b) => a - b)), [[0, 0, 0, 100], [0, 0, 0, 100]]);
  let offer;
  for (let serial = 0; serial < 32; serial++) {
    delete run.room.springOffer;
    run.room.springOfferSerial = serial;
    offer = command(Run.getSpringOffer, run);
    if (offer.slots.slice(1).every(slot => slot.id === owned)) break;
  }
  const session = storedSession({ run });
  assert.deepEqual(offer.slots.map(slot => [slot.source, slot.id]), [['invite', invited], ['random', owned], ['random', owned]]);
  const locked = Save.restoreRun(sessionRun(session), { core, roster });
  locked.features = { ...locked.features, springPick: false };
  const lockedSession = storedSession({ run: locked });
  const texts = groups => groups.map(({ label, percent }) => label + ' ' + percent + '%').join(' · ');
  return {
    session, proof: 'Live distribution is 100% in the only available group; two random slots can share an ID',
    async show(page, { text, capture, revisit }) {
      const spring = page.locator('#spring.on');
      await text(spring.locator('#b-draw'), TERMS.spring.detail);
      await text(spring.locator('.spring-service').nth(1), '무작위 한 칸당');
      for (const [index, groups] of expected.entries()) {
        const details = spring.locator('.spring-rates').nth(index);
        await text(details.locator('summary'), texts(groups), { exact: true });
        await details.locator('summary').click();
        await text(details.locator('p').first(), '전설·초월·이벤트 포함', { exact: true });
        await text(details.locator('p').last(), groups.map(group => group.label + ' ' + group.count + '명').join(' · '), { exact: true });
      }
      await capture();
      await spring.locator('#b-pick').click();
      await text(spring.locator('[data-slot-id="1"]'), '초대 확정 · ' + roster.card(invited).name);
      for (const slot of ['2', '3']) await text(spring.locator(`[data-slot-id="${slot}"][data-id="${owned}"]`), '무작위');
      await spring.locator('[data-slot-id="3"]').click();
      assert.equal(await spring.locator('[data-slot-id="2"].sel').count(), 0);
      await spring.locator('#b-take').click();
      await text(spring.locator('[data-draw-kind="boost"] .draw-receipt'), '강화 ★1');
      await text(spring.locator('.gems'), '◆ 2', { exact: true });
      await revisit(lockedSession, async lockedPage => {
        assert.equal(await lockedPage.locator('#spring.on #b-pick, #spring.on .spring-service:nth-child(2)').count(), 0);
      });
    }
  };
}

function groupedBattleLog() {
  const run = makeRun({ seed: 1, profileView: { lead: 'guardian' } });
  const battle = startBattle(run);
  const events = act(battle, '판게아리버스');
  for (let i = 0; i < 3; i++) events.push(...act(battle, '가드'));
  const groups = battleLog(events, run.room.party, run.room.enemies);
  const cast = groups.find(group => group.turn === 1).rows.find(row => row.kind === 'reserve');
  const hit = groups.find(group => group.turn === 5).rows.find(row => row.origin === cast.key);
  assert.ok(hit.amount > 0 && cast.hits.some(entry => entry.key === hit.key));
  const { run: intro, first, second } = openingFixture(true);
  const loss = openingFixture(false);
  const lossLog = battleLog([...loss.first, ...loss.second], loss.run.room.party, loss.run.room.enemies);
  assert.ok(lossLog[0].rows.some(row => row.kind === 'down' && row.faces[0].id === 'ash'));
  assert.ok(lossLog[0].rows.some(row => row.kind === 'heirloom' && row.faces[1].id === 'snow_rabbit'));
  intro.lastBattleLog = battleLog([...first, ...second], intro.room.party, intro.room.enemies);
  assert.ok(intro.lastBattleLog[0].rows.some(row => row.kind === 'retreat' && row.faces[0].id === 'ash'));
  return {
    session: storedSession({ run }), proof: `1턴 판게아리버스 예약 → 5턴 발동 · ${hit.amount}; Ash retreat, death and heirloom with names`,
    async show(page, { text, capture, revisit }) {
      await openBattle(page);
      await text(skillTile(page, '판게아리버스').locator('.r2'), '5턴에 적중');
      await tapTile(page, '판게아리버스');
      for (let i = 0; i < 3; i++) await tapTile(page, '가드');
      await page.locator('#b-log').click();
      const sheet = page.locator('#sheet.on');
      await text(sheet.locator('.trigger'), '5턴 발동 · ' + hit.amount);
      assert.equal(await sheet.locator('[data-latest-turn]').evaluate(node => node === document.activeElement), true);
      await capture();
      await sheet.locator('.trigger [data-log-jump]').click();
      await text(sheet.locator('.reserve'), '1턴 판게아리버스 예약');
      await capture('reservation');
      await revisit(storedSession({ run: intro }), async source => {
        await source.locator('#result.on #b-result-log').click();
        const retreat = source.locator('#sheet.on .battle-log-row.retreat');
        await text(retreat, '애쉬');
        assert.equal(await source.locator('#sheet.on .battle-log-row img').count(), 0);
        assert.equal(await retreat.locator('.log-name.ally').count(), 1);
        await capture('resumed', source);
      });
    }
  };
}

function mapAwakenFaces() {
  const run = Run.createRun({ core, roster, dungeonId: 'ember_volcano', seed: 7 });
  command(Run.chooseStartPick, run, run.pending.candidates[0]);
  const pick = run.pending.candidates[0];
  const session = storedSession({ run });
  const result = command(Run.chooseStartPick, run, pick);
  assert.equal(result.awakened.length, 3);
  return {
    session, proof: 'First main map reveals three random companions while the entrance is available',
    async show(page, { text, capture }) {
      if (await page.locator('#hub.on').count()) await page.locator('#hub.on #meta-depart').click();
      await page.locator(`#awaken.on #wake-choices [data-id="${pick}"]`).click();
      await page.locator('#awaken.on #b-wake').click();
      await page.locator('#order.on #b-order-back').click();
      await text(page.locator('#map.on .map-awaken > b'), '함께 깨어남');
      const faces = page.locator('#map.on .map-awaken button');
      assert.deepEqual(await faces.evaluateAll(nodes => nodes.map(node => node.dataset.sheet)), result.awakened);
      assert.equal(await page.locator('#map.on [data-door="0"]').isEnabled(), true);
      await page.waitForFunction(() => [...document.querySelectorAll('.map-awaken button')].every(node =>
        node.getAnimations().every(animation => animation.effect.getComputedTiming().endTime <= 770)));
      await capture();
    }
  };
}

function truthfulHud() {
  const run = makeRun({ dungeonId: 'twilight_cathedral', seed: 21, floor: 2, tempoVersion: 2,
    profileView: { lead: 'frozen_witch' } });
  run.doors[0].enemies[0].affixes = ['tough', 'leech'];
  command(Run.chooseDoor, run, 0);
  command(Run.confirmOrder, run, Run.defaultParty(run));
  const battle = Bridge.create(core, Run.battleOptions(run));
  const events = battle.start();
  const first = act(battle, '일반 공격');
  events.push(...first);
  const intent = first.findLast(event => event.t === 'await').intent;
  assert.equal(intent.rule, 'mana_drain');
  assert.deepEqual(intent.damageRange, [0, 0]);
  const [current] = intentLines(intent);
  assert.match(current, /HP 0 \/ 현재 MP −12/);
  assert.match(intentLines({ kind: 'mag', damageRange: [125, 375], lethalText: '쓰러질 수 있음',
    conditions: [{ kind: 'enemyHitThisTurn', whenMet: 375, otherwise: 125, met: null }] })[0], /피격 시 375 \/ 미피격 시 125 · 쓰러질 수 있음/);
  const affixes = affixLines(battle.state().enemy);
  assert.equal(affixes.find(affix => affix.id === 'tough').turns, 2);
  const block = act(battle, '매직가드');
  events.push(...block);
  const expected = 'MP 소멸 예고 → 매직가드로 차단';
  assert.ok(battleLog(events, run.room.party, run.room.enemies).flatMap(turn => turn.rows).some(row => row.text === expected));
  return {
    session: storedSession({ run }), proof: 'Turn 2 damage 0 / MP −12, tough remaining 2, Magic Guard blocks the rule',
    async show(page, { text, capture }) {
      await openBattle(page);
      await tapTile(page, '일반 공격');
      await text(page.locator('#pf-kind'), '다음 마법');
      await text(page.locator('#intent.on'), current, { exact: true });
      await text(page.locator('#pf-chips .affix').filter({ hasText: '단단함' }), '피해 반감 2턴 남음');
      await capture('hud');
      await page.evaluate(() => {
        const observer = new MutationObserver(() => {
          if (!document.querySelector('.strong-call')) return;
          observer.disconnect();
          window.__game.clock.paused = true;
        });
        observer.observe(document.querySelector('#fx'), { childList: true });
      });
      await skillTile(page, '매직가드').click();
      await text(page.locator('.strong-call'), intent.name);
      assert.equal(await page.locator('.skillplate').count(), 0);
      await capture('strong', page, { duringBattle: true });
      await page.evaluate(() => { window.__game.clock.paused = false; });
      await battleIdle(page);
      await page.locator('#b-log').click();
      await text(page.locator('#sheet.on .forecast').filter({ hasText: expected }), expected);
    }
  };
}

function blessingParity() {
  const run = makeRun({ seed: 21, tempoVersion: 2 });
  run.bench = run.joinOrder = ['snow_rabbit', 'gold_dragon', 'ash', 'entropy'];
  run.blessings.snow_rabbit = .4;
  run.doors[0].tempo.blessing = { id: 'snow_rabbit', multiplier: 1.6 };
  const session = storedSession({ run });
  const before = Run.getBlessingView(run, 0, Run.defaultParty(run), 'snow_rabbit');
  assert.equal(before.stats.hp, 464);
  const party = ['snow_rabbit', 'entropy', 'ash'];
  const boosted = Run.getBlessingView(run, 0, party, 'snow_rabbit');
  assert.equal(boosted.stats.hp, 638);
  assert.equal(boosted.effectiveBonus, 1.2);
  return {
    session, proof: 'Snow Rabbit’s 60% / 464 HP becomes 120% / 638 HP with Entropy, matching both sheets',
    async show(page, { text, capture }) {
      const map = page.locator('#order.on');
      const seat = map.locator('.relay-seat[data-slot="0"] .seat-blessing');
      await text(seat, blessingText(before), { exact: true });
      await map.locator('[data-bench="entropy"]').click();
      await map.locator('.relay-seat[data-slot="1"]').click();
      await text(seat, blessingText(boosted), { exact: true });
      await map.locator('.relay-seat[data-slot="0"]').click();
      await map.locator('#b-formation-info').click();
      await text(page.locator('#sheet.on .seat-blessing'), blessingText(boosted), { exact: true });
      await text(page.locator('#sheet.on .sg').getByText('638', { exact: true }), '638');
      await capture('formation');
      await page.locator('#b-sheetclose').click();
      await openBattle(page);
      await page.locator('#party [data-i="0"]').click();
      await text(page.locator('#sheet.on .seat-blessing'), blessingText(boosted), { exact: true });
      await text(page.locator('#sheet.on .ih small'), 'HP 638/638');
    }
  };
}

function springCommit() {
  const run = makeRun({ seed: 21, floor: 3, tempoVersion: 2 });
  command(Run.chooseDoor, run, 0);
  assert.equal(run.room.type, 'spring');
  run.crystals = 5;
  const session = storedSession({ run });
  const offer = command(Run.getSpringOffer, run);
  const selected = offer.slots.find(slot => !run.bench.includes(slot.id) && !run.fallen.includes(slot.id));
  assert.ok(selected);
  assert.equal(run.crystals, 5);
  assert.deepEqual(command(Run.getSpringOffer, run), offer);
  const legacy = Save.restoreRun(sessionRun(session), { core, roster });
  legacy.lessonVersion = 0;
  delete legacy.drawRuleVersion;
  command(Run.springPick, legacy);
  const prepaid = storedSession({ run: legacy });
  const oldOffer = command(Run.getSpringOffer, legacy);
  assert.equal(command(Run.commitSpringOffer, legacy, { key: oldOffer.key, id: oldOffer.candidates[0] }).charged, 0);
  const full = Save.restoreRun(sessionRun(session), { core, roster });
  const extra = full.pool.find(id => !full.bench.includes(id) && id !== full.reserved);
  full.bench.push(extra);
  assert.equal(full.bench.length, 6);
  assert.equal(command(Run.commitSpringOffer, run, { offerKey: offer.offerKey, slotId: selected.slotId }).charged, 3);
  assert.equal(Run.commitSpringOffer(run, { offerKey: offer.offerKey, slotId: selected.slotId }).ok, false);
  return {
    session, proof: 'Closing costs 0, same candidates, one ◆3 commit, legacy prepaid charges 0',
    async show(page, { text, capture, revisit }) {
      const spring = page.locator('#spring.on');
      await spring.locator('#b-pick').click();
      const candidates = () => spring.locator('.cardrow').evaluateAll(nodes => nodes.map(node => node.dataset.id));
      assert.deepEqual(await candidates(), offer.candidates);
      await spring.locator('#b-spring-pass').click();
      await text(spring.locator('.gems'), '◆ 5');
      await spring.locator('#b-pick').click();
      assert.deepEqual(await candidates(), offer.candidates);
      await spring.locator(`[data-slot-id="${selected.slotId}"]`).click();
      await text(spring.locator('#b-take'), '합류 · ◆3');
      await capture();
      await spring.locator('#b-take').click();
      await text(spring.locator('.gems'), '◆ 2');
      await revisit(storedSession({ run: full }), async source => {
        await text(source.locator('#spring.on #b-draw'), TERMS.spring.detail);
        await capture('full', source);
      });
      await revisit(prepaid, async source => {
        await source.locator('#spring.on .cardrow').first().click();
        await text(source.locator('#spring.on #b-take'), '결제 완료');
        await capture('prepaid', source);
        await source.locator('#spring.on #b-take').click();
        assert.equal(await source.evaluate(() => window.__game.run.crystals), 2);
      });
    }
  };
}

function sessionRun(session) { return JSON.parse(session).run; }

function eventValues() {
  function eventRun(id, dungeonId, floor = 3) {
    const run = makeRun({ dungeonId, seed: 21, floor, tempoVersion: 2 });
    const door = run.doors.find(door => door.type === 'event');
    door.event = eventForRun(EVENTS.find(event => event.id === id), run);
    command(Run.chooseDoor, run, door.index);
    run.crystals = 5;
    return run;
  }
  const alms = eventRun('dainichi_alms_bowl', 'starlit_garden');
  const who = alms.bench[0];
  alms.blessings[who] = .4;
  assert.deepEqual(eventChoices(alms, core, roster)[0].blessingChanges[who], { before: .4, after: .1 });
  const kobold = eventRun('kobold_boot_exchange', 'ember_volcano');
  const exchange = eventChoices(kobold, core, roster).find(choice => choice.id === 'exchange');
  const target = exchange.targets[0];
  assert.ok(exchange.netCrystals[target] >= 0);
  const whale = eventRun('whale_third_peal', 'twilight_cathedral');
  const ice = eventRun('penguin_ice_seam', 'midnight_trench');
  ice.bench = ice.bench.filter(id => !core.GameUtils.cardMatchesElement(roster.card(id), 'water'));
  assert.match(eventChoices(ice, core, roster).find(choice => choice.id === 'carry').text, /물 동료 없음/);
  const rolls = eventRun('rollcall_ends', 'arena');
  rolls.bench = roster.allies.filter(id => !['discipline_captain', 'werebear'].includes(id)).slice(0, 6);
  for (const id of ['discipline_captain', 'werebear']) if (!rolls.pool.includes(id)) rolls.pool.push(id);
  assert.equal(eventChoices(rolls, core, roster).find(choice => choice.id === 'pair').requiredReleases, 2);
  const mimic = eventRun('mimic_paybox', 'ember_volcano');
  const venom = eventRun('venom_five_knots', 'midnight_trench', 5);
  assert.equal(eventChoices(venom, core, roster).find(choice => choice.id === 'hold').cost, 1);
  return {
    session: storedSession({ run: alms }), proof: 'Blessing old/new, kobold net, whale bet, no water, roll-call releases, mimic pay, venom schedule',
    async show(page, { text, capture, revisit }) {
      await text(page.locator('#event.on [data-choice="level"]'), '원정 +40% → +10%');
      await capture();
      await revisit(storedSession({ run: kobold }), async source => {
        await source.locator('#event.on [data-choice="exchange"]').click();
        await source.locator(`#sheet.on [data-id="${target}"]`).click();
        await text(source.locator('#event-target-effect'), '순수입 ◆' + exchange.netCrystals[target]);
        await capture('kobold', source);
      });
      for (const [label, run, choice, line] of [
        ['whale', whale, 'peal', '다음 전투 3턴에 적 하나 처치 후 승리'],
        ['penguin', ice, 'carry', '물 동료 없음'],
        ['roll-call', rolls, 'pair', '보낼 동료 2명 필요'],
        ['mimic', mimic, 'porter', '계약금 ◆1'],
        ['venom', venom, 'hold', '다음 턴부터 매턴 1회·최대 5회']
      ]) await revisit(storedSession({ run }), async source => {
        const button = source.locator(`#event.on [data-choice="${choice}"]`);
        await text(button, line);
        await button.scrollIntoViewIfNeeded();
        await capture(label, source);
      });
    }
  };
}

function returnedBattleLog() {
  const profile = snowRabbitProfile();
  const run = makeRun({ seed: 7, floor: 8, profileView: Meta.startView(profile, 'ember_volcano') });
  startBattle(run);
  settleWin(run);
  assert.equal(run.phase, 'done');
  const row = 'MP 소멸 예고 → 매직가드로 차단';
  run.lastBattleLog = [{ turn: 7, rows: [{ key: 1, text: row, faces: [], kind: 'forecast' }] }];
  return {
    session: storedSession({ run, profile }), proof: 'Confirm the return, then reopen the persisted last battle',
    async show(page, { text }) {
      await page.locator('#recruit.on #meta-recruit-confirm').click();
      await page.locator('#hub.on [data-meta-page="records"]').click();
      await page.locator('#records.on #meta-latest-record').click();
      await page.locator('#sheet.on #meta-latest-battle').click();
      await text(page.locator('#sheet.on .forecast'), row);
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).profile.ui.latestRun.lastBattleLog.length, sessionKey), 1);
    }
  };
}

function treasureReceiptFlow() {
  const run = makeRun({ seed: 1, floor: 5 });
  command(Run.chooseDoor, run, run.doors.find(door => door.type === 'treasure').index);
  const session = storedSession({ run });
  const result = command(Run.takeTreasure, run);
  assert.ok(result.relic.equipped);
  const id = result.relic.id;
  assert.equal(Run.takeTreasure(run).ok, false);
  return {
    session, proof: 'Empty treasure slot equips once, shows the receipt inline, and advances without a second tap',
    async show(page, { text, capture }) {
      await page.locator('#treasure.on #b-equip').click();
      await text(page.locator('#treasure.on .relic-receipt'), '장착 완료');
      await page.locator('#map.on').waitFor();
      await text(page.locator('#map.on .map-receipt'), '장착 완료');
      assert.deepEqual(await page.evaluate(() => window.__game.run.relics), [id]);
      await capture();
    }
  };
}

async function enterObservatory(page) {
  const title = page.locator('#title.on #b-start');
  if (await title.count()) await title.click();
  await page.locator('#hub.on').waitFor();
}

function mainReturn(profile, dungeonId, difficulty = 'normal', seed = 7) {
  const run = makeRun({ dungeonId, seed, floor: 8, difficulty, profileView: Meta.startView(profile, dungeonId) });
  startBattle(run);
  settleWin(run);
  Run.finishRun(run, new Date(...riftDate));
  return run;
}

function applyReturn(profile, run, selection) {
  const result = Meta.applyRunEnd(profile, run, selection);
  assert.ok(result.announce.ok, result.announce.reason);
  return result;
}

function nextGoalLine() {
  const profile = snowRabbitProfile();
  const goal = Meta.nextGoal(profile, null);
  assert.equal(goal.target.screen, 'dungeons');
  assert.equal(goal.reward, '샘 초대 1칸 열림');
  return {
    session: storedSession({ profile }), proof: 'Real intro return sets the first main goal and names its reward',
    async show(page, { text, capture }) {
      await enterObservatory(page);
      await text(page.locator('#hub.on .meta-next-goal'), '눈토끼와 본편 출발 · 샘 초대 1칸 열림', { exact: true });
      await capture();
      await page.locator('#hub.on #meta-depart').click();
      await text(page.locator('#sheet.on #sh-title'), DUNGEONS[goal.target.dungeonId].name + ' · 준비');
    }
  };
}

function endingGoal() {
  let profile = snowRabbitProfile();
  for (const id of ['ember_volcano', 'twilight_cathedral', 'starlit_garden', 'creation_tower']) {
    profile = applyReturn(profile, mainReturn(profile, id, 'easy')).profile;
    assert.equal(profile.records.clears[id].easy, 1);
    assert.ok(!profile.nightmareUnlocks.includes(id));
  }
  const goal = Meta.nextGoal(profile, null);
  assert.equal(goal.target.dungeonId, 'midnight_trench');
  return {
    session: storedSession({ profile }), proof: 'Four dream clears unlock the ending; the next goal points to an unreturned theme',
    async show(page, { text, capture }) {
      await page.locator('#title.on #b-start').click();
      await text(page.locator('#ending.on .meta-record-table'), '5곳 · 새벽의 숲');
      await text(page.locator('#ending.on .meta-next-goal'), goal.text);
      await capture();
      await page.locator('#ending.on #meta-ending-finish').click();
      await text(page.locator('#hub.on .meta-next-goal'), goal.text);
      await page.locator('#hub.on [data-meta-page="notebook"]').click();
      await page.locator('#notebook.on [data-chapter="6"]').click();
      await text(page.locator('#notebook.on .meta-progress'), '생환 3개 지역');
      await page.locator('#notebook.on .meta-back').click();
      await page.locator('#hub.on [data-meta-page="records"]').click();
      const row = page.locator('#records.on .meta-clear-table tr').filter({ hasText: '홍련 화산' });
      await text(row.locator('td').first(), '1회', { exact: true });
      await capture('dream-record');
    }
  };
}

function preDepartureRoster() {
  const dungeonId = 'ember_volcano';
  const original = nightmareProfile();
  const base = expeditionPool(roster, dungeonId).baseIds;
  assert.deepEqual(Object.keys(DUNGEONS).map(id => expeditionPool(roster, id).baseIds.length), [14, 39, 40, 39, 40, 37, 130]);
  const id = base.find(id => id !== original.lead && !original.seenCharacters.includes(id));
  const sealed = base.find(other => other !== id && other !== original.lead);
  const { profile, announce } = Meta.setSeals(original, dungeonId, [sealed], roster);
  assert.ok(announce.ok, announce.reason);
  const view = Meta.startView(profile, dungeonId);
  const pool = expeditionPool(roster, dungeonId, view);
  const reference = Run.createRun({ core, roster, dungeonId, seed: 7, profileView: view });
  assert.deepEqual(pool.effectiveIds, reference.pool);
  return {
    session: storedSession({ profile }), seed: 7, proof: `39 base, ${pool.effectiveIds.length} candidates with ${sealed} sealed and ${id} unseen`,
    async show(page, { text, capture }) {
      await enterObservatory(page);
      await page.locator('#hub.on #meta-telescope').click();
      await page.locator('#dungeons.on [data-locked-roster="creation_tower"]').click();
      await text(page.locator('#sheet.on .meta-roster'), '기본 130명');
      assert.doesNotMatch(await page.locator('#sheet.on .meta-roster').innerText(), /이번 원정 후보/);
      await page.locator('#b-sheetclose').click();
      await page.locator('#dungeons.on [data-dungeon="ember_volcano"]').click();
      const grid = page.locator('#sheet.on .meta-prep-pool');
      assert.equal(await grid.locator('[data-prep-id]').count(), Meta.prepView(profile, dungeonId, roster).pool.length);
      await text(grid.locator(`[data-prep-id="${sealed}"] small`), '출현 제외');
      await text(grid.locator(`[data-prep-id="${id}"] b`), roster.card(id).name);
      await capture();
      await page.locator('#meta-start-expedition').click();
      const live = await page.evaluate(() => {
        const { pool, rng, seed } = window.__game.run;
        return { pool, rng, seed };
      });
      assert.deepEqual(live, { pool: reference.pool, rng: reference.rng, seed: reference.seed });
    }
  };
}

function difficultyChoice() {
  const profile = snowRabbitProfile();
  assert.deepEqual(Meta.availableDungeons(profile).find(dungeon => dungeon.id === 'ember_volcano').difficulties, ['easy', 'normal']);
  return {
    session: storedSession({ profile }), proof: 'First main departure offers dream and journey; nightmare is gated',
    async show(page, { text, capture }) {
      await enterObservatory(page);
      const sheet = page.locator('#sheet.on');
      const chooseRegion = id => page.locator(`#dungeons.on [data-dungeon="${id}"]`).click();
      await page.locator('#hub.on #meta-telescope').click();
      await chooseRegion('ember_volcano');
      assert.equal(await sheet.locator('[data-difficulty="normal"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await sheet.locator('[data-difficulty="nightmare"]').isDisabled(), true);
      await text(sheet.locator('.meta-prep'), '이 지역을 여정으로 생환하면 악몽이 열립니다.');
      await sheet.locator('[data-difficulty="easy"]').click();
      await text(sheet.locator('.meta-prep'), '꿈결 · 적 공격·마공 35% 감소');
      await capture();
      await page.locator('#b-sheetclose').click();
      await chooseRegion('twilight_cathedral');
      assert.equal(await sheet.locator('[data-difficulty="normal"]').getAttribute('aria-pressed'), 'true');
      await page.locator('#b-sheetclose').click();
      await chooseRegion('ember_volcano');
      assert.equal(await sheet.locator('[data-difficulty="easy"]').getAttribute('aria-pressed'), 'true');
      await page.locator('#b-sheetclose').click();
      const quick = page.locator('#dungeons.on #meta-quick-start');
      await text(quick, '홍련 화산 · 꿈결 · 바로 출발', { exact: true });
      await quick.click();
      assert.equal(await page.evaluate(() => window.__game.run.difficulty), 'easy');
    }
  };
}

// The destination list itself: open regions as stage cards, the rest locked with their unlock rule.
function destinations() {
  const profile = snowRabbitProfile();
  return {
    session: storedSession({ profile }), proof: 'After the intro two regions are open as stage cards; the others show how they unlock',
    async show(page, { text }) {
      await enterObservatory(page);
      await page.locator('#hub.on #meta-telescope').click();
      await text(page.locator('#dungeons.on [data-dungeon="ember_volcano"] .meta-dungeon-copy b'), '홍련 화산', { exact: true });
      await text(page.locator('#dungeons.on [data-dungeon="twilight_cathedral"] .meta-dungeon-copy b'), '황혼 성당', { exact: true });
      assert.ok(await page.locator('#dungeons.on .meta-dungeon-locked').count() > 0, 'Later regions stay locked after the intro');
      await text(page.locator('#dungeons.on .meta-dungeon-locked small').first(), '홍련 화산 또는 황혼 성당 생환');
    }
  };
}

function missionInvitations() {
  let profile = snowRabbitProfile();
  const first = applyReturn(profile, mainReturn(profile, 'ember_volcano', 'easy'));
  assert.deepEqual(first.announce.missions, []);
  profile = applyReturn(first.profile, mainReturn(first.profile, 'twilight_cathedral', 'easy')).profile;
  const run = mainReturn(profile, 'starlit_garden', 'easy');
  const candidates = Run.runRewards(run).recruitable;
  const final = applyReturn(profile, run, { recruits: candidates.length === 1 ? candidates : [] });
  assert.deepEqual(final.announce.missions, ['month:2026-11']);
  const weekly = Meta.missionsView(final.profile, roster, new Date(...riftDate)).claimable.find(period => period.kind === 'weekly');
  const candidate = weekly.candidates[0];
  assert.ok(Meta.claimMission(final.profile, weekly.key, candidate, roster).announce.ok);
  return {
    session: storedSession({ profile, run }), now: riftDate,
    proof: 'Weekly reward was earned on return two; three distinct dream returns earn the monthly reward',
    async show(page, { text, capture }) {
      await text(page.locator('#recruit.on .meta-mission-earned'), '동료 초대 가능', { exact: true });
      await capture('return');
      await page.locator('#recruit.on #meta-recruit-confirm').click();
      await page.locator('#hub.on [data-meta-page="notebook"]').click();
      await page.locator('#notebook.on [data-chapter="4"]').click();
      await text(page.locator('#notebook.on .meta-chapter-detail'), '오늘의 균열');
      assert.doesNotMatch(await page.locator('#notebook.on .meta-chapter-detail').innerText(), /악몽/);
      await text(page.locator('#notebook.on [data-mission="weekly"]'), '이번 주');
      await text(page.locator('#notebook.on [data-mission="monthly"]'), '이번 달');
      await capture();
      await page.evaluate(() => window.__gallerySetDate(2026, 11, 1, 12));
      await page.locator('#notebook.on [data-mission="weekly"]').click();
      await page.locator(`#sheet.on [data-invite="${candidate}"]`).click();
      const claim = page.locator('#sheet.on #meta-mission-claim');
      await text(claim, '관측소에 영입', { exact: true });
      await capture('claim');
      await claim.click();
      await text(page.locator('#session-notices p').last(), roster.card(candidate).name + ' · 관측소에 영입');
      assert.equal(await page.locator('#notebook.on [data-mission="weekly"]').count(), 0);
    }
  };
}

function readingSettingsCase() {
  const run = makeRun({ dungeonId: 'twilight_cathedral', seed: 21, floor: 2, tempoVersion: 2,
    profileView: { lead: 'frozen_witch' } });
  const settings = { sound: false, music: false, textScale: 1.25, markers: true, speed: 2 };
  const session = storedSession({ run });
  const battle = startBattle(run, { party: Run.defaultParty(run) });
  const { intent } = act(battle, '일반 공격').findLast(event => event.t === 'await');
  assert.equal(intent.salience, 'strong');
  assert.equal(Save.normalizeSettings(settings).textScale, 1.25);
  return {
    session, settings, proof: 'Old sound switches plus large text, non-color markers, and 2× seed a real fight',
    async show(page, { text, capture }) {
      // Floor 2 forks: the formation and the enter button appear once a door is chosen.
      await page.locator('#map.on [data-door="0"]').click();
      await openBattle(page);
      assert.doesNotMatch(await page.locator('meta[name="viewport"]').getAttribute('content'), /maximum-scale|user-scalable/);
      await text(page.locator('#b-speed'), '2배', { exact: true });
      await tapTile(page, '일반 공격');
      assert.equal(await page.locator('#intent').evaluate(node => getComputedStyle(node, '::before').content.includes('!')), true);
      const lines = await page.locator('#acts .act .tx').evaluateAll(tiles => tiles.map(tile =>
        [...tile.children].filter(line => line.textContent.trim() && getComputedStyle(line).display !== 'none').length));
      assert.ok(lines.every(lines => lines <= 2), `Visible lines per tile: ${lines}`);
      await capture();
      await page.locator('#b-field').click();
      const frozen = await page.evaluate(() => [window.__game.clock.paused, window.__game.clock.t, window.__game.state().turn]);
      assert.equal(frozen[0], true);
      await page.waitForTimeout(150);
      assert.deepEqual(await page.evaluate(() => [window.__game.clock.paused, window.__game.clock.t, window.__game.state().turn]), frozen);
      await page.locator('#b-sheetclose').click();
      await page.locator('#b-speed').click();
      await page.locator('#battle.on .b-set').click();
      await text(page.locator('#sheet.on [data-set="speed"] span'), '1배', { exact: true });
      await page.locator('#sheet.on [data-set="speed"]').click();
      await text(page.locator('#sheet.on [data-set="text"] span'), '크게(125%)', { exact: true });
      assert.equal(await page.evaluate(() => window.__game.clock.speed), 2);
      await capture('options', page, { duringBattle: true });
    }
  };
}

function creditsCase() {
  return {
    session: storedSession({ profile: snowRabbitProfile() }),
    proof: 'Credits and the Galmuri license appear from title and observatory settings',
    async show(page, { text, capture }) {
      const sheet = page.locator('#sheet.on');
      for (const screen of ['title', 'hub']) {
        if (screen === 'hub') await enterObservatory(page);
        await page.locator(`#${screen}.on .b-set`).click();
        await sheet.getByRole('button', { name: '크레딧', exact: true }).click();
        await text(sheet.locator('#sh-title'), '크레딧', { exact: true });
        const font = sheet.locator('section').filter({ has: page.getByRole('heading', { name: '글꼴', exact: true }) });
        await text(font.locator('p').first(), 'Galmuri 9·11·14 — quiple, SIL Open Font License 1.1', { exact: true });
        await text(font.locator('.credits-license-url'), 'https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/LICENSE.txt', { exact: true });
        assert.equal(await font.getByRole('link').count(), 0);
        if (screen === 'hub') await capture();
        await sheet.getByRole('button', { name: '닫기', exact: true }).click();
        await text(sheet.locator('#sh-title'), '설정', { exact: true });
        await sheet.getByRole('button', { name: '닫기', exact: true }).click();
      }
    }
  };
}

function backupStore(entries) {
  const saved = new Map(Object.entries(entries));
  return Save.createSaveStore({
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: key => saved.delete(key)
  }, { core, roster });
}

function damagedRecovery() {
  const profile = snowRabbitProfile();
  const lastGood = storedSession({ profile });
  const session = '{"broken":';
  const store = backupStore({ [sessionKey]: session, 'relaymare.lastGood': lastGood });
  assert.equal(store.loadDetailed().status, 'profileDamaged');
  assert.ok(store.restoreLastGood().ok);
  assert.equal(store.loadDetailed().profile.lead, profile.lead);
  return {
    session, lastGood, proof: 'Invalid JSON blocks the first departure until a valid saved return is restored',
    async show(page, { text, capture }) {
      await text(page.locator('#recovery.on h2'), '전체 기록 복구 필요');
      assert.equal(await page.locator('#title.on #b-start').count(), 0);
      const restore = page.locator('#recovery.on #meta-last-good');
      await text(restore, '직전 기록으로 복구 · 동료 1명', { exact: true });
      await capture();
      await Promise.all([page.waitForEvent('domcontentloaded'), restore.click()]);
      await page.locator('#title.on .b-set').click();
      await page.locator('#sheet.on [data-backup-action="export"]').click();
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#meta-backup-download').click()]);
      assert.equal((JSON.parse(fs.readFileSync(await download.path(), 'utf8'))).session.profile.lead, profile.lead);
      await page.locator('#b-sheetclose').click();
      await enterObservatory(page);
      await text(page.locator('#hub.on .meta-next-goal'), '샘 초대 1칸 열림');
    }
  };
}

function saveImport() {
  const current = riftFixture();
  const oldAttempt = current.start([2026, 10, 20, 12]);
  command(current.store.abandon, oldAttempt.id);
  const incoming = riftFixture();
  const first = incoming.start([2026, 10, 19, 12]);
  command(incoming.store.abandon, first.id);
  const active = reachRiftFloor(incoming.start(), 4);
  command(incoming.store.save, active);
  const main = makeRun({ seed: 7, floor: 4, profileView: Meta.startView(incoming.profile, 'ember_volcano') });
  const file = incoming.page(main);
  const store = backupStore({ [sessionKey]: file.session, [dailyKey]: file.daily });
  const backup = store.exportBackup();
  const inspected = store.inspectBackup(backup);
  assert.ok(inspected.ok, inspected.reason);
  assert.equal(inspected.summary.dailyOfficialStarts, 2);
  assert.equal(inspected.summary.dailyActive.floor, 4);
  return {
    ...current.page(), proof: 'Import compares 1 versus 2 official starts and restores a main and rift checkpoint at floor 4',
    async show(page, { text, capture }) {
      await enterObservatory(page);
      await page.locator('#hub.on .b-set').click();
      await page.locator('#sheet.on [data-backup-action="import"]').click();
      await page.locator('#meta-backup-file').setInputFiles({
        name: 'relaymare.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
      });
      await text(page.locator('#sheet.on #sh-title'), '기록 가져오기 확인');
      const columns = page.locator('#sheet.on .meta-backup-compare section');
      await text(columns.first(), '1회 · 정산 1회');
      await text(columns.last(), '2회 · 정산 1회');
      await text(columns.last(), '2026-11-21 · 기록 도전 · 4층');
      await text(columns.last(), '홍련 화산 4층');
      await capture();
      await Promise.all([page.waitForEvent('domcontentloaded'), page.locator('#meta-backup-confirm').click()]);
      await text(page.locator('#hub.on #meta-depart'), '홍련 화산 4층 이어가기');
      await text(riftRow(page).locator('small'), '이어가기');
    }
  };
}

function legacyContractReceipt() {
  const checkpoint = makeRun({ seed: 0, floor: 6, difficulty: 'nightmare', contract: 'heirloom', tempoVersion: 2,
    profileView: Meta.startView(nightmareProfile(), 'ember_volcano') });
  const legacy = JSON.parse(storedSession({ run: checkpoint }));
  delete legacy.run.run.contract.ruleVersion;
  const session = JSON.stringify(legacy);
  const run = Save.restoreRun(legacy.run, { core, roster });
  const door = run.doors.find(candidate => candidate.type === 'elite').index;
  startBattle(run, { door });
  const result = settleWin(run, { heirloomKills: 1, heirloomsUsed: 1 });
  assert.equal(result.contract.paid, CONTRACT_PAYOUT);
  return {
    session, proof: 'Unversioned Ember Nightmare seed 0 still shows the floor-6 heirloom rule and payout',
    async show(page, { text, capture, revisit }) {
      await text(await openDoorInfo(page, door), '4층이나 6층에서 유품 스킬로 적을 처치하고 승리');
      await capture();
      await revisit(storedSession({ run }), async source => {
        await text(source.locator('#result.on .contract-met'), '계약 달성');
        await text(source.locator('#result.on .gain').filter({ hasText: '7층 앞에서' }), '7층 앞에서 ◆' + CONTRACT_PAYOUT);
        await capture('result', source);
      });
    }
  };
}

function lessonActionTables() {
  const run = makeRun({ dungeonId: 'twilight_cathedral', seed: 0, floor: 2, tempoVersion: 2 });
  const session = storedSession({ run });
  const preview = Run.getTempoView(run, 0);
  const beat = preview.enemies[0].beats.find(action => action.turn === 2);
  assert.equal(beat.name, '소울드레인 예행');
  assert.equal(beat.lesson, true);
  command(Run.chooseDoor, run, 0);
  const order = storedSession({ run });
  const line = '2턴 · 소울드레인 예행 · 마법 · HP 피해 0 · 현재 MP −12';
  return {
    session, proof: line,
    async show(page, { text, capture, revisit }) {
      const door = await openDoorInfo(page, 0);
      await text(door.locator('.run-foe-detail').first(), line);
      await capture();
      await revisit(order, async source => {
        await source.locator('#order.on #b-opponents').click();
        await text(source.locator('#sheet.on .run-foe-detail').first(), line);
        await capture('order', source);
      });
    }
  };
}

function tideRippleWarning() {
  const run = makeRun({ dungeonId: 'creation_tower', seed: 1, floor: 2, tempoVersion: 2, profileView: { lead: 'black_swan' } });
  const battle = startBattle(run, { party: ['black_swan'] });
  const second = act(battle, '회피태세').findLast(event => event.t === 'await');
  const third = act(battle, '회피태세').findLast(event => event.t === 'await');
  const ripple = '잔물결 · 물리 ×0.75';
  assert.equal(second.countdown.name, '잔물결');
  assert.equal(third.intent.name, second.countdown.name);
  assert.equal(third.intent.kind, 'phy');
  return {
    session: storedSession({ run }), proof: ripple,
    async show(page, { text, capture }) {
      await openBattle(page);
      await tapTile(page, '회피태세');
      await text(page.locator('#pf-cd.on'), '다음 턴 ' + ripple);
      await text(page.locator('#region-next'), '조류 · 다음 턴 ' + ripple);
      await capture();
      await tapTile(page, '회피태세');
      await text(page.locator('#intent.on'), '잔물결');
      await text(page.locator('#region-next'), '조류 · 이번 턴 ' + ripple);
    }
  };
}

const reviewGardenRoute = run => run.doors[[0, 0, 1, 0, 0, 1, 0, 0][run.floor - 1]];

function gardenStartingFields() {
  let checkpoint;
  playRun('starlit_garden', 37, {
    difficulty: 'easy', firstMain: true, doorOverride: reviewGardenRoute,
    onBattle(run) {
      if (run.floor === 4) command(Run.chooseGateReward, run, { kind: 'relic', id: 'buff_overload' });
    },
    serviceOverride(run) {
      if (run.floor !== 5) return false;
      assert.equal(run.room.event.id, 'two_garden_chairs');
      return command(Run.chooseEvent, run, 'lanterns').ok;
    },
    onRoom(run) { if (run.floor === 5) checkpoint = Save.serializeRun(run); }
  });
  const run = Save.restoreRun(checkpoint, { core, roster });
  advance(run);
  const index = run.doors.find(door => door.type === 'elite').index;
  const session = storedSession({ run });
  const field = Run.doorStart(run, index).field;
  assert.equal(field.length, 4);
  assert.ok(field.includes('star_powder'));
  assert.deepEqual(Array.from(startBattle(run, { door: index }).state().field), field);
  const names = field.map(id => core.BUFF_NAMES[id]).join(' · ');
  return {
    session, proof: names,
    async show(page, { text, capture, revisit }) {
      await text(await openDoorInfo(page, index), '시작 필드 · ' + names);
      await capture();
      await revisit(storedSession({ run }), async source => {
        await openBattle(source);
        const slots = source.locator('#sky-slots i');
        assert.equal(await slots.count(), 5);
        assert.equal(await source.locator('#sky-slots i.on').count(), 4);
        await text(source.locator('#skyname'), names);
        await capture('battle', source);
      });
    }
  };
}

function doubleRelicReceipt() {
  let checkpoint;
  playRun('twilight_cathedral', 64, {
    difficulty: 'easy', firstMain: true, doorOverride: reviewGardenRoute,
    onRoom(run) {
      if (run.floor !== 5) return;
      assert.equal(run.room.event.id, 'whale_third_peal');
      checkpoint = Save.serializeRun(run);
    }
  });
  const run = Save.restoreRun(checkpoint, { core, roster });
  advance(run);
  const battle = startBattle(run, { door: 1, party: ['galaxy_whale', 'victoria', 'eclipse_queen'] });
  const live = storedSession({ run });
  const actions = [3, 0, 4].map(index => {
    const option = battle.options().find(entry => entry.index === index);
    battle.act(index);
    return { name: option.name, heirloom: !!option.heirloom };
  });
  const summary = battle.summary();
  assert.equal(summary.outcome, 'win');
  assert.equal(summary.bet?.won, true);
  const settlement = command(Run.settleBattle, run, summary);
  assert.deepEqual(settlement.relics, ['big_bang', 'over_divine']);
  return {
    session: live, proof: 'Seed 64 wins the bet and the elite relic on the same turn',
    async show(page, { text, capture }) {
      await openBattle(page);
      for (const { name } of actions.slice(0, -1)) await tapTile(page, name);
      // The finishing action is the inherited skill, which lives on the heirloom button, not a skill tile.
      const last = actions.at(-1);
      await (last.heirloom ? page.locator('#b-heir') : skillTile(page, last.name)).click();
      async function verify() {
        const receipts = page.locator('#result.on .relic-receipt');
        await text(receipts.nth(0), '빅뱅 · 장착 완료');
        await text(receipts.nth(1), '오버디바인 · 장착 완료');
        assert.equal(await receipts.count(), 2);
      }
      await verify();
      await capture();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await verify();
    }
  };
}

function lowCrystalSpring() {
  let checkpoint;
  playRun('dawn_forest', 17, {
    opening: 'stand',
    serviceOverride(run) {
      if (run.room.type !== 'spring') return false;
      assert.equal(run.crystals, 3);
      checkpoint = Save.serializeRun(run);
      return true;
    }
  });
  const run = Save.restoreRun(checkpoint, { core, roster });
  run.pool = [run.bench[0]];
  const session = storedSession({ run });
  assert.equal(command(Run.springDraw, run).draw.kind, 'boost');
  const offer = command(Run.getSpringOffer, run);
  assert.equal(run.crystals, 2);
  assert.ok(offer.candidates.length);
  return {
    session, proof: '◆2 reveals candidates for free and leaves commit disabled',
    async show(page, { text, capture }) {
      const spring = page.locator('#spring.on');
      await spring.locator('#b-draw').click();
      await text(spring.locator('.gems'), '◆ 2');
      await spring.locator('#b-pick').click();
      assert.equal(await spring.locator('.cardrow').count(), offer.candidates.length);
      await text(spring.getByRole('status'), '결정 1개가 부족합니다');
      await spring.locator('.cardrow').first().click();
      assert.equal(await spring.locator('#b-take').isDisabled(), true);
      await capture();
      await spring.locator('#b-spring-pass').click();
      await text(spring.locator('.gems'), '◆ 2');
    }
  };
}

function resumePreparation() {
  const intro = snowRabbitProfile(17);
  const journey = mainReturn(intro, 'ember_volcano', 'normal', 0);
  const { profile } = applyReturn(intro, journey);
  const draft = { dungeonId: 'ember_volcano', difficulty: 'nightmare', contract: 'heirloom' };
  return {
    session: storedSession({ profile }), seed: 0, proof: 'Nightmare draft and contract persist through reload, and clear on departure or dismissal',
    async show(page, { text, capture }) {
      const panel = page.locator('#sheet.on');
      const choice = panel.locator('#meta-contract-choice');
      const open = async () => {
        await page.locator('#hub.on #meta-telescope').click();
        await page.locator('[data-dungeon="ember_volcano"]').click();
        await panel.locator('[data-difficulty="nightmare"]').click();
        await choice.click();
        await panel.locator('[data-contract="heirloom"]').click();
      };
      const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).profile.ui.preparation, sessionKey);
      await enterObservatory(page);
      await open();
      assert.deepEqual(await saved(), draft);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await enterObservatory(page);
      await text(choice, '악몽 계약 · 마지막 유품');
      await capture();
      await page.locator('#b-sheetclose').click();
      assert.equal(await saved(), null);
      await enterObservatory(page);
      await open();
      await panel.locator('#meta-start-expedition').click();
      assert.equal(await saved(), null);
      assert.equal(await page.evaluate(() => window.__game.run.contract.id), draft.contract);
    }
  };
}

function malformedProfileImport() {
  const profile = snowRabbitProfile(17);
  const session = storedSession({ profile });
  const store = backupStore({ [sessionKey]: session, 'relaymare.lastGood': session });
  const malformed = store.exportBackup();
  malformed.session.profile.ui.returners = {};
  assert.equal(store.inspectBackup(malformed).reason, 'invalid_session');
  return {
    session, lastGood: session, proof: 'Object in returners rejected before confirmation or slot switch',
    async show(page, { text, capture }) {
      await enterObservatory(page);
      await page.locator('#hub.on .b-set').click();
      await page.locator('#sheet.on [data-backup-action="import"]').click();
      await page.locator('#meta-backup-file').setInputFiles({
        name: 'malformed.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(malformed))
      });
      await text(page.locator('#sheet.on .meta-feedback'), '파일의 동료와 수첩 기록이 손상되었습니다.');
      assert.equal(await page.locator('#meta-backup-confirm').count(), 0);
      assert.equal(await page.evaluate(() => localStorage.getItem('relaymare.activeSlot')), null);
      assert.equal(await page.evaluate(() => localStorage.getItem('relaymare.lastGood')), session);
      await capture();
      await page.locator('#b-sheetclose').click();
      await text(page.locator('#hub.on h1'), '꿈의 관측소');
    }
  };
}

const { riftFixture, reachRiftFloor, riftRow, riftSaveFailure, damagedRiftRecovery, cases: riftCases } = createRiftCases({
  core, roster, sessionKey, dailyKey, command, snowRabbitProfile, makeRun, startBattle, settleWin, storedSession,
  reachFloor, enterObservatory, openBattle, backupStore, mainReturn, applyReturn
});
const entryCases = createEntryCases({ roster, storedSession, snowRabbitProfile, nightmareProfile, mainReturn, enterObservatory });

const cases = {
  'rift-save-failure': riftSaveFailure,
  'legacy-contract-receipt': legacyContractReceipt,
  'lesson-action-tables': lessonActionTables,
  'tide-ripple-warning': tideRippleWarning,
  'garden-starting-fields': gardenStartingFields,
  'double-relic-receipt': doubleRelicReceipt,
  'low-crystal-spring': lowCrystalSpring,
  'resume-preparation': resumePreparation,
  'damaged-rift-recovery': damagedRiftRecovery,
  'malformed-profile-import': malformedProfileImport,
  'next-goal': nextGoalLine,
  'ending-goal': endingGoal,
  'roster-table': preDepartureRoster,
  'difficulty-choice': difficultyChoice,
  destinations,
  'missions-invitations': missionInvitations,
  'reading-settings': readingSettingsCase,
  credits: creditsCase,
  'save-recovery': damagedRecovery,
  'save-import': saveImport,
  'map-awaken-faces': mapAwakenFaces,
  'truthful-hud': truthfulHud,
  'blessing-parity': blessingParity,
  'spring-commit': springCommit,
  'event-values': eventValues,
  'returned-battle-log': returnedBattleLog,
  'treasure-receipt': treasureReceiptFlow,
  'opening-choices': openingChoices,
  'opening-awaken': openingAwaken,
  'formation-board': formationBoard,
  'reinforcement-board': reinforcementBoard,
  'tempo-telegraph': tempoTelegraph,
  'last-hit': lastHit,
  'result-ordinary': resultOrdinary,
  'result-boss-wipe': resultBossWipe,
  'compact-stage': compactStage,
  'spring-boost': () => repeatSpring('boost'),
  'spring-memory': () => repeatSpring('memory'),
  'spring-rates': springRates,
  'battle-log': groupedBattleLog,
  'tile-range': tileRange,
  'tile-instant': tileInstant,
  'field-support': fieldSupport,
  'retreat-warning': retreatWarning,
  'door-sky': doorSky,
  'door-hp': doorHp,
  'bet-text': betText,
  'save-fail': saveFail,
  'run-lost': runLost,
  'record-fallen': recordFallen,
  'field-cap': fieldCap,
  'relic-strip': () => relicMap(false),
  'relic-slot-sheet': () => relicMap(true),
  'relic-compare': treasureRelicCompare,
  'relic-compare-gate': gateRelicCompare,
  'relic-compare-bet': betRelicCompare,
  'relic-compare-event': eventRelicCompare,
  'relic-tile-mark': relicTileMark,
  'form-sheet': formSheet,
  'resume-seats': resumeSeats,
  'map-seats': mapSeats,
  'countdown-charge': countdownCharge,
  'contract-sheet': contractSheet,
  'contract-battle-sheet': contractBattleSheet,
  'contract-impossible': contractImpossible,
  'contract-payout': contractPayout,
  'return-stamp': returnStamp,
  'boss-formation': orderHint,
  'spring-count': springCount,
  'retreat-outcomes': retreatOutcomes,
  ...riftCases,
  ...entryCases
};

async function inject(page, session, { daily, now, seed, mute, settings, lastGood } = {}) {
  const url = seed == null ? gameUrl : gameUrl + '?seed=' + seed;
  const entries = [[sessionKey, session], ...(daily ? [[dailyKey, daily]] : [])];
  if (lastGood) entries.push(['relaymare.lastGood', lastGood]);
  if (mute || settings) entries.push(['relaymare.settings', JSON.stringify({
    ...(mute ? { sound: false, music: false } : {}), ...settings
  })]);
  await page.addInitScript(({ url, entries, now }) => {
    if (location.href !== url) return;
    if (now) {
      const NativeDate = Date;
      let timestamp = new NativeDate(...now).getTime();
      window.__gallerySetDate = (...parts) => { timestamp = new NativeDate(...parts).getTime(); };
      window.Date = new Proxy(NativeDate, {
        construct(target, args, newTarget) {
          return Reflect.construct(target, args.length ? args : [timestamp], newTarget);
        },
        apply() { return new NativeDate(timestamp).toString(); },
        get(target, key, receiver) {
          return key === 'now' ? () => timestamp : Reflect.get(target, key, receiver);
        }
      });
    }
    const marker = 'relaymare.gallery.seeded';
    if (sessionStorage.getItem(marker)) return;
    for (const [key, value] of entries) {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    sessionStorage.setItem(marker, '1');
  }, { url, entries, now });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('.screen.on').waitFor();
}

async function battleIdle(page) {
  try {
    await page.waitForFunction(() => {
      const game = window.__game;
      const screen = document.querySelector('#battle.on');
      return screen && !game?.busy && game?.B.bridge?.awaiting
        && screen.querySelector('.act:not([disabled])') && !screen.querySelector('#result.on');
    }, null, { timeout: 20000 });
  } catch (error) {
    const screen = await page.locator('.screen.on').getAttribute('id').catch(() => 'unknown');
    throw new Error(`Battle never reached a playable turn (active screen: ${screen})`, { cause: error });
  }
}

async function openBattle(page) {
  const map = page.locator('#map.on');
  if (await map.isVisible()) await map.locator('[data-door="0"]').click();
  await page.locator('#order.on #b-go').click();
  await battleIdle(page);
}

function skillTile(page, name) {
  const label = page.getByText(name, { exact: true });
  return page.locator('#battle.on .act').filter({ has: label });
}

async function tapTile(page, name) {
  await skillTile(page, name).click();
  await battleIdle(page);
}

async function openDoorInfo(page, index) {
  await page.locator(`#map.on [data-info="${index}"]`).click();
  const sheet = page.locator('#sheet.on #sh-body');
  await sheet.waitFor();
  return sheet;
}

async function withPage(browser, session, show, options) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: options?.motion ?? 'reduce' });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    page.setDefaultNavigationTimeout(20000);
    const errors = [];
    const browserFailure = new Promise((_, reject) => {
      function fail(kind, detail) {
        const error = new Error(`${kind}: ${detail}`);
        errors.push(error);
        reject(error);
      }
      page.on('pageerror', error => fail('Page error', error.message));
      page.on('console', message => {
        if (message.type() === 'error') fail('Console error', message.text());
      });
      page.on('crash', () => fail('Page crash', 'Chrome crashed while showing the case'));
    });
    try {
      await Promise.race([browserFailure, (async () => {
        await inject(page, session, options);
        await show(page);
      })()]);
    } catch (error) {
      // Keep what the screen looked like when the case failed.
      await page.screenshot({ path: shots + 'last-failure.png' }).catch(() => {});
      throw error;
    }
    if (errors.length) throw errors[0];
  } finally {
    await context.close();
  }
}

async function capturePage(page, { duringBattle = false } = {}) {
  if (!duringBattle && await page.locator('#battle.on').count() && !await page.locator('#result.on').count()) await battleIdle(page);
  await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 7000 });
  await page.evaluate(async () => {
    const images = Array.from(document.querySelectorAll('.screen.on img, #sheet.on img'));
    await Promise.all(images.map(img => img.decode().catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  return page.screenshot({ animations: 'disabled' });
}

async function runCase(browser, name, fixture) {
  const found = new Set();
  const captures = [];
  await withPage(browser, fixture.session, async page => {
    await fixture.show(page, {
      async text(locator, expected, { exact = false } = {}) {
        const matching = locator.filter({ hasText: expected });
        try {
          await matching.waitFor();
          if (exact) assert.equal((await matching.innerText()).trim(), expected);
        } catch (error) {
          const actual = (await locator.allTextContents()).join(' | ');
          throw new Error(`Expected visible “${expected}”; ${actual ? `found “${actual}”` : 'no matching element'}`, { cause: error });
        }
        found.add(expected);
      },
      async capture(label, source = page, options) {
        captures.push({ name: label ? `${name}-${label}` : name, image: await capturePage(source, options) });
      },
      revisit: (session, show) => withPage(browser, session, show)
    });
    if (!captures.some(capture => capture.name === name)) {
      captures.push({ name, image: await capturePage(page) });
    }
  }, fixture);
  for (const capture of captures) fs.writeFileSync(path.join(shots, `${capture.name}.png`), capture.image);
  return { found: [...found].join(' | '), captures };
}

async function writeSheet(captures) {
  const columns = Math.min(3, captures.length);
  const rows = Math.ceil(captures.length / columns);
  const gutter = 12;
  const labelHeight = 28;
  const width = Math.min(viewport.width, Math.floor((1600 - gutter * (columns + 1)) / columns));
  const height = Math.round(viewport.height * width / viewport.width);
  const composite = [];
  for (const [index, capture] of captures.entries()) {
    const left = gutter + (index % columns) * (width + gutter);
    const top = gutter + Math.floor(index / columns) * (labelHeight + height + gutter);
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${labelHeight}">
      <text x="2" y="19" fill="#f1eaf9" font-family="sans-serif" font-size="15">${capture.name}${capture.image ? '' : ' (failed)'}</text>
    </svg>`);
    composite.push({ input: label, left, top });
    if (capture.image) {
      const input = await sharp(capture.image).resize(width, height).png().toBuffer();
      composite.push({ input, left, top: top + labelHeight });
    }
  }
  await sharp({ create: {
    width: columns * width + (columns + 1) * gutter,
    height: rows * (height + labelHeight) + (rows + 1) * gutter,
    channels: 3, background: '#191321'
  } }).composite(composite).png().toFile(path.join(shots, 'sheet.png'));
}

function parseArguments(args) {
  let selected;
  let validateOnly = false;
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--case':
        selected = args[++i];
        assert.ok(selected === 'entry' || Object.hasOwn(cases, selected), `Unknown case: ${selected ?? '(missing name)'}. Use entry or ${Object.keys(cases).join(', ')}`);
        break;
      case '--validate-only':
        validateOnly = true;
        break;
      default:
        assert.fail(`Unknown option: ${args[i]}`);
    }
  }
  return { names: selected === 'entry' ? Object.keys(entryCases) : selected ? [selected] : Object.keys(cases), validateOnly };
}

async function main() {
  const { names, validateOnly } = parseArguments(process.argv.slice(2));
  let browser, launchError;
  if (!validateOnly) {
    fs.mkdirSync(shots, { recursive: true });
    try {
      browser = await chromium.launch({ channel: 'chrome' });
    } catch (error) {
      launchError = error;
    }
  }
  const results = [];
  const captures = [];
  try {
    for (const name of names) {
      try {
        const fixture = cases[name]();
        if (validateOnly) {
          results.push({ case: name, result: 'PASS', text: fixture.proof });
        } else {
          if (launchError) throw launchError;
          const { found, captures: images } = await runCase(browser, name, fixture);
          results.push({ case: name, result: 'PASS', text: found });
          captures.push(...images);
        }
      } catch (error) {
        // Keep the first line and where in this file it failed; long assertion diffs hide the cause.
        const where = error.stack?.match(/screens\.mjs:\d+/)?.[0] ?? '';
        results.push({ case: name, result: 'FAIL', text: error.message.split('\n')[0] + (where ? ' @ ' + where : '') });
        captures.push({ name });
      }
    }
  } finally {
    await browser?.close();
  }
  if (!validateOnly && !launchError) {
    await writeSheet(captures);
    console.log(`Contact sheet: ${path.join(shots, 'sheet.png')}`);
  }
  console.table(results);
  if (results.some(row => row.result === 'FAIL')) process.exitCode = 1;
}

await main();

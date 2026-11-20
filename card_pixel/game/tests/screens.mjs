// node card_pixel/game/tests/screens.mjs [--case <name>] [--validate-only]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { CONTRACTS, CONTRACT_ESCROW, CONTRACT_PAYOUT } from '../src/content/contracts.js';
import { INTRO } from '../src/content/intro.js';
import * as Bridge from '../src/engine/bridge.js';
import * as Daily from '../src/engine/daily-rift.js';
import * as DailyStore from '../src/engine/daily-store.js';
import * as Meta from '../src/engine/meta.js';
import { openingModel } from '../src/engine/opening.js';
import { create as makeRoster, POSITION } from '../src/engine/roster.js';
import * as Run from '../src/engine/run.js';
import * as Save from '../src/engine/save.js';
import { battleLog } from '../src/ui/battle/log.js';
import { formationMoves } from '../src/ui/screens/order.js';
import { coreBundle } from '../tools/core-bundle.mjs';

const sessionKey = 'relaymare.session';
const dailyKey = 'relaymare.daily';
const riftDate = [2026, 10, 21, 23, 59, 59];
const nextRiftDate = [2026, 10, 22, 0, 0, 0];
const gameUrl = new URL('../dist/Relaymare.html', import.meta.url).href;
const shots = fileURLToPath(new URL('shots/screens/', import.meta.url));
const viewport = { width: 390, height: 844 };

const sandbox = { console, Math, __relayCoreTimer: Bridge.scheduleTimer };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(coreBundle(fileURLToPath(new URL('../../../', import.meta.url))), sandbox);
const core = sandbox.RelayCore;
const manifest = JSON.parse(fs.readFileSync(new URL('../assets/sprites.json', import.meta.url), 'utf8'));
const sp = Object.fromEntries(Object.entries(manifest).map(([name, sprite]) => [name.replace(/\.png$/, ''), sprite]));
const roster = makeRoster(core, { sp });

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

function storedSession({ run = null, profile = Meta.createProfile(), unsupportedRun = false }) {
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
    assert.deepEqual(loaded.run, run);
  }
  return storage.get(sessionKey);
}

function snowRabbitProfile() {
  const intro = makeRun({ dungeonId: 'dawn_forest', seed: 7, floor: 2 });
  command(Run.chooseDoor, intro, 0);
  startPicks(intro, 'snow_rabbit');
  advance(intro);
  reachFloor(intro, 5);
  startBattle(intro);
  settleWin(intro);
  const { announce, profile } = Meta.applyRunEnd(Meta.createProfile(), intro, { recruits: ['snow_rabbit'] });
  assert.equal(announce.ok, true, announce.reason);
  return profile;
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
      assert.equal(await tile.locator('.r2 u').count(), 0, `${skill} must omit 처치 at HP ${hp}`);
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
        await text(sheet.locator('#sh-body p'), field + ' — 아군 ' + description);
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
  const warning = '예약한 일루미네이션도 취소된다';
  return {
    session: storedSession({ run }), proof: `turn 2, ${skill} queued and retreat available`,
    async show(page, { text }) {
      await openBattle(page);
      await tapTile(page, skill);
      await page.locator('#b-retreat').click();
      await text(page.locator('#b-retreat.armed small'), warning);
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
  const sky = '시작 하늘 · 스타파우더';
  return {
    session, proof: `cake event → floor ${run.floor} start field: star_powder`,
    async show(page, { text, capture }) {
      await page.locator('#map.on [data-door="2"]').click();
      await page.locator('#event.on [data-choice="powder"]').click();
      await page.locator('#event.on #b-leave').click();
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
        const bonus = '추가 보상 · 보물 적 1명 처치마다 결정 +2';
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
      await text(page.locator('#event.on [data-choice="third"] span'), '3턴에 적 하나를 쓰러뜨리고 이긴다');
      const fourth = page.locator('#event.on [data-choice="fourth"] span');
      await text(fourth, '4턴에 적 하나를 쓰러뜨리고 이긴다');
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
    setItem(key) {
      assert.equal(key, sessionKey);
      throw new DOMException('Forced session write failure', 'QuotaExceededError');
    }
  }, { core, roster });
  assert.throws(() => store.save({ profile: Meta.createProfile(), run }), { name: 'QuotaExceededError' });
  return {
    session, proof: 'floor 1 map can enter order; session write propagates QuotaExceededError',
    async show(page, { text }) {
      await page.locator('#map.on [data-door="0"]').waitFor();
      await page.evaluate(key => {
        const write = Storage.prototype.setItem;
        Storage.prototype.setItem = function (item, value) {
          if (item === key) throw new DOMException('Forced session write failure', 'QuotaExceededError');
          return write.call(this, item, value);
        };
      }, sessionKey);
      await page.locator('#map.on [data-door="0"]').click();
      await page.locator('#order.on').waitFor();
      await text(page.locator('#session-notices p'), '저장에 실패했다');
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
      await text(page.locator('#session-notices p'), '진행 중인 원정을 불러오지 못했다');
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
  for (let i = 0; i < 3; i++) act(battle, skill);
  const { field } = battle.state();
  assert.equal(field.length, 5);
  return {
    session: storedSession({ run }), proof: `${relic} equipped; ${field.join(', ')}`,
    async show(page, { text, capture }) {
      await openBattle(page);
      const slots = page.locator('#sky-slots i');
      assert.equal(await slots.count(), 5, 'Buff Overload must display five HUD slots before they are filled');
      await text(skillTile(page, skill).locator('.r2'), '무작위 아군 강화 1종', { exact: true });
      for (let i = 0; i < 3; i++) await tapTile(page, skill);
      assert.equal(await page.locator('#sky-slots i.on').count(), 5, 'All five HUD slots must be filled');
      await text(page.locator('#skyname'), field.map(id => core.BUFF_NAMES[id]).join(' · '), { exact: true });
      await capture('hud');
      await page.locator('#b-field').click();
      const battlefield = page.locator('#sheet.on #sh-body');
      await text(battlefield.getByText('버프오버로드', { exact: true }), '버프오버로드');
      await page.locator('#b-sheetclose').click();
      await page.locator('#sky').click();
      const sheet = page.locator('#sheet.on #sh-body');
      assert.equal(await sheet.locator('.stl li').count(), 5, 'Field sheet must list all five buffs');
      await text(sheet.locator('p.sm'), '최대 5개');
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
      await text(page.locator('#sheet.on #sh-title'), '동료 · 지금');
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
      assert.deepEqual(await map.locator('.benchrow .mini').evaluateAll(nodes => nodes.map(node => node.dataset.sheet)), reserves);
      for (const [index, name] of names.entries()) {
        const actor = actors.nth(index);
        await text(actor.locator('small'), POSITION[index], { exact: true });
        assert.equal(await actor.getAttribute('aria-label'), POSITION[index] + ' ' + name);
      }
      await capture();
      await map.locator('[data-door="0"]').click();
      for (const [index, name] of names.entries()) {
        await text(page.locator(`#order.on [data-slot="${index}"] b`), name, { exact: true });
      }
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
      await text(page.locator('#pf-cd.on'), '다음 턴 디바인블레이드!');
    }
  };
}

function nightmareProfile() {
  const profile = snowRabbitProfile();
  const run = makeRun({ seed: 7, floor: 8, profileView: Meta.startView(profile, 'ember_volcano') });
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
      await text(sheet.locator('h4').filter({ hasText: name }), `계약 · ${name} · 아직`);
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
      await text(page.locator('#result.on .gain'), '7층 앞에서 ◆' + CONTRACT_PAYOUT);
      await capture();
      await page.locator('#result.on #b-next').click();
      await page.locator('#treasure.on').waitFor();
      await revisit(storedSession({ run: failure.run }), async failurePage => {
        const resultSheet = failurePage.locator('#result.on');
        await text(resultSheet.locator('.contract-failed'), '계약 실패 · 맡긴 ◆' + CONTRACT_ESCROW + ' 사라짐');
        await capture('failed', failurePage);
        await resultSheet.locator('#b-next').click();
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
  const moves = formationMoves(defaults, alternate, name);
  assert.ok(moves.some(move => move.includes(' ↔ ')) && moves.some(move => move.startsWith('대기 ')));
  return {
    session, proof: `${defaults.join(' → ')} differs from ${alternate.join(' → ')}`,
    async show(page, { text, capture }) {
      await page.locator('#hub.on #meta-depart').click();
      await page.locator('#map.on .door-entry[data-door="0"]').click();
      const order = page.locator('#order.on');
      for (const [index, id] of defaults.entries()) {
        await text(order.locator(`[data-slot="${index}"] b`), name(id), { exact: true });
      }
      const hint = order.locator('.relay-alternative');
      for (const move of moves) await text(hint.locator('b').filter({ hasText: move }), move);
      await hint.scrollIntoViewIfNeeded();
      await capture();
      await hint.click();
      for (const [index, id] of alternate.entries()) {
        await text(order.locator(`[data-slot="${index}"] b`), name(id), { exact: true });
      }
      assert.equal(await hint.count(), 0);
      await text(page.locator('#b-alternate-order'), '되돌리기', { exact: true });
      await page.locator('#b-alternate-order').click();
      for (const [index, id] of defaults.entries()) {
        await text(order.locator(`[data-slot="${index}"] b`), name(id), { exact: true });
      }
      assert.equal(await page.evaluate(() => window.__game.run.room.status), 'order');
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
  const spring = `현재 2명 · 결정 ${Run.COST.draw}개로 셋째 깨우기`;
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
  const retreat = `물러나면 ${next.name} HP ${next.hp}→${after === maxAfter ? after : `${after}~${maxAfter}`}`;
  const fall = `쓰러지면 ${next.name}에게 ${Bridge.heirloomSkill(roster.card(allies[cur].form)).name} ×${Bridge.HEIRLOOM_POWER}`;
  return {
    session: storedSession({ run }), proof: `${allies[cur].hp} HP vs. minimum ${ready.intent.dmg[0]} damage; ${retreat} / ${fall}`,
    async show(page, { text }) {
      await battleIdle(page);
      await page.locator('#b-retreat').click();
      // Without a reserved-attack warning the button carries both outcomes; the ticker keeps the hit detail.
      await text(page.locator('#ticker'), '명중 시');
      const button = page.locator('#b-retreat.armed');
      await text(button.locator('small').filter({ hasText: retreat }), retreat);
      await text(button.locator('small').filter({ hasText: fall }), fall);
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
      await text(choice.nth(1), '쓰러지면 눈토끼가 아마겟돈을 받는다');
      await capture();
      await choice.nth(0).click();
      await battleIdle(page);
      await skillTile(page, '실버스톰').click();
      await text(page.locator('#result.on #b-next'), '애쉬와 간다');
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
      await text(page.locator('.wake-summary'), '내가 정한 둘 + 깨어난 셋 + 결정 1', { exact: true });
      assert.deepEqual(await page.locator('.wake-slot.landed [data-sheet]').evaluateAll(nodes => nodes.map(node => node.dataset.sheet)), awakened);
      await capture();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await text(page.locator('.wake-summary'), '내가 정한 둘 + 깨어난 셋 + 결정 1');
    }
  };
}

function formationBoard() {
  const run = makeRun({ seed: 7, tempoVersion: 2 });
  command(Run.chooseDoor, run, 0);
  const { blessing, party } = Run.getTempoView(run, 0);
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
      await text(order.locator('.relay-blessing'), roster.card(blessing.id).name);
      await text(order.locator('.relay-blessing'), '+' + Math.round((blessing.multiplier - 1) * 100) + '%');
      const positions = await Promise.all([0, 1, 2].map(i => slot(i).boundingBox()));
      assert.equal(new Set(positions.map(pos => pos.y)).size, 1);
      const sprites = await Promise.all([0, 1, 2].map(i => slot(i).locator('.relay-seat-art img').boundingBox()));
      assert.ok(sprites.every(pos => pos.height >= 64 && pos.height <= 72));
      assert.equal(new Set(sprites.map(pos => pos.y + pos.height)).size, 1);
      for (const [i, seat] of positions.slice(0, 2).entries()) {
        const link = await order.locator(`[data-link="${i}"]`).boundingBox();
        assert.ok(link.x >= seat.x + seat.width && link.x + link.width <= positions[i + 1].x);
        assert.ok(Math.abs(link.y + link.height / 2 - (seat.y + seat.height / 2)) <= 1);
      }
      const reserveFace = await order.locator(`[data-bench="${reserve}"] .run-face`).boundingBox();
      assert.ok(reserveFace.width >= 48 && reserveFace.height >= 48);
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
      await text(page.locator('#sheet.on #sh-title'), '쓰러지면 유품 계승');
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
  const session = storedSession({ run: full });
  const { key, candidates } = full.pending;
  const id = candidates[0], replaceId = full.bench[0];
  assert.equal(Run.resolveReinforcement(full, { key, id, replaceId: null }).ok, false);
  command(Run.resolveReinforcement, full, { key, id, replaceId });
  assert.equal(Run.resolveReinforcement(full, { key, id, replaceId }).ok, false);
  assert.ok(full.released.includes(replaceId) && full.bench.includes(id));
  return {
    session, proof: `actual battles: join ${join}, then ${replaceId} → ${id} at 6/6; duplicate key rejected`,
    async show(page, { text, capture, revisit }) {
      const screen = page.locator('#reinforce.on');
      await text(screen.locator('.lead'), '동료 6/6명');
      await screen.locator(`[data-candidate="${id}"]`).click();
      assert.equal(await screen.locator('#b-reinforce-take').isDisabled(), true);
      await screen.locator(`[data-release="${replaceId}"]`).click();
      await capture();
      await screen.locator('#b-reinforce-take').click();
      await page.locator('#map.on').waitFor();
      assert.deepEqual(await page.evaluate(() => window.__game.run.bench), full.bench);
      await revisit(empty, async source => {
        await text(source.locator('#reinforce.on .lead'), '동료 5/6명');
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
      await text(page.locator('#intent.on strong'), range(next.intent.dmg), { exact: true });
      await text(page.locator('#pf-cd.on'), '이번 턴 ' + next.countdown.name);
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
      await text(page.locator('#result.on #b-next'), '눈토끼와 간다');
      await text(page.locator('#result.on .finish-portrait'), '생환');
      await text(page.locator('#result.on .finish-portrait'), hit.amount + ' 피해');
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
    session: storedSession({ run }), proof: `1턴 판게아리버스 예약 → 5턴 발동 · ${hit.amount}; Ash retreat, death and heirloom with faces`,
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
        assert.equal(await retreat.locator('img').count(), 1);
        await capture('resumed', source);
      });
    }
  };
}

function riftProfile() {
  const intro = snowRabbitProfile();
  const run = makeRun({ seed: 7, floor: 8, profileView: Meta.startView(intro, 'ember_volcano') });
  startBattle(run);
  settleWin(run);
  const { profile, announce } = Meta.applyRunEnd(intro, run);
  assert.equal(announce.ok, true, announce.reason);
  assert.ok(Meta.dailyRiftUnlocked(profile), 'The first main expedition clear must unlock the rift');
  return profile;
}

function riftFixture(profile = riftProfile()) {
  const saved = {};
  const store = DailyStore.create({
    getItem: key => saved[key] ?? null,
    setItem: (key, value) => { saved[key] = value; },
    removeItem: key => { delete saved[key]; }
  }, { core, roster });
  return {
    profile, store,
    start(parts = riftDate, kind = 'official') {
      const now = new Date(...parts);
      const { ok, reason, run } = store.start({ profile, now, expectedDayKey: Daily.dayKey(now), kind });
      assert.ok(ok && run, reason);
      return run;
    },
    page(run = null, now = riftDate) {
      return { session: storedSession({ profile, run }), daily: saved[dailyKey], now };
    }
  };
}

function reachRiftFloor(run, floor) {
  return reachFloor(run, floor, current => {
    if (current.room.type === 'treasure') command(Run.takeTreasure, current);
  });
}

function settleRift(run, won) {
  reachRiftFloor(run, 7);
  startBattle(run, { party: Run.defaultParty(run) });
  settleWin(run, won
    ? { survivors: [false, false, true], turns: 24, heirloomsUsed: 2 }
    : { outcome: 'lose', survivors: [false, false, false], turns: 24, enemyDowns: [] });
  assert.equal(run.phase, 'done');
  assert.equal(run.result, won ? 'win' : 'lose');
  return run;
}

async function enterObservatory(page) {
  const title = page.locator('#title.on #b-start');
  if (await title.count()) await title.click();
  await page.locator('#hub.on').waitFor();
}

const riftRow = page => page.locator('#hub.on #meta-daily-rift');

function riftLocked() {
  const fixture = riftFixture(snowRabbitProfile());
  assert.equal(fixture.store.view(fixture.profile, new Date(...riftDate)).unlocked, false);
  return {
    ...fixture.page(), proof: 'Intro clear alone leaves the rift row folded',
    async show(page) {
      await enterObservatory(page);
      assert.equal(await riftRow(page).count(), 0);
    }
  };
}

function riftFirst() {
  const fixture = riftFixture();
  const view = fixture.store.view(fixture.profile, new Date(...riftDate));
  assert.equal(view.dayKey, '2026-11-21');
  assert.ok(view.unlocked && !view.active && !view.official);
  return {
    ...fixture.page(), proof: 'Notebook chapter 4, unused 11.21 official attempt',
    async show(page, { text }) {
      await enterObservatory(page);
      await text(riftRow(page).locator('span'), '오늘의 균열', { exact: true });
      await text(riftRow(page).locator('small'), '11.21 · 첫 도전', { exact: true });
    }
  };
}

function riftResume() {
  const fixture = riftFixture();
  const main = makeRun({ seed: 9, floor: 4, profileView: Meta.startView(fixture.profile, 'ember_volcano') });
  const rift = reachRiftFloor(fixture.start(), 4);
  command(fixture.store.save, rift);
  assert.equal(fixture.store.resume().run.id, rift.id);
  return {
    ...fixture.page(main), proof: 'Both slots save a distinct floor-four run',
    async show(page, { text, capture }) {
      await enterObservatory(page);
      await text(page.locator('#hub.on #meta-depart'), '홍련 화산 4층 이어가기', { exact: true });
      await text(riftRow(page).locator('small'), '11.21 · 4층 이어가기', { exact: true });
      await capture();
      await page.locator('#hub.on #meta-depart').click();
      await text(page.locator('#map.on header b'), '홍련 화산', { exact: true });
      assert.equal(await page.evaluate(() => window.__game.run.id), main.id);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await riftRow(page).click();
      const map = page.locator('#map.on');
      await text(map.locator('header b'), '11.21 균열', { exact: true });
      await text(map.locator('header .gems'), '기록 도전', { exact: true });
      assert.equal(await page.evaluate(() => window.__game.run.id), rift.id);
      assert.equal(await map.locator('.floor-cell').count(), 7);
      assert.equal(await map.locator('.rift-gate .run-face img').count(), 2);
      assert.equal(await map.locator('.floor-cell:last-child .run-face img').count(), 1);
      await capture('map');
    }
  };
}

function riftPreparation() {
  const fixture = riftFixture();
  const { spec } = fixture.store.view(fixture.profile, new Date(...riftDate));
  assert.equal(spec.loanIds.length, 5);
  const loan = roster.card(spec.loanIds[0]);
  const heirloom = Bridge.heirloomSkill(loan);
  assert.ok(heirloom);
  return {
    ...fixture.page(), proof: `11.21 · ${spec.bossId} · ${spec.loanIds.join(', ')}`,
    async show(page, { text, capture }) {
      await enterObservatory(page);
      await riftRow(page).click();
      const sheet = page.locator('#sheet.on');
      await text(sheet.locator('#sh-title'), '11월 21일 · 오늘의 균열', { exact: true });
      await text(sheet.locator('.rift-prep > p').first(), '심야의 해구 · 7층 · 전투 4회', { exact: true });
      const loans = sheet.locator('.rift-loans');
      assert.equal(await loans.nth(0).locator('button').count(), 3);
      assert.equal(await loans.nth(1).locator('button').count(), 2);
      await text(sheet.locator('#meta-daily-start'), '첫 기록에 도전', { exact: true });
      await capture();
      await loans.first().locator('button').first().click();
      await text(sheet.locator('#sh-title'), loan.name, { exact: true });
      await text(sheet.getByText('넘길 유품', { exact: true }), '넘길 유품');
      await text(sheet.locator('.heirbox b'), heirloom.name, { exact: true });
      await page.locator('#b-sheetclose').click();
      await page.evaluate(parts => window.__gallerySetDate(...parts), nextRiftDate);
      await sheet.locator('#meta-daily-start').click();
      await text(sheet.locator('#sh-title'), '11월 22일 · 오늘의 균열', { exact: true });
      await text(sheet.locator('.rift-date-notice'), '날짜가 바뀌었다. 11.22 균열을 확인하자.', { exact: true });
      assert.equal(await page.evaluate(key => localStorage.getItem(key), dailyKey), null);
      await capture('midnight');
      await sheet.locator('#meta-daily-start').click();
      await text(page.locator('#map.on header b'), '11.22 균열', { exact: true });
    }
  };
}

function riftBattle() {
  const fixture = riftFixture();
  const run = reachRiftFloor(fixture.start(), 4);
  startBattle(run, { party: Run.defaultParty(run) });
  command(fixture.store.save, run);
  assert.equal(fixture.store.resume().run.room.status, 'order');
  const line = `11.21 · 기록 도전 · 정산한 전투 ${run.stats.turns}턴`;
  return {
    ...fixture.page(), proof: `Saved gate battle → order; ${line}`,
    async show(page, { text }) {
      await enterObservatory(page);
      await riftRow(page).click();
      await page.locator('#order.on').waitFor();
      assert.equal(await page.locator('#order .recruit-flag').count(), 0);
      await openBattle(page);
      await text(page.locator('#room'), '균열 4층', { exact: true });
      assert.doesNotMatch(await page.locator('#battle').innerText(), /정산한 전투/);
      await page.locator('#b-field').click();
      await text(page.locator('#sheet.on #sh-title'), '전장·유물', { exact: true });
      await text(page.locator('#sheet.on #sh-body > p').first(), line, { exact: true });
      assert.equal(await page.evaluate(() => window.__game.clock.paused), true);
    }
  };
}

function riftResult(won) {
  const fixture = riftFixture();
  const run = settleRift(fixture.start(), won);
  command(fixture.store.save, run);
  const title = won ? '11.21 균열 돌파' : '7층에서 균열이 닫혔다';
  assert.equal(fixture.store.resume().run.phase, 'done');
  return {
    ...fixture.page(null, won ? riftDate : nextRiftDate), proof: `${title} · 생존 ${run.bench.length}/5명 · ${run.stats.turns}턴`,
    async show(page, { text, capture }) {
      await enterObservatory(page);
      await riftRow(page).click();
      if (!won) await page.locator('#meta-rift-resume').click();
      const result = page.locator('#daily-result.on');
      await text(result.locator('h1'), title, { exact: true });
      await text(result.locator('.rift-result > p').first(), `생존 ${run.bench.length}/5명 · ${run.stats.turns}턴`, { exact: true });
      const heirlooms = `유품 사용 ${run.stats.heirloomsUsed}회`;
      await text(result.getByText(heirlooms, { exact: true }), heirlooms);
      assert.equal(await result.locator('.rift-result-cast .meta-face img').count(), 5);
      assert.equal(await result.locator('.rift-result-cast .fallen small').count(), 5 - run.bench.length);
      if (won) await text(result.locator('.rift-stamp'), '11.21 · 돌파 도장', { exact: true });
      else assert.equal(await result.locator('.rift-stamp').count(), 0);
      const again = result.locator('#meta-rift-again');
      await text(again, won ? '같은 편성으로 연습' : '오늘 균열 보기', { exact: true });
      await capture();
      await again.click();
      if (won) {
        await text(page.locator('#map.on .gems'), '연습', { exact: true });
        assert.deepEqual(await page.evaluate(() => window.__game.run.daily.spec.loanIds), run.daily.spec.loanIds);
      } else {
        await text(page.locator('#sheet.on #sh-title'), '11월 22일 · 오늘의 균열', { exact: true });
        await page.locator('#b-sheetclose').click();
        await result.locator('#meta-rift-hub').click();
        await text(riftRow(page).locator('small'), '11.22 · 첫 도전', { exact: true });
      }
    }
  };
}

function riftYesterday() {
  const fixture = riftFixture();
  const run = reachRiftFloor(fixture.start(), 4);
  command(fixture.store.save, run);
  return {
    ...fixture.page(null, nextRiftDate), proof: 'Active 11.21 slot while local date is 11.22',
    async show(page, { text, capture }) {
      await enterObservatory(page);
      await riftRow(page).click();
      const sheet = page.locator('#sheet.on');
      await text(sheet.locator('#meta-rift-resume'), '11.21 균열 이어가기', { exact: true });
      await text(sheet.locator('#meta-rift-abandon'), '11.21 도전을 포기', { exact: true });
      await capture();
      await sheet.locator('#meta-rift-abandon').click();
      await text(sheet.locator('#sh-title'), '이 도전을 ‘포기’로 기록할까요?', { exact: true });
      await capture('confirm');
      await sheet.locator('#meta-rift-confirm-abandon').click();
      await text(sheet.locator('#sh-title'), '11월 22일 · 오늘의 균열', { exact: true });
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).days['2026-11-21'].official.outcome, dailyKey), 'abandon');
    }
  };
}

function riftRecords(detail) {
  const fixture = riftFixture();
  // Keep the newest date's first loss and practice win together.
  for (let day = 14; day <= 20; day++) {
    const attempt = fixture.start([2026, 10, day, 12]);
    const abandoned = fixture.store.abandon(attempt.id);
    assert.ok(abandoned.ok, abandoned.reason);
  }
  command(fixture.store.finish, settleRift(fixture.start(), false));
  const practice = settleRift(fixture.start(riftDate, 'practice'), true);
  command(fixture.store.finish, practice);
  const { rows, nextBefore } = fixture.store.history();
  assert.equal(rows.length, 7);
  assert.equal(nextBefore, '2026-11-15');
  assert.equal(rows[0].official.outcome, 'lose');
  assert.equal(rows[0].bestPractice.outcome, 'win');
  return {
    ...fixture.page(), proof: 'Eight dates across two pages, with a first loss and a practice win on 11.21',
    async show(page, { text, capture }) {
      await enterObservatory(page);
      await text(riftRow(page).locator('small'), '11.21 · 연습하기', { exact: true });
      await page.locator('#hub.on [data-meta-page="records"]').click();
      const section = page.locator('#records.on #meta-daily-history');
      const records = section.locator('[data-rift-record]');
      await text(section.locator('h2'), '균열 기록', { exact: true });
      assert.equal(await section.evaluate(node => node.previousElementSibling.querySelector('h2').textContent), '지역별 생환');
      assert.equal(await records.count(), 7);
      await text(records.first(), '11.21 · 심야의 해구 · 7층 실패', { exact: true });
      await section.evaluate(node => node.scrollIntoView({ block: 'start' }));
      if (!detail) {
        await capture();
        await section.locator('#meta-rift-next').click();
        await text(records.first(), '11.14');
        assert.equal(await records.count(), 1);
        await section.locator('#meta-rift-previous').click();
        await text(records.first(), '11.21');
        return;
      }
      await records.first().click();
      const sheet = page.locator('#sheet.on');
      await text(sheet.locator('#sh-title'), '11.21 균열 기록', { exact: true });
      const scores = sheet.locator('.rift-record-score');
      await text(scores.nth(0).locator('h4'), '첫 기록', { exact: true });
      await text(scores.nth(0).locator('p'), '7층 실패', { exact: true });
      await text(scores.nth(1).locator('h4'), '연습 최고', { exact: true });
      await text(scores.nth(1).locator('p'), `돌파 · 생존 ${practice.bench.length}/5명 · ${practice.stats.turns}턴`, { exact: true });
      assert.equal(await sheet.locator('.rift-stamp').count(), 0);
    }
  };
}

const cases = {
  'opening-choices': openingChoices,
  'opening-awaken': openingAwaken,
  'formation-board': formationBoard,
  'reinforcement-board': reinforcementBoard,
  'tempo-telegraph': tempoTelegraph,
  'last-hit': lastHit,
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
  'form-sheet': formSheet,
  'resume-seats': resumeSeats,
  'map-seats': mapSeats,
  'countdown-charge': countdownCharge,
  'contract-sheet': contractSheet,
  'contract-battle-sheet': contractBattleSheet,
  'contract-impossible': contractImpossible,
  'contract-payout': contractPayout,
  'return-stamp': returnStamp,
  'order-hint': orderHint,
  'spring-count': springCount,
  'retreat-outcomes': retreatOutcomes,
  'rift-locked': riftLocked,
  'rift-first': riftFirst,
  'rift-resume': riftResume,
  'rift-preparation': riftPreparation,
  'rift-battle': riftBattle,
  'rift-result-win': () => riftResult(true),
  'rift-result-fail': () => riftResult(false),
  'rift-yesterday': riftYesterday,
  'rift-records': () => riftRecords(false),
  'rift-record-detail': () => riftRecords(true)
};

async function inject(page, session, { daily, now, seed, mute } = {}) {
  const url = seed == null ? gameUrl : gameUrl + '?seed=' + seed;
  const entries = [[sessionKey, session], ...(daily ? [[dailyKey, daily]] : [])];
  if (mute) entries.push(['relaymare.settings', JSON.stringify({ sound: false, music: false })]);
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
    await Promise.race([browserFailure, (async () => {
      await inject(page, session, options);
      await show(page);
    })()]);
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
        assert.ok(Object.hasOwn(cases, selected), `Unknown case: ${selected ?? '(missing name)'}. Use ${Object.keys(cases).join(', ')}`);
        break;
      case '--validate-only':
        validateOnly = true;
        break;
      default:
        assert.fail(`Unknown option: ${args[i]}`);
    }
  }
  return { names: selected ? [selected] : Object.keys(cases), validateOnly };
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
        results.push({ case: name, result: 'FAIL', text: error.message });
        captures.push({ name });
      }
    }
  } finally {
    await browser?.close();
  }
  if (!validateOnly) {
    await writeSheet(captures);
    console.log(`Contact sheet: ${path.join(shots, 'sheet.png')}`);
  }
  console.table(results);
  if (results.some(row => row.result === 'FAIL')) process.exitCode = 1;
}

await main();

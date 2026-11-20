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
import * as Meta from '../src/engine/meta.js';
import { create as makeRoster } from '../src/engine/roster.js';
import * as Run from '../src/engine/run.js';
import * as Save from '../src/engine/save.js';
import { coreBundle } from '../tools/core-bundle.mjs';

const sessionKey = 'relaymare.session';
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

function makeRun({ dungeonId = 'ember_volcano', seed, floor = 1, difficulty, contract, profileView, firstPick, visit }) {
  const run = Run.createRun({ core, roster, dungeonId, seed, difficulty, contract, profileView });
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
    async show(page, { text }) {
      await openBattle(page);
      for (let i = 0; i < 3; i++) await tapTile(page, skill);
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
  const run = makeRun({ seed: 21, floor: 6, profileView: Meta.startView(profile, 'ember_volcano') });
  const party = Run.suggestOrder(run).slice().reverse();
  startBattle(run, { party });
  settleWin(run, { survivors: [true, false, true] });
  advance(run);
  reachFloor(run, 8);
  command(Run.chooseDoor, run, 0);
  const defaults = Run.defaultParty(run);
  const alternate = Run.suggestOrder(run);
  assert.ok(run.guide.bossOrder);
  assert.equal(defaults[0], party[0]);
  assert.equal(defaults[2], party[2]);
  assert.ok(defaults[1] && defaults[1] !== party[1]);
  assert.notDeepEqual(defaults, alternate);
  const name = id => roster.card(id).name;
  const inheritance = Bridge.heirloomPreview(core, alternate).find(entry => entry.to === alternate.at(-1) && entry.skill);
  assert.ok(inheritance);
  return {
    session: storedSession({ run }), proof: `${defaults.join(' → ')} differs from ${alternate.join(' → ')}`,
    async show(page, { text, capture }) {
      const order = page.locator('#order.on');
      for (const [index, id] of defaults.entries()) {
        await text(order.locator(`[data-slot="${index}"] b`), name(id), { exact: true });
      }
      const hint = order.locator('.relay-alternative');
      await text(hint.locator('b'), '다른 순서 · ' + alternate.map(name).join(' → '));
      await text(hint.locator('small'), `${name(inheritance.to)}에게 ${inheritance.skill.name} ×${Bridge.HEIRLOOM_POWER}`);
      await hint.scrollIntoViewIfNeeded();
      await capture();
      await hint.getByRole('button', { name: '이 순서로' }).click();
      for (const [index, id] of alternate.entries()) {
        await text(order.locator(`[data-slot="${index}"] b`), name(id), { exact: true });
      }
      assert.equal(await hint.count(), 0);
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

const cases = {
  'tile-range': tileRange,
  'tile-instant': tileInstant,
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
  'countdown-charge': countdownCharge,
  'contract-sheet': contractSheet,
  'contract-battle-sheet': contractBattleSheet,
  'contract-payout': contractPayout,
  'return-stamp': returnStamp,
  'order-hint': orderHint,
  'spring-count': springCount,
  'retreat-outcomes': retreatOutcomes
};

async function inject(page, session) {
  await page.addInitScript(({ url, key, value }) => {
    const marker = 'relaymare.gallery.seeded';
    if (location.href !== url || sessionStorage.getItem(marker)) return;
    localStorage.setItem(key, value);
    sessionStorage.setItem(marker, '1');
  }, { url: gameUrl, key: sessionKey, value: session });
  await page.goto(gameUrl, { waitUntil: 'domcontentloaded' });
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

async function withPage(browser, session, show) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
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
      await inject(page, session);
      await show(page);
    })()]);
    if (errors.length) throw errors[0];
  } finally {
    await context.close();
  }
}

async function capturePage(page) {
  if (await page.locator('#battle.on').count() && !await page.locator('#result.on').count()) await battleIdle(page);
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
      async capture(label, source = page) {
        captures.push({ name: label ? `${name}-${label}` : name, image: await capturePage(source) });
      },
      revisit: (session, show) => withPage(browser, session, show)
    });
    if (!captures.some(capture => capture.name === name)) {
      captures.push({ name, image: await capturePage(page) });
    }
  });
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

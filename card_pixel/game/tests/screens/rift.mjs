import assert from 'node:assert/strict';
import fs from 'node:fs';
import { heirloomSkill } from '../../src/engine/bridge.js';
import * as Daily from '../../src/engine/daily-rift.js';
import * as DailyStore from '../../src/engine/daily-store.js';
import * as Meta from '../../src/engine/meta.js';
import * as Run from '../../src/engine/run.js';
import { playDaily } from '../../tools/sim.mjs';

export const riftDate = [2026, 10, 21, 23, 59, 59];
const nextRiftDate = [2026, 10, 22, 0, 0, 0];

export function createRiftCases({
  core, roster, sessionKey, dailyKey, command, snowRabbitProfile, makeRun, startBattle, settleWin, storedSession,
  reachFloor, enterObservatory, openBattle, backupStore, mainReturn, applyReturn
}) {
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
    const heirloom = heirloomSkill(loan);
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

  function riftSaveFailure() {
    const fixture = riftFixture();
    fixture.start();
    const first = fixture.page();
    const run = playDaily('2026-11-21');
    assert.deepEqual([run.seed, run.result, run.floor, run.stats.turns], [20261121, 'win', 7, 33]);
    command(fixture.store.save, run);
    const finished = fixture.page();
    const store = backupStore({ [sessionKey]: first.session, [dailyKey]: first.daily });
    assert.equal(store.inspectBackup(store.exportBackup({ dailyRun: run })).summary.dailyActive.floor, 7);
    return {
      ...first, proof: '11.21 official win stays in memory while storage is stuck at floor 1',
      async show(page, { text, capture }) {
        await enterObservatory(page);
        await page.evaluate(({ key, finalSave }) => {
          const { getItem, setItem } = Storage.prototype;
          let reads = 0;
          Storage.prototype.getItem = function (item) {
            // The rift button reads the ledger, then resume reads the in-memory completion fixture.
            if (this === localStorage && item === key && ++reads === 2) return finalSave;
            return getItem.call(this, item);
          };
          Storage.prototype.setItem = function (item, value) {
            if (this === localStorage && item === key) throw new DOMException('Forced rift write failure', 'QuotaExceededError');
            return setItem.call(this, item, value);
          };
        }, { key: dailyKey, finalSave: finished.daily });
        await riftRow(page).click();
        const result = page.locator('#daily-result.on');
        // The export sheet opens at once (aria-modal), so read the alert by CSS rather than by role.
        await text(result.locator('[role="alert"]'), '마지막 저장 지점으로 돌아간다');
        if (await page.locator('#sheet.on #b-sheetclose').isVisible()) await page.locator('#sheet.on #b-sheetclose').click();
        await result.locator('#meta-rift-retry').click();
        await capture();
        await result.getByRole('button', { name: '기록 내보내기' }).click();
        await text(page.locator('#sheet.on .meta-backup'), '균열 2026-11-21 · 7층');
        const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#meta-backup-download').click()]);
        const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
        // The rift store keeps its snapshot as serialized JSON text.
        const raw = backup.daily.active.snapshot;
        const snapshot = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const exportedRun = snapshot?.run ?? snapshot;
        assert.equal(exportedRun?.result, 'win', 'exported rift snapshot keys: ' + Object.keys(snapshot ?? {}).join(','));
        assert.equal(backup.daily.active.checkpoint.floor, 7);
        assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).active.checkpoint.floor, dailyKey), 1);
        await page.locator('#b-sheetclose').click();
        await result.locator('#meta-rift-hub').click();
        await text(page.locator('#session-notices'), '균열 결과는 아직 저장되지 않았다');
        await text(riftRow(page), '저장되지 않은 결과');
        await riftRow(page).click();
        await text(result.getByRole('alert'), '균열 기록을 저장하지 못했다');
      }
    };
  }

  function damagedRiftRecovery() {
    const intro = snowRabbitProfile(17);
    const { profile } = applyReturn(intro, mainReturn(intro, 'ember_volcano', 'normal', 0));
    const fixture = riftFixture(profile);
    fixture.start();
    const run = makeRun({ seed: 0, floor: 2, profileView: Meta.startView(profile, 'ember_volcano') });
    const { session, daily, now } = fixture.page(run);
    const damaged = daily.slice(0, daily.length / 2);
    const lastGood = storedSession({ profile });
    const store = backupStore({ [sessionKey]: session, [dailyKey]: damaged, 'relaymare.lastGood': lastGood });
    const backup = store.exportBackup();
    assert.deepEqual(store.inspectBackup(backup).warnings, ['invalid_daily']);
    assert.equal(backup.session.run.run.floor, 2);
    assert.equal(backup.damagedDaily, damaged);
    assert.equal(store.restoreLastGood().ok, true);
    assert.equal(store.loadDetailed().status, 'ok');
    return {
      session, daily: damaged, lastGood, now,
      proof: 'Truncated rift is quarantined while the floor-2 main save exports and last good restores',
      async show(page, { text, capture }) {
        await page.locator('#hub.on .b-set').click();
        await page.locator('#sheet.on [data-backup-action="export"]').click();
        await text(page.locator('#sheet.on .meta-backup'), '손상된 균열 기록은 파일에 따로 보관했다');
        const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#meta-backup-download').click()]);
        const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
        assert.equal(exported.session.run.run.floor, 2);
        assert.equal(exported.damagedDaily, damaged);
        await page.evaluate(key => localStorage.setItem(key, '{"broken":'), sessionKey);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await text(page.locator('#recovery.on .meta-recovery'), '손상된 균열은 따로 보관한다');
        await capture();
        await Promise.all([page.waitForEvent('domcontentloaded'), page.locator('#meta-last-good').click()]);
        await enterObservatory(page);
        await text(riftRow(page), '첫 도전');
        assert.equal(await page.evaluate(() => window.__game.run), null);
      }
    };
  }

  return {
    riftFixture, reachRiftFloor, riftRow, riftSaveFailure, damagedRiftRecovery,
    cases: {
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
    }
  };
}

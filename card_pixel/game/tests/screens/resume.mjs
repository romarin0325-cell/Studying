import assert from 'node:assert/strict';
import * as Bridge from '../../src/engine/bridge.js';
import { resumePoint } from '../../src/engine/resume.js';
import * as Run from '../../src/engine/run.js';
import { restoreRun, serializeRun } from '../../src/engine/save.js';
import { appendSettlement, battleLog } from '../../src/ui/battle/log.js';
import { battleFailure } from '../../src/ui/battle/view.js';
import { retreatStoryLine } from '../../src/ui/story-lines.js';
import { playRun } from '../../tools/sim.mjs';
import { createCoreRoster } from '../support/core.mjs';

export function createResumeCases({ makeRun, startBattle, settleWin, command, storedSession, snowRabbitProfile, sessionKey }) {
  function finalFixture() {
    const profile = snowRabbitProfile();
    const run = makeRun({ dungeonId: 'twilight_cathedral', seed: 7, floor: 8 });
    startBattle(run);
    settleWin(run);
    assert.deepEqual(resumePoint(run), { kind: 'result', floor: 8 });
    assert.ok(Run.runRewards(run).recruitable.length);
    return { session: storedSession({ run, profile }) };
  }

  const resultLabel = '황혼 성당 8층 · 결과 확인';
  const gateLabel = '홍련 화산 4층 · 문지기 전투 입구부터';
  const ticket = page => page.locator('#hub.on #meta-depart');
  const result = page => page.locator('#battle.on #result.on #result-in');
  const readSession = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), sessionKey);

  let deps;
  function bossCheckpoint(seed) {
    let checkpoint;
    playRun('ember_volcano', seed, {
      relicDoors: true,
      actionOverride(run) {
        if (run.floor === 8) checkpoint ??= serializeRun(run);
      }
    });
    const run = restoreRun(checkpoint, deps ??= createCoreRoster());
    assert.equal(run?.room.status, 'order');
    assert.equal(run.floor, 8);
    return run;
  }

  function replayFixture(run, actions, outcome) {
    const profile = snowRabbitProfile();
    const session = storedSession({ run, profile });
    command(Run.confirmOrder, run, run.room.party);
    const options = Run.battleOptions(run);
    const bridge = Bridge.create((deps ??= createCoreRoster()).core, options);
    const events = bridge.start();
    for (const action of actions) {
      const batch = action === 'retreat' ? bridge.retreat() : bridge.act(action);
      assert.ok(batch.length, `Rejected ${action} on turn ${bridge.state().turn}`);
      events.push(...batch);
    }
    const summary = bridge.summary();
    assert.equal(summary.outcome, outcome);
    assert.equal(events.filter(event => event.t === outcome).length, 1);
    if (outcome === 'win') assert.ok(events.some(event => event.t === 'hp' && event.who.side === 'enemy' &&
      event.who.idx === options.enemies.length - 1 && event.amount > 0 && event.s?.enemy.hp === 0));
    const settled = command(Run.settleBattle, run, summary);
    command(Run.recordBattleLog, run, appendSettlement(battleLog(events, options.party, options.enemies), settled));
    assert.deepEqual(resumePoint(run), { kind: 'result', floor: run.floor });
    const expected = JSON.parse(storedSession({ run, profile })).run;
    assert.equal(Run.settleBattle(run, summary).reason, 'no_active_battle');
    assert.deepEqual(JSON.parse(serializeRun(run)), expected);
    return { session, run, summary, expected, actions };
  }

  async function playToEnd(page, actions, pauseAt) {
    await ticket(page).click();
    await page.locator('#order.on #b-go').click();
    await page.evaluate(() => window.__game.settle());
    for (const [index, action] of actions.entries()) {
      const final = index === actions.length - 1;
      if (final && pauseAt) await page.evaluate(selector => {
        const layer = document.querySelector('#fx');
        const observer = new MutationObserver(() => {
          if (!layer.querySelector(selector)) return;
          observer.disconnect();
          window.__game.clock.paused = true;
        });
        observer.observe(layer, { childList: true });
      }, pauseAt);
      if (action === 'retreat') {
        const retreat = page.locator('#b-retreat:enabled');
        await retreat.click();
        await retreat.click();
      } else {
        await page.locator(`:is(#acts .act, #b-heir)[data-i="${action}"]:enabled`).click();
      }
      if (!final) await page.evaluate(() => window.__game.settle());
      else if (pauseAt) {
        await page.waitForFunction(selector => window.__game.clock.paused && document.querySelector(selector), pauseAt);
        assert.equal(await result(page).count(), 0);
      }
    }
  }

  let bossWin;
  function reloadWin(pauseAt) {
    bossWin ??= replayFixture(bossCheckpoint(23757), [2, 2, 0, 0, 0, 0, 0, 4, 2, 2, 4], 'win');
    const { session, run, summary, expected, actions } = bossWin;
    assert.equal(summary.turns, 11);
    assert.equal(battleFailure(run), null);
    assert.ok(run.resultRewards.recruitable.includes('supernova'));
    return {
      session, motion: 'no-preference', mute: true,
      proof: `Ember 23757 · floor 8 turn 11 · same settled save at ${pauseAt ?? 'result button'}`,
      async show(page, { text, capture }) {
        const before = await readSession(page);
        await playToEnd(page, actions, pauseAt);
        if (pauseAt === '.finish-damage') assert.equal(await page.locator('.finish-cast').count(), 0);
        if (pauseAt === '.finish-cast') await text(page.locator(pauseAt), '승리', { exact: true });
        if (!pauseAt) await result(page).locator('#b-next').waitFor();
        assert.deepEqual((await readSession(page)).run, expected);
        await capture('before-reload', page, { duringBattle: !!pauseAt });

        await page.reload({ waitUntil: 'domcontentloaded' });
        await text(ticket(page), '홍련 화산 8층 · 결과 확인', { exact: true });
        await ticket(page).click();
        await text(result(page).locator('h3'), '홍련 화산 8층 돌파', { exact: true });
        await text(result(page).locator('#b-next'), '영입할 동료 고르기', { exact: true });
        assert.deepEqual((await readSession(page)).run, expected);
        await capture();
        await result(page).locator('#b-next').click();
        await page.locator('#recruit.on [data-candidate="supernova"]').click();
        await page.locator('#meta-recruit-confirm').click();
        await page.locator('#hub.on').waitFor();
        await page.reload({ waitUntil: 'domcontentloaded' });
        const claimed = await readSession(page);
        assert.equal(claimed.run, null);
        assert.equal(claimed.profile.records.runs, before.profile.records.runs + 1);
        assert.deepEqual(claimed.profile.records.appliedRuns.filter(id => id === run.id), [run.id]);
        assert.ok(claimed.profile.recruits.supernova);
      }
    };
  }

  function reloadLoss(fixture, failure, survivorLine, retreatLine) {
    const { session, run, expected, actions } = fixture;
    assert.deepEqual(battleFailure(run), failure);
    assert.deepEqual(Run.runRewards(run).recruitable, []);
    assert.equal(retreatStoryLine(run, deps.roster.card), retreatLine ?? '');
    return {
      session, mute: true, proof: `${run.seed} · ${run.floor}층 · ${failure.title} · ${failure.subtitle}`,
      async show(page, { text, capture }) {
        const banner = '#fx .banner.ult.big';
        await playToEnd(page, actions, '.banner.ult.big');
        await text(page.locator(`${banner} b`), failure.title, { exact: true });
        await text(page.locator(`${banner} span`), failure.subtitle, { exact: true });
        assert.deepEqual((await readSession(page)).run, expected);
        await capture('banner', page, { duringBattle: true });
        await page.evaluate(() => { window.__game.clock.paused = false; });

        async function checkResult() {
          await text(result(page).locator('h3'), failure.title, { exact: true });
          if (survivorLine) await text(result(page).locator('.result-return'), survivorLine, { exact: true });
          else assert.equal(await result(page).locator('.result-return').count(), 0);
          if (retreatLine) await text(result(page).locator('.result-retreat'), retreatLine, { exact: true });
          else assert.equal(await result(page).locator('.result-retreat').count(), 0);
          await text(result(page).locator('#b-next'), '다음 원정 후보 고르기', { exact: true });
        }
        await checkResult();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await ticket(page).click();
        await checkResult();
        assert.deepEqual((await readSession(page)).run, expected);
        await capture();
      }
    };
  }

  return {
    'resume-result-hub': () => ({
      ...finalFixture(), proof: 'A held final victory is labelled 결과 확인 at the observatory',
      async show(page, { text, capture }) {
        await text(ticket(page), resultLabel, { exact: true });
        await capture();
      }
    }),
    'resume-gate-entrance': () => {
      const run = makeRun({ seed: 7, floor: 4 });
      command(Run.chooseDoor, run, 0);
      assert.deepEqual(resumePoint(run), { kind: 'battle', floor: 4, roomType: 'gate', doorIndex: 0 });
      return {
        session: storedSession({ run, profile: snowRabbitProfile() }),
        proof: 'A gate checkpoint shows the entrance label and opens formation',
        async show(page, { text, capture }) {
          await text(ticket(page), gateLabel, { exact: true });
          await capture();
          await ticket(page).click();
          await page.locator('#order.on').waitFor();
          await capture('entrance');
        }
      };
    },
    'resume-result-reload': () => ({
      ...finalFixture(), proof: 'Reloading a final result preserves the panel and its saved settlement',
      async show(page, { text, capture }) {
        const savedRun = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).run, sessionKey);
        async function openResult() {
          await text(ticket(page), resultLabel, { exact: true });
          await ticket(page).click();
          await text(result(page).locator('h3'), '황혼 성당 8층 돌파', { exact: true });
          await text(result(page).locator('#b-next'), '영입할 동료 고르기', { exact: true });
        }
        await openResult();
        const before = await result(page).innerText();
        const settlement = await savedRun();
        await capture('before-reload');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await openResult();
        assert.equal(await result(page).innerText(), before);
        assert.deepEqual(await savedRun(), settlement);
        await capture();
        await result(page).locator('#b-next').click();
        await page.locator('#recruit.on').waitFor();
      }
    }),
    'resume-last-hit': () => reloadWin('.finish-damage'),
    'resume-victory-plate': () => reloadWin('.finish-cast'),
    'resume-victory-button': () => reloadWin(),
    'resume-retreat-loss': () => reloadLoss(
      replayFixture(bossCheckpoint(15838), [3, 2, 2, 'retreat', 0, 0], 'lose'),
      { title: '원정 실패', subtitle: '살아남은 동료 4명', survivors: ['storm_sage', 'desert_fox', 'dragon_miko', 'cream_maid'] },
      '폭풍의현자 외 3명 생존', '폭풍의현자가 물러나 살아남았다.'
    ),
    'resume-true-wipe': () => {
      assert.equal(battleFailure({ result: 'win', lastBattleResult: { outcome: 'win', wiped: true } }), null);
      const retry = { result: null, bench: ['ash', 'siren'], lastBattleResult: { outcome: 'lose', fallenIds: ['ash'], survivorIds: [], wiped: false } };
      assert.deepEqual(battleFailure(retry), { title: '원정 실패', subtitle: '살아남은 동료 1명', survivors: ['siren'] });
      const run = makeRun({ seed: 8 });
      startBattle(run);
      settleWin(run, { survivors: [false, false, false] });
      if (run.pending?.kind === 'reinforcement') {
        command(Run.resolveReinforcement, run, { key: run.pending.key, id: null });
      }
      command(Run.leaveRoom, run);
      command(Run.nextFloor, run);
      command(Run.chooseDoor, run, 1);
      // The order checkpoint keeps the chosen fighters on reload.
      command(Run.confirmOrder, run, run.bench);
      const checkpoint = restoreRun(serializeRun(run), deps ??= createCoreRoster());
      return reloadLoss(replayFixture(checkpoint, Array(12).fill(0), 'lose'),
        { title: '전멸', subtitle: '꿈길이 끊겼다', survivors: [] });
    }
  };
}

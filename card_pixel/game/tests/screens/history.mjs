import assert from 'node:assert/strict';
import { chronicle } from '../../src/engine/history.js';
import * as Meta from '../../src/engine/meta.js';
import * as Run from '../../src/engine/run.js';
import { battleLog } from '../../src/ui/battle/log.js';
import { playRun } from '../../tools/sim.mjs';

function closeRun(profile, run, selection) {
  if (run.phase === 'result') assert.equal(Run.confirmResult(run).ok, true);
  const result = Meta.applyRunEnd(profile, run, selection);
  assert.equal(result.announce.ok, true, result.announce.reason);
  return result.profile;
}

function afterIntro() {
  const initial = Meta.createProfile();
  const { run, end } = playRun('dawn_forest', 17, { profile: initial, opening: 'rescue' });
  return Meta.skipTutorial(closeRun(initial, run, { recruits: end.recruitable.slice(0, 1) }));
}

function recordedReturn(profile, id, seed) {
  let events = [];
  const { run, end } = playRun(id, seed, {
    profile, difficulty: 'easy',
    trace(_run, _wait, _option, more) { events.push(...more); },
    onBattle(current) {
      current.lastBattleLog = battleLog(events, current.room.party ?? [], current.room.enemies);
      events = [];
    }
  });
  assert.equal(run.result, 'win', `${id} seed ${seed}`);
  return { run, end };
}

function towerApproach() {
  let profile = afterIntro();
  for (const [id, seed] of [['ember_volcano', 1000197], ['twilight_cathedral', 7], ['starlit_garden', 7]]) {
    profile = closeRun(profile, recordedReturn(profile, id, seed).run);
  }
  return profile;
}

export function createHistoryCases({ storedSession, enterObservatory }) {
  return {
    'history-recruit'() {
      const profile = afterIntro();
      const { run, end } = recordedReturn(profile, 'ember_volcano', 1000197);
      const history = chronicle(run);
      assert.ok(end.recruitable.includes('sunflower') && end.recruitable.includes('gold_dragon'));
      assert.equal(history.sunflower.outcome, 'reserve');
      assert.deepEqual(history.gold_dragon.used, [
        { fromId: 'red_dragon', skillName: '파이어브레스', floor: 8, roomType: 'boss', won: true }
      ]);
      return {
        session: storedSession({ profile, run }), proof: 'Sunflower returned from reserve and Gold Dragon used an heirloom in the final battle',
        async show(page, { text, capture }) {
          const sunflower = page.locator('#recruit.on [data-candidate="sunflower"]');
          await text(sunflower.locator('.companion-tag'), '예비로 생환', { exact: true });
          await text(sunflower.locator('.companion-story'), '예비석에 남아 함께 돌아왔다.', { exact: true });
          await text(page.locator('#recruit.on [data-candidate="gold_dragon"] .companion-story'),
            '레드드래곤의 파이어브레스를 쓴 홍련 화산 8층 보스전에서 이겼다.', { exact: true });
          await sunflower.click();
          await capture();
          await page.locator('#recruit.on #meta-recruit-confirm').click();
          await text(page.locator('#hub.on [data-recruited="sunflower"] .companion-story'), '예비석에 남아 함께 돌아왔다.', { exact: true });
        }
      };
    },
    'history-collection'() {
      let profile = towerApproach();
      profile = closeRun(profile, recordedReturn(profile, 'ember_volcano', 7).run);
      assert.equal(profile.history.red_dragon.length, 5);
      return {
        session: storedSession({ profile }), proof: 'Five settled expeditions in Red Dragon’s collection detail, newest first',
        async show(page, { text, capture }) {
          await enterObservatory(page);
          await page.locator('#hub.on [data-meta-page="collection"]').click();
          await page.locator('#collection.on [data-companion="red_dragon"]').click();
          await text(page.locator('#sheet.on #sh-title'), '레드드래곤', { exact: true });
          const records = page.locator('#sheet.on .companion-records');
          assert.equal(await records.locator('.companion-story').count(), 5);
          await text(records.locator('li').first().locator('.companion-story'), '홍련 화산 원정에서 쓰러졌다.', { exact: true });
          await text(records.locator('li').last().locator('small'), '새벽의 숲 · 5층 · 원정 승리 · 생환', { exact: true });
          await records.scrollIntoViewIfNeeded();
          await capture();
        }
      };
    },
    'history-ending'() {
      const profile = towerApproach();
      const { run } = recordedReturn(profile, 'creation_tower', 1);
      const history = chronicle(run);
      assert.deepEqual(history.red_dragon.given, [{ toId: 'fenrir', skillName: '파이어브레스' }]);
      assert.deepEqual(history.trans_ares.inherited, [{ fromId: 'fenrir', skillName: '윈터하울링' }]);
      return {
        session: storedSession({ profile, run }), proof: 'Tower settlement remembers the fallen and the inheritor from that expedition',
        async show(page, { text, capture }) {
          await page.locator('#recruit.on #meta-recruit-confirm').click();
          const panel = page.locator('#ending.on [data-screen-panel="settlement"]');
          const records = panel.locator('.companion-records');
          await text(records.locator('li').filter({ hasText: '레드드래곤 ·' }),
            '레드드래곤 · 창조의 탑 8층에서 쓰러져 펜리르에게 파이어브레스를 남겼다.', { exact: true });
          await text(records.locator('li').filter({ hasText: '투신아레스 ·' }),
            '투신아레스 · 펜리르의 윈터하울링을 이어받았다.', { exact: true });
          await records.scrollIntoViewIfNeeded();
          await capture();
          await page.locator('#ending.on [data-screen-tab="dreams"]').click();
          await panel.waitFor({ state: 'hidden' });
        }
      };
    }
  };
}

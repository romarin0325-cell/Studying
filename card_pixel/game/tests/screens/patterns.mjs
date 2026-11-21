import assert from 'node:assert/strict';
import { defaultParty, getTempoView } from '../../src/engine/run.js';

export function createPatternCases({ makeRun, startBattle, storedSession, act, openBattle, battleIdle, skillTile }) {
  function fixture(dungeonId, enemy, first, second) {
    const lead = 'snow_rabbit';
    const run = makeRun({ dungeonId, seed: 2, tempoVersion: 2, profileView: { lead } });
    run.lastParty = [lead, ...run.bench.filter(id => id !== lead).slice(0, 2)];
    const [preview] = getTempoView(run, 0).enemies;
    assert.equal(preview.id, enemy);
    assert.deepEqual(preview.beats.slice(0, 2).map(beat => beat.name), [first, second]);
    const session = storedSession({ run });
    const battle = startBattle(run, { party: defaultParty(run) });
    const wait = act(battle, '일반 공격').findLast(event => event.t === 'await');
    assert.equal(wait.s.enemy.form, enemy);
    assert.equal(wait.s.cur, 0);
    assert.equal(wait.intent.name, second);
    return { session, wait };
  }

  async function nextTurn(page) {
    await skillTile(page, '일반 공격').click();
    await page.waitForFunction(() => window.__game.B.D?.turn === 2);
    await battleIdle(page);
  }

  return {
    'patterns-golem': () => {
      const { session, wait } = fixture('ember_volcano', 'wild_golem', '힘 충전 중', '강타');
      assert.equal(wait.s.enemy.charging, true);
      assert.equal(wait.intent.power, 1.6);
      return {
        session, mute: true,
        proof: 'The first turn has no enemy damage and announces the physical strike one turn ahead',
        async show(page, { text, capture }) {
          await openBattle(page);
          await text(page.locator('#intent'), '내 행동 뒤 · 힘 충전 중', { exact: true });
          await text(page.locator('#pf-cd'), '다음 턴 강타 · 물리 ×1.6', { exact: true });
          await capture();
          await nextTurn(page);
          await text(page.locator('#intent'), '강타');
          await text(page.locator('#pf-cd'), '다음 턴 약공 · 물리 ×0.55', { exact: true });
          await capture('strike');
        }
      };
    },
    'patterns-bat': () => {
      const { session, wait } = fixture('twilight_cathedral', 'wild_night_bat', '흡혈 이빨', '빈틈');
      assert.equal(wait.intent.vulnerable, 1.3);
      return {
        session, mute: true,
        proof: 'The bat rests on turn two and takes 30 percent more damage',
        async show(page, { text, capture }) {
          await openBattle(page);
          await text(page.locator('#intent'), '흡혈 이빨');
          await text(page.locator('#pf-cd'), '다음 턴 빈틈 · 휴식 · 받는 피해 ×1.3', { exact: true });
          await nextTurn(page);
          await text(page.locator('#intent'), '빈틈 · 적 휴식 · 받는 피해 ×1.3', { exact: true });
          await capture();
        }
      };
    }
  };
}

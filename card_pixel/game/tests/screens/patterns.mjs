import assert from 'node:assert/strict';
import { defaultParty, getTempoView } from '../../src/engine/run.js';
import { battleLog } from '../../src/ui/battle/log.js';
import { doorDecision } from '../../src/ui/screens/map.js';

export function createPatternCases({ makeRun, startBattle, storedSession, act, openBattle, battleIdle, skillTile }) {
  function fixture(dungeonId, enemy, first, second, seed = 2) {
    const lead = 'snow_rabbit';
    const run = makeRun({ dungeonId, seed, tempoVersion: 2, profileView: { lead } });
    run.lastParty = [lead, ...run.bench.filter(id => id !== lead).slice(0, 2)];
    const tempo = getTempoView(run, 0);
    const [preview] = tempo.enemies;
    assert.equal(preview.id, enemy);
    assert.deepEqual(preview.beats.slice(0, 2).map(beat => beat.name), [first, second]);
    const mapText = doorDecision(run, run.doors[0], tempo);
    const session = storedSession({ run });
    const battle = startBattle(run, { party: defaultParty(run) });
    const events = act(battle, '일반 공격');
    const wait = events.findLast(event => event.t === 'await');
    assert.equal(wait.s.enemy.form, enemy);
    assert.equal(wait.s.cur, 0);
    assert.equal(wait.intent.name, second);
    return { session, wait, mapText, events, run };
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
    },
    'patterns-beetle': () => {
      const { session, wait, mapText, events } = fixture('ember_volcano', 'wild_emerald_beetle', '껍질 반격', '껍질 돌진', 3);
      const counter = events.find(e => e.t === 'act' && e.who.side === 'enemy');
      assert.equal(counter.skill.name, '껍질 반격');
      assert.ok(counter.skill.val > 0.55);
      assert.match(mapText, /^물리 공격 ×/);
      assert.ok(mapText.startsWith('물리 공격 ×' + wait.intent.power));
      return {
        session, mute: true,
        proof: `The shell reduces incoming attack damage and counters after a hit. The map and turn two show the ×${wait.intent.power} ram.`,
        async show(page, { text, capture }) {
          const map = page.locator('#map.on');
          if (await map.isVisible()) await text(map.locator('[data-map-door="0"] .map-door-line'), mapText, { exact: true });
          await openBattle(page);
          await text(page.locator('#intent'), /껍질 반격.*받는 피해.*피격 시.*미피격 시/);
          await text(page.locator('#pf-cd'), `다음 턴 껍질 돌진 · 물리 ×${wait.intent.power}`, { exact: true });
          await capture('shell');
          await nextTurn(page);
          await text(page.locator('#intent'), '껍질 돌진');
          await text(page.locator('#pf-cd'), '다음 턴 약공 · 물리 ×0.55', { exact: true });
          await capture('ram');
        }
      };
    },
    'patterns-bat-drain': () => {
      const { session, wait, events, run } = fixture('twilight_cathedral', 'wild_night_bat', '흡혈 이빨', '빈틈');
      const heal = events.find(e => e.t === 'rule' && e.rule === 'leech');
      assert.ok(heal?.amount > 0);
      assert.ok(events.some(e => e.t === 'hp' && e.who.side === 'enemy' && e.delta === heal.amount && e.s.enemy.hp === wait.s.enemy.hp));
      const amount = '+' + heal.amount.toLocaleString('en-US');
      const message = '흡혈 ' + amount;
      assert.ok(battleLog(events, run.room.party, run.room.enemies).flatMap(turn => turn.rows).some(row => row.text === message));
      return {
        session, mute: true, motion: 'no-preference',
        proof: `The bite restores ${heal.amount} HP, with a stage effect and the same amount in the battle log.`,
        async show(page, { text, capture }) {
          await openBattle(page);
          await text(page.locator('#intent'), '가한 피해 30% 회복');
          await page.evaluate(() => {
            const fx = document.querySelector('#fx');
            const observer = new MutationObserver(() => {
              if (!fx.querySelector('.num.heal')) return;
              observer.disconnect();
              window.__game.clock.paused = true;
            });
            observer.observe(fx, { childList: true });
          });
          await skillTile(page, '일반 공격').click();
          try {
            await text(page.locator('#fx .num.tag').filter({ hasText: '흡혈' }), '흡혈', { exact: true });
            await text(page.locator('#fx .num.heal'), amount, { exact: true });
            await capture('heal', page, { duringBattle: true });
          } finally {
            await page.evaluate(() => { window.__game.clock.paused = false; });
          }
          await battleIdle(page);
          await page.locator('#b-log').click();
          await text(page.locator('#sheet.on .battle-log-row p').filter({ hasText: message }), message, { exact: true });
          await capture('log');
        }
      };
    }
  };
}

import assert from 'node:assert/strict';
import { resumePoint } from '../../src/engine/resume.js';
import * as Run from '../../src/engine/run.js';

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
    })
  };
}

import assert from 'node:assert/strict';
import * as Run from '../../src/engine/run.js';

export function createPromiseCases({ core, makeRun, command, advance, reachFloor, storedSession }) {
  let snapshots;
  function fixtures() {
    if (snapshots) return snapshots;
    const run = makeRun({ dungeonId: 'ember_volcano', seed: 7, floor: 3, tempoVersion: 2 });
    const event = run.doors.find(door => door.event?.id === 'kept_chest');
    assert.ok(event);
    command(Run.chooseDoor, run, event.index);
    const deposit = run.pending.choices.find(choice => choice.id === 'deposit');
    assert.ok(deposit.enabled);
    const { offer } = deposit.ops[0];
    const relic = core.GameUtils.getArtifactById(offer.relic);
    assert.ok(relic?.name);
    const choice = storedSession({ run });

    command(Run.chooseEvent, run, deposit.id);
    assert.deepEqual(run.promise, offer);
    advance(run);
    reachFloor(run, offer.floor);
    const door = run.doors.find(entry => entry.promiseId === offer.id);
    assert.equal(door.relic, offer.relic);
    assert.ok(run.doors.some(entry => entry.type === 'treasure'));
    const map = storedSession({ run });

    const grant = command(Run.chooseDoor, run, door.index);
    assert.deepEqual(grant.relic, { id: offer.relic, equipped: true });
    assert.equal(run.promise, null);
    return (snapshots = { choice, map, relic: relic.name, door: door.index });
  }

  return {
    'promise-choice'() {
      const { choice, relic } = fixtures();
      return {
        session: choice, mute: true,
        proof: 'Floor 3 reveals the same named relic and the deposit cost before choosing',
        async show(page, { text, capture }) {
          const event = page.locator('#event.on');
          await text(event.locator('h2'), '맡겨 둔 상자', { exact: true });
          await text(event.locator('[data-choice="take_crystal"] b'), '지금 ◆1 받기', { exact: true });
          const deposit = event.locator('[data-choice="deposit"]');
          await text(deposit.locator('b'), '◆1을 맡기면 5층에서 ' + relic + ' 인수', { exact: true });
          // The relic's effect sits under the offer so the deposit can be judged against this party.
          await text(deposit.locator('span'), relic + ' · ');
          await deposit.locator('.relic-icon').waitFor();
          await capture();
        }
      };
    },
    'promise-map'() {
      const { map, relic } = fixtures();
      return {
        session: map, mute: true,
        proof: 'Floor 5 shows the promise marker, named relic, and the treasure route’s forfeiture',
        async show(page, { text, capture }) {
          const map = page.locator('#map.on');
          await map.locator('[data-promise-floor="5"] .relic-icon').waitFor();
          const door = map.locator('.door-plate[data-kind="promise"]');
          await text(door.locator('b'), '약속한 자리', { exact: true });
          await text(door.locator('.door-reward'), relic, { exact: true });
          await text(door.locator('.door-risk'), '맡긴 ◆1로 받는 유물 · 전투 없음', { exact: true });
          await text(map.locator('.door-plate[data-kind="treasure"] .danger'), '보물방에 가면 맡긴 ◆1이 사라집니다.', { exact: true });
          await capture();
        }
      };
    },
    'promise-grant'() {
      const { map, relic, door } = fixtures();
      return {
        session: map, mute: true,
        proof: 'Entering the promise door equips the disclosed relic immediately',
        async show(page, { text, capture }) {
          await page.locator('#map.on [data-door="' + door + '"]').click();
          const grant = page.locator('#treasure.on');
          await text(grant.locator('.run-heading b'), '약속한 자리', { exact: true });
          await text(grant.locator('.run-relic-description h2'), relic, { exact: true });
          await text(grant.locator('.run-relic-description .gain'), '장착 완료', { exact: true });
          assert.equal(await grant.locator('#b-equip').count(), 0);
          await capture();
        }
      };
    }
  };
}

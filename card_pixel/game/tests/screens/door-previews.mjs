import assert from 'node:assert/strict';
import * as Run from '../../src/engine/run.js';
import { restoreRun, serializeRun } from '../../src/engine/run-codec.js';
import { describeAltarRoll, describeSpringCandidates, springPickPrice } from '../../src/ui/service-offers.js';
import { playRun } from '../../tools/sim.mjs';

export function createDoorPreviewCases({ core, roster, storedSession }) {
  return {
    'door-previews'() {
      let checkpoint;
      playRun('ember_volcano', 182137, {
        doorOverride(run) {
          if (run.floor === 3) return run.doors.find(door => door.type === 'altar');
          if (run.floor === 7) checkpoint = serializeRun(run);
        }
      });
      const restore = () => restoreRun(checkpoint, { core, roster });
      const run = restore();
      assert.equal(run?.phase, 'map');
      assert.equal(run.floor, 7);
      assert.deepEqual(run.doors.map(door => door.type), ['spring', 'altar']);
      const [springDoor, altarDoor] = run.doors;
      const spring = Run.previewServiceDoor(run, springDoor.index);
      const altar = Run.previewServiceDoor(run, altarDoor.index);
      assert.equal(serializeRun(run), checkpoint);

      const springRoom = restore(), altarRoom = restore();
      assert.ok(Run.chooseDoor(springRoom, springDoor.index).ok);
      assert.ok(Run.chooseDoor(altarRoom, altarDoor.index).ok);
      assert.deepEqual(Run.getSpringOffer(springRoom), spring);
      assert.deepEqual(Run.altarRoll(altarRoom), altar);

      const candidates = describeSpringCandidates(run, spring, roster.card);
      const blessing = describeAltarRoll(run, altar, roster.card);
      assert.equal(spring.cost, 3);
      assert.deepEqual(candidates.map(slot => [slot.name, slot.short]), [
        ['폭풍의현자', '강화'], ['번개의현자', '합류'], ['신데렐라', '기억']
      ]);
      assert.deepEqual([blessing.name, blessing.previous, blessing.next], ['사쿠라', '기존 축복 +25%', '새 축복 +10%']);

      return {
        session: storedSession({ run }), mute: true,
        proof: 'Floor 7 shows all three spring outcomes and the altar’s +25% → +10% blessing before entry',
        async show(page, { text, capture }) {
          const map = page.locator('#map.on');
          const springPlate = map.locator(`[data-door-preview="${springDoor.index}"]`);
          const altarPlate = map.locator(`[data-door-preview="${altarDoor.index}"]`);
          await text(springPlate.locator('.door-service-preview'), '◆3 · 폭풍의현자 강화 · 번개의현자 합류 · 신데렐라 기억', { exact: true });
          await text(altarPlate.locator('.door-service-preview'), '사쿠라 · 새 축복 +10%', { exact: true });
          await capture();

          await springPlate.locator('[data-info]').click();
          const sheet = page.locator('#sheet.on');
          await text(sheet.locator('#sh-title'), '소환의 샘', { exact: true });
          await text(sheet.locator('#sh-body > p').first(), springPickPrice(spring.cost), { exact: true });
          const rows = sheet.locator('.door-spring-candidates > li');
          assert.equal(await rows.count(), candidates.length);
          for (const [index, candidate] of candidates.entries()) {
            const row = rows.nth(index);
            await text(row.locator('b'), candidate.name, { exact: true });
            await text(row.locator('p').nth(0), candidate.tag, { exact: true });
            await text(row.locator('p').nth(1), candidate.detail, { exact: true });
          }
          await capture('spring-info');
          await sheet.locator('#b-sheetclose').click();

          await altarPlate.locator('[data-info]').click();
          await text(sheet.locator('#sh-title'), '혼돈의 제단', { exact: true });
          const roll = sheet.locator('.door-altar-roll');
          await text(roll.locator('h4'), '첫 굴림 · ' + blessing.name, { exact: true });
          for (const [index, line] of [blessing.previous, blessing.next, blessing.effect].entries()) {
            await text(roll.locator('p').nth(index), line, { exact: true });
          }
          await capture('altar-info');
        }
      };
    }
  };
}

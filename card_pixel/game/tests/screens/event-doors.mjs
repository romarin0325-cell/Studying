import assert from 'node:assert/strict';
import { eventChoices } from '../../src/engine/rooms.js';
import * as Run from '../../src/engine/run.js';
import { restoreRun, serializeRun } from '../../src/engine/run-codec.js';
import { describeEventOffer } from '../../src/ui/event-offers.js';
import { playRun } from '../../tools/sim.mjs';

export function emberEventDoorFixture({ core, roster }) {
  let checkpoint;
  playRun('ember_volcano', 150461, {
    doorOverride(run) {
      if (run.floor === 3) checkpoint = serializeRun(run);
    }
  });
  const run = restoreRun(checkpoint, { core, roster });
  assert.equal(run?.phase, 'map');
  assert.equal(run.floor, 3);
  const door = run.doors.find(entry => entry.event?.id === 'ash_split_wick');
  assert.ok(door, 'Ash appears at the seeded floor-3 door');
  return { run, door };
}

export function createEventDoorCases({ core, roster, storedSession }) {
  return {
    'event-doors'() {
      const { run, door } = emberEventDoorFixture({ core, roster });
      const session = storedSession({ run });
      const artifacts = new Map(core.ARTIFACT_LIST.map(relic => [relic.id, relic]));
      const choices = eventChoices(run, core, roster, door);
      const offers = choices.map(choice => describeEventOffer(run, choice, { core, artifacts, card: roster.card, room: door }));
      assert.deepEqual(offers.map(offer => [offer.shortName, offer.compactPrice, offer.condition]), [
        ['드림파이어', '무료', ''], ['아마겟돈', '◆2', '']
      ]);
      assert.equal(Run.chooseDoor(run, door.index).ok, true);
      assert.deepEqual(run.pending.choices, choices);

      return {
        session, mute: true,
        proof: 'Seed 150461 discloses Ash’s two prices and effects on the map and keeps them on entry',
        async show(page, { text, capture }) {
          const map = page.locator('#map.on');
          const plate = map.locator(`[data-door-preview="${door.index}"]`);
          await plate.scrollIntoViewIfNeeded();
          await text(plate.locator('b'), door.event.name, { exact: true });
          assert.equal(await plate.locator('[data-event-offer]').count(), offers.length);
          for (const [index, choice] of choices.entries()) {
            const row = plate.locator(`[data-event-offer="${choice.id}"]`);
            await text(row.locator('span').nth(0), offers[index].shortName, { exact: true });
            await text(row.locator('span').nth(1), '· ' + offers[index].compactPrice, { exact: true });
          }
          await capture();

          await plate.locator('[data-info]').click();
          const sheet = page.locator('#sheet.on');
          await text(sheet.locator('h4'), door.event.name, { exact: true });
          assert.equal(await sheet.locator('[data-event-offer]').count(), offers.length);
          for (const [index, choice] of choices.entries()) {
            const row = sheet.locator(`[data-event-offer="${choice.id}"]`);
            await text(row.locator('b'), offers[index].name, { exact: true });
            await text(row.locator('p'), offers[index].detail, { exact: true });
          }
          await capture('info');

          await sheet.locator('#b-sheetclose').click();
          await plate.locator('[data-door]').click();
          const event = page.locator('#event.on');
          await text(event.locator('h2'), door.event.name, { exact: true });
          for (const [index, choice] of choices.entries()) {
            const row = event.locator(`[data-choice="${choice.id}"]`);
            await text(row.locator('b'), offers[index].name, { exact: true });
            await text(row.locator('span'), offers[index].detail, { exact: true });
          }
          await capture('entered');
        }
      };
    }
  };
}

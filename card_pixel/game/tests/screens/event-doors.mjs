import assert from 'node:assert/strict';
import { eventChoices } from '../../src/engine/rooms.js';
import * as Run from '../../src/engine/run.js';
import { restoreRun, serializeRun } from '../../src/engine/run-codec.js';
import { describeEventOffer } from '../../src/ui/event-offers.js';
import { drawText } from '../../src/ui/reveal.js';
import { playRun } from '../../tools/sim.mjs';

export function eventDoorFixture({ core, roster }, { dungeonId, seed, floor, eventId }) {
  let checkpoint;
  playRun(dungeonId, seed, {
    doorOverride(run) {
      if (run.floor === floor) checkpoint = serializeRun(run);
    }
  });
  const run = restoreRun(checkpoint, { core, roster });
  assert.equal(run?.phase, 'map');
  assert.equal(run.floor, floor);
  const door = run.doors.find(entry => entry.event?.id === eventId);
  assert.ok(door, eventId + ' appears at the seeded door');
  return { run, door };
}

export function emberEventDoorFixture(context) {
  return eventDoorFixture(context, { dungeonId: 'ember_volcano', seed: 150461, floor: 3, eventId: 'ash_split_wick' });
}

export const randomWakeCases = [
  { dungeonId: 'midnight_trench', seed: 3, floor: 3, eventId: 'dragon_thaw', choiceId: 'wake',
    id: 'red_dragon', kind: 'boost', label: '레드드래곤 강화' },
  { dungeonId: 'starlit_garden', seed: 23, floor: 5, eventId: 'empty_role', choiceId: 'mask',
    id: 'sylphid', kind: 'memory', label: '실피드 기억' },
  { dungeonId: 'midnight_trench', seed: 4, floor: 3, eventId: 'dragon_thaw', choiceId: 'wake',
    id: 'shadow_cat', kind: 'join', label: '섀도우캣 합류', requiresRelease: true }
];

export function createEventDoorCases({ core, roster, storedSession }) {
  function describeCase({ run, door }, proof, wake) {
    const session = storedSession({ run });
    const artifacts = new Map(core.ARTIFACT_LIST.map(relic => [relic.id, relic]));
    const choices = eventChoices(run, core, roster, door);
    const offers = choices.map(choice => describeEventOffer(run, choice, { core, artifacts, card: roster.card, room: door }));
    assert.equal(Run.chooseDoor(run, door.index).ok, true);
    assert.deepEqual(run.pending.choices, choices);
    let receipt;
    if (wake) {
      const offer = offers[choices.findIndex(choice => choice.id === wake.choiceId)];
      assert.equal(offer.shortName, wake.label);
      assert.ok(offer.detail.includes(wake.label));
      const result = Run.chooseEvent(run, wake.choiceId);
      assert.equal(result.ok, true);
      const draw = result.effects.find(effect => effect.draw).draw;
      assert.equal(draw.id, wake.id);
      assert.equal(draw.kind, wake.kind);
      receipt = drawText(draw, roster.card);
    } else {
      assert.deepEqual(offers.map(offer => [offer.shortName, offer.compactPrice, offer.condition]), [
        ['드림파이어', '무료', ''], ['아마겟돈', '◆2', '']
      ]);
    }

    return {
      session, mute: true,
      proof,
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
        if (wake) {
          await event.locator(`[data-choice="${wake.choiceId}"]`).click();
          await text(event.locator('.event-dialog p'), receipt, { exact: true });
          await capture('result');
        }
      }
    };
  }

  return {
    'event-doors': () => describeCase(emberEventDoorFixture({ core, roster }),
      'Seed 150461 discloses Ash’s two prices and effects on the map and keeps them on entry'),
    ...Object.fromEntries(randomWakeCases.filter(wake => !wake.requiresRelease).map(wake => [
      'event-doors-' + wake.kind,
      () => describeCase(eventDoorFixture({ core, roster }, wake),
        `Seed ${wake.seed} previews ${wake.label} on the map and in the event and delivers the same result`, wake)
    ]))
  };
}

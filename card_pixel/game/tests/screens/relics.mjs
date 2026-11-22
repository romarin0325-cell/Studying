import assert from 'node:assert/strict';
import { createProfile, startView } from '../../src/engine/meta.js';
import * as Run from '../../src/engine/run.js';

export function createRelicCases({ core, roster, storedSession }) {
  const dungeonId = 'ember_volcano';
  const profile = createProfile();
  profile.records.clears = Object.fromEntries(['dawn_forest', dungeonId].map(id => [id, { easy: 0, normal: 1, nightmare: 0 }]));
  profile.unlockedDungeons.push(dungeonId);
  // Tours already seen, so the first-contact coach does not cover the reward choices under test.
  profile.ui.entry.tours = ['preparation', 'difficulty', 'region', 'mission', 'relic', 'relic-replace'];

  function command(run, action, ...args) {
    const result = action(run, ...args);
    assert.equal(result.ok, true, `${action.name} on floor ${run.floor}: ${result.reason}`);
    return result;
  }

  function win(run, index) {
    command(run, Run.enterBattleDoor, { floor: run.floor, index, partyIds: Run.defaultParty(run) });
    const { party, enemies } = Run.battleOptions(run);
    return command(run, Run.settleBattle, {
      outcome: 'win', survivors: party.map(Boolean), retreated: [false, false, false],
      heirloomsGained: [], heirloomsUsed: 0, lastStands: 0,
      enemyDowns: enemies.map((enemy, idx) => ({ idx, treasure: enemy.affixes?.includes('treasure') ?? false })), turns: 3
    });
  }

  function advance(run) {
    if (run.pending?.kind === 'reinforcement') {
      command(run, Run.resolveReinforcement, { key: run.pending.key, id: null });
    }
    command(run, Run.leaveRoom);
    command(run, Run.nextFloor);
  }

  function riskMap() {
    const run = Run.createRun({ core, roster, dungeonId, seed: 1, profileView: startView(profile, dungeonId) });
    while (run.pending?.kind === 'start') command(run, Run.chooseStartPick, run.pending.candidates[0]);
    win(run, 0);
    advance(run);
    const risk = run.doors.find(door => door.risk);
    assert.equal(risk.relicReward, true);
    assert.equal(risk.reward, 0);
    return { run, risk };
  }

  const nameOf = id => core.GameUtils.getArtifactById(id).name;
  const result = page => page.locator('#result.on');
  const decision = page => result(page).locator('.victory-decision');

  return {
    'relics-risk-door'() {
      const { run, risk } = riskMap();
      const name = nameOf(risk.relic);
      return {
        session: storedSession({ run, profile }), proof: 'The floor-2 risk door previews the same relic on the portal and reward card',
        async show(page, { text, capture }) {
          const map = page.locator('#map.on');
          const portal = map.locator(`[data-map-door="${risk.index}"] .map-door-relic`);
          const reward = map.locator(`[data-door-preview="${risk.index}"] .door-reward`);
          await text(portal, name, { exact: true });
          await text(reward, name, { exact: true });
          assert.equal(await portal.locator('.relic-icon').count(), 1);
          assert.equal(await reward.locator('.relic-icon').count(), 1);
          await capture();
        }
      };
    },
    'relics-gate-partner'() {
      const { run, risk } = riskMap();
      assert.equal(win(run, risk.index).relic.id, 'frozen_body');
      advance(run);
      command(run, Run.chooseDoor, 0);
      advance(run);
      win(run, 0);
      const { candidates, relic, partner } = run.pending;
      assert.ok(candidates.length);
      assert.equal(partner?.id, 'ice_break');
      assert.ok(relic && relic !== partner.id);
      return {
        session: storedSession({ run, profile }), proof: 'A defeated shadow, the regular relic and the ice combo reward share one pick',
        async show(page, { text, capture }) {
          await result(page).locator('#b-next').click();
          const panel = decision(page);
          const offer = panel.locator('[data-relic="ice_break"]');
          await text(panel.locator('.lead'), '보상은 하나만 고를 수 있습니다.', { exact: true });
          await text(offer.locator('.relic-combo-hint'), '프로즌바디 조합 · 기절한 적에게 피해 2배', { exact: true });
          assert.ok(await panel.locator('[data-id]').count());
          await panel.locator(`[data-relic="${relic}"]`).waitFor();
          await offer.click();
          await text(panel.locator('#b-gate-take'), '아이스브레이크 받기', { exact: true });
          await capture();
          await panel.locator('#b-gate-take').click();
          await text(result(page).locator('.relic-receipt'), '아이스브레이크 · 장착 완료', { exact: true });
        }
      };
    },
    'relics-full-rack'() {
      const { run, risk } = riskMap();
      const held = ['reverse', 'companion', 'double_attack', 'over_flame'];
      assert.ok(!held.includes(risk.relic));
      run.relics = held.slice();
      assert.equal(win(run, risk.index).relic.chooseReplacement, true);
      assert.deepEqual(run.pending.replace, held);
      return {
        session: storedSession({ run, profile }), proof: 'The floor-2 reward uses the existing four-slot replacement decision in the victory panel',
        async show(page, { text, capture }) {
          await result(page).locator('#b-next').click();
          const panel = decision(page);
          assert.equal(await panel.locator('[data-replace]').count(), 4);
          assert.equal(await panel.locator('#b-equip').isDisabled(), true);
          await panel.locator('[data-replace="reverse"]').click();
          await text(panel.locator('.incoming h3'), nameOf(risk.relic), { exact: true });
          await text(panel.locator('.outgoing h3'), nameOf('reverse'), { exact: true });
          await capture();
          await panel.locator('#b-equip').click();
          await text(result(page).locator('.relic-receipt'), `${nameOf(risk.relic)} · 장착 완료`, { exact: true });
        }
      };
    }
  };
}

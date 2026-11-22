import assert from 'node:assert/strict';
import { RIFT_PUZZLES } from '../../src/content/rift-puzzles.js';
import * as Bridge from '../../src/engine/bridge.js';
import * as DailyStore from '../../src/engine/daily-store.js';
import * as Run from '../../src/engine/run.js';
import { dreamClearProfile } from './goals.mjs';

export const puzzleSolutions = {
  'arena-relay': ['hellhound', 'time_ruler', 'trauma'],
  'ember-clock': ['shooting_star_boy', 'forget_me_not', 'cinderella'],
  'trench-heirlooms': ['black_swan', 'legendary_captain', 'sylphid']
};

// Use the same decisions for every starting order. The bot reads the options available that turn.
export function playPuzzleFight(run, core, order = Run.defaultParty(run)) {
  assert.equal(Run.confirmOrder(run, order).ok, true);
  const battle = Bridge.create(core, Run.battleOptions(run));
  let events = battle.start();
  let defended = false;
  const actions = [];
  while (battle.awaiting && actions.length < 100) {
    const usable = battle.options().filter(option => option.usable);
    const intent = events.findLast(event => event.t === 'await')?.intent;
    const { allies, cur } = battle.state();
    const fighter = allies[cur];
    const incoming = intent?.dmg?.[1] ?? 0;
    const kill = usable.filter(option => option.preview?.kill).sort((a, b) => a.cost - b.cost)[0];
    let defense;
    if (!kill && !defended && incoming > 0) {
      const hasBuff = (option, ...ids) => option.effects.some(effect => effect.type === 'buff' && ids.includes(effect.id));
      const exact = usable.find(option => (intent.kind === 'phy' && hasBuff(option, 'barrier'))
        || (intent.kind === 'mag' && hasBuff(option, 'magic_guard')));
      const half = usable.find(option => hasBuff(option, 'guard', 'damage_half'));
      if (exact && (intent.name !== '일반 공격' || incoming >= fighter.hp)) defense = exact;
      else if (half && !fighter.buffs.damage_half && (intent.ult || incoming >= fighter.maxHp * 0.33 || incoming >= fighter.hp)) {
        defense = half;
      }
    }
    const attack = usable.filter(option => option.preview?.dmg > 0).sort((a, b) => b.preview.dmg - a.preview.dmg)[0];
    const option = kill ?? defense ?? attack ?? usable.find(option => option.index === 0);
    assert.ok(option, 'Expected a playable battle action');
    actions.push(option.index);
    defended = option.type === 'sup';
    events = battle.act(option.index);
  }
  assert.ok(battle.outcome, 'The fixed fight must finish');
  const summary = battle.summary();
  assert.equal(Run.settleBattle(run, summary).ok, true);
  assert.equal(Run.confirmResult(run).ok, true);
  return { summary, actions };
}

export function createPuzzleCases({ core, roster, dailyKey, storedSession, enterObservatory }) {
  const profile = dreamClearProfile();
  // The rift's first-visit tour would cover the sheet; these cases test the puzzles, not the tour.
  profile.ui.entry.tours = [...new Set([...(profile.ui.entry.tours ?? []), 'daily-rift', 'daily-rift-resume'])];
  const puzzle = RIFT_PUZZLES[0];
  const now = [2026, 10, 29, 12];
  const openFromBanner = async page => {
    await enterObservatory(page);
    await page.locator('#hub.on #meta-daily-rift').click();
    await page.locator('#sheet.on #meta-rift-puzzles').click();
    await page.locator(`#sheet.on [data-rift-puzzle="${puzzle.id}"]`).click();
  };

  function solvedFixture() {
    const saved = new Map();
    const store = DailyStore.create({
      getItem: key => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value)
    }, { core, roster });
    const started = store.startPuzzle({ profile, puzzleId: puzzle.id });
    assert.equal(started.ok, true, started.reason);
    const { actions } = playPuzzleFight(started.run, core, puzzleSolutions[puzzle.id]);
    const best = store.finishPuzzle(started.run);
    assert.equal(best.ok, true, best.reason);
    assert.deepEqual([best.score.goalMet, best.score.turns, best.score.livingIds.length], [true, 24, 3]);
    return { actions, daily: saved.get(dailyKey) };
  }

  return {
    'puzzles-list'() {
      return {
        session: storedSession({ profile }), daily: solvedFixture().daily, now,
        proof: 'The post-ending records button opens three fixed puzzles and reads the stored arena best',
        async show(page, { text, capture }) {
          await enterObservatory(page);
          await page.locator('#hub.on [data-meta-page="records"]').click();
          await page.locator('#records.on #meta-record-puzzles').click();
          const sheet = page.locator('#sheet.on');
          await text(sheet.locator('#sh-title'), '균열 퍼즐', { exact: true });
          const cards = sheet.locator('[data-rift-puzzle]');
          assert.equal(await cards.count(), 3);
          await text(cards.first(), '최고 기록 · 목표 달성 · 생존 3/5명 · 24턴');
          await text(cards.nth(1), '12턴 이내');
          await text(cards.nth(2), '유품 2회 이상 사용');
          await capture();
        }
      };
    },
    'puzzles-formation'() {
      return {
        session: storedSession({ profile }), now,
        proof: 'The observatory banner opens floor seven directly with the original three seats and two reserves',
        async show(page, { text, capture }) {
          await openFromBanner(page);
          const order = page.locator('#order.on');
          await text(order.locator('.rift-puzzle-goal'), puzzle.title);
          await text(order.locator('#b-opponents'), '7층');
          assert.deepEqual(await order.locator('.relay-seat b').allTextContents(), puzzle.rentals.slice(0, 3).map(id => roster.card(id).name));
          assert.deepEqual(await order.locator('[data-bench]').evaluateAll(nodes => nodes.map(node => node.dataset.bench)), puzzle.rentals.slice(3));
          await capture();
        }
      };
    },
    'puzzles-result'() {
      const { actions } = solvedFixture();
      return {
        session: storedSession({ profile }), now, mute: true,
        proof: 'Replaying real battle actions after swapping the last two seats reaches the arena puzzle goal',
        async show(page, { text, capture }) {
          await openFromBanner(page);
          await page.locator('#order.on [data-slot="1"]').click();
          await page.locator('#order.on [data-slot="2"]').click();
          await page.locator('#order.on #b-go').click();
          for (const index of actions) {
            await page.evaluate(() => window.__game.settle());
            await page.locator(`#battle.on :is(#acts .act, #b-heir)[data-i="${index}"]`).click();
          }
          await page.evaluate(() => window.__game.settle());
          await page.locator('#result.on #b-next').click();
          const result = page.locator('#daily-result.on');
          await text(result.locator('h1'), '목표 달성', { exact: true });
          await text(result.locator('.rift-puzzle-result'), '생존 3/5명 · 24턴');
          // One row per goal condition: the verdict and the value this attempt reached.
          assert.deepEqual(await result.locator('.rift-puzzle-checks li').evaluateAll(rows => rows.map(row =>
            [...row.children].map(cell => cell.textContent).join('|'))), ['달성|보스 격파|격파', '달성|생존 3명 이상|3명']);
          assert.equal(await result.locator('.rift-stamp').count(), 0);
          const ledger = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), dailyKey);
          assert.deepEqual([ledger.days, ledger.active, ledger.puzzleBests[puzzle.id].turns], [{}, null, 24]);
          await capture();
        }
      };
    }
  };
}

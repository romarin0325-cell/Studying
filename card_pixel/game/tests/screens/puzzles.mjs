import assert from 'node:assert/strict';
import { RIFT_PUZZLES } from '../../src/content/rift-puzzles.js';
import * as Bridge from '../../src/engine/bridge.js';
import * as DailyStore from '../../src/engine/daily-store.js';
import * as Run from '../../src/engine/run.js';
import { dreamClearProfile } from './goals.mjs';

// Use the same decisions for every starting order. The bot reads the options available that turn.
export function settlePuzzleFight(run, core, order = Run.defaultParty(run), allow = () => true) {
  assert.equal(Run.confirmOrder(run, order).ok, true);
  const options = Run.battleOptions(run);
  const battle = Bridge.create(core, options);
  let events = battle.start();
  let defended = false;
  const actions = [];
  while (battle.awaiting && actions.length < 100) {
    const usable = battle.options().filter(option => option.usable && allow(option));
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
  return { summary, actions, battleSeed: options.seed };
}

export function playPuzzleFight(run, core, order, allow) {
  const fight = settlePuzzleFight(run, core, order, allow);
  assert.equal(Run.confirmResult(run).ok, true);
  return fight;
}

export function advanceFirstRiftFight(run, core) {
  assert.equal(Run.enterBattleDoor(run, { floor: 1, index: 0, partyIds: Run.defaultParty(run) }).ok, true);
  const battle = Bridge.create(core, Run.battleOptions(run));
  battle.start();
  for (const index of [3, 3, 3, 0]) battle.act(index);
  assert.equal(battle.outcome, 'win');
  assert.equal(Run.settleBattle(run, battle.summary()).ok, true);
  assert.equal(Run.leaveRoom(run).ok, true);
  assert.equal(Run.nextFloor(run).ok, true);
  assert.deepEqual([run.floor, run.phase, run.stats.turns], [2, 'map', 4]);
}

export function createPuzzleCases({ core, roster, dailyKey, storedSession, enterObservatory }) {
  const profile = dreamClearProfile();
  // The rift's first-visit tour would cover the sheet; these cases test the puzzles, not the tour.
  profile.ui.entry.tours = [...new Set([...(profile.ui.entry.tours ?? []), 'daily-rift', 'daily-rift-resume'])];
  const puzzle = RIFT_PUZZLES[0];
  const [save, heirloom] = puzzle.endings;
  const order = ['hellhound', 'time_ruler', 'trauma'];
  const now = [2026, 10, 29, 12];
  const openFromBanner = async page => {
    await enterObservatory(page);
    await page.locator('#hub.on #meta-daily-rift').click();
    await page.locator('#sheet.on #meta-rift-puzzles').click();
    await page.locator(`#sheet.on [data-rift-puzzle="${puzzle.id}"]`).click();
  };
  const chooseEnding = (page, endingId) => page.locator(`#sheet.on [data-rift-ending="${endingId}"]`).click();

  function fixtureStore() {
    const saved = new Map();
    const storage = {
      getItem: key => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value)
    };
    return { store: DailyStore.create(storage, { core, roster }), saved, storage };
  }

  function startFixture(store, endingId) {
    const started = store.startPuzzle({ profile, puzzleId: puzzle.id, endingId });
    assert.equal(started.ok, true, started.reason);
    return started.run;
  }

  function fightFixture(store, endingId) {
    const run = startFixture(store, endingId);
    const { actions } = settlePuzzleFight(run, core, order);
    const recorded = store.finishPuzzle(run);
    const { ok, reason, score } = recorded;
    assert.equal(ok, true, reason);
    assert.deepEqual([score.outcome, score.goalMet, score.turns, score.survivors], ['win', endingId === heirloom.id, 24, 1]);
    if (endingId === heirloom.id) {
      assert.deepEqual(score.conditions, [
        { kind: 'win', met: true, value: 'win' },
        { kind: 'fall', target: 'hellhound', met: true, value: 'fallen' },
        { kind: 'heirloomUsed', target: 'hellhound', met: true, value: ['time_ruler'] }
      ]);
    } else {
      assert.deepEqual(score.conditions, [
        { kind: 'win', met: true, value: 'win' },
        { kind: 'survive', target: 'hellhound', met: false, value: 'fallen' }
      ]);
    }
    assert.equal(Run.confirmResult(run).ok, true);
    assert.deepEqual(store.finishPuzzle(run), recorded);
    return actions;
  }

  function resultFixture(ending, other, expected) {
    const { store } = fixtureStore();
    const actions = fightFixture(store, ending.id);
    const met = ending.id === heirloom.id;
    return {
      session: storedSession({ profile }), now, mute: true,
      proof: met ? 'The recorded heirloom use meets the chosen ending' : 'The same victory misses the chosen survival ending',
      async show(page, { text, capture }) {
        await openFromBanner(page);
        await chooseEnding(page, ending.id);
        await page.locator('#order.on [data-slot="1"]').click();
        await page.locator('#order.on [data-slot="2"]').click();
        await page.locator('#order.on #b-go').click();
        for (const index of actions) {
          await page.evaluate(() => window.__game.settle());
          await page.locator(`#battle.on :is(#acts .act, #b-heir)[data-i="${index}"]`).click();
        }
        await page.evaluate(() => window.__game.settle());
        const readLedger = () => page.evaluate(key => localStorage.getItem(key), dailyKey);
        const recorded = await readLedger();
        const { puzzleBests, days, active } = JSON.parse(recorded);
        const endingBests = puzzleBests[puzzle.id];
        assert.deepEqual([days, active, Object.keys(endingBests), endingBests[ending.id].turns],
          [{}, null, [ending.id], 24]);
        await page.locator('#result.on #b-next').click();
        const result = page.locator('#daily-result.on');
        await text(result.locator('h1'), met ? '목표 달성' : '목표 미달성', { exact: true });
        await text(result.locator('.rift-puzzle-chosen'), ending.title, { exact: true });
        await text(result.locator('.rift-puzzle-stats'), '출전 생존 1명 · 24턴');
        assert.deepEqual(await result.locator('.rift-puzzle-checks li').evaluateAll(rows => rows.map(row =>
          [...row.children].map(cell => cell.textContent).join('|'))), expected);
        await text(result.locator('.rift-puzzle-other'), `다른 결말 · ${other.title}`, { exact: true });
        assert.equal(await result.locator('.rift-stamp').count(), 0);
        assert.equal(await readLedger(), recorded);
        await capture();
      }
    };
  }

  return {
    'rift-stale-tab'() {
      const now = [2026, 10, 21, 12];
      const { store, saved, storage } = fixtureStore();
      const { ok, reason, run } = store.start({
        profile, now: new Date(...now), expectedDayKey: '2026-11-21', kind: 'official'
      });
      assert.equal(ok, true, reason);
      const first = saved.get(dailyKey);
      const second = DailyStore.create(storage, { core, roster });
      const stale = second.resume().run;
      advanceFirstRiftFight(run, core);
      assert.deepEqual(store.save(run), { ok: true });
      const latest = saved.get(dailyKey);
      assert.equal(Run.enterBattleDoor(stale, { floor: 1, index: 0, partyIds: Run.defaultParty(stale) }).ok, true);
      assert.deepEqual(second.save(stale), { ok: false, reason: 'stale_tab' });
      assert.equal(saved.get(dailyKey), latest);

      async function resumeRift(page) {
        await enterObservatory(page);
        await page.locator('#hub.on #meta-daily-rift').click();
        await page.locator('#sheet.on #meta-rift-resume').click();
      }

      return {
        session: storedSession({ profile }), daily: first, now, mute: true,
        proof: 'A second tab saves floor two, so floor-one confirmation is refused and reload keeps four turns',
        async show(page, { text, capture }) {
          await resumeRift(page);
          const enter = page.locator('#order.on #b-go');
          await enter.waitFor();
          const other = await page.context().newPage();
          try {
            await other.goto(page.url(), { waitUntil: 'domcontentloaded' });
            await other.evaluate(({ key, checkpoint }) => localStorage.setItem(key, checkpoint), { key: dailyKey, checkpoint: latest });
            await enter.click();
            const notice = page.locator('#stale-session[open]');
            await text(notice.locator('h3'), '다른 창에서 진행 중', { exact: true });
            await text(notice.locator('button'), '이 창에서 이어하기', { exact: true });
            assert.equal(await page.evaluate(key => localStorage.getItem(key), dailyKey), latest);
            await capture(undefined, page, { duringBattle: true });
            await Promise.all([page.waitForEvent('domcontentloaded'), notice.locator('button').click()]);
            await resumeRift(page);
            await page.locator('#map.on').waitFor();
            assert.deepEqual(await page.evaluate(() => {
              const { floor, phase, stats } = window.__game.run;
              return [floor, phase, stats.turns];
            }), [2, 'map', 4]);
          } finally {
            await other.close();
          }
        }
      };
    },
    'puzzles-list'() {
      const { store, saved } = fixtureStore();
      fightFixture(store, heirloom.id);
      fightFixture(store, save.id);
      const puzzles = store.puzzles(profile);
      assert.deepEqual(puzzles.map(item => item.endings.length), [2, 2, 2]);
      assert.deepEqual(puzzles[0].endings.map(ending => ending.best.goalMet), [false, true]);
      return {
        session: storedSession({ profile }), daily: saved.get(dailyKey), now,
        proof: 'Records opens three puzzles with two ending marks each and reads the two arena bests',
        async show(page, { text, capture }) {
          await enterObservatory(page);
          await page.locator('#hub.on [data-meta-page="records"]').click();
          await page.locator('#records.on #meta-record-puzzles').click();
          const sheet = page.locator('#sheet.on');
          await text(sheet.locator('#sh-title'), '균열 퍼즐', { exact: true });
          const cards = sheet.locator('[data-rift-puzzle]');
          assert.equal(await cards.count(), 3);
          assert.equal(await cards.locator('.rift-puzzle-ending').count(), 6);
          const arena = cards.first();
          await text(arena, save.title);
          await text(arena, heirloom.title);
          assert.deepEqual(await arena.locator('.rift-puzzle-mark').allTextContents(), ['미달', '달성']);
          assert.deepEqual(await arena.locator('.rift-puzzle-record').allTextContents(),
            Array(2).fill('최고 기록 · 출전 생존 1명 · 24턴'));
          assert.deepEqual(await cards.nth(1).locator('.rift-puzzle-mark').allTextContents(), ['기록 없음', '기록 없음']);
          await capture();
        }
      };
    },
    'puzzles-choice'() {
      const { store } = fixtureStore();
      assert.deepEqual(store.puzzles(profile)[0].endings.map(ending => ending.conditions.map(item => item.kind)),
        [['win', 'survive'], ['win', 'fall', 'heirloomUsed']]);
      return {
        session: storedSession({ profile }), now,
        proof: 'Opening a puzzle offers two named endings, each with its own goal',
        async show(page, { text, capture }) {
          await openFromBanner(page);
          const sheet = page.locator('#sheet.on');
          await text(sheet.locator('#sh-title'), '결말 고르기', { exact: true });
          const buttons = sheet.locator('[data-rift-ending]');
          assert.equal(await buttons.count(), 2);
          await text(buttons.first(), '보스 격파 · 헬하운드가 직접 싸우고 생존');
          await text(buttons.last(), '보스 격파 · 헬하운드가 쓰러짐 · 다른 동료가 헬하운드의 유품 사용');
          assert.equal(await page.locator('#order.on').count(), 0);
          await capture();
        }
      };
    },
    'puzzles-formation'() {
      const { store } = fixtureStore();
      const run = startFixture(store, save.id);
      assert.deepEqual(Run.defaultParty(run), puzzle.rentals.slice(0, 3));
      return {
        session: storedSession({ profile }), now,
        proof: 'Choosing the survival ending opens the original floor-seven formation',
        async show(page, { text, capture }) {
          await openFromBanner(page);
          await chooseEnding(page, save.id);
          const order = page.locator('#order.on');
          await text(order.locator('.rift-puzzle-goal'), `${puzzle.title} · ${save.title}`);
          await text(order.locator('.rift-puzzle-goal'), '헬하운드가 직접 싸우고 생존');
          await text(order.locator('#b-opponents'), '7층');
          assert.deepEqual(await order.locator('.relay-seat b').allTextContents(), puzzle.rentals.slice(0, 3).map(id => roster.card(id).name));
          assert.deepEqual(await order.locator('[data-bench]').evaluateAll(nodes => nodes.map(node => node.dataset.bench)), puzzle.rentals.slice(3));
          await capture();
        }
      };
    },
    'puzzles-result'() {
      return resultFixture(heirloom, save, [
        '달성|보스 격파|격파', '달성|헬하운드가 쓰러짐|쓰러짐', '달성|다른 동료가 헬하운드의 유품 사용|시간의지배자'
      ]);
    },
    'puzzles-result-missed'() {
      return resultFixture(save, heirloom, ['달성|보스 격파|격파', '미달|헬하운드가 직접 싸우고 생존|쓰러짐']);
    }
  };
}

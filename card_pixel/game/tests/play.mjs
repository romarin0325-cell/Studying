// node card_pixel/game/tests/play.mjs [--seeds=7,21] [--tutorial=both|follow|skip] [--intro-only] [--runs=2] [--headed] [--no-build]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';
import { DUNGEONS } from '../src/content/dungeons.js';

const game = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(game, '../..');
const shots = path.join(game, 'tests', 'shots');
const args = process.argv.slice(2);
if (args.includes('--entry-count')) {
  // Pipe tools/sim.mjs --entry-audit here to count its winning route without launching Chrome.
  let output = '';
  for await (const chunk of process.stdin.setEncoding('utf8')) output += chunk;
  assert.ok(output.trim(), 'Pipe tools/sim.mjs --entry-audit to play.mjs --entry-count');
  const rows = output.trim().split(/\r?\n/).map(line => JSON.parse(line));
  const end = rows.pop();
  assert.equal(end.seed, 6115841);
  assert.equal(end.result, 'win');
  assert.deepEqual(end.relics, ['big_bang']);
  assert.deepEqual(end.recruitable, ['cherry_prince']);
  const battles = rows.filter(row => row.party);
  const rooms = rows.filter(row => row.room);
  assert.deepEqual(battles.map(row => [row.floor, row.index, row.party, row.pending]), [
    [1, 0, ['sun_moon_sword_maiden', 'gold_dragon', 'cherry_prince'], 'reinforcement'],
    [2, 1, ['gold_dragon', 'sakura', 'cherry_prince'], 'reinforcement'],
    [4, 0, ['sun_moon_sword_maiden', 'sakura', 'cherry_prince'], 'gate'],
    [6, 0, ['cinderella', 'sakura', 'cherry_prince'], 'reinforcement'],
    [8, 0, ['supernova', 'sakura', 'cherry_prince'], null]
  ]);
  assert.deepEqual(rooms.map(row => [row.index, row.room]), [
    [0, 'wild'], [1, 'wild'], [0, 'spring'], [0, 'gate'], [1, 'treasure'], [0, 'wild'], [0, 'spring'], [0, 'boss']
  ]);
  for (const floor of [3, 7]) assert.equal(rooms.find(row => row.floor === floor).bench.length, 6);
  // Audit inputs for this route: two starter picks, two skipped springs,
  // one treasure equip, three reinforcements, one captive and one recruit.
  const swaps = [3, 2, 1, 1, 1];
  const tally = [['지명', 2, 4], ...rooms.map(({ floor }) => {
    const i = battles.findIndex(row => row.floor === floor);
    const taps = i < 0 ? 2 : 1 + Number([2, 6].includes(floor)) + swaps[i] * 2 + (battles[i].pending ? 2 : 1);
    return [floor + '층', 2, taps];
  }), ['영입', 1, 1]];
  const screens = tally.reduce((sum, [, count]) => sum + count, 0);
  const taps = tally.reduce((sum, [, , count]) => sum + count, 0);
  assert.ok(screens <= 19 && taps <= 43);
  console.table(tally.map(([step, screens, taps]) => ({ step, screens, taps })));
  console.log(`6,115,841 · engine win · ${swaps.reduce((a, b) => a + b)} audit swaps · ${screens} non-battle screens · ${taps} taps (flow count)`);
  process.exit(0);
}
const option = (name, fallback) => args.find(arg => arg.startsWith(name + '='))?.slice(name.length + 1) ?? fallback;
const seeds = option('--seeds', '7,21').split(',').map(Number);
const runCount = Number(option('--runs', '2'));
const tutorialMode = option('--tutorial', 'both');
assert(['both', 'follow', 'skip'].includes(tutorialMode), 'Use --tutorial=both, --tutorial=follow or --tutorial=skip');
assert(seeds.every(seed => Number.isSafeInteger(seed) && seed > 0 && seed <= 0xffffffff),
  'Use positive 32-bit seeds, for example --seeds=7,21');
assert(Number.isSafeInteger(runCount) && runCount > 0, 'Use a positive run count, for example --runs=2');

const screenshotLabels = [
  'title', 'opening', 'borrowed-battle', 'first-awakening', 'map', 'order', 'battle-turn', 'big-move',
  'event', 'treasure', 'gate-reward', 'reinforce', 'boss', 'recruit', 'hub', 'destinations',
  'preparation', 'collection', 'notebook', 'records'
];
const openingChoices = {
  stand: { label: '애쉬로 마지막 공격', lead: '눈토끼', next: '다음 동료 고르기' },
  rescue: { label: '물러나기', lead: '애쉬', next: '다음 동료 고르기' }
};

async function launch() {
  const options = { headless: !args.includes('--headed') };
  if (process.env.CHROMIUM_PATH) {
    return chromium.launch({ ...options, executablePath: process.env.CHROMIUM_PATH });
  }
  try {
    return await chromium.launch(options);
  } catch (playwrightError) {
    for (const channel of ['chrome', 'msedge']) {
      try {
        const browser = await chromium.launch({ ...options, channel });
        console.log('Using the installed browser: ' + channel);
        return browser;
      } catch {
        // Try the next installed browser.
      }
    }
    throw playwrightError;
  }
}

function watchBrowser(page) {
  return new Promise((_, reject) => {
    const fail = (kind, detail) => reject(new Error('Browser ' + kind + ': ' + detail));
    page.on('console', message => {
      if (message.type() === 'error') fail('console.error', message.text());
    });
    page.on('pageerror', error => fail('pageerror', error.stack || error.message));
    page.on('crash', () => fail('crash', 'the game page crashed'));
  });
}

function installFrameCounter() {
  window.__playFrames = [];
  let previousBattleFrame;
  function tick(now) {
    if (document.querySelector('#battle.on')) {
      if (previousBattleFrame !== undefined) window.__playFrames.push(now - previousBattleFrame);
      previousBattleFrame = now;
    } else {
      previousBattleFrame = undefined;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function look({ canRetreat = false } = {}) {
  const game = window.__game;
  const run = game.run;
  const active = document.querySelector('.screen.on');
  const sheet = document.querySelector('#sheet.on');
  const screen = active?.id;
  const inBattle = screen === 'battle';
  const result = inBattle && !!active.querySelector('#result.on');
  const ready = inBattle && !result && !game.busy && !!active.querySelector('.act:not([disabled])');
  const opening = ready && !!active.querySelector('.opening-choice');
  const form = !!sheet?.querySelector('[data-form]');
  const battle = ready ? game.B.bridge : null;
  const battleState = battle?.state();
  const fighterId = battleState ? game.B.party[battleState.cur] : null;
  let tap = null;
  let formIndex = null;

  if (ready && !opening) {
    const fighter = battleState.allies[battleState.cur];
    const intent = game.B.intent || {};
    const options = battle.options();
    const usable = options.filter(action => action.usable);
    const buff = (action, ids) => action.effects.some(effect => effect.type === 'buff' && ids.includes(effect.id));
    const incoming = intent.dmg?.[1] || 0;
    const kill = usable.filter(action => action.preview?.kill).sort((a, b) => a.cost - b.cost)[0];
    const exact = usable.find(action => (intent.kind === 'phy' && buff(action, ['barrier']))
      || (intent.kind === 'mag' && buff(action, ['magic_guard'])));
    const half = usable.find(action => buff(action, ['guard', 'damage_half']));
    const best = usable.filter(action => action.preview?.dmg > 0).sort((a, b) => b.preview.dmg - a.preview.dmg)[0];
    const dangerous = intent.ult || incoming >= fighter.maxHp / 3 || incoming >= fighter.hp;
    const defend = incoming > 0 && exact && intent.name !== '일반 공격';
    const reduce = incoming > 0 && half && !fighter.buffs.damage_half && dangerous;
    const retreat = !kill && !exact && (intent.lethal || incoming >= fighter.hp);
    const pick = kill || (defend && exact) || (reduce && half) || best || usable[0];

    if (canRetreat && retreat && battle.canRetreat()) {
      tap = { retreat: true };
    } else if (pick) {
      if (pick.name.startsWith('기적의우화 → ')) {
        const firstForm = options.find(action => action.name.startsWith('기적의우화 → '));
        formIndex = pick.index;
        tap = { selector: '.act[data-i="' + firstForm.index + '"]' };
      } else {
        tap = { selector: pick.heirloom ? '#b-heir' : '.act[data-i="' + pick.index + '"]' };
      }
    }
  }

  const signature = node => node && [
    node.textContent,
    node.querySelectorAll('button:not([disabled])').length,
    [...node.querySelectorAll('.sel, [aria-pressed="true"]')].map(item => item.textContent)
  ];
  return {
    screen, result, ready, opening, tap, form, formIndex, fighterId,
    coach: document.querySelector('.coach:not([hidden])')?.dataset.coachStep,
    visible: JSON.stringify([screen, signature(active), signature(sheet), result]),
    bigMove: inBattle && !!active.querySelector('.skillplate'),
    dungeonId: run?.dungeonId,
    floor: run?.floor,
    floors: run?.floors,
    room: run?.room?.type,
    crystals: run?.crystals,
    pendingKind: run?.pending?.kind,
    retry: !!run?.awaitingRetryResult,
    doors: screen === 'map' ? run.doors.map(({ type, index, enemies }) => ({ type, index, battle: !!enemies.length })) : [],
    outcome: run?.result,
    stats: run?.stats
  };
}

function readCheckpoint() {
  const run = window.__game.run;
  return {
    screen: document.querySelector('.screen.on')?.id,
    runId: run?.id,
    floor: run?.floor,
    pending: JSON.stringify(run?.pending),
    crystals: run?.crystals
  };
}

async function clickIfVisible(page, selector) {
  const target = page.locator(selector).first();
  if (!(await target.isVisible())) return false;
  await target.click();
  return true;
}

async function playTitle({ page, shot, skipTutorial }) {
  await page.locator('#title.on').waitFor();
  await page.locator('.coach[data-coach-step="title"]').waitFor();
  await shot('title');
  if (skipTutorial) await page.locator('.coach-skip').click();
  await page.locator('#title.on #b-start').click();
}

async function playAwaken({ page }, state, expedition) {
  if (state.room === 'awakening') {
    const awaken = page.locator('#awaken.on');
    assert.equal(await awaken.locator('.wake-lead .face-badge b').innerText(), openingChoices[expedition.openingPath].lead);
    if (await awaken.locator('#wake-draws').isVisible()) {
      const depart = awaken.locator('#b-depart');
      await depart.waitFor();
      assert.equal(await awaken.locator('.wake-slot.landed').count(), 3, 'First awakening did not reveal three companions');
      await depart.click();
      expedition.firstAwakening = true;
      return;
    }
  }
  if (await clickIfVisible(page, '#awaken.on #b-depart')) return;
  if (await clickIfVisible(page, '#awaken.on #b-wake:not([disabled])')) return;
  if (await clickIfVisible(page, '#awaken.on #wake-choices .cardrow')) {
    await page.locator('#awaken.on #b-wake').click();
  }
}

async function playMap({ page }, state) {
  const elite = state.doors.find(door => door.type === 'elite');
  const safe = state.doors.find(door => door.type !== 'elite');
  const door = (state.crystals < 3 && elite) || safe || state.doors[0];
  assert(door, 'No doors on floor ' + state.floor);
  await page.locator('#map.on .door-entry[data-door="' + door.index + '"]').click();
  await page.locator('#map.on').waitFor({ state: 'hidden' });
  if (door.battle) await page.locator('#order.on').waitFor();
}

async function playOrder({ page }) {
  const order = page.locator('#order.on');
  const go = order.locator('#b-go');
  assert.equal(await go.innerText(), '이대로 전투 시작');
  const names = await order.locator('.relay-seat b').allTextContents();
  await go.click();
  await page.locator('#battle.on').waitFor();
  const actual = await page.evaluate(() => window.__game.B.party.map(id => id && window.__game.roster.card(id).name));
  assert.deepEqual(actual, names.map(name => name === '빈 자리' ? null : name.replace(/★\d+$/, '')));
}

async function playReinforce({ page }) {
  const screen = page.locator('#result.on .victory-decision');
  const single = screen.locator('article[data-candidate]');
  if (await single.count()) {
    assert.equal(await screen.locator('#b-reinforce-pass').innerText(), '보충 없이 다음 층으로');
  } else await screen.locator('button[data-candidate]').first().click();
  const outgoing = screen.locator('[data-release]').last();
  if (await outgoing.isVisible()) await outgoing.click();
  await screen.locator('#b-reinforce-take').click();
}

async function chooseWhoLeaves(page) {
  const confirm = page.locator('#sheet.on #b-dismiss-confirm');
  if (!await confirm.isVisible()) return false;
  // Send away the most recent joiners first; the confirm button enables once enough are picked.
  const choices = page.locator('#sheet.on [data-dismiss-id][aria-pressed="false"]');
  while (await confirm.isDisabled() && await choices.count()) await choices.last().click();
  await confirm.click();
  return true;
}

async function playSpring({ page }, state, expedition) {
  if (await page.locator('#spring.on #b-take').isVisible()) {
    if (await clickIfVisible(page, '#spring.on #b-take:not([disabled])')) return;
    if (await clickIfVisible(page, '#spring.on .cardrow:not([disabled])')) {
      await page.locator('#spring.on #b-take').click();
    } else await clickIfVisible(page, '#spring.on #b-spring-pass');
    return;
  }
  if (expedition.springAttempt !== state.floor) {
    const purchase = state.crystals >= 3 && await page.locator('#spring.on #b-pick:not([disabled])').count()
      ? '#b-pick' : '#b-draw';
    if (await clickIfVisible(page, '#spring.on ' + purchase + ':not([disabled])')) {
      expedition.springAttempt = state.floor;
      return;
    }
  }
  await clickIfVisible(page, '#spring.on #b-leave:not([disabled])');
}

async function playAltar({ page }) {
  if (await clickIfVisible(page, '#altar.on #b-keep:not([disabled])')) return;
  if (await clickIfVisible(page, '#altar.on #b-roll:not([disabled])')) return;
  await clickIfVisible(page, '#altar.on #b-leave:not([disabled])');
}

async function playEvent({ page }) {
  if (await page.locator('#sheet.on #b-event-target').isVisible()) {
    await page.locator('#sheet.on #sh-body .cardrow').first().click();
    await page.locator('#sheet.on #b-event-target').click();
    return;
  }
  if (await clickIfVisible(page, '#event.on button[data-choice]:not([disabled])')) return;
  await page.locator('#event.on #b-leave').click();
}

async function playTreasure({ page }, state) {
  const scope = state.result ? '#result.on .victory-decision' : '#treasure.on';
  if (await clickIfVisible(page, scope + ' #b-equip:not([disabled])')) return;
  if (await clickIfVisible(page, scope + ' [data-replace][aria-pressed="false"]')) {
    await clickIfVisible(page, scope + ' #b-equip:not([disabled])');
    return;
  }
  await clickIfVisible(page, scope + ' #b-leave:not([disabled])');
}

async function playGateReward({ page }) {
  const scope = '#result.on .victory-decision';
  if (await clickIfVisible(page, scope + ' #b-gate-take:not([disabled])')) return;
  const picked = await clickIfVisible(page, scope + ' [data-relic]') || await clickIfVisible(page, scope + ' .cardrow');
  await page.locator(scope + (picked ? ' #b-gate-take' : ' #b-leave')).click();
}

async function playBattle({ page }, state, expedition) {
  if (state.result) {
    const result = page.locator('#battle.on #result.on');
    if (await clickIfVisible(page, '#result.on #b-reinforce-done, #result.on #b-gate-done')) return;
    const next = result.locator('#b-next');
    if (await next.isVisible()) {
      const label = await next.innerText();
      const labels = { reinforcement: '동료 보충하기', gate: '문지기 보상 고르기', relic: '유물 보상 고르기' };
      if (state.room === 'borrowed') assert.equal(label, openingChoices[expedition.openingPath].next);
      else if (state.retry) assert.equal(label, '편성 바꿔 재도전');
      else if (labels[state.pendingKind]) assert.equal(label, labels[state.pendingKind]);
      else if (state.outcome) assert.match(label, /^(영입할 동료 고르기|다음 원정 후보 고르기|관측소로)$/);
      else assert.equal(label, state.floor + 1 + '층으로');
      if (label === '관측소로') expedition.returned = state;
      await next.click();
      return;
    }
    if (state.pendingKind === 'reinforcement') return playReinforce({ page });
    if (state.pendingKind === 'gate') return playGateReward({ page });
    if (state.pendingKind === 'relic') return playTreasure({ page }, state);
    throw new Error('Result has no available action');
  }
  if (!state.ready) return;
  if (state.coach === 'inherit' || state.coach === 'rescue') {
    const target = state.coach === 'inherit' ? page.locator('#b-heir.on') : page.locator('.act').filter({ hasText: '실버스톰' });
    await target.click();
  } else if (state.room === 'borrowed' && !expedition.borrowedStarted) {
    assert.equal(state.fighterId, 'ash', 'The borrowed battle should start with Ash');
    assert(state.opening, 'Ash did not get the opening decision');
    const buttons = page.locator('#battle.on .opening-choice:not([disabled])');
    assert.deepEqual(await buttons.locator('b').allTextContents(),
      [openingChoices.rescue.label, openingChoices.stand.label]);
    const label = openingChoices[expedition.openingPath].label;
    await buttons.filter({ has: page.getByText(label, { exact: true }) }).click();
    if (expedition.openingPath === 'rescue') expedition.retreats++;
    expedition.borrowedStarted = true;
  } else if (!state.tap) {
    return;
  } else if (state.tap.retreat) {
    await page.locator('#battle.on #b-retreat').click();
    await page.locator('#battle.on #b-retreat.armed').click();
    expedition.retreats++;
  } else if (state.form) {
    await page.locator('#sheet.on [data-form="' + expedition.formIndex + '"]').click();
    expedition.formIndex = null;
  } else {
    await page.locator('#battle.on ' + state.tap.selector).click();
    if (state.formIndex !== null) {
      expedition.formIndex = state.formIndex;
      return;
    }
  }
  expedition.waitStarted = performance.now();
}

async function playRecruit({ page, shot }) {
  await shot('recruit');
  const first = page.locator('#recruit.on [data-candidate]').first();
  if (await first.isVisible() && await first.getAttribute('aria-pressed') !== 'true') await first.click();
  await page.locator('#recruit.on #meta-recruit-confirm').click();
  await page.locator('#hub.on, #ending.on').waitFor();
  if (await page.locator('#ending.on').isVisible()) {
    await shot('ending');
    await page.locator('#ending.on #meta-ending-finish').click();
  }
  await page.locator('#hub.on').waitFor();
  await shot('hub');
}

async function playDestinations({ page, shot }, tried) {
  await page.locator('#hub.on #meta-telescope').click();
  await page.locator('#dungeons.on').waitFor();
  await shot('destinations');
  const unlocked = await page.locator('#dungeons.on button[data-dungeon]').evaluateAll(
    buttons => buttons.map(button => button.dataset.dungeon)
  );
  const dungeon = unlocked.find(id => id !== 'dawn_forest' && !tried.has(id));
  assert(dungeon, 'No untried unlocked main destination. Unlocked: ' + unlocked.join(', '));
  await page.locator('#dungeons.on button[data-dungeon="' + dungeon + '"]').click();
  return dungeon;
}

async function playPreparation({ page, shot }) {
  const depart = page.locator('#sheet.on .meta-prep #meta-start-expedition');
  if (!await depart.isVisible()) {
    assert.equal(await page.evaluate(() => window.__game.run?.difficulty), 'easy');
    return;
  }
  await dismissTour(page);
  const journey = page.locator('#sheet.on [data-difficulty="normal"]');
  if (await journey.isVisible() && await journey.getAttribute('aria-pressed') !== 'true') await journey.click();
  await shot('preparation');
  await depart.click();
  assert.equal(await page.evaluate(() => window.__game.run.difficulty), 'normal');
}

async function playHubPages({ page, shot }) {
  for (const id of ['collection', 'notebook', 'records']) {
    await page.locator('#hub.on [data-meta-page="' + id + '"]').click();
    await page.locator('#' + id + '.on').waitFor();
    await dismissTour(page);
    await shot(id);
    await page.locator('#' + id + '.on .meta-back').click();
  }
  await page.locator('#hub.on').waitFor();
}

const roomPlayers = {
  awaken: playAwaken,
  map: playMap,
  order: playOrder,
  spring: playSpring,
  altar: playAltar,
  event: playEvent,
  treasure: playTreasure,
  battle: playBattle
};

function dismissTour(page) {
  return clickIfVisible(page, '.coach:not([hidden]) .coach-next:not([hidden])');
}

async function captureRoom({ shot }, state) {
  if (state.screen === 'awaken') await shot('first-awakening');
  if (['map', 'order', 'event', 'treasure', 'reinforce'].includes(state.screen)) await shot(state.screen);
  if (state.screen === 'pick') await shot('gate-reward');
  if (state.opening) await shot('opening');
  if (state.room === 'borrowed' && !state.opening && (state.ready || state.result)) await shot('borrowed-battle');
  if (state.ready && state.room !== 'borrowed') await shot('battle-turn');
  if (state.bigMove) await shot('big-move');
  if (state.ready && state.room === 'boss') await shot('boss');
}

async function collectFrames(page, expedition) {
  const frames = await page.evaluate(() => window.__playFrames.splice(0));
  expedition.frames = expedition.frames.concat(frames);
}

async function resumeExpedition(campaign, expedition) {
  const { page } = campaign;
  const before = await page.evaluate(readCheckpoint);
  await collectFrames(page, expedition);
  await page.reload({ waitUntil: 'domcontentloaded' });
  // A saved main expedition opens at the observatory, with an explicit resume button.
  await page.locator('#hub.on #meta-depart').click();
  const after = await page.evaluate(readCheckpoint);
  assert.deepEqual(after, before);
  campaign.resumed = true;
  console.log('  Reload verified on floor ' + before.floor + ' (' + before.screen + ', ' + before.crystals + ' crystals)');
}

async function shouldResume({ page, resumed }, expedition, state) {
  if (resumed || expedition.dungeon === 'dawn_forest') return false;
  if (state.result && state.pendingKind === 'reinforcement') return state.floor > 1;
  if (!['spring', 'altar', 'event', 'treasure'].includes(state.screen)) return false;
  if (state.pendingKind) return true;
  if (state.floor !== 3) return false;
  if (state.screen !== 'spring') return true;
  // Let the spring return from its offer or reveal before reloading the room.
  return (expedition.springAttempt === state.floor || state.crystals === 0)
    && await page.locator('#spring.on #b-leave:not([disabled])').isVisible();
}

async function failStuck({ page, seed }, state) {
  await page.screenshot({ path: path.join(shots, seed + '-00-stuck.png') });
  const log = await page.evaluate(() => window.__game.B.log.slice(-12));
  throw new Error('Stuck for 25 s on ' + state.screen + ', floor ' + state.floor
    + ', pending ' + state.pendingKind + ', tap ' + JSON.stringify(state.tap) + '\n' + log.join('\n'));
}

async function playExpedition(campaign, dungeon, depart, openingPath) {
  const { page } = campaign;
  const expedition = { dungeon, openingPath, retreats: 0, frames: [], waits: [], started: performance.now() };
  let lastProgress = expedition.started;
  let previousScreen;
  await depart(campaign);
  for (;;) {
    const state = await page.evaluate(look, { canRetreat: expedition.retreats === 0 });
    const now = performance.now();
    if (expedition.returned && ['hub', 'ending'].includes(state.screen)) {
      await collectFrames(page, expedition);
      report(campaign.seed, expedition, expedition.returned, (now - expedition.started) / 1000);
      return;
    }
    assert.equal(state.dungeonId, dungeon, 'Unexpected expedition');
    if (state.visible !== previousScreen) {
      lastProgress = now;
      previousScreen = state.visible;
    }
    if (expedition.waitStarted !== undefined && (state.screen !== 'battle' || state.ready || state.result)) {
      expedition.waits.push(now - expedition.waitStarted);
      expedition.waitStarted = undefined;
    }
    if (now - lastProgress >= 25000) await failStuck(campaign, state);
    if (state.stats.retries >= 20) throw new Error('Intro gate retry limit reached on floor ' + state.floor);
    if (state.coach?.startsWith('tour-') && await dismissTour(page)) continue;
    // A full roster (six) asks who leaves before a spring draw, a gate captive or an event recruit joins.
    if (await chooseWhoLeaves(page)) continue;
    await captureRoom(campaign, state);
    if (state.screen === 'recruit') {
      const seconds = (now - expedition.started) / 1000;
      await collectFrames(page, expedition);
      report(campaign.seed, expedition, state, seconds);
      assert(['win', 'lose'].includes(state.outcome), 'Expedition ended without a result');
      assert.equal(state.floors, dungeon === 'dawn_forest' ? 5 : 8);
      if (state.outcome === 'win') assert.equal(state.floor, state.floors, 'Expedition won before its last floor');
      if (dungeon === 'dawn_forest') {
        assert.equal(state.outcome, 'win', 'The intro must be cleared to unlock the main expeditions');
        assert(expedition.borrowedStarted, 'The borrowed battle never opened for play');
        assert(expedition.firstAwakening, 'The first awakening was never completed');
        assert(await page.locator('#recruit.on [data-candidate]').first().isVisible(),
          'The intro offered no recruit');
      }
      await playRecruit(campaign);
      return;
    }
    if (await shouldResume(campaign, expedition, state)) {
      await resumeExpedition(campaign, expedition);
      continue;
    }
    const playRoom = roomPlayers[state.screen];
    assert(playRoom, 'Unexpected screen during the expedition: ' + state.screen);
    await playRoom(campaign, state, expedition);
    await sleep(40);
  }
}

function percentile(sorted, fraction) {
  return sorted.length ? Math.round(sorted[Math.ceil(sorted.length * fraction) - 1]) : '-';
}

function report(seed, expedition, state, seconds) {
  const { stats } = state;
  const { frames, retreats, dungeon } = expedition;
  const waits = expedition.waits.sort((a, b) => a - b);
  const mean = frames.length ? (frames.reduce((sum, frame) => sum + frame, 0) / frames.length).toFixed(1) : '-';
  const over = ms => frames.length ? (100 * frames.filter(frame => frame > ms).length / frames.length).toFixed(2) + '%' : '-';
  console.log('\nSeed ' + seed + ' · ' + DUNGEONS[dungeon].name + ' (' + dungeon + ') · ' + state.outcome
    + ' · floors ' + state.floor + '/' + state.floors + ' · ' + seconds.toFixed(1) + ' s');
  console.log('  battles ' + stats.battles + ', best hit ' + stats.best + ', heirlooms used ' + stats.heirloomsUsed + ', retreats ' + retreats);
  console.log('  wait after battle actions: median ' + percentile(waits, 0.5) + ' ms, p90 ' + percentile(waits, 0.9)
    + ' ms, max ' + percentile(waits, 1) + ' ms (' + waits.length + ' actions)');
  console.log('  battle frames ' + frames.length + ', mean ' + mean + ' ms, >20 ms ' + over(20) + ', >34 ms ' + over(34));
}

async function playCampaign(campaign, openingPath) {
  const { page, seed } = campaign;
  await page.addInitScript(installFrameCounter);
  const url = pathToFileURL(path.join(game, 'dist', 'Relaymare.html'));
  url.searchParams.set('seed', seed);
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await playExpedition(campaign, 'dawn_forest', playTitle, openingPath);
  const first = 'ember_volcano';
  async function departFirst() {
    if (!campaign.skipTutorial) await page.locator('.coach[data-coach-step="departure"]').waitFor();
    await page.locator('#hub.on #meta-depart').click();
    assert.equal(await page.locator('#sheet.on .meta-prep').count(), 0);
    const entry = await page.evaluate(() => ({
      dungeon: window.__game.run.dungeonId,
      difficulty: window.__game.run.difficulty,
      tutorial: JSON.parse(localStorage.getItem('relaymare.session')).profile.ui.entry
    }));
    assert.equal(entry.dungeon, first);
    assert.equal(entry.difficulty, 'easy');
    assert.equal(entry.tutorial.skipped, campaign.skipTutorial);
    if (!campaign.skipTutorial) assert(entry.tutorial.done.includes('departure'));
  }
  if (args.includes('--intro-only')) {
    await departFirst();
    return;
  }
  await playExpedition(campaign, first, departFirst);
  const tried = new Set([first]);
  for (let i = 1; i < runCount; i++) {
    const dungeon = await playDestinations(campaign, tried);
    tried.add(dungeon);
    await playExpedition(campaign, dungeon, playPreparation);
  }
  assert(campaign.resumed, 'No main expedition reached a mid-run save checkpoint');
  await playHubPages(campaign);
}

async function playSeed(browser, seed, index) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const taken = new Set();
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    async function shot(label) {
      if (taken.has(label)) return;
      const number = String(taken.size + 1).padStart(2, '0');
      await page.screenshot({ path: path.join(shots, seed + '-' + number + '-' + label + '.png') });
      taken.add(label);
    }
    let openingPath = index % 2 ? 'rescue' : 'stand';
    if (seed === 7) openingPath = 'stand';
    if (seed === 21) openingPath = 'rescue';
    const skipTutorial = tutorialMode === 'skip' || tutorialMode === 'both' && index % 2 === 1;
    const campaign = { page, seed, shot, resumed: false, skipTutorial };
    console.log('\nCampaign ' + seed + ' · opening: ' + openingChoices[openingPath].label + ' · ' + (skipTutorial ? 'skip' : 'follow'));
    await Promise.race([watchBrowser(page), playCampaign(campaign, openingPath)]);
  } finally {
    const missing = screenshotLabels.filter(label => !taken.has(label));
    if (missing.length) console.log('Seed ' + seed + ' · screenshots not reached: ' + missing.join(', '));
    await context.close();
  }
}

if (!args.includes('--no-build')) execFileSync(process.execPath, [path.join(game, 'build.mjs')], { cwd: repo, stdio: 'inherit' });
await fs.mkdir(shots, { recursive: true });
const browser = await launch();
try {
  if (!args.includes('--headed')) console.log('Frame baseline on this PC: about 20 ms in headless Chrome, even on a blank page.');
  for (const [index, seed] of seeds.entries()) {
    try {
      await playSeed(browser, seed, index);
    } catch (error) {
      console.error('Seed ' + seed + ' FAILED\n' + (error.stack || error));
      process.exitCode = 1;
    }
  }
} finally {
  await browser.close();
}

// node card_pixel/game/tests/play.mjs [--seeds=7,21] [--runs=2] [--headed]
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
const option = (name, fallback) => args.find(arg => arg.startsWith(name + '='))?.slice(name.length + 1) ?? fallback;
const seeds = option('--seeds', '7,21').split(',').map(Number);
const runCount = Number(option('--runs', '2'));
assert(seeds.every(seed => Number.isSafeInteger(seed) && seed > 0 && seed <= 0xffffffff),
  'Use positive 32-bit seeds, for example --seeds=7,21');
assert(Number.isSafeInteger(runCount) && runCount > 0, 'Use a positive run count, for example --runs=2');

const screenshotLabels = [
  'title', 'borrowed-battle', 'first-awakening', 'map', 'order', 'battle-turn', 'big-move',
  'event', 'treasure', 'gate-reward', 'boss', 'recruit', 'hub', 'destinations',
  'preparation', 'collection', 'notebook', 'records'
];

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

function look({ canRetreat = false, borrowedPath } = {}) {
  const game = window.__game;
  const run = game.run;
  const active = document.querySelector('.screen.on');
  const sheet = document.querySelector('#sheet.on');
  const screen = active?.id;
  const inBattle = screen === 'battle';
  const result = inBattle && !!active.querySelector('#result.on');
  const ready = inBattle && !result && !game.busy && !!active.querySelector('.act:not([disabled])');
  const form = !!sheet?.querySelector('[data-form]');
  let tap = null;
  let formIndex = null;
  let fighterId = null;

  if (ready) {
    const battle = game.B.bridge;
    const state = battle.state();
    const fighter = state.allies[state.cur];
    fighterId = game.B.party[state.cur];
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
    const borrowedAsh = run.room.type === 'borrowed' && fighterId === 'ash';
    const retreat = borrowedAsh ? borrowedPath === 'retreat' : !kill && !exact && (intent.lethal || incoming >= fighter.hp);
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
    screen, result, ready, tap, form, formIndex, fighterId,
    visible: JSON.stringify([screen, signature(active), signature(sheet), result]),
    bigMove: inBattle && !!active.querySelector('.skillplate'),
    dungeonId: run?.dungeonId,
    floor: run?.floor,
    floors: run?.floors,
    room: run?.room?.type,
    crystals: run?.crystals,
    pendingKind: run?.pending?.kind,
    doors: screen === 'map' ? run.doors.map(({ type, index }) => ({ type, index })) : [],
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

async function playTitle({ page, shot }) {
  await page.locator('#title.on').waitFor();
  await shot('title');
  await page.locator('#title.on #b-start').click();
}

async function playAwaken({ page }) {
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
  // The party marches off (about 0.5 s) before the room opens; do not tap the map again meanwhile.
  await page.waitForFunction(() => !document.querySelector('#map.on'), null, { timeout: 5000 });
}

async function playOrder({ page }) {
  await page.locator('#order.on #b-go').click();
}

async function playSpring({ page }, state, expedition) {
  if (state.pendingKind === 'spring') {
    if (await clickIfVisible(page, '#spring.on #b-take:not([disabled])')) return;
    if (await clickIfVisible(page, '#spring.on .cardrow')) {
      await page.locator('#spring.on #b-take').click();
    }
    return;
  }
  if (expedition.springAttempt !== state.floor) {
    const purchase = state.crystals >= 3 ? '#b-pick' : '#b-draw';
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

async function playTreasure({ page }) {
  if (await clickIfVisible(page, '#treasure.on #b-equip:not([disabled])')) return;
  if (await clickIfVisible(page, '#treasure.on [data-replace]:not(.sel)')) {
    await page.locator('#treasure.on #b-equip').click();
    return;
  }
  await page.locator('#treasure.on #b-leave').click();
}

async function playGateReward({ page }) {
  if (await clickIfVisible(page, '#pick.on #b-gate-take:not([disabled])')) return;
  const picked = await clickIfVisible(page, '#pick.on [data-relic]')
    || await clickIfVisible(page, '#pick.on .cardrow');
  await page.locator(picked ? '#pick.on #b-gate-take' : '#pick.on #b-leave').click();
}

async function playBattle({ page }, state, expedition) {
  if (state.result) {
    await page.locator('#battle.on #result.on #b-next').click();
    return;
  }
  if (!state.ready || !state.tap) return;
  if (state.tap.retreat) {
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
  await depart.waitFor();
  await shot('preparation');
  await depart.click();
}

async function playHubPages({ page, shot }) {
  for (const id of ['collection', 'notebook', 'records']) {
    await page.locator('#hub.on [data-meta-page="' + id + '"]').click();
    await page.locator('#' + id + '.on').waitFor();
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
  pick: playGateReward,
  battle: playBattle
};

async function captureRoom({ shot }, state) {
  if (state.screen === 'awaken') await shot('first-awakening');
  if (['map', 'order', 'event', 'treasure'].includes(state.screen)) await shot(state.screen);
  if (state.screen === 'pick') await shot('gate-reward');
  if (state.ready && state.room === 'borrowed') await shot('borrowed-battle');
  if (state.ready) await shot('battle-turn');
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
  if (!['spring', 'altar', 'event', 'treasure', 'pick'].includes(state.screen)) return false;
  if (state.pendingKind) return true;
  if (state.floor !== 3) return false;
  if (state.screen !== 'spring') return true;
  // Let the spring charge for the purchase before reloading the choice or receipt.
  return (expedition.springAttempt === state.floor || state.crystals === 0)
    && await page.locator('#spring.on #b-leave:not([disabled])').isVisible();
}

async function failStuck({ page, seed }, state) {
  await page.screenshot({ path: path.join(shots, seed + '-00-stuck.png') });
  const log = await page.evaluate(() => window.__game.B.log.slice(-12));
  throw new Error('Stuck for 25 s on ' + state.screen + ', floor ' + state.floor
    + ', pending ' + state.pendingKind + ', tap ' + JSON.stringify(state.tap) + '\n' + log.join('\n'));
}

async function playExpedition(campaign, dungeon, depart, borrowedPath) {
  const { page } = campaign;
  const expedition = { dungeon, retreats: 0, frames: [], waits: [], started: performance.now() };
  let lastProgress = expedition.started;
  let previousScreen;
  await depart(campaign);
  for (;;) {
    const state = await page.evaluate(look, { canRetreat: expedition.retreats === 0, borrowedPath });
    assert.equal(state.dungeonId, dungeon, 'Unexpected expedition');
    const now = performance.now();
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
    if (state.room === 'borrowed' && state.ready && !expedition.borrowedStarted) {
      assert.equal(state.fighterId, 'ash', 'The borrowed battle should start with Ash');
      assert(state.tap, 'Ash has no playable action in the borrowed battle');
      assert.equal(!!state.tap.retreat, borrowedPath === 'retreat', 'Unexpected first action for Ash');
      expedition.borrowedStarted = true;
    }
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

async function playCampaign(campaign, borrowedPath) {
  const { page, seed } = campaign;
  await page.addInitScript(installFrameCounter);
  const url = pathToFileURL(path.join(game, 'dist', 'Relaymare.html'));
  url.searchParams.set('seed', seed);
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await playExpedition(campaign, 'dawn_forest', playTitle, borrowedPath);
  const tried = new Set();
  for (let i = 0; i < runCount; i++) {
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
    let borrowedPath = index % 2 ? 'retreat' : 'fight';
    if (seed === 7) borrowedPath = 'fight';
    if (seed === 21) borrowedPath = 'retreat';
    const campaign = { page, seed, shot, resumed: false };
    console.log('\nCampaign ' + seed + ' · borrowed battle: ' + borrowedPath);
    await Promise.race([watchBrowser(page), playCampaign(campaign, borrowedPath)]);
  } finally {
    const missing = screenshotLabels.filter(label => !taken.has(label));
    if (missing.length) console.log('Seed ' + seed + ' · screenshots not reached: ' + missing.join(', '));
    await context.close();
  }
}

execFileSync(process.execPath, [path.join(game, 'build.mjs')], { cwd: repo, stdio: 'inherit' });
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

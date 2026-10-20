import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

/* DeepSeek (SYNAPSE) edition smoke test.
   The shared controller in card/game is the source of truth, so this suite proves
   three things only: the offline bundle boots, every legacy DOM contract survives,
   and the presentation layer keeps the same flows working at phone sizes. */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'test-results');
await fs.mkdir(output, { recursive: true });
const htmlPath = path.join(root, 'dist/DREAMWEAVER-DeepSeek.html');
const html = await fs.readFile(htmlPath, 'utf8');

assert.equal(/<script[^>]+src=|<link[^>]+stylesheet|fonts\.googleapis/.test(html), false, 'The distribution must not depend on external JS/CSS/fonts');
assert.match(html, /window\.DS_EDITION=\{name:'DeepSeek'/, 'The edition bootstrap must be inlined');

const original = await fs.readFile(path.join(root, '../card/game/index.html'), 'utf8');
const originalIds = [...original.matchAll(/\bid="([\w-]+)"/g)].map(match => match[1]);
const bundleIds = new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map(match => match[1]));
assert.deepEqual(originalIds.filter(id => !bundleIds.has(id)), [], 'All legacy DOM contracts must survive the new shell');

const THEMES = ['astra', 'strawberry', 'dreamsky'];
const browser = await chromium.launch({ headless: true });
const errors = [];
const failed = [];
const results = [];

async function newPage(viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'domcontentloaded' });
  // `Astra` is declared with const in a classic script, so it is not on window.
  await page.waitForFunction(() => typeof Astra !== 'undefined' && Astra.ready && RPG._featuresInstalled);
  return page;
}
const shot = (page, name) => page.screenshot({ path: path.join(output, `${name}.png`) });

async function seed(page) {
  await page.evaluate(() => {
    RPG.loadGlobalData();
    Object.assign(RPG.state, {
      mode: 'origin', gameType: 'endless', tickets: 20, enemyScale: 0,
      deck: ['marshmallow', 'kobold', 'golem'],
      inventory: ['marshmallow', 'kobold', 'golem', 'marshmallow', 'luna', 'deep_lord'],
      quiz_stats: { correct: 7, total: 9 }
    });
    RPG.global.unlocked_bonus_cards = [];
    document.querySelectorAll('.modal.active').forEach(el => el.classList.remove('active'));
    RPG.toMenu();
  });
}

async function noHorizontalOverflow(page, label) {
  const geometry = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: innerWidth
  }));
  assert.ok(geometry.scroll <= geometry.width + 1, `${label} horizontal overflow: ${JSON.stringify(geometry)}`);
}

async function fitsInViewport(page, selector, { vertical = true } = {}) {
  const box = await page.locator(selector).evaluate(el => {
    const rect = el.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight };
  });
  assert.ok(box.left >= -1 && box.right <= box.width + 1, `${selector} horizontal viewport: ${JSON.stringify(box)}`);
  if (vertical) assert.ok(box.top >= -1 && box.bottom <= box.height + 1, `${selector} vertical viewport: ${JSON.stringify(box)}`);
}

try {
  const mobile = await newPage({ width: 390, height: 844 });
  assert.deepEqual(await mobile.evaluate(() => RPG.getMissingRequiredData().map(item => item.name)), []);
  assert.equal(await mobile.evaluate(() => document.body.classList.contains('ds')), true, 'The SYNAPSE layer must claim the body');
  assert.equal(await mobile.evaluate(() => document.body.dataset.edition), 'deepseek');
  assert.equal(await mobile.locator('#btn-start-new').isEnabled(), true);
  assert.equal(await mobile.locator('#title-loading').isVisible(), false, 'The load status must collapse once data is ready');

  // The theme card backs are generated at 3:5 so the portrait frame never letterboxes.
  const cards = await mobile.evaluate(() => {
    const bundle = window.DREAMWEAVER_THEME_CARDS || {};
    return Object.fromEntries(Object.entries(bundle).map(([key, src]) => [key, src.slice(0, 26)]));
  });
  assert.deepEqual(Object.keys(cards).sort(), [...THEMES].sort());
  for (const value of Object.values(cards)) assert.match(value, /^data:image\/svg\+xml/);

  const ids = await mobile.evaluate(() => [...document.querySelectorAll('[id]')].map(el => el.id));
  assert.equal(ids.length, new Set(ids).size, 'Duplicate runtime IDs');
  await shot(mobile, 'title-390');

  // Real new game: mode list, both confirmations, first draw, deck choice, save/reload.
  await mobile.locator('#btn-start-load').click();
  await mobile.locator('[onclick="RPG.selectGameType(\'endless\')"]').click();
  await mobile.locator('#mode-btn-origin').click();
  assert.equal(await mobile.locator('#mode-btn-origin').getAttribute('aria-pressed'), 'true');
  await shot(mobile, 'mode-390');
  await mobile.locator('#btn-enter-mode').click();
  await mobile.locator('#confirm-yes').click();
  await mobile.waitForFunction(() => document.getElementById('confirm-msg').textContent.includes('정말'));
  await mobile.locator('#confirm-yes').click();
  await mobile.locator('#modal-info button').click();
  assert.equal(await mobile.locator('#screen-menu').evaluate(el => el.classList.contains('active') && el.classList.contains('screen')), true);
  const tickets = await mobile.evaluate(() => RPG.state.tickets);
  await mobile.locator('#btn-normal-gacha').click();
  assert.equal(await mobile.evaluate(() => RPG.state.inventory.length), 1);
  assert.equal(await mobile.evaluate(() => RPG.state.tickets), tickets - 1);
  await shot(mobile, 'gacha-390');
  await mobile.locator('#modal-gacha button').last().click();
  await mobile.locator('[data-nav=deck]').click();
  await mobile.locator('#slot-0').click();
  await mobile.locator('#deck-card-list .card-item').click();
  assert.equal(await mobile.evaluate(() => RPG.state.deck[0] === RPG.state.inventory[0]), true);
  await mobile.locator('[onclick="RPG.confirmDeck()"]:visible').click();
  assert.equal(await mobile.locator('#astra-depart').isEnabled(), true);
  const save = await mobile.evaluate(() => { RPG.saveGame(false); return localStorage.getItem(Storage.keys.SAVE); });
  await mobile.reload();
  await mobile.waitForFunction(() => typeof Astra !== 'undefined' && Astra.ready);
  await mobile.locator('#btn-start-load').click();
  await mobile.locator('#modal-info button').click();
  assert.equal(await mobile.evaluate(() => localStorage.getItem(Storage.keys.SAVE)), save);
  results.push('Offline file:// boot, new game, gacha, deck choice and save/reload');

  await seed(mobile);
  await mobile.locator('[data-nav=collection]').click();
  assert.equal(await mobile.locator('#collection-grid .card-item').count(), 5);
  await mobile.locator('#card-search').fill('루나');
  assert.equal(await mobile.locator('#collection-grid .card-item').count(), 1);
  await mobile.locator('#collection-grid .card-item').click();
  assert.equal(await mobile.locator('#md-name').textContent(), '루나');
  // The stat block is rewritten into cells only when every row parses.
  assert.equal(await mobile.locator('#md-stats .ds-stat').count() >= 4, true);
  assert.equal(await mobile.locator('#md-grade').evaluate(el => getComputedStyle(el).display), 'inline-block');
  await shot(mobile, 'card-modal-390');
  await mobile.keyboard.press('Escape');
  await mobile.locator('#card-search').fill('');

  // Fallback portrait art must fill its 3:5 frame instead of letterboxing.
  await mobile.waitForFunction(() => [...document.querySelectorAll('#collection-grid img')].some(img => img.dataset.fallback === 'true'), null, { timeout: 8000 });
  const fallback = await mobile.evaluate(() => {
    const img = document.querySelector('#collection-grid img[data-fallback=true]');
    if (!img) return null;
    return {
      ratio: img.naturalWidth / img.naturalHeight,
      fit: getComputedStyle(img).objectFit,
      box: getComputedStyle(img.closest('.portrait')).aspectRatio
    };
  });
  assert.ok(fallback, 'Missing runtime portraits must fall back to the theme card back');
  assert.ok(Math.abs(fallback.ratio - 0.6) < 0.01, `Card back ratio: ${fallback.ratio}`);
  assert.equal(fallback.fit, 'cover');
  assert.equal(fallback.box, '3 / 5');
  results.push('Collection search, card dialog, stat cells and 3:5 fallback art');

  await mobile.locator('[data-nav=study]').click();
  assert.equal(await mobile.locator('#ds-study-ledger').count(), 1, 'Study ledger is decorative and must exist');
  const ledger = await mobile.locator('#ds-study-ledger li b').allTextContents();
  assert.deepEqual(ledger, ['78%', '9', '5']);
  assert.equal(await mobile.locator('.ds-tip').isVisible(), true);
  await shot(mobile, 'study-390');
  await mobile.locator('[onclick="RPG.openMagicClass()"]:visible').click();
  assert.equal(await mobile.locator('#lecture-list button').count(), await mobile.evaluate(() => GRAMMAR_DATA.length));
  await mobile.locator('#lecture-list button').first().click();
  assert.equal(await mobile.locator('#lecture-content').innerText(), await mobile.evaluate(() => GRAMMAR_DATA[0].content));
  await mobile.keyboard.press('Escape');
  await mobile.keyboard.press('Escape');
  assert.equal(await mobile.locator('#screen-study').isVisible(), true);
  results.push('Study ledger parity, grammar content and nested dialog return');

  await mobile.locator('[data-nav=menu]').click();
  await mobile.locator('#astra-depart').click();
  await mobile.waitForFunction(() => document.querySelector('#screen-battle.active') && document.querySelectorAll('#battle-controls .skill-btn').length > 0);
  assert.equal(await mobile.locator('.astra-nav').isVisible(), false);
  await shot(mobile, 'battle-390');
  const before = await mobile.evaluate(() => ({ hp: RPG.battle.enemy.hp, turn: RPG.battle.turn }));
  await mobile.locator('#battle-controls .skill-btn').first().click();
  await mobile.waitForFunction(before => RPG.battle.enemy.hp !== before.hp || RPG.battle.turn !== before.turn || document.querySelector('#modal-quiz.active'), before);
  await shot(mobile, 'battle-action-390');
  results.push('Battle entry, skill execution and log growth');

  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 412, height: 915 }, { width: 390, height: 667 }, { width: 1024, height: 768 }, { width: 1440, height: 960 }]) {
    const page = await newPage(viewport);
    await fitsInViewport(page, '#screen-title', { vertical: viewport.height >= 800 });
    await noHorizontalOverflow(page, 'title');
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.screen')].filter(el => getComputedStyle(el).display !== 'none').map(el => el.id)), ['screen-title'], 'Only the title screen may be visible after boot');
    await seed(page);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.screen')].filter(el => getComputedStyle(el).display !== 'none').map(el => el.id)), ['screen-menu'], 'Only the lobby may be visible on the menu screen');
    await page.waitForFunction(() => [...document.querySelectorAll('#astra-party img')].every(img => img.naturalWidth > 0));
    await fitsInViewport(page, '#screen-menu', { vertical: false });
    await noHorizontalOverflow(page, 'lobby');
    const stacked = await page.evaluate(() => ({
      layout: document.querySelector('.lobby-layout').getBoundingClientRect().bottom,
      shortcuts: document.querySelector('.lobby-shortcuts').getBoundingClientRect().top
    }));
    assert.ok(stacked.shortcuts >= stacked.layout, 'Lobby shortcuts must not overlap the party block');
    await shot(page, `lobby-${viewport.width}x${viewport.height}`);
    for (const [nav, screen] of [['deck', '#screen-deck'], ['collection', '#screen-collection'], ['study', '#screen-study']]) {
      await page.locator(`[data-nav=${nav}]`).click();
      await noHorizontalOverflow(page, nav);
      await fitsInViewport(page, screen, { vertical: false });
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.screen')].filter(el => getComputedStyle(el).display !== 'none').map(el => el.id)), [screen.slice(1)], `Only ${screen} may be visible`);
      await shot(page, `${nav}-${viewport.width}x${viewport.height}`);
    }
    await page.locator('[data-nav=menu]').click();
    await page.locator('#astra-depart').click();
    await page.waitForFunction(() => document.querySelector('#screen-battle.active') && document.querySelectorAll('#battle-controls .skill-btn').length > 0);
    await fitsInViewport(page, '.visual-stage', { vertical: false });
    await fitsInViewport(page, '#battle-controls', { vertical: false });
    await noHorizontalOverflow(page, 'battle');
    await shot(page, `battle-${viewport.width}x${viewport.height}`);
    await page.context().close();
  }
  results.push('360/390/412/1024/1440 single-screen geometry without horizontal overflow');

  // The runtime collects portraits and music next to the HTML; only those may 404.
  const unexpected = failed.filter(url => !/(\.mp3|\/루미\.png|%EB%A3%A8%EB%AF%B8\.png)$/i.test(url));
  assert.deepEqual(unexpected, [], 'Unexpected failed requests');
  assert.deepEqual(errors, [], 'Uncaught browser errors');
  console.log(results.map(item => `PASS ${item}`).join('\n'));
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ passed: results, errors, failed }, null, 2));
} finally {
  await browser.close();
}

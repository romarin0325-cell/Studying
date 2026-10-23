import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'dist/DREAMWEAVER-Astra.html');
const html = await fs.readFile(htmlPath, 'utf8');
const source = await fs.readFile(path.join(root, '../card/game/index.html'), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map(match => match[1]));
assert.deepEqual([...source.matchAll(/\bid="([\w-]+)"/g)].map(match => match[1]).filter(id => !ids.has(id)), [], 'Shared DOM contracts survive');
assert.equal(/<script[^>]+src=|<link[^>]+stylesheet|fonts\.googleapis/.test(html), false);
assert.equal(/\{\{[A-Z_]+\}\}/.test(html), false);
const output = path.join(root, 'test-results');
await fs.mkdir(output, {recursive:true});
// Some managed Chromium installations disallow file://. The optional local HTTP
// transport serves this exact bundle; it does not replace the default file test.
let server;
let url = pathToFileURL(htmlPath).href;
if (process.env.ASTRA_TEST_HTTP === '1') {
  server = http.createServer((req, res) => {
    if (req.url !== '/') { res.writeHead(404).end(); return; }
    res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}/`;
}
const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
const errors = [];
const external = [];
const reports = [];
async function open(viewport) {
  const context = await browser.newContext({viewport, reducedMotion:'reduce'});
  await context.route('**/*', route => {
    const request = route.request().url();
    if (/^https?:/.test(request) && !request.startsWith('http://127.0.0.1:')) {
      external.push(request); return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => Astra.ready && AstraEdition.ready);
  await page.evaluate(() => Astra.setTheme('astra'));
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function shot(page, name) { await page.screenshot({path:path.join(output, `${name}.png`)}); }
async function fits(page, selector) {
  const box = await page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect();
    const unoccluded = [[r.left+r.width/2,r.top+3],[r.left+r.width/2,r.bottom-3],[r.left+3,r.top+r.height/2],[r.right-3,r.top+r.height/2]].every(([x,y]) => el.contains(document.elementFromPoint(x,y)));
    return {x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:innerWidth, height:innerHeight,unoccluded};
  });
  assert.ok(box.x >= -1 && box.right <= box.width + 1 && box.y >= -1 && box.bottom <= box.height + 1, `${selector} fits: ${JSON.stringify(box)}`);
  // Catch clipping by an ancestor and fixed navigation, not only viewport overflow.
  if (await page.locator(selector).evaluate(el => el.tagName === 'BUTTON')) assert.ok(box.unoccluded, `${selector} is not clipped or covered: ${JSON.stringify(box)}`);
}
async function seed(page) {
  await page.evaluate(() => {
    RPG.loadGlobalData();
    Object.assign(RPG.state, {mode:'origin',gameType:'endless',tickets:20,enemyScale:0,
      deck:['marshmallow','kobold','golem'],
      inventory:['marshmallow','kobold','golem','luna','deep_lord',...CARDS.slice(0,15).map(card => card.id)],
      quiz_stats:{correct:7,total:9}});
    document.querySelectorAll('.modal.active').forEach(modal => modal.classList.remove('active'));
    RPG.toMenu();
  });
}
try {
  const page = await open({width:390,height:844});
  const runtimeIds = await page.evaluate(() => [...document.querySelectorAll('[id]')].map(el => el.id));
  assert.equal(runtimeIds.length, new Set(runtimeIds).size, 'Unique runtime IDs');
  await shot(page, 'title-390');
  // Real new-game decisions, no test shortcut around the original confirmations.
  await page.locator('#btn-start-load').click();
  await page.locator('[onclick="RPG.selectGameType(\'endless\')"]').click();
  await page.locator('#mode-btn-origin').click();
  await page.locator('#btn-enter-mode').click();
  await page.locator('#confirm-yes').click();
  await page.waitForFunction(() => document.getElementById('confirm-msg').textContent.includes('정말'));
  await page.locator('#confirm-yes').click();
  await page.locator('#modal-info button').click();
  assert.equal(await page.locator('#astra-depart').isDisabled(), true);
  await shot(page, 'empty-party-390');
  await page.locator('#btn-normal-gacha').click();
  await page.locator('#modal-gacha button').click();
  await page.locator('[data-nav=deck]').click();
  await page.locator('#slot-0').click();
  await page.locator('#deck-card-list .card-item').click();
  await page.locator('[onclick="RPG.confirmDeck()"]:visible').click();
  assert.equal(await page.locator('#astra-depart').isEnabled(), true);
  const saved = await page.evaluate(() => { RPG.saveGame(false); return localStorage.getItem(Storage.keys.SAVE); });
  await page.reload();
  await page.waitForFunction(() => AstraEdition.ready);
  assert.equal(await page.evaluate(() => localStorage.getItem(Storage.keys.SAVE)), saved);
  await page.locator('#btn-start-load').click();
  await page.locator('#modal-info button').click();
  assert.equal(await page.locator('#astra-depart').isEnabled(), true);
  reports.push('New journey, summon, placement and saved journey reload');

  await seed(page);
  await shot(page, 'lobby-390');
  await page.locator('[data-nav=deck]').click();
  assert.equal(await page.locator('.astra-nav').isVisible(), false);
  await page.locator('#ae-deck-search').fill('루나');
  assert.equal(await page.locator('.ae-deck-entry:visible').count(), 1);
  await page.locator('#slot-0').click();
  await page.locator('.ae-deck-entry:visible .card-item').click();
  assert.equal(await page.evaluate(() => RPG.state.deck[0]), 'luna');
  await page.locator('[onclick="AstraEdition.clearSlot()"]').click();
  assert.equal(await page.evaluate(() => RPG.state.deck[0]), null);
  await page.locator('.ae-deck-entry:visible .card-item').click();
  await page.locator('#ae-deck-search').fill('');
  assert.ok(await page.locator('#deck-card-list .card-item').evaluateAll(cards => {
    const grid = document.getElementById('deck-card-list').getBoundingClientRect();
    return cards.filter(card => {const r = card.getBoundingClientRect();return r.top >= grid.top && r.bottom <= grid.bottom;}).length;
  }) >= 6, 'Six complete cards at the default mobile density');
  await shot(page, 'formation-390');
  await page.locator('#screen-deck .ae-density').click();
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('deck-card-list')).gridTemplateColumns.split(' ').length), 4);
  await shot(page, 'formation-compact-390');
  const beforeDetail = await page.evaluate(() => JSON.stringify(RPG.state.deck));
  await page.locator('.ae-card-info').first().click();
  const height = await page.locator('.ae-card-sheet').evaluate(el => el.clientHeight);
  const firstName = await page.locator('#md-name').textContent();
  await page.locator('#ae-card-next').click();
  assert.notEqual(await page.locator('#md-name').textContent(), firstName);
  assert.equal(await page.locator('.ae-card-sheet').evaluate(el => el.clientHeight), height);
  assert.equal(await page.evaluate(() => JSON.stringify(RPG.state.deck)), beforeDetail, 'Viewing cards never changes the party');
  const stats = await page.locator('#md-stats strong').allTextContents();
  assert.deepEqual(stats, await page.evaluate(() => { const s = RPG.getCardData(AstraEdition.detailId).stats; return [s.hp,s.atk,s.matk,s.def,s.mdef].map(String); }));
  await shot(page, 'card-detail-390');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#md-name').textContent(), firstName);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#modal-card').isVisible(), false);
  assert.equal(await page.locator('.ae-card-info').first().evaluate(el => el === document.activeElement), true);
  await page.locator('[onclick="RPG.confirmDeck()"]:visible').click();
  reports.push('Formation search, clear/place, 3/4 columns, non-mutating detail paging and focus return');

  await page.locator('[data-nav=collection]').click();
  await page.locator('#ae-tab-book').click();
  assert.match(await page.locator('#ae-collection-note').textContent(), /영구 해금/);
  const account = await page.evaluate(() => {
    const card = BONUS_CARDS.find(card => card.unlockSource !== 'hidden');
    const before = AstraEdition.acquisition(card).open;
    const old = [...RPG.global.unlocked_bonus_cards];
    RPG.global.unlocked_bonus_cards = [...old, card.id];
    const after = AstraEdition.acquisition(card).open;
    RPG.global.unlocked_bonus_cards = old;
    return {before,after};
  });
  assert.equal(account.after, true);
  await page.locator('#card-search').fill('no-matching-card');
  assert.equal(await page.locator('#collection-empty').isVisible(), true);
  await page.locator('#card-search').fill('');
  await page.locator('#ae-tab-run').click();
  await page.locator('#screen-collection .ae-density').click();
  await shot(page, 'collection-390');
  await page.locator('[data-nav=study]').click();
  assert.match(await page.locator('#ae-study-progress').textContent(), /9문제 · 7문제 정답/);
  await shot(page, 'study-390');
  await page.locator('[onclick="RPG.openMagicClass()"]:visible').click();
  await page.locator('#lecture-list button').first().click();
  assert.equal(await page.locator('#lecture-content').innerText(), await page.evaluate(() => GRAMMAR_DATA[0].content));
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  reports.push('Account unlock data, collection search, learning progress and original grammar content');

  await seed(page);
  await page.locator('#astra-depart').click();
  await page.waitForFunction(() => RPG.battle.phase === 'player-ready');
  await shot(page, 'battle-390');
  await fits(page, '#battle-controls');
  assert.equal(await page.locator('#battle-controls .skill-btn').count(), 4);
  assert.equal(await page.locator('#ae-p-hp').textContent(), await page.evaluate(() => {const p = RPG.battle.players[RPG.battle.currentPlayerIdx];return `${p.hp} / ${p.maxHp}`;}));
  await page.evaluate(() => { RPG.battle.enemy.hp = 1; RPG.renderBattlefield(); });
  await page.locator('#battle-controls .skill-btn').first().click();
  await page.waitForFunction(() => RPG.battle.isFinished, null, {timeout:15000});
  reports.push('Battle HUD, four reachable skills and real attack resolving victory');

  for (const viewport of [{width:360,height:640},{width:1440,height:960}]) {
    const view = await open(viewport);
    await seed(view);
    for (const selector of ['#astra-depart','#btn-normal-gacha','#btn-challenge-gacha','.lobby-shortcuts button:first-child','.lobby-shortcuts button:last-child','.astra-nav','.astra-header']) await fits(view, selector);
    await shot(view, `lobby-${viewport.width}`);
    await view.evaluate(() => RPG.openDeck());
    await fits(view, '.deck-confirm');
    await view.evaluate(() => RPG.toMenu());
    await view.evaluate(() => RPG.startBattleInit());
    await view.waitForFunction(() => RPG.battle.phase === 'player-ready');
    await fits(view, '#battle-controls');
    await fits(view, '#battle-log');
    assert.equal(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await shot(view, `battle-${viewport.width}`);
    await view.context().close();
  }
  // Theme switches must not move interactive geometry, including the new detail.
  await seed(page);
  const themes = [];
  for (const theme of ['astra','dreamsky','strawberry']) {
    await page.evaluate(theme => Astra.setTheme(theme), theme);
    await page.evaluate(() => document.fonts.ready);
    await fits(page, '#astra-depart');
    themes.push(await page.locator('#astra-depart').boundingBox());
    await shot(page, `lobby-${theme}-390`);
  }
  assert.deepEqual(themes[0], themes[1]); assert.deepEqual(themes[0], themes[2]);
  reports.push('360×640 and desktop geometry; all three themes retain action placement');
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  assert.deepEqual(external, [], 'No external requests for the standalone UI');
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({transport:server ? 'local HTTP' : 'file',reports,errors,external},null,2));
  console.log(`PASS Astra (${server ? 'local HTTP' : 'file://'}): ${reports.join('; ')}`);
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}

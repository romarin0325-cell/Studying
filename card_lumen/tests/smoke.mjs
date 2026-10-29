import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'dist/DREAMWEAVER-Lumen.html');
const html = await fs.readFile(htmlPath, 'utf8');
const source = await fs.readFile(path.join(root, '../card/game/index.html'), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map(match => match[1]));
assert.deepEqual([...source.matchAll(/\bid="([\w-]+)"/g)].map(match => match[1]).filter(id => !ids.has(id)), [], 'Shared DOM contracts survive');
assert.equal(/<script[^>]+src=|<link[^>]+stylesheet|fonts\.googleapis/.test(html), false);
assert.equal(/\{\{[A-Z_]+\}\}/.test(html), false);
const output = path.join(root, 'test-results');
await fs.mkdir(output, {recursive:true});
// Some managed Chromium installations disallow file://. LUMEN_TEST_HTTP=1 serves this exact bundle locally.
let server;
let url = pathToFileURL(htmlPath).href;
if (process.env.LUMEN_TEST_HTTP === '1') {
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
  await page.waitForFunction(() => typeof LumenUI !== 'undefined' && Astra.ready && LumenUI.ready);
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function shot(page, name) { await page.screenshot({path:path.join(output, `${name}.png`)}); }
// Side probes sit 16px in: action buttons are slanted cards, so their corners are intentionally cut.
async function fits(page, selector) {
  const box = await page.locator(selector).first().evaluate(el => {
    const r = el.getBoundingClientRect();
    const unoccluded = [[r.left+r.width/2,r.top+3],[r.left+r.width/2,r.bottom-3],[r.left+16,r.top+r.height/2],[r.right-16,r.top+r.height/2]].every(([x,y]) => el.contains(document.elementFromPoint(x,y)));
    return {x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:innerWidth, height:innerHeight, unoccluded, button:el.tagName === 'BUTTON'};
  });
  assert.ok(box.x >= -1 && box.right <= box.width + 1 && box.y >= -1 && box.bottom <= box.height + 1, `${selector} fits: ${JSON.stringify(box)}`);
  if (box.button) assert.ok(box.unoccluded, `${selector} is not clipped or covered: ${JSON.stringify(box)}`);
}
async function seed(page, extra = {}) {
  await page.evaluate(extra => {
    RPG.loadGlobalData();
    Object.assign(RPG.state, {mode:'origin',gameType:'endless',tickets:20,enemyScale:0,
      deck:['marshmallow','kobold','golem'],
      inventory:['marshmallow','kobold','golem','luna','deep_lord',...CARDS.slice(0,15).map(card => card.id)],
      quiz_stats:{correct:7,total:9}}, extra);
    document.querySelectorAll('.modal.active').forEach(modal => modal.classList.remove('active'));
    RPG.toMenu();
  }, extra);
}
// Test instrument only: remember each quiz's answer so the run can answer right or wrong on purpose.
let asked = 0;
async function answer(page, right) {
  await page.waitForFunction(seen => window.__quiz?.seq > seen, asked);
  const {correct, options, seq} = await page.evaluate(() => window.__quiz);
  asked = seq;
  const pick = right ? correct : options.find(option => option !== correct);
  await page.locator('#quiz-options .menu-btn', {hasText:pick}).first().click();
}
try {
  const page = await open({width:390,height:844});
  const runtimeIds = await page.evaluate(() => [...document.querySelectorAll('[id]')].map(el => el.id));
  assert.equal(runtimeIds.length, new Set(runtimeIds).size, 'Unique runtime IDs');
  assert.equal(await page.evaluate(() => document.body.dataset.theme), 'dreamsky', 'Bright theme is the first look');
  await shot(page, 'title-390');
  // Real new-game decisions, no test shortcut around the original confirmations.
  assert.equal(await page.locator('#btn-start-new').isVisible(), false, 'Without a save the title offers one start action');
  await page.locator('#btn-start-load').click();
  await page.locator('#modal-type-select .lm-type-card.is-endless').click();
  await page.locator('#mode-btn-origin').click();
  await page.locator('#btn-enter-mode').click();
  await page.locator('#confirm-yes').click();
  await page.waitForFunction(() => document.getElementById('confirm-msg').textContent.includes('정말'));
  await page.locator('#confirm-yes').click();
  await page.locator('#modal-info button').click();
  assert.equal(await page.locator('#astra-depart').isDisabled(), true);
  await shot(page, 'empty-party-390');
  await page.locator('#btn-normal-gacha').click();
  await page.locator('#modal-gacha .lm-summon-actions .lm-cta').click();
  await page.locator('[data-nav=deck]').click();
  await page.locator('#deck-card-list .lm-tile').first().click();
  assert.notEqual(await page.evaluate(() => RPG.state.deck[0]), null, 'An empty slot is preselected, one tap places');
  await page.locator('#screen-deck .deck-confirm .lm-cta').click();
  assert.equal(await page.locator('#astra-depart').isEnabled(), true);
  const saved = await page.evaluate(() => { RPG.saveGame(false); return localStorage.getItem(Storage.keys.SAVE); });
  await page.reload();
  await page.waitForFunction(() => typeof LumenUI !== 'undefined' && LumenUI.ready);
  assert.equal(await page.evaluate(() => localStorage.getItem(Storage.keys.SAVE)), saved);
  await page.locator('#btn-start-load').click();
  await page.locator('#modal-info button').click();
  assert.equal(await page.locator('#astra-depart').isEnabled(), true);
  reports.push('New journey, summon, one-tap placement and saved journey reload');

  await seed(page, {deck:[null,null,null]});
  await page.locator('[data-nav=deck]').click();
  await page.locator('#slot-0').click();
  await page.locator('#deck-card-list .lm-tile[data-card-id=luna]').click();
  assert.equal(await page.evaluate(() => RPG.state.deck[0]), 'luna');
  assert.equal(await page.locator('#slot-1').getAttribute('aria-pressed'), 'true', 'Placing into an empty slot moves to the next empty slot');
  assert.match(await page.locator('#deck-card-list .lm-tile[data-card-id=luna] .lm-tile-placed').textContent(), /선봉/);
  await shot(page, 'deck-390');
  const beforeDetail = await page.evaluate(() => JSON.stringify(RPG.state.deck));
  await page.locator('#deck-card-list .lm-tile-info').first().click();
  const firstName = await page.locator('#md-name').textContent();
  await page.locator('#lm-detail-next').click();
  assert.notEqual(await page.locator('#md-name').textContent(), firstName);
  await page.locator('#lm-detail-prev').click();
  assert.equal(await page.locator('#md-name').textContent(), firstName);
  assert.equal(await page.evaluate(() => JSON.stringify(RPG.state.deck)), beforeDetail, 'Viewing cards never changes the party');
  await shot(page, 'card-detail-390');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#modal-card').isVisible(), false);
  assert.equal(await page.locator('.lm-nav').isVisible(), false, 'Formation is a focused task without the tab bar');
  await page.locator('#screen-deck .deck-confirm .lm-cta').click();
  reports.push('Formation auto-advance, placed badges, non-mutating detail paging');

  await page.locator('[data-nav=collection]').click();
  const runCount = await page.locator('#collection-grid .lm-tile').count();
  await page.locator('#lm-scope-all').click();
  assert.ok(await page.locator('#collection-grid .lm-tile').count() > runCount, 'Full book lists more than this run');
  await page.locator('#card-search').fill('no-matching-card');
  assert.equal(await page.locator('#collection-grid .lm-tile').count(), 0);
  await page.locator('#card-search').fill('');
  await shot(page, 'collection-390');
  await page.locator('[data-nav=study]').click();
  assert.match(await page.locator('#lm-study-stat').textContent(), /7 \/ 9/);
  await page.locator('[onclick="RPG.openMagicClass()"]:visible').click();
  await page.locator('#lecture-list button').first().click();
  assert.equal(await page.locator('#lecture-content').innerText(), await page.evaluate(() => GRAMMAR_DATA[0].content));
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  reports.push('Collection scope and search, learning progress and original grammar content');

  // The chain is only challenge summons: one ticket and one vocabulary quiz per card, revealed together.
  await seed(page, {tickets:3, inventory:['luna']});
  await page.evaluate(() => {
    const show = QuizEngine.show.bind(QuizEngine);
    QuizEngine.show = config => { window.__quiz = {correct:config.answer, options:config.options, seq:(window.__quiz?.seq || 0) + 1}; return show(config); };
  });
  assert.equal(await page.locator('#lm-chain-gacha').isVisible(), true);
  assert.match(await page.locator('#lm-chain-gacha').textContent(), /퀴즈 3문제/);
  assert.equal(await page.locator('#menu-gacha-area button:visible').count(), 3, 'No multi-pull shortcut for normal summons');
  await page.locator('#lm-chain-gacha').click();
  await answer(page, true);
  await answer(page, false);
  await answer(page, true);
  await page.locator('#modal-gacha.active .lm-batch').waitFor();
  assert.deepEqual(await page.evaluate(() => ({tickets:RPG.state.tickets, owned:RPG.state.inventory.length, cards:document.querySelectorAll('.lm-batch-card').length})), {tickets:0, owned:3, cards:2});
  assert.match(await page.locator('.lm-batch-tally').textContent(), /오답 1/);
  await shot(page, 'chain-result-390');
  await page.locator('#modal-gacha .lm-summon-actions .lm-cta').click();
  assert.equal(await page.locator('#lm-chain-gacha').isVisible(), false, 'The chain needs at least two tickets');
  reports.push('Chain challenge: three quizzes, three tickets, two cards revealed together');

  await seed(page);
  await page.locator('#astra-depart').click();
  await page.waitForFunction(() => RPG.battle.phase === 'player-ready');
  await shot(page, 'battle-390');
  await fits(page, '#battle-controls');
  assert.equal(await page.locator('#battle-controls .skill-btn').count(), 4);
  assert.equal(await page.locator('#lm-p-hp').textContent(), await page.evaluate(() => { const p = RPG.battle.players[RPG.battle.currentPlayerIdx]; return `${p.hp} / ${p.maxHp}`; }));
  await page.evaluate(() => { RPG.battle.enemy.hp = 1; RPG.renderBattlefield(); });
  await page.locator('#battle-controls .skill-btn').first().click();
  await page.waitForFunction(() => RPG.battle.isFinished, null, {timeout:15000});
  await page.locator('#modal-info.active').waitFor({timeout:15000});
  await shot(page, 'result-390');
  reports.push('Battle HUD, four reachable skills and a real attack resolving victory');

  for (const viewport of [{width:360,height:640},{width:1440,height:960}]) {
    const view = await open(viewport);
    await seed(view);
    for (const selector of ['#astra-depart','#btn-normal-gacha','#btn-challenge-gacha','#lm-chain-gacha','#lm-blessing','#lm-mission','.lm-nav','[data-nav=study]']) await fits(view, selector);
    await shot(view, `lobby-${viewport.width}`);
    await view.evaluate(() => RPG.openDeck());
    await fits(view, '#screen-deck .deck-confirm .lm-cta');
    await view.evaluate(() => RPG.toMenu());
    await view.evaluate(() => RPG.startBattleInit());
    await view.waitForFunction(() => RPG.battle.phase === 'player-ready');
    await fits(view, '#battle-controls');
    assert.equal(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await shot(view, `battle-${viewport.width}`);
    await view.context().close();
  }
  // Theme switches must not move interactive geometry, and each choice survives a reload.
  await seed(page);
  const boxes = [];
  for (const theme of ['astra','strawberry','dreamsky']) {
    await page.evaluate(theme => Astra.setTheme(theme), theme);
    await page.evaluate(() => document.fonts.ready);
    await fits(page, '#astra-depart');
    boxes.push(await page.locator('#astra-depart').boundingBox());
    await shot(page, `lobby-${theme}-390`);
  }
  assert.deepEqual(boxes[0], boxes[1]); assert.deepEqual(boxes[0], boxes[2]);
  await page.evaluate(() => Astra.setTheme('astra'));
  await page.reload();
  await page.waitForFunction(() => typeof LumenUI !== 'undefined' && LumenUI.ready);
  assert.equal(await page.evaluate(() => document.body.dataset.theme), 'astra');
  reports.push('360×640 and desktop geometry; three themes keep action placement and persist');
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  assert.deepEqual(external, [], 'No external requests for the standalone UI');
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({transport:server ? 'local HTTP' : 'file',reports,errors,external},null,2));
  console.log(`PASS Lumen (${server ? 'local HTTP' : 'file://'}): ${reports.join('; ')}`);
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}

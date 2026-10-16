// Core play loop of the Claude UI on file:// (offline): title → journey → summon → formation → battle → result.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'dist/DREAMWEAVER-Claude.html');
const html = await fs.readFile(htmlPath, 'utf8');
assert.equal(/<script[^>]+src=|<link[^>]+stylesheet|fonts\.googleapis/.test(html), false, 'No external JS/CSS/fonts');
const original = await fs.readFile(path.join(root, '../card/game/index.html'), 'utf8');
const bundleIds = new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map(match => match[1]));
const missing = [...original.matchAll(/\bid="([\w-]+)"/g)].map(match => match[1]).filter(id => !bundleIds.has(id));
assert.deepEqual(missing, [], 'Every legacy DOM id survives the new shell');

const browser = await chromium.launch({headless:true});
const errors = [];
const open = async viewport => {
  const context = await browser.newContext({viewport, reducedMotion:'reduce', offline:true});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForFunction(() => typeof Astra !== 'undefined' && Astra.ready && !document.getElementById('btn-start-load').disabled);
  return page;
};
const inView = (page, selector) => page.locator(selector).evaluate(el => {
  const r = el.getBoundingClientRect();
  return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1;
});
try {
  const page = await open({width:390,height:844});
  // The fortune-cookie badge clears once today's cookie is used.
  assert.equal(await page.locator('#btn-fortune-cookie.has-dot').count(), 1);
  await page.evaluate(() => { FortuneCookie.open(); FortuneCookie.markUsed({}); FortuneCookie.close(); });
  await page.waitForFunction(() => !document.getElementById('btn-fortune-cookie').classList.contains('has-dot'));
  // A first journey starts without any confirmation and reports the save as a toast.
  await page.locator('#btn-start-load').click();
  await page.locator('[onclick="RPG.selectGameType(\'endless\')"]').click();
  await page.locator('#mode-btn-origin').click();
  assert.equal(await page.locator('#mode-btn-origin').getAttribute('aria-pressed'), 'true');
  await page.locator('#btn-enter-mode').click();
  await page.waitForFunction(() => document.body.dataset.screen === 'menu');
  assert.equal(await page.locator('.modal.active').count(), 0);
  assert.match(await page.locator('#astra-toast').textContent(), /저장/);
  assert.equal(await page.locator('#astra-depart').isEnabled(), false);

  await page.locator('[data-nav=summon]').click();
  assert.equal(await page.evaluate(() => document.body.dataset.screen), 'summon');
  // The quiz summon leads: it comes first and is the only repeat offered after a reveal.
  assert.deepEqual(await page.locator('#menu-gacha-area button').evaluateAll(buttons => buttons.map(button => button.id)), ['btn-challenge-gacha','btn-normal-gacha']);
  assert.match(await page.locator('#btn-challenge-gacha').innerText(), /퀴즈 정답 시 전설\s*10%\s*→\s*20%/);
  const tickets = await page.evaluate(() => RPG.state.tickets);
  await page.locator('#btn-normal-gacha').click();
  await page.locator('#dw-reveal.is-done').waitFor();
  assert.equal(await page.locator('#modal-gacha.active').count(), 0, 'The legacy result dialog stays closed behind the reveal');
  assert.equal(await page.evaluate(() => RPG.state.tickets), tickets - 1);
  assert.match(await page.locator('#dw-gacha-again').innerText(), /도전 소환/);
  await page.evaluate(() => {
    const show = QuizEngine.show.bind(QuizEngine);
    QuizEngine.show = config => { window.testAnswer = config.answer; return show(config); };
  });
  await page.locator('#dw-gacha-again').click();
  assert.equal(await page.locator('#dw-reveal.is-open').count(), 0);
  const answer = await page.evaluate(() => window.testAnswer);
  await page.locator('#modal-quiz').getByRole('button',{name:answer,exact:true}).click();
  await page.locator('#dw-reveal.is-done').waitFor();
  assert.match(await page.locator('#dw-reveal .dw-reveal-title').textContent(), /도전 소환/);
  assert.match(await page.locator('#dw-gacha-again').innerText(), /한 번 더 도전/);
  assert.equal(await page.evaluate(() => RPG.state.inventory.length), 2);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#dw-reveal.is-open').count(), 0);
  assert.equal(await page.evaluate(() => document.querySelector('main').inert), false, 'Closing the reveal releases the page');
  for (let i = 0; i < 6; i++) {
    await page.locator('#btn-normal-gacha').click();
    await page.locator('#dw-reveal .dw-btn', {hasText:'확인'}).click();
  }

  await page.locator('[data-nav=deck]').click();
  assert.equal(await page.locator('.astra-nav').isVisible(), false, 'Formation is a sub-screen without the main navigation');
  const grid = await page.locator('#deck-card-list').evaluate(el => el.clientHeight / innerHeight);
  assert.ok(grid > 0.5, `The card list gets most of the screen (${grid.toFixed(2)})`);
  await page.locator('.dw-formation-bar .dw-btn', {hasText:'자동'}).click();
  assert.equal(await page.evaluate(() => RPG.state.deck.every(Boolean)), true);
  const first = await page.evaluate(() => RPG.state.deck[0]);
  await page.locator('#slot-0').click();
  await page.locator(`#deck-card-list .dw-card[data-card-id="${first}"]`).click();
  assert.equal(await page.evaluate(() => RPG.state.deck[0]), null, 'Tapping the placed card clears the slot');
  await page.locator(`#deck-card-list .dw-card[data-card-id="${first}"]`).click();
  assert.equal(await page.evaluate(() => RPG.state.deck[0]), first);
  // Placement and copy-count badges never overlap.
  const overlaps = await page.locator('#deck-card-list .dw-cardart').evaluateAll(frames => frames.some(frame => {
    const a = frame.querySelector('.dw-card-slot')?.getBoundingClientRect();
    const b = frame.querySelector('.dw-card-count')?.getBoundingClientRect();
    return !!(a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom);
  }));
  assert.equal(overlaps, false);
  await page.locator('#deck-card-list .dw-card-info').first().click();
  assert.equal(await page.locator('#modal-card').isVisible(), true);
  // The detail sheet keeps one height while paging, and its arrows live in the header bar.
  const sheetHeight = () => page.locator('#modal-card .dw-card-sheet').evaluate(el => Math.round(el.getBoundingClientRect().height));
  const firstHeight = await sheetHeight();
  await page.locator('#modal-card .dw-viewer-nav[data-dir=next]').click();
  assert.equal(await sheetHeight(), firstHeight);
  assert.equal(await page.locator('#modal-card .dw-card-bar .dw-viewer-nav').count(), 2);
  await page.keyboard.press('Escape');
  await page.locator('#dw-top-action').click();
  await page.waitForFunction(() => document.body.dataset.screen === 'menu');
  assert.equal(await page.locator('#astra-depart').isEnabled(), true);

  for (const nav of ['collection','study']) {
    await page.locator(`[data-nav=${nav}]`).click();
    assert.equal(await page.evaluate(() => document.body.dataset.screen), nav);
  }
  // The account book reports unlock tracks from the game's own rules and marks locked cards.
  await page.locator('[data-nav=collection]').click();
  await page.locator('#dw-tab-book').click();
  assert.equal(await page.locator('#dw-tracks .dw-track').count() >= 3, true);
  assert.equal(await page.locator('#collection-grid .dw-card.is-locked').count() > 0, true);
  await page.locator('#grade-picker-open').click();
  assert.equal(await page.locator('#dw-grade-menu').isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#dw-grade-menu').isVisible(), false);
  await page.locator('[data-nav=menu]').click();
  await page.locator('#dw-quick-mission').click();
  assert.equal(await page.locator('#mission-hub-list .dw-mission-row').count() >= 2, true);
  await page.keyboard.press('Escape');
  await page.locator('#dw-top-menu').click();
  assert.equal(await page.locator('#btn-toggle-tutoring').getAttribute('role'), 'switch');
  await page.keyboard.press('Escape');

  await page.locator('[data-nav=menu]').click();
  await page.locator('#astra-depart').click();
  await page.waitForFunction(() => document.body.dataset.screen === 'battle' && document.querySelectorAll('#battle-controls .skill-btn').length > 0);
  assert.match(await page.locator('#dw-e-hp').textContent(), /\d+ \/ \d+/);
  await page.evaluate(() => { RPG.battle.enemy.hp = 1; RPG.renderBattlefield(); });
  await page.locator('#battle-controls .skill-btn').first().click();
  await page.waitForFunction(() => document.querySelector('#modal-info.active.dw-result'), null, {timeout:15000});
  assert.equal(await page.locator('.dw-result-head').getAttribute('aria-label'), 'VICTORY');
  await page.locator('.dw-result-actions .dw-btn', {hasText:'건너뛰기'}).click();
  await page.waitForFunction(() => document.body.dataset.screen === 'menu' && !document.querySelector('.modal.active'));
  assert.equal(await page.evaluate(() => RPG.state.enemyScale), 1);

  // An existing save is protected by exactly one confirmation.
  await page.evaluate(() => { RPG.saveGame(false); RPG.toTitle(); });
  await page.locator('#btn-start-new').click();
  await page.locator('[onclick="RPG.selectGameType(\'endless\')"]').click();
  await page.locator('#mode-btn-origin').click();
  await page.locator('#btn-enter-mode').click();
  assert.match(await page.locator('#confirm-msg').textContent(), /덮어씁니다/);
  await page.locator('#confirm-no').click();
  assert.equal(await page.evaluate(() => RPG.state.enemyScale), 1);
  await page.context().close();

  for (const viewport of [{width:360,height:800},{width:390,height:667},{width:1280,height:900}]) {
    const small = await open(viewport);
    await small.evaluate(() => {
      RPG.loadGlobalData();
      Object.assign(RPG.state,{mode:'origin',gameType:'endless',tickets:20,enemyScale:0,deck:['marshmallow','kobold','golem'],inventory:['marshmallow','kobold','golem','luna']});
      RPG.toMenu();
    });
    for (const selector of ['#astra-depart','.astra-nav','#dw-bless','#astra-party','#dw-top-menu','#dw-ticket-pill']) assert.equal(await inView(small, selector), true, `${selector} visible at ${viewport.width}x${viewport.height}`);
    await small.locator('[data-nav=summon]').click();
    for (const selector of ['#btn-challenge-gacha','#btn-normal-gacha']) assert.equal(await inView(small, selector), true, `${selector} visible at ${viewport.width}x${viewport.height}`);
    await small.context().close();
  }
  assert.deepEqual(errors, [], 'Uncaught browser errors');
  console.log('PASS card_claude: offline boot, legacy ids, fortune badge, journey start, challenge-first summon with flip reveal (quiz repeat, Escape), formation sub-screen and badges, fixed card sheet, account book, battle HUD/result, single overwrite confirmation, 360/390x667/desktop lobby');
} finally { await browser.close(); }

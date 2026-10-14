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

  const tickets = await page.evaluate(() => RPG.state.tickets);
  await page.locator('#dw-multi-gacha').click();
  assert.equal(await page.locator('#gacha-result .dw-reveal').count(), 10);
  assert.equal(await page.evaluate(() => RPG.state.inventory.length), 10);
  assert.equal(await page.evaluate(() => RPG.state.tickets), tickets - 10);
  await page.locator('#modal-gacha .dw-btn', {hasText:'확인'}).click();
  await page.locator('#btn-normal-gacha').click();
  assert.equal(await page.locator('#dw-gacha-again').isVisible(), true);
  await page.locator('#dw-gacha-again').click();
  assert.equal(await page.evaluate(() => RPG.state.inventory.length), 12);
  await page.locator('#modal-gacha .dw-btn', {hasText:'확인'}).click();

  await page.locator('[data-nav=deck]').click();
  await page.locator('.dw-formation-head .dw-btn', {hasText:'자동 편성'}).click();
  assert.equal(await page.evaluate(() => RPG.state.deck.every(Boolean)), true);
  const first = await page.evaluate(() => RPG.state.deck[0]);
  await page.locator('#slot-0').click();
  await page.locator(`#deck-card-list .dw-card[data-card-id="${first}"]`).click();
  assert.equal(await page.evaluate(() => RPG.state.deck[0]), null, 'Tapping the placed card clears the slot');
  await page.locator(`#deck-card-list .dw-card[data-card-id="${first}"]`).click();
  assert.equal(await page.evaluate(() => RPG.state.deck[0]), first);
  await page.locator('#deck-card-list .dw-card-info').first().click();
  assert.equal(await page.locator('#modal-card').isVisible(), true);
  await page.keyboard.press('Escape');
  await page.locator('.dw-formation-head .dw-btn--primary').click();
  assert.equal(await page.locator('#astra-depart').isEnabled(), true);

  for (const nav of ['collection','study']) {
    await page.locator(`[data-nav=${nav}]`).click();
    assert.equal(await page.evaluate(() => document.body.dataset.screen), nav);
  }
  await page.locator('[data-nav=mission]').click();
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
  assert.match(await page.locator('.dw-result-head b').textContent(), /VICTORY/);
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
    for (const selector of ['#astra-depart','.astra-nav','#menu-gacha-area']) assert.equal(await inView(small, selector), true, `${selector} visible at ${viewport.width}x${viewport.height}`);
    await small.context().close();
  }
  assert.deepEqual(errors, [], 'Uncaught browser errors');
  console.log('PASS card_claude: offline boot, legacy ids, journey start, x10/again summon, formation, battle HUD/result, single overwrite confirmation, 360/390x667/desktop lobby');
} finally { await browser.close(); }

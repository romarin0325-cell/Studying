import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'test-results');
await fs.mkdir(output, { recursive: true });
const htmlPath = path.join(root, 'dist/DREAMWEAVER.html');
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Astra.ready && RPG._featuresInstalled);
  await page.evaluate(() => RPG.loadGlobalData());
  const order = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('#modal-type-select .menu-btn')].map(btn => btn.id);
    return buttons;
  });
  const bonus = order.indexOf('btn-bonus-pool-editor');
  const sets = order.indexOf('btn-card-set-editor');
  const special = order.indexOf('btn-special-card-editor');
  assert.equal(sets, bonus + 1);
  assert.ok(special === -1 || special > sets);
  await page.evaluate(() => RPG.openTypeSelect());
  await page.locator('#btn-card-set-editor').click();
  assert.equal(await page.locator('#modal-bonus-pool-editor').isVisible(), true);
  assert.equal(await page.locator('#card-pool-tab-sets').getAttribute('aria-selected'), 'true');
  await page.locator('#card-pool-editor-close').click();
  await page.evaluate(() => RPG.openCardPoolEditor('extras'));
  assert.equal(await page.locator('#card-pool-tab-extras').getAttribute('aria-selected'), 'true');
  const body = page.locator('#card-pool-editor-body');
  for (const width of [320, 390, 412]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => {
      RPG._cardPoolEditorDraft.profiles.classic.presets[0].extraCardIds = [];
      RPG.renderCardPoolEditor();
      document.querySelector('#card-pool-editor-body').scrollTop = 210;
    });
    const tile = page.locator('.card-pool-extra-grid .card-pool-card-row').nth(6);
    const portrait = tile.locator('.portrait');
    const image = portrait.locator('img');
    await image.evaluate(img => img.decode());
    const art = await portrait.boundingBox();
    const tileBox = await tile.boundingBox();
    assert.ok(art.width / tileBox.width > 0.8, 'Artwork should fill the mobile tile');
    assert.ok(Math.abs(art.width / art.height - 3 / 5) < 0.01, 'Artwork must be 3:5');
    assert.equal(await image.evaluate(img => img.naturalWidth > 0 && getComputedStyle(img).display !== 'none'), true);
    const toggle = tile.locator('.card-pool-row-action');
    await toggle.scrollIntoViewIfNeeded();
    const before = await tile.boundingBox();
    const scroll = await body.evaluate(node => node.scrollTop);
    await toggle.click();
    assert.equal(await toggle.textContent(), '제외');
    assert.deepEqual(await tile.boundingBox(), before, 'Adding must not move the tile');
    assert.equal(await body.evaluate(node => node.scrollTop), scroll);
    await toggle.click();
    assert.equal(await toggle.textContent(), '추가');
    assert.deepEqual(await tile.boundingBox(), before, 'Removing must not move the tile');
    assert.equal(await body.evaluate(node => node.scrollTop), scroll);
    assert.equal(await page.locator('.card-pool-extra-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 3);
    assert.equal(await body.evaluate(node => node.scrollWidth <= node.clientWidth), true);
  }
  await page.evaluate(() => {
    const candidates = CardPoolRules.getExtraCandidates(CardPoolRules.getSet('classic'), GameUtils.getAllCards(), RPG.getCardPoolAvailabilityContext());
    RPG._cardPoolEditorDraft.profiles.classic.presets[0].extraCardIds = candidates.slice(0, 14);
    RPG.renderCardPoolEditor();
  });
  const fifteenth = page.locator('.card-pool-extra-grid .card-pool-card-row').nth(14);
  await fifteenth.scrollIntoViewIfNeeded();
  const beforeLimit = await fifteenth.boundingBox();
  await fifteenth.locator('.card-pool-row-action').click();
  assert.equal(await page.locator('.card-pool-extra-grid [aria-pressed=true]').count(), 15);
  assert.ok(await page.locator('.card-pool-extra-grid button:disabled').count() > 0);
  assert.deepEqual(await fifteenth.boundingBox(), beforeLimit);
  await fifteenth.locator('.card-pool-row-action').click();
  assert.equal(await page.locator('.card-pool-extra-grid button:disabled').count(), 0);
  await body.evaluate(node => { node.scrollTop = 0; });
  await page.locator('.card-pool-search').pressSequentially('피닉스');
  assert.equal(await page.locator('.card-pool-search').inputValue(), '피닉스');
  assert.equal(await page.locator('.card-pool-search').evaluate(node => node === document.activeElement), true);
  assert.equal(await page.locator('.card-pool-extra-grid .card-pool-card-row').count(), 1);
  await page.locator('.card-pool-search').fill('');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, 'basic-sets-390.png') });
  for (const theme of ['astra', 'dreamsky', 'strawberry']) {
    await page.evaluate(value => { document.body.dataset.theme = value; }, theme);
    await page.locator('#card-pool-tab-sets').click();
    assert.equal(await page.locator('.card-pool-set-row').count(), 6);
    assert.equal(await body.innerText().then(text => text.includes('시험 기능')), false);
    assert.equal(await page.locator('.card-pool-set-axis').count(), 0);
    await page.screenshot({ path: path.join(output, `set-editor-${theme}-390.png`) });
    await page.locator('.card-pool-set-row').nth(3).locator('.card-pool-row-action').first().click();
    assert.equal(await page.locator('.card-pool-detail-title').textContent(), '별빛 정원');
    assert.equal(await page.locator('.card-pool-set-row').count(), 0);
    assert.equal(await body.evaluate(node => node.scrollWidth <= node.clientWidth), true);
    await page.screenshot({ path: path.join(output, `set-unlocks-${theme}-390.png`) });
    await page.locator('.card-pool-set-detail > button').click();
    await page.locator('#card-pool-tab-extras').click();
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: path.join(output, 'basic-sets-1280.png') });
  assert.deepEqual(errors, []);
  console.log('PASS basic set editor entry');
} finally {
  await browser.close();
}

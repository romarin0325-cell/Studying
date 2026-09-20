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
  await page.screenshot({ path: path.join(output, 'basic-sets-390.png') });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: path.join(output, 'basic-sets-1280.png') });
  assert.deepEqual(errors, []);
  console.log('PASS basic set editor entry');
} finally {
  await browser.close();
}

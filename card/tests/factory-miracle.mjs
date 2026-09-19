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

async function boot(viewport) {
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Astra.ready && RPG._featuresInstalled);
  await page.evaluate(() => {
    RPG.loadGlobalData();
    RPG.tempGameType = 'challenge';
    RPG.global.unlocked_modes = ['factory'];
    RPG.initNewGame('factory');
  });
  return page;
}

try {
  for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const page = await boot(size);
    const geometry = await page.evaluate(() => {
      const row = document.querySelector('.factory-card-row');
      const art = row?.querySelector('.portrait');
      const name = row?.querySelector('.factory-card-name');
      const meta = row?.querySelector('.factory-card-meta');
      const body = document.getElementById('factory-draft-body');
      return {
        overflow: body.scrollWidth <= body.clientWidth + 1,
        art: art && { w: Math.round(art.getBoundingClientRect().width), h: Math.round(art.getBoundingClientRect().height) },
        nameSize: name && parseFloat(getComputedStyle(name).fontSize),
        metaSize: meta && parseFloat(getComputedStyle(meta).fontSize),
        metaText: meta?.textContent || '',
        stacked: getComputedStyle(body).flexDirection === 'column'
      };
    });
    assert.equal(geometry.overflow, true, `horizontal overflow at ${size.width}`);
    assert.equal(geometry.nameSize, 16);
    assert.equal(geometry.metaSize, 13);
    assert.equal(/dealer|nature/.test(geometry.metaText), false);
    if (size.width < 768) {
      assert.equal(geometry.art.w, 60);
      assert.equal(geometry.art.h, 100);
      assert.equal(geometry.stacked, true);
    } else {
      assert.equal(geometry.art.w, 72);
      assert.equal(geometry.art.h, 120);
      assert.equal(geometry.stacked, false);
    }
    await page.screenshot({ path: path.join(output, `factory-${size.width}.png`) });
    const collectable = await page.evaluate(() => {
      const ids = GameUtils.getAllCards().map(card => card.id);
      return {
        larva: ids.includes('miracle_larva'),
        toffee: ids.includes('toffee_apple'),
        forms: ['mirror_cocoon', 'aurora_wing', 'abyss_wing'].filter(id => ids.includes(id))
      };
    });
    assert.equal(collectable.larva, true);
    assert.equal(collectable.toffee, true);
    assert.deepEqual(collectable.forms, []);
    await page.close();
  }

  const landscape = await boot({ width: 844, height: 390 });
  await landscape.screenshot({ path: path.join(output, 'factory-landscape-844.png') });
  await landscape.close();

  assert.deepEqual(errors, []);
  console.log('PASS factory miracle toffee UI checks');
} finally {
  await browser.close();
}

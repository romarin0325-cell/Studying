import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const original = await fs.readFile(new URL('dist/AstralBloom.html', root), 'utf8');
const html = original.replace('<head>', `<head><base href="${new URL('dist/', root).href}">`)
  .replace("Object.defineProperty(globalThis, 'astralDiagnostics'", "globalThis.__abyss={get game(){return game},get profile(){return profile},finish};\nObject.defineProperty(globalThis, 'astralDiagnostics'");
const file = new URL('artifacts/abyss-shop.html', root);
await fs.mkdir(new URL('artifacts/', root), { recursive: true });
await fs.writeFile(file, html);

const browser = await chromium.launch({ headless: true });
try {
  for (const [width,height] of [[320,568],[390,844],[430,932],[844,390]]) {
    const context = await browser.newContext({ viewport: {width,height}, offline: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith('file:') && !request.url().startsWith('data:')) external.push(request.url()); });
    await page.clock.install({ time: new Date(2026, 8, 14, 12) });
    await page.goto(file.href);
    await page.waitForFunction(() => astralDiagnostics?.ready);
    await page.evaluate(() => { __abyss.profile.dreamShards = 12; });
    await page.locator('#shop').click();
    assert.match(await page.locator('.shop-balance').innerText(), /꿈의결정\s*12/);
    assert.equal(await page.locator('.shop-product').count(), 2);
    const layout = await page.evaluate(() => {
      const panel = document.querySelector('.shop-panel');
      const images = [...panel.querySelectorAll('img')].map(img => ({ loaded: img.complete && img.naturalWidth === 192 && img.naturalHeight === 192, embedded: img.src.startsWith('data:image/webp;base64,'), fit: getComputedStyle(img).objectFit }));
      const cards = [...panel.querySelectorAll('.shop-product')].map(card => ({left:card.getBoundingClientRect().left,right:card.getBoundingClientRect().right}));
      return { images, panelWidth:panel.clientWidth, scrollWidth:panel.scrollWidth, viewportWidth:innerWidth, docWidth:document.documentElement.scrollWidth, cards };
    });
    assert.ok(layout.images.length >= 5 && layout.images.every(img => img.loaded && img.embedded && img.fit === 'contain'), `${width}x${height} icons ${JSON.stringify(layout.images)}`);
    assert.ok(layout.scrollWidth <= layout.panelWidth + 1 && layout.docWidth <= layout.viewportWidth + 1, `${width}x${height} horizontal overflow: ${JSON.stringify(layout)}`);
    assert.ok(layout.cards.every(card => card.left >= 0 && card.right <= width), `${width}x${height} card overflow`);
    if (width === 320 || width === 430) await page.screenshot({ path: fileURLToPath(new URL(`artifacts/abyss-shop-${width}x${height}.png`, root)) });
    await page.locator('#shop-back').click();
    await page.locator('#dungeons').click();
    assert.equal(await page.locator('[data-difficulty]').count(), 4);
    await page.locator('[data-difficulty="abyss"]').click();
    assert.equal(await page.locator('[data-difficulty="abyss"]').getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('.dungeon-card.selected em').innerText(), /뽑기권 2장/);
    const difficulty = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('[data-difficulty]')].map(el => el.getBoundingClientRect());
      return { buttons: buttons.map(box => ({ left:box.left, right:box.right, width:box.width })), width:innerWidth };
    });
    assert.ok(difficulty.buttons.every(box => box.left >= 0 && box.right <= difficulty.width && box.width > 45), `${width}x${height} difficulty overflow: ${JSON.stringify(difficulty)}`);
    if (width === 320) await page.screenshot({ path: fileURLToPath(new URL('artifacts/abyss-difficulty-320x568.png', root)) });
    await page.locator('#dungeon-done').click();
    assert.match(await page.locator('#dungeons').innerText(), /심연/);
    if (width === 320) {
      await page.locator('#shop').click();
      await page.locator('#buy-ticket').click();
      await page.locator('#shop-cancel').click();
      assert.match(await page.locator('.shop-balance').innerText(), /12/);
      await page.locator('#buy-ticket').click();
      await page.locator('#shop-confirm').click();
      assert.equal(__number(await page.locator('.shop-balance strong').innerText()), 7);
      assert.match(await page.locator('.shop-product').first().innerText(), /보유 뽑기권 1장/);
      await page.locator('#buy-reset').click();
      await page.locator('#shop-confirm').click();
      assert.equal(__number(await page.locator('.shop-balance strong').innerText()), 6);
      await page.evaluate(() => { __abyss.profile.randomDraws = { date: '2026-09-14', count: 3 }; });
      await page.locator('#shop-back').click();
      await page.locator('#shop').click();
      assert.equal(await page.locator('#use-reset').isEnabled(), true);
      await page.locator('#use-reset').click();
      await page.locator('#shop-confirm').click();
      assert.match(await page.locator('.shop-reset').innerText(), /3\s*\/\s*3/);
      assert.equal(await page.locator('#use-reset').isEnabled(), false);
      await page.evaluate(() => { __abyss.profile.dreamShards = 0; });
      await page.locator('#shop-back').click();
      await page.locator('#shop').click();
      for (const id of ['#buy-ticket','#buy-reset']) assert.equal(await page.locator(id).isEnabled(), false);
      assert.match(await page.locator('.shop-goods').innerText(), /아티팩트 뽑기권[\s\S]*꿈의결정 5개[\s\S]*랜덤 횟수 리셋권[\s\S]*꿈의결정 1개/);
      assert.equal(await page.locator('.shop-product').first().evaluate(el => getComputedStyle(el).opacity), '1');
      await page.locator('#shop-back').click();
      await page.locator('#dungeons').click();
      await page.locator('#challenge-mode').click();
      await page.locator('#challenge-done').click();
      assert.match(await page.locator('#dungeons').innerText(), /챌린지 · 심연/);
      await page.locator('#launch').click();
      if (await page.locator('#help-done').count()) await page.locator('#help-done').click();
      await page.waitForFunction(() => __abyss.game);
      await page.evaluate(() => __abyss.finish(false));
      assert.match(await page.locator('.panel .small-caps').first().innerText(), /심연/);
    }
    assert.deepEqual(errors, [], `${width}x${height} page errors`);
    assert.deepEqual(external, [], `${width}x${height} external requests`);
    await context.close();
  }
  console.log('offline shop, economy, reset and four-view difficulty layout passed');
} finally {
  await browser.close();
}

function __number(value) { return Number(value.replaceAll(',', '').trim()); }

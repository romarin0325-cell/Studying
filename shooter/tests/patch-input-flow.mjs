import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const root = new URL('../', import.meta.url);
const original = await fs.readFile(new URL('dist/AstralBloom.html', root), 'utf8');
const html = original.replace('<head>', `<head><base href="${new URL('dist/', root).href}">`).replace("Object.defineProperty(globalThis, 'astralDiagnostics'", "globalThis.__patch={get game(){return game},get profile(){return profile}};\nObject.defineProperty(globalThis, 'astralDiagnostics'");
const file = new URL('artifacts/patch-input.html', root);
await fs.mkdir(new URL('artifacts/', root), { recursive: true });
await fs.writeFile(file, html);
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, offline: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date(2026, 8, 14, 12) });
  await page.goto(file.href);
  await page.waitForFunction(() => astralDiagnostics?.ready);
  await page.locator('#launch').click();
  await page.locator('#help-done').click();
  await page.waitForFunction(() => __patch.game?.phase === 'wave');
  await page.evaluate(() => { const g = __patch.game; g.player.invincible = 999; g.bombs = 3; g.bombTime = 0; });
  const box = await page.locator('#world').boundingBox();
  const start = await page.evaluate(() => ({ x: __patch.game.player.x, bombs: __patch.game.bombs }));
  const after = await page.evaluate(({ x, y }) => {
    const world = document.getElementById('world'), bomb = document.getElementById('bomb');
    world.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    bomb.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, pointerType: 'touch', isPrimary: false, button: 0, bubbles: true, cancelable: true }));
    bomb.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, pointerType: 'touch', bubbles: true }));
    bomb.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true }));
    world.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: x + 30, clientY: y, bubbles: true, cancelable: true }));
    return { bombs: __patch.game.bombs, stats: __patch.game.stats.bombs, x: __patch.game.player.x };
  }, { x: box.x + 40, y: box.y + 180 });
  assert.equal(after.bombs, start.bombs - 1);
  assert.equal(after.stats, 1);
  await page.locator('#pause').click();
  await page.locator('#return').click();
  assert.equal(await page.locator('#shop').count(), 1);
  const columns = await page.evaluate(() => getComputedStyle(document.querySelector('.campaign-route')).gridTemplateColumns);
  assert.ok(columns.split(' ').filter(Boolean).length >= 2);
  await page.locator('#shop').click();
  assert.match(await page.locator('.shop-balance').innerText(), /꿈의 조각/);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('browser pointer path checked; real Android/iOS multitouch was not run');
} finally {
  await browser.close();
}

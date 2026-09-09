import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const root = path.dirname(fileURLToPath(import.meta.url)), file = path.join(root, 'dist', 'AstralBloom.html');
const html = await fs.readFile(file, 'utf8');
assert.ok(!/<script[^>]+src=|<link[^>]+href=|https?:\/\//i.test(html), 'Offline HTML must not fetch code or external assets');
assert.ok((html.match(/data:image\//g) || []).length >= 4);
await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { offline: true, checks: [], viewports: [], requests: [], errors: [], frameProbe: null };
try {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, offline: true });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('request', req => { if (/^https?:/.test(req.url())) report.requests.push(req.url()); });
    await page.goto(pathToFileURL(file).href);
    await page.waitForFunction(() => window.astralDiagnostics?.ready, null, { timeout: 30000 });
    const geometry = await page.evaluate(() => {
      const selectors = ['.hero-large', '.roster', '.weapons', '.route', '#launch'];
      return { width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth,
        elements: Object.fromEntries(selectors.map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [s, { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }]; })) };
    });
    assert.equal(geometry.scroll, geometry.width, 'No horizontal page overflow');
    if (viewport.height > viewport.width) for (const [id, r] of Object.entries(geometry.elements)) {
      assert.ok(r.x >= -1 && r.right <= geometry.width + 1, `${id} clipped horizontally at ${viewport.width}`);
      assert.ok(r.bottom <= geometry.height + 1, `${id} clipped below screen at ${viewport.width}`);
    }
    await page.screenshot({ path: path.join(root, 'artifacts', `sortie-${viewport.width}.png`) });
    report.viewports.push({ viewport, geometry });
    if (viewport.width !== 390) { await context.close(); continue; }
    for (let h = 0; h < 4; h++) {
      await page.locator(`[data-hero="${h}"]`).click();
      assert.equal(await page.locator('.hero-large').getAttribute('alt'), ['루미', '루나', '지크', '자스민'][h] + '의 SD 일러스트');
      for (let w = 0; w < 2; w++) { await page.locator(`[data-weapon="${w}"]`).click(); assert.equal(await page.locator(`[data-weapon="${w}"]`).getAttribute('aria-pressed'), 'true'); }
    }
    report.checks.push('All four heroes and eight weapon choices work');
    await page.locator('[data-hero="0"]').click();
    await page.locator('#launch').click();
    await page.locator('#help-done').click();
    await page.waitForFunction(() => window.astralDiagnostics.phase === 'wave');
    const before = await page.evaluate(() => window.astralDiagnostics);
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 650 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 275, y: 590 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(350);
    const after = await page.evaluate(() => window.astralDiagnostics);
    assert.ok(after.player.x > before.player.x + 60 && after.player.y < before.player.y - 35, 'Relative touch drag moves the actual player');
    await page.locator('#bomb').click();
    assert.equal((await page.evaluate(() => window.astralDiagnostics)).bombs, 2);
    report.checks.push('Touch movement and bomb activation work');
    await page.locator('#pause').click(); const paused = await page.evaluate(() => window.astralDiagnostics);
    assert.equal(paused.paused, true); await page.waitForTimeout(350);
    const stayed = await page.evaluate(() => window.astralDiagnostics);
    assert.equal(stayed.score, paused.score); assert.deepEqual(stayed.player, paused.player);
    await page.locator('#resume').click(); assert.equal((await page.evaluate(() => window.astralDiagnostics)).paused, false);
    report.checks.push('Pause freezes simulation and resume restores it');
    await page.waitForTimeout(9000);
    report.frameProbe = await page.evaluate(() => window.astralDiagnostics);
    assert.ok(report.frameProbe.stats.shots > 10 && report.frameProbe.stats.damage > 0, 'Live combat fires and deals damage');
    await page.screenshot({ path: path.join(root, 'artifacts', 'battle-mobile.png') });
    await page.locator('#pause').click(); await page.locator('#return').click();
    await page.locator('[data-stage="3"]').click(); await page.locator('#launch').click();
    await page.waitForFunction(() => window.astralDiagnostics.stage === 3 && window.astralDiagnostics.phase === 'wave');
    report.checks.push('Fourth-stage practice can launch offline');
    await context.close();
  }
  const blocked = await browser.newContext({ viewport: { width: 390, height: 844 }, offline: true });
  await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }); });
  const page = await blocked.newPage(); page.on('pageerror', e => report.errors.push(e.message)); await page.goto(pathToFileURL(file).href);
  await page.waitForFunction(() => window.astralDiagnostics?.ready); await page.locator('#launch').click(); await page.locator('#help-done').click();
  await page.waitForFunction(() => window.astralDiagnostics.phase === 'wave'); assert.equal((await page.evaluate(() => window.astralDiagnostics)).storageAvailable, false);
  report.checks.push('Storage-blocked file environments remain playable');
  await blocked.close();
  assert.deepEqual(report.errors, [], 'No uncaught browser errors'); assert.deepEqual(report.requests, [], 'No network requests in the offline build');
} finally {
  await fs.writeFile(path.join(root, 'artifacts', 'verification.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ passed: report.checks, viewports: report.viewports.map(v => v.viewport), frameProbe: report.frameProbe, errors: report.errors.length, networkRequests: report.requests.length }, null, 2));

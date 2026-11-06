import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { COLLECTIBLE_ARTIFACTS } from '../meta.js';

const root = new URL('../', import.meta.url), review = new URL('artifacts/boss-relics/', root);
await fs.mkdir(review, { recursive: true });
const original = await fs.readFile(new URL('dist/AstralBloom.html', root), 'utf8');
const marker = "Object.defineProperty(globalThis, 'astralDiagnostics'";
assert.ok(original.includes(marker));
const html = original.replace(marker, `globalThis.__presentation = {
  get game(){return game}, get menus(){return menus}, profile, startGame, renderHud,
  stop(){cancelAnimationFrame(raf)}, showSortie
};\n${marker}`);
const fixture = new URL('flow.html', review);
await fs.writeFile(fixture, html);
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height] of [[390, 844], [844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, offline: true, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!/^(file|data):/.test(request.url())) external.push(request.url()); });
    await page.goto(fixture.href);
    await page.waitForFunction(() => globalThis.astralDiagnostics?.ready);
    const start = stage => page.evaluate(async stage => {
      await __presentation.startGame(stage, true); __presentation.stop();
    }, stage);
    const hud = () => page.evaluate(() => ({
      hidden: document.querySelector('#boss-hud').hidden,
      name: document.querySelector('#pattern-name').textContent,
      expected: __presentation.game.stage.pattern[Math.max(0, __presentation.game.bossPattern)]
    }));
    await start(0);
    for (const stage of [0, 1, 6, 7]) {
      await page.evaluate(stage => {
        const g = __presentation.game;
        g.startStage(stage, 2); __presentation.renderHud();
      }, stage);
      assert.equal((await hud()).name, '', 'stage transitions clear the old pattern');
      await page.evaluate(() => { __presentation.game.spawnBoss(); __presentation.renderHud(); });
      let state = await hud();
      await page.screenshot({ path: fileURLToPath(new URL(`${width}-boss-${stage}-warning.png`, review)) });
      assert.equal(state.hidden, false);
      assert.equal(state.name, state.expected, 'warning shows this boss’s first pattern immediately');
      for (const ratio of [.99, .6, .2]) {
        await page.evaluate(ratio => {
          const g = __presentation.game; g.phase = 'boss'; g.boss.hp = g.boss.maxHp * ratio;
          g.bossAttack(0); __presentation.renderHud();
        }, ratio);
        state = await hud(); assert.equal(state.name, state.expected);
      }
    }
    await start(2);
    assert.equal((await hud()).name, '', 'a new run clears the previous boss’s pattern');
    await page.evaluate(() => { __presentation.game.spawnBoss(); __presentation.renderHud(); });
    assert.equal((await hud()).name, (await hud()).expected);
    await page.evaluate(() => {
      const g = __presentation.game; g.phase = 'clear'; __presentation.renderHud(); __presentation.showSortie();
    });

    // Exercise real draws from each atlas through the ticket and reveal UI.
    for (const id of ['mask', 'magnet', 'moonlight', 'resurgence', 'steelshield', 'holysword']) {
      const artifact = COLLECTIBLE_ARTIFACTS.find(a => a.id === id);
      const pool = COLLECTIBLE_ARTIFACTS.filter(a => a.rarity === artifact.rarity);
      await page.evaluate(({ roll, pick }) => {
        __presentation.profile.tickets = [{ source: 'shop', kind: 'artifact' }];
        const random = Math.random; let calls = 0;
        Math.random = () => { if (++calls === 1) return roll; Math.random = random; return pick; };
        __presentation.menus.equipment();
        document.querySelector('#draw-ticket').click(); document.querySelector('#quiz-decline').click();
      }, { roll: { normal: .99, rare: 0, epic: .15 }[artifact.rarity], pick: (pool.indexOf(artifact) + .5) / pool.length });
      await page.locator('.reveal-stage img').evaluate(image => image.decode());
      assert.equal(await page.locator('.reveal-caption h3').textContent(), artifact.name);
      const alignment = await page.locator('.reveal-stage').evaluate(stage => {
        const image = stage.querySelector('img'), box = stage.getBoundingClientRect(), art = image.getBoundingClientRect();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        return { x: Math.abs(art.x + art.width / 2 - box.x - box.width / 2),
          y: Math.abs(art.y + art.height / 2 - box.y - box.height / 2), alpha: ctx.getImageData(0, 0, 1, 1).data[3] };
      });
      assert.ok(alignment.x <= 1 && alignment.y <= 1, `${id}: reveal image is centered`);
      assert.equal(alignment.alpha, 0, `${id}: no opaque background in embedded art`);
      await page.screenshot({ path: fileURLToPath(new URL(`${width}-relic-${id}.png`, review)) });
      await page.locator('#reveal-done').click();
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    await context.close();
    console.log(`Boss entry, phase changes, new run and six relic reveal atlases: ${width}×${height} PASS`);
  }
} finally { await browser.close(); }

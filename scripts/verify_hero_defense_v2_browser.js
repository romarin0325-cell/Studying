const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', 'defense_hero_v2');
const VIEWPORTS = Object.freeze([
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 800, height: 360 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
]);
const CONTENT_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
});

function createServer() {
  return http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const requestedPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const absolutePath = path.resolve(ROOT, requestedPath);
    if (absolutePath !== ROOT && !absolutePath.startsWith(`${ROOT}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(absolutePath, (error, body) => {
      if (error) {
        response.writeHead(404).end('Not found');
        return;
      }
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': CONTENT_TYPES[path.extname(absolutePath)] ?? 'application/octet-stream',
      });
      response.end(body);
    });
  });
}

function describeViewport(viewport) {
  return `${viewport.width}x${viewport.height}`;
}

function assertClose(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`);
}

function percentile95(samples) {
  assert.ok(samples.length > 0, 'Cannot calculate p95 without samples');
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

async function enterDefaultBattle(page) {
  await page.waitForFunction(() => Boolean(globalThis.__heroDefenseV2Debug?.getState));
  await page.evaluate(() => globalThis.__heroDefenseV2Debug.startDefaultBattle('ancient_ruins'));
  await page.locator('[data-screen="battle"]').waitFor();
  await page.waitForFunction(() => {
    const state = globalThis.__heroDefenseV2Debug?.getState?.();
    return state?.battle?.layout?.cssWidth > 1 && state?.battle?.layout?.cssHeight > 1;
  });
}

async function collectBattleGeometry(page) {
  return page.evaluate(() => {
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return {
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
      };
    };
    const visible = (element) => {
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) !== 0
        && bounds.width > 0
        && bounds.height > 0;
    };
    const html = document.documentElement;
    const battle = document.querySelector('[data-screen="battle"]');
    const boardShell = document.querySelector('[data-board-shell]');
    const canvas = document.querySelector('#battle-canvas');
    const panel = document.querySelector('.battle-panel');
    const rail = document.querySelector('[data-hero-rail]');
    const heroCards = [...document.querySelectorAll('[data-hero-card]')].map((element) => ({
      id: element.dataset.heroCard,
      visible: visible(element),
      rect: rect(element),
    }));
    const controlSelector = [
      '[data-action="back"]',
      '[data-action="settings"]',
      '[data-action="auto-place"]',
      '[data-action="start-wave"]',
      '[data-action="pause"]',
      '[data-action="speed"]',
      '[data-hero-card]',
    ].join(',');
    const controls = [...document.querySelectorAll(controlSelector)]
      .filter(visible)
      .map((element) => ({
        label: element.getAttribute('aria-label') || element.dataset.heroCard || element.textContent.trim(),
        rect: rect(element),
      }));
    const rotationGuards = [...document.querySelectorAll([
      '#rotate-guard',
      '.rotate-guard',
      '[data-rotate-guard]',
      '[data-forced-rotation]',
      '[data-rotation-overlay]',
    ].join(','))].filter(visible).map((element) => element.textContent.trim());
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        htmlClientWidth: html.clientWidth,
        htmlClientHeight: html.clientHeight,
        htmlScrollWidth: html.scrollWidth,
        htmlScrollHeight: html.scrollHeight,
        bodyClientWidth: document.body.clientWidth,
        bodyClientHeight: document.body.clientHeight,
        bodyScrollWidth: document.body.scrollWidth,
        bodyScrollHeight: document.body.scrollHeight,
      },
      battle: rect(battle),
      boardShell: rect(boardShell),
      canvas: rect(canvas),
      panel: rect(panel),
      rail: rect(rail),
      heroCards,
      controls,
      rotationGuards,
      debug: globalThis.__heroDefenseV2Debug.getState().battle,
    };
  });
}

function assertBattleLayout(geometry, expectedViewport, { checkPerformance = true } = {}) {
  const label = describeViewport(expectedViewport);
  const tolerance = 1.5;
  const expectedLandscape = expectedViewport.width > expectedViewport.height;
  assert.equal(geometry.viewport.width, expectedViewport.width, `${label}: unexpected browser width`);
  assert.equal(geometry.viewport.height, expectedViewport.height, `${label}: unexpected browser height`);

  const documentSizes = geometry.document;
  assert.ok(
    documentSizes.htmlScrollWidth <= documentSizes.htmlClientWidth + tolerance,
    `${label}: document scrolls horizontally (${documentSizes.htmlScrollWidth} > ${documentSizes.htmlClientWidth})`,
  );
  assert.ok(
    documentSizes.htmlScrollHeight <= documentSizes.htmlClientHeight + tolerance,
    `${label}: document scrolls vertically (${documentSizes.htmlScrollHeight} > ${documentSizes.htmlClientHeight})`,
  );
  assert.ok(
    documentSizes.bodyScrollWidth <= documentSizes.bodyClientWidth + tolerance,
    `${label}: body scrolls horizontally (${documentSizes.bodyScrollWidth} > ${documentSizes.bodyClientWidth})`,
  );
  assert.ok(
    documentSizes.bodyScrollHeight <= documentSizes.bodyClientHeight + tolerance,
    `${label}: body scrolls vertically (${documentSizes.bodyScrollHeight} > ${documentSizes.bodyClientHeight})`,
  );

  for (const [name, rect] of [['battle', geometry.battle], ['board', geometry.boardShell], ['canvas', geometry.canvas]]) {
    assert.ok(rect.width > 0 && rect.height > 0, `${label}: ${name} has no rendered size`);
    assert.ok(rect.left >= -tolerance && rect.top >= -tolerance, `${label}: ${name} starts outside the viewport`);
    assert.ok(rect.right <= expectedViewport.width + tolerance, `${label}: ${name} exceeds viewport width`);
    assert.ok(rect.bottom <= expectedViewport.height + tolerance, `${label}: ${name} exceeds viewport height`);
  }
  assertClose(geometry.canvas.left, geometry.boardShell.left, tolerance, `${label}: canvas left edge`);
  assertClose(geometry.canvas.top, geometry.boardShell.top, tolerance, `${label}: canvas top edge`);
  assertClose(geometry.canvas.width, geometry.boardShell.width, tolerance, `${label}: canvas width`);
  assertClose(geometry.canvas.height, geometry.boardShell.height, tolerance, `${label}: canvas height`);

  assert.equal(geometry.debug.layout.landscape, expectedLandscape, `${label}: logical orientation mismatch`);
  if (expectedLandscape) {
    assert.ok(geometry.boardShell.right <= geometry.panel.left + tolerance, `${label}: landscape panel is not to the right of the board`);
    assertClose(geometry.boardShell.top, geometry.panel.top, tolerance, `${label}: landscape board/panel top edge`);
    assertClose(geometry.boardShell.bottom, geometry.panel.bottom, tolerance, `${label}: landscape board/panel bottom edge`);
  } else {
    assert.ok(geometry.boardShell.bottom <= geometry.panel.top + tolerance, `${label}: portrait panel is not below the board`);
    assertClose(geometry.boardShell.left, geometry.panel.left, tolerance, `${label}: portrait board/panel left edge`);
    assertClose(geometry.boardShell.right, geometry.panel.right, tolerance, `${label}: portrait board/panel right edge`);
  }

  assert.equal(geometry.rotationGuards.length, 0, `${label}: a forced-rotation overlay is visible`);
  assert.equal(geometry.heroCards.length, 5, `${label}: expected exactly five hero cards`);
  for (const card of geometry.heroCards) {
    assert.ok(card.visible, `${label}: hero card ${card.id} is hidden`);
    assert.ok(card.rect.left >= geometry.rail.left - tolerance, `${label}: hero card ${card.id} is clipped on the left`);
    assert.ok(card.rect.top >= geometry.rail.top - tolerance, `${label}: hero card ${card.id} is clipped on the top`);
    assert.ok(card.rect.right <= geometry.rail.right + tolerance, `${label}: hero card ${card.id} is clipped on the right`);
    assert.ok(card.rect.bottom <= geometry.rail.bottom + tolerance, `${label}: hero card ${card.id} is clipped on the bottom`);
    assert.ok(card.rect.left >= -tolerance && card.rect.top >= -tolerance, `${label}: hero card ${card.id} starts outside the viewport`);
    assert.ok(card.rect.right <= expectedViewport.width + tolerance, `${label}: hero card ${card.id} exceeds viewport width`);
    assert.ok(card.rect.bottom <= expectedViewport.height + tolerance, `${label}: hero card ${card.id} exceeds viewport height`);
  }

  const undersized = geometry.controls.filter(({ rect }) => rect.width < 43.5 || rect.height < 43.5);
  assert.deepEqual(
    undersized,
    [],
    `${label}: battle controls must be at least 44x44 CSS px; undersized: ${JSON.stringify(undersized)}`,
  );
  if (checkPerformance) {
    const metrics = geometry.debug.snapshot.metrics;
    assert.ok(metrics.renderSamples > 0, `${label}: no render performance samples were recorded`);
    assert.ok(metrics.renderP95 <= 8, `${label}: render p95 ${metrics.renderP95}ms exceeds 8ms`);
    assert.ok(metrics.updateP95 <= 4, `${label}: update p95 ${metrics.updateP95}ms exceeds 4ms`);
  }
}

async function calculateLegalPlacementTarget(page, heroIndex = 0) {
  return page.evaluate((requestedHeroIndex) => {
    const appState = globalThis.__heroDefenseV2Debug.getState();
    const snapshot = appState.battle.snapshot;
    const layout = appState.battle.layout;
    const hero = snapshot.heroes[requestedHeroIndex];
    if (!hero) throw new Error(`No hero exists at index ${requestedHeroIndex}`);
    const blocked = new Set([
      ...snapshot.stage.path.map(({ x, y }) => `${x},${y}`),
      ...snapshot.stage.obstacles.map(({ x, y }) => `${x},${y}`),
      ...snapshot.heroes
        .filter((candidate) => candidate.placed && candidate.id !== hero.id)
        .map(({ x, y }) => `${x},${y}`),
    ]);
    if (hero.placed) blocked.add(`${hero.x},${hero.y}`);
    let cell = null;
    for (let y = 0; y < 16 && !cell; y += 1) {
      for (let x = 0; x < 12; x += 1) {
        if (!blocked.has(`${x},${y}`)) {
          cell = { x, y };
          break;
        }
      }
    }
    if (!cell) throw new Error('No legal placement cell found');
    const canvasBounds = document.querySelector('#battle-canvas').getBoundingClientRect();
    const viewX = layout.landscape ? 16 - (cell.y + 0.5) : cell.x + 0.5;
    const viewY = layout.landscape ? cell.x + 0.5 : cell.y + 0.5;
    return {
      heroId: hero.id,
      cell,
      clientX: canvasBounds.left + layout.boardRect.x + (viewX / layout.viewColumns) * layout.boardRect.width,
      clientY: canvasBounds.top + layout.boardRect.y + (viewY / layout.viewRows) * layout.boardRect.height,
    };
  }, heroIndex);
}

async function clickLegalPlacement(page, heroIndex = 0, { selectCard = true } = {}) {
  const target = await calculateLegalPlacementTarget(page, heroIndex);
  if (selectCard) await page.locator(`[data-hero-card="${target.heroId}"]`).click();
  await page.mouse.click(target.clientX, target.clientY);
  const placed = await page.evaluate((heroId) => {
    const hero = globalThis.__heroDefenseV2Debug.getState().battle.snapshot.heroes.find((candidate) => candidate.id === heroId);
    return { placed: hero?.placed, x: hero?.x, y: hero?.y };
  }, target.heroId);
  assert.deepEqual(
    placed,
    { placed: true, x: target.cell.x, y: target.cell.y },
    `Canvas pointer placement did not reach logical cell ${target.cell.x},${target.cell.y}`,
  );
  return target;
}

async function measureActiveWavePerformance(page, label) {
  const measurement = await page.evaluate((frameCount) => new Promise((resolve, reject) => {
    const before = globalThis.__heroDefenseV2Debug.getState().battle;
    if (before.snapshot.phase !== 'WAVE_RUNNING') {
      reject(new Error(`Expected WAVE_RUNNING before performance sampling, received ${before.snapshot.phase}`));
      return;
    }
    const beforeUpdateCount = before.performanceSamples.update.length;
    const beforeRenderCount = before.performanceSamples.render.length;
    const frameIntervals = [];
    let previous = 0;
    const collect = (timestamp) => {
      if (previous > 0) frameIntervals.push(timestamp - previous);
      previous = timestamp;
      if (frameIntervals.length < frameCount) {
        requestAnimationFrame(collect);
        return;
      }
      const after = globalThis.__heroDefenseV2Debug.getState().battle;
      resolve({
        phase: after.snapshot.phase,
        frameIntervals,
        updateSamples: after.performanceSamples.update.slice(beforeUpdateCount),
        renderSamples: after.performanceSamples.render.slice(beforeRenderCount),
      });
    };
    requestAnimationFrame(collect);
  }), 45);

  assert.equal(measurement.phase, 'WAVE_RUNNING', `${label}: wave ended during real-time performance sampling`);
  assert.ok(measurement.updateSamples.length >= 30, `${label}: only ${measurement.updateSamples.length} in-wave update samples were recorded`);
  assert.ok(measurement.renderSamples.length >= 30, `${label}: only ${measurement.renderSamples.length} in-wave render samples were recorded`);
  const averageFrameMs = measurement.frameIntervals.reduce((sum, value) => sum + value, 0) / measurement.frameIntervals.length;
  const framesPerSecond = 1000 / averageFrameMs;
  const updateP95 = percentile95(measurement.updateSamples);
  const renderP95 = percentile95(measurement.renderSamples);
  assert.ok(framesPerSecond >= 30, `${label}: in-wave animation rate ${framesPerSecond.toFixed(1)}fps is below 30fps`);
  assert.ok(updateP95 <= 4, `${label}: in-wave update p95 ${updateP95.toFixed(3)}ms exceeds 4ms`);
  assert.ok(renderP95 <= 8, `${label}: in-wave render p95 ${renderP95.toFixed(3)}ms exceeds 8ms`);
  return { framesPerSecond, updateP95, renderP95 };
}

async function verifyHeroSheetInputRecovery(page, viewport, screenshotPath) {
  const label = describeViewport(viewport);
  const before = await page.evaluate(() => globalThis.__heroDefenseV2Debug.getState().battle.snapshot);
  assert.equal(before.phase, 'INTERMISSION', `${label}: hero sheet test requires intermission`);

  await page.locator('[data-hero-card]').first().click();
  const backdrop = page.locator('[data-hero-sheet]');
  await backdrop.waitFor({ state: 'visible' });
  const sheetGeometry = await page.evaluate(() => {
    const backdropElement = document.querySelector('[data-hero-sheet]');
    const sheetElement = backdropElement.querySelector('.battle-hero-sheet');
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return { top: bounds.top, right: bounds.right, bottom: bounds.bottom, left: bounds.left, width: bounds.width, height: bounds.height };
    };
    return { backdrop: rect(backdropElement), sheet: rect(sheetElement) };
  });
  assertClose(sheetGeometry.backdrop.left, 0, 1.5, `${label}: hero sheet backdrop left edge`);
  assertClose(sheetGeometry.backdrop.top, 0, 1.5, `${label}: hero sheet backdrop top edge`);
  assertClose(sheetGeometry.backdrop.right, viewport.width, 1.5, `${label}: hero sheet backdrop right edge`);
  assertClose(sheetGeometry.backdrop.bottom, viewport.height, 1.5, `${label}: hero sheet backdrop bottom edge`);
  if (viewport.width > viewport.height) {
    assert.ok(sheetGeometry.sheet.left >= viewport.width * 0.44, `${label}: landscape hero sheet is not side-aligned`);
    assert.ok(sheetGeometry.sheet.right >= viewport.width - 25, `${label}: landscape hero sheet does not reach the right edge`);
    assert.ok(sheetGeometry.sheet.height >= viewport.height - 32, `${label}: landscape hero sheet is not a full-height side sheet`);
  } else {
    assert.ok(sheetGeometry.sheet.bottom >= viewport.height - 25, `${label}: portrait hero sheet is not bottom-aligned`);
    assert.ok(sheetGeometry.sheet.width >= Math.min(viewport.width - 32, 300), `${label}: portrait hero sheet is unexpectedly narrow`);
  }
  await page.screenshot({ path: screenshotPath, fullPage: false });

  await page.locator('[data-action="close-sheet"]').click();
  await backdrop.waitFor({ state: 'hidden' });
  const target = await calculateLegalPlacementTarget(page, 0);
  const hitTarget = await page.evaluate(({ clientX, clientY }) => {
    const element = document.elementFromPoint(clientX, clientY);
    const backdropElement = document.querySelector('[data-hero-sheet]');
    return {
      hitCanvas: element?.id === 'battle-canvas',
      backdropHidden: backdropElement.hidden,
      backdropDisplay: getComputedStyle(backdropElement).display,
    };
  }, target);
  assert.deepEqual(
    hitTarget,
    { hitCanvas: true, backdropHidden: true, backdropDisplay: 'none' },
    `${label}: dismissed hero sheet still intercepts the board pointer`,
  );
  await clickLegalPlacement(page, 0, { selectCard: false });
}

async function waitForViewportLayout(page, viewport) {
  await page.waitForFunction(({ width, height }) => {
    const battle = globalThis.__heroDefenseV2Debug?.getState?.().battle;
    return innerWidth === width
      && innerHeight === height
      && battle?.layout?.landscape === (width > height)
      && document.querySelector('#battle-canvas')?.getBoundingClientRect().width > 1;
  }, viewport);
}

async function runOrientationTransition(browser, baseUrl, artifactsDirectory) {
  const portrait = { width: 390, height: 844 };
  const landscape = { width: 844, height: 390 };
  const context = await browser.newContext({ viewport: portrait, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => runtimeErrors.push(`page: ${error.message}`));
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await enterDefaultBattle(page);
    const portraitPlacement = await clickLegalPlacement(page, 0);
    await page.screenshot({ path: path.join(artifactsDirectory, 'rotation-portrait-before.png'), fullPage: false });

    await page.setViewportSize(landscape);
    await waitForViewportLayout(page, landscape);
    assertBattleLayout(await collectBattleGeometry(page), landscape, { checkPerformance: false });
    const landscapePlacement = await clickLegalPlacement(page, 1);
    await page.screenshot({ path: path.join(artifactsDirectory, 'rotation-landscape.png'), fullPage: false });

    await page.setViewportSize(portrait);
    await waitForViewportLayout(page, portrait);
    assertBattleLayout(await collectBattleGeometry(page), portrait, { checkPerformance: false });
    const returnedPortraitPlacement = await clickLegalPlacement(page, 2);
    const placements = await page.evaluate(() => globalThis.__heroDefenseV2Debug.getState().battle.snapshot.heroes.slice(0, 3).map(({ id, placed, x, y }) => ({ id, placed, x, y })));
    assert.deepEqual(placements, [portraitPlacement, landscapePlacement, returnedPortraitPlacement].map(({ heroId, cell }) => ({ id: heroId, placed: true, x: cell.x, y: cell.y })), 'portrait/landscape resize lost or mis-mapped canvas placements');
    await page.screenshot({ path: path.join(artifactsDirectory, 'rotation-portrait-returned.png'), fullPage: false });
    assert.deepEqual(runtimeErrors, [], `orientation transition browser runtime errors: ${runtimeErrors.join('\n')}`);
    console.log('Hero Defense V2 same-page portrait/landscape canvas input passed');
  } catch (error) {
    await page.screenshot({ path: path.join(artifactsDirectory, 'rotation-failed.png'), fullPage: false }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

async function completeFirstWaveAtDoubleSpeed(page, viewport, screenshotPath) {
  const label = describeViewport(viewport);
  await page.locator('[data-action="auto-place"]').click();
  const placementState = await page.evaluate(() => globalThis.__heroDefenseV2Debug.getState().battle.snapshot);
  assert.equal(placementState.heroes.length, 5, `${label}: formation has the wrong hero count`);
  assert.ok(placementState.heroes.every((hero) => hero.placed), `${label}: auto placement did not place every hero`);
  assert.equal(await page.locator('[data-action="start-wave"]').isDisabled(), false, `${label}: start wave stayed disabled after placement`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  await page.locator('[data-action="speed"]').click();
  const speed = await page.evaluate(() => globalThis.__heroDefenseV2Debug.getState().battle.snapshot.speed);
  assert.equal(speed, 2, `${label}: speed control did not switch to 2x`);

  await page.locator('[data-action="start-wave"]').click();
  const started = await page.evaluate(() => globalThis.__heroDefenseV2Debug.getState().battle.snapshot);
  assert.equal(started.phase, 'WAVE_RUNNING', `${label}: wave did not start`);
  assert.equal(started.wave.number, 1, `${label}: the wrong wave started`);
  assert.equal(started.wave.completedCount, 0, `${label}: wave completion was counted before deterministic stepping`);

  const performance = await measureActiveWavePerformance(page, label);
  console.log(`Hero Defense V2 active-wave performance ${label}: ${performance.framesPerSecond.toFixed(1)}fps, update p95 ${performance.updateP95.toFixed(3)}ms, render p95 ${performance.renderP95.toFixed(3)}ms`);

  const completed = await page.evaluate(() => globalThis.__heroDefenseV2Debug.stepTicks(4000).snapshot);
  assert.equal(completed.phase, 'INTERMISSION', `${label}: first wave did not reach intermission`);
  assert.equal(completed.nextWave, 2, `${label}: next wave did not advance exactly once`);
  assert.equal(completed.wave.completedCount, 1, `${label}: first wave completion count is not exactly one`);
  assert.equal(completed.crystals, 1, `${label}: first wave reward was not granted exactly once`);

  const afterExtraTicks = await page.evaluate(() => globalThis.__heroDefenseV2Debug.stepTicks(600).snapshot);
  assert.equal(afterExtraTicks.wave.completedCount, 1, `${label}: idle intermission ticks duplicated wave completion`);
  assert.equal(afterExtraTicks.crystals, 1, `${label}: idle intermission ticks duplicated the wave reward`);
}

async function runViewport(browser, baseUrl, viewport, artifactsDirectory) {
  const label = describeViewport(viewport);
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => runtimeErrors.push(`page: ${error.message}`));
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await enterDefaultBattle(page);
    assertBattleLayout(await collectBattleGeometry(page), viewport);
    await clickLegalPlacement(page);
    const screenshotPath = path.join(artifactsDirectory, `battle-${label}.png`);
    await completeFirstWaveAtDoubleSpeed(page, viewport, screenshotPath);
    await verifyHeroSheetInputRecovery(page, viewport, path.join(artifactsDirectory, `hero-sheet-${label}.png`));
    assertBattleLayout(await collectBattleGeometry(page), viewport);
    assert.deepEqual(runtimeErrors, [], `${label}: browser runtime errors: ${runtimeErrors.join('\n')}`);
    console.log(`Hero Defense V2 browser viewport passed: ${label}`);
  } catch (error) {
    const screenshotPath = path.join(artifactsDirectory, `battle-${label}-failed.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

async function run() {
  const artifactsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'hero-defense-v2-browser-'));
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  const browser = await chromium.launch({ headless: true });
  try {
    const failures = [];
    try {
      await runOrientationTransition(browser, `http://127.0.0.1:${port}/`, artifactsDirectory);
    } catch (error) {
      failures.push(`orientation-transition: ${error.message}`);
      console.error(`Hero Defense V2 same-page orientation transition failed\n${error.stack ?? error}`);
    }
    for (const viewport of VIEWPORTS) {
      try {
        await runViewport(browser, `http://127.0.0.1:${port}/`, viewport, artifactsDirectory);
      } catch (error) {
        failures.push(`${describeViewport(viewport)}: ${error.message}`);
        console.error(`Hero Defense V2 browser viewport failed: ${describeViewport(viewport)}\n${error.stack ?? error}`);
      }
    }
    console.log(`Hero Defense V2 browser screenshots: ${artifactsDirectory}`);
    assert.deepEqual(failures, [], `Hero Defense V2 browser viewport failures:\n${failures.join('\n')}`);
    console.log('Hero Defense V2 browser verification passed');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

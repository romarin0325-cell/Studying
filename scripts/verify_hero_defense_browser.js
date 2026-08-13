const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', 'defense_hero');
const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function createServer() {
  return http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const absolute = path.resolve(ROOT, requested);
    if (absolute !== ROOT && !absolute.startsWith(`${ROOT}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(absolute, (error, body) => {
      if (error) {
        response.writeHead(404).end('Not found');
        return;
      }
      response.writeHead(200, { 'content-type': TYPES[path.extname(absolute)] ?? 'application/octet-stream' });
      response.end(body);
    });
  });
}

async function run() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await context.newPage();
  const errors = [];
  const compactText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const normalizedWeights = (value) => Object.fromEntries(
    Object.entries(value ?? {}).sort(([left], [right]) => left.localeCompare(right)),
  );
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const location = message.location();
    const optionalAssetMiss = message.text().includes('Failed to load resource')
      && message.text().includes('404')
      && new URL(location.url || page.url()).pathname.startsWith('/assets/');
    if (!optionalAssetMiss) errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));

  async function spendGrowthShards() {
    for (let choice = 0; choice < 12; choice += 1) {
      const preferredIds = ['rumi_guard_l4', 'gray_delay_l3'];
      let upgrade = page.locator('[data-upgrade]:not([disabled])').first();
      for (const id of preferredIds) {
        const preferred = page.locator(`[data-upgrade="${id}"]:not([disabled])`);
        if (await preferred.count()) {
          upgrade = preferred;
          break;
        }
      }
      if (!(await upgrade.count())) break;
      await upgrade.click();
    }
  }

  async function enterAndResolveStage(stageNumber) {
    console.log(`Hero Defense browser smoke: resolving stage ${stageNumber}`);
    const routes = page.locator('[data-node]');
    await routes.nth(Math.max(0, (await routes.count()) - 1)).click();
    await page.getByRole('button', { name: '배치 시작' }).click();
    await page.getByRole('button', { name: '자동 배치' }).click();
    await page.getByRole('button', { name: '전투 시작' }).click();
    await page.evaluate(() => window.__heroDefenseDebug.setTimeScale(20));
    const deadline = Date.now() + 60000;
    let headingText = [];
    while (Date.now() < deadline) {
      headingText = await page.locator('h1').allTextContents();
      if (headingText.some((text) => text.includes('성장 조각을 배분하세요')
        || text.includes('별빛이 균열을 봉인했습니다')
        || text.includes('전술을 고쳐 다시 도전하세요'))) break;
      const activeButton = page.locator('[data-battle="active"]');
      const cooldown = page.locator('#active-cooldown');
      const cooldownText = await cooldown.textContent({ timeout: 250 }).catch(() => null);
      if (await activeButton.count() && cooldownText?.trim() === 'READY') {
        try {
          await activeButton.click();
          const canvas = page.locator('#battle-canvas');
          const box = await canvas.boundingBox();
          if (box) await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
        } catch {
          // A route transition can detach the controls between the readiness check and the click.
        }
      }
      await page.waitForTimeout(100);
    }
    if (!headingText.some((text) => text.includes('성장 조각을 배분하세요')
      || text.includes('별빛이 균열을 봉인했습니다')
      || text.includes('전술을 고쳐 다시 도전하세요'))) {
      throw new Error(`Stage ${stageNumber} did not finish within 60 seconds.`);
    }
    if (headingText.some((text) => text.includes('전술을 고쳐 다시 도전하세요'))) {
      const debug = await page.evaluate(() => window.__heroDefenseDebug.getState());
      throw new Error(`Stage ${stageNumber} was defeated during the full-run smoke: ${JSON.stringify({
        core: debug.battle?.core,
        stats: debug.run?.stats,
        levels: debug.run?.levels,
        branches: debug.run?.branches,
        doctrines: debug.run?.doctrines,
        relics: debug.run?.relics,
      })}`);
    }
    if (stageNumber === 6) {
      if (!headingText.some((text) => text.includes('별빛이 균열을 봉인했습니다'))) {
        throw new Error(`Stage 6 did not reach the expedition result: ${JSON.stringify(headingText)}`);
      }
      return;
    }
    if (!headingText.some((text) => text.includes('성장 조각을 배분하세요'))) {
      throw new Error(`Stage ${stageNumber} did not reach growth: ${JSON.stringify(headingText)}`);
    }
    await spendGrowthShards();
    await page.locator('[data-action="growth-next"]').click();
    const reward = page.locator('[data-reward]').filter({ hasText: stageNumber === 2 ? '보루 외피' : '왜곡 시계' });
    if (await reward.count()) await reward.first().click();
    else if (await page.locator('[data-reward]').count()) await page.locator('[data-reward]').first().click();
    await page.getByRole('heading', { name: `스테이지 ${stageNumber + 1}의 경로` }).waitFor({ timeout: 10000 });
  }

  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '새 게임' }).click();
    await page.getByRole('button', { name: /원정.*6스테이지/ }).click();
    await page.getByRole('button', { name: '난도와 시드 선택' }).click();
    await page.locator('#seed-input').fill('BROWSER-SMOKE-01');
    await page.locator('[data-blessing="blessing_core_lining"]').click();
    await page.getByRole('button', { name: '원정 생성' }).click();
    const initialMapElementText = compactText(await page.locator('[data-map-element-profile="0"]').textContent());
    await page.getByRole('button', { name: /ROUTE A/ }).click();
    await page.locator('[data-preview-element-profile]').waitFor();
    const initialStageOnePreview = await page.evaluate(() => {
      const state = window.__heroDefenseDebug.getState();
      return {
        seed: state.run?.seed,
        difficultyId: state.run?.difficultyId,
        stageNumber: state.stagePlan?.stageNumber,
        weights: state.stagePlan?.elementProfile?.weights,
        previewWeights: state.stagePlan?.preview?.elementWeights,
      };
    });
    initialStageOnePreview.uiText = compactText(await page.locator('[data-preview-element-profile]').textContent());
    await page.getByRole('button', { name: '배치 시작' }).click();

    await page.getByRole('button', { name: '자동 배치' }).click();
    await page.getByRole('button', { name: '전투 시작' }).click();
    await page.getByRole('button', { name: /액티브/ }).click();
    if ((await page.getByRole('button', { name: '전투 속도' }).textContent()).trim() !== '0.2×') {
      throw new Error('Leader active targeting did not switch to 0.2x.');
    }
    await page.getByRole('button', { name: /액티브/ }).click();

    await page.evaluate(() => {
      window.__heroDefenseSmokeHidden = true;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__heroDefenseSmokeHidden });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const backgroundState = await page.evaluate(() => ({
      paused: window.__heroDefenseDebug.getState().battle?.paused,
      savedPhase: JSON.parse(localStorage.getItem('heroDefenseRun'))?.phase,
    }));
    if (!backgroundState.paused || backgroundState.savedPhase !== 'battle') {
      throw new Error(`Background pause/checkpoint failed: ${JSON.stringify(backgroundState)}`);
    }
    await page.evaluate(() => { window.__heroDefenseSmokeHidden = false; });
    await page.getByRole('button', { name: '일시정지' }).click();

    await page.setViewportSize({ width: 390, height: 844 });
    if (!(await page.locator('#rotate-guard').isVisible())) throw new Error('Portrait battle rotation guard is not visible.');
    if (!(await page.getByRole('button', { name: '전투 시작' }).isDisabled())) throw new Error('Portrait battle start is not locked.');
    await page.setViewportSize({ width: 844, height: 390 });

    const portraitTokens = await page.locator('.unit-token:visible').evaluateAll((tokens) => tokens
      .map((token) => ({ width: token.getBoundingClientRect().width, height: token.getBoundingClientRect().height }))
      .filter((box) => box.width < 56 || box.height < 56));
    if (portraitTokens.length) throw new Error(`Battle portrait below 56px: ${JSON.stringify(portraitTokens[0])}`);

    const tooSmall = await page.locator('button:visible').evaluateAll((buttons) => buttons
      .map((button) => {
        const box = button.getBoundingClientRect();
        return { label: button.getAttribute('aria-label') || button.textContent.trim(), width: box.width, height: box.height };
      })
      .filter((box) => Math.min(box.width, box.height) < 44));
    if (tooSmall.length) throw new Error(`Battle tap target below 44px: ${JSON.stringify(tooSmall[0])}`);

    await page.evaluate(() => window.__heroDefenseDebug.setTimeScale(20));
    await page.getByRole('heading', { name: '성장 조각을 배분하세요' }).waitFor({ timeout: 15000 });
    await spendGrowthShards();
    await page.getByRole('button', { name: '다음 스테이지' }).click();
    await page.getByRole('heading', { name: '스테이지 2의 경로' }).waitFor();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '계속하기' }).click();
    await page.getByRole('heading', { name: '스테이지 2의 경로' }).waitFor();
    await page.goBack();
    await page.getByRole('heading', { name: '다음 작전을 선택하세요' }).waitFor();
    const afterBack = await page.evaluate(() => window.__heroDefenseDebug.getState());
    if (afterBack.run?.stageNumber !== 2 || afterBack.route?.name !== 'hub') {
      throw new Error(`Android Back emulation restored stale expedition content: ${JSON.stringify({ route: afterBack.route, stage: afterBack.run?.stageNumber })}`);
    }
    await page.getByRole('button', { name: '원정 재개' }).click();
    await page.getByRole('heading', { name: '스테이지 2의 경로' }).waitFor();
    for (let stageNumber = 2; stageNumber <= 6; stageNumber += 1) {
      await enterAndResolveStage(stageNumber);
    }
    if (!(await page.getByRole('button', { name: '같은 시드 재도전' }).isVisible())) {
      throw new Error('Same-seed restart is unavailable on the final result screen.');
    }
    if (!(await page.getByRole('button', { name: '시드 복사' }).isVisible())) {
      throw new Error('Full-seed copy is unavailable on the final result screen.');
    }
    const contributionRows = page.locator('[data-character-contribution]');
    if (!(await contributionRows.count())) throw new Error('Per-character strategic contribution rows are missing.');
    const contributionText = compactText(await contributionRows.first().textContent());
    for (const label of ['광역 피해', '공중 피해', '우위 피해', '제어', '상태 부여']) {
      if (!contributionText.includes(label)) throw new Error(`Strategic contribution metric is missing: ${label}`);
    }
    await page.getByRole('button', { name: '같은 시드 재도전' }).click();
    await page.getByRole('heading', { name: '스테이지 1의 경로' }).waitFor();
    const replayRun = await page.evaluate(() => window.__heroDefenseDebug.getState().run);
    if (replayRun?.seed !== initialStageOnePreview.seed
      || replayRun?.difficultyId !== initialStageOnePreview.difficultyId
      || replayRun?.stageNumber !== 1) {
      throw new Error(`Same-seed retry did not recreate stage 1 setup: ${JSON.stringify({
        expected: initialStageOnePreview,
        actual: { seed: replayRun?.seed, difficultyId: replayRun?.difficultyId, stageNumber: replayRun?.stageNumber },
      })}`);
    }
    const replayMapElementText = compactText(await page.locator('[data-map-element-profile="0"]').textContent());
    if (replayMapElementText !== initialMapElementText) {
      throw new Error(`Same-seed map element weights changed: ${JSON.stringify({ initialMapElementText, replayMapElementText })}`);
    }
    await page.getByRole('button', { name: /ROUTE A/ }).click();
    await page.locator('[data-preview-element-profile]').waitFor();
    const replayStageOnePreview = await page.evaluate(() => {
      const state = window.__heroDefenseDebug.getState();
      return {
        stageNumber: state.stagePlan?.stageNumber,
        weights: state.stagePlan?.elementProfile?.weights,
        previewWeights: state.stagePlan?.preview?.elementWeights,
      };
    });
    replayStageOnePreview.uiText = compactText(await page.locator('[data-preview-element-profile]').textContent());
    const initialWeights = normalizedWeights(initialStageOnePreview.weights);
    const replayWeights = normalizedWeights(replayStageOnePreview.weights);
    const initialPreviewWeights = normalizedWeights(initialStageOnePreview.previewWeights);
    const replayPreviewWeights = normalizedWeights(replayStageOnePreview.previewWeights);
    if (replayStageOnePreview.stageNumber !== 1
      || JSON.stringify(replayWeights) !== JSON.stringify(initialWeights)
      || JSON.stringify(replayPreviewWeights) !== JSON.stringify(initialPreviewWeights)
      || replayStageOnePreview.uiText !== initialStageOnePreview.uiText) {
      throw new Error(`Same-seed stage 1 preview weights changed: ${JSON.stringify({
        initial: { weights: initialWeights, previewWeights: initialPreviewWeights, uiText: initialStageOnePreview.uiText },
        replay: { weights: replayWeights, previewWeights: replayPreviewWeights, uiText: replayStageOnePreview.uiText },
      })}`);
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Hero Defense browser smoke passed');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

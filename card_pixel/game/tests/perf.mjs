// Run with the installed Chrome: node card_pixel/game/tests/perf.mjs
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const gameUrl = new URL('../dist/Relaymare.html', import.meta.url);
gameUrl.searchParams.set('seed', '7'); // The last-attack route in play.mjs.
const shots = new URL('./shots/', import.meta.url);
const output = new URL('perf.json', shots);

const cpuRates = [1, 4, 6];
const runsPerRate = 3;
const contextOptions = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  offline: true,
  serviceWorkers: 'block',
};
const launchOptions = { channel: 'chrome', headless: true };
const targets = { titleReadyMs: 3000, frameP95Ms: 34 };
const frameWindowMs = 10_000;
const selectors = {
  title: '#title.on #b-start',
  battle: '#battle.on',
  choice: '#battle.on .opening-choice:not([disabled])',
  choiceLabel: '애쉬로 마지막 공격',
  action: '.act:not([disabled]):not(.opening-choice)',
  result: '#result.on',
  next: '#b-next',
};

function installProbe({ selectors, frameWindowMs }) {
  const longTasks = [];
  const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries()));
  observer.observe({ type: 'longtask', buffered: true });

  const probe = window.__relayPerf = {
    titleReadyMs: null,
    choiceTapMs: null,
    nextInputMs: null,
    frames: [],
    framesDone: false,
    readTitle(jsHeapUsedBytes) {
      const navigation = performance.getEntriesByType('navigation')[0];
      const loadMs = navigation.loadEventEnd;
      const end = Math.max(loadMs, probe.titleReadyMs);
      longTasks.push(...observer.takeRecords());
      observer.disconnect();
      const longTasksTotalMs = longTasks.reduce((total, task) =>
        total + Math.max(0, Math.min(task.duration, end - task.startTime)), 0);
      return {
        titleReadyMs: probe.titleReadyMs,
        domContentLoadedMs: navigation.domContentLoadedEventEnd,
        loadMs,
        longTasksTotalMs,
        jsHeapUsedBytes,
      };
    },
  };

  function visibleEnabled(button) {
    if (!button || button.matches(':disabled, [aria-disabled="true"]')) return false;
    const { width, height } = button.getBoundingClientRect();
    return width > 0 && height > 0 && getComputedStyle(button).visibility === 'visible';
  }

  document.addEventListener('click', event => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const choice = event.target.closest(selectors.choice);
    if (choice?.querySelector('b')?.textContent === selectors.choiceLabel) {
      probe.choiceTapMs = event.timeStamp;
    }
  }, { capture: true });

  let firstBattleFrame;
  let previousFrame;
  function tick(now) {
    if (probe.titleReadyMs === null && visibleEnabled(document.querySelector(selectors.title))) {
      probe.titleReadyMs = performance.now();
    }

    const battle = document.querySelector(selectors.battle);
    if (battle && !probe.framesDone) {
      firstBattleFrame ??= now;
      if (previousFrame !== undefined) probe.frames.push(now - previousFrame);
      previousFrame = now;
      // Keep the interval that crosses the cutoff so a stall there counts.
      probe.framesDone = now - firstBattleFrame >= frameWindowMs;
    }

    if (battle && probe.choiceTapMs !== null && probe.nextInputMs === null && !window.__game?.busy) {
      const result = battle.querySelector(selectors.result);
      const next = result ? result.querySelector(selectors.next) : battle.querySelector(selectors.action);
      if (visibleEnabled(next)) probe.nextInputMs = performance.now() - probe.choiceTapMs;
    }

    if (!probe.framesDone || probe.nextInputMs === null) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function summarizeFrames(frames) {
  const sorted = [...frames].sort((a, b) => a - b);
  return {
    frameCount: sorted.length,
    frameMeanMs: sorted.reduce((sum, frame) => sum + frame, 0) / sorted.length,
    frameP95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    framesOver34Pct: 100 * sorted.filter(frame => frame > targets.frameP95Ms).length / sorted.length,
  };
}

async function measureRun(browser, rate, run) {
  const context = await browser.newContext(contextOptions);
  try {
    await context.route(/^(?!file:|data:)/i, route => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await page.addInitScript(installProbe, { selectors, frameWindowMs });

    await page.goto(gameUrl.href, { waitUntil: 'load' });
    const { usedSize } = await cdp.send('Runtime.getHeapUsage');
    await page.waitForFunction(() => window.__relayPerf.titleReadyMs !== null, null, { polling: 100 });
    run.title = await page.evaluate(bytes => window.__relayPerf.readTitle(bytes), usedSize);

    await page.locator(selectors.title).tap();
    await page.locator(selectors.choice)
      .filter({ has: page.getByText(selectors.choiceLabel, { exact: true }) }).tap();

    await page.waitForFunction(() => {
      const { framesDone, nextInputMs } = window.__relayPerf;
      return framesDone && nextInputMs !== null;
    }, null, { polling: 250 });
    const { frames, nextInputMs } = await page.evaluate(() => {
      const { frames, nextInputMs } = window.__relayPerf;
      return { frames, nextInputMs };
    });
    run.battle = { ...summarizeFrames(frames), choiceToNextInputMs: nextInputMs };
  } finally {
    await context.close();
  }
}

function medianMetrics(runs, phase) {
  const samples = runs.map(run => run[phase]).filter(Boolean);
  if (samples.length !== runsPerRate) return null;
  return Object.fromEntries(Object.keys(samples[0]).map(metric => {
    const values = samples.map(sample => sample[metric]).sort((a, b) => a - b);
    return [metric, values[Math.floor(values.length / 2)]];
  }));
}

function targetStatus(value, limit) {
  if (value == null) return 'UNMEASURED';
  return value <= limit ? 'PASS' : 'FAIL';
}

function reportRate({ cpuRate, runs }) {
  const title = medianMetrics(runs, 'title');
  const battle = medianMetrics(runs, 'battle');
  const targetResults = {
    title: targetStatus(title?.titleReadyMs, targets.titleReadyMs),
    frameP95: targetStatus(battle?.frameP95Ms, targets.frameP95Ms),
  };
  const format = value => value?.toFixed(2) ?? '—';

  console.log(`\nCPU ${cpuRate}× · medians of ${runsPerRate} cold runs`);
  console.table([
    { metric: 'Title ready (ms)', median: format(title?.titleReadyMs), target: targetResults.title },
    { metric: 'DOMContentLoaded (ms)', median: format(title?.domContentLoadedMs) },
    { metric: 'Load (ms)', median: format(title?.loadMs) },
    { metric: 'Startup long tasks (ms)', median: format(title?.longTasksTotalMs) },
    { metric: 'JS heap after load (MiB)', median: format(title && title.jsHeapUsedBytes / 2 ** 20) },
    { metric: 'Battle frame mean (ms)', median: format(battle?.frameMeanMs) },
    { metric: 'Battle frame p95 (ms)', median: format(battle?.frameP95Ms), target: targetResults.frameP95 },
    { metric: 'Battle frames above 34 ms (%)', median: format(battle?.framesOver34Pct) },
    { metric: 'Choice to next input (ms)', median: format(battle?.choiceToNextInputMs) },
  ]);
  return { cpuRate, runs, median: { title, battle }, targetResults };
}

async function main() {
  const results = cpuRates.map(cpuRate => ({ cpuRate, runs: [] }));
  const report = { seed: 7, launchOptions, contextOptions, runsPerRate, frameWindowMs, targets };
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch(launchOptions);
    report.chromeVersion = browser.version();
    for (const { cpuRate, runs } of results) {
      for (let index = 1; index <= runsPerRate; index++) {
        const run = { run: index };
        runs.push(run);
        console.log(`CPU ${cpuRate}× · run ${index}/${runsPerRate}`);
        try {
          await measureRun(browser, cpuRate, run);
        } catch (error) {
          run.error = String(error);
          console.error(run.error);
        }
      }
    }
  } catch (error) {
    report.error = String(error);
    console.error(report.error);
  } finally {
    await browser?.close().catch(error => {
      report.closeError = String(error);
      console.error(report.closeError);
    });
  }

  report.rates = results.map(reportRate);
  await fs.mkdir(shots, { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`\nSaved ${fileURLToPath(output)}`);
}

// Report errors and misses without making this benchmark an exit-code gate.
try {
  await main();
} catch (error) {
  console.error(error);
}

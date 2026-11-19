// Real-time play-through of the relay trial in a real browser: plays whole expeditions with a
// simple player, measures how long the player waits after each action and the frame pacing,
// takes screenshots of the key moments, and fails on any browser error or stuck state.
// Run: node card_pixel/game/tests/play.mjs [--seeds=7,21,99] [--headed] [--webkit]
// First version written by GPT Terra (2026-11-16); flow rewritten for the expedition (2026-11-18).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { chromium, webkit } from 'playwright';

const game = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(game, '../..');
const shots = path.join(game, 'tests', 'shots');
const seedArg = process.argv.find(arg => arg.startsWith('--seeds='));
const seeds = seedArg ? seedArg.slice(8).split(',').map(Number) : [7, 21, 99];
if (!seeds.length || seeds.some(n => !Number.isSafeInteger(n) || n <= 0)) throw new Error('Seeds must be positive integers: --seeds=1,2,3');
const isWebkit = process.argv.includes('--webkit');
execFileSync(process.execPath, [path.join(game, 'build.mjs')], { cwd: repo, stdio: 'inherit' });
await fs.mkdir(shots, { recursive: true });

const launchOptions = { headless: !process.argv.includes('--headed') };
async function launch() {
  if (isWebkit) return webkit.launch(launchOptions);
  if (process.env.CHROMIUM_PATH) return chromium.launch({ ...launchOptions, executablePath: process.env.CHROMIUM_PATH });
  try {
    return await chromium.launch(launchOptions);
  } catch (error) {
    // This machine has no Playwright browser download: fall back to an installed Chrome or Edge.
    for (const channel of ['chrome', 'msedge']) {
      try { const b = await chromium.launch({ ...launchOptions, channel }); console.log(`Using the installed browser: ${channel}`); return b; } catch { /* next */ }
    }
    throw error;
  }
}
let browser;
try { browser = await launch(); } catch (error) {
  if (isWebkit && /executable doesn't exist|not installed/i.test(error.message)) { console.log('WebKit is not installed; skipping.'); process.exit(0); }
  console.error(`Browser launch failed: ${error.message}`); process.exit(1);
}

const LABELS = ['01-awaken', '02-map', '03-order', '04-first-turn', '05-big-move', '06-heirloom', '07-last-stand', '08-result',
  '09-spring', '10-altar', '11-gate-pick', '12-boss', '13-end'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (values, p) => { if (!values.length) return '-'; const s = [...values].sort((a, b) => a - b); return Math.round(s[Math.ceil(s.length * p) - 1]); };
const results = [];

/* Reads the page and decides the next tap. Runs in the page. */
function look() {
  const s = window.__slice, screen = document.querySelector('.screen.on')?.id, run = s.run;
  const result = !!document.querySelector('#result.on');
  const ready = screen === 'battle' && !result && !s.busy && !!document.querySelector('.act:not([disabled])');
  let tap = null;
  if (ready) {
    const b = s.B.bridge, st = b.state(), me = st.allies[st.cur], intent = s.B.intent || {};
    const usable = b.options().filter(o => o.usable);
    const buff = (o, ids) => o.effects.some(e => e.type === 'buff' && ids.includes(e.id));
    const incoming = intent.dmg ? intent.dmg[1] : 0;
    const kill = usable.filter(o => o.preview && o.preview.kill).sort((x, y) => x.cost - y.cost)[0];
    const exact = usable.find(o => (intent.kind === 'phy' && buff(o, ['barrier'])) || (intent.kind === 'mag' && buff(o, ['magic_guard'])));
    const half = usable.find(o => buff(o, ['guard', 'damage_half']));
    const best = usable.filter(o => o.preview && o.preview.dmg > 0).sort((x, y) => y.preview.dmg - x.preview.dmg)[0];
    let pick = kill || (incoming > 0 && exact && intent.name !== '일반 공격' ? exact : null) ||
      (incoming > 0 && half && !me.buffs.damage_half && (intent.ult || incoming >= me.maxHp / 3 || incoming >= me.hp) ? half : null) || best || usable[0];
    if (!kill && (intent.lethal || incoming >= me.hp) && !exact && b.canRetreat()) tap = { retreat: true };
    else tap = pick.heirloom ? { sel: '#b-heir' } : { sel: `.act[data-i="${pick.index}"]` };
  } else if (result) tap = { sel: '#b-next' };
  else if (screen === 'awaken') {
    if (document.querySelector('#b-depart:not([disabled])')) tap = { sel: '#b-depart' };
    else if (document.querySelector('#b-wake:not([disabled])')) tap = { sel: '#b-wake' };
    else if (document.querySelector('#awaken .cardrow') && !document.querySelector('#b-depart')) tap = { sel: '#awaken .cardrow' };
  } else if (screen === 'map') {
    const doors = run.doors, idx = doors.findIndex(d => d.type === 'spring' && run.crystals >= 3);
    const alt = doors.findIndex(d => d.type === 'altar' && run.floor !== 2);
    const fight = doors.findIndex(d => d.enemies.length);
    tap = { sel: `#map .door[data-i="${idx >= 0 ? idx : alt >= 0 && run.floor === 6 ? alt : fight >= 0 ? fight : 0}"]` };
  } else if (screen === 'order') tap = { sel: '#b-go' };
  else if (screen === 'spring') {
    if (document.querySelector('#spring #b-take')) tap = document.querySelector('#spring #b-take:not([disabled])') ? { sel: '#spring #b-take' } : { sel: '#spring .cardrow' };
    else if (document.querySelector('#b-pick:not([disabled])')) tap = { sel: '#b-pick' };
    else if (document.querySelector('#b-draw:not([disabled])') && run.bench.length < 5) tap = { sel: '#b-draw' };
    else tap = { sel: '#b-leave' };
  } else if (screen === 'altar') {
    tap = document.querySelector('#b-keep:not([disabled])') ? { sel: '#b-keep' } : document.querySelector('#b-roll:not([disabled])') ? { sel: '#b-roll' } : null;
  } else if (screen === 'pick') tap = document.querySelector('#b-gate-take:not([disabled])') ? { sel: '#b-gate-take' } : { sel: '#pick .cardrow' };
  const banner = [...document.querySelectorAll('.banner')].map(b => b.textContent).join(' ');
  return {
    screen, ready, result, busy: s.busy, floor: run ? run.floor : 0, turn: s.B.bridge ? s.B.bridge.state().turn : 0, tap,
    end: document.querySelector('#end header b')?.textContent,
    flags: {
      '01-awaken': screen === 'awaken', '02-map': screen === 'map', '03-order': screen === 'order', '04-first-turn': ready,
      '05-big-move': !!document.querySelector('.skillplate'), '06-heirloom': /유품/.test(banner), '07-last-stand': /최후의 일인/.test(banner),
      '08-result': result, '09-spring': screen === 'spring', '10-altar': screen === 'altar', '11-gate-pick': screen === 'pick',
      '12-boss': ready && run && run.floor === 7, '13-end': screen === 'end'
    }
  };
}

async function play(seed, capture) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [], taken = new Set(), waits = [];
  let retreats = 0, started = 0, pending = null, failure = null, end = null, lastFloor = 0;
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));
  await page.addInitScript(() => {
    window.__frames = []; let prev;
    const tick = t => { if (prev !== undefined && document.querySelector('#battle.on')) window.__frames.push(t - prev); prev = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const shot = async label => { if (!capture || taken.has(label)) return; taken.add(label); await page.screenshot({ path: path.join(shots, `${seed}-${label}.png`) }); };
  try {
    const url = new URL(pathToFileURL(path.join(game, 'dist', 'Relaymare.html')).href);
    url.searchParams.set('seed', seed);
    await page.goto(url.href);
    await page.waitForFunction(() => !!window.__slice);
    started = performance.now();
    await page.click('#b-start');
    let lastProgress = performance.now(), prevKey = '';
    for (;;) {
      const s = await page.evaluate(look);
      const now = performance.now();
      lastFloor = s.floor || lastFloor;
      const key = s.screen + ':' + s.floor + ':' + s.turn + ':' + s.busy + ':' + s.result;
      if (key !== prevKey) { lastProgress = now; prevKey = key; }
      if (pending && (s.screen !== 'battle' || s.ready || s.result)) { waits.push(now - pending); pending = null; }
      for (const label of LABELS) if (s.flags[label]) await shot(label);
      if (s.screen === 'end') { end = s.end; break; }
      if (s.tap) {
        lastProgress = performance.now();
        if (s.tap.retreat) {
          if (retreats) { await page.click('.act[data-i="0"]'); }
          else { await page.click('#b-retreat'); await page.click('#b-retreat'); retreats++; }
          pending = performance.now();
        } else if (await page.$(s.tap.sel)) {
          await page.click(s.tap.sel);
          if (s.ready) pending = performance.now();
        }
      } else if (now - lastProgress >= 25000) {
        await page.screenshot({ path: path.join(shots, `stuck-${seed}.png`) });
        const log = await page.evaluate(() => window.__slice.B.log.slice(-12));
        throw new Error(`Stuck for 25 s on ${s.screen} (busy=${s.busy}); log:\n${log.join('\n')}`);
      }
      await sleep(40);
    }
  } catch (error) { failure = error.stack || String(error); }
  const elapsed = started ? (performance.now() - started) / 1000 : 0;
  const frames = await page.evaluate(() => window.__frames || []).catch(() => []);
  const runInfo = await page.evaluate(() => { const r = window.__slice.run; return r ? { floor: r.floor, stats: r.stats, fallen: r.fallen.length, result: r.result } : null; }).catch(() => null);
  const mean = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0;
  console.log(`\nSeed ${seed}: ${end || 'FAILED'} · floor ${runInfo ? runInfo.floor : lastFloor} · ${elapsed.toFixed(0)} s · battles ${runInfo ? runInfo.stats.battles : '-'} · best hit ${runInfo ? runInfo.stats.best : '-'} · heirlooms used ${runInfo ? runInfo.stats.heirloomsUsed : '-'} · last stands ${runInfo ? runInfo.stats.lastStands : '-'} · retreats ${retreats}`);
  console.log(`  wait after an action: median ${percentile(waits, 0.5)} ms, p90 ${percentile(waits, 0.9)} ms, max ${percentile(waits, 1)} ms (${waits.length} actions)`);
  console.log(`  frames ${frames.length}, mean ${mean.toFixed(1)} ms, >20 ms ${(100 * frames.filter(n => n > 20).length / (frames.length || 1)).toFixed(2)}%, >34 ms ${(100 * frames.filter(n => n > 34).length / (frames.length || 1)).toFixed(2)}%, worst ${frames.reduce((m, n) => Math.max(m, n), 0).toFixed(0)} ms`);
  if (capture) console.log(`  missed screenshots: ${LABELS.filter(l => !taken.has(l)).join(', ') || 'none'}`);
  if (errors.length) console.log(errors.join('\n'));
  if (failure) console.log(failure);
  await context.close();
  return { seed, end, errors, failure };
}

try { for (let i = 0; i < seeds.length; i++) results.push(await play(seeds[i], i === 0)); } finally { await browser.close(); }
console.log('\nSummary');
for (const r of results) console.log(`${r.seed}: ${r.end || 'failed'}, ${r.errors.length} browser error(s)${r.failure ? ', FAILED' : ''}`);
if (results.some(r => !r.end || r.failure || r.errors.length)) process.exitCode = 1;

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// A focused comparison of the three shipped bundles, served byte-for-byte on
// loopback because managed Chromium may prohibit file:// navigation.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'test-results/card-uis');
await fs.mkdir(output, { recursive: true });
const editions = [
  { name: 'legacy', file: 'card_legacy/dist/DREAMWEAVER-Legacy.html' },
  { name: 'astra', file: 'card_astra/dist/DREAMWEAVER-Astra.html' },
  { name: 'lumen', file: 'card_lumen/dist/DREAMWEAVER-Lumen.html' }
];
const bundles = new Map();
for (const edition of editions) {
  const html = await fs.readFile(path.join(root, edition.file), 'utf8');
  assert.equal(/<script[^>]+src=|<link[^>]+stylesheet|fonts\.googleapis|\{\{[A-Z_]+\}\}/.test(html), false, `${edition.name}: standalone code and styles`);
  bundles.set(`/${edition.name}`, html);
}
const server = http.createServer((req, res) => {
  const html = bundles.get(req.url);
  if (!html) { res.writeHead(404).end(); return; }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const errors = [];
const external = [];
const reports = [];
let dataCounts;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function ready(page, edition) {
  await page.waitForFunction(name => {
    if (typeof RPG === 'undefined' || !RPG._featuresInstalled || typeof CardProgressTransfer === 'undefined') return false;
    if (name === 'lumen') return typeof LumenUI !== 'undefined' && LumenUI.ready;
    if (name === 'astra' && !(typeof AstraEdition !== 'undefined' && AstraEdition.ready)) return false;
    return typeof CardChainChallenge !== 'undefined' && !!document.getElementById('cc-chain-gacha');
  }, edition.name);
  await page.evaluate(() => document.fonts.ready);
}
async function open(edition, viewport = { width: 360, height: 640 }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', acceptDownloads: true });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (/^https?:/.test(url) && !url.startsWith(`${origin}/`)) { external.push(url); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${edition.name}: ${error.message}`));
  await page.goto(`${origin}/${edition.name}`);
  await ready(page, edition);
  return page;
}
async function seed(page, extra = {}) {
  await page.evaluate(extra => {
    RPG.loadGlobalData();
    Object.assign(RPG.state, {
      mode: 'origin', gameType: 'endless', tickets: 20, enemyScale: 0,
      deck: ['marshmallow', 'kobold', 'golem'],
      inventory: ['marshmallow', 'kobold', 'golem', 'luna'], quiz_stats: { correct: 7, total: 9 }
    }, extra);
    document.querySelectorAll('.modal.active').forEach(el => el.classList.remove('active'));
    RPG.toMenu();
  }, extra);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(output, `${name}.png`) });
}
async function reachable(page, selector, { scroll = true } = {}) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible' });
  if (scroll) await locator.scrollIntoViewIfNeeded();
  const bounds = await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight,
      uncovered: el.contains(document.elementFromPoint(x, y)) };
  });
  assert.ok(bounds.left >= -1 && bounds.top >= -1 && bounds.right <= bounds.width + 1 && bounds.bottom <= bounds.height + 1 && bounds.uncovered,
    `${selector}: reachable ${JSON.stringify(bounds)}`);
}
async function noHorizontalOverflow(page, selector) {
  const geometry = await page.locator(selector).first().evaluate(el => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, viewport: innerWidth, content: el.scrollWidth, client: el.clientWidth };
  });
  assert.ok(geometry.left >= -1 && geometry.right <= geometry.viewport + 1 && geometry.content <= geometry.client + 1,
    `${selector}: no horizontal clipping ${JSON.stringify(geometry)}`);
}
async function fullscreen(page) {
  await reachable(page, '#btn-game-fullscreen', { scroll: false });
  const box = await page.locator('#btn-game-fullscreen').boundingBox();
  assert.ok(box.y <= 30 && box.x + box.width >= page.viewportSize().width - 30, `fullscreen is upper right: ${JSON.stringify(box)}`);
  const supported = await page.evaluate(() => RPG.canUseGameFullscreen());
  if (supported) {
    await page.locator('#btn-game-fullscreen').click();
    await page.waitForFunction(() => !!document.fullscreenElement);
    await page.waitForFunction(() => document.getElementById('btn-game-fullscreen').getAttribute('aria-pressed') === 'true');
    assert.equal(await page.locator('#btn-game-fullscreen').getAttribute('aria-pressed'), 'true');
    await page.locator('#btn-game-fullscreen').click();
    await page.waitForFunction(() => !document.fullscreenElement);
  }
  return supported ? 'enter/exit verified' : 'browser API unavailable';
}
async function quizProbe(page) {
  await page.evaluate(() => {
    window.__uiQuiz = null;
    const show = QuizEngine.show.bind(QuizEngine);
    QuizEngine.show = config => {
      window.__uiQuiz = { correct: config.answer, options: config.options, seq: (window.__uiQuiz?.seq || 0) + 1 };
      return show(config);
    };
  });
}
async function answer(page, seq, correct) {
  await page.waitForFunction(seq => window.__uiQuiz?.seq === seq, seq);
  await reachable(page, '#quiz-options .menu-btn:last-child');
  const pick = await page.evaluate(correct => correct ? window.__uiQuiz.correct : window.__uiQuiz.options.find(value => value !== window.__uiQuiz.correct), correct);
  await page.locator('#quiz-options .menu-btn').getByText(pick, { exact: true }).click();
}
async function chain(page, edition) {
  const button = edition.name === 'lumen' ? '#lm-chain-gacha' : '#cc-chain-gacha';
  const stop = edition.name === 'lumen' ? '#lm-chain button' : '#cc-chain button';
  await seed(page, { tickets: 3, inventory: ['luna'] });
  await quizProbe(page);
  await reachable(page, button);
  await page.locator(button).click();
  await reachable(page, stop);
  await answer(page, 1, true);
  await answer(page, 2, false);
  await answer(page, 3, true);
  await page.locator('#modal-gacha.active').waitFor();
  assert.deepEqual(await page.evaluate(() => ({ tickets: RPG.state.tickets, owned: RPG.state.inventory.length })), { tickets: 0, owned: 3 }, 'Three paid quizzes award exactly two cards');
  assert.equal(await page.locator(edition.name === 'lumen' ? '.lm-batch-card' : '.cc-result-card').count(), 2, 'Both awarded cards appear in the result');
  await noHorizontalOverflow(page, '#modal-gacha .modal-content');
  await reachable(page, '#modal-gacha button');
  await shot(page, `${edition.name}-chain-result-360`);
  await seed(page, { tickets: 5, inventory: ['luna'] });
  // The existing probe remains installed, so subsequent quiz sequence starts at 4.
  await page.locator(button).scrollIntoViewIfNeeded();
  await page.locator(button).click();
  await answer(page, 4, true);
  await page.waitForFunction(() => window.__uiQuiz?.seq === 5);
  await page.locator(stop).click();
  await answer(page, 5, true);
  await page.locator('#modal-gacha.active').waitFor();
  assert.deepEqual(await page.evaluate(() => ({ tickets: RPG.state.tickets, owned: RPG.state.inventory.length })), { tickets: 3, owned: 3 }, 'Stop finishes only the current paid quiz');
  for (const mode of ['puzzle', 'draft', 'chaos']) {
    await seed(page, { mode, tickets: 20 });
    assert.equal(await page.locator(button).isVisible(), false, `${mode}: no ordinary chain action`);
  }
}
async function autoPlacement(page, edition) {
  await seed(page, { deck: [null, null, null] });
  await page.evaluate(() => RPG.openDeck());
  for (const [index, id] of ['marshmallow', 'kobold', 'golem'].entries()) {
    assert.equal(await page.evaluate(() => RPG.selectedSlot), index);
    const name = await page.evaluate(id => RPG.getCardData(id).name, id);
    await page.locator('#deck-card-list .card-item').filter({ hasText: name }).first().click();
    assert.equal(await page.evaluate(index => RPG.state.deck[index], index), id);
  }
  assert.deepEqual(await page.evaluate(() => RPG.state.deck), ['marshmallow', 'kobold', 'golem']);
  await page.locator('#slot-1').click();
  const name = await page.evaluate(() => RPG.getCardData('luna').name);
  await page.locator('#deck-card-list .card-item').filter({ hasText: name }).first().click();
  assert.deepEqual(await page.evaluate(() => ({ deck: RPG.state.deck, selected: RPG.selectedSlot })),
    { deck: ['marshmallow', 'luna', 'golem'], selected: 1 }, `${edition.name}: replacement preserves selected slot`);
}
async function mobileSurfaces(page, edition, viewport) {
  await page.setViewportSize(viewport);
  await seed(page);
  await fullscreen(page);
  if (edition.name === 'lumen') {
    await reachable(page, '#lm-foe');
    await reachable(page, '.lm-foe-route');
  }
  await shot(page, `${edition.name}-lobby-${viewport.width}x${viewport.height}`);
  await page.evaluate(() => RPG.openMissionHub());
  await noHorizontalOverflow(page, '#modal-mission-hub .modal-content');
  await reachable(page, '#modal-mission-hub button:last-child');
  await page.evaluate(() => { RPG.closeMissionHub(); RPG.openMonthlyMission(); });
  await noHorizontalOverflow(page, '#modal-monthly-mission .modal-content');
  await reachable(page, '#modal-monthly-mission .modal-content > button:last-child');
  await shot(page, `${edition.name}-missions-${viewport.width}x${viewport.height}`);
  await page.evaluate(() => { RPG.closeMissionView(); RPG.openCardPoolEditor('sets'); });
  await noHorizontalOverflow(page, '#modal-bonus-pool-editor .modal-content');
  await reachable(page, '#card-pool-editor-save', { scroll: false });
  await reachable(page, '#card-pool-editor-close', { scroll: false });
  await shot(page, `${edition.name}-sets-${viewport.width}x${viewport.height}`);
  await seed(page);
  await page.evaluate(() => RPG.startBattleInit());
  await page.waitForFunction(() => RPG.battle.phase === 'player-ready');
  assert.equal(await page.locator('#battle-controls .skill-btn').count(), 4);
  for (let index = 0; index < 4; index++) await reachable(page, `#battle-controls .skill-btn:nth-child(${index + 1})`);
  await fullscreen(page);
  await shot(page, `${edition.name}-battle-${viewport.width}x${viewport.height}`);
}

try {
  let signature;
  let payload;
  for (const edition of editions) {
    const page = await open(edition);
    const current = await page.evaluate(() => ({ cards: GameUtils.getAllCards(), vocab: VOCAB_DATA, collocations: COLLOCATION_DATA,
      grammar: GRAMMAR_DATA, toeic: TOEIC_DATA, listening: LISTENING_DATA, rates: GACHA_RATES, keys: Storage.keys }));
    if (signature) assert.equal(hash(current), signature, `${edition.name}: identical current rules/data/storage contracts`);
    else signature = hash(current);
    dataCounts ||= { cards: current.cards.length, uniqueCards: new Set(current.cards.map(card => card.id)).size,
      vocabulary: current.vocab.length, collocations: current.collocations.length, grammar: current.grammar.length,
      toeic: current.toeic.length, listening: current.listening.length };
    if (!payload) {
      await seed(page, { enemyScale: 4, tickets: 13 });
      await page.evaluate(() => {
        RPG.global.unlocked_bonus_cards = [BONUS_CARDS[0].id];
        RPG.saveGlobalData();
        RPG.saveGame(false);
        Storage.save(Storage.keys.VOCAB, ['comparison-word']);
        Storage.save(Storage.keys.COLLOCATION, ['comparison-collocation']);
        Storage.save(Storage.keys.RECORDS, [{ mode: 'origin', result: 'win', stage: 5 }]);
        ModeRecords.update({ modeId: 'origin', gameType: 'endless', reachedStage: 5 });
        localStorage.setItem(Storage.keys.API_KEY, 'test-secret-must-never-export');
      });
      const downloaded = page.waitForEvent('download');
      await page.evaluate(() => CardProgressTransfer.exportSave(() => {}));
      const download = await downloaded;
      const bytes = await fs.readFile(await download.path());
      payload = JSON.parse(bytes.toString('utf8'));
      assert.equal(Object.hasOwn(payload.values, current.keys.API_KEY), false);
      assert.equal(bytes.includes(Buffer.from('test-secret-must-never-export')), false);
      // Keep the actual downloaded file available for manual cross-UI comparison.
      await fs.writeFile(path.join(output, 'comparison-progress.json'), bytes);
      reports.push('Legacy exports the saved journey, unlocks, learning and mode records; API key omitted');
    }
    // Import via the shared implementation, including the real confirmation and reload.
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem(Storage.keys.API_KEY, 'recipient-private-key'); });
    await page.evaluate(async payload => {
      await CardProgressTransfer.importFile(new File([JSON.stringify(payload)], 'comparison-progress.json', { type: 'application/json' }), {
        notify: message => { throw new Error(message); }
      });
    }, payload);
    await reachable(page, '#confirm-yes');
    await Promise.all([page.waitForNavigation(), page.locator('#confirm-yes').click()]);
    await ready(page, edition);
    const imported = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(payload.values));
    for (const [key, value] of Object.entries(payload.values)) assert.deepEqual(key === current.keys.FORTUNE_LAST_USED ? imported[key] : JSON.parse(imported[key]), value, `${edition.name}: ${key} round trip`);
    assert.equal(await page.evaluate(() => localStorage.getItem(Storage.keys.API_KEY)), 'recipient-private-key');
    await page.evaluate(() => {
      document.querySelectorAll('.modal.active').forEach(el => el.classList.remove('active'));
      RPG.startGame('load');
    });
    assert.deepEqual(await page.evaluate(() => ({ stage: RPG.state.enemyScale, tickets: RPG.state.tickets, stats: RPG.state.quiz_stats })),
      { stage: 4, tickets: 13, stats: { correct: 7, total: 9 } }, `${edition.name}: imported journey continues`);
    reports.push(`${edition.name}: imports and resumes the same saved progress`);
    await chain(page, edition);
    reports.push(`${edition.name}: correct/wrong chain costs, reward count, stop and mode guards`);
    if (edition.name !== 'lumen') {
      await autoPlacement(page, edition);
      reports.push(`${edition.name}: three empty slots auto-advance; occupied replacement retains selection`);
    }
    for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }]) await mobileSurfaces(page, edition, viewport);
    reports.push(`${edition.name}: 320×568, 360×640 and 390×844 missions, sets, battle skills and upper-right fullscreen enter/exit`);
    await page.context().close();
  }
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  assert.deepEqual(external, [], 'No remote UI dependencies');
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify({ transport: 'loopback HTTP serving the exact standalone HTML; file:// blocked by managed Chromium policy', dataCounts, dataSignature: signature, reports, errors, external }, null, 2));
  console.log(`PASS three Card UIs (loopback HTTP): ${reports.join('; ')}`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

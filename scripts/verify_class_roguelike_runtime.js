'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const gameUrl = pathToFileURL(path.join(root, 'class_roguelike', 'index.html')).href;

function savedRun(overrides) {
  return {
    version: 1,
    started: true,
    runId: 'runtime-test',
    level: 1,
    xp: 0,
    selectedClasses: [{ id: 'paladin', acquiredAt: 1 }],
    initialClassChoices: null,
    pendingClassChoices: null,
    inventory: [],
    equipment: { weapon: null, armor: null },
    clearedDungeons: [],
    battlesWon: 0,
    highestDamage: 0,
    battle: null,
    lastSavedAt: 0,
    ...overrides
  };
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth
  }));
  assert.ok(
    metrics.scrollWidth <= metrics.viewport + 1,
    `${label} overflows horizontally (${metrics.scrollWidth} > ${metrics.viewport})`
  );
}

async function assertReachable(locator, label) {
  await locator.waitFor({ state: 'visible' });
  await locator.scrollIntoViewIfNeeded();
  const geometry = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      disabled: element.matches(':disabled'),
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      width: rect.width
    };
  });
  assert.equal(geometry.disabled, false, `${label} must be enabled`);
  assert.ok(geometry.width > 0 && geometry.height > 0, `${label} must have a rendered hit target`);
  assert.ok(
    geometry.left >= -1 &&
      geometry.top >= -1 &&
      geometry.right <= geometry.viewportWidth + 1 &&
      geometry.bottom <= geometry.viewportHeight + 1,
    `${label} must fit inside the viewport (${JSON.stringify(geometry)})`
  );
  await locator.click({ trial: true });
}

async function assertFocusInsideModal(page, label) {
  await page.waitForFunction(() => {
    const panel = document.querySelector('[data-modal-panel]');
    return panel && panel.contains(document.activeElement);
  });
  const focusState = await page.evaluate(() => ({
    action: document.activeElement?.dataset?.action || '',
    tagName: document.activeElement?.tagName || ''
  }));
  assert.ok(focusState.tagName, `${label} must move focus into its panel`);
}

async function assertFocusRestored(page, action, label) {
  await page.waitForFunction(
    (expectedAction) => document.activeElement?.dataset?.action === expectedAction,
    action
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.dataset?.action),
    action,
    `${label} must restore focus to its invoking button`
  );
}

let browser;

(async () => {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  const externalRequests = [];
  const consoleErrors = [];

  page.on('request', (request) => {
    if (/^https?:/i.test(request.url())) externalRequests.push(request.url());
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(gameUrl, { waitUntil: 'load' });
  assert.equal(await page.locator('#game-title').textContent(), '삼중운명 꿈의 잔향');
  await assertNoHorizontalOverflow(page, 'title screen');

  await page.locator('[data-action="new-run"]').click();
  assert.equal(await page.locator('[data-action="select-class"]').count(), 6);
  await page.locator('[data-action="select-class"]').first().click();
  await page.locator('[data-action="confirm-class"]').click();
  await page.locator('.bottom-nav').waitFor();
  await assertNoHorizontalOverflow(page, 'dungeon hub');

  await page.locator('[data-action="open-dungeon"][data-dungeon-id="dungeon_1"]').click();
  await page.locator('[data-action="enter-dungeon"]').click();
  await page.locator('.battle-screen').waitFor();
  assert.equal(await page.locator('.combatant.player').count(), 1, 'battle must have exactly one player');
  assert.equal(await page.locator('.combatant.enemy').count(), 1, 'battle must have exactly one active enemy');
  const imageState = await page.locator('.combatant-art').evaluateAll((images) => images.map((image) => ({
    src: image.getAttribute('src'),
    complete: image.complete,
    naturalWidth: image.naturalWidth
  })));
  assert.equal(imageState.length, 2);
  imageState.forEach((image) => {
    assert.ok(image.src.startsWith('data:image/png;base64,'), 'combat image must be embedded as a PNG data URI');
    assert.equal(image.complete, true, 'embedded combat image should finish loading');
    assert.ok(image.naturalWidth > 0, 'embedded combat image should decode');
  });
  const initialBattle = await page.evaluate(() => window.__TRINITY_TEST__.getState().battle);
  assert.equal(initialBattle.phase, 'player');
  assert.equal(initialBattle.turn, 1);
  assert.equal(initialBattle.player.mana, 50, 'first action starts at 50 MP without an early regen tick');
  assert.match(
    await page.locator('[data-action="open-skills"]').textContent(),
    /1개 사용 가능/,
    'a level-1 class must begin with its first skill'
  );
  assert.equal(await page.evaluate(() => window.__TRINITY_TEST__.getDungeonXpReward('dungeon_1')), 114);
  assert.equal(await page.evaluate(() => window.__TRINITY_TEST__.getDungeonXpReward('dungeon_10')), 4260);
  await assertNoHorizontalOverflow(page, 'battle screen');

  await page.locator('[data-action="basic-attack"]').click();
  await page.waitForFunction(() => {
    const battle = window.__TRINITY_TEST__.getState().battle;
    return battle && (battle.turn >= 2 || battle.result);
  });
  const actedBattle = await page.evaluate(() => window.__TRINITY_TEST__.getState().battle);
  assert.match(actedBattle.log[1].text, /기본 공격/, 'player action must be logged before the enemy action');
  assert.ok(
    actedBattle.log.some((entry) => /검은 발톱|심연의 파동|마왕의 일격|심연 마법|회피/.test(entry.text)),
    'enemy must take one follow-up action when still alive'
  );

  await page.locator('[data-action="open-flee"]').click();
  await page.locator('[data-action="confirm-flee"]').click();
  await page.locator('.bottom-nav').waitFor();

  const additiveSeed = savedRun({
    level: 2,
    inventory: ['heavy_armor_t1'],
    equipment: { weapon: null, armor: 'heavy_armor_t1' }
  });
  await page.evaluate((seed) => {
    window.__TRINITY_TEST__.replaceState(seed);
  }, additiveSeed);
  await page.locator('.bottom-nav').waitFor();
  const passiveStats = await page.evaluate(() => window.__TRINITY_TEST__.getStats());
  assert.equal(passiveStats.def, 70, 'base+gear 58 with Paladin +20% should round to 70');

  await page.locator('[data-action="open-dungeon"][data-dungeon-id="dungeon_1"]').click();
  await page.locator('[data-action="enter-dungeon"]').click();

  await page.setViewportSize({ width: 844, height: 390 });
  await assertNoHorizontalOverflow(page, 'landscape battle');
  await assertReachable(
    page.locator('[data-action="open-skills"]'),
    'landscape class skill launcher'
  );
  await page.locator('[data-action="open-skills"]').click();
  await assertFocusInsideModal(page, 'landscape class skill sheet');
  await page.locator('[data-modal-panel] [data-action="close-modal"]').first().click();
  await assertFocusRestored(page, 'open-skills', 'class skill sheet close');

  await page.locator('[data-action="open-skills"]').click();
  await page.locator('[data-action="select-skill"][data-skill-id="divine_armor"]').click();
  const useDivineArmor = page.locator('[data-action="use-selected-skill"]');
  await assertReachable(useDivineArmor, 'landscape class skill execution button');
  await useDivineArmor.click();
  await page.waitForFunction(() => window.__TRINITY_TEST__.getBattleStats().def === 87);
  const buffedStats = await page.evaluate(() => window.__TRINITY_TEST__.getBattleStats());
  assert.equal(
    buffedStats.def,
    87,
    'Paladin +20% and Divine Armor +30% must add to +50% on the 58 base+gear defense'
  );
  await page.waitForFunction(() => {
    const battle = window.__TRINITY_TEST__.getState().battle;
    return battle && battle.phase === 'player' && battle.turn >= 2;
  });

  await assertReachable(
    page.locator('[data-action="open-armor-skills"]'),
    'landscape armor stance launcher'
  );
  await page.locator('[data-action="open-armor-skills"]').click();
  await assertFocusInsideModal(page, 'landscape armor stance sheet');
  const useGuard = page.locator('[data-action="use-armor-skill"][data-armor-skill-id="guard"]');
  await assertReachable(useGuard, 'landscape armor stance action');
  await useGuard.click();
  await page.waitForFunction(() => {
    const battle = window.__TRINITY_TEST__.getState().battle;
    return battle && battle.phase === 'player' && battle.turn >= 3;
  });

  await page.setViewportSize({ width: 390, height: 844 });
  if (process.env.TRINITY_QA_SCREENSHOT) {
    await page.screenshot({
      path: path.resolve(process.env.TRINITY_QA_SCREENSHOT),
      fullPage: false
    });
  }

  const shortViewportSeed = savedRun({
    level: 2,
    inventory: ['heavy_armor_t1'],
    equipment: { weapon: null, armor: 'heavy_armor_t1' }
  });
  await page.evaluate((seed) => {
    window.__TRINITY_TEST__.replaceState(seed);
    window.__TRINITY_TEST__.startBattle('dungeon_1');
  }, shortViewportSeed);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator('.battle-screen').waitFor();
  await assertNoHorizontalOverflow(page, 'short portrait battle');
  await assertReachable(
    page.locator('[data-action="basic-attack"]'),
    'short portrait basic attack'
  );
  await assertReachable(
    page.locator('[data-action="open-skills"]'),
    'short portrait class skill launcher'
  );
  await assertReachable(
    page.locator('[data-action="open-armor-skills"]'),
    'short portrait armor stance launcher'
  );

  await page.locator('[data-action="open-skills"]').click();
  await assertFocusInsideModal(page, 'short portrait class skill sheet');
  await page.locator('[data-action="select-skill"][data-skill-id="divine_armor"]').click();
  await assertReachable(
    page.locator('[data-action="use-selected-skill"]'),
    'short portrait class skill execution button'
  );
  await page.locator('[data-modal-panel] [data-action="close-modal"]').first().click();
  await assertFocusRestored(page, 'open-skills', 'short portrait class skill sheet close');

  await page.locator('[data-action="open-armor-skills"]').click();
  await assertFocusInsideModal(page, 'short portrait armor stance sheet');
  await assertReachable(
    page.locator('[data-action="use-armor-skill"][data-armor-skill-id="guard"]'),
    'short portrait armor stance action'
  );
  await page.locator('[data-modal-panel] [data-action="close-modal"]').first().click();
  await assertFocusRestored(page, 'open-armor-skills', 'short portrait armor stance sheet close');
  await page.setViewportSize({ width: 390, height: 844 });

  const regenSeed = savedRun({
    level: 10,
    selectedClasses: [{ id: 'aether_saber', acquiredAt: 1 }],
    inventory: ['orb_t1'],
    equipment: { weapon: 'orb_t1', armor: null }
  });
  await page.evaluate((seed) => {
    window.__TRINITY_TEST__.replaceState(seed);
    window.__TRINITY_TEST__.startBattle('dungeon_1');
    const nextState = window.__TRINITY_TEST__.getState();
    nextState.battle.player.statuses.meditation = { turns: 3 };
    nextState.battle.player.statuses.mana_dress = { turns: 4 };
    nextState.battle.player.statuses.witch_veil = { turns: 3 };
    nextState.battle.player.statuses.moonlight_veil = { turns: 3 };
    window.__TRINITY_TEST__.replaceState(nextState);
  }, regenSeed);
  const regenCoreStats = await page.evaluate(() => window.__TRINITY_TEST__.getStats());
  const regenBattleStats = await page.evaluate(() => window.__TRINITY_TEST__.getBattleStats());
  assert.equal(regenCoreStats.regen, 16, 'base 10 + Aether Saber 2 + orb 4 must be 16 regen');
  assert.equal(
    regenBattleStats.regen,
    42,
    'Meditation must double core regen before Mana Dress adds its flat +10 (16 * 2 + 10)'
  );
  assert.equal(
    regenBattleStats.evasion,
    0.9,
    'distinct +40% evasion buffs and Mana Dress +10% must add to 90%'
  );

  const gauntletSeed = savedRun({
    level: 28,
    selectedClasses: [
      { id: 'paladin', acquiredAt: 1 },
      { id: 'witch', acquiredAt: 11 },
      { id: 'gardener', acquiredAt: 21 }
    ]
  });
  await page.evaluate((seed) => {
    window.__TRINITY_TEST__.replaceState(seed);
    window.__TRINITY_TEST__.startBattle('dungeon_10');
  }, gauntletSeed);
  const gauntlet = await page.evaluate(() => window.__TRINITY_TEST__.getState().battle);
  assert.equal(gauntlet.encounterCount, 3, 'late dungeons should contain three sequential encounters');
  assert.equal(gauntlet.encounters.length, 3);
  assert.equal(await page.locator('.combatant.enemy').count(), 1, 'sequential encounters must remain strictly one-on-one');

  const milestoneSeed = savedRun({ level: 10 });
  await page.evaluate((seed) => {
    window.__TRINITY_TEST__.replaceState(seed);
  }, milestoneSeed);
  await page.locator('.bottom-nav').waitFor();
  await page.evaluate(() => {
    window.__TRINITY_TEST__.gainExperience(400);
    window.__TRINITY_TEST__.save();
  });
  await page.reload({ waitUntil: 'load' });
  await page.locator('[data-action="continue-run"]').click();
  assert.equal(await page.locator('[data-action="select-class"]').count(), 6, 'Lv.11 must present exactly six choices');
  const firstChoices = await page.locator('[data-action="select-class"] h2').allTextContents();
  await page.reload({ waitUntil: 'load' });
  await page.locator('[data-action="continue-run"]').click();
  const secondChoices = await page.locator('[data-action="select-class"] h2').allTextContents();
  assert.deepEqual(secondChoices, firstChoices, 'saved class choices must not reroll on reload');

  assert.deepEqual(externalRequests, [], `game made external requests: ${externalRequests.join(', ')}`);
  assert.deepEqual(consoleErrors, [], `browser errors: ${consoleErrors.join(' | ')}`);

  await browser.close();
  browser = null;
  console.log('Class roguelike mobile runtime verification passed.');
})().catch(async (error) => {
  if (browser) await browser.close().catch(() => {});
  console.error(error);
  process.exitCode = 1;
});

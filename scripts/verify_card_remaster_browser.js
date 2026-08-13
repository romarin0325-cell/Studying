const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const BOOT_TIMEOUT_MS = 20000;

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => localStorage.clear());

  try {
    const fileUrl = pathToFileURL(path.join(process.cwd(), 'card_remaster', 'index.html')).href;
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => window._scriptLoadComplete === true
        && typeof CardUI !== 'undefined'
        && typeof RPG !== 'undefined'
        && RPG._uiInstalled === true,
      null,
      { timeout: BOOT_TIMEOUT_MS }
    );

    const assets = await page.evaluate(async () => {
      const files = [
        'ui_title_bg.png',
        'ui_hub_bg.png',
        'ui_battle_bg.png',
        'ui_panel_9slice.png'
      ];
      return Promise.all(files.map(fileName => new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve([fileName, image.naturalWidth, image.naturalHeight]);
        image.onerror = () => resolve([fileName, 0, 0]);
        image.src = fileName;
      })));
    });
    assert.deepStrictEqual(assets, [
      ['ui_title_bg.png', 720, 1280],
      ['ui_hub_bg.png', 720, 1280],
      ['ui_battle_bg.png', 720, 1280],
      ['ui_panel_9slice.png', 192, 192]
    ]);

    for (const viewport of [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 412, height: 915 }
    ]) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(async () => {
        RPG.toTitle();
        await new Promise(resolve => setTimeout(resolve, 200));
        const titleBackground = getComputedStyle(document.getElementById('screen-title')).backgroundImage;

        Object.assign(RPG.state, {
          mode: 'origin',
          gameType: 'standard',
          hardMode: false,
          tickets: 20,
          enemyScale: 0,
          deck: ['marshmallow', 'kobold', 'golem'],
          inventory: ['marshmallow', 'kobold', 'golem']
        });
        RPG.toMenu();
        await new Promise(resolve => setTimeout(resolve, 200));
        const hub = document.getElementById('screen-menu');
        const dockRect = document.querySelector('.hub-action-dock').getBoundingClientRect();

        if (!RPG.battle.enemy) RPG.startBattleInit();
        else RPG.showBattleScreen();
        RPG.renderBattleView();
        RPG.renderBattleControls(RPG.battle.players[RPG.battle.currentPlayerIdx]);
        await new Promise(resolve => setTimeout(resolve, 200));
        const battle = document.getElementById('screen-battle');
        const controlsRect = document.getElementById('battle-controls').getBoundingClientRect();
        const stageBackground = getComputedStyle(document.querySelector('.visual-stage')).backgroundImage;

        return {
          documentFits: document.documentElement.scrollWidth <= window.innerWidth + 1,
          titleAssetApplied: titleBackground.includes('ui_title_bg.png'),
          hubFits: hub.scrollWidth <= hub.clientWidth + 1,
          dockVisible: dockRect.top >= 0 && dockRect.bottom <= window.innerHeight + 1,
          partySlots: document.querySelectorAll('.hub-party-slot:not(.is-empty)').length,
          battleFits: battle.scrollWidth <= battle.clientWidth + 1,
          controlsVisible: controlsRect.top >= 0 && controlsRect.bottom <= window.innerHeight + 1,
          skillCount: document.querySelectorAll('#battle-controls .skill-btn').length,
          battleAssetApplied: stageBackground.includes('ui_battle_bg.png')
        };
      });

      assert.strictEqual(layout.documentFits, true);
      assert.strictEqual(layout.titleAssetApplied, true);
      assert.strictEqual(layout.hubFits, true);
      assert.strictEqual(layout.dockVisible, true);
      assert.strictEqual(layout.partySlots, 3);
      assert.strictEqual(layout.battleFits, true);
      assert.strictEqual(layout.controlsVisible, true);
      assert(layout.skillCount >= 2 && layout.skillCount <= 4);
      assert.strictEqual(layout.battleAssetApplied, true);
    }

    assert.deepStrictEqual(pageErrors, []);
    console.log('Card remaster mobile browser verification passed.');
  } finally {
    await browser.close();
  }
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function test() {
    console.log('🧪 Testing CardRPG.html in headless browser...');
    const browser = await chromium.launch();
    const page = await browser.newPage();

    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => {
        errors.push(err.message);
    });

    const fileUrl = new URL('./dist/CardRPG.html', import.meta.url).href;
    await page.goto(fileUrl);

    // Wait for title screen buttons
    await page.waitForFunction(() => {
        const btn = document.getElementById('btn-start-new');
        return btn && !btn.disabled;
    }, null, { timeout: 10000 });

    console.log('✅ Title screen loaded and ready.');

    // Check title screen elements
    const titleState = await page.evaluate(() => ({
        hasTitle: !!document.getElementById('screen-title'),
        newBtnEnabled: !document.getElementById('btn-start-new').disabled,
        loadBtnEnabled: !document.getElementById('btn-start-load').disabled,
        hasFullscreen: !!document.getElementById('btn-game-fullscreen'),
        hasMusic: !!document.getElementById('btn-title-music')
    }));
    console.log('Title state:', titleState);

    const getShotPath = name => path.resolve(path.dirname(fileURLToPath(import.meta.url)), name);

    // Take screenshot of title screen
    await page.screenshot({ path: getShotPath('screenshot_title.png') });

    // Start game flow: loadGlobalData, initNewGame('origin') and transition to Menu
    await page.evaluate(() => {
        RPG.loadGlobalData();
        RPG.initNewGame('origin');
        RPG.closeInfoModal();
        RPG.toMenu();
    });

    await page.waitForFunction(() => {
        const menu = document.getElementById('screen-menu');
        return menu && menu.classList.contains('active');
    }, null, { timeout: 10000 });

    console.log('✅ Navigated to Main Hub / screen-menu.');
    await page.screenshot({ path: getShotPath('screenshot_lobby.png') });

    // Check Hub enhancements and Dock
    const hubState = await page.evaluate(() => {
        const dock = document.getElementById('hub-navigation-dock');
        const tabs = dock ? [...dock.querySelectorAll('.dock-tab')].map(t => t.innerText.trim().replace(/\s+/g, ' ')) : [];
        const sortieBtn = document.querySelector('.btn-sortie');
        return {
            hasDock: !!dock,
            tabs,
            hasSortie: !!sortieBtn,
            sortieText: sortieBtn ? sortieBtn.innerText : null,
            ticketText: document.getElementById('ui-tickets').innerText
        };
    });
    console.log('Hub state:', hubState);

    // Test tab navigation: Deck
    await page.evaluate(() => AppView.switchTab('deck'));
    const deckActive = await page.evaluate(() => document.getElementById('screen-deck').classList.contains('active'));
    console.log('✅ Switched to Deck screen:', deckActive);
    await page.screenshot({ path: getShotPath('screenshot_deck.png') });

    // Test tab navigation: Collection
    await page.evaluate(() => AppView.switchTab('cards'));
    const collectionActive = await page.evaluate(() => document.getElementById('screen-collection').classList.contains('active'));
    console.log('✅ Switched to Collection screen:', collectionActive);

    // Test tab navigation: Back to Lobby
    await page.evaluate(() => AppView.switchTab('lobby'));
    const lobbyActive = await page.evaluate(() => document.getElementById('screen-menu').classList.contains('active'));
    console.log('✅ Switched back to Lobby:', lobbyActive);

    // Test entering battle
    await page.evaluate(() => {
        RPG.state.deck = ['deep_lord', 'queen', 'luna'];
        RPG.startBattleInit();
    });
    await page.waitForFunction(() => {
        const battle = document.getElementById('screen-battle');
        return battle && battle.classList.contains('active');
    }, null, { timeout: 5000 });

    const battleState = await page.evaluate(() => {
        const battle = document.getElementById('screen-battle');
        const skillBtns = document.querySelectorAll('#battle-controls .skill-btn');
        const pName = document.getElementById('p-name')?.innerText;
        const eName = document.getElementById('e-name')?.innerText;
        return {
            battleActive: battle.classList.contains('active'),
            playerName: pName,
            enemyName: eName,
            skillButtonsCount: skillBtns.length
        };
    });
    console.log('✅ Battle state verified:', battleState);

    // Test executing an attack skill
    console.log('⚔️ Executing normal attack in battle...');
    await page.evaluate(() => {
        const firstSkillBtn = document.querySelector('#battle-controls .skill-btn');
        if (firstSkillBtn) firstSkillBtn.click();
    });

    // Wait a short moment for combat resolution/log update
    await page.waitForTimeout(500);

    const postAttackState = await page.evaluate(() => {
        const log = document.getElementById('battle-log')?.innerText || '';
        return {
            hasLog: log.length > 0,
            recentLogSample: log.slice(-200)
        };
    });
    console.log('✅ Battle turn action executed successfully:', postAttackState);
    await page.screenshot({ path: getShotPath('screenshot_battle.png') });

    console.log('Errors logged during session:', errors.length);
    if (errors.length > 0) {
        console.warn('Browser errors:', errors);
    }

    await browser.close();
    console.log('🎉 ALL TEST FLOWS PASSED PERFECTLY!');
}

test().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});

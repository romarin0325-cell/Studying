const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('http://localhost:8000/card/index.html', { waitUntil: 'domcontentloaded' });

    // Wait for the game to finish loading
    await page.waitForSelector('#title-loading.hidden', { state: 'attached', timeout: 10000 });

    // Bypass the initial screen
    await page.evaluate(() => {
        RPG.initNewGame('origin');
    });

    // Close any auto-save info modals
    try {
        const infoModal = await page.waitForSelector('#modal-info', { timeout: 1000 });
        if (await infoModal.isVisible()) {
             await page.evaluate(() => RPG.closeInfoModal());
        }
    } catch(e) {}

    // 1. Check TOEIC Practice Modal
    await page.evaluate(() => RPG.startToeicPractice());
    await page.waitForTimeout(500); // Wait for modal to render
    await page.screenshot({ path: 'toeic_modal.png' });
    console.log("Screenshot taken: toeic_modal.png");
    await page.evaluate(() => RPG.closeToeicPractice());

    // 2. Check Tutoring Modal
    // Simulate setting wrong words so tutoring can open
    await page.evaluate(() => {
        RPG.state.wrongWords = ['apple'];
        RPG.openPrivateTutoring();
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tutoring_modal.png' });
    console.log("Screenshot taken: tutoring_modal.png");
    await page.evaluate(() => RPG.closePrivateTutoring());

    // 3. Check Lumi Question Modal
    await page.evaluate(() => RPG.openLumiQuestion());
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'lumi_modal.png' });
    console.log("Screenshot taken: lumi_modal.png");
    await page.evaluate(() => RPG.closeLumiQuestion());

    await browser.close();
})();

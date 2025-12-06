
const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const filePath = 'file://' + path.resolve('new.html');

    await page.goto(filePath);

    // Helper to log
    const log = msg => console.log(`[TEST] ${msg}`);

    // 1. Select Queen
    log('Selecting Queen...');
    await page.click('text=🌹 여왕 (마법검사)');
    await page.waitForTimeout(500);

    // 2. Check Royal Bloom position in Shop
    log('Checking Shop Order...');
    await page.click('text=🛒 상점 / 스킬 관리');
    await page.waitForTimeout(500);

    // Get skill buttons in shop
    const skillButtons = await page.$$eval('#skill-shop-list button span:first-child', els => els.map(e => e.innerText));
    log(`Shop Skills: ${skillButtons.join(', ')}`);

    // Check if Royal Bloom is before Queen's Domain
    const rbIndex = skillButtons.indexOf('Royal Bloom');
    const qdIndex = skillButtons.indexOf("Queen's Domain");
    if (rbIndex < qdIndex && rbIndex !== -1) {
        log('PASS: Royal Bloom is listed before Queen\'s Domain.');
    } else {
        log(`FAIL: Order incorrect. RB: ${rbIndex}, QD: ${qdIndex}`);
    }
    await page.click('text=나가기');
    await page.waitForTimeout(500);

    // 3. Enter Dungeon to test Royal Bloom mechanics
    log('Entering Dungeon...');
    await page.click('text=🟢 속삭이는 동굴 (Lv.1~3)');
    await page.waitForTimeout(1000);

    // Learn Royal Bloom (Hack: add to learned skills manually via console for speed)
    await page.evaluate(() => {
        gameState.learnedSkills.push('royalbloom');
        createBattleButtons();
        updateInfo();
        roseStack = 5; // Give initial stacks
        updateInfo();
    });

    // Check Initial ATK
    let initialAtk = await page.$eval('#ui-atk', el => parseInt(el.innerText));
    log(`Initial ATK: ${initialAtk}`);

    // Use Royal Bloom
    log('Using Royal Bloom...');
    await page.click('button:has-text("Royal Bloom")');
    await page.waitForTimeout(1000);

    // Check ATK Buff
    let buffedAtk = await page.$eval('#ui-atk', el => parseInt(el.innerText));
    log(`Buffed ATK: ${buffedAtk}`);

    if (buffedAtk > initialAtk) {
        log(`PASS: ATK increased from ${initialAtk} to ${buffedAtk}`);
    } else {
        log('FAIL: ATK did not increase.');
    }

    // Check Rose Stacks (Should NOT be 0 yet)
    let roseText = await page.$eval('#extra-ui', el => el.innerText);
    log(`Rose Status: ${roseText}`);
    if (roseText.includes('장미 스택: 0')) {
        log('FAIL: Rose stacks consumed immediately.');
    } else {
        log('PASS: Rose stacks preserved immediately.');
    }

    // Pass turns to check expiration
    log('Passing turns...');
    // Turn 1 end (used skill) -> Turn 2 start
    // We need 3 turns passed.
    await page.evaluate(() => executeTurn('basic')); // Turn 2
    await page.waitForTimeout(500);
    await page.evaluate(() => executeTurn('basic')); // Turn 3
    await page.waitForTimeout(500);
    await page.evaluate(() => executeTurn('basic')); // Turn 4 (Buff should expire at end of turn 3? Or start of turn 4?)
    // Logic: royalBloomTurns = 3. EndTurnPhase decrements.
    // Turn 1 End: 2
    // Turn 2 End: 1
    // Turn 3 End: 0 -> Reset Stacks

    await page.waitForTimeout(500);
    roseText = await page.$eval('#extra-ui', el => el.innerText);
    log(`Rose Status after turns: ${roseText}`);

    if (roseText.includes('장미 스택: 0')) {
        log('PASS: Rose stacks consumed after duration.');
    } else {
        log('FAIL: Rose stacks NOT consumed or duration wrong.');
    }

    // 4. Test Reset Game
    log('Testing Reset Game...');
    // Enable dialog handling
    page.on('dialog', async dialog => {
        log(`Dialog message: ${dialog.message()}`);
        await dialog.accept();
    });

    // Click Reset (Need to go to town first, or add button to battle? Button is in Town Menu)
    // We are in battle. Win it or Lose it? Or just reload.
    // Easier: Mock town state
    await page.evaluate(() => {
        document.getElementById('battle-menu').style.display = 'none';
        document.getElementById('town-menu').style.display = 'grid';
    });

    await page.click('text=☠️ 게임 초기화 (Rebirth)');
    await page.waitForTimeout(1000);

    // Check if char modal is active
    const modalActive = await page.$eval('#char-modal', el => el.classList.contains('active'));
    if (modalActive) {
        log('PASS: Reset Game returned to Char Select.');
    } else {
        log('FAIL: Reset Game did not open Char Select.');
    }

    await browser.close();
})();

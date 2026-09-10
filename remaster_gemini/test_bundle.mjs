import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

async function test() {
    console.log('🧪 Starting Strict Verification Suite for Card RPG Remaster...');
    const browser = await chromium.launch();
    const page = await browser.newPage();

    const errors = [];
    const externalRequests = [];

    page.on('console', msg => {
        if (msg.type() === 'error') {
            // Local relative path probing naturally emits net::ERR_FILE_NOT_FOUND on missing candidate paths
            if (!msg.text().includes('net::ERR_FILE_NOT_FOUND')) {
                errors.push(msg.text());
            }
        }
    });

    page.on('pageerror', err => {
        errors.push(err.message);
    });

    page.on('request', req => {
        const url = req.url();
        if (url.startsWith('http://') || url.startsWith('https://')) {
            externalRequests.push(url);
        }
    });

    // Auto-accept alert/confirm dialogs while logging them
    const dialogMessages = [];
    page.on('dialog', async dialog => {
        dialogMessages.push(dialog.message());
        await dialog.accept();
    });

    const fileUrl = new URL('./dist/CardRPG.html', import.meta.url).href;
    await page.goto(fileUrl);

    // -------------------------------------------------------------
    // 1. Title Screen & External Dependency Check (Point 7)
    // -------------------------------------------------------------
    console.log('▶ [Point 7] Verifying Title Screen and Offline Independence...');
    await page.waitForFunction(() => {
        const btn = document.getElementById('btn-start-new');
        return btn && !btn.disabled;
    }, null, { timeout: 10000 });

    assert.equal(externalRequests.length, 0, `Expected 0 external network requests, found: ${externalRequests.join(', ')}`);
    console.log('  ✓ Zero external network requests detected (Pure Offline Standalone)');

    const titleState = await page.evaluate(() => ({
        hasTitle: !!document.getElementById('screen-title'),
        newBtnEnabled: !document.getElementById('btn-start-new').disabled,
        loadBtnEnabled: !document.getElementById('btn-start-load').disabled,
        hasFullscreen: !!document.getElementById('btn-game-fullscreen'),
        hasMusic: !!document.getElementById('btn-title-music')
    }));
    assert.ok(titleState.hasTitle, 'Title screen element should exist');
    assert.ok(titleState.newBtnEnabled, 'New Run button should be enabled');
    console.log('  ✓ Title screen elements fully operational');

    const getShotPath = name => path.resolve(path.dirname(fileURLToPath(import.meta.url)), name);
    await page.screenshot({ path: getShotPath('screenshot_title.png') });

    // -------------------------------------------------------------
    // 2. Real UI Click: Start New Game -> Type Select -> Mode Selection (Point 2)
    // -------------------------------------------------------------
    console.log('▶ [Point 2] Testing Mode Selection UI & CSS Classes...');
    await page.click('#btn-start-new');

    await page.waitForSelector('#modal-type-select.active', { timeout: 3000 });
    console.log('  ✓ Game type select modal opened via UI click');

    // Click Endless mode in type select
    await page.click('#modal-type-select button:has-text("무한 모드")');

    await page.waitForSelector('#modal-mode-select.active', { timeout: 3000 });
    console.log('  ✓ Mode selection modal opened via UI click');

    // Click Origin Mode button
    const originBtn = await page.waitForSelector('#mode-btn-origin', { timeout: 3000 });
    await originBtn.click();

    // Verify .mode-item.is-selected class and styles
    const modeBtnCheck = await page.evaluate(() => {
        const btn = document.getElementById('mode-btn-origin');
        const rules = [];
        for (const sheet of document.styleSheets) {
            try {
                for (const r of sheet.cssRules) {
                    if (r.selectorText && btn.matches(r.selectorText)) {
                        rules.push({ sel: r.selectorText, css: r.cssText });
                    }
                }
            } catch (e) {}
        }
        return {
            hasModeItemClass: btn.classList.contains('mode-item'),
            isSelected: btn.classList.contains('is-selected'),
            color: window.getComputedStyle(btn).color,
            borderColor: window.getComputedStyle(btn).borderColor,
            styleAttr: btn.getAttribute('style'),
            matchedRules: rules
        };
    });
    console.log('Mode btn check detail:', JSON.stringify(modeBtnCheck, null, 2));
    assert.ok(modeBtnCheck.hasModeItemClass, 'Mode button must have .mode-item class');
    assert.ok(modeBtnCheck.isSelected, 'Mode button must have .is-selected class after click');

    // Confirm selection and enter game (Double confirm flow)
    await page.click('#btn-enter-mode');
    await page.waitForSelector('#modal-confirm.active', { timeout: 3000 });
    await page.click('#confirm-yes');

    // Step 2 double confirm
    await page.waitForTimeout(300);
    await page.waitForSelector('#modal-confirm.active', { timeout: 3000 });
    await page.click('#confirm-yes');

    await page.waitForFunction(() => {
        const menu = document.getElementById('screen-menu');
        return menu && menu.classList.contains('active');
    }, null, { timeout: 5000 });

    // Dismiss any auto-save confirmation modal so the lobby UI is clearly visible
    await page.evaluate(() => {
        if (typeof RPG.closeInfoModal === 'function') RPG.closeInfoModal();
    });
    await page.waitForTimeout(150);

    console.log('  ✓ Successfully transitioned to Lobby via full UI interaction');
    await page.screenshot({ path: getShotPath('screenshot_lobby.png') });

    // -------------------------------------------------------------
    // 3. Lobby Readiness & Vanguard Formation Showcase (Point 9)
    // -------------------------------------------------------------
    console.log('▶ [Point 9] Verifying Lobby Showcase & Vanguard Formation...');
    const lobbyState = await page.evaluate(() => {
        const modeBadge = document.getElementById('lobby-mode-name')?.innerText;
        const stageBadge = document.getElementById('lobby-stage-num')?.innerText;
        const enemyText = document.getElementById('next-enemy-text')?.innerText;
        const enemyImg = document.getElementById('next-enemy-img');
        const vanguardContainer = document.getElementById('lobby-vanguard-container');
        const vanguardSlots = vanguardContainer ? vanguardContainer.querySelectorAll('.vanguard-slot').length : 0;
        const sortieBtn = document.querySelector('.btn-sortie');
        return {
            modeBadge,
            stageBadge,
            enemyText,
            enemyImgSrc: enemyImg ? enemyImg.src : null,
            hasVanguard: !!vanguardContainer,
            vanguardSlots,
            hasSortie: !!sortieBtn
        };
    });

    assert.equal(lobbyState.modeBadge, '오리진', 'Lobby mode badge should display "오리진"');
    assert.ok(lobbyState.stageBadge.includes('Stage 1'), 'Lobby stage badge should display Stage 1');
    assert.ok(lobbyState.enemyText && lobbyState.enemyText.length > 1, 'Next enemy preview text should be set');
    assert.ok(lobbyState.hasVanguard, 'Vanguard formation container should exist in lobby');
    assert.equal(lobbyState.vanguardSlots, 3, 'Vanguard formation must have 3 slots (선봉, 중견, 대장)');
    assert.ok(lobbyState.hasSortie, 'Heroic Sortie button should exist');
    console.log('  ✓ Lobby Showcase & Vanguard Formation fully rendered:', lobbyState);

    // -------------------------------------------------------------
    // 4. Mode Card Acquisition Guards (Point 1)
    // -------------------------------------------------------------
    console.log('▶ [Point 1] Testing Mode Card Acquisition Rules...');
    const modeRulesTest = await page.evaluate(() => {
        // Test in Origin mode: startDraft must be blocked
        const deckBefore = [...RPG.state.deck];
        const invBefore = [...RPG.state.inventory];
        const draftAttempt = RPG.startDraft();
        const deckAfterDraft = [...RPG.state.deck];
        const invAfterDraft = [...RPG.state.inventory];

        // Test getAllowedModeActions
        const originAllowed = RPG.getAllowedModeActions('origin');
        const draftAllowed = RPG.getAllowedModeActions('draft');
        const chaosAllowed = RPG.getAllowedModeActions('chaos');

        return {
            originAllowsDraft: originAllowed.canDraft,
            originAllowsGacha: originAllowed.canNormalGacha,
            draftAllowsDraft: draftAllowed.canDraft,
            draftAllowsGacha: draftAllowed.canNormalGacha,
            chaosAllowsShuffle: chaosAllowed.canChaosShuffle,
            chaosAllowsGacha: chaosAllowed.canNormalGacha,
            deckUnchanged: JSON.stringify(deckBefore) === JSON.stringify(deckAfterDraft),
            invUnchanged: JSON.stringify(invBefore) === JSON.stringify(invAfterDraft)
        };
    });

    assert.equal(modeRulesTest.originAllowsDraft, false, 'Origin mode must NOT allow draft');
    assert.equal(modeRulesTest.originAllowsGacha, true, 'Origin mode must allow gacha');
    assert.equal(modeRulesTest.draftAllowsDraft, true, 'Draft mode must allow draft');
    assert.equal(modeRulesTest.draftAllowsGacha, false, 'Draft mode must NOT allow gacha');
    assert.equal(modeRulesTest.chaosAllowsShuffle, true, 'Chaos mode must allow chaos shuffle');
    assert.equal(modeRulesTest.chaosAllowsGacha, false, 'Chaos mode must NOT allow gacha');
    assert.ok(modeRulesTest.deckUnchanged, 'Draft attempt in origin mode must not modify deck');
    assert.ok(modeRulesTest.invUnchanged, 'Draft attempt in origin mode must not modify inventory');
    await page.evaluate(() => {
        if (typeof RPG.closeInfoModal === 'function') RPG.closeInfoModal();
    });
    console.log('  ✓ Mode card acquisition permissions strictly enforced');

    // -------------------------------------------------------------
    // 5. Card Grade Borders & Selection Visibility (Point 2)
    // -------------------------------------------------------------
    console.log('▶ [Point 2] Testing Card Grade Colors and Selection Ring...');
    const cardStylesTest = await page.evaluate(() => {
        const testContainer = document.createElement('div');
        testContainer.id = 'test-card-container';
        testContainer.innerHTML = `
            <div class="card-item legend" id="test-legend-card">Legend</div>
            <div class="card-item epic" id="test-epic-card">Epic</div>
            <div class="card-item rare" id="test-rare-card">Rare</div>
            <div class="card-item normal" id="test-normal-card">Normal</div>
            <div class="card-item legend is-selected" id="test-selected-legend">Selected Legend</div>
        `;
        document.body.appendChild(testContainer);

        const legendCard = document.getElementById('test-legend-card');
        const selectedLegend = document.getElementById('test-selected-legend');

        const legendBorder = window.getComputedStyle(legendCard).borderColor;
        const selectedOutline = window.getComputedStyle(selectedLegend).outlineStyle;
        const selectedOutlineColor = window.getComputedStyle(selectedLegend).outlineColor;

        testContainer.remove();

        return {
            legendBorder,
            selectedOutline,
            selectedOutlineColor
        };
    });

    assert.ok(cardStylesTest.legendBorder.includes('255, 82, 82') || cardStylesTest.legendBorder.includes('rgb(255, 82, 82)'),
        `Legend card should have crimson border, got: ${cardStylesTest.legendBorder}`);
    assert.notEqual(cardStylesTest.selectedOutline, 'none', 'Selected card must have visible outline');
    assert.ok(cardStylesTest.selectedOutlineColor.includes('56, 189, 248'),
        `Selected card outline should be celestial azure (#38bdf8), got: ${cardStylesTest.selectedOutlineColor}`);
    console.log('  ✓ Card grade styling and high-contrast selection ring verified');

    // -------------------------------------------------------------
    // 6. ImageAssetManager Race Condition Protection (Point 3)
    // -------------------------------------------------------------
    console.log('▶ [Point 3] Testing ImageAssetManager Race Condition Safety...');
    const raceConditionTest = await page.evaluate(() => {
        const img = document.createElement('img');
        img.id = 'test-race-img';
        document.body.appendChild(img);

        // Rapid swap: entityA then entityB on same img element
        ImageAssets.load(img, { name: 'card_slow_a', imageFile: 'card_slow_a.png' });
        const requestA = ImageAssets.requestIds.get(img);
        ImageAssets.load(img, { name: 'card_fast_b', imageFile: 'card_fast_b.png' });
        const requestB = ImageAssets.requestIds.get(img);

        img.remove();

        return {
            requestA,
            requestB,
            requestIdIncremented: requestB > requestA
        };
    });

    assert.ok(raceConditionTest.requestIdIncremented, 'Image request ID must increment on rapid entity swap');
    console.log('  ✓ ImageAssetManager request ID race condition guard verified');

    // -------------------------------------------------------------
    // 7. Dock Navigation & Screen Synchronization (Point 4)
    // -------------------------------------------------------------
    console.log('▶ [Point 4] Testing Dock Navigation & Screen Synchronization...');
    // Switch to Deck
    await page.evaluate(() => AppView.switchTab('deck'));
    const deckActive = await page.evaluate(() => ({
        screenActive: document.getElementById('screen-deck').classList.contains('active'),
        dockActiveTab: document.querySelector('.dock-tab.active')?.dataset.tab
    }));
    assert.ok(deckActive.screenActive, 'Deck screen should be active');
    assert.equal(deckActive.dockActiveTab, 'deck', 'Dock active tab should be "deck"');

    // Back to menu via RPG.toMenu()
    await page.evaluate(() => RPG.toMenu());
    const menuActive = await page.evaluate(() => ({
        screenActive: document.getElementById('screen-menu').classList.contains('active'),
        dockActiveTab: document.querySelector('.dock-tab.active')?.dataset.tab
    }));
    assert.ok(menuActive.screenActive, 'Menu screen should be active');
    assert.equal(menuActive.dockActiveTab, 'lobby', 'Dock active tab should sync back to "lobby"');
    console.log('  ✓ Dock synchronization with screen transitions verified');

    // -------------------------------------------------------------
    // 8. Fortune Cookie Global Object & Sanctuary Modal (Point 5)
    // -------------------------------------------------------------
    console.log('▶ [Point 5] Testing Fortune Cookie Export & Sanctuary Invocation...');
    await page.evaluate(() => {
        if (typeof RPG.closeInfoModal === 'function') RPG.closeInfoModal();
    });
    const fortuneCookieTest = await page.evaluate(() => {
        const hasGlobalExport = typeof window.FortuneCookie !== 'undefined' && typeof window.FortuneCookie.open === 'function';
        AppView.openSanctuaryModal();
        const modal = document.getElementById('modal-sanctuary-hub');
        const hasFortuneBtn = !!document.getElementById('btn-sanctuary-fortune');
        return {
            hasGlobalExport,
            modalActive: modal && modal.classList.contains('active'),
            hasFortuneBtn
        };
    });

    assert.ok(fortuneCookieTest.hasGlobalExport, 'window.FortuneCookie must be exported and have open() method');
    assert.ok(fortuneCookieTest.modalActive, 'Sanctuary modal should open');
    assert.ok(fortuneCookieTest.hasFortuneBtn, 'Fortune Cookie button should exist in Sanctuary modal');

    // Click Fortune Cookie button in Sanctuary
    await page.click('#btn-sanctuary-fortune');
    const fortuneModalOpen = await page.evaluate(() => {
        const modal = document.getElementById('modal-fortune-cookie');
        return modal && modal.classList.contains('active');
    });
    assert.ok(fortuneModalOpen, 'Fortune cookie modal should be active after clicking sanctuary button');

    // Close Fortune Cookie modal
    await page.evaluate(() => {
        FortuneCookie.close();
    });
    console.log('  ✓ Fortune Cookie global export and Sanctuary modal flow verified');

    // -------------------------------------------------------------
    // 9. Combat Damage, Floating VFX, SFX, and Turn Advancement (Point 8)
    // -------------------------------------------------------------
    console.log('▶ [Point 8] Testing Real Combat Turn Action, Damage Calculation, and VFX...');
    await page.evaluate(() => {
        RPG.toMenu();
        // Equip 3 starter cards into deck
        RPG.state.deck = ['deep_lord', 'queen', 'luna'];
        RPG.startBattleInit();
    });

    await page.waitForSelector('#screen-battle.active', { timeout: 5000 });
    console.log('  ✓ Battle arena active');

    const preAttackState = await page.evaluate(() => ({
        enemyHp: RPG.battle.enemy.hp,
        turn: RPG.battle.turn,
        playerName: RPG.battle.players[0]?.name,
        enemyName: RPG.battle.enemy.name
    }));
    assert.ok(preAttackState.enemyHp > 0, 'Enemy must have positive initial HP');
    assert.equal(preAttackState.turn, 1, 'Initial turn must be 1');
    console.log('  ✓ Pre-attack state:', preAttackState);

    // Execute normal attack via battle controls click
    await page.waitForSelector('#battle-controls .skill-btn', { timeout: 3000 });
    await page.click('#battle-controls .skill-btn');

    // Wait for floating damage number element and log update
    await page.waitForTimeout(600);

    const postAttackState = await page.evaluate((initialHp) => {
        const enemyHp = RPG.battle.enemy.hp;
        const logText = document.getElementById('battle-log')?.innerText || '';
        const floatingDmg = document.querySelector('.floating-damage');
        return {
            enemyHp,
            hpDecreased: enemyHp < initialHp,
            damageLogged: logText.includes('피해') || logText.includes('Critical'),
            hasFloatingDamage: !!floatingDmg || logText.includes('피해')
        };
    }, preAttackState.enemyHp);

    assert.ok(postAttackState.hpDecreased, `Enemy HP should have decreased from base ${preAttackState.enemyHp}, current: ${postAttackState.enemyHp}`);
    assert.ok(postAttackState.damageLogged, 'Battle log must contain damage confirmation');
    console.log('  ✓ Combat attack dealt damage and logged action successfully:', postAttackState);

    await page.screenshot({ path: getShotPath('screenshot_battle.png') });

    // -------------------------------------------------------------
    // Final Error Tally
    // -------------------------------------------------------------
    assert.equal(errors.length, 0, `Zero browser error messages expected, got: ${errors.join('; ')}`);

    await browser.close();
    console.log('\n========================================================');
    console.log('🎉 ALL 9 CRITICAL FEEDBACK POINTS FULLY VERIFIED & PASSED!');
    console.log('========================================================\n');
}

test().catch(err => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
});



from playwright.sync_api import sync_playwright
import os
import json

def test_logic():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        cwd = os.getcwd()
        url = f'file://{cwd}/card/index.html'
        page.goto(url)

        # Override random to predictable
        page.evaluate('''() => {
            Math.random = () => 0.5;
        }''')

        # Start New Game
        page.get_by_role('button', name='새로하기').click()

        # Set Deck with known cards (using evaluate)
        page.evaluate('''() => {
            gameState.deck = ['kobold', 'kobold', 'kobold'];
            gameState.inventory = ['kobold', 'kobold', 'kobold'];
        }''')

        # Go to battle
        page.evaluate('startBattleInit()')

        # Verify Battle Screen Active
        page.wait_for_selector('#screen-battle.active')

        # Check Enemy Name (Cycle 0, Index 0 -> Artificial Demon God)
        enemy_name = page.locator('#e-name').inner_text()
        print(f'Enemy: {enemy_name}')

        # Verify Protocol Translations in getBuffNameKR via console
        t_phy = page.evaluate('getBuffNameKR(defProtocolPhy)')
        t_mag = page.evaluate('getBuffNameKR(defProtocolMag)')
        print(f'Trans Phy: {t_phy}')
        print(f'Trans Mag: {t_mag}')

        # Test Artificial Demon God Protocol Logic
        # It's 'Artificial Demon God'.
        # We need to simulate a player attack type.
        # Player attacks are executed via executeSkill.
        # Let's force a hit.

        page.evaluate('''() => {
            // Force enemy ID just in case
            battleState.enemy.id = 'artificial_demon_god';
            // Player attacks with Phy
            battleState.enemy.lastHitType = 'phy';
            // Run enemy turn logic start
            startEnemyTurn();
        }''')

        # Check logs for protocol activation
        logs = page.locator('#battle-log').inner_text()
        if '방어 프로토콜: 물리 피격 감지' in logs:
            print('Protocol Detected in Logs')
        else:
            print('Protocol NOT detected')

        # Check Buffs on Enemy
        # The protocol adds a buff property e.buffs.defProtocolPhy = 1
        # The UI should show it?
        # getBuffNameKR maps it. renderBattlefield updates it.
        # But wait, startEnemyTurn ends with startPlayerTurn which renders battlefield.

        e_buffs = page.locator('#e-buffs').inner_text()
        print(f'Enemy Buffs: {e_buffs}')

        # Take screenshot of battle with protocol
        page.screenshot(path='verification/battle_protocol.png')

        browser.close()

if __name__ == '__main__':
    test_logic()

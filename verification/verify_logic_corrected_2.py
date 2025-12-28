
from playwright.sync_api import sync_playwright
import os

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

        # Set Deck
        page.evaluate('''() => {
            gameState.deck = ['kobold', 'kobold', 'kobold'];
            gameState.inventory = ['kobold', 'kobold', 'kobold'];
        }''')

        # Go to battle
        page.evaluate('startBattleInit()')
        page.wait_for_selector('#screen-battle.active')

        # Verify Translations
        # Must pass string inside evaluate
        t_phy = page.evaluate('getBuffNameKR(defProtocolPhy)')
        t_mag = page.evaluate('getBuffNameKR(defProtocolMag)')
        print(f'Trans Phy: {t_phy}')
        print(f'Trans Mag: {t_mag}')

        # Test Protocol
        page.evaluate('''() => {
            battleState.enemy.id = 'artificial_demon_god';
            battleState.enemy.lastHitType = 'phy';
            startEnemyTurn();
        }''')

        # Check logs
        logs = page.locator('#battle-log').inner_text()
        if '방어 프로토콜: 물리 피격 감지' in logs:
            print('Protocol Detected in Logs')
        else:
            print(f'Protocol NOT detected. Logs: {logs}')

        # Check Buffs
        e_buffs = page.locator('#e-buffs').inner_text()
        print(f'Enemy Buffs: {e_buffs}')

        page.screenshot(path='verification/battle_protocol.png')
        browser.close()

if __name__ == '__main__':
    test_logic()

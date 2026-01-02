
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Load the local HTML file
        cwd = os.getcwd()
        page.goto(f'file://{cwd}/english_vocab_version/new.html')

        # Check if character selection modal is active
        # The game starts with #char-modal active.
        # We need to select a character first to make the main menu visible.

        # Select Luna
        page.click('button.char-select-btn')

        # Wait for town menu to be visible
        page.wait_for_selector('#town-menu')

        # Now 1. Open Settings
        page.click('button:has-text("⚙️ 게임 설정")')
        page.wait_for_selector('#settings-modal.active')
        page.screenshot(path='verification/step1_settings.png')

        # 2. Click Wordbook
        page.click('button:has-text("📖 단어장")')
        page.wait_for_selector('#wordbook-modal.active')
        page.screenshot(path='verification/step2_wordbook.png')

        # Close Wordbook
        page.click('#wordbook-modal button:has-text("닫기")')

        # 3. Simulate Battle Start to check Auto Heal logic
        # Check initial HP/MP
        initial_hp = page.evaluate('player.hp')
        print(f'Initial HP: {initial_hp}')

        # Set HP to 1 to test heal
        page.evaluate('player.hp = 1; player.mp = 0; updateInfo();')
        page.screenshot(path='verification/step3_low_hp.png')

        # Start Battle (Trigger Auto Heal)
        # 'enterDungeon(1)' calls startBattle.
        page.evaluate('enterDungeon(1)')

        # Check HP after battle start
        new_hp = page.evaluate('player.hp')
        max_hp = page.evaluate('player.maxHp')
        print(f'New HP: {new_hp}/{max_hp}')

        page.screenshot(path='verification/step4_battle_start.png')

        # 4. Simulate Win Battle to check Bonus Quiz Prompt
        # Force win
        page.evaluate('currentEnemy.hp = 0; winBattle();')

        # Wait for confirm modal
        page.wait_for_selector('#confirm-modal.active')
        page.screenshot(path='verification/step5_bonus_quiz_prompt.png')

        # Click Yes
        page.click('#confirm-yes')

        # Wait for Bonus Quiz Modal
        page.wait_for_selector('#quiz-bonus-modal.active')
        page.screenshot(path='verification/step6_bonus_quiz.png')

        browser.close()

if __name__ == '__main__':
    run()

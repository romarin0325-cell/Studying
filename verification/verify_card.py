
from playwright.sync_api import sync_playwright
import os

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load local file
        filepath = os.path.abspath('card/index.html')
        page.goto(f'file://{filepath}')

        # 1. Verify Chaos Blessing Modal
        print('Checking Chaos Blessing...')
        page.evaluate('RPG.openChaosBlessing()')
        page.wait_for_selector('#modal-chaos.active')

        # Check height (min-height: 550px)
        height = page.evaluate('document.querySelector("#modal-chaos .modal-content").offsetHeight')
        print(f'Chaos Modal Height: {height}')
        if height < 550:
            print('ERROR: Modal height is too small!')

        # Screenshot Chaos Modal
        page.screenshot(path='verification/chaos_modal.png')

        # 2. Verify Logic (Simulate logic check)
        # We can't easily simulate the quiz interaction fully in a short script without mocking,
        # but we can check the button text update.
        btn_text = page.locator('#modal-chaos .menu-btn', has_text='혼돈의 축복 (도전)').inner_text()
        print(f'Challenge Button Text: {btn_text}')

        # Close modal
        page.evaluate('document.getElementById("modal-chaos").classList.remove("active")')

        # 3. Verify Wordbook Persistence
        print('Checking Wordbook Persistence...')

        # Simulate adding a wrong word
        page.evaluate('RPG.state.wrongWords.push("TEST_WORD")')
        page.evaluate('localStorage.setItem("cardRpgVocab", JSON.stringify(["TEST_WORD"]))')

        # Reload page (simulate restart)
        page.reload()

        # Check if word persists
        page.evaluate('RPG.startGame("new")') # or init
        wrong_words = page.evaluate('RPG.state.wrongWords')
        print(f'Wrong Words after reload: {wrong_words}')

        if 'TEST_WORD' in wrong_words:
            print('SUCCESS: Word persisted!')
        else:
            print('ERROR: Word did not persist!')

        browser.close()

if __name__ == '__main__':
    run_verification()

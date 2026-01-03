
from playwright.sync_api import sync_playwright
import os
import json

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        filepath = os.path.abspath('card/index.html')
        page.goto(f'file://{filepath}')

        # Initialize Game first
        page.evaluate('RPG.initNewGame()')

        # Modify State
        print('Adding TEST_WORD...')
        page.evaluate('RPG.state.wrongWords = ["TEST_WORD"]')
        # Manually save to persistent storage as per my code changes
        page.evaluate('localStorage.setItem("cardRpgVocab", JSON.stringify(["TEST_WORD"]))')

        # Reload
        print('Reloading page...')
        page.reload()

        # Initialize Game (Should auto-load)
        page.evaluate('RPG.initNewGame()')

        wrong_words = page.evaluate('RPG.state.wrongWords')
        print(f'Wrong Words after reload: {wrong_words}')

        if 'TEST_WORD' in wrong_words:
            print('SUCCESS: Word persisted!')
        else:
            print('ERROR: Word did not persist!')

        browser.close()

if __name__ == '__main__':
    run_verification()

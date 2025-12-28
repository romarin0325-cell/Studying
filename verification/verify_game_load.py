
from playwright.sync_api import sync_playwright
import os

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load local file
        # Note: Since I am in sandbox, I access file directly
        # I need absolute path.
        cwd = os.getcwd()
        url = f'file://{cwd}/card/index.html'
        print(f'Loading {url}')

        page.goto(url)

        # 1. Verify Title Screen
        page.screenshot(path='verification/title_screen.png')

        # 2. Start New Game
        page.get_by_role('button', name='새로하기').click()

        # 3. Verify Menu (Tickets should be 20)
        page.wait_for_selector('#screen-menu.active')
        ticket_text = page.locator('#ui-tickets').inner_text()
        print(f'Tickets: {ticket_text}')
        page.screenshot(path='verification/menu_screen.png')

        # 4. Open Deck and Verify
        page.get_by_role('button', name='덱 구성').click()
        page.wait_for_selector('#screen-deck.active')
        page.screenshot(path='verification/deck_screen.png')

        # Go back
        page.get_by_role('button', name='확인').click() # Might alert if empty?
        # Alert handling
        page.on('dialog', lambda dialog: dialog.dismiss())

        browser.close()

if __name__ == '__main__':
    run_verification()

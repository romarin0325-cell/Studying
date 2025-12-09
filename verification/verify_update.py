
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Load local file
        path = os.path.abspath('new.html')
        page.goto(f'file://{path}')

        # Select a character (e.g., Luna) to start
        page.click("button[onclick*='luna']")

        # Verify new button 'Time Library' exists in town-menu
        # The button text includes '시간의 도서관'
        time_btn = page.locator("button:has-text('시간의 도서관')")

        if time_btn.is_visible():
            print('Time Library button found!')
        else:
            print('Time Library button NOT found!')

        page.screenshot(path='verification/town_menu.png')

        # Click the button to enter dungeon
        time_btn.click()

        # Wait for battle to start (check log or enemy name)
        page.wait_for_selector('#vis-e-name')

        enemy_name = page.inner_text('#vis-e-name')
        print(f'Entered dungeon. Enemy: {enemy_name}')

        page.screenshot(path='verification/battle_start.png')

        browser.close()

if __name__ == '__main__':
    run()

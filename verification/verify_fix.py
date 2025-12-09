
from playwright.sync_api import sync_playwright
import os
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Load local file
        path = os.path.abspath('new.html')
        page.goto(f'file://{path}')

        print('Page loaded.')
        page.screenshot(path='verification/step1_loaded.png')

        # Wait for char modal
        try:
            page.wait_for_selector('#char-modal', state='visible', timeout=5000)
            print('Char modal visible.')
        except:
            print('Char modal NOT visible?')

        # Select Luna
        # We target the button that calls selectChar('luna')
        luna_btn = page.locator("button[onclick*='luna']")
        if luna_btn.count() > 0:
            print('Found Luna button.')
            luna_btn.click()
        else:
            print('Luna button not found.')

        # Wait for Town Menu
        try:
            page.wait_for_selector('#town-menu', state='visible', timeout=5000)
            print('Town menu visible.')
        except:
            print('Town menu NOT visible?')

        page.screenshot(path='verification/step2_town.png')

        # Check for Time Library button
        # Using exact ID or class might be hard as it has inline styles and text
        # Try finding by text content
        time_btn = page.get_by_role("button", name="🕰️ 시간의 도서관")

        if time_btn.is_visible():
            print('Time Library button found and visible.')
            time_btn.click()
        else:
            print('Time Library button NOT found or not visible.')
            # Fallback search
            page.evaluate("""
                const btns = Array.from(document.querySelectorAll('button'));
                const target = btns.find(b => b.innerText.includes('시간의 도서관'));
                if(target) console.log('Found via JS: ' + target.innerText);
                else console.log('Not found via JS');
            """)

        # Wait for battle
        try:
            page.wait_for_selector('#vis-e-name', timeout=5000)
            enemy = page.inner_text('#vis-e-name')
            print(f'Battle started against: {enemy}')
        except:
            print('Battle start timeout.')

        page.screenshot(path='verification/step3_battle.png')

        browser.close()

if __name__ == '__main__':
    run()

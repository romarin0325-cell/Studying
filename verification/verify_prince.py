
from playwright.sync_api import sync_playwright
import os

def run():
    # Because there is no web server, we load the file directly.
    file_path = f'file://{os.path.abspath("prince_maker/index.html")}'

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_viewport_size({"width": 800, "height": 600}) # Emulate game size

        page.goto(file_path)

        # START GAME FIRST
        page.click('button:has-text("열혈")') # Click a start button

        # 1. Take screenshot of initial state to check layout (Image height vs Log)
        page.screenshot(path='verification/init_state.png')

        # 2. Check CSS application
        # Check illustration area height
        ill_area = page.locator('#illustration-area')
        box = ill_area.bounding_box()
        print(f'Illustration Area Height: {box["height"]}')

        # 3. Simulate Rest to check dad dialogue
        # Click Rest -> Luxury Rest
        page.click('button:has-text("휴식")')
        page.wait_for_selector('#modal-action[style*="display: flex"]')

        # Take screenshot of menu
        page.screenshot(path='verification/menu_open.png')

        # Click Luxury Rest (Go to Dad) - id 'r_adv' usually has text '고급휴식'
        # In current logic, buttons are generated. We find button with '고급휴식'.
        page.click('button:has-text("고급휴식")')

        # Check log for Dad message
        # We need to wait a bit for log update if any animation, but it is sync in this code
        # Check the last log entry or search for specific text
        log_text = page.locator('#message-log').inner_text()
        print(f'Log content: {log_text}')

        page.screenshot(path='verification/after_rest.png')

        browser.close()

if __name__ == '__main__':
    run()

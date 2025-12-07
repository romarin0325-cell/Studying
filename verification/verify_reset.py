from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        cwd = os.getcwd()
        page.goto(f'file://{cwd}/new.html')

        # 1. Select Character (e.g., Luna) to enter town
        # The char-modal is active by default.
        luna_btn = page.locator('button', has_text='🌙 루나')
        if luna_btn.is_visible():
            luna_btn.click()
            # Wait for town menu to appear
            page.wait_for_selector('#town-menu', state='visible')

        # 2. Click 'Reset Game'
        reset_btn = page.locator('button', has_text='☠️ 게임 초기화 (Rebirth)')
        reset_btn.scroll_into_view_if_needed()
        reset_btn.click()

        # 3. Wait for modal to appear
        modal = page.locator('#reset-modal')
        modal.wait_for(state='visible')

        # 4. Take screenshot
        page.screenshot(path='verification/reset_modal.png')

        # 5. Check content
        soft_reset = modal.locator('button', has_text='현재 회차 재시작')
        hard_reset = modal.locator('button', has_text='완전 초기화')

        if soft_reset.is_visible() and hard_reset.is_visible():
            print('SUCCESS: Reset modal appeared with correct buttons.')
        else:
            print('FAILURE: Reset modal buttons not found.')

        browser.close()

if __name__ == '__main__':
    run()

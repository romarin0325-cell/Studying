from playwright.sync_api import sync_playwright, expect
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 400, 'height': 800})
        page = context.new_page()

        # Load the local HTML file
        page.goto("file://" + os.path.abspath("card/index.html"))

        # Wait for game to initialize and show title screen
        expect(page.locator("#screen-title")).to_be_visible()

        # Click "New Game"
        page.locator("button", has_text="새로하기").click()

        # 1. Verify Menu Screen Changes
        expect(page.locator("#screen-menu")).to_be_visible()

        # Check "Next Enemy" preview
        expect(page.locator("#next-enemy-preview")).to_contain_text("다음 상대:")

        # Check "Menu" button exists
        expect(page.locator("button", has_text="메뉴")).to_be_visible()

        # Check "Chaos Blessing" button exists (exact match to avoid ambiguity)
        expect(page.locator("button", has_text="혼돈의 축복").first).to_be_visible()

        # Screenshot Menu
        page.screenshot(path="verification/1_menu.png")
        print("Menu screenshot taken.")

        # 2. Verify Chaos Blessing Modal
        # Use exact text selector or ID if possible, or filtered locator
        page.locator("button", has_text="혼돈의 축복").first.click()
        expect(page.locator("#modal-chaos")).to_be_visible()
        page.screenshot(path="verification/2_chaos_modal.png")
        print("Chaos modal screenshot taken.")

        # Click "Normal" blessing
        page.locator("button", has_text="혼돈의 축복 (일반)").click()

        # Should show Info Modal with result
        expect(page.locator("#modal-info")).to_be_visible()
        expect(page.locator("#info-title")).to_have_text("축복 성공")
        page.screenshot(path="verification/3_chaos_result.png")
        print("Chaos result screenshot taken.")

        # Close Info Modal
        page.locator("#modal-info button", has_text="닫기").click()
        expect(page.locator("#modal-info")).not_to_be_visible()

        # 3. Verify System Menu
        page.locator("button", has_text="메뉴").click()
        expect(page.locator("#modal-menu")).to_be_visible()
        page.screenshot(path="verification/4_system_menu.png")
        print("System menu screenshot taken.")

        # Click Records
        page.locator("button", has_text="기록 확인").click()
        expect(page.locator("#modal-info")).to_be_visible()
        expect(page.locator("#info-title")).to_have_text("지난 5회 플레이 기록")
        page.screenshot(path="verification/5_records.png")
        print("Records screenshot taken.")

        browser.close()

if __name__ == "__main__":
    run()

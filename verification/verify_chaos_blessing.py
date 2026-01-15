
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    try:
        page.goto("http://localhost:8000/card/index.html", wait_until="domcontentloaded")

        # Click "새로하기" button to start game and go to menu
        # Look for button with text "새로하기" or check screen-title
        page.click("button[onclick=\"RPG.startGame('new')\"]")

        # Wait for menu screen to be active
        page.wait_for_selector("#screen-menu.active")

        # Click "축복의 제단"
        page.click("button[onclick=\"RPG.openChaosBlessing()\"]")

        # Wait for modal to appear
        page.wait_for_selector("#modal-chaos.active")

        # Take screenshot
        page.screenshot(path="verification/chaos_blessing_ui.png")
        print("Screenshot taken.")
    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)

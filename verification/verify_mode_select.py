
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080/card/index.html", wait_until="domcontentloaded")

        # Click "New Game" button
        page.click("button:has-text('새로하기')")

        # Wait for modal
        page.wait_for_selector("#modal-mode-select.active")

        # Take screenshot
        page.screenshot(path="verification/mode_select.png")

        browser.close()

if __name__ == "__main__":
    run()

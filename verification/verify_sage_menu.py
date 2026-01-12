from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load file via server
        url = "http://localhost:8000/card/index.html"
        print(f"Navigating to {url}")
        page.goto(url, wait_until='domcontentloaded')

        # Ensure #screen-menu is active (default might be screen-title)
        # Check if screen-title is active
        if page.locator("#screen-title.active").is_visible():
            print("Title screen active. Clicking '새로하기' (New Game)...")
            # Click "새로하기" (New Game)
            page.locator("button[onclick=\"RPG.startGame('new')\"]").click()

        # Now wait for menu screen
        print("Waiting for menu screen...")
        page.wait_for_selector("#screen-menu.active", timeout=5000)

        # Wait for button to be visible and click "축복의 제단"
        print("Clicking Chaos Blessing button...")
        btn = page.locator("button[onclick=\"RPG.openChaosBlessing()\"]")
        btn.wait_for(state="visible", timeout=10000)
        btn.click()

        # Wait for modal to be active
        print("Waiting for modal...")
        page.wait_for_selector("#modal-chaos.active", timeout=5000)

        # Take screenshot of the modal content
        print("Taking screenshot...")
        modal_content = page.locator("#modal-chaos .modal-content")
        modal_content.screenshot(path="verification/sage_menu.png")

        browser.close()

if __name__ == "__main__":
    run()

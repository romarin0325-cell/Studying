from playwright.sync_api import sync_playwright

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        import os
        cwd = os.getcwd()
        file_url = f"file://{cwd}/card/index.html"

        print(f"Navigating to {file_url}")
        page.goto(file_url)

        # 0. Start New Game first to reach menu
        page.get_by_text("새로하기").click()

        # 1. Verify Deck Config UI
        page.locator("#screen-menu button", has_text="덱 구성").click()

        page.screenshot(path="verification/deck_screen.png")
        print("Deck screen screenshot taken.")

        confirm_btn = page.locator("#screen-deck .menu-btn").last
        margin_bottom = confirm_btn.evaluate("el => getComputedStyle(el).marginBottom")
        print(f"Deck Confirm Button Margin Bottom: {margin_bottom}")
        if margin_bottom != "60px":
            print("ERROR: Deck button margin is not 60px")

        # Return to menu
        # Since deck is empty, confirm won't work. Use JS to go back.
        page.evaluate("toMenu()")

        # 2. Verify Battle UI
        # Setup deck
        page.evaluate("""
            if(typeof CARDS !== 'undefined' && CARDS.length > 0) {
                gameState.deck = [CARDS[0].id, CARDS[1].id, CARDS[2].id];
            }
        """)

        page.locator("#screen-menu button", has_text="전투 진입").click()

        page.screenshot(path="verification/battle_screen.png")
        print("Battle screen screenshot taken.")

        control_panel = page.locator("#battle-controls")
        margin_bottom_battle = control_panel.evaluate("el => getComputedStyle(el).marginBottom")
        print(f"Battle Control Panel Margin Bottom: {margin_bottom_battle}")

        if margin_bottom_battle != "60px":
             print("ERROR: Battle control panel margin is not 60px")

        browser.close()

if __name__ == "__main__":
    verify_changes()

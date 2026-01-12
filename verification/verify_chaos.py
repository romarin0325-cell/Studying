from playwright.sync_api import sync_playwright

def verify_chaos_blessing():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate using file path directly since http server is timing out
        import os
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/card/index.html")

        # Wait for game to load
        try:
            page.wait_for_selector("button.menu-btn", timeout=5000)
        except Exception as e:
            print(f"Game load check failed: {e}")
            page.screenshot(path="verification/failed_load.png")
            return

        # Start a new game
        page.get_by_role("button", name="새로하기").click()

        # Inject Chaos Blessing logic via console
        page.evaluate("""
            () => {
                // Ensure deck has Slime
                RPG.state.deck = ['slime', null, null];
                RPG.state.inventory = ['slime'];

                // Add Chaos Blessing (Multiplier 0.4 -> 40%)
                RPG.state.chaosBuffs = [{ id: 'slime', name: '슬라임', multiplier: 0.4 }];

                // Start Battle Init
                RPG.startBattleInit();
            }
        """)

        # Wait for battle screen
        page.wait_for_selector("#screen-battle.active")

        # Click on Player Portrait to show stats
        page.click("#player-actor-box")

        # Wait for Modal Info
        page.wait_for_selector("#modal-info.active")

        # Take screenshot of the modal to verify stats and color
        page.screenshot(path="verification/chaos_stat_check.png")

        # Also print the HTML content of the modal for text verification
        content = page.inner_html("#info-content")
        print(content)

        browser.close()

if __name__ == "__main__":
    verify_chaos_blessing()

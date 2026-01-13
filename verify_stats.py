from playwright.sync_api import sync_playwright

def verify_chaos_blessing():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 400, 'height': 800}) # Mobile view
        page = context.new_page()

        # 1. Load the game (waitUntil domcontentloaded)
        page.goto("http://localhost:8000/index.html", wait_until="domcontentloaded")

        # 2. Inject state to simulate battle with Luna and Blessing
        page.evaluate("""
            () => {
                // Ensure Luna is in deck
                const lunaId = 'luna';
                RPG.state.deck = [lunaId, null, null];
                RPG.state.inventory = [lunaId];

                // Set Chaos Blessing for Luna
                RPG.state.chaosBuffs = [{ id: lunaId, name: '루나', multiplier: 0.4 }];

                // Start battle
                RPG.startBattleInit();
            }
        """)

        # 3. Wait for battle screen
        page.wait_for_selector("#screen-battle.active")

        # 4. Click Player to see stats
        page.click("#player-actor-box")

        # 5. Wait for Modal Info
        page.wait_for_selector("#modal-info.active")

        # 6. Screenshot
        page.screenshot(path="verification_stats.png")

        # 7. Verify Content
        content = page.locator("#info-content").inner_html()
        print(content)

        browser.close()

if __name__ == "__main__":
    verify_chaos_blessing()

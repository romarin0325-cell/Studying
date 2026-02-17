import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Abort images/fonts to speed up
        page.route("**/*.{png,jpg,jpeg,gif,svg,woff,woff2}", lambda route: route.abort())

        # Load local file
        cwd = os.getcwd()
        file_path = f"file://{cwd}/card/index.html"
        try:
            page.goto(file_path, wait_until="domcontentloaded", timeout=10000)
        except Exception as e:
            print(f"Goto error (ignored): {e}")

        # Wait a bit for JS to init
        page.wait_for_timeout(2000)

        # Unlock everything to access Chaos Roulette
        page.evaluate("""
            if(typeof RPG !== 'undefined') {
                RPG.global.unlocked_bonus_cards = BONUS_CARDS.map(c => c.id);
                RPG.openChaosRoulette();
            }
        """)

        # Wait for transition
        page.wait_for_timeout(1000)

        # Take Screenshot
        page.screenshot(path="verification/chaos_roulette.png")

        browser.close()

if __name__ == "__main__":
    run()

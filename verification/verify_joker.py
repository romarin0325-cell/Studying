from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Abort fonts and images to speed up
            page.route("**/*.png", lambda route: route.abort())
            page.route("**/*fonts.googleapis.com*", lambda route: route.abort())
            page.route("**/*fonts.gstatic.com*", lambda route: route.abort())

            page.goto("http://localhost:8000/card/index.html", timeout=30000, wait_until="domcontentloaded")

            # Start Battle
            page.evaluate("RPG.startGame('new')")
            page.evaluate("RPG.state.deck = ['joker', 'joker', 'joker']")
            page.evaluate("RPG.startBattleInit()")

            # Use 'animations: "disabled"' if supported, but it's for 'screenshot' options?
            # style to disable fonts?
            page.add_style_tag(content="* { font-family: sans-serif !important; }")

            page.screenshot(path="verification/battle_screen.png", timeout=10000)

            page.evaluate("RPG.TurnManager.endPlayerTurn()")
            page.wait_for_timeout(2000)

            page.screenshot(path="verification/enemy_turn_done.png", timeout=10000)
            print("Screenshots taken")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()

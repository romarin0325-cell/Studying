from playwright.sync_api import sync_playwright
import time

def verify_game_load():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the game
        page.goto("http://localhost:8000/card/index.html", wait_until="domcontentloaded")

        # Wait for loading to finish - wait for the element to become hidden
        try:
            # The element #title-loading exists but gets hidden (display: none)
            page.wait_for_selector("#title-loading", state="hidden", timeout=10000)
            print("Loading completed successfully (element hidden).")
        except Exception as e:
            print(f"Loading did not complete within timeout: {e}")
            page.screenshot(path="verification_load_fail_2.png")
            browser.close()
            return

        # Check if GameAPI is defined
        is_game_api_defined = page.evaluate("typeof GameAPI !== 'undefined'")
        print(f"GameAPI defined: {is_game_api_defined}")

        if not is_game_api_defined:
            print("Error: GameAPI is NOT defined.")

        # Check if LUMI_PERSONA is defined
        is_lumi_persona_defined = page.evaluate("typeof LUMI_PERSONA !== 'undefined'")
        print(f"LUMI_PERSONA defined: {is_lumi_persona_defined}")

        if not is_lumi_persona_defined:
            print("Error: LUMI_PERSONA is NOT defined.")

        page.screenshot(path="verification_success.png")

        browser.close()

if __name__ == "__main__":
    verify_game_load()

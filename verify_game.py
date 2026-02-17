from playwright.sync_api import sync_playwright

def verify_game_flow():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 412, 'height': 915}) # Mobile viewport
        page = context.new_page()
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))

        print("Navigating to game...")
        page.goto("http://localhost:8000/card/index.html", wait_until='networkidle')

        # Wait for loading
        try:
            page.wait_for_selector("#btn-start-new:not([disabled])", timeout=20000)
        except:
            print("Loading timed out or failed.")
            missing = page.evaluate("() => RPG.getMissingRequiredData().map(d => d.name)")
            print(f"Missing data: {missing}")
            is_disabled = page.evaluate("document.getElementById('btn-start-new').disabled")
            print(f"Button disabled: {is_disabled}")
            page.screenshot(path="timeout.png")
            browser.close()
            return

        print("Clicking New Game...")
        page.click("#btn-start-new")

        # Verify Type Select
        print("Verifying Type Select Modal...")
        page.wait_for_selector("#modal-type-select.active")
        page.screenshot(path="type_select.png")

        # Test Endless Mode
        print("Selecting Endless Mode...")
        page.click("button:has-text('무한 모드')")

        page.wait_for_selector("#modal-mode-select.active")
        page.screenshot(path="mode_select_endless.png")

        # Verify specific modes are present
        origin_btn = page.query_selector("#mode-btn-origin")
        draft_btn = page.query_selector("#mode-btn-draft")
        chaos_btn = page.query_selector("#mode-btn-chaos")
        restriction_btn = page.query_selector("#mode-btn-restriction")

        if origin_btn and draft_btn and chaos_btn and not restriction_btn:
            print("Endless Mode filtering correct: Origin, Draft, Chaos present. Restriction absent.")
        else:
            print("Endless Mode filtering FAILED.")
            if origin_btn: print("Origin present")
            if draft_btn: print("Draft present")
            if chaos_btn: print("Chaos present")
            if restriction_btn: print("Restriction present")

        # Reload for Challenge Mode Test
        print("Reloading for Challenge Mode test...")
        page.reload()
        page.wait_for_selector("#btn-start-new:not([disabled])")
        page.click("#btn-start-new")

        print("Selecting Challenge Mode...")
        page.wait_for_selector("#modal-type-select.active")
        page.click("button:has-text('도전 모드')")

        page.wait_for_selector("#modal-mode-select.active")
        page.screenshot(path="mode_select_challenge.png")

        # Verify specific modes
        origin_btn = page.query_selector("#mode-btn-origin")
        restriction_btn = page.query_selector("#mode-btn-restriction")

        if not origin_btn and restriction_btn:
            print("Challenge Mode filtering correct: Origin absent. Restriction present.")
        else:
             print("Challenge Mode filtering FAILED.")
             if origin_btn: print("Origin present")
             if restriction_btn: print("Restriction present")

        browser.close()

if __name__ == "__main__":
    verify_game_flow()

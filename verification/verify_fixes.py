from playwright.sync_api import sync_playwright
import time

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 400, 'height': 800})
        page = context.new_page()

        # 1. Load Game
        print("Navigating...")
        page.goto("http://localhost:8000/card/index.html", wait_until="domcontentloaded", timeout=60000)

        print("Waiting for title...")
        try:
            page.wait_for_selector("#screen-title.active", timeout=10000)
        except:
            print("Failed to load title screen")
            page.screenshot(path="verification/failed_load.png")
            return

        # 2. Inject Unlock for Chaos Roulette
        print("Injecting unlock...")
        page.evaluate("""
            () => {
                if(typeof BONUS_CARDS !== 'undefined') {
                    RPG.global.unlocked_bonus_cards = BONUS_CARDS.map(c => c.id);
                    RPG.saveGlobalData();
                }
            }
        """)

        # Reload to apply unlock
        print("Reloading...")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_selector("#screen-title.active")

        # 3. Start New Game -> Open Mode Select
        print("Starting New Game...")
        page.click("button:has-text('새로하기')")

        # Handle Daily Reward Alert if present
        try:
            # Wait a bit for alert to appear
            page.wait_for_selector("#modal-info.active", timeout=2000)
            print("Alert detected, closing...")
            page.click("#modal-info button:has-text('닫기')")
            page.wait_for_selector("#modal-info.active", state="hidden")
        except:
            print("No alert detected or timed out.")

        page.wait_for_selector("#modal-mode-select.active")

        # 4. Open Chaos Roulette
        print("Opening Chaos Roulette...")
        if page.is_visible("#btn-chaos-roulette"):
            page.click("#btn-chaos-roulette")
            page.wait_for_selector("#screen-chaos-roulette.active")
            print("Entered Chaos Roulette")
        else:
            print("Chaos Roulette button not visible!")
            page.screenshot(path="verification/failed_chaos_btn.png")
            return

        # 5. Verify Back Button
        print("Clicking Back...")
        page.click("#screen-chaos-roulette button:has-text('돌아가기')")

        # 6. Expect Title Screen AND Mode Select Modal
        try:
            page.wait_for_selector("#screen-title.active", timeout=2000)
            page.wait_for_selector("#modal-mode-select.active", timeout=2000)
            print("PASS: Chaos Roulette Back Button returned to Mode Select Modal on Title Screen")
        except:
            print("FAIL: Did not return to expected state")
            page.screenshot(path="verification/failed_back.png")

        # 7. Verify Next Enemy Description
        print("Entering Origin Mode...")
        # Enter Origin Mode
        # The modal should still be active
        # Check if modal is active
        if not page.is_visible("#modal-mode-select.active"):
             print("Modal closed unexpectedly?")
             # Maybe open it again?
             page.click("button:has-text('새로하기')")

        page.click("button:has-text('오리진')")
        page.click("#btn-enter-mode")

        # Confirm 1
        print("Confirm 1...")
        page.click("#confirm-yes")

        # Confirm 2
        print("Confirm 2...")
        page.wait_for_timeout(500)
        page.click("#confirm-yes")

        # Wait for menu
        print("Waiting for menu...")
        page.wait_for_selector("#screen-menu.active")

        # Check Text
        text = page.inner_text("#next-enemy-text")
        print(f"Next Enemy Text: '{text}'")

        if "Stage" in text:
            print("FAIL: Stage info still present")
        else:
            print("PASS: Stage info removed")

        page.screenshot(path="verification/fix_verification.png")

        browser.close()

if __name__ == "__main__":
    verify()

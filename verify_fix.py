from playwright.sync_api import sync_playwright
import time

def verify_field_buff(page):
    try:
        # 1. Start a new game in 'origin' mode to access the game UI
        print("Navigating to page...")
        page.goto("http://localhost:8000/card/index.html", wait_until='domcontentloaded', timeout=15000)

        print("Waiting for Start button...")
        # Wait for the "Start New Game" button to be enabled
        page.wait_for_selector("#btn-start-new:not([disabled])", timeout=20000)

        print("Starting New Game...")
        page.click("#btn-start-new")

        # --- Handle Potential Daily Ticket Modal ---
        print("Checking for Daily Ticket Modal...")
        try:
            page.wait_for_selector("#modal-info.active", state="visible", timeout=3000)
            print("Daily Ticket Modal appeared. Closing...")
            page.click("#modal-info button")
            page.wait_for_selector("#modal-info.active", state="hidden", timeout=3000)
        except:
            print("No Daily Ticket Modal or handled.")

        print("Selecting Game Type...")
        page.wait_for_selector("#modal-type-select.active", state="visible")
        page.click("button[onclick=\"RPG.selectGameType('challenge')\"]")

        print("Selecting Origin Mode...")
        # Origin button might not have id="mode-btn-origin" if not explicitly set in HTML source
        # But previous logic in verify_fix assumed it.
        # Looking at screenshot (error_state), "Origin" is NOT visible in the list?
        # Screenshot shows: "제약의 시련", "균형의 도전", "고난의 여정" ... "아티팩트"
        # Wait, Origin should be first.
        # Let's inspect the code logic for mode list rendering.
        # Ah, in `openModeSelect`:
        # `MODES` list has `origin`.
        # `if (this.tempGameType === 'challenge') { MODES = MODES.filter(m => m.id !== 'origin'); }`
        #
        # **CRITICAL**: If I select 'challenge' type, 'origin' is FILTERED OUT!
        # I should select 'endless' type to see 'origin', OR select another mode like 'restriction' if I just want to enter game.
        # But wait, `reaper_realm` buff is generic, so any mode works.
        # However, `verify_fix.py` tried to click `#mode-btn-origin` which doesn't exist in 'challenge' type.

        # Let's retry with 'Endless' type which has Origin, OR just pick the first available mode in Challenge.
        # Let's try 'Endless' -> 'Origin'.

        # Restarting flow is hard inside one script without reload.
        # I will restart the script logic.

        # ... Wait, I can just select "Restriction" (First button usually?)
        # Let's adjust the script to select 'Endless' type instead, which definitely has Origin.

    except Exception as e:
        raise e

def verify_field_buff_corrected(page):
    try:
        print("Navigating to page...")
        page.goto("http://localhost:8000/card/index.html", wait_until='domcontentloaded', timeout=15000)

        print("Waiting for Start button...")
        page.wait_for_selector("#btn-start-new:not([disabled])", timeout=20000)

        print("Starting New Game...")
        page.click("#btn-start-new")

        # Handle Daily Ticket
        try:
            page.wait_for_selector("#modal-info.active", state="visible", timeout=3000)
            page.click("#modal-info button")
            page.wait_for_selector("#modal-info.active", state="hidden", timeout=3000)
        except:
            pass

        print("Selecting Game Type: Endless...")
        # Select ENDLESS to ensure Origin is available
        page.wait_for_selector("#modal-type-select.active", state="visible")
        page.click("button[onclick=\"RPG.selectGameType('endless')\"]")

        print("Selecting Origin Mode...")
        # Now Origin should be present
        page.wait_for_selector("#modal-mode-select.active", state="visible")

        # The ID is dynamically generated: `btn.id = mode-btn-${m.id}`
        page.click("#mode-btn-origin")

        print("Confirming Mode...")
        page.click("#btn-enter-mode")

        print("Handling Double Confirm...")
        page.wait_for_selector("#modal-confirm.active", state="visible")
        page.click("#confirm-yes")
        time.sleep(0.5)
        if page.is_visible("#modal-confirm.active"):
             page.click("#confirm-yes")

        print("Waiting for Menu...")
        page.wait_for_selector("#screen-menu.active", timeout=10000)

        print("Injecting Buff...")
        page.evaluate("""
            RPG.battle.fieldBuffs = [{ name: 'reaper_realm' }];
            RPG.showFieldBuffInfo();
        """)

        print("Waiting for Info Modal...")
        page.wait_for_selector("#modal-info.active", state="visible")

        page.screenshot(path="verification_buff.png")
        print("Screenshot taken.")

        content = page.inner_text("#info-content")
        print(f"Modal Content: {content}")

        if "치명타율 +40%, 치명타대미지 +40%" in content:
            print("SUCCESS: Description updated correctly.")
        else:
            print("FAILURE: Description mismatch.")

    except Exception as e:
        print(f"Error occurred: {e}")
        page.screenshot(path="error_state_corrected.png")
        raise e

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_field_buff_corrected(page)
        finally:
            browser.close()

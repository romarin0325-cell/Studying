from playwright.sync_api import sync_playwright
import time

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the game via localhost
        print("Loading game...")
        try:
            page.goto("http://localhost:8000/card/index.html", wait_until="domcontentloaded", timeout=60000)
        except Exception as e:
            print(f"Error loading page: {e}")
            return

        # Wait for game to initialize (wait for TOEIC_DATA to be available)
        time.sleep(5)

        print("Starting new game...")
        page.evaluate("RPG.initNewGame('origin')")
        time.sleep(1)

        print("Starting TOEIC Practice...")
        page.evaluate("RPG.startToeicPractice()")
        time.sleep(1)

        # Force finish session to get to result
        print("Finishing session...")
        page.evaluate("RPG.finishToeicSession()")
        time.sleep(1)

        # Open Review
        print("Opening Review...")
        page.evaluate("RPG.openToeicReview()")
        time.sleep(1)

        # Close Review Hub (simulating exit)
        print("Closing Review Hub (simulating exit)...")
        page.evaluate("document.getElementById('modal-toeic-practice').classList.remove('active'); RPG.toMenu();")
        time.sleep(1)

        # Start TOEIC Practice AGAIN
        print("Starting TOEIC Practice again (New Session)...")
        page.evaluate("RPG.startToeicPractice()")
        time.sleep(1)

        # Verify Review Hub is NOT visible
        is_review_hub_visible = page.evaluate("document.getElementById('toeic-review-hub').style.display !== 'none'")
        print(f"Review Hub Visible: {is_review_hub_visible}")

        # Take Screenshot
        page.screenshot(path="toeic_bug_fix_verification.png")
        print("Screenshot saved to toeic_bug_fix_verification.png")

        browser.close()

if __name__ == "__main__":
    verify_frontend()

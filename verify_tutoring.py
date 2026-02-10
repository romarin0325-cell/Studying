import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        cwd = os.getcwd()
        file_path = f"file://{cwd}/card/index.html"

        print(f"Navigating to {file_path}")
        page.goto(file_path, wait_until="domcontentloaded")

        print("Clicking New Game...")
        page.get_by_role("button", name="새로하기").click()

        # Check for Daily Reward Alert
        try:
            # Short timeout to check for alert
            page.wait_for_selector("#modal-info.active", state="visible", timeout=2000)
            print("Daily Reward Alert detected. Closing...")
            page.click("#modal-info button") # Close button
            page.wait_for_selector("#modal-info.active", state="hidden")
        except:
            print("No initial alert detected.")

        print("Selecting Mode...")
        page.wait_for_selector("#mode-btn-origin")
        page.click("#mode-btn-origin")
        page.click("#btn-enter-mode")

        print("Confirming Mode...")
        page.wait_for_selector("#modal-confirm.active")
        page.click("#confirm-yes")

        # Wait for menu
        page.wait_for_selector("#screen-menu.active")

        print("Clicking Library...")
        page.evaluate("RPG.openLibrary()")

        page.wait_for_selector("#modal-library.active")
        page.screenshot(path="library_menu.png")
        print("Captured library_menu.png")

        # Inject wrong words
        print("Injecting wrong words...")
        page.evaluate("RPG.state.wrongWords = ['apple']")

        print("Clicking Tutoring...")
        page.click("//button[contains(text(), '루미의 개인과외')]")

        page.wait_for_selector("#modal-tutoring.active")
        page.screenshot(path="tutoring_modal.png")
        print("Captured tutoring_modal.png")

        browser.close()

if __name__ == "__main__":
    run()


import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Abort images and fonts
        page.route("**/*", lambda route: route.abort() if route.request.resource_type in ["image", "font"] else route.continue_())

        page.on("dialog", lambda d: print(f"Dialog: {d.message}"))

        cwd = os.getcwd()
        file_path = os.path.join(cwd, 'card', 'index.html')
        url = f"file://{file_path}"

        print(f"Navigating to {url}")
        page.goto(url, wait_until="domcontentloaded")

        start_btn = page.get_by_role("button", name="새로하기")
        if start_btn.is_visible():
            print("Start Game button visible. Clicking...")
            start_btn.click()

            try:
                # Check for Mode Select Modal
                page.wait_for_selector("#modal-mode-select", state="visible", timeout=3000)
                print("Successfully opened Mode Select modal.")
            except:
                print("Timeout waiting for Mode Select modal.")

        page.screenshot(path="verification/verification.png")
        browser.close()

if __name__ == "__main__":
    run()

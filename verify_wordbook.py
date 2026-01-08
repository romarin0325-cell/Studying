
import os
from playwright.sync_api import sync_playwright

def verify_wordbook():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load local file
        file_path = os.path.abspath("card/index.html")
        # Wait for domcontentloaded to avoid waiting for fonts/images
        page.goto(f"file://{file_path}", wait_until="domcontentloaded")

        print("Loaded page")

        # Open Library
        # Wait a bit for scripts to execute if needed
        page.wait_for_timeout(1000)

        page.evaluate("RPG.openLibrary()")
        print("Opened Library")

        # Open Wordbook
        page.evaluate("RPG.openWordbook()")
        print("Opened Wordbook")

        # Check for new word 'access'
        # Wait for modal to be active
        page.wait_for_selector("#modal-wordbook.active")

        content = page.content()
        if "access" in content:
            print("Found 'access' in wordbook")
        else:
            print("FAILED: 'access' not found")

        # Check filter checkbox exists
        checkbox = page.locator("#wordbook-filter-wrong")
        if checkbox.count() > 0:
            print("Found filter checkbox")
        else:
            print("FAILED: Filter checkbox not found")

        # Take screenshot of all words
        page.screenshot(path="verification_wordbook_all.png")

        # Toggle filter (should show nothing as no wrong words)
        checkbox.check()
        print("Checked filter")

        # Verify list is empty (or at least access is hidden if not wrong)
        # RPG.openWordbook() is called by onchange
        page.wait_for_timeout(500)

        content_filtered = page.locator("#wordbook-list").inner_text()
        if "access" not in content_filtered:
            print("Filter working: 'access' hidden")
        else:
            print("FAILED: 'access' still visible despite filter (and not wrong)")

        # Now mark 'access' as wrong
        page.evaluate("RPG.state.wrongWords = ['access']; RPG.openWordbook();")
        print("Marked 'access' as wrong and refreshed")

        page.wait_for_timeout(500)

        content_wrong = page.locator("#wordbook-list").inner_text()
        if "access" in content_wrong:
            print("Filter working: 'access' visible when wrong")
        else:
            print("FAILED: 'access' not visible even when wrong")

        page.screenshot(path="verification_wordbook_filtered_wrong.png")

        browser.close()

if __name__ == "__main__":
    verify_wordbook()

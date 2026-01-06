from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load via HTTP
    print("Navigating...")
    try:
        page.goto("http://localhost:8000/card/index.html", wait_until='domcontentloaded', timeout=10000)
    except Exception as e:
        print(f"Navigation error: {e}")

    # 1. Check Main Menu for Library button
    print("Checking Main Menu...")
    try:
        page.locator("button:has-text('새로하기')").click(timeout=2000)
        page.wait_for_timeout(500)

        library_btn = page.locator("button:has-text('도서관')")
        if library_btn.is_visible():
            print("PASS: Library button found.")
        else:
            print("FAIL: Library button not found.")

        # 2. Open Library
        print("Opening Library...")
        library_btn.click()
        page.wait_for_timeout(500)

        # Check Library Content
        magic_class_btn = page.locator("button:has-text('루미의 마법교실')")
        wordbook_btn = page.locator("#modal-library button:has-text('단어장')")

        if magic_class_btn.is_visible() and wordbook_btn.is_visible():
            print("PASS: Library menu items found.")
        else:
            print("FAIL: Library menu items missing.")

        # 3. Check Chaos Blessing (Close Library First)
        page.locator("#modal-library button:has-text('닫기')").click()
        page.wait_for_timeout(500)

        print("Checking Chaos Blessing...")
        # Use more specific locator for the main menu button
        chaos_btn = page.locator("#screen-menu button:has-text('혼돈의 축복')")
        chaos_btn.click()
        page.wait_for_timeout(500)

        sage_btn = page.locator("button:has-text('대현자의 축복')")
        if sage_btn.is_visible():
            print("PASS: Great Sage Blessing button found.")
        else:
            print("FAIL: Great Sage Blessing button not found.")

        # Take screenshot of Chaos Modal
        page.screenshot(path="verification/ui_check.png")
        print("Screenshot saved to verification/ui_check.png")

    except Exception as e:
        print(f"Interaction error: {e}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

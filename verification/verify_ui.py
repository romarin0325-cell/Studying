from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load the local HTML file
    cwd = os.getcwd()
    page.goto(f"file://{cwd}/card/index.html")

    # 1. Check Main Menu for Library button
    print("Checking Main Menu...")
    page.locator("button:has-text('새로하기')").click()
    page.wait_for_timeout(500) # Wait for animation/transition

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

    # Close Library
    page.locator("#modal-library button:has-text('닫기')").click()
    page.wait_for_timeout(500)

    # 3. Check Chaos Blessing
    print("Checking Chaos Blessing...")
    chaos_btn = page.locator("button:has-text('혼돈의 축복')")
    chaos_btn.click()
    page.wait_for_timeout(500)

    sage_btn = page.locator("button:has-text('대현자의 축복')")
    if sage_btn.is_visible():
        print("PASS: Great Sage Blessing button found.")
    else:
        print("FAIL: Great Sage Blessing button not found.")

    # Take screenshot
    page.screenshot(path="verification/ui_check.png")
    print("Screenshot saved to verification/ui_check.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

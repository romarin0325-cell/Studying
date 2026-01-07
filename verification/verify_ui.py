from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load local file
        page.goto("http://localhost:8080/card/index.html", timeout=60000, wait_until="domcontentloaded"); page.evaluate("RPG.toMenu()")

        # 1. Verify Main Menu Rename
        # Check if button text is "축복의 제단" (Altar of Blessings)
        # Note: In HTML it is literally inside the button.
        # <button ...>축복의 제단</button>
        menu_btn = page.locator("button.menu-btn", has_text="축복의 제단")
        expect(menu_btn).to_be_visible()
        print("Verified: Main Menu Button renamed to '축복의 제단'")

        # 2. Click it to open Modal
        menu_btn.click()

        # 3. Verify Modal Header Counters
        # HTML: <div ...>혼돈의 축복: <span id="chaos-uses">3</span>회 / 대현자의 축복: <span id="sage-uses">3</span>회</div>
        header_text = page.locator("#modal-chaos div").filter(has_text="혼돈의 축복:").nth(1)
        expect(header_text).to_be_visible()
        expect(header_text).to_contain_text("대현자의 축복:")
        print("Verified: Modal Header contains both counters")

        # 4. Verify Great Sage Button Text (Should NOT have usage count anymore)
        # Button text: "대현자의 축복" (and the span inside). usage count div was removed.
        # We check that it does NOT contain "(남은 기회:"
        sage_btn = page.locator("#modal-chaos button", has_text="대현자의 축복")
        text = sage_btn.text_content()
        if "(남은 기회:" not in text:
            print("Verified: Great Sage Button does not contain usage count text")
        else:
            print("FAILED: Great Sage Button still contains usage count text")

        # Screenshot
        page.screenshot(path="verification/ui_check.png")

        browser.close()

run()

from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load the local file
    file_path = os.path.abspath("prince_maker/index.html")
    page.goto(f"file://{file_path}")

    # 1. Verify HP removal from Header
    # Header should not contain "HP:" text visible or #ui-hp element should be removed/hidden?
    # Actually I removed the #ui-hp element in HTML.
    # Let's check if #ui-hp exists.
    try:
        hp_elem = page.locator("#ui-hp")
        if hp_elem.count() > 0:
            print("Warning: #ui-hp element still exists!")
        else:
            print("Success: #ui-hp element removed.")
    except Exception as e:
        print(f"Check HP: {e}")

    # 2. Verify Image Layout
    # Check #illustration-area flex ratio or size?
    # It's hard to check computed styles in simple print, but screenshot will show.
    # Check if #main-image-container exists
    container = page.locator("#main-image-container")
    if container.count() > 0:
        print("Success: #main-image-container exists.")

    # 3. Verify Vertical Start Screen
    # Start screen buttons should be stacked.
    # We can check bounding boxes.
    buttons = page.locator("#start-screen .personality-select button")
    if buttons.count() > 1:
        box1 = buttons.nth(0).bounding_box()
        box2 = buttons.nth(1).bounding_box()
        if box1 and box2:
            if box2['y'] > box1['y']:
                print("Success: Start screen buttons are vertically stacked.")
            else:
                print("Warning: Start screen buttons might not be vertical.")

    # 4. Take Screenshot of Start Screen
    page.screenshot(path="verification/start_screen.png")

    # 5. Start Game and check Log layout & Image fallback
    # Click 'Heat' (first button)
    buttons.nth(0).click()

    # Wait for game init
    page.wait_for_timeout(1000)

    # Check Log Window size vs Image Area
    # This is visual, screenshot will help.
    page.screenshot(path="verification/game_main.png")

    # 6. Check Fortune Reroll Bug
    # Click 'Menu' -> 'Fortune' (System Menu -> Fortune)
    # Open System Menu
    page.get_by_text("메뉴").click()
    page.wait_for_timeout(500)

    # Click Fortune
    page.get_by_text("운세 뽑기").click()
    page.wait_for_timeout(500)

    # Check rerolls = 3
    rerolls = page.locator("#reroll-count").text_content()
    print(f"Initial Rerolls: {rerolls}")

    # Reroll once
    page.get_by_text("운세 다시 뽑기").click()
    page.wait_for_timeout(500)
    rerolls_after = page.locator("#reroll-count").text_content()
    print(f"Rerolls after 1 click: {rerolls_after}")

    # If I close and reopen, it should NOT reset to 3.
    # But wait, there is no close button in Fortune Modal in original code except 'Confirm'.
    # If I confirm, it sets the star and closes.
    # If I could close it without confirming... The original code didn't have a close button for fortune modal.
    # The 'System Menu' has 'Fortune', which calls 'openFortuneMenu'.
    # If I reload the page or restart turn, it resets.
    # But the bug was "Clicking menu again adds 3 rerolls".
    # I can try to call openFortuneMenu() again via console or if I can trigger it.
    # Let's try to close the modal by hiding it (simulating 'Cancel' if it existed) or just calling the function again.

    # Simulating calling openFortuneMenu again
    page.evaluate("GAME.openFortuneMenu()")
    page.wait_for_timeout(500)
    rerolls_reopen = page.locator("#reroll-count").text_content()
    print(f"Rerolls after reopening: {rerolls_reopen}")

    if rerolls_reopen == rerolls_after:
        print("Success: Rerolls did not reset.")
    else:
        print("Failure: Rerolls reset!")

    page.screenshot(path="verification/fortune_test.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

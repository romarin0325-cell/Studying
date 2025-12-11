from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load the local HTML file
    file_path = os.path.abspath("new.html")
    page.goto(f"file://{file_path}")

    # 1. Select a character to start
    page.click("text=🌙 루나 (암살자)")

    # 2. Mock localStorage to unlock Hidden Dungeon
    # We need all boss artifacts: hestia, dream_choco, blue_moon, dragon_scale, pharaoh, dark_pendant
    unlocks = ['hestia', 'dream_choco', 'blue_moon', 'dragon_scale', 'pharaoh', 'dark_pendant']
    unlock_str = str(unlocks).replace("'", '"') # JSON format

    page.evaluate(f"localStorage.setItem('turnRpgBossDrops', '{unlock_str}')")

    # Refresh to apply unlock check in updateTownUI (need to call updateTownUI or reload)
    # Reloading will show char select again unless we save state.
    # Easier to just call updateTownUI manually via evaluate
    page.evaluate("updateTownUI()")

    # 3. Verify the button exists and is visible
    hidden_btn = page.locator("#btn-hidden-dungeon")
    if hidden_btn.is_visible():
        print("Hidden Dungeon button is visible!")
    else:
        print("Hidden Dungeon button is NOT visible.")

    # 4. Enter Hidden Dungeon
    page.click("#btn-hidden-dungeon")

    # 5. Verify Boss Name (Iris Light)
    boss_name = page.locator("#vis-e-name").inner_text()
    print(f"Boss Name: {boss_name}")

    if "사랑의 여신 아이리스" in boss_name:
        print("Successfully entered Hidden Dungeon against Iris Light.")

    # Take screenshot
    page.screenshot(path="verification/hidden_dungeon_test.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

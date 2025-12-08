from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    # Load the local HTML file
    cwd = os.getcwd()
    page.goto(f"file://{cwd}/new.html")

    # Wait for the town menu to be visible (after selecting a character)
    # We first need to select a character
    page.click("button[onclick=\"selectChar('luna')\"]")

    # Wait for the town menu
    page.wait_for_selector("#town-menu")

    # Verify new buttons exist
    # Dessert Kingdom
    dessert_btn = page.locator("button[onclick=\"enterEventDungeon('dessert')\"]")
    if dessert_btn.is_visible():
        print("Dessert Kingdom button is visible.")
    else:
        print("Dessert Kingdom button NOT visible.")

    # Magic Empire
    magic_btn = page.locator("button[onclick=\"enterEventDungeon('magic')\"]")
    if magic_btn.is_visible():
        print("Magic Empire button is visible.")
    else:
        print("Magic Empire button NOT visible.")

    # Open Shop to check for Gacha
    page.click("button[onclick=\"openShop()\"]")
    page.wait_for_selector("#shop-modal.active")

    gacha_btn = page.locator("button[onclick=\"rollEpicArtifact()\"]")
    if gacha_btn.is_visible():
        print("Epic Gacha button is visible.")
    else:
        print("Epic Gacha button NOT visible.")

    # Take screenshot
    page.screenshot(path="verification/ui_check.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

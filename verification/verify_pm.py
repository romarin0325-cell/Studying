from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Get absolute path to the file
    cwd = os.getcwd()
    file_path = f"file://{cwd}/prince_maker/index.html"

    print(f"Navigating to {file_path}")
    page.goto(file_path)

    # Wait for game to initialize
    page.wait_for_selector("#start-screen")

    # Start game (Click Heat personality)
    page.click("text=열혈")

    # Wait for Star Modal (It appears at start of season)
    print("Waiting for Star Modal...")
    page.wait_for_selector("#modal-star")
    page.screenshot(path="verification/star_modal.png")

    # Click Confirm Star
    page.click("text=확정")

    # Wait for main UI to be interactable (modal hidden)
    page.wait_for_selector("#modal-star", state="hidden")

    # Take screenshot of main game
    page.screenshot(path="verification/main_game.png")
    print("Main game captured")

    # Open Menu -> Job
    page.click("text=알바")
    page.wait_for_selector("#modal-action")
    page.wait_for_timeout(500)

    # Screenshot Modal
    page.screenshot(path="verification/action_modal.png")
    print("Action modal captured")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

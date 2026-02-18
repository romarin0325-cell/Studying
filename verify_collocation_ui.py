from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # helper to resolve local file path
    cwd = os.getcwd()
    file_path = f"file://{cwd}/card/index.html"

    print(f"Navigating to {file_path}")
    page.goto(file_path, wait_until='domcontentloaded')

    # Wait for the page to load and data to be available
    # We can check if COLLOCATION_DATA is defined
    try:
        page.wait_for_function("() => typeof COLLOCATION_DATA !== 'undefined'")
        print("COLLOCATION_DATA loaded.")
    except Exception as e:
        print(f"Error waiting for data: {e}")
        page.screenshot(path="error_state.png")
        browser.close()
        return

    # Check the length of COLLOCATION_DATA
    data_length = page.evaluate("COLLOCATION_DATA.length")
    print(f"COLLOCATION_DATA length: {data_length}")

    if data_length == 80:
        print("Verification Successful: Data length is 80.")
    else:
        print(f"Verification Failed: Expected 80, got {data_length}")

    # Inspect the last item
    last_item = page.evaluate("COLLOCATION_DATA[COLLOCATION_DATA.length - 1]")
    print(f"Last item: {last_item['expression']}")

    if last_item['expression'] == "take place":
        print("Verification Successful: Last item matches.")
    else:
        print(f"Verification Failed: Last item is {last_item['expression']}")

    # Take a screenshot of the main menu
    page.screenshot(path="main_menu.png")

    # Try to start the quiz
    # We need to make sure the game is in a state where we can start the quiz.
    # Usually startCollocationQuiz is global or attached to window/RPG.
    # Based on memory, startCollocationQuiz is a global function.

    try:
        # Check if RPG exists
        page.evaluate("if (typeof RPG === 'undefined') throw new Error('RPG not found');")

        # Call it
        page.evaluate("RPG.startCollocationQuiz(() => {})")

        # Wait for modal to appear
        page.wait_for_selector("#modal-quiz", state="visible")

        # Take a screenshot of the quiz
        page.screenshot(path="quiz_modal.png")
        print("Quiz modal opened successfully.")

    except Exception as e:
        print(f"Error starting quiz: {e}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

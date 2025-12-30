import os
import re
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the file
        cwd = os.getcwd()
        file_path = f"file://{cwd}/card/index.html"
        print(f"Loading {file_path}")
        page.goto(file_path)

        # CLICK "새로하기" to start game and reach menu
        print("Clicking New Game...")
        page.click("button:has-text('새로하기')")

        # Now we are in the menu screen.
        # Wait for menu screen to be active
        page.wait_for_selector("#screen-menu.active")

        # 1. Verify Attempt Count in Modal
        # Open Chaos Blessing Modal
        print("Opening Chaos Blessing...")
        # Use exact text or id if possible. The button has text "혼돈의 축복"
        page.click("button:has-text('혼돈의 축복')")

        # Wait for modal
        page.wait_for_selector("#modal-chaos.active")

        # Check text "남은 기회: 3회"
        # The span id is 'chaos-uses'
        element = page.locator("#chaos-uses")
        text = element.inner_text()
        print(f"Chaos Uses: {text}")

        # Take screenshot of the modal with 3 uses
        page.screenshot(path="verification/verification_uses.png")

        if text != "3":
            print("FAIL: Expected 3 uses.")

        # 2. Start Quiz
        # Click "혼돈의 축복 (도전)" button
        # It calls RPG.activateChaos('challenge')
        print("Starting Quiz...")
        page.click("button:has-text('혼돈의 축복 (도전)')")

        # Wait for quiz modal
        page.wait_for_selector("#modal-quiz.active")

        # 3. Verify Quiz Content
        # Question should be Korean (meaning)
        # Options should be English (words)

        question_el = page.locator("#quiz-question")
        question_text = question_el.inner_text()
        print(f"Question: {question_text}")

        options_el = page.locator("#quiz-options button")
        count = options_el.count()
        print(f"Option count: {count}")

        first_option = options_el.first.inner_text()
        print(f"First Option: {first_option}")

        # Basic heuristic:
        # English usually matches [a-zA-Z]
        # Korean matches [가-힣]

        is_korean_q = bool(re.search('[가-힣]', question_text))
        is_english_opt = bool(re.search('[a-zA-Z]', first_option))

        print(f"Is Question Korean? {is_korean_q}")
        print(f"Is Option English? {is_english_opt}")

        if not is_korean_q:
            print("FAIL: Question is not Korean")
        if not is_english_opt:
            print("FAIL: Option is not English")

        page.screenshot(path="verification/verification_quiz.png")

        browser.close()

if __name__ == "__main__":
    run()

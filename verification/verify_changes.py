from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load local file
        file_path = os.path.abspath("card/index.html")
        page.goto(f"file://{file_path}")

        # 1. Verify Card Grid CSS (Bottom Padding)
        page.evaluate("RPG.showScreen('screen-collection')")
        page.evaluate("RPG.renderCardList('collection-grid', RPG.state.inventory, () => {})")
        # Add dummy cards to scroll
        page.evaluate("""
            for(let i=0; i<30; i++) RPG.state.inventory.push('angel');
            RPG.renderCardList('collection-grid', RPG.state.inventory, () => {});
        """)

        # Check padding
        padding = page.evaluate("getComputedStyle(document.querySelector('.card-grid')).paddingBottom")
        print(f"Card Grid Padding Bottom: {padding}")

        page.screenshot(path="verification/card_list_padding.png")

        # 2. Verify Challenge Gacha Logic
        # Set Tickets to 1
        page.evaluate("RPG.state.tickets = 1")

        # Mock runGacha to avoid animation/alerts blocking flow if needed, but we want to see failure
        # We need to click "Challenge Gacha"
        # Navigate to Menu
        page.evaluate("RPG.toMenu()")

        # Take screenshot of menu
        page.screenshot(path="verification/menu.png")

        # Click Challenge Gacha
        page.evaluate("RPG.openChallengeGacha()")

        # Check Ticket Count immediately (Should be 0)
        tickets = page.evaluate("RPG.state.tickets")
        print(f"Tickets after opening (should be 0): {tickets}")

        # Verify Quiz Modal is open and feedback div exists
        feedback_exists = page.evaluate("!!document.getElementById('quiz-feedback')")
        print(f"Feedback Div Exists: {feedback_exists}")

        page.screenshot(path="verification/quiz_open.png")

        # Click a Wrong Answer
        # We need to find the wrong answer.
        # The script creates buttons. The correct one has onclick that calls callback(true).
        # We can just click the first button and check feedback.

        page.evaluate("document.querySelector('#quiz-options button').click()")

        # Wait for potential feedback text
        page.wait_for_timeout(500)

        feedback_text = page.evaluate("document.getElementById('quiz-feedback').innerText")
        print(f"Feedback Text: {feedback_text}")

        page.screenshot(path="verification/quiz_feedback.png")

        browser.close()

if __name__ == "__main__":
    run()

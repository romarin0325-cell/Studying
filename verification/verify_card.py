from playwright.sync_api import sync_playwright

def verify_card_game():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Auto-accept alerts
        page.on("dialog", lambda dialog: dialog.accept())

        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        # 1. Start Game
        print("Navigating to index...")
        page.goto("http://localhost:8000/card/index.html")
        page.wait_for_load_state("networkidle")

        # Click New Game
        print("Starting New Game...")
        # Use more specific selector or fallback
        try:
            page.click("#screen-title button:first-of-type", timeout=5000)
        except:
            print("Failed to click New Game button")
            page.screenshot(path="verification/error_start.png")
            raise

        page.wait_for_timeout(500)

        # 2. Gacha (Pull 10 times)
        print("Pulling Cards...")
        for i in range(10):
            # Ensure menu is visible before clicking
            page.wait_for_selector("#screen-menu", state="visible")
            page.click("#screen-menu button:has-text('카드 뽑기')")

            # Wait for modal visible
            page.wait_for_selector("#modal-gacha", state="visible")

            # Click Confirm in modal
            page.click("#modal-gacha button:has-text('확인')")

            # Wait for modal hidden
            page.wait_for_selector("#modal-gacha", state="hidden")
            page.wait_for_timeout(100)

        # 3. Deck Building
        print("Building Deck...")
        page.click("#screen-menu button:has-text('덱 구성')")
        page.wait_for_selector("#screen-deck", state="visible")

        # Fill Slots
        # Slot 0
        page.click("#slot-0")
        cards = page.query_selector_all(".card-item")
        if cards: cards[0].click()

        # Slot 1
        page.click("#slot-1")
        if cards:
            if len(cards) > 1: cards[1].click()
            else: cards[0].click()

        # Slot 2
        page.click("#slot-2")
        if cards:
            if len(cards) > 2: cards[2].click()
            else: cards[0].click()

        page.screenshot(path="verification/5_deck_filled.png")

        # Confirm Deck
        print("Confirming Deck...")
        page.click("#screen-deck button:has-text('확인')")
        page.wait_for_selector("#screen-menu", state="visible")

        # 4. Battle
        print("Entering Battle...")
        page.click("#screen-menu button:has-text('전투 진입')")
        page.wait_for_selector("#screen-battle", state="visible")
        page.screenshot(path="verification/6_battle_start.png")

        # Execute Turn
        print("Executing Turn...")
        page.wait_for_timeout(1000)
        # Find enabled skill button in the battle controls
        skill_btn = page.query_selector("#battle-controls button.skill-btn:not([disabled])")
        if skill_btn:
            skill_btn.click()
            page.wait_for_timeout(2000) # Wait for animation/log
            page.screenshot(path="verification/7_battle_action.png")
            print("Turn executed and screenshot taken.")
        else:
            print("No skill button found!")

        browser.close()

if __name__ == "__main__":
    verify_card_game()

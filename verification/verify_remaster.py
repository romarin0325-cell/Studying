from playwright.sync_api import sync_playwright
import time
import os

def run():
    if not os.path.exists("verification"):
        os.makedirs("verification")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate
        print("Navigating...")
        page.goto("http://localhost:8080/index.html", wait_until="domcontentloaded")
        print("Page loaded.")

        # 1. Title Screen
        page.screenshot(path="verification/1_title.png")
        print("Title screenshot taken.")

        # 2. Click New Game
        # Wait for button
        page.wait_for_selector("button.menu-btn")
        # Click "새로하기"
        page.click("text=새로하기")

        time.sleep(1) # Wait for transition
        page.screenshot(path="verification/2_menu_3d.png")
        print("Menu screenshot taken.")

        # 3. Gacha
        # Click "일반 뽑기"
        page.click("text=일반 뽑기")
        # Wait a bit for particles
        time.sleep(0.5)
        page.screenshot(path="verification/3_gacha_fx.png")
        print("Gacha screenshot taken.")

        # Close Gacha
        page.click("#modal-gacha button")
        time.sleep(0.5)

        # 4. Collection & Card Info
        page.click("text=카드 확인")
        time.sleep(0.5)

        # Click first card
        # We need to wait for cards to appear
        # collection-grid might be empty if inventory is empty, but we did a gacha.
        page.wait_for_selector(".card-item", timeout=5000)

        cards = page.locator(".card-item")

        if cards.count() > 0:
            cards.first.click()
            time.sleep(0.5)
            page.screenshot(path="verification/4_card_info_hologram.png")
            print("Card Info screenshot taken.")
        else:
            print("No cards found!")

        browser.close()

if __name__ == "__main__":
    run()

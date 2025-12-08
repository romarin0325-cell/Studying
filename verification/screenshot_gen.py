from playwright.sync_api import sync_playwright
import os

def generate_screenshots():
    cwd = os.getcwd()
    file_path = f"file://{cwd}/new.html"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(file_path)

        # Screenshot 1: Town Menu with "Ancient Ruins" button
        # Select a character first to see the menu
        page.evaluate("selectChar('luna')")
        page.wait_for_selector("#town-menu")

        # Scroll down to ensure Ancient Ruins button is visible if needed
        # (It's in the grid, should be visible)

        page.screenshot(path="verification/town_menu.png")
        print("Generated verification/town_menu.png")

        # Screenshot 2: Ancient Ruins Battle (Pharaoh)
        # Mock battle start
        page.evaluate("""
            startBattle({ name: "고대신 파라오", hp: 23000, maxHp: 23000, atk: 550, matk: 500, def: 350, mdef: 350, ai: 'pharaoh', img: '' });
        """)
        page.wait_for_selector("#battle-menu")
        page.screenshot(path="verification/pharaoh_battle.png")
        print("Generated verification/pharaoh_battle.png")

        browser.close()

if __name__ == "__main__":
    generate_screenshots()

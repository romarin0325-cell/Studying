
from playwright.sync_api import sync_playwright
import os

def verify_visuals():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Load local file
        file_path = os.path.abspath("new.html")
        page.goto(f"file://{file_path}")

        # 1. Reset Game to ensure consistent starting state (simulating a fresh load after clear)
        # Note: We can't easily simulate localstorage clear here visually without reload,
        # but we can check the UI elements.

        # 2. Select Queen (to see Korean skill names)
        page.evaluate("selectChar('queen')")

        # 3. Open Shop (to see skill names listed)
        page.evaluate("openShop()")

        # 4. Take Screenshot of Shop (showing Korean names)
        page.screenshot(path="verification/queen_skills_shop.png")
        print("Screenshot saved: verification/queen_skills_shop.png")

        # 5. Close Shop
        page.evaluate("closeShop()")

        # 6. Mock adding an Epic and Legend artifact to show color
        page.evaluate("player.artifacts.push({ name: '테스트 에픽', desc: '...', rarity: 'epic' })")
        page.evaluate("player.artifacts.push({ name: '테스트 전설', desc: '...', rarity: 'legend' })")
        page.evaluate("updateInfo()")

        # 7. Take Screenshot of Status Panel (showing colored artifacts)
        # We need to capture the .status-panel element or top area
        element = page.locator(".status-panel")
        element.screenshot(path="verification/artifact_colors.png")
        print("Screenshot saved: verification/artifact_colors.png")

        browser.close()

if __name__ == "__main__":
    verify_visuals()

from playwright.sync_api import sync_playwright, expect
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Increase height just in case, though mobile viewport should be enough for basic UI
        context = browser.new_context(viewport={'width': 375, 'height': 812})
        page = context.new_page()

        cwd = os.getcwd()
        page.goto(f"file://{cwd}/card/index.html")

        # 1. Start New Game
        page.get_by_role("button", name="새로하기").click()

        # Pull Gacha
        expect(page.locator("#screen-menu")).to_be_visible()
        for _ in range(10):
            page.get_by_role("button", name="카드 뽑기 (1장 소모)").click()
            page.locator("#modal-gacha button").click()

        # 2. Check Collection
        page.get_by_role("button", name="카드 확인").click()
        page.screenshot(path="verification/1_collection.png")
        page.locator(".card-item").first.click()
        page.screenshot(path="verification/2_card_modal.png")
        page.locator("#modal-card button").click()
        page.locator("#screen-collection button").click()

        # 3. Setup Deck
        page.get_by_role("button", name="덱 구성").click()
        page.locator("#slot-0").click()
        page.locator("#deck-card-list .card-item").nth(0).click()
        page.locator("#slot-1").click()
        page.locator("#deck-card-list .card-item").nth(0).click()
        page.locator("#slot-2").click()
        page.locator("#deck-card-list .card-item").nth(0).click()
        page.locator("#screen-deck .menu-btn").last.click()

        # Enter Battle
        page.get_by_role("button", name="전투 진입").click()
        expect(page.locator("#screen-battle")).to_be_visible()
        page.screenshot(path="verification/3_battle_start.png")

        # 4. Check Field Buff Info
        # It says "Element is outside of viewport". Maybe obscured by something or parent overflow?
        # #screen-battle has display: flex.
        # Let's try to scroll it into view specifically or click JS.
        # Or verify Player Stat first.

        # Try checking Player Stat first to see if that works
        page.locator("#player-actor-box").click(force=True)
        expect(page.locator("#modal-info")).to_be_visible()
        page.screenshot(path="verification/5_player_stat.png")
        page.locator("#modal-info button").click()

        # Now try Field Buff again.
        # Maybe use dispatchEvent click?
        # Or just assert it exists and verify functionality via JS evaluation if click fails.
        # But force=True failed with outside viewport? That's odd for force=True.
        # It usually means completely off screen.
        # The CSS: .battle-header { display: flex; ... } .field-buffs { height: 20px; ... }
        # It should be at the top.

        # I'll try to execute JS to click it.
        page.evaluate("document.getElementById('field-buff-box').click()")

        expect(page.locator("#modal-info")).to_be_visible()
        page.screenshot(path="verification/4_field_buff_modal.png")
        page.locator("#modal-info button").click()

        browser.close()

if __name__ == "__main__":
    run()

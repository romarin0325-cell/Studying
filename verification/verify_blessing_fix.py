
import os
import sys
from playwright.sync_api import sync_playwright, expect

def verify_blessing_fix():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the English Vocab Version new.html
        # Using file:// path
        file_path = os.path.abspath("english_vocab_version/new.html")
        page.goto(f"file://{file_path}")

        print("Page loaded.")

        # 1. Select Character (Luna) to start game in town
        # Wait for modal and click button
        page.click("button[onclick=\"selectChar('luna')\"]")
        print("Character selected.")

        # 2. Get Initial Max HP
        initial_max_hp = page.evaluate("player.maxHp")
        print(f"Initial Max HP: {initial_max_hp}")

        # 3. Mock startQuiz to always succeed immediately
        # Making it robust against missing callback
        page.evaluate("""
            window.startQuiz = function(callback) {
                console.log('Mock startQuiz called with:', callback);
                if (typeof callback === 'function') {
                    callback(true);
                } else {
                    console.error('startQuiz called without a function callback');
                }
            };
        """)
        print("Mocked startQuiz.")

        # 4. Mock BLESSINGS.normal
        page.evaluate("""
            BLESSINGS.normal = [
                { id: 'ancient_god_bless', name: "고대신의 축복", desc: "올스탯 +10%, 주는피해 +30%", type: 'normal' }
            ];
        """)
        print("Mocked BLESSINGS.")

        # 5. Call tryBlessing('normal')
        page.evaluate("tryBlessing('normal')")
        print("Called tryBlessing.")

        # 6. Check New Max HP
        new_max_hp = page.evaluate("player.maxHp")
        print(f"New Max HP: {new_max_hp}")

        # 7. Assertions
        if new_max_hp > initial_max_hp:
            print("PASS: Max HP increased immediately after blessing.")
        else:
            print("FAIL: Max HP did not increase immediately.")
            sys.exit(1)

        # 8. Check UI update
        blessing_box_display = page.evaluate("document.getElementById('blessing-box').style.display")
        if blessing_box_display != 'none':
             print("PASS: Blessing box is visible.")
        else:
             print("FAIL: Blessing box is hidden.")

        # 9. Verify Current HP vs Max HP
        current_hp = page.evaluate("player.hp")
        print(f"Current HP: {current_hp} / {new_max_hp}")

        if current_hp < new_max_hp:
             print("PASS: Current HP is less than New Max HP.")

        # 10. Heal
        page.evaluate("player.hp = player.maxHp; updateInfo();")
        print("Healed to full.")

        current_hp_healed = page.evaluate("player.hp")
        if current_hp_healed == new_max_hp:
             print("PASS: Healed to full New Max HP.")

        # 11. Enter Battle
        page.evaluate("enterDungeon(1)")
        print("Entered Dungeon.")

        # 12. Check Battle Start Stats
        battle_hp = page.evaluate("player.hp")
        battle_max_hp = page.evaluate("player.maxHp")

        print(f"Battle HP: {battle_hp} / {battle_max_hp}")

        if battle_hp == battle_max_hp:
             print("PASS: Player starts battle with Full HP.")
        else:
             print("FAIL: Player HP dropped or was not full at start of battle.")
             sys.exit(1)

        # Take screenshot
        page.screenshot(path="verification/blessing_fix.png")
        print("Screenshot saved to verification/blessing_fix.png")

        browser.close()

if __name__ == "__main__":
    verify_blessing_fix()

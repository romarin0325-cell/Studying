from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load the local HTML file
    file_path = os.path.abspath("card/index.html")
    page.goto(f"file://{file_path}")

    # 1. Verify Portrait Bug Fix
    # Need to simulate a game state with Time Ruler (has pos_mid_matk) or similar.
    # We will inject a deck and start battle.

    # Inject deck: Time Ruler (pos_mid_matk) in Mid (index 1)
    # Time Ruler base: atk: 115, matk: 115. Trait: mid_matk +30%.
    # Expected: ATK 115 (white), MATK 149 (green).

    print("Initializing test state...")
    page.evaluate("""() => {
        RPG.initNewGame();
        RPG.state.deck = [null, 'time_ruler', null]; // Mid position
        RPG.startBattleInit();
    }""")

    # Click on the player portrait (Time Ruler is only one active)
    # Since deck has nulls, we need to find the active player index.
    # Time Ruler is at index 1.
    # However, RPG.battle.players array preserves nulls.
    # RPG.battle.currentPlayerIdx skips nulls.
    # currentPlayerIdx will be 1.

    # Simulate click on player actor box
    page.locator("#player-actor-box").click()

    # Wait for modal
    page.wait_for_selector("#modal-info.active")

    # Get the content of the modal
    content = page.locator("#info-content").inner_html()
    print("Modal Content for Portrait Check:")
    print(content)

    # Check for ATK color. Should be white/grey (no span with color or color #eee).
    # Check for MATK color. Should be green (#69f0ae).

    # 2. Verify Snow Rabbit Skill Rename & Logic
    # Inject Snow Rabbit and Night Rabbit for Synergy
    # Snow Rabbit (Normal, Water)
    # Night Rabbit (Rare, Dark)
    # Synergy: Snow Rabbit trait 'syn_night_rabbit' -> Active if Night Rabbit in deck.
    # Skill: Silver Storm (Index 2). Multiplier 2.0x. Synergy Active -> 2.0x boost (Total 4.0x).

    page.evaluate("""() => {
        RPG.closeInfoModal();
        RPG.initNewGame();
        RPG.state.deck = ['snow_rabbit', 'night_rabbit', null];
        RPG.startBattleInit();
    }""")

    # Verify Skill Name in UI (Battle Controls)
    # Snow Rabbit is Vanguard (Index 0).
    skill_btn = page.locator("#battle-controls .skill-btn.mag").nth(1) # Second magic skill (index 2 in list: 0=Barrier, 1=SnowShot, 2=SilverStorm)
    # Wait, Snow Rabbit skills: Barrier(sup), SnowShot(mag), SilverStorm(mag).
    # The controls render all skills.

    print("Checking Skill Name...")
    skill_text = skill_btn.inner_text()
    print(f"Skill Button Text: {skill_text}")

    if "실버스톰" in skill_text:
        print("PASS: Skill renamed to Silver Storm")
    else:
        print("FAIL: Skill name incorrect")

    # 3. Verify Logs for Damage Boost
    # Execute Silver Storm. Target is enemy.
    # Snow Rabbit MATK: 85. Synergy trait boosts Snow Rabbit ATK/DEF (syn_snow_rabbit on Night Rabbit) vs syn_night_rabbit on Snow Rabbit?
    # Night Rabbit trait: syn_snow_rabbit (Snow Rabbit in deck -> Night Rabbit gets ATK/DEF +50%).
    # Snow Rabbit trait: syn_night_rabbit (Night Rabbit in deck -> Snow Rabbit gets MATK/MDEF +50%).
    # So Snow Rabbit MATK = 85 * 1.5 = 127.
    # Silver Storm: 2.0x base. Synergy Boost: 2.0x. Total 4.0x.
    # Expected Damage approx: 127 * 4.0 * (100/(100+def)).

    # Click the skill
    skill_btn.click()

    # Get logs
    log_text = page.locator("#battle-log").inner_text()
    print("Battle Log:")
    print(log_text)

    if "[시너지] 조건 만족! 위력 2배 증가!" in log_text or "[시너지] 조건 만족!" in log_text:
         print("PASS: Synergy log found")
    else:
         print("FAIL: Synergy log missing")

    # Take screenshot
    page.screenshot(path="verification/verify_changes.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)

from playwright.sync_api import sync_playwright
import time
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    file_path = os.path.abspath('card/index.html')
    url = f'file://{file_path}'
    print(f"Loading {url}")

    page.goto(url)

    # 1. Start New Game
    print("Clicking New Game")
    page.click("button:has-text('새로하기')")
    time.sleep(1)

    # 2. Go to Deck
    print("Clicking Deck Config")
    page.click("button:has-text('덱 구성')")

    print("Injecting Game State")
    page.evaluate("""
        gameState.inventory = ['rumi', 'chaos_mage', 'mummy', 'frozen_witch'];
        gameState.deck = ['chaos_mage', 'mummy', 'rumi']; // Van, Mid, Rear
        updateDeckSlots();
    """)

    # The error was finding '카드 확인' instead of '확인'.
    # Use exact match or cleaner selector.
    print("Confirming Deck")
    # '확인' button in deck screen has onclick="confirmDeck()"
    page.click("#screen-deck button[onclick='confirmDeck()']")
    time.sleep(1)

    # 3. Enter Battle
    print("Entering Battle")
    page.click("button:has-text('전투 진입')")
    time.sleep(1)

    # 4. Check Turn Log and Status
    print("Taking Screenshot of Battle Start")
    page.screenshot(path="verification/battle_start.png")

    # Check chaos mage skills
    print("Checking Chaos Mage Skills")
    page.screenshot(path="verification/chaos_mage_skills.png")

    # 5. Test Rumi Logic
    print("Forcing switch to Rumi")
    page.evaluate("battleState.currentPlayerIdx = 2; startPlayerTurn();")
    time.sleep(1)

    print("Checking Rumi Skills")
    page.screenshot(path="verification/rumi_skills.png")

    page.evaluate("battleState.players[2].mp = 100; renderBattlefield();")

    print("Clicking Moonlight Serena")
    page.click("button:has-text('문라이트세레나')")
    time.sleep(1)

    print("Taking Screenshot after Rumi Skill")
    page.screenshot(path="verification/rumi_trait_log.png")

    # 6. Test Frozen Witch Logic
    page.evaluate("""
        let fw = CARDS.find(c => c.id === 'frozen_witch');
        let p = { id: fw.id, proto: fw, name: fw.name, maxHp: fw.stats.hp, hp: fw.stats.hp, mp: 100, atk: fw.stats.atk, matk: fw.stats.matk, def: fw.stats.def, mdef: fw.stats.mdef, buffs: {}, pos: 0, isDead: false, baseCrit: 10 };
        battleState.players[0] = p;
        battleState.currentPlayerIdx = 0;
        startPlayerTurn();
    """)
    time.sleep(1)

    print("Clicking Blizzard")
    page.click("button:has-text('블리자드')")
    time.sleep(1)

    print("Taking Screenshot after Blizzard")
    page.screenshot(path="verification/frozen_witch_log.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
